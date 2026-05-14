// SC-3 AI vs Legacy Spread 심화 분석 카드 — 90일 추이 + 섹터 기여도
import SpreadHistoryChart from "./SpreadHistoryChart";
import SpreadContributors from "./SpreadContributors";
import { DARK, SOXL_ENV } from "../../constants/theme";
import { buildCard3Series } from "../../utils/generateMockSeries";

function StatBox({ label, value, color, sub }) {
  return (
    <div style={{
      background: DARK.bg.inner,
      border: `1px solid ${DARK.border}`,
      borderRadius: "8px",
      padding: "12px 14px",
    }}>
      <p style={{ fontSize: "10px", color: DARK.text.muted, marginBottom: "4px" }}>{label}</p>
      <span style={{ fontSize: "20px", fontWeight: 700, color }}>{value}</span>
      <p style={{ fontSize: "9px", color: DARK.text.muted, marginTop: "3px" }}>{sub}</p>
    </div>
  );
}

export default function LayerSpreadDeep({ data }) {
  const {
    currentSpread, status, aiCurrent, legacyCurrent,
    spreadPeak90d, spreadAvg90d, interpretation,
    thresholds, contributors,
  } = data;

  const series = buildCard3Series();
  const env    = SOXL_ENV[status];

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

      {/* 섹션 헤더 */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", marginBottom: "14px",
      }}>
        <p style={{ fontSize: "11px", color: DARK.text.muted, letterSpacing: "0.5px" }}>
          AI vs Legacy Layer — Spread 심화
        </p>
        <span style={{
          fontSize: "11px", fontWeight: 600, color: env.text,
          background: env.bg, padding: "2px 10px", borderRadius: "4px",
        }}>
          {currentSpread}pp · {env.label}
        </span>
      </div>

      {/* 핵심 수치 3종 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "16px" }}>
        <StatBox label="현재 Spread" value={`${currentSpread}pp`} color={env.text}
                 sub={`주의 ${thresholds.favorable}pp / 위험 ${thresholds.danger}pp`} />
        <StatBox label="90D 최고" value={`${spreadPeak90d}pp`} color={DARK.text.primary}
                 sub="90일 중 최대 격차" />
        <StatBox label="90D 평균" value={`${spreadAvg90d}pp`} color={DARK.text.secondary}
                 sub="90일 평균 격차" />
      </div>

      {/* AI / Legacy 현재값 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
        <div style={{ background: DARK.bg.inner, border: `1px solid ${DARK.border}`, borderRadius: "8px", padding: "12px 14px" }}>
          <p style={{ fontSize: "10px", color: "#60a5fa", marginBottom: "4px" }}>AI Compute (90D)</p>
          <span style={{ fontSize: "24px", fontWeight: 700, color: "#60a5fa" }}>+{aiCurrent}%</span>
        </div>
        <div style={{ background: DARK.bg.inner, border: `1px solid ${DARK.border}`, borderRadius: "8px", padding: "12px 14px" }}>
          <p style={{ fontSize: "10px", color: "#f87171", marginBottom: "4px" }}>Legacy (90D)</p>
          <span style={{ fontSize: "24px", fontWeight: 700, color: "#f87171" }}>{legacyCurrent}%</span>
        </div>
      </div>

      {/* 90일 통합 차트 */}
      <SpreadHistoryChart chartData={chartData} thresholds={thresholds} />

      {/* 섹터 기여도 */}
      <SpreadContributors contributors={contributors} />

      {/* 해석 */}
      <p style={{
        fontSize: "11px", color: DARK.text.muted, fontStyle: "italic",
        marginTop: "12px", borderTop: `1px solid ${DARK.border}`,
        paddingTop: "10px", lineHeight: 1.5,
      }}>
        {interpretation}
      </p>
    </div>
  );
}
