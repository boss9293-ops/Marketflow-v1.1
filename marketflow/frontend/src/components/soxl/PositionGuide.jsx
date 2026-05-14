// SC-3 SOXL 포지션 가이드 — ENTER/HOLD/REDUCE/EXIT 액션 배너
import { DARK } from "../../constants/theme";

const ACTION_STYLE = {
  ENTER:  { bg: "#14532d", border: "#22c55e", text: "#86efac", label: "진입 가능",  icon: "▲" },
  HOLD:   { bg: "#1e3a5f", border: "#3b82f6", text: "#93c5fd", label: "보유 유지",  icon: "■" },
  REDUCE: { bg: "#78350f", border: "#f59e0b", text: "#fbbf24", label: "비중 축소",  icon: "▼" },
  EXIT:   { bg: "#7f1d1d", border: "#ef4444", text: "#f87171", label: "청산 검토",  icon: "✕" },
};

const CONFIDENCE_LABEL = {
  HIGH:   { text: "High",   color: "#4ade80" },
  MEDIUM: { text: "Medium", color: "#fbbf24" },
  LOW:    { text: "Low",    color: "#f87171" },
};

export default function PositionGuide({ data }) {
  const { action, confidence, note } = data;
  const style = ACTION_STYLE[action];
  const conf  = CONFIDENCE_LABEL[confidence];

  return (
    <div style={{
      background: style.bg,
      border: `1px solid ${style.border}`,
      borderRadius: "10px",
      padding: "14px 18px",
      display: "flex",
      alignItems: "center",
      gap: "16px",
    }}>
      {/* 액션 */}
      <div style={{ flexShrink: 0, textAlign: "center" }}>
        <div style={{ fontSize: "24px", color: style.text, lineHeight: 1 }}>
          {style.icon}
        </div>
        <div style={{ fontSize: "13px", fontWeight: 700, color: style.text, marginTop: "4px", letterSpacing: "0.5px" }}>
          {style.label}
        </div>
      </div>

      <div style={{ width: "1px", height: "40px", background: `${style.text}30` }} />

      {/* 설명 */}
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
          <span style={{ fontSize: "11px", color: style.text, opacity: 0.7 }}>신뢰도</span>
          <span style={{ fontSize: "11px", fontWeight: 600, color: conf.color }}>{conf.text}</span>
        </div>
        <p style={{ fontSize: "12px", color: style.text, opacity: 0.85, lineHeight: 1.5, margin: 0 }}>
          {note}
        </p>
      </div>
    </div>
  );
}
