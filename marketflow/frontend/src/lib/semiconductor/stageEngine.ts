// Phase 1C — Stage determination: priority-enforced, deterministic
import type {
  SignalInputs, StageOutput, CycleStage, Confidence,
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
  if (mem === 'STRONG')    return 'EXPAND'
  if (mem === 'RECOVERING') return fallback === 'RESET' ? 'BOTTOM' : 'BUILD'
  if (mem === 'NEUTRAL')   return fallback
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

export function determineStage(signals: SignalInputs, as_of: string): StageOutput {
  const ps = priceStage(signals)

  const p1 = readP1(signals.equipment_state, ps)
  const p2 = readP2(signals.memory_strength, ps)
  const p3 = readP3(signals.breadth_state,   ps)
  // P4 (momentum) is NOT used for stage — confirmation only per Taxonomy §4

  // Priority conflict resolution: P1 wins over all
  let final_stage: CycleStage
  let conflict_mode = false
  let conflict_note: string | null = null

  if (p1 === p2) {
    final_stage = p1
  } else {
    // P1 overrides P2
    conflict_mode = true
    conflict_note = `Equipment (P1) overrides Memory (P2): P1→${p1}, P2→${p2}`
    final_stage = p1
  }

  // Confidence: count agreement across p1, p2, p3, priceStage
  const reads  = [p1, p2, p3, ps]
  const agree  = reads.filter(s => s === final_stage).length
  let confidence: Confidence
  if (conflict_mode)  confidence = 'LOW'
  else if (agree >= 4) confidence = 'HIGH'
  else if (agree >= 3) confidence = 'MODERATE'
  else                 confidence = 'LOW'

  return {
    stage:         final_stage,
    confidence,
    conflict_mode,
    conflict_note,
    stage_score:   STAGE_SCORE[final_stage],
    as_of,
  }
}
