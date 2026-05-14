// SC-3 SOXL 탭 최상위 조립 — 환경 → Spread → 신호 → 경로 추적
import pulseData from "../../data/pulseData.json";
import SoxlEnvironmentHeader from "./SoxlEnvironmentHeader";
import LayerSpreadDeep from "./LayerSpreadDeep";
import SoxlSignalPanel from "./SoxlSignalPanel";
import SoxlPriceTracker from "./SoxlPriceTracker";
import { DARK } from "../../constants/theme";

export default function SoxlTab() {
  const { environment, layerSpread, signals, priceTracker } = pulseData.soxl;

  return (
    <div style={{ background: DARK.bg.page, minHeight: "100vh" }}>

      {/* 탭 내부 안내 배너 */}
      <div style={{
        padding: "12px 20px",
        borderBottom: `1px solid ${DARK.border}`,
        background: DARK.bg.card,
        display: "flex", alignItems: "center", gap: "8px",
      }}>
        <span style={{ fontSize: "11px", color: DARK.text.muted }}>SOXL</span>
        <span style={{ fontSize: "11px", color: DARK.text.muted }}>·</span>
        <span style={{ fontSize: "11px", color: DARK.text.secondary }}>
          환경 → Spread → 신호 → 경로 추적 순서로 읽는다
        </span>
      </div>

      {/* 카드 영역 */}
      <div style={{
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}>
        <SoxlEnvironmentHeader data={environment}  />
        <LayerSpreadDeep       data={layerSpread}  />
        <SoxlSignalPanel       data={signals}      />
        <SoxlPriceTracker      data={priceTracker} />
      </div>

    </div>
  );
}
