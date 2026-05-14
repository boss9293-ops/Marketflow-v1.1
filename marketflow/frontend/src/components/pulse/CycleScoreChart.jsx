// SC-1 12개월 Cycle Score 라인차트 — 페이즈 배경 밴드 + 전환점 마커
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceArea, ReferenceDot, ResponsiveContainer,
} from "recharts";
import CycleTooltip from "./CycleTooltip";
import { DARK } from "../../constants/theme";

const PHASE_BG = {
  CONTRACTION:   "rgba(248,113,113,0.12)",
  EARLY:         "rgba(251,191,36,0.10)",
  EXPANSION:     "rgba(134,239,172,0.10)",
  MID_EXPANSION: "rgba(74,222,128,0.14)",
  PEAK:          "rgba(244,114,182,0.12)",
};

function extractPhaseRanges(history) {
  const ranges = [];
  let start = history[0];
  for (let i = 1; i < history.length; i++) {
    if (history[i].phase !== history[i - 1].phase) {
      ranges.push({ phase: start.phase, x1: start.month, x2: history[i - 1].month });
      start = history[i];
    }
  }
  ranges.push({ phase: start.phase, x1: start.month, x2: history[history.length - 1].month });
  return ranges;
}

export default function CycleScoreChart({ history, phaseBreaks }) {
  const last   = history[history.length - 1];
  const ranges = extractPhaseRanges(history);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={history} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>

        <CartesianGrid strokeDasharray="3 3" stroke={DARK.grid} />

        <XAxis
          dataKey="month"
          tickFormatter={m => m.slice(5)}
          tick={{ fontSize: 10, fill: DARK.text.muted }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: DARK.text.muted }}
          axisLine={false}
          tickLine={false}
          width={28}
        />

        <Tooltip content={<CycleTooltip />} />

        {/* 페이즈 배경 밴드 */}
        {ranges.map((r, i) => (
          <ReferenceArea
            key={i}
            x1={r.x1} x2={r.x2}
            fill={PHASE_BG[r.phase]}
            strokeOpacity={0}
          />
        ))}

        {/* 현재 점수 수평 점선 */}
        <ReferenceLine
          y={last.score}
          stroke="#475569"
          strokeDasharray="4 2"
          strokeWidth={0.5}
        />

        {/* 페이즈 전환 수직선 */}
        {phaseBreaks.map(pb => (
          <ReferenceLine
            key={pb.month}
            x={pb.month}
            stroke="#fbbf24"
            strokeWidth={0.5}
            strokeDasharray="3 3"
            label={{
              value: pb.label,
              fontSize: 9,
              fill: "#fbbf24",
              position: "insideTopRight",
            }}
          />
        ))}

        {/* 메인 라인 */}
        <Line
          dataKey="score"
          stroke="#60a5fa"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#60a5fa", stroke: DARK.bg.card, strokeWidth: 2 }}
        />

        {/* 현재 점 강조 dot */}
        <ReferenceDot
          x={last.month}
          y={last.score}
          r={6}
          fill="#60a5fa"
          stroke={DARK.bg.card}
          strokeWidth={2}
        />

      </LineChart>
    </ResponsiveContainer>
  );
}
