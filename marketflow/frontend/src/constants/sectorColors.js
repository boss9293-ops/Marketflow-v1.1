// SC-1 섹터 colorClass → stroke 색상 매핑
export const COLOR_MAP = {
  DARK_GREEN:  { stroke: "#22c55e", dimStroke: "#14532d" },
  LIGHT_GREEN: { stroke: "#86efac", dimStroke: "#166534" },
  YELLOW:      { stroke: "#fbbf24", dimStroke: "#78350f" },
  LIGHT_RED:   { stroke: "#f87171", dimStroke: "#7f1d1d" },
  DARK_RED:    { stroke: "#ef4444", dimStroke: "#450a0a" },
};

export function getStroke(colorClass, dimmed = false) {
  return dimmed
    ? COLOR_MAP[colorClass].dimStroke
    : COLOR_MAP[colorClass].stroke;
}
