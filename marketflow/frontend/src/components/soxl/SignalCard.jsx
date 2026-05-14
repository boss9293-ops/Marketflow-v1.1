// SC-3 개별 신호 카드 — Breadth/Momentum/3xTracking/Rotation 4종 공용
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { DARK } from "../../constants/theme";

const STATUS_STYLE = {
  BULLISH: { color: "#4ade80", label: "Bullish", border: "#4ade8030" },
  CAUTION: { color: "#fbbf24", label: "Caution", border: "#fbbf2430" },
  BEARISH: { color: "#f87171", label: "Bearish", border: "#f8717130" },
};

export default function SignalCard({ data }) {
  const { label, category, value, unit, status, description,
          history, trackingPct, leading, lagging, fading } = data;
  const st = STATUS_STYLE[status];

  return (
    <div style={{
      background: DARK.bg.inner,
      border: `1px solid ${st.border}`,
      borderRadius: "8px",
      padding: "14px 16px",
    }}>
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
        <div>
          <p style={{ fontSize: "11px", fontWeight: 600, color: DARK.text.secondary, marginBottom: "2px" }}>{label}</p>
          <p style={{ fontSize: "9px", color: DARK.text.muted }}>{category}</p>
        </div>
        <span style={{
          fontSize: "10px", color: st.color,
          background: `${st.color}18`,
          padding: "2px 6px", borderRadius: "3px",
        }}>
          {st.label}
        </span>
      </div>

      {/* 현재값 */}
      <div style={{ marginBottom: "8px" }}>
        <span style={{ fontSize: "22px", fontWeight: 700, color: st.color, lineHeight: 1 }}>
          {typeof value === "number" && unit === "%" ? `${value}${unit}` : value}
        </span>
        {trackingPct != null && (
          <span style={{ fontSize: "11px", color: st.color, marginLeft: "6px" }}>
            ({trackingPct}% 기대 경로)
          </span>
        )}
      </div>

      {/* 히스토리 미니 라인 */}
      {history && (
        <ResponsiveContainer width="100%" height={40}>
          <LineChart data={history.map((v, i) => ({ i, v }))} margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
            <XAxis dataKey="i" hide />
            <YAxis hide domain={["auto", "auto"]} />
            <Line dataKey="v" stroke={st.color} strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Rotation 전용: 주도/꺾임/약세 리스트 */}
      {leading && (
        <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "3px" }}>
          {leading.map(s => (
            <span key={s} style={{ fontSize: "10px", color: "#4ade80" }}>▲ {s}</span>
          ))}
          {fading.map(s => (
            <span key={s} style={{ fontSize: "10px", color: "#fbbf24" }}>→ {s}</span>
          ))}
          {lagging.map(s => (
            <span key={s} style={{ fontSize: "10px", color: "#f87171" }}>▼ {s}</span>
          ))}
        </div>
      )}

      {/* 설명 */}
      <p style={{ fontSize: "10px", color: DARK.text.muted, marginTop: "6px", lineHeight: 1.4 }}>
        {description}
      </p>
    </div>
  );
}
