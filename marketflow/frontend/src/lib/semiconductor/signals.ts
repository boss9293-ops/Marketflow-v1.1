// Phase 1B — Proxy signal computation from raw price data
import type {
  MarketDataInput, SignalInputs, TickerPriceData,
  DemandState, SupplyState, PriceState, BreadthState,
  EquipmentState, CapexSignal, MemoryStrength, MomentumState,
  ConcentrationState, ConstraintWarning,
} from './types'

function ret(tickers: Record<string, TickerPriceData>, ticker: string, period: '20d' | '30d' | '60d'): number {
  const t = tickers[ticker]
  if (!t) return 0
  return period === '20d' ? t.return_20d : period === '30d' ? t.return_30d : t.return_60d
}

function ewReturn(tickers: Record<string, TickerPriceData>, symbols: string[], period: '20d' | '30d' | '60d'): number {
  const vals = symbols.map(s => ret(tickers, s, period))
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function normalize(val: number, min: number, max: number): number {
  return Math.max(0, Math.min(1, (val - min) / (max - min)))
}

export function computeSignals(data: MarketDataInput): SignalInputs {
  const { tickers, tier2 } = data

  // ── Core returns ─────────────────────────────────────────────────
  const soxx_60d = ret(tickers, 'SOXX', '60d')
  const soxx_30d = ret(tickers, 'SOXX', '30d')
  const soxx_20d = ret(tickers, 'SOXX', '20d')
  const qqq_60d  = ret(tickers, 'QQQ',  '60d')
  const nvda_60d = ret(tickers, 'NVDA', '60d')
  const nvda_30d = ret(tickers, 'NVDA', '30d')
  const avgo_60d = ret(tickers, 'AVGO', '60d')
  const avgo_30d = ret(tickers, 'AVGO', '30d')
  const mu_60d   = ret(tickers, 'MU',   '60d')
  const mu_30d   = ret(tickers, 'MU',   '30d')
  const tsm_60d  = ret(tickers, 'TSM',  '60d')

  const equip_syms = ['ASML', 'AMAT', 'LRCX', 'KLAC']
  const equip_60d  = ewReturn(tickers, equip_syms, '60d')
  const equip_30d  = ewReturn(tickers, equip_syms, '30d')
  const equip_20d  = ewReturn(tickers, equip_syms, '20d')
  const asml_60d   = ret(tickers, 'ASML', '60d')

  const breadth_syms = ['NVDA', 'AMD', 'AVGO', 'MU', 'TSM', 'AMAT', 'ASML', 'LRCX']
  const ew_30d       = ewReturn(tickers, breadth_syms, '30d')

  // ── Divergences ──────────────────────────────────────────────────
  const nvda_mu_gap          = nvda_60d - mu_60d
  const nvda_tsm_gap         = nvda_60d - tsm_60d
  const equipment_vs_soxx_60d = equip_60d - soxx_60d
  const soxx_vs_qqq_60d      = soxx_60d - qqq_60d

  // ── P1: Equipment ────────────────────────────────────────────────
  const asml_vs_soxx = asml_60d - soxx_60d
  // DIVERGING: equipment falling absolutely while SOXX rising
  let equipment_state: EquipmentState
  if (equip_60d < -0.05 && soxx_60d > 0.02) {
    equipment_state = 'DIVERGING'
  } else if (equipment_vs_soxx_60d > 0.03 && asml_vs_soxx > 0) {
    equipment_state = 'LEADING'
  } else if (equipment_vs_soxx_60d < -0.03) {
    equipment_state = 'LAGGING'
  } else {
    equipment_state = 'IN-LINE'
  }

  let capex_signal: CapexSignal
  if (equipment_state === 'LEADING') capex_signal = 'STRONG'
  else if (equipment_state === 'IN-LINE') capex_signal = equipment_vs_soxx_60d > 0 ? 'EXPANDING' : 'NEUTRAL'
  else capex_signal = 'CONTRACTING'

  const equip_mom_ratio = equip_60d !== 0 ? equip_20d / equip_60d : 1
  const equip_state_pts: Record<EquipmentState, number> = { LEADING: 6, 'IN-LINE': 0, LAGGING: -6, DIVERGING: -8 }
  const capex_raw   = equip_state_pts[equipment_state]
    + (asml_vs_soxx > 0 ? 2 : asml_vs_soxx < -0.03 ? -2 : 0)
    + (equip_mom_ratio > 1 ? 1 : equip_mom_ratio < 0.5 ? -1 : 0)
  const capex_score = Math.round(normalize(capex_raw, -8, 6) * 100)

  // ── P2: Memory ───────────────────────────────────────────────────
  const mu_slope    = tickers['MU']?.slope_30d ?? 0
  const mu_vs_soxx  = mu_60d - soxx_60d
  const mu_slope_pts  = mu_slope > 0 ? 2 : mu_slope < 0 ? -2 : 0
  const mu_soxx_pts   = mu_vs_soxx > 0.02 ? 2 : mu_vs_soxx < -0.02 ? -1 : 0
  const samsung_pts   = tier2.samsung_trend === 'POSITIVE' ? 1 : tier2.samsung_trend === 'NEGATIVE' ? -1 : 0
  const sk_pts        = tier2.skhynix_trend === 'POSITIVE' ? 1 : tier2.skhynix_trend === 'NEGATIVE' ? -1 : 0
  const memory_raw    = mu_slope_pts + mu_soxx_pts + samsung_pts + sk_pts
  const memory_score  = Math.round(normalize(memory_raw, -4, 6) * 100)

  let memory_strength: MemoryStrength
  if (memory_score >= 71) memory_strength = 'STRONG'
  else if (memory_score >= 51) memory_strength = 'RECOVERING'
  else if (memory_score >= 31) memory_strength = 'NEUTRAL'
  else memory_strength = 'WEAK'

  // ── P3: Breadth ──────────────────────────────────────────────────
  const outperforming = breadth_syms.filter(s => ret(tickers, s, '30d') > soxx_30d).length
  const breadth_score = Math.round((outperforming / 8) * 100)

  let breadth_state: BreadthState
  if (breadth_score >= 76) breadth_state = 'VERY BROAD'
  else if (breadth_score >= 51) breadth_state = 'BROAD'
  else if (breadth_score >= 26) breadth_state = 'MODERATE'
  else breadth_state = 'NARROW'

  // ── P4: Momentum ─────────────────────────────────────────────────
  const mom_ratio    = soxx_60d !== 0 ? soxx_20d / soxx_60d : 1
  const momentum_score = Math.round(normalize(mom_ratio, -1.5, 3.0) * 100)

  let momentum: MomentumState
  if (momentum_score >= 51) momentum = 'ACCELERATING'
  else if (momentum_score >= 31) momentum = 'NEUTRAL'
  else momentum = 'DECELERATING'

  // ── Core drivers ─────────────────────────────────────────────────
  const nvda_avgo_vs_qqq = ((nvda_60d + avgo_60d) / 2) - qqq_60d
  const demand: DemandState = nvda_avgo_vs_qqq > 0.10 ? 'STRONG' : nvda_avgo_vs_qqq < -0.05 ? 'WEAK' : 'NEUTRAL'
  const supply: SupplyState = soxx_vs_qqq_60d > 0.05 ? 'STRONG' : soxx_vs_qqq_60d < -0.05 ? 'WEAK' : 'NEUTRAL'
  const price: PriceState   = mu_slope > 0 ? 'RISING' : mu_slope < 0 ? 'DECLINING' : 'NEUTRAL'

  // ── Concentration ────────────────────────────────────────────────
  const top2_avg_30d     = (nvda_30d + avgo_30d) / 2
  const conc_ratio       = soxx_30d !== 0 ? top2_avg_30d / soxx_30d : 1
  const concentration_score = Math.round(Math.min(100, Math.max(0, conc_ratio * 50 + 25)))

  let concentration: ConcentrationState
  if (concentration_score <= 45) concentration = 'DISTRIBUTED'
  else if (concentration_score <= 65) concentration = 'MODERATE'
  else if (concentration_score <= 80) concentration = 'ELEVATED'
  else concentration = 'HIGH'

  // ── Constraint ───────────────────────────────────────────────────
  const equip_inv = equipment_state === 'LAGGING' || equipment_state === 'DIVERGING'
  let breach = 0
  if (nvda_mu_gap  > 0.30) breach++
  if (nvda_tsm_gap > 0.20) breach++
  if (equip_inv)           breach++
  const constraint_score = Math.round((breach / 3) * 100)

  let constraint_warning: ConstraintWarning
  if (constraint_score >= 81) constraint_warning = 'HIGH'
  else if (constraint_score >= 61) constraint_warning = 'ELEVATED'
  else if (constraint_score >= 34) constraint_warning = 'MODERATE'
  else constraint_warning = 'LOW'

  // ── Sub-bucket 30d vs SOXX ───────────────────────────────────────
  const compute_30d  = ewReturn(tickers, ['NVDA', 'AMD', 'AVGO'], '30d')

  return {
    demand, supply, price, breadth_state,
    equipment_state, capex_signal, memory_strength, momentum,
    concentration, constraint_warning,
    breadth_score, concentration_score, memory_score,
    capex_score, constraint_score, momentum_score,
    nvda_mu_gap, nvda_tsm_gap, soxx_vs_qqq_60d, equipment_vs_soxx_60d,
    sub_bucket_perf: {
      compute:   Math.round((compute_30d - soxx_30d) * 100),
      memory:    Math.round((mu_30d    - soxx_30d) * 100),
      foundry:   Math.round((ret(tickers, 'TSM', '30d') - soxx_30d) * 100),
      equipment: Math.round((equip_30d - soxx_30d) * 100),
    },
    tier2_available: tier2.available,
  }
}
