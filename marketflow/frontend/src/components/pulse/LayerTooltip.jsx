// SC-1 AI vs Legacy 듀얼라인 커스텀 툴팁 — Spread pp 동기화
import { DARK } from "../../constants/theme";

export default function LayerTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const ai     = payload.find(p => p.dataKey === "aiCompute");
  const legacy = payload.find(p => p.dataKey === "legacy");
  const spread = ai && legacy
    ? parseFloat((ai.value - legacy.value).toFixed(2))
    : null;

  return (
    <div style={{
      background: DARK.bg.inner,
      border: `1px solid ${DARK.border}`,
      borderRadius: "8px",
      padding: "10px 14px",
      fontSize: "12px",
    }}>
      <div style={{ color: DARK.text.muted, marginBottom: "6px" }}>{label}</div>
      {ai && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "3px" }}>
          <span style={{ color: "#60a5fa" }}>AI Compute</span>
          <span style={{ color: ai.value >= 0 ? "#4ade80" : "#f87171", fontWeight: 500 }}>
            {ai.value >= 0 ? "+" : ""}{ai.value}%
          </span>
        </div>
      )}
      {legacy && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "3px" }}>
          <span style={{ color: "#f87171" }}>Legacy</span>
          <span style={{ color: legacy.value >= 0 ? "#4ade80" : "#f87171", fontWeight: 500 }}>
            {legacy.value >= 0 ? "+" : ""}{legacy.value}%
          </span>
        </div>
      )}
      {spread !== null && (
        <div style={{
          display: "flex", justifyContent: "space-between", gap: "12px",
          marginTop: "4px", paddingTop: "4px", borderTop: `1px solid ${DARK.border}`,
        }}>
          <span style={{ color: DARK.text.muted }}>Spread</span>
          <span style={{ color: "#fbbf24", fontWeight: 600 }}>{spread}pp</span>
        </div>
      )}
    </div>
  );
}
