// SC-2 SOXX 12개월 가격 + 20W MA 복합 라인차트
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { DARK } from "../../constants/theme";

export default function SoxxChart({ data, layerColor }) {
  const { current, aboveMAPct, bias, history } = data;

  return (
    <div>
      {/* 헤드라인 */}
      <div style={{ marginBottom: "10px" }}>
        <p style={{ fontSize: "11px", color: DARK.text.muted, marginBottom: "4px" }}>
          SOXX + 20W MA
        </p>
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
          <span style={{ fontSize: "28px", fontWeight: 700, color: DARK.text.primary, lineHeight: 1 }}>
            ${current}
          </span>
          <span style={{ fontSize: "12px", color: "#4ade80", fontWeight: 500 }}>
            20W +{aboveMAPct}% · {bias}
          </span>
        </div>
      </div>

      {/* 차트 */}
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={DARK.grid} />
          <XAxis
            dataKey="month"
            tickFormatter={m => m.slice(5)}
            tick={{ fontSize: 9, fill: DARK.text.muted }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            domain={["auto", "auto"]}
            tickFormatter={v => `$${v}`}
            tick={{ fontSize: 9, fill: DARK.text.muted }}
            axisLine={false} tickLine={false}
            width={44}
          />
          <Tooltip
            contentStyle={{
              background: DARK.bg.inner,
              border: `1px solid ${DARK.border}`,
              borderRadius: "6px", fontSize: "11px",
            }}
            formatter={(v, name) => [`$${v}`, name === "price" ? "SOXX" : "20W MA"]}
          />

          {/* 20W MA */}
          <Line
            dataKey="ma20w"
            stroke="#475569"
            strokeWidth={1}
            strokeDasharray="4 2"
            dot={false}
            name="ma20w"
          />

          {/* SOXX 가격 */}
          <Line
            dataKey="price"
            stroke={layerColor}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, fill: layerColor }}
            name="price"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
