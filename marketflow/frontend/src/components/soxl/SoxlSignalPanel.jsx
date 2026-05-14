// SC-3 SOXL 진입·보유·청산 신호 패널 — PositionGuide + SignalCard 2×2
import SignalCard from "./SignalCard";
import PositionGuide from "./PositionGuide";
import { DARK } from "../../constants/theme";

export default function SoxlSignalPanel({ data }) {
  const { positionGuide, items } = data;

  return (
    <div style={{
      background: DARK.bg.card,
      border: `1px solid ${DARK.border}`,
      borderRadius: "12px",
      padding: "20px 24px",
    }}>

      <p style={{ fontSize: "11px", color: DARK.text.muted, letterSpacing: "0.5px", marginBottom: "14px" }}>
        진입 · 보유 · 청산 신호
      </p>

      {/* 포지션 가이드 상단 */}
      <PositionGuide data={positionGuide} />

      {/* 신호 카드 2×2 그리드 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: "12px",
        marginTop: "14px",
      }}>
        {items.map(item => (
          <SignalCard key={item.id} data={item} />
        ))}
      </div>
    </div>
  );
}
