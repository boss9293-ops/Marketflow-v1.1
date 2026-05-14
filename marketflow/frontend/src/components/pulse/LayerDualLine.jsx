// SC-1 AI Compute vs Legacy Layer 90일 듀얼라인 차트
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";
import LayerTooltip from "./LayerTooltip";
import { DARK } from "../../constants/theme";

export default function LayerDualLine({ chartData }) {
  const last = chartData[chartData.length - 1];

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={chartData} margin={{ top: 8, right: 60, bottom: 0, left: 0 }}>

        <CartesianGrid strokeDasharray="3 3" stroke={DARK.grid} />

        <XAxis
          dataKey="date"
          tickFormatter={d => d.slice(5)}
          interval={14}
          tick={{ fontSize: 9, fill: DARK.text.muted }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={v => `${v}%`}
          tick={{ fontSize: 9, fill: DARK.text.muted }}
          axisLine={false}
          tickLine={false}
          width={36}
        />

        <Tooltip content={<LayerTooltip />} />
        <ReferenceLine y={0} stroke="#334155" strokeWidth={1} />

        {/* AI Compute */}
        <Line
          dataKey="aiCompute"
          stroke="#60a5fa"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3, fill: "#60a5fa" }}
          name="AI Compute"
        />

        {/* Legacy */}
        <Line
          dataKey="legacy"
          stroke="#f87171"
          strokeWidth={2}
          strokeDasharray="5 3"
          dot={false}
          activeDot={{ r: 3, fill: "#f87171" }}
          name="Legacy"
        />

        {/* 우측 끝 라벨 */}
        <ReferenceLine
          x={last.date}
          stroke="transparent"
          label={{
            value: `AI ${last.aiCompute >= 0 ? "+" : ""}${last.aiCompute}%`,
            position: "right",
            fontSize: 10,
            fill: "#60a5fa",
          }}
        />
        <ReferenceLine
          x={last.date}
          stroke="transparent"
          label={{
            value: `Legacy ${last.legacy}%`,
            position: "right",
            fontSize: 10,
            fill: "#f87171",
          }}
        />

      </LineChart>
    </ResponsiveContainer>
  );
}
