// SC-2 L1 개별 지표 카드 — 미니 라인차트 + 현재값 + YoY/QoQ
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts";
import FundamentalTooltip from "./FundamentalTooltip";
import { DARK } from "../../constants/theme";

const SIGNAL_STYLE = {
  EXPANSION:    { color: "#4ade80", label: "Expansion"    },
  ACCELERATING: { color: "#60a5fa", label: "Accelerating" },
  NEUTRAL:      { color: "#fbbf24", label: "Neutral"      },
  DECELERATING: { color: "#f87171", label: "Decelerating" },
  CONTRACTION:  { color: "#ef4444", label: "Contraction"  },
};

export default function FundamentalCard({ indicator, layerColor }) {
  const {
    label, source, updateFreq, currentValue, currentUnit,
    yoyPct, qoqPct, signal, history, thresholds,
  } = indicator;

  const sig          = SIGNAL_STYLE[signal] ?? SIGNAL_STYLE.NEUTRAL;
  const changePct    = yoyPct ?? qoqPct;
  const changeLabel  = yoyPct != null ? "YoY" : "QoQ";

  const displayValue = currentUnit === "NT$B" ? `NT$${currentValue}B`
                     : currentUnit === "$B"   ? `$${currentValue}B`
                     : currentValue;

  return (
    <div style={{
      background: DARK.bg.inner,
      border: `1px solid ${DARK.border}`,
      borderRadius: "8px",
      padding: "14px 16px",
    }}>

      {/* 지표 라벨 + 시그널 */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: "8px",
      }}>
        <div>
          <p style={{ fontSize: "11px", color: DARK.text.muted, marginBottom: "2px" }}>
            {label}
          </p>
          <p style={{ fontSize: "9px", color: DARK.text.muted, opacity: 0.6 }}>
            {source} · {updateFreq}
          </p>
        </div>
        <span style={{
          fontSize: "10px", color: sig.color,
          background: `${sig.color}18`,
          padding: "2px 6px", borderRadius: "3px", flexShrink: 0,
        }}>
          {sig.label}
        </span>
      </div>

      {/* 현재값 + 변화율 */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "10px" }}>
        <span style={{ fontSize: "22px", fontWeight: 700, color: DARK.text.primary, lineHeight: 1 }}>
          {displayValue}
        </span>
        {changePct != null && (
          <span style={{
            fontSize: "12px",
            color: changePct >= 0 ? "#4ade80" : "#f87171",
            fontWeight: 500,
          }}>
            {changePct >= 0 ? "+" : ""}{changePct}% {changeLabel}
          </span>
        )}
      </div>

      {/* 미니 추이 차트 */}
      <ResponsiveContainer width="100%" height={70}>
        <LineChart data={history} margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
          <XAxis dataKey="month" hide />
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip content={<FundamentalTooltip unit={currentUnit} />} />

          {/* Book-to-Bill 1.0 기준선 */}
          {thresholds?.neutral && (
            <ReferenceLine
              y={thresholds.neutral}
              stroke="#fbbf24"
              strokeDasharray="3 2"
              strokeWidth={0.5}
            />
          )}

          <Line
            dataKey="value"
            stroke={layerColor}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: layerColor }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
