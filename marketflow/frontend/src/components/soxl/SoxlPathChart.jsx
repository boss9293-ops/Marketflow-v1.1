// SC-3 SOXL 실제 가격 vs 3x 기대 경로 밴드 차트
import {
  ComposedChart, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { DARK } from "../../constants/theme";

export default function SoxlPathChart({ history }) {
  const chartData = history.map(d => ({
    ...d,
    band: [d.pathLow, d.pathHigh],
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={DARK.grid} />
        <XAxis
          dataKey="date"
          tickFormatter={d => d.slice(5)}
          interval={2}
          tick={{ fontSize: 9, fill: DARK.text.muted }}
          axisLine={false} tickLine={false}
        />
        <YAxis
          tickFormatter={v => `$${v}`}
          tick={{ fontSize: 9, fill: DARK.text.muted }}
          axisLine={false} tickLine={false}
          width={40}
          domain={["auto", "auto"]}
        />
        <Tooltip
          contentStyle={{ background: DARK.bg.inner, border: `1px solid ${DARK.border}`, borderRadius: "6px", fontSize: "11px" }}
          formatter={(v, name) => {
            if (name === "band")    return [Array.isArray(v) ? `$${v[0]} ~ $${v[1]}` : v, "기대 경로"];
            if (name === "pathMid") return [`$${v}`, "경로 중간"];
            return [`$${v}`, "SOXL 실제"];
          }}
        />

        {/* 기대 경로 밴드 */}
        <defs>
          <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#60a5fa" stopOpacity={0.2}  />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <Area dataKey="band" stroke="none" fill="url(#bandGrad)" name="band" />

        {/* 경로 중간선 */}
        <Line dataKey="pathMid" stroke="#60a5fa" strokeWidth={1} strokeDasharray="4 2" dot={false} name="pathMid" />

        {/* SOXL 실제 가격 */}
        <Line dataKey="soxl" stroke="#4ade80" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: "#4ade80" }} name="soxl" />

      </ComposedChart>
    </ResponsiveContainer>
  );
}
