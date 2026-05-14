// SC-1 PULSE 탭 최상위 조립 컴포넌트 — 배너 + 카드 3개 통합
import pulseData from "../../data/pulseData.json";
import { buildSectorData } from "../../utils/generateMockSeries";
import { buildHeadline } from "../../utils/buildHeadline";
import HeadlineBanner from "./HeadlineBanner";
import CycleCard from "./CycleCard";
import SectorCard from "./SectorCard";
import SoxlCard from "./SoxlCard";
import { DARK } from "../../constants/theme";

export default function PulseTab() {
  const sectors  = buildSectorData(pulseData.card2.sectors);
  const headline = buildHeadline({
    sectors,
    spreadCurrent: pulseData.card3.spreadCurrent,
    cyclePhase:    pulseData.meta.cyclePhase,
  });

  const card2Data = { sectors };

  return (
    <div style={{ background: DARK.bg.page, minHeight: "100vh" }}>

      {/* 상단 고정 배너 */}
      <HeadlineBanner
        headline={headline}
        updatedAt={pulseData.meta.updatedAt}
        cyclePhase={pulseData.meta.cyclePhase}
        soxlEnv={pulseData.meta.soxlEnv}
        editable
      />

      {/* 카드 영역 */}
      <div style={{
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}>
        <CycleCard  data={pulseData.card1} />
        <SectorCard data={card2Data} />
        <SoxlCard   data={pulseData.card3} />
      </div>

    </div>
  );
}
