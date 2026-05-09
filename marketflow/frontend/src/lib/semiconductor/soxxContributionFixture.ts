import type { SoxxHoldingReturn } from './soxxContribution'

// Development-only sample returns for exercising contribution calculations.
// Do not present these values as real market contribution in the UI.
export const SAMPLE_SOXX_HOLDING_RETURNS_1D: SoxxHoldingReturn[] = [
  { ticker: 'NVDA', returnPct: 1.25, periodLabel: '1D sample' },
  { ticker: 'AVGO', returnPct: 0.8, periodLabel: '1D sample' },
  { ticker: 'AMD', returnPct: -0.5, periodLabel: '1D sample' },
  { ticker: 'MU', returnPct: 0.35, periodLabel: '1D sample' },
  { ticker: 'AMAT', returnPct: 0.65, periodLabel: '1D sample' },
  { ticker: 'ASML', returnPct: -0.2, periodLabel: '1D sample' },
  { ticker: 'LRCX', returnPct: 0.4, periodLabel: '1D sample' },
  { ticker: 'KLAC', returnPct: 0.15, periodLabel: '1D sample' },
  { ticker: 'TSM', returnPct: -0.1, periodLabel: '1D sample' },
]
