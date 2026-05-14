// SC-3 SOXL 가격 + 3x 기대 경로 추적 카드
import SoxlPathChart from "./SoxlPathChart";
import SoxlStatsRow from "./SoxlStatsRow";
import { DARK } from "../../constants/theme";

const PATH_STATUS_STYLE = {
  ABOVE: { color: "#4ade80", label: "경로 상단 추적" },
  ON:    { color: "#60a5fa", label: "경로 중간 추적" },
  BELOW: { color: "#f87171", label: "경로 하단 이탈" },
};

export default function SoxlPriceTracker({ data }) {
  const { currentPrice, expectedPath, pathDeviation, pathStatus, soxxRef, leverage, note, history } = data;
  const ps = PATH_STATUS_STYLE[pathStatus];

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
        justifyContent: "space-between", marginBottom: "14px",
      }}>
        <p style={{ fontSize: "11px", color: DARK.text.muted, letterSpacing: "0.5px" }}>
          SOXL 가격 + {leverage} 기대 경로
        </p>
        <span style={{
          fontSize: "11px", fontWeight: 600, color: ps.color,
          background: `${ps.color}18`, padding: "2px 10px", borderRadius: "4px",
        }}>
          {ps.label}
        </span>
      </div>

      {/* 핵심 통계 */}
      <SoxlStatsRow
        currentPrice={currentPrice}
        expectedPath={expectedPath}
        pathDeviation={pathDeviation}
        soxxRef={soxxRef}
        psColor={ps.color}
      />

      {/* 경로 차트 */}
      <SoxlPathChart history={history} />

      {/* 해석 */}
      <p style={{
        fontSize: "11px", color: DARK.text.muted, fontStyle: "italic",
        marginTop: "12px", borderTop: `1px solid ${DARK.border}`,
        paddingTop: "10px", lineHeight: 1.5,
      }}>
        {note}
      </p>
    </div>
  );
}
