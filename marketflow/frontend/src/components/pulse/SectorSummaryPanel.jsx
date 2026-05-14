// SC-1 섹터 카드 우측 요약 패널 — 분류별 그룹 + trend90/30 수치
import { CLASS_LABEL } from "../../constants/classLabels";
import { getStroke } from "../../constants/sectorColors";
import { DARK } from "../../constants/theme";

const GROUP_ORDER = ["LEADING", "EMERGING", "NEUTRAL", "FADING", "WEAK"];

export default function SectorSummaryPanel({ sectors, selectedSector, onSectorClick }) {
  const grouped = GROUP_ORDER.reduce((acc, cls) => {
    acc[cls] = sectors.filter(s => s.classification === cls);
    return acc;
  }, {});

  return (
    <div style={{ fontSize: "12px", overflowY: "auto", maxHeight: "260px" }}>
      {GROUP_ORDER.map(cls => {
        const items = grouped[cls];
        if (!items.length) return null;
        const meta = CLASS_LABEL[cls];
        return (
          <div key={cls} style={{ marginBottom: "10px" }}>
            <div style={{
              fontSize: "10px", color: DARK.text.muted,
              marginBottom: "4px", letterSpacing: "0.3px",
            }}>
              {meta.icon} {meta.ko}
            </div>
            {items.map(s => {
              const isSelected  = selectedSector === s.id;
              const trend30Sign = s.trend30 >= 0 ? "+" : "";
              return (
                <div
                  key={s.id}
                  onClick={() => onSectorClick(s.id)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "3px 6px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    background: isSelected ? DARK.bg.hover : "transparent",
                    marginBottom: "1px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{
                      width: "6px", height: "6px", borderRadius: "50%",
                      background: getStroke(s.colorClass), flexShrink: 0,
                    }} />
                    <span style={{ color: DARK.text.secondary }}>{s.name}</span>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <span style={{ color: s.trend90 >= 0 ? "#4ade80" : "#f87171" }}>
                      {s.trend90 >= 0 ? "+" : ""}{s.trend90}pp
                    </span>
                    <span style={{
                      color: s.trend30 >= 0 ? "#86efac" : "#f87171",
                      fontSize: "10px",
                    }}>
                      {trend30Sign}{s.trend30}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
