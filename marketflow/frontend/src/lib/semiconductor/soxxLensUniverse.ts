import { SOXX_HOLDINGS_SNAPSHOT } from './soxxHoldingsSnapshot'

export const SOXX_LENS_BENCHMARK_TICKER = 'SOXX'

export const SOXX_LENS_PRICE_SYMBOL_MAP: Record<string, string> = {
  SOXX: 'SOXX',
  ASML: 'ASML',
  TSM: 'TSM',
}

export function getSoxxLensTickers(): string[] {
  const holdingsTickers = SOXX_HOLDINGS_SNAPSHOT
    .map((holding) => holding.ticker?.trim().toUpperCase())
    .filter((ticker): ticker is string => Boolean(ticker))

  return Array.from(new Set([SOXX_LENS_BENCHMARK_TICKER, ...holdingsTickers])).sort()
}

export function mapSoxxLensProviderSymbol(ticker: string): string {
  const normalized = ticker.trim().toUpperCase()
  return SOXX_LENS_PRICE_SYMBOL_MAP[normalized] ?? normalized
}
