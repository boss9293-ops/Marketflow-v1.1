// SC-1 Q1 사이클 위치 카드 — 12개월 Cycle Score 추이 + 페이즈 배경
import CycleScoreChart from "./CycleScoreChart";
import { DARK } from "../../constants/theme";

const PHASE_COLOR = {
  CONTRACTION:   "#f87171",
  EARLY:         "#fbbf24",
  EXPANSION:     "#86efac",
  MID_EXPANSION: "#4ade80",
  PEAK:          "#f472b6",
};

const PHASE_LABEL = {
  CONTRACTION:   "CONTRACTION",
  EARLY:         "EARLY CYCLE",
  EXPANSION:     "EXPANSION",
  MID_EXPANSION: "MID EXPANSION",
  PEAK:          "PEAK",
};

export default function CycleCard({ data }) {
  const { history, phaseBreaks } = data;
  const current    = history[history.length - 1];
  const phaseColor = PHASE_COLOR[current.phase];

  return (
    <div style={{
      background: DARK.bg.card,
      border: `1px solid ${DARK.border}`,
      borderRadius: "12px",
      padding: "20px 24px",
    }}>

      {/* 헤더 */}
      <p style={{
        fontSize: "11px",
        color: DARK.text.muted,
        letterSpacing: "0.5px",
        marginBottom: "12px",
        margin: "0 0 12px 0",
      }}>
        Q1. 사이클 위치?
      </p>

      {/* 헤드라인 수치 */}
      <div style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        marginBottom: "16px",
      }}>
        <span style={{
          fontSize: "28px",
          fontWeight: 700,
          color: phaseColor,
          lineHeight: 1,
        }}>
          {PHASE_LABEL[current.phase]}
        </span>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "32px", fontWeight: 500, color: DARK.text.primary, lineHeight: 1 }}>
            {current.score}
          </div>
          <div style={{ fontSize: "11px", color: DARK.text.muted, marginTop: "2px" }}>
            Cycle Score
          </div>
        </div>
      </div>

      {/* 차트 */}
      <CycleScoreChart history={history} phaseBreaks={phaseBreaks} />

      {/* 범례 */}
      <PhaseLegend />
    </div>
  );
}

function PhaseLegend() {
  const items = [
    { label: "Contraction",   color: "#f87171" },
    { label: "Early",         color: "#fbbf24" },
    { label: "Expansion",     color: "#86efac" },
    { label: "Mid Expansion", color: "#4ade80" },
  ];
  return (
    <div style={{ display: "flex", gap: "16px", marginTop: "12px", flexWrap: "wrap" }}>
      {items.map(it => (
        <div key={it.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{
            width: "10px", height: "10px",
            borderRadius: "2px", background: it.color, opacity: 0.5,
          }} />
          <span style={{ fontSize: "11px", color: DARK.text.muted }}>{it.label}</span>
        </div>
      ))}
    </div>
  );
}
