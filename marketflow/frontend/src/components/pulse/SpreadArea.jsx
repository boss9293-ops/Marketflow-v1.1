// SC-1 Layer Spread 면적 서브차트 — 주의/위험 임계선 포함
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";
import { DARK } from "../../constants/theme";

export default function SpreadArea({ chartData, thresholds }) {
  const { caution, danger } = thresholds;

  return (
    <div style={{ marginTop: "8px" }}>
      <p style={{
        fontSize: "10px", color: DARK.text.muted,
        marginBottom: "4px", letterSpacing: "0.3px",
      }}>
        Layer Spread (pp)
      </p>
      <ResponsiveContainer width="100%" height={90}>
        <AreaChart data={chartData} margin={{ top: 4, right: 60, bottom: 0, left: 0 }}>

          <CartesianGrid strokeDasharray="3 3" stroke={DARK.grid} />
          <XAxis dataKey="date" hide />
          <YAxis
            domain={[0, danger + 5]}
            tickFormatter={v => `${v}pp`}
            tick={{ fontSize: 9, fill: DARK.text.muted }}
            axisLine={false}
            tickLine={false}
            width={36}
          />

          <Tooltip formatter={v => [`${v}pp`, "Spread"]} />

          {/* 주의 임계선 */}
          <ReferenceLine
            y={caution}
            stroke="#fbbf24"
            strokeDasharray="4 2"
            strokeWidth={0.5}
            label={{ value: `주의 ${caution}pp`, fontSize: 9, fill: "#fbbf24", position: "right" }}
          />

          {/* 위험 임계선 */}
          <ReferenceLine
            y={danger}
            stroke="#f87171"
            strokeDasharray="4 2"
            strokeWidth={0.5}
            label={{ value: `위험 ${danger}pp`, fontSize: 9, fill: "#f87171", position: "right" }}
          />

          <defs>
            <linearGradient id="spreadGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#60a5fa" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.0} />
            </linearGradient>
          </defs>

          <Area
            dataKey="spread"
            stroke="#60a5fa"
            fill="url(#spreadGrad)"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: "#60a5fa" }}
          />

        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
