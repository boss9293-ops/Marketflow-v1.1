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
export type ConflictType       = 'P1_OVERRIDE' | 'AI_DISTORTION' | null
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
  conflict_type: ConflictType
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

// ═══════════════════════════════════════════════════════════════════════════
// v2: Signal Normalization & Confidence Layer
// Based on SEMICONDUCTOR_SIGNAL_NORMALIZATION_AND_CONFIDENCE_SPEC.md
// ═══════════════════════════════════════════════════════════════════════════

// Macro inputs not available in MarketDataInput (VIX, yield, DXY, RSI, MACD)
export interface MacroSnapshot {
  vix_level:            number   // e.g. 15.2
  vix_change_5d_pct:    number   // e.g. -0.05 = -5%
  yield_10y_change_30d: number   // basis points, e.g. +30
  dxy_trend_30d_pct:    number   // e.g. -0.02 = -2%
  soxx_rsi_14:          number   // 0~100
  soxx_macd_hist:       number   // positive = bullish
  soxx_vs_200ma_pct:    number   // % above 200MA, e.g. +0.12 = +12%
}

export const DEFAULT_MACRO: MacroSnapshot = {
  vix_level:            15.2,
  vix_change_5d_pct:    -0.02,
  yield_10y_change_30d: 10,
  dxy_trend_30d_pct:    -0.01,
  soxx_rsi_14:          62,
  soxx_macd_hist:       0.8,
  soxx_vs_200ma_pct:    0.12,
}

// Cycle stages (v2 — replaces BUILD/EXPAND/PEAK/RESET/BOTTOM)
export type CycleState =
  | 'Trough'
  | 'Recovery'
  | 'Expansion'
  | 'Late Expansion'
  | 'Peak Risk'
  | 'Contraction'

// Conflict types (v2)
export type ConflictTypeV2 =
  | 'NO_CONFLICT'
  | 'AI_DISTORTION'
  | 'BREADTH_DIVERGENCE'
  | 'MOMENTUM_DIVERGENCE'
  | 'SECTOR_ROTATION'
  | 'MACRO_OVERRIDE'
  | 'VALUATION_STRETCH'
  | 'AI_INFRA_SUSTAINABILITY_RISK'
  | 'MULTIPLE_CONFLICTS'

export type MetricDirection  = 'positive' | 'negative' | 'risk' | 'context'
export type ConfidenceImpact = 'raises'   | 'lowers'   | 'neutral'
export type DataQuality      = 'high'     | 'medium'   | 'low'
export type ConfidenceLabelV2 = 'Low' | 'Medium' | 'High'
export type SuitabilityLabel  =
  | 'Highly Favorable'
  | 'Favorable'
  | 'Neutral / Monitor'
  | 'Unfavorable'
  | 'High Risk Setup'

// Single metric — 3-layer structure
export interface NormalizedMetric {
  id:                string
  name:              string
  raw_value:         number | string
  normalized_value:  number            // 0~100, display-safe
  signal_value:      number            // -100~+100, engine calculation units
  direction:         MetricDirection
  confidence_impact: ConfidenceImpact
  data_quality:      DataQuality
  explanation_short: string
}

// Domain-level aggregation
export type DomainKey =
  | 'price_trend' | 'leadership' | 'breadth'
  | 'momentum'    | 'macro'      | 'fundamentals' | 'ai_infra'

export interface DomainScore {
  name:          string
  key:           DomainKey
  weight:        number     // 0~1
  signal:        number     // -100~+100
  display:       number     // 0~100 = (signal+100)/2
  metrics_count: number
}

export type DomainScores = Record<DomainKey, DomainScore>

// Engine output (Layer 5)
export interface EngineOutputV2 {
  engine_score:    number           // 0~100
  internal_signal: number           // -100~+100
  state:           CycleState
  primary_driver:  string
  primary_risk:    string
  conflict_type:   ConflictTypeV2
  confidence:      ConfidenceLabelV2
}

// Confidence output (Layer 6 — 4 components)
export interface ConfidenceComponents {
  agreement:        number   // 0~100
  data_quality:     number   // 0~100
  signal_stability: number   // 0~100
  conflict_penalty: number   // 0~100 (lower = more penalty)
}

export interface ConfidenceOutputV2 {
  confidence_score: number
  confidence_label: ConfidenceLabelV2
  components:       ConfidenceComponents
}

// Explanation output (Layer 7)
export interface ExplanationOutputV2 {
  headline:               string
  summary:                string
  current_state:          CycleState
  confidence_label:       ConfidenceLabelV2
  main_driver:            string
  main_risk:              string
  what_changed:           string[]
  evidence:               string[]
  conflicts:              string[]
  subscriber_explanation: string
}

// Phase G — Core bucket series types
export type BucketSeriesPoint = {
  date:               string
  soxx:               number
  aiCompute?:         number
  memory?:            number
  foundryPackaging?:  number
  equipment?:         number
}

export type RelativeSpreadPoint = {
  date:               string
  aiCompute?:         number
  memory?:            number
  foundryPackaging?:  number
  equipment?:         number
}

export type CapitalFlowStage = 'Confirmed' | 'Partial' | 'Mixed' | 'Lagging' | 'Weak' | 'Narrow' | 'Unavailable'

export type CapitalFlowTimeline = {
  aiCompute:          { stage: CapitalFlowStage; spread: number | null }
  memory:             { stage: CapitalFlowStage; spread: number | null }
  foundryPackaging:   { stage: CapitalFlowStage; spread: number | null }
  equipment:          { stage: CapitalFlowStage; spread: number | null }
  broadParticipation: { stage: CapitalFlowStage }
}

// Full v2 engine output
export interface SemiconductorEngineV2Output {
  metrics:       NormalizedMetric[]
  domain_scores: DomainScores
  engine:        EngineOutputV2
  confidence:    ConfidenceOutputV2
  explanation:   ExplanationOutputV2
  as_of:         string
}
