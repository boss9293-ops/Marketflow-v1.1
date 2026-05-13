// AI 인프라 V2 — x 좌표 기반 가장 가까운 가격 포인트 탐색 유틸리티

export interface PricePoint {
  close: number
  date:  string
}

/** number[] + asOf 날짜 → PricePoint[] (날짜는 캘린더 일 기준 근사치) */
export function buildPriceSeries(
  prices: number[],
  asOf:   string | null,
): PricePoint[] {
  const total = prices.length
  const base  = asOf ? new Date(asOf) : new Date()

  return prices.map((close, i) => {
    const daysBack = total - 1 - i
    const d = new Date(base)
    d.setDate(d.getDate() - daysBack)
    return { close, date: d.toISOString().split('T')[0] }
  })
}

/**
 * SVG viewBox x 좌표 → 가장 가까운 데이터 포인트 탐색
 * priceSeries가 2개 미만이면 null 반환 (호출부에서 가드)
 */
export function findNearestPricePoint(
  svgX:    number,
  chartW:  number,
  chartH:  number,
  pad:     number,
  series:  PricePoint[],
): { index: number; point: PricePoint; svgX: number; svgY: number } | null {
  if (series.length < 2) return null

  const innerW = chartW - pad * 2
  const innerH = chartH - pad * 2

  const rawIdx = ((svgX - pad) / innerW) * (series.length - 1)
  const index  = Math.max(0, Math.min(series.length - 1, Math.round(rawIdx)))
  const point  = series[index]

  const prices = series.map(p => p.close)
  const min    = Math.min(...prices)
  const max    = Math.max(...prices)
  const range  = max - min || 1

  const exactSvgX = pad + (index / (series.length - 1)) * innerW
  const exactSvgY = pad + innerH - ((point.close - min) / range) * innerH

  return { index, point, svgX: exactSvgX, svgY: exactSvgY }
}
