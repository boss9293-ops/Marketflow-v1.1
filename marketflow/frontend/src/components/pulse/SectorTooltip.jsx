// SC-1 섹터 멀티라인 차트 커스텀 툴팁 — 값 내림차순 정렬
import { getStroke } from "../../constants/sectorColors";
import { DARK } from "../../constants/theme";

export default function SectorTooltip({ active, payload, label, sectors }) {
  if (!active || !payload?.length) return null;

  const sectorMap = Object.fromEntries(sectors.map(s => [s.id, s]));

  return (
    <div style={{
      background: DARK.bg.inner,
      border: `1px solid ${DARK.border}`,
      borderRadius: "8px",
      padding: "10px 14px",
      fontSize: "11px",
      minWidth: "160px",
    }}>
      <div style={{ color: DARK.text.muted, marginBottom: "6px" }}>{label}</div>
      {[...payload]
        .sort((a, b) => b.value - a.value)
        .map(p => {
          const s = sectorMap[p.dataKey];
          if (!s) return null;
          return (
            <div key={p.dataKey} style={{
              display: "flex", justifyContent: "space-between",
              gap: "12px", marginBottom: "2px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <div style={{
                  width: "6px", height: "6px", borderRadius: "50%",
                  background: getStroke(s.colorClass), flexShrink: 0,
                }} />
                <span style={{ color: DARK.text.secondary }}>{s.name}</span>
              </div>
              <span style={{ color: p.value >= 0 ? "#4ade80" : "#f87171", fontWeight: 500 }}>
                {p.value >= 0 ? "+" : ""}{p.value}pp
              </span>
            </div>
          );
        })}
    </div>
  );
}
