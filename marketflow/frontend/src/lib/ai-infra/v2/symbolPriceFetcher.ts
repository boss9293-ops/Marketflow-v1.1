// AI 인프라 V2 — 종목별 수익률 조회 (theme-momentum API 응답 symbol_returns 활용)

export interface SymbolReturn {
  symbol:      string
  five_day:    number | null
  one_month:   number | null
  three_month: number | null
}

export type SymbolReturnsMap = Record<string, {
  five_day:    number | null
  one_month:   number | null
  three_month?: number | null
}>

export function getSymbolReturn(
  symbol: string | null,
  symbolReturns: SymbolReturnsMap,
): SymbolReturn {
  if (!symbol) return { symbol: '', five_day: null, one_month: null, three_month: null }
  const entry = symbolReturns[symbol]
  return {
    symbol,
    five_day:    entry?.five_day    ?? null,
    one_month:   entry?.one_month   ?? null,
    three_month: entry?.three_month ?? null,
  }
}

export function fmtReturn(pct: number | null): string {
  if (pct === null || !Number.isFinite(pct)) return '—'
  return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%'
}

export function returnColor(pct: number | null): string {
  if (pct === null) return '#8b9098'
  if (pct > 0) return '#22c55e'
  if (pct < 0) return '#ef4444'
  return '#B8C8DC'
}
