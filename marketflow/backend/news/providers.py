from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
import os
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import quote_plus
import re
import xml.etree.ElementTree as ET

import requests


@dataclass
class Article:
    id: str
    title: str
    publisher: str
    published_at: str
    url: str
    summary: str = ""
    tickers: Optional[List[str]] = None
    topics: Optional[List[str]] = None
    source: str = "yahoo"
    score: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        if not d.get("tickers"):
            d["tickers"] = []
        if not d.get("topics"):
            d["topics"] = []
        return d


class NewsProvider:
    name: str = "base"

    def fetch_top_news(
        self,
        *,
        region: str,
        tickers: List[str],
        topics: List[str],
        date_from: Optional[str],
        date_to: Optional[str],
        limit: int,
    ) -> List[Article]:
        raise NotImplementedError


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _dedupe_key(article: Article) -> str:
    title = re.sub(r"\s+", " ", _safe_text(article.title)).lower().strip()
    url = re.sub(r"\s+", "", _safe_text(article.url)).lower().strip()
    day = _safe_text(article.published_at)[:10]
    if title:
        return f"title::{title}::{day}"
    if url:
        return f"url::{url}"
    return f"id::{_safe_text(article.id).lower()}"


def _merge_articles(articles: Iterable[Article]) -> List[Article]:
    deduped: Dict[str, Article] = {}
    for article in articles:
        key = _dedupe_key(article)
        if not key:
            continue
        prev = deduped.get(key)
        if prev is None:
            deduped[key] = article
            continue
        prev_score = getattr(prev, "score", 0.0) or 0.0
        current_score = getattr(article, "score", 0.0) or 0.0
        if current_score >= prev_score:
            deduped[key] = article
    return list(deduped.values())


def _published_at_from_epoch(value: Any) -> str:
    try:
        return datetime.fromtimestamp(float(value), tz=timezone.utc).isoformat()
    except Exception:
        return _now_iso()


def _published_at_from_value(value: Any) -> str:
    if isinstance(value, (int, float)):
        return _published_at_from_epoch(value)
    text = _safe_text(value)
    if not text:
        return _now_iso()
    if text.isdigit():
        return _published_at_from_epoch(text)
    try:
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    except Exception:
        return _now_iso()


class YahooFinanceProvider(NewsProvider):
    name = "yahoo_finance"
    _news_endpoint = "https://query2.finance.yahoo.com/v2/finance/news"
    _search_endpoint = "https://query2.finance.yahoo.com/v1/finance/search"
    _crumb_endpoint = "https://query2.finance.yahoo.com/v1/test/getcrumb"

    def _session(self) -> requests.Session:
        session = requests.Session()
        session.headers.update({
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json",
        })
        return session

    def _get_crumb(self, session: requests.Session) -> str:
        try:
            res = session.get(self._crumb_endpoint, timeout=8)
            if not res.ok:
                return ""
            crumb = res.text.strip()
            if "<" in crumb:
                return ""
            return crumb
        except Exception:
            return ""

    def _map_article(self, symbol: str, item: Dict[str, Any], idx: int, *, publisher_default: str = "Yahoo Finance") -> Optional[Article]:
        if not isinstance(item, dict):
            return None
        content = item.get("content") if isinstance(item.get("content"), dict) else {}
        click_through = item.get("clickThroughUrl") if isinstance(item.get("clickThroughUrl"), dict) else {}
        canonical_url = item.get("canonicalUrl") if isinstance(item.get("canonicalUrl"), dict) else {}
        title = _safe_text(
            item.get("title")
            or item.get("headline")
            or content.get("title")
            or content.get("headline")
        )
        url = _safe_text(
            item.get("link")
            or item.get("url")
            or click_through.get("url")
            or canonical_url.get("url")
            or content.get("url")
            or content.get("link")
        )
        if not title or not url:
            return None
        publisher = _safe_text(
            item.get("publisher")
            or item.get("source")
            or content.get("publisher")
            or content.get("source")
            or publisher_default
        ) or publisher_default
        summary = _safe_text(
            item.get("summary")
            or item.get("description")
            or content.get("summary")
            or content.get("description")
        )
        published_at = _published_at_from_value(
            item.get("providerPublishTime")
            or item.get("pubTime")
            or item.get("published_at")
            or item.get("createdAt")
            or item.get("created_at")
            or content.get("providerPublishTime")
            or content.get("pubTime")
            or content.get("published_at")
            or content.get("createdAt")
            or content.get("created_at")
        )
        source = "yahoo_finance"
        if publisher.lower().startswith("yahoo"):
            source = "yahoo_finance"
        return Article(
            id=_safe_text(item.get("uuid") or item.get("id") or url or title or f"{symbol}-{idx}"),
            title=title,
            publisher=publisher,
            published_at=published_at,
            url=url,
            summary=summary or title,
            tickers=[symbol] if symbol else [],
            topics=[],
            source=source,
        )

    def _fetch_symbol_news(self, symbol: str, limit: int) -> List[Article]:
        session = self._session()
        crumb = self._get_crumb(session)
        headers = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}
        if crumb:
            headers["Cookie"] = f"B={crumb}"

        params = {"symbols": symbol, "count": max(1, min(20, int(limit)))}
        if crumb:
            params["crumb"] = crumb

        try:
            res = session.get(self._news_endpoint, params=params, headers=headers, timeout=12)
            if res.ok:
                payload = res.json()
                items = (payload.get("items") or {}).get("result") or payload.get("news") or []
                out = []
                for idx, item in enumerate(items[: max(1, min(20, int(limit)))]):
                    mapped = self._map_article(symbol, item, idx)
                    if mapped:
                        out.append(mapped)
                if out:
                    return out
        except Exception:
            pass

        return []

    def _fetch_search_news(self, query: str, limit: int) -> List[Article]:
        q = _safe_text(query)
        if not q:
            return []
        session = self._session()
        crumb = self._get_crumb(session)
        headers = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}
        if crumb:
            headers["Cookie"] = f"B={crumb}"

        params = {
            "q": q,
            "quotesCount": 0,
            "newsCount": max(1, min(20, int(limit))),
            "enableFuzzyQuery": "false",
            "enableNews": "true",
        }
        if crumb:
            params["crumb"] = crumb

        try:
            res = session.get(self._search_endpoint, params=params, headers=headers, timeout=12)
            if not res.ok:
                return []
            payload = res.json()
        except Exception:
            return []

        out: List[Article] = []
        for idx, item in enumerate(payload.get("news", []) or []):
            mapped = self._map_article(q, item, idx)
            if mapped:
                out.append(mapped)
        return out

    def _fetch_yfinance_news(self, symbol: str, limit: int) -> List[Article]:
        try:
            import yfinance as yf  # type: ignore
        except Exception:
            return []

        try:
            ticker = yf.Ticker(symbol)
            raw_items = list(getattr(ticker, "news", []) or [])
        except Exception:
            return []

        out: List[Article] = []
        for idx, item in enumerate(raw_items[: max(1, min(20, int(limit)))]):
            if not isinstance(item, dict):
                continue
            mapped = self._map_article(symbol, item, idx, publisher_default="Yahoo Finance")
            if mapped:
                out.append(mapped)
        return out

    def fetch_top_news(
        self,
        *,
        region: str,
        tickers: List[str],
        topics: List[str],
        date_from: Optional[str],
        date_to: Optional[str],
        limit: int,
    ) -> List[Article]:
        queries: List[str] = []
        seen: set[str] = set()

        def _append(value: str) -> None:
            q = _safe_text(value)
            if not q or q in seen:
                return
            seen.add(q)
            queries.append(q)

        market_queries = [
            "SPY",
            "QQQ",
            "IWM",
            "DIA",
            "XLK",
            "XLF",
            "XLE",
            "XLV",
            "XLY",
            "XLP",
            "SMH",
        ]
        macro_queries = [
            "^VIX",
            "TLT",
            "HYG",
            "federal reserve",
            "treasury yield",
            "inflation",
            "jobs report",
            "earnings",
            "semiconductors",
            "technology stocks",
        ]

        if tickers:
            for t in tickers:
                _append(t)
        else:
            for q in market_queries + macro_queries:
                _append(q)

        for topic in topics:
            _append(topic)

        per_symbol = max(3, min(10, limit))
        per_query = max(3, min(10, limit))
        pool: List[Article] = []

        for q in queries:
            if q.upper() == q and len(q) <= 12:
                pool.extend(self._fetch_symbol_news(q, per_symbol))
                pool.extend(self._fetch_yfinance_news(q, max(2, per_symbol // 2)))
            else:
                pool.extend(self._fetch_search_news(q, per_query))

        return _merge_articles(pool)


class FinnhubNewsProvider(NewsProvider):
    name = "finnhub"
    _company_news_endpoint = "https://finnhub.io/api/v1/company-news"
    _general_news_endpoint = "https://finnhub.io/api/v1/news"

    def _get_key(self) -> str:
        return (
            os.environ.get("FINNHUB_API_KEY", "").strip()
            or os.environ.get("NEXT_PUBLIC_FINNHUB_API_KEY", "").strip()
        )

    def _map_item(self, symbol: str, item: Dict[str, Any], idx: int) -> Optional[Article]:
        if not isinstance(item, dict):
            return None
        title = _safe_text(item.get("headline") or item.get("title"))
        url = _safe_text(item.get("url"))
        if not title or not url:
            return None
        published_at = _published_at_from_value(item.get("datetime") or item.get("created_at") or item.get("published_at"))
        source = _safe_text(item.get("source") or "Finnhub") or "Finnhub"
        summary = _safe_text(item.get("summary")) or title
        return Article(
            id=_safe_text(item.get("id") or f"{symbol}-{idx}-{url}"),
            title=title,
            publisher=source,
            published_at=published_at,
            url=url,
            summary=summary,
            tickers=[symbol] if symbol else [],
            topics=[],
            source="finnhub",
        )

    def _fetch_company_news(self, symbol: str, date_from: str, date_to: str, limit: int, key: str) -> List[Article]:
        try:
            res = requests.get(
                self._company_news_endpoint,
                params={
                    "symbol": symbol,
                    "from": date_from,
                    "to": date_to,
                    "token": key,
                },
                timeout=12,
            )
            res.raise_for_status()
            payload = res.json()
        except Exception:
            return []

        out: List[Article] = []
        for idx, item in enumerate((payload or [])[: max(1, min(20, int(limit)))]):
            mapped = self._map_item(symbol, item, idx)
            if mapped:
                out.append(mapped)
        return out

    def _fetch_general_news(self, limit: int, key: str) -> List[Article]:
        try:
            res = requests.get(
                self._general_news_endpoint,
                params={
                    "category": "general",
                    "token": key,
                },
                timeout=12,
            )
            res.raise_for_status()
            payload = res.json()
        except Exception:
            return []

        out: List[Article] = []
        for idx, item in enumerate((payload or [])[: max(1, min(20, int(limit)))]):
            mapped = self._map_item("MARKET", item, idx)
            if mapped:
                mapped.tickers = []
                out.append(mapped)
        return out

    def fetch_top_news(
        self,
        *,
        region: str,
        tickers: List[str],
        topics: List[str],
        date_from: Optional[str],
        date_to: Optional[str],
        limit: int,
    ) -> List[Article]:
        key = self._get_key()
        if not key:
            return []

        from_date = date_from or datetime.now(timezone.utc).date().isoformat()
        to_date = date_to or datetime.now(timezone.utc).date().isoformat()
        per_symbol = max(2, min(8, limit))
        pool: List[Article] = []

        if tickers:
            for symbol in tickers:
                q = _safe_text(symbol)
                if not q:
                    continue
                pool.extend(self._fetch_company_news(q, from_date, to_date, per_symbol, key))
        else:
            pool.extend(self._fetch_general_news(limit, key))

        return _merge_articles(pool)


class AlphaVantageNewsProvider(NewsProvider):
    name = "alpha_vantage"
    _endpoint = "https://www.alphavantage.co/query"

    def _get_key(self) -> str:
        return os.environ.get("ALPHA_VANTAGE_KEY", "").strip()

    def _map_item(self, item: Dict[str, Any], idx: int) -> Optional[Article]:
        if not isinstance(item, dict):
            return None
        title = _safe_text(item.get("title"))
        url = _safe_text(item.get("url"))
        if not title or not url:
            return None
        source = _safe_text(item.get("source") or "Alpha Vantage") or "Alpha Vantage"
        summary = _safe_text(item.get("summary")) or title
        published_at = _published_at_from_value(item.get("time_published"))
        ticker_sentiment = item.get("ticker_sentiment")
        tickers: List[str] = []
        if isinstance(ticker_sentiment, list):
            for row in ticker_sentiment:
                if not isinstance(row, dict):
                    continue
                ticker = _safe_text(row.get("ticker"))
                if ticker and ticker not in tickers:
                    tickers.append(ticker)
        topics: List[str] = []
        overall = _safe_text(item.get("overall_sentiment_label"))
        if overall:
            topics.append(overall)
        return Article(
            id=_safe_text(item.get("url") or item.get("title") or f"av-{idx}"),
            title=title,
            publisher=source,
            published_at=published_at,
            url=url,
            summary=summary,
            tickers=tickers,
            topics=topics,
            source="alpha_vantage",
        )

    def fetch_top_news(
        self,
        *,
        region: str,
        tickers: List[str],
        topics: List[str],
        date_from: Optional[str],
        date_to: Optional[str],
        limit: int,
    ) -> List[Article]:
        key = self._get_key()
        if not key:
            return []

        params: Dict[str, Any] = {
            "function": "NEWS_SENTIMENT",
            "apikey": key,
            "limit": str(max(5, min(50, limit * 2))),
        }
        if tickers:
            params["tickers"] = ",".join(_safe_text(t) for t in tickers if _safe_text(t))
        if topics:
            params["topics"] = ",".join(_safe_text(t) for t in topics if _safe_text(t))

        try:
            res = requests.get(self._endpoint, params=params, timeout=12)
            res.raise_for_status()
            payload = res.json()
        except Exception:
            return []

        if isinstance(payload, dict) and (payload.get("Note") or payload.get("Information")):
            return []

        feed = payload.get("feed", []) if isinstance(payload, dict) else []
        out: List[Article] = []
        for idx, item in enumerate(feed[: max(1, min(20, int(limit)))]):
            mapped = self._map_item(item, idx)
            if mapped:
                out.append(mapped)
        return _merge_articles(out)


class YahooNewsProvider(YahooFinanceProvider):
    name = "yahoo"


class GoogleNewsRSSProvider(NewsProvider):
    name = "google_news"
    _endpoint = "https://news.google.com/rss/search"

    def _fetch_for_query(self, query: str, limit: int, window_days: int) -> List[Article]:
        q = _safe_text(query)
        if not q:
            return []
        rss_query = f"{q} when:{window_days}d"
        try:
            res = requests.get(
                self._endpoint,
                params={
                    "q": rss_query,
                    "hl": "en-US",
                    "gl": "US",
                    "ceid": "US:en",
                },
                headers={"User-Agent": "Mozilla/5.0"},
                timeout=12,
            )
            res.raise_for_status()
            root = ET.fromstring(res.text)
        except Exception:
            return []

        out: List[Article] = []
        for item in root.findall(".//item")[: max(1, min(20, int(limit)))]:
            title = _safe_text(item.findtext("title"))
            link = _safe_text(item.findtext("link"))
            if not title or not link:
                continue
            pub_text = _safe_text(item.findtext("pubDate"))
            try:
                published_dt = parsedate_to_datetime(pub_text) if pub_text else None
                if published_dt is None:
                    raise ValueError
                if published_dt.tzinfo is None:
                    published_dt = published_dt.replace(tzinfo=timezone.utc)
                published = published_dt.astimezone(timezone.utc).isoformat()
            except Exception:
                published = _now_iso()
            source_el = item.find("source")
            publisher = _safe_text(source_el.text if source_el is not None else None) or "Google News"
            out.append(
                Article(
                    id=_safe_text(link or title),
                    title=title,
                    publisher=publisher,
                    published_at=published,
                    url=link,
                    summary=_safe_text(item.findtext("description")),
                    source="google_news",
                )
            )
        return out

    def fetch_top_news(
        self,
        *,
        region: str,
        tickers: List[str],
        topics: List[str],
        date_from: Optional[str],
        date_to: Optional[str],
        limit: int,
    ) -> List[Article]:
        base_queries = [
            "stock market",
            "U.S. stocks",
            "S&P 500",
            "Nasdaq",
            "Dow Jones",
            "Federal Reserve",
            "Treasury yields",
            "inflation",
            "earnings",
            "oil prices",
            "gold prices",
            "bitcoin",
            "semiconductors",
            "technology stocks",
            "bank stocks",
        ]
        queries = base_queries[:]
        for t in tickers:
            q = _safe_text(t)
            if q and q not in queries:
                queries.append(q)
        for topic in topics:
            q = _safe_text(topic)
            if q and q not in queries:
                queries.append(q)

        window_days = 3
        if date_from and date_to:
            try:
                from_dt = datetime.fromisoformat(date_from)
                to_dt = datetime.fromisoformat(date_to)
                window_days = max(1, min(7, (to_dt.date() - from_dt.date()).days + 1))
            except Exception:
                window_days = 3

        dedup: Dict[str, Article] = {}
        per_query = max(3, min(8, limit))
        for q in queries:
            for art in self._fetch_for_query(q, per_query, window_days):
                key = _dedupe_key(art)
                if key not in dedup:
                    dedup[key] = art
        return list(dedup.values())


class ReutersRSSProvider(NewsProvider):
    name = "reuters_rss"
    _feeds = [
        "https://feeds.reuters.com/reuters/businessNews",
        "https://feeds.reuters.com/reuters/marketsNews",
        "https://feeds.reuters.com/reuters/topNews",
    ]

    def _fetch_feed(self, feed_url: str, limit: int) -> List[Article]:
        try:
            res = requests.get(feed_url, headers={"User-Agent": "Mozilla/5.0"}, timeout=12)
            res.raise_for_status()
            root = ET.fromstring(res.text)
        except Exception:
            return []

        out: List[Article] = []
        for item in root.findall(".//item")[: max(1, min(20, int(limit)))]:
            title = _safe_text(item.findtext("title"))
            link = _safe_text(item.findtext("link"))
            if not title or not link:
                continue
            pub_text = _safe_text(item.findtext("pubDate"))
            try:
                published_dt = parsedate_to_datetime(pub_text) if pub_text else None
                if published_dt is None:
                    raise ValueError
                if published_dt.tzinfo is None:
                    published_dt = published_dt.replace(tzinfo=timezone.utc)
                published = published_dt.astimezone(timezone.utc).isoformat()
            except Exception:
                published = _now_iso()
            out.append(
                Article(
                    id=_safe_text(link or title),
                    title=title,
                    publisher="Reuters",
                    published_at=published,
                    url=link,
                    summary=_safe_text(item.findtext("description")),
                    source="reuters",
                )
            )
        return out

    def fetch_top_news(
        self,
        *,
        region: str,
        tickers: List[str],
        topics: List[str],
        date_from: Optional[str],
        date_to: Optional[str],
        limit: int,
    ) -> List[Article]:
        per_feed = max(3, min(10, limit))
        out: List[Article] = []
        for feed_url in self._feeds:
            out.extend(self._fetch_feed(feed_url, per_feed))
        return _merge_articles(out)


class CompositeNewsProvider(NewsProvider):
    name = "composite"

    def __init__(self, providers: Optional[List[NewsProvider]] = None) -> None:
        self.providers = providers or [
            YahooFinanceProvider(),
            FinnhubNewsProvider(),
            AlphaVantageNewsProvider(),
            GoogleNewsRSSProvider(),
            ReutersRSSProvider(),
        ]

    def fetch_top_news(
        self,
        *,
        region: str,
        tickers: List[str],
        topics: List[str],
        date_from: Optional[str],
        date_to: Optional[str],
        limit: int,
    ) -> List[Article]:
        pool: List[Article] = []
        sub_limit = max(5, min(15, limit * 2))
        for provider in self.providers:
            try:
                pool.extend(
                    provider.fetch_top_news(
                        region=region,
                        tickers=tickers,
                        topics=topics,
                        date_from=date_from,
                        date_to=date_to,
                        limit=sub_limit,
                    )
                )
            except Exception:
                continue
        return _merge_articles(pool)


class PremiumNewsProvider(NewsProvider):
    def __init__(self, vendor: str = "polygon") -> None:
        self.vendor = vendor
        self.name = "premium"

    def fetch_top_news(
        self,
        *,
        region: str,
        tickers: List[str],
        topics: List[str],
        date_from: Optional[str],
        date_to: Optional[str],
        limit: int,
    ) -> List[Article]:
        # Placeholder adapter for vendor mapping.
        # Keeps downstream schema stable; implementation can be swapped later.
        return []
