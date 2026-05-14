// SC-2 CYCLE 탭 헤더 — 3레이어 점수 + Cycle Score 합산 + 앵커 클릭
import { DARK, LAYER_COLOR } from "../../constants/theme";

const TREND_LABEL = {
  RISING:       { text: "상승 중",  color: "#4ade80" },
  ACCELERATING: { text: "가속 중",  color: "#60a5fa" },
  NEUTRAL:      { text: "중립",     color: "#fbbf24" },
  DECELERATING: { text: "감속 중",  color: "#f87171" },
  FALLING:      { text: "하락 중",  color: "#ef4444" },
};

const PHASE_COLOR = {
  CONTRACTION:   "#f87171",
  EARLY:         "#fbbf24",
  EXPANSION:     "#86efac",
  MID_EXPANSION: "#4ade80",
  PEAK:          "#f472b6",
};

export default function LayerScoreHeader({ data, onLayerClick }) {
  const { total, phase, strength, driver, interpret, layers } = data;
  const phaseColor = PHASE_COLOR[phase] ?? "#94a3b8";

  return (
    <div style={{
      background: DARK.bg.card,
      border: `1px solid ${DARK.border}`,
      borderRadius: "12px",
      padding: "20px 24px",
    }}>

      {/* 상단: Cycle Score 헤드라인 */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "6px" }}>
        <span style={{ fontSize: "48px", fontWeight: 700, color: phaseColor, lineHeight: 1 }}>
          {total}
        </span>
        <div>
          <span style={{ fontSize: "18px", fontWeight: 500, color: phaseColor }}>
            {phase.replace("_", " ")}
          </span>
          <span style={{ fontSize: "13px", color: DARK.text.muted, marginLeft: "10px" }}>
            {strength} · {driver} 기반
          </span>
        </div>
      </div>

      <div style={{ height: "1px", background: DARK.border, margin: "14px 0" }} />

      {/* 레이어 점수 바 */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {layers.map(layer => {
          const pct   = Math.round((layer.score / layer.maxScore) * 100);
          const lc    = LAYER_COLOR[layer.id];
          const trend = TREND_LABEL[layer.trend];

          return (
            <div
              key={layer.id}
              onClick={() => onLayerClick?.(layer.anchor)}
              style={{ cursor: "pointer" }}
            >
              {/* 라벨 행 */}
              <div style={{
                display: "flex", alignItems: "center",
                justifyContent: "space-between", marginBottom: "5px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{
                    fontSize: "12px", fontWeight: 700, color: lc.stroke,
                    letterSpacing: "0.3px", padding: "1px 6px",
                    border: `1px solid ${lc.stroke}`, borderRadius: "3px",
                  }}>
                    {layer.id}
                  </span>
                  <span style={{ fontSize: "12px", color: DARK.text.secondary }}>
                    {layer.label}
                  </span>
                  <span style={{
                    fontSize: "10px", color: trend.color,
                    background: `${trend.color}18`,
                    padding: "1px 6px", borderRadius: "3px",
                  }}>
                    {trend.text}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: DARK.text.primary }}>
                    {layer.score}
                  </span>
                  <span style={{ fontSize: "11px", color: DARK.text.muted }}>
                    / {layer.maxScore}
                  </span>
                  <span style={{ fontSize: "11px", color: lc.stroke, minWidth: "32px", textAlign: "right" }}>
                    {pct}%
                  </span>
                </div>
              </div>

              {/* 프로그레스 바 */}
              <div style={{
                height: "6px",
                background: DARK.bg.inner,
                borderRadius: "3px",
                overflow: "hidden",
              }}>
                <div style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: lc.stroke,
                  borderRadius: "3px",
                  transition: "width 0.6s ease",
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* 해석 텍스트 */}
      <p style={{
        fontSize: "11px", color: DARK.text.muted,
        marginTop: "14px", fontStyle: "italic",
      }}>
        {interpret}
      </p>
    </div>
  );
}
