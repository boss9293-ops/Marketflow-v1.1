// SC-2 Hyperscaler CapEx 분기 바 차트 + 현재 분기 기업별 분할
import {
  BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { DARK } from "../../constants/theme";

export default function HyperscalerChart({ data, layerColor }) {
  const { currentTotal, yoyPct, quarter, companies, history } = data;

  return (
    <div>
      {/* 헤드라인 수치 */}
      <div style={{ marginBottom: "12px" }}>
        <p style={{ fontSize: "11px", color: DARK.text.muted, marginBottom: "4px" }}>
          Hyperscaler CapEx 합산
        </p>
        <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
          <span style={{ fontSize: "28px", fontWeight: 700, color: DARK.text.primary, lineHeight: 1 }}>
            ${currentTotal}B
          </span>
          <span style={{ fontSize: "12px", color: "#4ade80", fontWeight: 500 }}>
            +{yoyPct}% YoY
          </span>
          <span style={{ fontSize: "11px", color: DARK.text.muted }}>
            {quarter}
          </span>
        </div>
      </div>

      {/* 분기별 추이 바 차트 */}
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={DARK.grid} />
          <XAxis
            dataKey="quarter"
            tick={{ fontSize: 9, fill: DARK.text.muted }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            tickFormatter={v => `$${v}B`}
            tick={{ fontSize: 9, fill: DARK.text.muted }}
            axisLine={false} tickLine={false}
            width={40}
          />
          <Tooltip
            formatter={v => [`$${v}B`, "합산 CapEx"]}
            contentStyle={{
              background: DARK.bg.inner,
              border: `1px solid ${DARK.border}`,
              borderRadius: "6px", fontSize: "11px",
            }}
          />
          <Bar dataKey="total" radius={[3, 3, 0, 0]}>
            {history.map((_, i) => (
              <Cell
                key={i}
                fill={i === history.length - 1 ? layerColor : `${layerColor}55`}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* 현재 분기 기업별 분할 */}
      <div style={{ marginTop: "10px" }}>
        <p style={{ fontSize: "10px", color: DARK.text.muted, marginBottom: "6px" }}>
          {quarter} 기업별
        </p>
        {companies.map(co => {
          const pct = Math.round((co.value / currentTotal) * 100);
          return (
            <div key={co.name} style={{ marginBottom: "4px" }}>
              <div style={{
                display: "flex", justifyContent: "space-between",
                fontSize: "11px", marginBottom: "2px",
              }}>
                <span style={{ color: DARK.text.secondary }}>{co.name}</span>
                <span style={{ color: DARK.text.primary }}>${co.value}B</span>
              </div>
              <div style={{ height: "3px", background: DARK.bg.inner, borderRadius: "2px" }}>
                <div style={{
                  height: "100%", width: `${pct}%`,
                  background: `${layerColor}80`, borderRadius: "2px",
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
