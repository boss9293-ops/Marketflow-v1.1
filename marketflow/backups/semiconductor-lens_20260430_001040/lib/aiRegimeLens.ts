import type { MarketDataInput } from './types'

export type AIRegimeLabel =
  | 'AI_LED_BROAD'
  | 'AI_LED_NARROW'
  | 'ROTATING'
  | 'BROAD_RECOVERY'
  | 'CONTRACTION'

export type AIRegimeComponentState = {
  state:   string
  signal:  number    // -100 to +100
  spread:  number    // percentage points, e.g. 5.2 = +5.2pp vs SOXX
  note:    string    // 1-sentence structural description
  sources: string[]
}

export type AIRegimeLens = {
  ai_infra:          AIRegimeComponentState
  memory:            AIRegimeComponentState
  foundry:           AIRegimeComponentState
  equipment:         AIRegimeComponentState
  rotation_risk:     AIRegimeComponentState
  regime_label:      AIRegimeLabel
  regime_confidence: 'high' | 'medium' | 'low'
  data_mode:         'live' | 'partial' | 'fallback'
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

function toSignal(spread: number): number {
  // ±10pp (0.10) → ±100
  return clamp(Math.round(spread * 1000), -100, 100)
}

function avgR20(keys: string[], tickers: Record<string, { return_20d: number }>): number | null {
  const vals = keys.map(k => tickers[k]?.return_20d).filter((v): v is number => v != null)
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

const UNAVAILABLE: AIRegimeComponentState = {
  state: 'UNAVAILABLE', signal: 0, spread: 0,
  note: 'Data unavailable.', sources: [],
}

function buildFallback(): AIRegimeLens {
  return {
    ai_infra: UNAVAILABLE, memory: UNAVAILABLE, foundry: UNAVAILABLE,
    equipment: UNAVAILABLE, rotation_risk: UNAVAILABLE,
    regime_label: 'BROAD_RECOVERY', regime_confidence: 'low', data_mode: 'fallback',
  }
}

// ── Main computation ──────────────────────────────────────────────────────────

export function computeAIRegimeLens(raw: MarketDataInput): AIRegimeLens {
  const t = raw.tickers as Record<string, { return_20d: number; slope_30d: number; above_20dma: boolean }>
  const soxxR20 = t['SOXX']?.return_20d ?? null
  if (soxxR20 === null) return buildFallback()

  const availTickers = Object.keys(t).filter(k => t[k]?.return_20d != null).length
  const dataMode: AIRegimeLens['data_mode'] = availTickers >= 8 ? 'live' : availTickers >= 4 ? 'partial' : 'fallback'

  // ── Raw spreads (decimal, e.g. 0.05 = 5pp) ────────────────────────────────
  const computeAvg = avgR20(['NVDA', 'AMD', 'AVGO'], t)
  const memRaw     = t['MU']?.return_20d ?? null
  const foundryRaw = t['TSM']?.return_20d ?? null
  const equipAvg   = avgR20(['ASML', 'AMAT', 'LRCX', 'KLAC'], t)

  const cs = computeAvg !== null ? computeAvg - soxxR20 : null  // compute spread
  const ms = memRaw     !== null ? memRaw     - soxxR20 : null  // memory spread
  const fs = foundryRaw !== null ? foundryRaw - soxxR20 : null  // foundry spread
  const es = equipAvg   !== null ? equipAvg   - soxxR20 : null  // equip spread

  // tier2 bonus for memory (±1pp per signal)
  const tier2Bonus = (() => {
    if (!raw.tier2?.available) return 0
    let b = 0
    if (raw.tier2.samsung_trend === 'POSITIVE')  b += 0.01
    else if (raw.tier2.samsung_trend === 'NEGATIVE') b -= 0.01
    if (raw.tier2.skhynix_trend === 'POSITIVE')  b += 0.01
    else if (raw.tier2.skhynix_trend === 'NEGATIVE') b -= 0.01
    return b
  })()
  const ma = ms !== null ? ms + tier2Bonus : null  // memory adjusted

  // ── Component 1: AI Infrastructure Leadership ─────────────────────────────
  const ai_infra: AIRegimeComponentState = (() => {
    if (cs === null) return { ...UNAVAILABLE, note: 'Compute bucket data unavailable.' }
    const pp = parseFloat((cs * 100).toFixed(1))
    const sig = toSignal(cs)
    if (cs > 0.05)  return { state: 'LEADING',  signal: sig, spread: pp, sources: ['NVDA','AMD','AVGO'],
      note: 'AI infrastructure segments are advancing at a rate above the broader semiconductor benchmark.' }
    if (cs > -0.02) return { state: 'IN_LINE',  signal: sig, spread: pp, sources: ['NVDA','AMD','AVGO'],
      note: 'AI infrastructure segments are tracking in line with the broader semiconductor benchmark.' }
    return              { state: 'LAGGING',  signal: sig, spread: pp, sources: ['NVDA','AMD','AVGO'],
      note: 'AI infrastructure segments are underperforming relative to the broader semiconductor benchmark.' }
  })()

  // ── Component 2: HBM / Memory Confirmation ────────────────────────────────
  const memory: AIRegimeComponentState = (() => {
    if (ma === null) return { ...UNAVAILABLE, note: 'Memory bucket data unavailable.' }
    const pp  = parseFloat(((ms ?? 0) * 100).toFixed(1))
    const sig = toSignal(ma)
    if (ma > 0.03)  return { state: 'CONFIRMED',     signal: sig, spread: pp, sources: ['MU'],
      note: 'Memory segment participation is confirming AI-driven demand through price structure alignment.' }
    if (ma >= 0)    return { state: 'PARTIAL',        signal: sig, spread: pp, sources: ['MU'],
      note: 'Memory segment is partially aligned with the broader structure — confirmation is incomplete.' }
    if (ma >= -0.05)return { state: 'NOT_CONFIRMED', signal: sig, spread: pp, sources: ['MU'],
      note: 'Memory segment is not confirming the semiconductor advance — participation remains limited.' }
    return              { state: 'WEAK',            signal: sig, spread: pp, sources: ['MU'],
      note: 'Memory segment is showing broad weakness, diverging from the broader semiconductor structure.' }
  })()

  // ── Component 3: Foundry / Packaging Support ──────────────────────────────
  const foundry: AIRegimeComponentState = (() => {
    if (fs === null) return { ...UNAVAILABLE, note: 'Foundry bucket data unavailable.' }
    const pp  = parseFloat((fs * 100).toFixed(1))
    const sig = toSignal(fs)
    if (fs > 0.03)  return { state: 'SUPPORTING', signal: sig, spread: pp, sources: ['TSM'],
      note: 'Foundry segment is providing structural support, consistent with sustained AI-driven production demand.' }
    if (fs > -0.03) return { state: 'NEUTRAL',    signal: sig, spread: pp, sources: ['TSM'],
      note: 'Foundry segment is tracking in line with the benchmark — no directional structural signal.' }
    return              { state: 'LAGGING',   signal: sig, spread: pp, sources: ['TSM'],
      note: 'Foundry segment participation is lagging, suggesting reduced production demand support.' }
  })()

  // ── Component 4: Equipment Follow-through ─────────────────────────────────
  const equipment: AIRegimeComponentState = (() => {
    if (es === null) return { ...UNAVAILABLE, note: 'Equipment bucket data unavailable.' }
    const pp  = parseFloat((es * 100).toFixed(1))
    const sig = toSignal(es)
    if (es > 0.03)  return { state: 'LEADING',          signal: sig, spread: pp, sources: ['ASML','AMAT','LRCX','KLAC'],
      note: 'Equipment segment is advancing ahead of the benchmark, consistent with a capex expansion phase.' }
    if (es > -0.02) return { state: 'IN_LINE',           signal: sig, spread: pp, sources: ['ASML','AMAT','LRCX','KLAC'],
      note: 'Equipment segment is tracking in line with the benchmark, providing neutral structural context.' }
    // Lagging — distinguish AI delay vs cycle deterioration
    if (cs !== null && cs > 0.02) return { state: 'LAGGING_AI_DELAY', signal: sig, spread: pp, sources: ['ASML','AMAT','LRCX','KLAC'],
      note: 'Equipment segment is lagging while AI infrastructure leads — consistent with an AI investment delay pattern rather than cycle deterioration.' }
    return { state: 'LAGGING_CYCLE', signal: sig, spread: pp, sources: ['ASML','AMAT','LRCX','KLAC'],
      note: 'Equipment segment weakness is broad-based, consistent with a deteriorating capex cycle structure.' }
  })()

  // ── Component 5: Narrowing / Rotation Risk ────────────────────────────────
  const rotation_risk: AIRegimeComponentState = (() => {
    const nonNull = [ms, fs, es].filter((v): v is number => v != null)
    if (cs === null && nonNull.length === 0) return { ...UNAVAILABLE, note: 'Insufficient bucket data for rotation assessment.' }

    const othersAvg = nonNull.length > 0 ? nonNull.reduce((a, b) => a + b, 0) / nonNull.length : 0
    const sig = toSignal(cs !== null ? cs - othersAvg : 0)

    if (es !== null && es > 0.03 && (cs === null || cs < 0)) return {
      state: 'ROTATING', signal: sig, spread: 0, sources: [],
      note: 'Structural rotation toward equipment and foundry segments is evident, while compute leadership is diminishing.' }
    if (cs !== null && cs > 0.10 && othersAvg < 0) return {
      state: 'NARROW', signal: sig, spread: 0, sources: [],
      note: 'Participation is concentrated in a small number of segments — structural durability is limited.' }
    if (cs !== null && cs > 0.05 && othersAvg < -0.01) return {
      state: 'NARROWING', signal: sig, spread: 0, sources: [],
      note: 'Participation is concentrating toward fewer segments — breadth narrowing is in progress.' }
    return {
      state: 'BROAD', signal: sig, spread: 0, sources: [],
      note: 'Participation is distributed broadly across all semiconductor segments.' }
  })()

  // ── Regime Label (priority cascade) ──────────────────────────────────────
  const regime_label: AIRegimeLabel = (() => {
    if (ai_infra.state === 'LAGGING' && memory.state === 'WEAK' && foundry.state === 'LAGGING') return 'CONTRACTION'
    if (rotation_risk.state === 'ROTATING') return 'ROTATING'
    if (ai_infra.state === 'LEADING' && memory.state === 'CONFIRMED' && foundry.state === 'SUPPORTING' && rotation_risk.state === 'BROAD') return 'AI_LED_BROAD'
    if (ai_infra.state === 'LEADING') return 'AI_LED_NARROW'
    if (rotation_risk.state === 'BROAD' && ai_infra.state !== 'LAGGING') return 'BROAD_RECOVERY'
    return 'BROAD_RECOVERY'
  })()

  const availCount = [cs, ms, fs, es].filter(v => v !== null).length
  const regime_confidence: AIRegimeLens['regime_confidence'] =
    availCount >= 4 ? 'high' : availCount >= 2 ? 'medium' : 'low'

  return { ai_infra, memory, foundry, equipment, rotation_risk, regime_label, regime_confidence, data_mode: dataMode }
}
