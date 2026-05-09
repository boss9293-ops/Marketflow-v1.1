from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend" / "src"
PROMPT_FILE = FRONTEND / "lib" / "terminal-mvp" / "newsSynthesizePrompts.ts"
RENDERER_FILE = FRONTEND / "lib" / "terminal-mvp" / "narrativeRenderer.ts"
ROUTE_FILE = FRONTEND / "app" / "api" / "terminal" / "news-synthesize" / "route.ts"
TICKER_NEWS_ROUTE_FILE = FRONTEND / "app" / "api" / "terminal" / "ticker" / "[symbol]" / "news" / "route.ts"
TICKER_NEWS_FILE = FRONTEND / "lib" / "terminal-mvp" / "serverTickerNewsFree.ts"
EVENT_RANKER_FILE = FRONTEND / "lib" / "terminal-mvp" / "eventRanker.ts"
REAL_CLIENT_FILE = FRONTEND / "lib" / "terminal-mvp" / "realClient.ts"
APP_SHELL_FILE = FRONTEND / "components" / "watchlist_mvp" / "AppShell.tsx"
BACKEND_TICKER_BRIEF = ROOT / "backend" / "scripts" / "build_ticker_brief.py"
PORTFOLIO_NARRATIVE = ROOT / "backend" / "services" / "narrative_generator.py"


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def section_between(text: str, start: str, end: str) -> str:
    start_index = text.index(start)
    end_index = text.index(end, start_index)
    return text[start_index:end_index]


def test_digest_helpers_removed_from_prompt_module():
    text = read_text(PROMPT_FILE)
    assert "buildDigestSystemPrompt" not in text
    assert "buildDigestPrompt" not in text
    assert "buildDigestRetryPrompt" not in text
    assert "buildDigestFallbackText" not in text
    assert "TerminalNewsDigestSpine" not in text


def test_brief_prompt_stays_stock_specific():
    text = read_text(PROMPT_FILE)
    section = section_between(
        text,
        "export const buildBriefSystemPromptEN =",
        "export const buildBriefUserPromptEN =",
    )

    assert "company-specific catalysts" in section
    assert "broad index comparisons" in section
    assert "technical-analysis language" in section

    user_section = text[text.index("export const buildBriefUserPromptEN ="):]
    assert "Output language: English" not in user_section


def test_renderer_does_not_surface_relative_view():
    text = read_text(RENDERER_FILE)
    assert "spine.CONFIDENCE" in text
    assert "spine.RELATIVE_VIEW" not in text


def test_terminal_news_route_uses_only_current_synthesis_path():
    text = read_text(ROUTE_FILE)

    assert "runTerminalProviderSequence" in text
    assert "provider_used" in text
    assert "synthesizeDigest" not in text
    assert "buildDigestSystemPrompt" not in text
    assert "parseDigestResponse" not in text


def test_ticker_news_requires_direct_symbol_relevance_and_real_publish_time():
    text = read_text(TICKER_NEWS_FILE)

    assert "ticker-news-history-v6-watchlist-direct.json" in text
    assert "inferTickerRelevanceScore" in text
    assert "tickerRelevance < 4" in text
    assert "tickerRelevance * 5" in text
    assert "publishedAtET = `${publishedDateET}T${hhmm}:00${getETOffset(publishedDateET)}`" in text
    assert "publishedAtET = `${d}T${timeSlot}:00 ET`" not in text


def test_ranker_parses_legacy_et_timestamps_for_recency():
    text = read_text(EVENT_RANKER_FILE)

    assert "parseEventTimestampMs" in text
    assert "getEtOffset" in text
    assert "new Date(ts).getTime()" not in text


def test_backend_brief_and_portfolio_news_gate_direct_symbol_events():
    brief_text = read_text(BACKEND_TICKER_BRIEF)
    narrative_text = read_text(PORTFOLIO_NARRATIVE)

    assert "TARGET_ALIASES" in brief_text
    assert "_target_relevance_score" in brief_text
    assert "target_relevance < 4" in brief_text
    assert "_event_mentions_symbol" in narrative_text
    assert "if not _event_mentions_symbol(symbol, evt):" in narrative_text


def test_watchlist_company_name_flows_into_ticker_news_filter():
    route_text = read_text(TICKER_NEWS_ROUTE_FILE)
    server_text = read_text(TICKER_NEWS_FILE)
    client_text = read_text(REAL_CLIENT_FILE)
    shell_text = read_text(APP_SHELL_FILE)

    assert "searchParams.get('companyName')" in route_text
    assert "fetchTickerNewsFromYahoo(symbol, dateET, companyName || undefined)" in route_text
    assert "companyName?: string" in server_text
    assert "getCompanyAliasTerms(companyName)" in server_text
    assert "params.set('companyName', companyName.trim())" in client_text
    assert "service.getTickerNews(selectedSymbol, selectedDateET, requestCompanyName)" in shell_text
