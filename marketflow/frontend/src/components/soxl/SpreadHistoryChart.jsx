// SC-3 90일 AI/Legacy 듀얼라인 + Spread 면적 2단 차트
import {
  ComposedChart, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";
import { DARK } from "../../constants/theme";

export default function SpreadHistoryChart({ chartData, thresholds }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <p style={{ fontSize: "10px", color: DARK.text.muted, marginBottom: "6px" }}>
        90일 추이
      </p>

      {/* 상단: AI vs Legacy 라인 */}
      <ResponsiveContainer width="100%" height={140}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={DARK.grid} />
          <XAxis
            dataKey="date"
            tickFormatter={d => d.slice(5)}
            interval={14}
            tick={{ fontSize: 9, fill: DARK.text.muted }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            tickFormatter={v => `${v}%`}
            tick={{ fontSize: 9, fill: DARK.text.muted }}
            axisLine={false} tickLine={false}
            width={36}
          />
          <Tooltip
            contentStyle={{ background: DARK.bg.inner, border: `1px solid ${DARK.border}`, borderRadius: "6px", fontSize: "11px" }}
            formatter={(v, name) => [`${v > 0 ? "+" : ""}${v}%`, name === "aiCompute" ? "AI Compute" : "Legacy"]}
          />
          <ReferenceLine y={0} stroke="#334155" strokeWidth={1} />
          <Line dataKey="aiCompute" stroke="#60a5fa" strokeWidth={2} dot={false} activeDot={{ r: 3 }} name="aiCompute" />
          <Line dataKey="legacy"    stroke="#f87171" strokeWidth={2} strokeDasharray="5 3" dot={false} activeDot={{ r: 3 }} name="legacy" />
        </ComposedChart>
      </ResponsiveContainer>

      {/* 하단: Spread 면적 */}
      <ResponsiveContainer width="100%" height={80}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={DARK.grid} />
          <XAxis dataKey="date" hide />
          <YAxis
            domain={[0, thresholds.danger + 5]}
            tickFormatter={v => `${v}pp`}
            tick={{ fontSize: 9, fill: DARK.text.muted }}
            axisLine={false} tickLine={false}
            width={36}
          />
          <Tooltip
            formatter={v => [`${v}pp`, "Spread"]}
            contentStyle={{ background: DARK.bg.inner, border: `1px solid ${DARK.border}`, borderRadius: "6px", fontSize: "11px" }}
          />
          <ReferenceLine y={thresholds.favorable} stroke="#fbbf24" strokeDasharray="3 2" strokeWidth={0.5}
            label={{ value: `${thresholds.favorable}pp`, fontSize: 9, fill: "#fbbf24", position: "right" }} />
          <ReferenceLine y={thresholds.danger} stroke="#f87171" strokeDasharray="3 2" strokeWidth={0.5}
            label={{ value: `${thresholds.danger}pp`, fontSize: 9, fill: "#f87171", position: "right" }} />
          <defs>
            <linearGradient id="spreadGrad2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#60a5fa" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.0}  />
            </linearGradient>
          </defs>
          <Area dataKey="spread" stroke="#60a5fa" fill="url(#spreadGrad2)" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
