// Phase 1C — Stage determination: priority-enforced, deterministic
import type {
  SignalInputs, StageOutput, CycleStage, Confidence, ConflictType,
} from './types'

const STAGE_SCORE: Record<CycleStage, number> = {
  RESET: 10, BOTTOM: 28, BUILD: 43, EXPAND: 63, PEAK: 88,
}

// Read which stage each P-level signal points to
function readP1(state: SignalInputs['equipment_state'], fallback: CycleStage): CycleStage {
  if (state === 'LEADING')  return 'EXPAND'
  if (state === 'IN-LINE')  return fallback
  if (state === 'LAGGING')  return 'PEAK'
  return 'PEAK' // DIVERGING
}

function readP2(mem: SignalInputs['memory_strength'], fallback: CycleStage): CycleStage {
  if (mem === 'STRONG')     return 'EXPAND'
  if (mem === 'RECOVERING') return fallback === 'RESET' ? 'BOTTOM' : 'BUILD'
  if (mem === 'NEUTRAL')    return fallback
  return 'RESET' // WEAK
}

function readP3(breadth: SignalInputs['breadth_state'], fallback: CycleStage): CycleStage {
  if (breadth === 'VERY BROAD' || breadth === 'BROAD') return 'EXPAND'
  if (breadth === 'MODERATE') return fallback
  return 'RESET' // NARROW
}

// Stage from 4 core drivers (price band)
function priceStage(signals: SignalInputs): CycleStage {
  const pts = {
    demand:  signals.demand  === 'STRONG' ? 2 : signals.demand  === 'WEAK' ? -2 : 0,
    supply:  signals.supply  === 'STRONG' ? 2 : signals.supply  === 'WEAK' ? -2 : 0,
    price:   signals.price   === 'RISING' ? 2 : signals.price   === 'DECLINING' ? -2 : 0,
    breadth: (signals.breadth_state === 'VERY BROAD' || signals.breadth_state === 'BROAD') ? 2
           : signals.breadth_state === 'NARROW' ? -2 : 0,
  }
  const raw = Object.values(pts).reduce((a, b) => a + b, 0)
  if (raw <= -5) return 'RESET'
  if (raw <= -2) return 'BOTTOM'
  if (raw <=  1) return 'BUILD'
  if (raw <=  5) return 'EXPAND'
  return 'PEAK'
}

// ── v2.0: AI Distortion — PEAK 금지 조건 ──────────────────────────────────
// IF Memory RECOVERING/STRONG AND Price RISING AND Constraint LOW
// → AI 수요가 Classical Equipment 신호를 왜곡하는 구간
// → P1이 LAGGING이어도 PEAK 확정을 막고 AI_DISTORTION으로 처리
function isPeakBlocked(signals: SignalInputs): boolean {
  const memoryActive =
    signals.memory_strength === 'STRONG' ||
    signals.memory_strength === 'RECOVERING'
  const priceRising   = signals.price === 'RISING'
  const constraintLow = signals.constraint_warning === 'LOW'
  return memoryActive && priceRising && constraintLow
}

export function determineStage(signals: SignalInputs, as_of: string): StageOutput {
  const ps = priceStage(signals)

  const p1 = readP1(signals.equipment_state, ps)
  const p2 = readP2(signals.memory_strength, ps)
  const p3 = readP3(signals.breadth_state,   ps)
  // P4 (momentum) is NOT used for stage — confirmation only per Taxonomy §4

  // Priority conflict resolution: P1 wins unless AI_DISTORTION blocks PEAK
  let final_stage: CycleStage
  let conflict_mode = false
  let conflict_type: ConflictType = null
  let conflict_note: string | null = null

  if (p1 === p2) {
    final_stage = p1
  } else if (p1 === 'PEAK' && isPeakBlocked(signals)) {
    // v2.0: AI Distortion — P1=PEAK이지만 Memory+Price+Constraint가 PEAK를 막음
    // Equipment LAGGING은 AI 수요 왜곡으로 선행성을 잃은 상태 → EXPAND 유지 (P2 우선)
    final_stage   = p2 === 'BUILD' ? 'EXPAND' : p2
    conflict_mode = true
    conflict_type = 'AI_DISTORTION'
    conflict_note = `AI Distortion: Memory ${signals.memory_strength} + Price RISING blocks PEAK. ` +
      `Equipment (P1) LAGGING may reflect AI cycle lag, not classical downturn. ` +
      `P1→${p1} overridden → Stage: ${final_stage}`
  } else {
    // 기존 P1_OVERRIDE 로직 유지
    conflict_mode = true
    conflict_type = 'P1_OVERRIDE'
    conflict_note = `Equipment (P1) overrides Memory (P2): P1→${p1}, P2→${p2}`
    final_stage   = p1
  }

  // Confidence: count agreement across p1, p2, p3, priceStage
  const reads  = [p1, p2, p3, ps]
  const agree  = reads.filter(s => s === final_stage).length
  let confidence: Confidence
  if (conflict_mode)   confidence = 'LOW'
  else if (agree >= 4) confidence = 'HIGH'
  else if (agree >= 3) confidence = 'MODERATE'
  else                 confidence = 'LOW'

  return {
    stage:         final_stage,
    confidence,
    conflict_mode,
    conflict_type,
    conflict_note,
    stage_score:   STAGE_SCORE[final_stage],
    as_of,
  }
}
