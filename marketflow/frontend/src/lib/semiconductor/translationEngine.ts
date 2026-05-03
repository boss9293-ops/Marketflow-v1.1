// Phase 1D ??Deterministic SOXX/SOXL translation from semiconductor state
import type {
  SignalInputs, StageOutput, TranslationOutput,
  SoxxOutput, SoxlOutput, SoxlBreakdown,
  Confidence, InvStatus, CycleStage,
} from './types'

// ?? SOXX: S1?밪9, first match wins ????????????????????????????????????????????
function computeSoxx(stage: StageOutput, s: SignalInputs): SoxxOutput {
  const cs = stage.stage

  if (cs === 'RESET')
    return { action: 'REDUCE', confidence: 'HIGH', reason: 'Cycle reset confirmed',
             dominant_signal: 'Cycle Stage', rule_applied: 'S1',
             upgrade_if: 'Stage ??BOTTOM + P2 stabilizing', downgrade_if: 'N/A' }

  if (cs === 'PEAK' && s.capex_signal === 'CONTRACTING' && s.breadth_state === 'NARROW')
    return { action: 'HOLD / REDUCE', confidence: 'HIGH',
             reason: 'Late cycle + P1 contracting + narrow breadth',
             dominant_signal: 'Equipment (P1)', rule_applied: 'S2',
             upgrade_if: 'P1 ??NEUTRAL + breadth improves', downgrade_if: 'Stage ??RESET' }

  if (cs === 'PEAK')
    return { action: 'HOLD', confidence: 'MODERATE', reason: 'Late cycle; hold only',
             dominant_signal: 'Cycle Stage', rule_applied: 'S3',
             upgrade_if: 'Stage holds + P1 stabilizes',
             downgrade_if: 'P1 ??CONTRACTING or breadth ??NARROW' }

  if (cs === 'BOTTOM')
    return { action: 'HOLD', confidence: 'LOW', reason: 'Bottom ??not yet confirmed recovery',
             dominant_signal: 'Cycle Stage', rule_applied: 'S4',
             upgrade_if: 'P2 ??RECOVERING + P1 stabilizes', downgrade_if: 'Stage ??RESET' }

  if (cs === 'BUILD' && (s.memory_strength === 'RECOVERING' || s.memory_strength === 'STRONG'))
    return { action: 'HOLD / ADD GRADUALLY', confidence: 'MODERATE',
             reason: 'Build phase with P2 memory confirming',
             dominant_signal: 'Memory (P2)', rule_applied: 'S5',
             upgrade_if: 'Stage ??EXPAND + P1 ??NEUTRAL',
             downgrade_if: 'P2 ??NEUTRAL or equipment deteriorates' }

  if (cs === 'BUILD')
    return { action: 'HOLD', confidence: 'LOW', reason: 'Build ??P2 not yet confirming',
             dominant_signal: 'Cycle Stage', rule_applied: 'S6',
             upgrade_if: 'P2 ??RECOVERING', downgrade_if: 'Demand softens' }

  const sBroad = s.breadth_state === 'BROAD' || s.breadth_state === 'VERY BROAD'
  const p1Ok   = s.capex_signal === 'EXPANDING' || s.capex_signal === 'STRONG'
  const p2Ok   = s.memory_strength === 'RECOVERING' || s.memory_strength === 'STRONG'

  if (cs === 'EXPAND' && sBroad && p1Ok && p2Ok)
    return { action: 'ADD / HOLD', confidence: 'HIGH',
             reason: 'EXPAND + P1 + P2 + breadth all confirming',
             dominant_signal: 'P1 + P2 aligned', rule_applied: 'S7',
             upgrade_if: 'N/A ??full confirmation',
             downgrade_if: 'P1 ??LAGGING or breadth ??MODERATE' }

  if (cs === 'EXPAND' && s.breadth_state === 'MODERATE')
    return { action: 'HOLD / ADD ON DIPS', confidence: 'HIGH',
             reason: 'EXPAND + moderate breadth',
             dominant_signal: 'Cycle Stage', rule_applied: 'S8',
             upgrade_if: 'Breadth ??BROAD + P1 ??IN-LINE',
             downgrade_if: 'P1 ??DIVERGING OR breadth ??NARROW' }

  if (cs === 'EXPAND' && s.breadth_state === 'NARROW')
    return { action: 'HOLD', confidence: 'MODERATE',
             reason: 'EXPAND but narrow ??fragile',
             dominant_signal: 'Breadth (P3)', rule_applied: 'S9',
             upgrade_if: 'Breadth ??MODERATE + P2 confirms',
             downgrade_if: 'P1 ??DIVERGING' }

  return { action: 'HOLD', confidence: 'LOW', reason: 'Insufficient signal clarity',
           dominant_signal: 'N/A', rule_applied: 'FALLBACK',
           upgrade_if: 'Signals align', downgrade_if: 'Stage deteriorates' }
}

// ?? SOXL: score + priority overrides ?????????????????????????????????????????
function computeSoxl(stage: StageOutput, s: SignalInputs): SoxlOutput {
  const cs = stage.stage

  const stage_adj_map: Record<CycleStage, number> = {
    EXPAND: 0, BUILD: -15, PEAK: -30, BOTTOM: -25, RESET: -65,
  }
  const stage_adj = stage_adj_map[cs]

  const capex_adj_map: Record<string, number> = {
    STRONG: 12, EXPANDING: 6, NEUTRAL: 0, CONTRACTING: -20,
  }
  const memory_adj_map: Record<string, number> = {
    STRONG: 10, RECOVERING: 5, NEUTRAL: 0, WEAK: -15,
  }
  const breadth_adj_map: Record<string, number> = {
    'VERY BROAD': 12, BROAD: 6, MODERATE: 0, NARROW: -20,
  }
  const momentum_adj_map: Record<string, number> = {
    ACCELERATING: 8, NEUTRAL: 0, DECELERATING: -18,
  }
  const concentration_adj_map: Record<string, number> = {
    DISTRIBUTED: 0, MODERATE: -5, ELEVATED: -12, HIGH: -20,
  }
  const constraint_adj_map: Record<string, number> = {
    LOW: 0, MODERATE: -5, ELEVATED: -15, HIGH: -25,
  }

  const capex_adj       = capex_adj_map[s.capex_signal] ?? 0
  const memory_adj      = memory_adj_map[s.memory_strength] ?? 0
  const breadth_adj     = breadth_adj_map[s.breadth_state] ?? 0
  const momentum_adj    = momentum_adj_map[s.momentum] ?? 0
  const concentration_adj = concentration_adj_map[s.concentration] ?? 0
  const constraint_adj  = constraint_adj_map[s.constraint_warning] ?? 0

  let suitability = Math.max(0, Math.min(100, Math.round(
    100 + stage_adj + capex_adj + memory_adj + breadth_adj +
    momentum_adj + concentration_adj + constraint_adj
  )))

  let overrides      = 'No hard overrides triggered'
  let dominant_signal = s.equipment_state === 'LAGGING' || s.equipment_state === 'DIVERGING'
    ? 'Equipment (P1)' : s.memory_strength === 'WEAK' ? 'Memory (P2)' : 'Cycle Stage'
  let override_reason = ''

  // O1: RESET absolute
  if (cs === 'RESET') {
    suitability = 0
    overrides = 'O1: RESET absolute'
    dominant_signal = 'Cycle Stage (O1)'
    override_reason = 'Cycle RESET; leverage never appropriate'
  }
  // O2: PEAK + CONTRACTING + fading momentum
  else if (cs === 'PEAK' && s.capex_signal === 'CONTRACTING' &&
           (s.momentum === 'NEUTRAL' || s.momentum === 'DECELERATING')) {
    suitability = Math.min(suitability, 30)
    overrides = 'O2: PEAK + P1 CONTRACTING + fading momentum'
    dominant_signal = 'Equipment (P1) O2'
    override_reason = 'P1 contracting + late cycle + fading momentum'
  }
  // O3: Equipment DIVERGING in EXPAND/PEAK
  else if (s.equipment_state === 'DIVERGING' && (cs === 'EXPAND' || cs === 'PEAK')) {
    suitability = Math.min(suitability, 38)
    overrides = 'O3: Equipment DIVERGING structural warning'
    dominant_signal = 'Equipment (P1) O3'
    override_reason = 'Equipment (P1) diverging ??structural warning'
  }
  // O4: Memory WEAK + Constraint HIGH
  else if (s.memory_strength === 'WEAK' && s.constraint_warning === 'HIGH') {
    suitability = Math.min(suitability, 40)
    overrides = 'O4: P2 WEAK + Constraint HIGH'
    dominant_signal = 'Memory (P2) O4'
    override_reason = 'P2 weak + constraint HIGH ??dual supply-side risk'
  }

  // O5: Conflict Mode cap
  if (stage.conflict_mode) {
    suitability = Math.min(suitability, 60)
    overrides += '; O5: Conflict Mode cap 60'
  }

  suitability = Math.max(0, Math.min(100, suitability))

  const window: SoxlOutput['window'] =
    suitability >= 65 ? 'ALLOWED' :
    suitability >= 40 ? 'TACTICAL ONLY' : 'AVOID'

  let sizing = 'N/A'
  let hold_window = 'N/A'
  if (window === 'ALLOWED') {
    sizing = 'Full size per plan'; hold_window = 'Per strategy plan'
  } else if (window === 'TACTICAL ONLY') {
    if (suitability >= 60)      { sizing = '50??5% of full'; hold_window = '10??5 trading days' }
    else if (suitability >= 50) { sizing = '25??0% of full'; hold_window = '5??0 trading days' }
    else                        { sizing = 'Starter only <25%'; hold_window = '3?? trading days' }
  }

  const confidence: Confidence = stage.conflict_mode
    ? (suitability < 40 ? 'LOW' : 'MODERATE')
    : suitability >= 65 ? 'HIGH'
    : suitability >= 40 ? 'MODERATE' : 'LOW'

  const reason = override_reason ||
    `${s.capex_signal} P1 + ${s.memory_strength} P2 + ${s.breadth_state} breadth`

  const breakdown: SoxlBreakdown = {
    stage_adj, capex_adj, memory_adj, breadth_adj,
    momentum_adj, concentration_adj, constraint_adj, overrides,
  }

  return { window, suitability, confidence, breakdown, final_suitability: suitability,
           sizing, hold_window, reason, dominant_signal }
}

// ?? Helpers ???????????????????????????????????????????????????????????????????
function checkInv(s: SignalInputs, stage: StageOutput): { inv1: InvStatus; inv2: InvStatus } {
  const inv1: InvStatus = s.breadth_state === 'NARROW' ? 'TRIGGERED' : 'not triggered'
  const weak = [
    s.demand  === 'WEAK',
    s.supply  === 'WEAK',
    s.price   === 'DECLINING',
    s.breadth_state === 'NARROW',
  ].filter(Boolean).length
  const inv2: InvStatus = (stage.stage === 'RESET' && weak >= 3) ? 'TRIGGERED' : 'not triggered'
  return { inv1, inv2 }
}

function riskLevel(stage: StageOutput, s: SignalInputs) {
  if (stage.stage === 'RESET')                                      return { level: 'HIGH', rule: 'Cycle RESET' }
  if (s.equipment_state === 'DIVERGING')                            return { level: 'HIGH', rule: 'Equipment P1 DIVERGING' }
  if (s.constraint_warning === 'HIGH')                              return { level: 'HIGH', rule: 'Constraint HIGH' }
  if (s.equipment_state === 'LAGGING' && s.constraint_warning === 'ELEVATED')
                                                                    return { level: 'ELEVATED', rule: 'Equipment P1 LAGGING + constraint ELEVATED' }
  if (stage.stage === 'PEAK')                                       return { level: 'ELEVATED', rule: 'PEAK stage' }
  if (stage.confidence === 'LOW')                                   return { level: 'ELEVATED', rule: 'Low signal confidence' }
  if (stage.stage === 'EXPAND' && stage.confidence === 'HIGH')     return { level: 'MODERATE', rule: 'EXPAND HIGH confidence' }
  return { level: 'MODERATE', rule: 'Standard cycle risk' }
}

function pct(n: number) { return `${n > 0 ? '+' : ''}${(n * 100).toFixed(0)}%` }

function formatDivergences(s: SignalInputs) {
  const nmLabel = s.nvda_mu_gap > 0.50 ? 'EXTREME' : s.nvda_mu_gap > 0.30 ? 'WIDE'
    : s.nvda_mu_gap > 0.15 ? 'WIDENING' : 'ALIGNED'
  const eqLabel = s.equipment_vs_soxx_60d > 0.03 ? 'LEADING'
    : s.equipment_vs_soxx_60d < -0.03 ? 'LAGGING' : 'IN-LINE'
  const top2    = s.sub_bucket_perf.compute
  const lrLabel = top2 > 25 ? 'EXTREME' : top2 > 15 ? 'WIDE' : top2 > 5 ? 'SEPARATING' : 'ALIGNED'

  return {
    nvda_mu_gap:     `${pct(s.nvda_mu_gap)} ??${nmLabel}${s.nvda_mu_gap > 0.30 ? ' (constraint active)' : ''}`,
    soxx_equip_gap:  `${pct(s.equipment_vs_soxx_60d)} ??${eqLabel}${s.equipment_vs_soxx_60d < -0.03 ? ' (P1 warning)' : ''}`,
    leaders_vs_rest: `${top2 > 0 ? '+' : ''}${top2}% compute vs basket ??${lrLabel}`,
  }
}

function education(stage: StageOutput, s: SignalInputs, soxx: SoxxOutput, soxl: SoxlOutput) {
  const begMap: Record<CycleStage, string> = {
    EXPAND: '諛섎룄泥대뒗 ?깆옣 ?④퀎?낅땲?? AI 移??섏슂媛 ?욎꽌怨??덉쑝???λ퉬二??먮쫫??二쇱떆?댁빞 ?⑸땲??',
    BUILD:  '?ъ씠??諛붾떏??吏???뚮났 以鍮?以묒엯?덈떎. ?뺤떊 ?좏샇???꾩쭅 ?쏀빀?덈떎.',
    PEAK:   '怨좎젏 ?좏샇媛 ?섑??섍퀬 ?덉뒿?덈떎. ?덈쾭由ъ? 鍮꾩쨷 異뺤냼媛 ?곸젅?⑸땲??',
    RESET:  '?ъ씠???섍컯???뺤씤?섏뿀?듬땲?? SOXL? ?쇳빐???⑸땲??',
    BOTTOM: '諛붾떏沅뚯씠???뚮났 ?좏샇???꾩쭅?낅땲?? 愿留앹씠 ?곸젅?⑸땲??',
  }
  const adv = [
    `Stage: ${stage.stage}, Confidence ${stage.confidence} (P1=${s.equipment_state}, P2=${s.memory_strength}).`,
    `Breadth: ${s.breadth_state}. Constraint: ${s.constraint_warning}.`,
    `SOXX: ${soxx.action} [${soxx.dominant_signal}].`,
    `SOXL: ${soxl.window} (${soxl.suitability}/100). ${soxl.breakdown.overrides}.`,
    `Key watch: ${soxx.downgrade_if}.`,
  ].join(' ')

  return { education_beginner: begMap[stage.stage], education_advanced: adv }
}

// ?? Main entry ????????????????????????????????????????????????????????????????
export function translate(signals: SignalInputs, stage: StageOutput): TranslationOutput {
  const soxx       = computeSoxx(stage, signals)
  const soxl       = computeSoxl(stage, signals)
  const { inv1, inv2 } = checkInv(signals, stage)
  const risk       = riskLevel(stage, signals)
  const divergences = formatDivergences(signals)
  const { education_beginner, education_advanced } = education(stage, signals, soxx, soxl)

  return {
    inputs:          { ...signals, cycle_stage: stage.stage },
    conflict_mode:   stage.conflict_mode,
    conflict_note:   stage.conflict_note,
    soxx,
    soxl,
    risk_level:      risk.level as TranslationOutput['risk_level'],
    risk_rule:       risk.rule,
    divergences,
    inv1_status:     inv1,
    inv2_status:     inv2,
    education_beginner,
    education_advanced,
    action_summary:  `SOXX: ${soxx.action} [${soxx.dominant_signal}] 쨌 SOXL: ${soxl.window} (${soxl.sizing}) [${soxl.dominant_signal}]`,
  }
}


