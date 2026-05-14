// SC-2 L2 AI Capital Flow 섹션 — Hyperscaler CapEx + 공급 신호 3종
import HyperscalerChart from "./HyperscalerChart";
import SupplySignalPanel from "./SupplySignalPanel";
import { DARK, LAYER_COLOR } from "../../constants/theme";

export default function Layer2CapitalFlow({ data }) {
  const { score, maxScore, interpret, hyperscalerCapex, supplySignals } = data;
  const lc = LAYER_COLOR.L2;

  return (
    <div id="layer2" style={{
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
            L2
          </span>
          <span style={{ fontSize: "15px", fontWeight: 500, color: DARK.text.primary }}>
            AI Capital Flow
          </span>
          <span style={{ fontSize: "11px", color: DARK.text.muted }}>
            AI 자본 → 반도체 · 분기 1-3개월 선행
          </span>
        </div>
        <div style={{ textAlign: "right" }}>
          <span style={{ fontSize: "20px", fontWeight: 700, color: lc.stroke }}>{score}</span>
          <span style={{ fontSize: "12px", color: DARK.text.muted }}> / {maxScore}</span>
        </div>
      </div>

      {/* 55/45 레이아웃 */}
      <div style={{ display: "grid", gridTemplateColumns: "55% 1fr", gap: "16px" }}>
        <HyperscalerChart data={hyperscalerCapex} layerColor={lc.stroke} />
        <SupplySignalPanel signals={supplySignals} />
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
