from __future__ import annotations
import os
import sqlite3
import urllib.request
import urllib.parse
import json
from flask import Blueprint, jsonify
from db_utils import core_db_path, canonical_symbol

vr_ohlcv_bp = Blueprint("vr_ohlcv", __name__)

# ── Alpaca IEX fallback ────────────────────────────────────────────────────────

def _alpaca_fetch(symbol: str) -> list[dict] | None:
    """
    Alpaca IEX feed 일봉 OHLCV 전체 이력 조회.
    반환: [{d, o, h, l, c, v}, ...] ASC, 실패 시 None.
    """
    api_key    = os.environ.get("ALPACA_API_KEY", "").strip().strip('"').strip("'")
    secret_key = os.environ.get("ALPACA_SECRET_KEY", "").strip().strip('"').strip("'")
    if not api_key or not secret_key:
        return None

    headers = {
        "APCA-API-KEY-ID":     api_key,
        "APCA-API-SECRET-KEY": secret_key,
    }
    base_url = f"https://data.alpaca.markets/v2/stocks/{symbol}/bars"
    params: dict = {
        "timeframe":  "1Day",
        "limit":      "10000",
        "feed":       "iex",
        "sort":       "asc",
        "adjustment": "split",
    }

    bars: list[dict] = []
    url: str | None = f"{base_url}?{urllib.parse.urlencode(params)}"

    while url:
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=15) as r:
                data = json.loads(r.read())
        except Exception:
            return None

        for b in (data.get("bars") or []):
            bars.append({
                "d": b.get("t", "")[:10],
                "o": b.get("o"),
                "h": b.get("h"),
                "l": b.get("l"),
                "c": b.get("c"),
                "v": b.get("v"),
            })

        next_token = data.get("next_page_token")
        if next_token:
            p = dict(params)
            p["page_token"] = next_token
            url = f"{base_url}?{urllib.parse.urlencode(p)}"
        else:
            url = None

    return bars if bars else None


def _alpaca_cache(symbol: str, bars: list[dict]) -> None:
    """받아온 bars를 ohlcv_daily에 INSERT OR IGNORE."""
    try:
        conn = sqlite3.connect(core_db_path())
        conn.executemany(
            """INSERT OR IGNORE INTO ohlcv_daily
               (symbol, date, open, high, low, close, volume)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            [(symbol, b["d"], b["o"], b["h"], b["l"], b["c"], b["v"]) for b in bars],
        )
        conn.commit()
        conn.close()
    except Exception:
        pass  # 캐시 실패는 응답에 영향 없음


# ── Route ──────────────────────────────────────────────────────────────────────

@vr_ohlcv_bp.route("/api/vr-ohlcv/<path:symbol>", methods=["GET"])
def vr_ohlcv(symbol: str):
    """
    GET /api/vr-ohlcv/TQQQ
    1) DB ohlcv_daily 조회
    2) 없으면 Alpaca IEX fallback → DB 캐시 저장
    Response: { symbol, bars:[{d,o,h,l,c,v}], count, source }
    """
    sym   = canonical_symbol(symbol)
    limit = 5000

    # 1. DB 조회
    try:
        conn = sqlite3.connect(core_db_path())
        rows = conn.execute(
            """SELECT date, open, high, low, close, volume
               FROM ohlcv_daily
               WHERE symbol = ?
               ORDER BY date DESC
               LIMIT ?""",
            (sym, limit),
        ).fetchall()
        rows = list(reversed(rows))  # ASC 순으로 복원
        conn.close()
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

    if rows:
        bars = [{"d": r[0], "o": r[1], "h": r[2], "l": r[3], "c": r[4], "v": r[5]} for r in rows]
        return jsonify({"symbol": sym, "bars": bars, "count": len(bars), "source": "db"})

    # 1.5 Local CSV fallback
    import csv
    csv_path = os.path.join(os.path.dirname(__file__), "..", "..", "data", f"{sym.lower()}_history.csv")
    if os.path.exists(csv_path):
        try:
            bars = []
            with open(csv_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                # Field names are usually lower case or Title case, adjust flexibly
                date_key = next((k for k in reader.fieldnames if k and k.lower() == 'date'), 'Date')
                open_key = next((k for k in reader.fieldnames if k and k.lower() == 'open'), 'Open')
                high_key = next((k for k in reader.fieldnames if k and k.lower() == 'high'), 'High')
                low_key = next((k for k in reader.fieldnames if k and k.lower() == 'low'), 'Low')
                close_key = next((k for k in reader.fieldnames if k and k.lower() == 'close'), 'Close')
                volume_key = next((k for k in reader.fieldnames if k and k.lower() == 'volume'), 'Volume')
                
                for row in reader:
                    # Normalize date if necessary, e.g., 'MM/DD/YYYY' to 'YYYY-MM-DD'
                    raw_d = row[date_key]
                    if '/' in raw_d:
                        m, d, y = raw_d.split('/')
                        raw_d = f"{y}-{m.zfill(2)}-{d.zfill(2)}"
                    
                    try:
                        c_val = float(row[close_key])
                        if c_val <= 0: continue
                        bars.append({
                            "d": raw_d,
                            "o": float(row[open_key]) if row.get(open_key) else c_val,
                            "h": float(row[high_key]) if row.get(high_key) else c_val,
                            "l": float(row[low_key])  if row.get(low_key)  else c_val,
                            "c": c_val,
                            "v": int(float(row[volume_key])) if row.get(volume_key) else 0,
                        })
                    except:
                        pass
            
            # Ensure ascending order
            bars.sort(key=lambda x: x['d'])
            # Since limit is mostly handled on DB, we just cap it here
            if len(bars) > limit:
                bars = bars[-limit:]
                
            _alpaca_cache(sym, bars) # Save it to the empty DB so we do it only once!
            return jsonify({"symbol": sym, "bars": bars, "count": len(bars), "source": "local_csv"})
        except Exception as e:
            print("CSV fallback error:", e)

    # 2. Alpaca IEX fallback

    bars = _alpaca_fetch(sym)
    if bars:
        _alpaca_cache(sym, bars)
        return jsonify({"symbol": sym, "bars": bars, "count": len(bars), "source": "alpaca_iex"})

    return jsonify({"error": f"No data for {sym}"}), 404
