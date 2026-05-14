// SC-2 L1 지표 미니 차트 커스텀 툴팁
import { DARK } from "../../constants/theme";

export default function FundamentalTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;

  const display = unit === "NT$B" ? `NT$${val}B`
                : unit === "$B"   ? `$${val}B`
                : val;

  return (
    <div style={{
      background: DARK.bg.inner,
      border: `1px solid ${DARK.border}`,
      borderRadius: "6px",
      padding: "6px 10px",
      fontSize: "11px",
    }}>
      <span style={{ color: DARK.text.muted }}>{label}: </span>
      <span style={{ color: DARK.text.primary, fontWeight: 600 }}>{display}</span>
    </div>
  );
}
