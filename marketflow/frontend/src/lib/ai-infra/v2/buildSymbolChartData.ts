// AI 인프라 V2 — 종목 미니 차트용 SVG 경로·색상·수익률 계산 유틸리티

export interface SymbolChartData {
  linePath:   string
  areaPath:   string
  lineColor:  string
  changePct:  number | null
  gradientId: string
}

const POSITIVE = '#22c55e'
const NEGATIVE = '#ef4444'

export function buildSymbolChartData(
  symbol: string,
  prices: number[],
  width:  number,
  height: number,
  pad:    number,
): SymbolChartData {
  const gradientId = `mini-grad-${symbol}`

  if (prices.length < 2) {
    return { linePath: '', areaPath: '', lineColor: POSITIVE, changePct: null, gradientId }
  }

  const first     = prices[0]
  const last      = prices[prices.length - 1]
  const changePct = first !== 0 ? ((last - first) / first) * 100 : null
  const lineColor = (changePct === null || changePct >= 0) ? POSITIVE : NEGATIVE

  const min    = Math.min(...prices)
  const max    = Math.max(...prices)
  const range  = max - min || 1
  const innerW = width  - pad * 2
  const innerH = height - pad * 2

  const linePath = prices.map((p, i) => {
    const x = pad + (i / (prices.length - 1)) * innerW
    const y = pad + innerH - ((p - min) / range) * innerH
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')

  const areaPath =
    `${linePath} L ${(width - pad).toFixed(2)} ${(height - pad).toFixed(2)} L ${pad.toFixed(2)} ${(height - pad).toFixed(2)} Z`

  return { linePath, areaPath, lineColor, changePct, gradientId }
}

/** prices 배열에서 90일 전체 수익률 계산 (없으면 null) */
export function computeNinetyDayReturn(prices: number[] | undefined): number | null {
  if (!prices || prices.length < 2) return null
  const first = prices[0]
  if (first === 0) return null
  return ((prices[prices.length - 1] - first) / first) * 100
}
