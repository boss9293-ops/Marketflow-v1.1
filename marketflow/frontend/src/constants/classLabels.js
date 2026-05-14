// SC-1 섹터 classification 레이블 및 정렬 순서
export const CLASS_LABEL = {
  LEADING:  { ko: "주도 ▲",  icon: "🔥", order: 1 },
  EMERGING: { ko: "부상 ↑↑", icon: "🌱", order: 2 },
  NEUTRAL:  { ko: "박스권",  icon: "⚪", order: 3 },
  FADING:   { ko: "꺾임 ↓",  icon: "❄️", order: 4 },
  WEAK:     { ko: "약세 ▼",  icon: "⬇",  order: 5 },
};

export function sortSectors(sectors) {
  return [...sectors].sort(
    (a, b) => CLASS_LABEL[a.classification].order - CLASS_LABEL[b.classification].order
  );
}
