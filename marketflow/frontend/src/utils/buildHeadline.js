// SC-1 섹터·스프레드 데이터에서 헤드라인 문구를 자동 생성
import { sortSectors } from "../constants/classLabels";

export function buildHeadline({ sectors, spreadCurrent, cyclePhase }) {
  const sorted  = sortSectors(sectors);
  const leading = sorted.filter(s => s.classification === "LEADING");
  const fading  = sorted.filter(s => s.classification === "FADING");

  const leadPart = leading.length
    ? leading.map(s => s.name).slice(0, 2).join(" · ") + " 강세"
    : "주도 섹터 없음";

  const fadePart = fading.length
    ? fading[0].name + " 꺾임"
    : null;

  const spreadPart = spreadCurrent >= 25 ? "SOXL 위험 수준"
                   : spreadCurrent >= 15 ? "Spread 확대 주시"
                   : "SOXL 환경 우호";

  return [leadPart, fadePart, spreadPart].filter(Boolean).join(" → ");
}
