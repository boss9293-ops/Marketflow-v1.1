// SC-2 Reflection Score 슬라이더 바 + AI vs Legacy 요약
import { DARK } from "../../constants/theme";

const SPREAD_STATUS = {
  FAVORABLE:   { color: "#4ade80", label: "Favorable"   },
  CAUTION:     { color: "#fbbf24", label: "Caution"     },
  UNFAVORABLE: { color: "#f87171", label: "Unfavorable" },
};

export default function ReflectionPanel({ reflection, aiVsLegacy, layerColor }) {
  const { value, max, zones, interpret } = reflection;
  const pct         = (value / max) * 100;
  const currentZone = zones.find(z => value >= z.from && value < z.to) ?? zones[zones.length - 1];
  const spreadStyle = SPREAD_STATUS[aiVsLegacy.spreadStatus];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

      {/* Reflection Score */}
      <div style={{
        background: DARK.bg.inner,
        border: `1px solid ${DARK.border}`,
        borderRadius: "8px",
        padding: "12px 14px",
      }}>
        <p style={{ fontSize: "11px", color: DARK.text.muted, marginBottom: "6px" }}>
          Reflection Score
        </p>
        <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "8px" }}>
          <span style={{ fontSize: "28px", fontWeight: 700, color: layerColor, lineHeight: 1 }}>
            {value}
          </span>
          <span style={{
            fontSize: "11px", color: layerColor,
            background: `${layerColor}18`,
            padding: "2px 7px", borderRadius: "3px",
          }}>
            {currentZone.label}
          </span>
        </div>

        {/* 구간 바 */}
        <div style={{ position: "relative", height: "6px", background: DARK.bg.card, borderRadius: "3px", marginBottom: "4px" }}>
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to right, #4ade80, #fbbf24, #f87171)",
            borderRadius: "3px", opacity: 0.3,
          }} />
          <div style={{
            position: "absolute",
            left: `${pct}%`,
            top: "-3px",
            transform: "translateX(-50%)",
            width: "12px", height: "12px",
            borderRadius: "50%",
            background: layerColor,
            border: `2px solid ${DARK.bg.card}`,
          }} />
        </div>

        {/* 구간 라벨 */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: DARK.text.muted }}>
          {zones.map(z => <span key={z.label}>{z.label}</span>)}
        </div>

        <p style={{ fontSize: "10px", color: DARK.text.muted, marginTop: "6px", lineHeight: 1.4 }}>
          {interpret}
        </p>
      </div>

      {/* AI vs Legacy 요약 */}
      <div style={{
        background: DARK.bg.inner,
        border: `1px solid ${DARK.border}`,
        borderRadius: "8px",
        padding: "12px 14px",
      }}>
        <p style={{ fontSize: "11px", color: DARK.text.muted, marginBottom: "8px" }}>
          AI vs Legacy Layer
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
          <div>
            <p style={{ fontSize: "10px", color: DARK.text.muted, marginBottom: "2px" }}>AI Compute</p>
            <span style={{ fontSize: "16px", fontWeight: 700, color: "#4ade80" }}>
              +{aiVsLegacy.aiCompute}%
            </span>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: "10px", color: DARK.text.muted, marginBottom: "2px" }}>Legacy</p>
            <span style={{ fontSize: "16px", fontWeight: 700, color: "#f87171" }}>
              {aiVsLegacy.legacy}%
            </span>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "11px", color: DARK.text.muted }}>Spread</span>
          <span style={{ fontSize: "14px", fontWeight: 700, color: spreadStyle.color }}>
            {aiVsLegacy.spread}pp
            <span style={{
              fontSize: "10px", marginLeft: "6px",
              background: `${spreadStyle.color}18`,
              padding: "1px 6px", borderRadius: "3px",
            }}>
              {spreadStyle.label}
            </span>
          </span>
        </div>
      </div>

    </div>
  );
}
