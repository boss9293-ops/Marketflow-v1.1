export type McpMetaSource = "cache" | "fallback";

export type McpPriceConfirmation = "confirmed" | "weak" | "conflict" | "unclear";

export type McpRiskPressure = "low" | "medium" | "high" | "unclear";

export type McpSignalQuality =
  | "strong_confirmation"
  | "weak_confirmation"
  | "conflict"
  | "noise"
  | "unclear";

export type McpTerminalEventType = "news" | "price_move" | "sector_move" | "risk_signal" | (string & {});

export type McpOutputMeta = {
  source: McpMetaSource;
  live_api_call_attempted: false;
  [key: string]: unknown;
};

export type McpTerminalEventItem = {
  rank: number;
  symbol: string;
  event_type: McpTerminalEventType;
  headline: string;
  event_strength: number;
  price_confirmation: McpPriceConfirmation;
  risk_context: string;
  why_it_matters: string;
  terminal_line: string;
};

export type McpTerminalEventFeedContext = {
  date: string;
  mode: "terminal";
  top_events: McpTerminalEventItem[];
  market_context: Record<string, unknown>;
  risk_context: Record<string, unknown>;
  _meta: McpOutputMeta;
};

export type McpWatchlistNewsItem = {
  symbol: string;
  attention_score: number;
  main_event: string;
  related_events: string[];
  risk_pressure: McpRiskPressure;
  signal_quality: McpSignalQuality;
  watchlist_line: string;
};

export type McpWatchlistNewsContext = {
  mode: "watchlist";
  ranked_watchlist_news: McpWatchlistNewsItem[];
  _meta: McpOutputMeta;
};

export type TerminalWatchlistMcpContext = {
  terminal_event_feed_context: McpTerminalEventFeedContext;
  watchlist_news_context: McpWatchlistNewsContext;
};

export const sampleTerminalWatchlistMcpContext: TerminalWatchlistMcpContext = {
  terminal_event_feed_context: {
    date: "2026-05-14",
    mode: "terminal",
    top_events: [
      {
        rank: 1,
        symbol: "MARKET",
        event_type: "news",
        headline: "Fallback terminal context is available.",
        event_strength: 0.3,
        price_confirmation: "unclear",
        risk_context: "Risk Pressure unclear.",
        why_it_matters: "Cached event visibility is limited, so the watch zone should stay broad.",
        terminal_line: "MARKET: Attention Level Low | Confirmation unclear | Risk Pressure unclear",
      },
    ],
    market_context: {},
    risk_context: {},
    _meta: {
      source: "fallback",
      live_api_call_attempted: false,
    },
  },
  watchlist_news_context: {
    mode: "watchlist",
    ranked_watchlist_news: [
      {
        symbol: "MARKET",
        attention_score: 30,
        main_event: "Fallback watchlist context is available.",
        related_events: [],
        risk_pressure: "unclear",
        signal_quality: "unclear",
        watchlist_line: "MARKET: Attention Level Low; Signal quality is unclear; Risk Pressure unclear.",
      },
    ],
    _meta: {
      source: "fallback",
      live_api_call_attempted: false,
    },
  },
};

