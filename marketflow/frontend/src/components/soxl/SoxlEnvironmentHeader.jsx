// SC-3 SOXL 탭 최상단 — 환경 상태 카드 + Signal Quality 패널
import { DARK, SOXL_ENV, SIGNAL_QUALITY } from "../../constants/theme";

const ITEM_STATUS = {
  CONFIRMING: { icon: "✓", color: "#4ade80" },
  NEUTRAL:    { icon: "△", color: "#fbbf24" },
  WARNING:    { icon: "!", color: "#f87171" },
};

export default function SoxlEnvironmentHeader({ data }) {
  const { status, layerSpreadPp, soxx90dPp, summary, signalQuality } = data;
  const env   = SOXL_ENV[status];
  const sq    = SIGNAL_QUALITY[signalQuality.grade];
  const sqPct = Math.round((signalQuality.score / signalQuality.maxScore) * 100);

  return (
    <div style={{
      background: DARK.bg.card,
      border: `1px solid ${DARK.border}`,
      borderRadius: "12px",
      padding: "20px 24px",
    }}>

      <p style={{
        fontSize: "11px", color: DARK.text.muted,
        letterSpacing: "0.5px", marginBottom: "14px",
      }}>
        SOXL 환경
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

        {/* 좌: 환경 표시 카드 */}
        <div style={{
          background: env.bg,
          border: `1px solid ${env.border}`,
          borderRadius: "10px",
          padding: "16px 20px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
            <span style={{ fontSize: "20px", fontWeight: 700, color: env.text, letterSpacing: "1px" }}>
              {env.label}
            </span>
          </div>

          <div style={{ display: "flex", gap: "20px", marginBottom: "10px" }}>
            <div>
              <p style={{ fontSize: "10px", color: env.text, opacity: 0.7, marginBottom: "2px" }}>
                Layer Spread
              </p>
              <span style={{ fontSize: "24px", fontWeight: 700, color: env.text }}>
                {layerSpreadPp}pp
              </span>
            </div>
            <div>
              <p style={{ fontSize: "10px", color: env.text, opacity: 0.7, marginBottom: "2px" }}>
                SOXX 90D
              </p>
              <span style={{ fontSize: "24px", fontWeight: 700, color: env.text }}>
                +{soxx90dPp}pp
              </span>
            </div>
          </div>

          <p style={{ fontSize: "11px", color: env.text, opacity: 0.8, lineHeight: 1.4 }}>
            {summary}
          </p>
        </div>

        {/* 우: Signal Quality */}
        <div style={{
          background: DARK.bg.inner,
          border: `1px solid ${DARK.border}`,
          borderRadius: "10px",
          padding: "16px 20px",
        }}>
          {/* 점수 헤드라인 */}
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "12px" }}>
            <span style={{ fontSize: "28px", fontWeight: 700, color: sq.color }}>
              {signalQuality.score}
            </span>
            <span style={{ fontSize: "13px", color: DARK.text.muted }}>
              / {signalQuality.maxScore}
            </span>
            <span style={{
              fontSize: "12px", fontWeight: 600, color: sq.color,
              background: `${sq.color}18`, padding: "2px 8px", borderRadius: "4px",
            }}>
              {sq.label}
            </span>
          </div>

          {/* 점수 바 */}
          <div style={{ height: "4px", background: DARK.bg.card, borderRadius: "2px", marginBottom: "12px" }}>
            <div style={{
              height: "100%", width: `${sqPct}%`,
              background: sq.color, borderRadius: "2px",
              transition: "width 0.6s ease",
            }} />
          </div>

          {/* 항목 리스트 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {signalQuality.items.map(item => {
              const st = ITEM_STATUS[item.status];
              return (
                <div key={item.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "12px", color: st.color, minWidth: "12px", textAlign: "center" }}>
                      {st.icon}
                    </span>
                    <span style={{ fontSize: "12px", color: DARK.text.secondary }}>
                      {item.label}
                    </span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: st.color }}>
                      {item.value}
                    </span>
                    <span style={{ fontSize: "10px", color: DARK.text.muted, marginLeft: "6px" }}>
                      {item.note}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
