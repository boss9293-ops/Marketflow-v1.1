// SC-2 L2 AI 인프라 공급 신호 3종 패널
import { DARK } from "../../constants/theme";

const SIGNAL_STYLE = {
  BULLISH: { color: "#4ade80", label: "Bullish" },
  NEUTRAL: { color: "#fbbf24", label: "Neutral" },
  BEARISH: { color: "#f87171", label: "Bearish" },
};

export default function SupplySignalPanel({ signals }) {
  return (
    <div>
      <p style={{ fontSize: "11px", color: DARK.text.muted, marginBottom: "10px" }}>
        AI 인프라 공급 신호
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {signals.map(sig => {
          const style = SIGNAL_STYLE[sig.signal];
          return (
            <div key={sig.id} style={{
              background: DARK.bg.inner,
              border: `1px solid ${DARK.border}`,
              borderRadius: "8px",
              padding: "10px 12px",
            }}>
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: "4px",
              }}>
                <span style={{ fontSize: "11px", fontWeight: 600, color: DARK.text.secondary }}>
                  {sig.label}
                </span>
                <span style={{
                  fontSize: "10px", color: style.color,
                  background: `${style.color}18`,
                  padding: "1px 6px", borderRadius: "3px",
                }}>
                  {style.label}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "4px" }}>
                <span style={{ fontSize: "16px", fontWeight: 700, color: style.color }}>
                  {sig.value}
                </span>
                {sig.changePct != null && (
                  <span style={{ fontSize: "11px", color: "#4ade80" }}>
                    +{sig.changePct}% {sig.changeType}
                  </span>
                )}
              </div>

              <p style={{ fontSize: "10px", color: DARK.text.muted, lineHeight: 1.4, margin: 0 }}>
                {sig.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
