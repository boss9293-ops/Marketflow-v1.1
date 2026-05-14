// SC-3 섹터별 Spread 기여도 수평 바 — AI(파란)/Legacy(빨간) 분리
import { DARK } from "../../constants/theme";

export default function SpreadContributors({ contributors }) {
  const maxAbs = Math.max(...contributors.map(c => Math.abs(c.contribution)));

  return (
    <div>
      <p style={{ fontSize: "10px", color: DARK.text.muted, marginBottom: "8px", letterSpacing: "0.3px" }}>
        섹터별 Spread 기여도
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
        {[...contributors]
          .sort((a, b) => b.contribution - a.contribution)
          .map(c => {
            const isAI  = c.layer === "AI";
            const color = isAI ? "#60a5fa" : "#f87171";
            const pct   = Math.abs(c.contribution / maxAbs) * 100;

            return (
              <div key={c.sector} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "11px", color: DARK.text.secondary, minWidth: "110px" }}>
                  {c.sector}
                </span>
                <div style={{ flex: 1, height: "6px", background: DARK.bg.inner, borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${pct}%`,
                    background: color,
                    borderRadius: "3px",
                  }} />
                </div>
                <span style={{ fontSize: "11px", fontWeight: 600, color, minWidth: "42px", textAlign: "right" }}>
                  {c.contribution > 0 ? "+" : ""}{c.contribution}pp
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
