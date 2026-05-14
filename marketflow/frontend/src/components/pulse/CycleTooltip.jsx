// SC-1 Cycle Score 차트 커스텀 툴팁
import { DARK } from "../../constants/theme";

const PHASE_COLOR = {
  CONTRACTION:   "#f87171",
  EARLY:         "#fbbf24",
  EXPANSION:     "#86efac",
  MID_EXPANSION: "#4ade80",
  PEAK:          "#f472b6",
};

export default function CycleTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const { score, phase } = payload[0].payload;

  return (
    <div style={{
      background: DARK.bg.inner,
      border: `1px solid ${DARK.border}`,
      borderRadius: "8px",
      padding: "8px 12px",
      fontSize: "12px",
    }}>
      <div style={{ color: DARK.text.muted, marginBottom: "4px" }}>{label}</div>
      <div style={{ color: DARK.text.primary, fontWeight: 600 }}>
        Score: {score}
      </div>
      <div style={{ color: PHASE_COLOR[phase], marginTop: "2px" }}>
        {phase.replace("_", " ")}
      </div>
    </div>
  );
}
