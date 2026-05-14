// SC-3 SOXL 핵심 통계 4종 행 — 현재가/기대경로/이탈률/SOXX 기준
import { DARK } from "../../constants/theme";

export default function SoxlStatsRow({ currentPrice, expectedPath, pathDeviation, soxxRef, psColor }) {
  const stats = [
    { label: "SOXL 현재가",    value: `$${currentPrice}`, color: DARK.text.primary    },
    { label: "3x 기대 경로",   value: `$${expectedPath}`, color: DARK.text.secondary  },
    { label: "경로 이탈률",    value: `+${pathDeviation}%`, color: psColor             },
    { label: "SOXX 기준",      value: `$${soxxRef}`,      color: DARK.text.secondary  },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "16px" }}>
      {stats.map(stat => (
        <div key={stat.label} style={{
          background: DARK.bg.inner,
          border: `1px solid ${DARK.border}`,
          borderRadius: "8px",
          padding: "10px 12px",
        }}>
          <p style={{ fontSize: "10px", color: DARK.text.muted, marginBottom: "4px" }}>{stat.label}</p>
          <span style={{ fontSize: "18px", fontWeight: 700, color: stat.color }}>{stat.value}</span>
        </div>
      ))}
    </div>
  );
}
