// SC-2 공통 탭 바 — PULSE · CYCLE · SOXL 탭 전환
import { DARK } from "../../constants/theme";

export default function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{
      display: "flex",
      borderBottom: `1px solid ${DARK.border}`,
      background: DARK.bg.card,
      padding: "0 20px",
    }}>
      {tabs.map(tab => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              padding: "12px 20px",
              fontSize: "13px",
              fontWeight: isActive ? 600 : 400,
              color: isActive ? "#f1f5f9" : "#64748b",
              background: "transparent",
              border: "none",
              borderBottom: isActive ? "2px solid #60a5fa" : "2px solid transparent",
              cursor: "pointer",
              transition: "all 0.15s",
              letterSpacing: "0.3px",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
