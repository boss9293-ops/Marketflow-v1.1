// AI 인프라 → SOXX/SOXL 환경 변환 레이어 — BR-2 결정론적 번역 함수

import type { AIInfraBucketState, AIInfraStateLabel } from '@/lib/ai-infra/aiInfraStateLabels'
import type { SemiconductorCyclePhase, SemiconductorSOXXJudgment, SemiconductorSOXLEnvironment } from '@/lib/ai-infra/infrastructureCycleContext'

// ── Output types ──────────────────────────────────────────────────────────────

export type InfraRotationState =
  | 'BROADENING'
  | 'NARROWING'
  | 'CONCENTRATED'
  | 'DIFFUSING'
  | 'FRAGILE'
  | 'DATA_LIMITED'
  | 'UNKNOWN'

export type InfraSoxxContext =
  | 'SUPPORTIVE'
  | 'NEUTRAL'
  | 'FRAGILE'
  | 'RISK_ELEVATED'
  | 'CONFIRMATION_NEEDED'
  | 'DATA_LIMITED'

export type InfraSoxlContext =
  | 'TACTICAL_ONLY'
  | 'HIGH_VOLATILITY'
  | 'LEVERAGE_SENSITIVE'
  | 'CONFIRMATION_NEEDED'
  | 'DATA_LIMITED'

export type InfraConflictFlag =
  | 'CYCLE_INFRA_DIVERGENCE'
  | 'SOXX_CONTEXT_CONFLICT'
  | 'SOXL_CONTEXT_CONFLICT'
  | 'CYCLE_PHASE_INFRA_CONFLICT'

export interface InfraToSoxxTranslation {
  infrastructure_rotation_state: InfraRotationState
  soxx_context:                  InfraSoxxContext
  soxl_context:                  InfraSoxlContext
  leading_buckets:               string[]
  emerging_buckets:              string[]
  crowded_buckets:               string[]
  story_heavy_buckets:           string[]
  indirect_exposure_buckets:     string[]
  lagging_buckets:               string[]
  support_factors:               string[]
  risk_factors:                  string[]
  conflict_flags:                InfraConflictFlag[]
  interpretation_note:           string
  confidence:                    'HIGH' | 'MEDIUM' | 'LOW'
  source: {
    benchmark:               'SOXX' | 'QQQ' | 'SPY'
    bucket_count:            number
    valid_bucket_count:      number
    cycle_phase?:            string | null
    cycle_soxx_judgment?:    string | null
    cycle_soxl_environment?: string | null
  }
}

export interface InfraTranslationInput {
  bucket_states:           AIInfraBucketState[]
  selected_benchmark:      'SOXX' | 'QQQ' | 'SPY'
  cycle_phase?:            SemiconductorCyclePhase | null
  cycle_soxx_judgment?:    SemiconductorSOXXJudgment | null
  cycle_soxl_environment?: SemiconductorSOXLEnvironment | null
}

// ── Classification sets ───────────────────────────────────────────────────────
// Core AI compute — Stage 1-2, directly tied to GPU/HBM demand
const CORE_BUCKET_IDS: ReadonlySet<string> = new Set([
  'AI_CHIP', 'HBM_MEMORY', 'PACKAGING',
])

// Indirect/downstream — physically distant from AI compute
const INDIRECT_BUCKET_IDS: ReadonlySet<string> = new Set([
  'RAW_MATERIAL', 'GLASS_SUBSTRATE', 'CLEANROOM_WATER', 'SPECIALTY_GAS',
])

// Mid-chain infra — early diffusion beneficiaries
const DIFFUSION_BUCKET_IDS: ReadonlySet<string> = new Set([
  'COOLING', 'OPTICAL_NETWORK', 'POWER_INFRA',
])

// ── Helpers ────────────────────────────────────────────────────────────────────

function countLabel(states: AIInfraBucketState[], label: AIInfraStateLabel): number {
  return states.filter(s => s.state_label === label).length
}

function namesWithLabel(states: AIInfraBucketState[], label: AIInfraStateLabel): string[] {
  return states.filter(s => s.state_label === label).map(s => s.display_name)
}

function validBuckets(states: AIInfraBucketState[]): AIInfraBucketState[] {
  return states.filter(s => s.state_label !== 'DATA_INSUFFICIENT')
}

function stagesInLeadingOrEmerging(states: AIInfraBucketState[]): number {
  const stages = new Set(
    states
      .filter(s => s.state_label === 'LEADING' || s.state_label === 'EMERGING')
      .map(s => s.stage),
  )
  return stages.size
}

// ── Rotation State ─────────────────────────────────────────────────────────────

export function deriveInfrastructureRotationState(states: AIInfraBucketState[]): InfraRotationState {
  const data_insufficient = countLabel(states, 'DATA_INSUFFICIENT')
  if (states.length === 0 || data_insufficient >= 6 || validBuckets(states).length < 8) {
    return 'DATA_LIMITED'
  }

  const leading  = countLabel(states, 'LEADING')
  const emerging = countLabel(states, 'EMERGING')
  const lagging  = countLabel(states, 'LAGGING') + countLabel(states, 'DISTRIBUTION')
  const crowded  = countLabel(states, 'CROWDED')
  const story    = countLabel(states, 'STORY_ONLY')
  const stages   = stagesInLeadingOrEmerging(states)

  const coreLeading = states.filter(
    s => s.state_label === 'LEADING' && CORE_BUCKET_IDS.has(s.bucket_id),
  ).length

  const diffusionEmerging = states.filter(
    s => s.state_label === 'EMERGING' && DIFFUSION_BUCKET_IDS.has(s.bucket_id),
  ).length

  const indirectLeading = states.filter(
    s => s.state_label === 'LEADING' && INDIRECT_BUCKET_IDS.has(s.bucket_id),
  ).length

  // DIFFUSING: core AI Chip / HBM leading + diffusion infra emerging
  if (coreLeading >= 1 && diffusionEmerging >= 1 && crowded <= 2) return 'DIFFUSING'

  // BROADENING: 3+ leading/emerging across 2+ stages, crowded manageable
  if (leading + emerging >= 3 && stages >= 2 && crowded <= 2) return 'BROADENING'

  // FRAGILE: story-heavy dominant, high crowded, or indirect leading
  if (
    story >= 3 ||
    crowded >= 3 ||
    (leading > 0 && indirectLeading > 0 && indirectLeading >= leading)
  ) return 'FRAGILE'

  // NARROWING: leading_count ≤ 1 AND lagging_count ≥ 5
  // If no valid previous state, derive from: leading_count ≤ 1 AND lagging_count ≥ 5
  if (leading <= 1 && lagging >= 5) return 'NARROWING'

  // CONCENTRATED: few leaders, most lagging or insufficient
  if (leading <= 2 && lagging + data_insufficient >= 8) return 'CONCENTRATED'

  return 'UNKNOWN'
}

// ── SOXX Context ──────────────────────────────────────────────────────────────

export function deriveInfraSoxxContext(
  states: AIInfraBucketState[],
  rotation_state: InfraRotationState,
): InfraSoxxContext {
  if (rotation_state === 'DATA_LIMITED') return 'DATA_LIMITED'
  if (validBuckets(states).length < 8) return 'DATA_LIMITED'

  const crowded = countLabel(states, 'CROWDED')
  const story   = countLabel(states, 'STORY_ONLY')
  const lagging = countLabel(states, 'LAGGING') + countLabel(states, 'DISTRIBUTION')
  const leading = countLabel(states, 'LEADING')
  const emerging = countLabel(states, 'EMERGING')

  const coreLeading = states.filter(
    s => s.state_label === 'LEADING' && CORE_BUCKET_IDS.has(s.bucket_id),
  ).length

  const indirectLeading = states.filter(
    s => s.state_label === 'LEADING' && INDIRECT_BUCKET_IDS.has(s.bucket_id),
  ).length

  const storyLeading = states.filter(
    s => s.state_label === 'STORY_ONLY',
  ).length

  // RISK_ELEVATED: crowding high, or indirect/story dominant
  if (
    crowded >= 3 ||
    storyLeading >= 2 ||
    (coreLeading === 0 && indirectLeading >= 1 && crowded >= 2)
  ) return 'RISK_ELEVATED'

  // SUPPORTIVE: broadening/diffusing, core leading, no story dominance
  if (
    (rotation_state === 'BROADENING' || rotation_state === 'DIFFUSING') &&
    coreLeading >= 1 &&
    storyLeading === 0 &&
    crowded <= 2
  ) return 'SUPPORTIVE'

  // FRAGILE: weak rotation or lagging dominance
  if (
    rotation_state === 'FRAGILE' ||
    rotation_state === 'NARROWING' ||
    lagging >= 7 ||
    story >= 4
  ) return 'FRAGILE'

  // CONFIRMATION_NEEDED: signals emerging but inconclusive
  if (emerging >= 2 && leading <= 1) return 'CONFIRMATION_NEEDED'
  if (rotation_state === 'CONCENTRATED') return 'CONFIRMATION_NEEDED'

  return 'NEUTRAL'
}

// ── SOXL Context ──────────────────────────────────────────────────────────────

export function deriveInfraSoxlContext(soxx_context: InfraSoxxContext): InfraSoxlContext {
  switch (soxx_context) {
    case 'SUPPORTIVE':          return 'LEVERAGE_SENSITIVE'
    case 'NEUTRAL':             return 'CONFIRMATION_NEEDED'
    case 'FRAGILE':             return 'TACTICAL_ONLY'
    case 'RISK_ELEVATED':       return 'HIGH_VOLATILITY'
    case 'CONFIRMATION_NEEDED': return 'CONFIRMATION_NEEDED'
    case 'DATA_LIMITED':        return 'DATA_LIMITED'
  }
}

// ── Conflict Detection ────────────────────────────────────────────────────────

export function detectInfraConflicts(
  rotation_state:           InfraRotationState,
  soxx_context:             InfraSoxxContext,
  soxl_context:             InfraSoxlContext,
  cycle_phase?:             SemiconductorCyclePhase | null,
  cycle_soxx_judgment?:     SemiconductorSOXXJudgment | null,
  cycle_soxl_environment?:  SemiconductorSOXLEnvironment | null,
): InfraConflictFlag[] {
  const flags: InfraConflictFlag[] = []

  // Conflict 1: Expansion cycle but infra rotation weak, narrowing, or concentrated
  if (
    (cycle_phase === 'MID_EXPANSION' || cycle_phase === 'EARLY_EXPANSION') &&
    (rotation_state === 'FRAGILE' || rotation_state === 'NARROWING' || rotation_state === 'CONCENTRATED')
  ) {
    flags.push('CYCLE_INFRA_DIVERGENCE')
  }

  // Conflict 2: Cycle SOXX supportive but infra risk elevated or fragile
  if (
    cycle_soxx_judgment === 'SUPPORTIVE' &&
    (soxx_context === 'RISK_ELEVATED' || soxx_context === 'FRAGILE')
  ) {
    flags.push('SOXX_CONTEXT_CONFLICT')
  }

  // Conflict 3: Cycle SOXL favorable but infra HIGH_VOLATILITY
  if (
    (cycle_soxl_environment === 'LEVERAGE_SENSITIVE' || cycle_soxl_environment === 'TACTICAL_ONLY') &&
    soxl_context === 'HIGH_VOLATILITY'
  ) {
    flags.push('SOXL_CONTEXT_CONFLICT')
  }

  // Conflict 4: Infrastructure broadening but cycle in distribution/downturn
  if (
    rotation_state === 'BROADENING' &&
    (cycle_phase === 'DISTRIBUTION' || cycle_phase === 'DOWNTURN')
  ) {
    flags.push('CYCLE_PHASE_INFRA_CONFLICT')
  }

  return flags
}

// ── Interpretation Note ────────────────────────────────────────────────────────

export function getInfraInterpretationNote(
  rotation_state: InfraRotationState,
  soxx_context:   InfraSoxxContext,
  conflict_flags: InfraConflictFlag[],
): string {
  if (conflict_flags.includes('CYCLE_PHASE_INFRA_CONFLICT')) {
    return 'Infrastructure signals appear broad, but the semiconductor cycle context is in distribution or downturn — treat broadening as potentially speculative.'
  }
  if (conflict_flags.includes('CYCLE_INFRA_DIVERGENCE')) {
    return 'Infrastructure rotation is weak relative to the current semiconductor cycle phase — confirmation quality is limited.'
  }
  if (conflict_flags.includes('SOXX_CONTEXT_CONFLICT')) {
    return 'Infrastructure risk signals are elevated despite supportive semiconductor cycle context — monitor for divergence resolution.'
  }
  switch (soxx_context) {
    case 'SUPPORTIVE':
      return rotation_state === 'DIFFUSING'
        ? 'Infrastructure momentum is diffusing from core semiconductor into broader AI infrastructure layers.'
        : 'Infrastructure participation is broadening across multiple AI value-chain layers, which supports the current semiconductor cycle context.'
    case 'NEUTRAL':
      return 'Infrastructure rotation signals are mixed with no clear directional trend.'
    case 'FRAGILE':
      return 'Infrastructure leadership is narrow or concentrated in story-heavy areas, so confirmation quality remains limited.'
    case 'RISK_ELEVATED':
      return 'Crowding and indirect leadership are elevated, making the infrastructure signal more sensitive to volatility.'
    case 'CONFIRMATION_NEEDED':
      return 'Several buckets are improving, but data quality and theme purity are not yet strong enough for broad confirmation.'
    case 'DATA_LIMITED':
      return 'Insufficient bucket data to determine infrastructure rotation context.'
  }
}

// ── Confidence ────────────────────────────────────────────────────────────────

function deriveTranslationConfidence(
  states: AIInfraBucketState[],
  rotation_state: InfraRotationState,
): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (rotation_state === 'DATA_LIMITED' || rotation_state === 'UNKNOWN') return 'LOW'
  const valid = validBuckets(states)
  const highConfCount = valid.filter(s => s.confidence === 'HIGH').length
  if (valid.length >= 10 && highConfCount >= 5) return 'HIGH'
  if (valid.length >= 7) return 'MEDIUM'
  return 'LOW'
}

// ── Support / Risk Factors ─────────────────────────────────────────────────────

function buildSupportFactors(states: AIInfraBucketState[], rotation_state: InfraRotationState): string[] {
  const factors: string[] = []
  const n_leading  = countLabel(states, 'LEADING')
  const n_emerging = countLabel(states, 'EMERGING')
  if (n_leading > 0)   factors.push(`${n_leading} bucket${n_leading > 1 ? 's' : ''} Leading`)
  if (n_emerging > 0)  factors.push(`${n_emerging} bucket${n_emerging > 1 ? 's' : ''} Emerging`)
  if (rotation_state === 'BROADENING') factors.push('Cross-stage participation broadening')
  if (rotation_state === 'DIFFUSING')  factors.push('Core → infrastructure momentum diffusion')
  return factors
}

function buildRiskFactors(states: AIInfraBucketState[]): string[] {
  const factors: string[] = []
  const crowded = countLabel(states, 'CROWDED')
  const story   = countLabel(states, 'STORY_ONLY')
  const lagging = countLabel(states, 'LAGGING') + countLabel(states, 'DISTRIBUTION')
  if (crowded >= 2) factors.push(`${crowded} buckets Crowded`)
  if (story >= 2)   factors.push(`${story} buckets Story-Only`)
  if (lagging >= 5) factors.push(`${lagging} buckets Lagging`)
  return factors
}

// ── Main export ───────────────────────────────────────────────────────────────

export function computeInfraToSoxxTranslation(input: InfraTranslationInput): InfraToSoxxTranslation {
  const { bucket_states, selected_benchmark, cycle_phase, cycle_soxx_judgment, cycle_soxl_environment } = input

  const rotation_state  = deriveInfrastructureRotationState(bucket_states)
  const soxx_context    = deriveInfraSoxxContext(bucket_states, rotation_state)
  const soxl_context    = deriveInfraSoxlContext(soxx_context)
  const conflict_flags  = detectInfraConflicts(rotation_state, soxx_context, soxl_context, cycle_phase, cycle_soxx_judgment, cycle_soxl_environment)
  const note            = getInfraInterpretationNote(rotation_state, soxx_context, conflict_flags)
  const confidence      = deriveTranslationConfidence(bucket_states, rotation_state)

  return {
    infrastructure_rotation_state: rotation_state,
    soxx_context,
    soxl_context,
    leading_buckets:           namesWithLabel(bucket_states, 'LEADING'),
    emerging_buckets:          namesWithLabel(bucket_states, 'EMERGING'),
    crowded_buckets:           namesWithLabel(bucket_states, 'CROWDED'),
    story_heavy_buckets:       namesWithLabel(bucket_states, 'STORY_ONLY'),
    indirect_exposure_buckets: bucket_states.filter(s => INDIRECT_BUCKET_IDS.has(s.bucket_id)).map(s => s.display_name),
    lagging_buckets:           [...namesWithLabel(bucket_states, 'LAGGING'), ...namesWithLabel(bucket_states, 'DISTRIBUTION')],
    support_factors:           buildSupportFactors(bucket_states, rotation_state),
    risk_factors:              buildRiskFactors(bucket_states),
    conflict_flags,
    interpretation_note:       note,
    confidence,
    source: {
      benchmark:              selected_benchmark,
      bucket_count:           bucket_states.length,
      valid_bucket_count:     validBuckets(bucket_states).length,
      cycle_phase:            cycle_phase ?? null,
      cycle_soxx_judgment:    cycle_soxx_judgment ?? null,
      cycle_soxl_environment: cycle_soxl_environment ?? null,
    },
  }
}

export function summarizeInfraBucketStates(states: AIInfraBucketState[]) {
  return {
    leading:           countLabel(states, 'LEADING'),
    emerging:          countLabel(states, 'EMERGING'),
    confirming:        countLabel(states, 'CONFIRMING'),
    crowded:           countLabel(states, 'CROWDED'),
    lagging:           countLabel(states, 'LAGGING'),
    distribution:      countLabel(states, 'DISTRIBUTION'),
    story_only:        countLabel(states, 'STORY_ONLY'),
    data_insufficient: countLabel(states, 'DATA_INSUFFICIENT'),
    total:             states.length,
    valid:             validBuckets(states).length,
  }
}
