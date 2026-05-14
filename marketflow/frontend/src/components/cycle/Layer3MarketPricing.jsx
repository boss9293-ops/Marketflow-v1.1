// SC-2 L3 Market Pricing 섹션 — SOXX 차트 + Reflection + 이벤트 로그
import SoxxChart from "./SoxxChart";
import ReflectionPanel from "./ReflectionPanel";
import { DARK, LAYER_COLOR } from "../../constants/theme";

const EVENT_TYPE_STYLE = {
  FUNDAMENTAL: { color: "#4ade80", label: "FUNDAMENTAL" },
  AI_CAPITAL:  { color: "#60a5fa", label: "AI CAPITAL"  },
  RISK:        { color: "#f87171", label: "RISK FLAG"   },
  MARKET:      { color: "#f472b6", label: "MARKET"      },
};

function EventLog({ events }) {
  return (
    <div style={{ marginTop: "16px" }}>
      <p style={{ fontSize: "11px", color: DARK.text.muted, marginBottom: "8px", letterSpacing: "0.3px" }}>
        최근 이벤트
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {events.map((ev, i) => {
          const evStyle = EVENT_TYPE_STYLE[ev.type] ?? EVENT_TYPE_STYLE.MARKET;
          return (
            <div key={i} style={{
              display: "flex", gap: "12px", alignItems: "flex-start",
              padding: "8px 12px",
              background: DARK.bg.inner,
              borderRadius: "6px",
              borderLeft: `3px solid ${evStyle.color}`,
            }}>
              <span style={{ fontSize: "10px", color: DARK.text.muted, minWidth: "72px", paddingTop: "1px" }}>
                {ev.date}
              </span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: "12px", color: DARK.text.primary, margin: "0 0 2px 0" }}>
                  {ev.title}
                </p>
                <p style={{ fontSize: "10px", color: evStyle.color, margin: 0 }}>
                  → {ev.impact}
                </p>
              </div>
              <span style={{
                fontSize: "9px", color: evStyle.color,
                background: `${evStyle.color}18`,
                padding: "1px 6px", borderRadius: "3px",
                flexShrink: 0, letterSpacing: "0.3px",
              }}>
                {evStyle.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Layer3MarketPricing({ data }) {
  const { score, maxScore, interpret, soxx, reflectionScore, aiVsLegacy, eventLog } = data;
  const lc = LAYER_COLOR.L3;

  return (
    <div id="layer3" style={{
      background: DARK.bg.card,
      border: `1px solid ${DARK.border}`,
      borderRadius: "12px",
      padding: "20px 24px",
    }}>

      {/* 섹션 헤더 */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", marginBottom: "16px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{
            fontSize: "11px", fontWeight: 700, color: lc.stroke,
            letterSpacing: "0.5px", padding: "2px 8px",
            border: `1px solid ${lc.stroke}`, borderRadius: "4px",
          }}>
            L3
          </span>
          <span style={{ fontSize: "15px", fontWeight: 500, color: DARK.text.primary }}>
            Market Pricing
          </span>
          <span style={{ fontSize: "11px", color: DARK.text.muted }}>
            시장 반응도 · 일별 갱신
          </span>
        </div>
        <div style={{ textAlign: "right" }}>
          <span style={{ fontSize: "20px", fontWeight: 700, color: lc.stroke }}>{score}</span>
          <span style={{ fontSize: "12px", color: DARK.text.muted }}> / {maxScore}</span>
        </div>
      </div>

      {/* SOXX 차트 + Reflection 패널 */}
      <div style={{ display: "grid", gridTemplateColumns: "60% 1fr", gap: "16px" }}>
        <SoxxChart data={soxx} layerColor={lc.stroke} />
        <ReflectionPanel reflection={reflectionScore} aiVsLegacy={aiVsLegacy} layerColor={lc.stroke} />
      </div>

      {/* 이벤트 로그 */}
      <EventLog events={eventLog} />

      {/* 해석 */}
      <p style={{
        fontSize: "11px", color: DARK.text.muted,
        marginTop: "14px", fontStyle: "italic",
        borderTop: `1px solid ${DARK.border}`,
        paddingTop: "10px",
      }}>
        {interpret}
      </p>
    </div>
  );
}
