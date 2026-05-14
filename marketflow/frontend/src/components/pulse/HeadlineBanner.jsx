// SC-1 PULSE 탭 최상단 고정 배너 — 사이클 상태 · SOXL 환경 · 결론 문구 표시
import { useState } from "react";
import { DARK } from "../../constants/theme";

const PHASE_COLOR = {
  CONTRACTION:   "#f87171",
  EARLY:         "#fbbf24",
  EXPANSION:     "#86efac",
  MID_EXPANSION: "#4ade80",
  PEAK:          "#f472b6",
};

const SOXL_STYLE = {
  FAVORABLE:   { bg: "#14532d", text: "#86efac", icon: "✓" },
  CAUTION:     { bg: "#78350f", text: "#fbbf24", icon: "⚠" },
  UNFAVORABLE: { bg: "#7f1d1d", text: "#f87171", icon: "!" },
};

export default function HeadlineBanner({
  headline, updatedAt, cyclePhase, soxlEnv, editable = false,
}) {
  const [text, setText] = useState(headline);
  const [editing, setEditing] = useState(false);

  const phaseColor = PHASE_COLOR[cyclePhase] ?? "#94a3b8";
  const soxl       = SOXL_STYLE[soxlEnv];
  const phaseLabel = cyclePhase.replace("_", " ");

  return (
    <div style={{
      height: "56px",
      background: DARK.bg.card,
      borderBottom: `1px solid ${DARK.border}`,
      display: "flex",
      alignItems: "center",
      padding: "0 20px",
      gap: "16px",
    }}>

      {/* LIVE 닷 */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
        <LiveDot />
        <span style={{
          fontSize: "11px",
          fontWeight: 600,
          color: phaseColor,
          letterSpacing: "0.5px",
        }}>
          {phaseLabel}
        </span>
      </div>

      <div style={{ width: "1px", height: "20px", background: DARK.border }} />

      {/* 결론 문구 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <input
            autoFocus
            value={text}
            onChange={e => setText(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={e => e.key === "Enter" && setEditing(false)}
            style={{
              width: "100%",
              background: DARK.bg.inner,
              border: `1px solid ${DARK.border}`,
              borderRadius: "4px",
              padding: "4px 8px",
              color: DARK.text.primary,
              fontSize: "14px",
              outline: "none",
            }}
          />
        ) : (
          <p
            onClick={() => editable && setEditing(true)}
            style={{
              fontSize: "14px",
              fontWeight: 500,
              color: DARK.text.primary,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              cursor: editable ? "text" : "default",
              margin: 0,
            }}
          >
            {text}
          </p>
        )}
      </div>

      {/* SOXL 환경 배지 */}
      <div style={{
        flexShrink: 0,
        background: soxl.bg,
        color: soxl.text,
        fontSize: "11px",
        fontWeight: 600,
        padding: "3px 10px",
        borderRadius: "4px",
        letterSpacing: "0.4px",
      }}>
        {soxl.icon} {soxlEnv}
      </div>

      {/* 날짜 */}
      <span style={{
        flexShrink: 0,
        fontSize: "11px",
        color: DARK.text.muted,
      }}>
        {updatedAt}
      </span>
    </div>
  );
}

function LiveDot() {
  return (
    <div style={{ position: "relative", width: "8px", height: "8px" }}>
      <div style={{
        position: "absolute",
        inset: 0,
        borderRadius: "50%",
        background: "#22c55e",
        opacity: 0.4,
        animation: "pulse 2s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute",
        inset: "2px",
        borderRadius: "50%",
        background: "#22c55e",
      }} />
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1);   opacity: 0.4; }
          50%       { transform: scale(2.2); opacity: 0;   }
        }
      `}</style>
    </div>
  );
}
