// AI 인프라 렌즈 — 반도체 사이클 컨텍스트 타입 및 매핑 유틸리티 (BR-1)

import type { CycleStage, Confidence, SoxlOutput } from '@/lib/semiconductor/types'

export type SemiconductorCyclePhase =
  | 'EARLY_EXPANSION'
  | 'MID_EXPANSION'
  | 'LATE_EXPANSION'
  | 'DISTRIBUTION'
  | 'DOWNTURN'
  | 'RECOVERY'
  | 'UNKNOWN'

export type SemiconductorCycleConfidence =
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'UNKNOWN'

export type SemiconductorSOXXJudgment =
  | 'SUPPORTIVE'
  | 'NEUTRAL'
  | 'FRAGILE'
  | 'RISK_ELEVATED'
  | 'UNKNOWN'

export type SemiconductorSOXLEnvironment =
  | 'TACTICAL_ONLY'
  | 'HIGH_VOLATILITY'
  | 'LEVERAGE_SENSITIVE'
  | 'CONFIRMATION_NEEDED'
  | 'UNKNOWN'

export type SemiconductorInfraConflictMode =
  | 'NONE'
  | 'MILD'
  | 'STRONG'
  | 'DATA_CONFLICT'
  | 'CYCLE_INFRA_DIVERGENCE'
  | 'UNKNOWN'

export interface InfrastructureCycleContext {
  cycle_score:      number | null
  cycle_phase:      SemiconductorCyclePhase
  cycle_confidence: SemiconductorCycleConfidence
  soxx_judgment:    SemiconductorSOXXJudgment
  soxl_environment: SemiconductorSOXLEnvironment
  conflict_mode:    SemiconductorInfraConflictMode
  historical_cycle_context?: string | null
  source?: {
    from:   'SEMICONDUCTOR_LENS'
    as_of?: string | null
    stale?: boolean
  }
}

export function normalizeCyclePhase(stage: CycleStage | null | undefined): SemiconductorCyclePhase {
  switch (stage) {
    case 'BUILD':  return 'EARLY_EXPANSION'
    case 'EXPAND': return 'MID_EXPANSION'
    case 'PEAK':   return 'LATE_EXPANSION'
    case 'RESET':  return 'DISTRIBUTION'
    case 'BOTTOM': return 'RECOVERY'
    default:       return 'UNKNOWN'
  }
}

export function formatCyclePhase(phase: SemiconductorCyclePhase): string {
  switch (phase) {
    case 'EARLY_EXPANSION': return 'Early Expansion'
    case 'MID_EXPANSION':   return 'Mid Expansion'
    case 'LATE_EXPANSION':  return 'Late Expansion'
    case 'DISTRIBUTION':    return 'Distribution'
    case 'DOWNTURN':        return 'Downturn'
    case 'RECOVERY':        return 'Recovery'
    default:                return 'Unknown'
  }
}

export function normalizeCycleConfidence(conf: Confidence | null | undefined): SemiconductorCycleConfidence {
  switch (conf) {
    case 'HIGH':     return 'HIGH'
    case 'MODERATE': return 'MEDIUM'
    case 'LOW':      return 'LOW'
    default:         return 'UNKNOWN'
  }
}

export function deriveSOXXJudgment(
  phase: SemiconductorCyclePhase,
  conflictMode: boolean,
): SemiconductorSOXXJudgment {
  if (conflictMode) {
    if (phase === 'LATE_EXPANSION' || phase === 'DISTRIBUTION' || phase === 'DOWNTURN') return 'RISK_ELEVATED'
    return 'FRAGILE'
  }
  switch (phase) {
    case 'EARLY_EXPANSION': return 'NEUTRAL'
    case 'MID_EXPANSION':   return 'SUPPORTIVE'
    case 'LATE_EXPANSION':  return 'FRAGILE'
    case 'DISTRIBUTION':    return 'RISK_ELEVATED'
    case 'DOWNTURN':        return 'RISK_ELEVATED'
    case 'RECOVERY':        return 'NEUTRAL'
    default:                return 'UNKNOWN'
  }
}

export function normalizeSOXLEnvironment(window: SoxlOutput['window'] | null | undefined): SemiconductorSOXLEnvironment {
  switch (window) {
    case 'ALLOWED':       return 'LEVERAGE_SENSITIVE'
    case 'TACTICAL ONLY': return 'TACTICAL_ONLY'
    case 'AVOID':         return 'HIGH_VOLATILITY'
    default:              return 'UNKNOWN'
  }
}

export function normalizeConflictMode(conflictMode: boolean): SemiconductorInfraConflictMode {
  return conflictMode ? 'MILD' : 'NONE'
}

export function formatConfidence(c: SemiconductorCycleConfidence): string {
  if (c === 'UNKNOWN') return 'Unknown'
  return c.charAt(0) + c.slice(1).toLowerCase()
}

export function getPhaseInterpretationNote(phase: SemiconductorCyclePhase): string {
  switch (phase) {
    case 'EARLY_EXPANSION':
      return 'Early expansion context puts more weight on AI Chip and HBM leadership confirmation.'
    case 'MID_EXPANSION':
      return 'Mid expansion context favors broadening into HBM, Cooling, Optical, and selective infrastructure layers.'
    case 'LATE_EXPANSION':
      return 'Late expansion context requires closer attention to crowding and leadership fatigue.'
    case 'DISTRIBUTION':
    case 'DOWNTURN':
      return 'Weak cycle context makes broad infrastructure lagging or story-heavy leadership more fragile.'
    case 'RECOVERY':
      return 'Recovery context gives more weight to improving RRG movement and early leadership re-entry.'
    default:
      return ''
  }
}
