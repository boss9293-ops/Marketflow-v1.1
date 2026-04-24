// Phase 1B — Semiconductor data & signal type definitions

export const TIER1_TICKERS = [
  'SOXX', 'SOXL', 'QQQ', 'NVDA', 'AMD', 'AVGO', 'MU', 'TSM',
  'ASML', 'AMAT', 'LRCX', 'KLAC',
] as const

export const TIER2_TICKERS = ['005930.KS', '000660.KS'] as const

export type Tier1Ticker = (typeof TIER1_TICKERS)[number]

export const SUB_BUCKET_MAP = {
  compute:   ['NVDA', 'AMD', 'AVGO'] as string[],
  memory:    ['MU'] as string[],
  foundry:   ['TSM'] as string[],
  equipment: ['ASML', 'AMAT', 'LRCX', 'KLAC'] as string[],
  benchmark: ['SOXX', 'QQQ'] as string[],
}

// ── Stage / Signal enums ────────────────────────────────────────────────────
export type CycleStage     = 'BUILD' | 'EXPAND' | 'PEAK' | 'RESET' | 'BOTTOM'
export type Confidence     = 'HIGH' | 'MODERATE' | 'LOW'
export type EquipmentState = 'LEADING' | 'IN-LINE' | 'LAGGING' | 'DIVERGING'
export type CapexSignal    = 'STRONG' | 'EXPANDING' | 'NEUTRAL' | 'CONTRACTING'
export type MemoryStrength = 'STRONG' | 'RECOVERING' | 'NEUTRAL' | 'WEAK'
export type BreadthState   = 'VERY BROAD' | 'BROAD' | 'MODERATE' | 'NARROW'
export type MomentumState  = 'ACCELERATING' | 'NEUTRAL' | 'DECELERATING'
export type ConcentrationState = 'DISTRIBUTED' | 'MODERATE' | 'ELEVATED' | 'HIGH'
export type ConstraintWarning  = 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH'
export type DemandState    = 'STRONG' | 'NEUTRAL' | 'WEAK'
export type SupplyState    = 'STRONG' | 'NEUTRAL' | 'WEAK'
export type PriceState     = 'RISING' | 'NEUTRAL' | 'DECLINING'
export type InvStatus      = 'not triggered' | 'TRIGGERED'

// ── Raw price data per ticker ───────────────────────────────────────────────
export interface TickerPriceData {
  ticker:     string
  price:      number
  return_20d: number
  return_30d: number
  return_60d: number
  above_20dma: boolean
  slope_30d:  number
}

export interface Tier2Data {
  samsung_trend:  'POSITIVE' | 'FLAT' | 'NEGATIVE' | null
  skhynix_trend:  'POSITIVE' | 'FLAT' | 'NEGATIVE' | null
  available:      boolean
}

export interface MarketDataInput {
  tickers: Record<string, TickerPriceData>
  tier2:   Tier2Data
  as_of:   string
}

// ── Phase 1B: computed signal inputs ───────────────────────────────────────
export interface SignalInputs {
  demand:       DemandState
  supply:       SupplyState
  price:        PriceState
  breadth_state: BreadthState

  equipment_state: EquipmentState
  capex_signal:    CapexSignal
  memory_strength: MemoryStrength
  momentum:        MomentumState

  concentration:      ConcentrationState
  constraint_warning: ConstraintWarning

  breadth_score:      number
  concentration_score: number
  memory_score:       number
  capex_score:        number
  constraint_score:   number
  momentum_score:     number

  nvda_mu_gap:           number
  nvda_tsm_gap:          number
  soxx_vs_qqq_60d:       number
  equipment_vs_soxx_60d: number

  sub_bucket_perf: {
    compute:   number
    memory:    number
    foundry:   number
    equipment: number
  }

  tier2_available: boolean
}

// ── Phase 1C: stage engine output ──────────────────────────────────────────
export interface StageOutput {
  stage:         CycleStage
  confidence:    Confidence
  conflict_mode: boolean
  conflict_note: string | null
  stage_score:   number
  as_of:         string
}

// ── Phase 1D: translation engine output ────────────────────────────────────
export interface SoxxOutput {
  action:          string
  confidence:      Confidence
  reason:          string
  dominant_signal: string
  upgrade_if:      string
  downgrade_if:    string
  rule_applied:    string
}

export interface SoxlBreakdown {
  stage_adj:         number
  capex_adj:         number
  memory_adj:        number
  breadth_adj:       number
  momentum_adj:      number
  concentration_adj: number
  constraint_adj:    number
  overrides:         string
}

export interface SoxlOutput {
  window:             'ALLOWED' | 'TACTICAL ONLY' | 'AVOID'
  suitability:        number
  confidence:         Confidence
  breakdown:          SoxlBreakdown
  final_suitability:  number
  sizing:             string
  hold_window:        string
  reason:             string
  dominant_signal:    string
}

export interface DivergenceReport {
  nvda_mu_gap:     string
  soxx_equip_gap:  string
  leaders_vs_rest: string
}

export interface TranslationOutput {
  inputs:         SignalInputs & { cycle_stage: CycleStage }
  conflict_mode:  boolean
  conflict_note:  string | null
  soxx:           SoxxOutput
  soxl:           SoxlOutput
  risk_level:     'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH'
  risk_rule:      string
  divergences:    DivergenceReport
  inv1_status:    InvStatus
  inv2_status:    InvStatus
  education_beginner: string
  education_advanced: string
  action_summary: string
}

// ── Full engine output ──────────────────────────────────────────────────────
export interface SemiconductorOutput {
  market_data: MarketDataInput
  signals:     SignalInputs
  stage:       StageOutput
  translation: TranslationOutput
  as_of:       string
}
