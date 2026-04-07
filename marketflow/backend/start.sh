#!/bin/bash

mkdir -p /app/output/cache

# Background: run build scripts if output files are missing
(
    echo "[bg] Checking output files..."

    # Wait for DB to be ready (app.py downloads it on startup)
    sleep 10

    if [ ! -f "/app/output/risk_v1.json" ]; then
        echo "[bg] Building risk_v1..."
        python scripts/build_risk_v1.py && echo "[bg][OK] risk_v1" || echo "[bg][FAIL] risk_v1"
    else
        echo "[bg] risk_v1.json exists, skipping"
    fi

    if [ ! -f "/app/output/risk_alert.json" ]; then
        echo "[bg] Building risk_alert..."
        python scripts/build_risk_alert.py && echo "[bg][OK] risk_alert" || echo "[bg][FAIL] risk_alert"
    else
        echo "[bg] risk_alert.json exists, skipping"
    fi

    if [ ! -f "/app/output/current_90d.json" ]; then
        echo "[bg] Building current_90d..."
        python scripts/build_current_90d.py && echo "[bg][OK] current_90d" || echo "[bg][FAIL] current_90d"
    else
        echo "[bg] current_90d.json exists, skipping"
    fi

    python scripts/build_smart_money.py   && echo "[bg][OK] smart_money"  || echo "[bg][FAIL] smart_money"
    python scripts/build_market_tape.py   && echo "[bg][OK] market_tape"  || echo "[bg][FAIL] market_tape"
    python scripts/build_market_state.py  && echo "[bg][OK] market_state" || echo "[bg][FAIL] market_state"

    echo "[bg] All builds done"
) &

echo "[startup] Starting gunicorn on port ${PORT:-8080}..."
exec gunicorn --bind :${PORT:-8080} --workers 1 --threads 8 --timeout 300 app:app
