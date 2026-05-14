// SC-1/SC-2/SC-3 공통 다크 디자인 토큰 — Pulse·Cycle·SOXL 탭
export const DARK = {
  bg: {
    page:  "#020617",
    card:  "#0f172a",
    inner: "#1e293b",
    hover: "#334155",
  },
  text: {
    primary:   "#f1f5f9",
    secondary: "#94a3b8",
    muted:     "#64748b",
  },
  border: "#1e293b",
  grid:   "#1e293b",
  cycle: {
    CONTRACTION:   "#f87171",
    EARLY:         "#fbbf24",
    EXPANSION:     "#86efac",
    MID_EXPANSION: "#4ade80",
    PEAK:          "#f472b6",
  },
  soxl: {
    FAVORABLE:   { bg: "#14532d", text: "#86efac" },
    CAUTION:     { bg: "#78350f", text: "#fbbf24" },
    UNFAVORABLE: { bg: "#7f1d1d", text: "#f87171" },
  },
};

export const LAYER_COLOR = {
  L1: { stroke: "#4ade80", bg: "rgba(74,222,128,0.08)",  label: "Fundamental"     },
  L2: { stroke: "#60a5fa", bg: "rgba(96,165,250,0.08)",  label: "AI Capital Flow" },
  L3: { stroke: "#f472b6", bg: "rgba(244,114,182,0.08)", label: "Market Pricing"  },
};

export const SOXL_ENV = {
  FAVORABLE:   { bg: "#14532d", text: "#86efac", border: "#22c55e", label: "FAVORABLE"   },
  CAUTION:     { bg: "#78350f", text: "#fbbf24", border: "#f59e0b", label: "CAUTION"     },
  UNFAVORABLE: { bg: "#7f1d1d", text: "#f87171", border: "#ef4444", label: "UNFAVORABLE" },
};

export const SIGNAL_QUALITY = {
  HIGH:   { color: "#4ade80", label: "High"   },
  MEDIUM: { color: "#fbbf24", label: "Medium" },
  LOW:    { color: "#f87171", label: "Low"    },
};
