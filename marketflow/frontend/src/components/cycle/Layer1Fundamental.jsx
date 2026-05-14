// SC-2 L1 Fundamental 섹션 — 실물 반도체 경기 4개 지표 2×2 그리드
import FundamentalCard from "./FundamentalCard";
import { DARK, LAYER_COLOR } from "../../constants/theme";

export default function Layer1Fundamental({ data }) {
  const { score, maxScore, interpret, indicators } = data;
  const lc = LAYER_COLOR.L1;

  return (
    <div id="layer1" style={{
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
            L1
          </span>
          <span style={{ fontSize: "15px", fontWeight: 500, color: DARK.text.primary }}>
            Fundamental
          </span>
          <span style={{ fontSize: "11px", color: DARK.text.muted }}>
            실물 반도체 경기 · 월 1회 갱신
          </span>
        </div>
        <div style={{ textAlign: "right" }}>
          <span style={{ fontSize: "20px", fontWeight: 700, color: lc.stroke }}>
            {score}
          </span>
          <span style={{ fontSize: "12px", color: DARK.text.muted }}> / {maxScore}</span>
        </div>
      </div>

      {/* 4개 지표 2×2 그리드 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: "12px",
      }}>
        {indicators.map(ind => (
          <FundamentalCard key={ind.id} indicator={ind} layerColor={lc.stroke} />
        ))}
      </div>

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
