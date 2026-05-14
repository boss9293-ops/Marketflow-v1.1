// SC-1 섹터 카드 하단 범례 — 5단계 컬러 클래스
import { COLOR_MAP } from "../../constants/sectorColors";
import { CLASS_LABEL } from "../../constants/classLabels";
import { DARK } from "../../constants/theme";

const ITEMS = [
  { colorClass: "DARK_GREEN",  cls: "LEADING"  },
  { colorClass: "LIGHT_GREEN", cls: "EMERGING" },
  { colorClass: "YELLOW",      cls: "NEUTRAL"  },
  { colorClass: "LIGHT_RED",   cls: "FADING"   },
  { colorClass: "DARK_RED",    cls: "WEAK"     },
];

export default function SectorLegend() {
  return (
    <div style={{
      display: "flex", gap: "16px", marginTop: "12px",
      paddingTop: "12px", borderTop: `1px solid ${DARK.border}`,
      flexWrap: "wrap",
    }}>
      {ITEMS.map(it => (
        <div key={it.cls} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{
            width: "20px", height: "2px",
            background: COLOR_MAP[it.colorClass].stroke,
          }} />
          <span style={{ fontSize: "10px", color: DARK.text.muted }}>
            {CLASS_LABEL[it.cls].ko}
          </span>
        </div>
      ))}
    </div>
  );
}
