// SC-1 Q5 SOXL 환경 카드 — AI vs Legacy 듀얼라인 + Spread 서브차트
import LayerDualLine from "./LayerDualLine";
import SpreadArea from "./SpreadArea";
import { DARK } from "../../constants/theme";
import { buildCard3Series } from "../../utils/generateMockSeries";

const SOXL_STYLE = {
  FAVORABLE:   { bg: "#14532d", text: "#86efac", icon: "✓" },
  CAUTION:     { bg: "#78350f", text: "#fbbf24", icon: "⚠" },
  UNFAVORABLE: { bg: "#7f1d1d", text: "#f87171", icon: "!" },
};

export default function SoxlCard({ data }) {
  const { spreadCurrent, soxlEnv, thresholds } = data;
  const series = buildCard3Series();
  const style  = SOXL_STYLE[soxlEnv];

  const chartData = series.dates.map((date, i) => ({
    date,
    aiCompute: parseFloat(series.aiCompute[i].toFixed(2)),
    legacy:    parseFloat(series.legacy[i].toFixed(2)),
    spread:    parseFloat(series.spread[i].toFixed(2)),
  }));

  return (
    <div style={{
      background: DARK.bg.card,
      border: `1px solid ${DARK.border}`,
      borderRadius: "12px",
      padding: "20px 24px",
    }}>

      {/* 헤더 */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", marginBottom: "16px",
      }}>
        <p style={{ fontSize: "11px", color: DARK.text.muted, letterSpacing: "0.5px", margin: 0 }}>
          Q5. SOXL 환경
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{
            background: style.bg,
            color: style.text,
            fontSize: "12px",
            fontWeight: 600,
            padding: "3px 10px",
            borderRadius: "4px",
            letterSpacing: "0.4px",
          }}>
            {style.icon} {soxlEnv}
          </span>
          <span style={{ fontSize: "20px", fontWeight: 700, color: style.text }}>
            {spreadCurrent}pp
          </span>
        </div>
      </div>

      {/* 메인 차트 */}
      <LayerDualLine chartData={chartData} />

      {/* Spread 서브차트 */}
      <SpreadArea chartData={chartData} thresholds={thresholds} />

      {/* 하단 설명 */}
      <p style={{
        fontSize: "11px",
        color: DARK.text.muted,
        marginTop: "10px",
        lineHeight: 1.5,
      }}>
        스프레드 확대 = AI 단독 랠리 진행 → SOXL 변동성 노출 증가
      </p>
    </div>
  );
}
