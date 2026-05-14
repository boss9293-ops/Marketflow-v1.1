// SC-1 Q2-Q4 섹터 모멘텀 카드 — 필터 버튼 + 멀티라인 차트 + 우측 요약 패널
import { useState } from "react";
import SectorMultiLine from "./SectorMultiLine";
import SectorSummaryPanel from "./SectorSummaryPanel";
import SectorLegend from "./SectorLegend";
import { DARK } from "../../constants/theme";
import { sortSectors } from "../../constants/classLabels";

const FILTERS = [
  { label: "전체",     value: null        },
  { label: "Q2 주도", value: "LEADING"   },
  { label: "Q3 부상", value: "EMERGING"  },
  { label: "Q4 꺾임", value: "FADING"    },
];

export default function SectorCard({ data }) {
  const [selectedSector, setSelectedSector] = useState(null);
  const [filter, setFilter]                 = useState(null);

  const sorted  = sortSectors(data.sectors);
  const visible = filter
    ? sorted.filter(s => s.classification === filter)
    : sorted;

  function handleSectorClick(id) {
    setSelectedSector(prev => prev === id ? null : id);
  }

  return (
    <div style={{
      background: DARK.bg.card,
      border: `1px solid ${DARK.border}`,
      borderRadius: "12px",
      padding: "20px 24px",
    }}>

      {/* 헤더 + 필터 */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", marginBottom: "16px",
      }}>
        <p style={{
          fontSize: "11px", color: DARK.text.muted,
          letterSpacing: "0.5px", margin: 0,
        }}>
          Q2-Q4. 섹터 모멘텀 (90일)
        </p>

        <div style={{ display: "flex", gap: "6px" }}>
          {FILTERS.map(f => (
            <button
              key={f.label}
              onClick={() => setFilter(f.value)}
              style={{
                padding: "3px 10px",
                fontSize: "11px",
                borderRadius: "4px",
                border: `1px solid ${filter === f.value ? "#60a5fa" : DARK.border}`,
                background: filter === f.value ? "rgba(96,165,250,0.15)" : "transparent",
                color: filter === f.value ? "#60a5fa" : DARK.text.muted,
                cursor: "pointer",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 차트 + 사이드 패널 */}
      <div style={{ display: "flex", gap: "16px" }}>
        <div style={{ flex: "0 0 70%" }}>
          <SectorMultiLine
            sectors={visible}
            selectedSector={selectedSector}
            onSectorClick={handleSectorClick}
          />
        </div>
        <div style={{ flex: "0 0 calc(30% - 16px)" }}>
          <SectorSummaryPanel
            sectors={sorted}
            selectedSector={selectedSector}
            onSectorClick={handleSectorClick}
          />
        </div>
      </div>

      <SectorLegend />
    </div>
  );
}
