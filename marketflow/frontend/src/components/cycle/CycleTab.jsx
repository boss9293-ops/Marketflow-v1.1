// SC-2 CYCLE 탭 최상위 조립 컴포넌트 — 3-Layer 근거 화면
import pulseData from "../../data/pulseData.json";
import LayerScoreHeader from "./LayerScoreHeader";
import Layer1Fundamental from "./Layer1Fundamental";
import Layer2CapitalFlow from "./Layer2CapitalFlow";
import Layer3MarketPricing from "./Layer3MarketPricing";
import { DARK } from "../../constants/theme";

export default function CycleTab() {
  const { layerScores, layer1, layer2, layer3 } = pulseData.cycle;

  function scrollToLayer(anchor) {
    document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div style={{ background: DARK.bg.page, minHeight: "100vh" }}>

      {/* 탭 내부 안내 배너 */}
      <div style={{
        padding: "12px 20px",
        borderBottom: `1px solid ${DARK.border}`,
        background: DARK.bg.card,
        display: "flex", alignItems: "center", gap: "8px",
      }}>
        <span style={{ fontSize: "11px", color: DARK.text.muted }}>CYCLE</span>
        <span style={{ fontSize: "11px", color: DARK.text.muted }}>·</span>
        <span style={{ fontSize: "11px", color: DARK.text.secondary }}>
          실물(TSMC·SIA·B2B) → AI 자본(CapEx) → 시장(SOXX) 순서로 읽는다
        </span>
      </div>

      {/* 카드 영역 */}
      <div style={{
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}>
        <LayerScoreHeader data={layerScores} onLayerClick={scrollToLayer} />
        <Layer1Fundamental data={layer1} />
        <Layer2CapitalFlow data={layer2} />
        <Layer3MarketPricing data={layer3} />
      </div>

    </div>
  );
}
