// AI 인프라 교육형 내러티브 레이어 — BR-4 결정론적 컨텍스트 합성

import type { InfraToSoxxTranslation, InfraRotationState, InfraSoxxContext } from '@/lib/ai-infra/infraToSoxxTranslation'
import type { InfraHistoricalAnalog, InfraAnalogPatternId } from '@/lib/ai-infra/infraHistoricalAnalogs'
import type { SemiconductorCyclePhase, SemiconductorSOXXJudgment } from '@/lib/ai-infra/infrastructureCycleContext'

// ── Types ─────────────────────────────────────────────────────────────────────

export type InfraNarrativeTone =
  | 'SUPPORTIVE_CONTEXT'
  | 'MIXED_CONTEXT'
  | 'FRAGILE_CONTEXT'
  | 'RISK_ELEVATED_CONTEXT'
  | 'DATA_LIMITED_CONTEXT'
  | 'UNKNOWN_CONTEXT'

export interface InfraEducationalNarrative {
  tone:               InfraNarrativeTone
  title:              string
  why_it_matters:     string
  current_meaning:    string
  watch_next:         string[]
  key_context_points: string[]
  caution_points:     string[]
  source: {
    cycle_phase?:          string | null
    infra_rotation_state?: string | null
    analog_pattern?:       string | null
    soxx_context?:         string | null
    soxl_context?:         string | null
    benchmark?:            'SOXX' | 'QQQ' | 'SPY'
  }
}

export interface InfraEducationalNarrativeInput {
  infra_translation:      InfraToSoxxTranslation
  infra_historical_analog: InfraHistoricalAnalog
  cycle_phase?:           SemiconductorCyclePhase | null
  cycle_score?:           number | null
  soxx_judgment?:         SemiconductorSOXXJudgment | null
  selected_benchmark?:    'SOXX' | 'QQQ' | 'SPY'
}

// ── Title map ─────────────────────────────────────────────────────────────────

const PATTERN_TITLE: Record<InfraAnalogPatternId, string> = {
  AI_CORE_LEADERSHIP:         'Core Semiconductor Leadership',
  INFRA_DIFFUSION:            'Infrastructure Broadening',
  LATE_CYCLE_CROWDING:        'Late-Stage Crowding',
  STORY_HEAVY_SPECULATION:    'Speculative Participation',
  INDIRECT_RESOURCE_ROTATION: 'Indirect Resource Rotation',
  LEADERSHIP_FATIGUE:         'Leadership Narrowing',
  EARLY_RECOVERY_REENTRY:     'Early Recovery Context',
  DATA_LIMITED:               'Limited Context',
  NO_CLEAR_ANALOG:            'Mixed Signal Context',
}

// ── Tone derivation ───────────────────────────────────────────────────────────

function deriveTone(
  pattern_id:     InfraAnalogPatternId,
  soxx_context:   InfraSoxxContext,
  rotation_state: InfraRotationState,
): InfraNarrativeTone {
  if (pattern_id === 'DATA_LIMITED' || soxx_context === 'DATA_LIMITED') return 'DATA_LIMITED_CONTEXT'

  // Amendment BR-4 Section 8: UNKNOWN_CONTEXT when inputs fully indeterminate
  if (pattern_id === 'NO_CLEAR_ANALOG' && rotation_state === 'UNKNOWN') return 'UNKNOWN_CONTEXT'

  if (
    pattern_id === 'LATE_CYCLE_CROWDING' ||
    pattern_id === 'STORY_HEAVY_SPECULATION' ||
    soxx_context === 'RISK_ELEVATED'
  ) return 'RISK_ELEVATED_CONTEXT'

  if (
    pattern_id === 'LEADERSHIP_FATIGUE' ||
    rotation_state === 'FRAGILE' ||
    rotation_state === 'CONCENTRATED' ||
    soxx_context === 'FRAGILE'
  ) return 'FRAGILE_CONTEXT'

  if (
    (pattern_id === 'INFRA_DIFFUSION' || pattern_id === 'AI_CORE_LEADERSHIP' || pattern_id === 'EARLY_RECOVERY_REENTRY') &&
    (soxx_context === 'SUPPORTIVE' || soxx_context === 'NEUTRAL')
  ) return 'SUPPORTIVE_CONTEXT'

  return 'MIXED_CONTEXT'
}

// ── Why it matters ────────────────────────────────────────────────────────────
// Synthesizes educational context — does NOT copy BR-2 interpretation_note or BR-3 current_interpretation

export function buildWhyItMattersText(input: InfraEducationalNarrativeInput): string {
  const { infra_historical_analog: a, infra_translation: t } = input
  switch (a.pattern_id) {
    case 'INFRA_DIFFUSION':
      return 'Infrastructure broadening shows whether AI semiconductor leadership is spreading into operating bottlenecks across the value chain.'
    case 'AI_CORE_LEADERSHIP':
      return 'Core semiconductor leadership concentration shows whether the cycle is driven by compute demand or whether participation has broadened into infrastructure layers.'
    case 'LATE_CYCLE_CROWDING':
      return 'Crowding in secondary or indirect infrastructure layers changes the quality of the semiconductor cycle signal.'
    case 'STORY_HEAVY_SPECULATION':
      return 'Story-heavy leadership can appear strong in price data before commercial revenue confirmation is visible.'
    case 'LEADERSHIP_FATIGUE':
      return 'The breadth of semiconductor cycle confirmation shifts when core AI chip activity decouples from downstream infrastructure participation patterns.'
    case 'INDIRECT_RESOURCE_ROTATION':
      return 'Indirect resource leadership can reflect supply chain dynamics rather than direct AI compute demand.'
    case 'EARLY_RECOVERY_REENTRY':
      return 'Early recovery patterns show whether prior weakness is resolving before a new expansion begins.'
    case 'DATA_LIMITED':
      return 'Limited data coverage reduces confidence in cross-bucket infrastructure interpretation.'
    case 'NO_CLEAR_ANALOG':
      return 'A mixed infrastructure setup requires reading multiple signals together rather than relying on a single dominant pattern.'
    default: {
      if (t.infrastructure_rotation_state === 'UNKNOWN') {
        return 'Infrastructure signal context is unavailable when rotation state and pattern matching are both indeterminate.'
      }
      return 'Infrastructure configuration context helps calibrate how bucket-level signals relate to the broader semiconductor cycle.'
    }
  }
}

// ── Current meaning ───────────────────────────────────────────────────────────
// Synthesizes current situation — does NOT copy BR-2 interpretation_note or BR-3 current_interpretation

export function buildCurrentMeaningText(input: InfraEducationalNarrativeInput): string {
  const { infra_historical_analog: a, infra_translation: t, cycle_phase } = input
  const rotation = t.infrastructure_rotation_state
  const leading  = t.leading_buckets.length
  const emerging = t.emerging_buckets.length
  const crowded  = t.crowded_buckets.length

  switch (a.pattern_id) {
    case 'INFRA_DIFFUSION':
      return `The current setup resembles a diffusion pattern where multiple infrastructure layers are participating alongside core semiconductor themes${crowded > 0 ? `, though ${crowded} crowded bucket(s) warrant monitoring` : ''}.`
    case 'AI_CORE_LEADERSHIP':
      return `The current setup is anchored in core AI semiconductor themes${leading > 0 ? ` with ${leading} bucket(s) Leading` : ''}, with broader infrastructure diffusion confirmation still developing.`
    case 'LATE_CYCLE_CROWDING':
      return `The current setup shows elevated crowding${crowded > 0 ? ` (${crowded} buckets)` : ''}, so confirmation quality depends on whether core AI and HBM leadership remain intact.`
    case 'STORY_HEAVY_SPECULATION':
      return `The current setup contains theme-sensitive leadership, so bucket strength should be interpreted with commercialization risk in mind.`
    case 'LEADERSHIP_FATIGUE':
      return `The current setup suggests participation quality may be narrowing — secondary infrastructure themes are active while core semiconductor momentum has softened.`
    case 'INDIRECT_RESOURCE_ROTATION':
      return `The current setup shows leadership in physical or input supply layers${leading > 0 ? ` (${leading} indirect bucket(s) Leading)` : ''}, without core semiconductor confirmation supporting the move.`
    case 'EARLY_RECOVERY_REENTRY':
      return `The current setup resembles early re-entry context${cycle_phase === 'RECOVERY' ? ' with the semiconductor cycle in recovery' : ''}, with core themes beginning to improve but confirmation breadth still limited.`
    case 'DATA_LIMITED':
      return 'The current setup does not provide enough reliable confirmation across the AI infrastructure map.'
    case 'NO_CLEAR_ANALOG':
      if (rotation === 'UNKNOWN') {
        return 'Insufficient context is available to synthesize a meaningful educational narrative at this time.'
      }
      return `The current setup shows mixed signals across infrastructure layers${leading > 0 || emerging > 0 ? ` (${leading} leading, ${emerging} emerging)` : ''} with no dominant pattern confirmed.`
    default:
      return 'Infrastructure configuration context is currently indeterminate.'
  }
}

// ── Watch next ────────────────────────────────────────────────────────────────

export function buildWatchNextItems(input: InfraEducationalNarrativeInput): string[] {
  const { infra_historical_analog: a, infra_translation: t } = input

  switch (a.pattern_id) {
    case 'INFRA_DIFFUSION':
      return [
        'Whether leadership remains spread across multiple value-chain stages',
        'Optical Network and Power Infra participation as broadening confirmation',
        'Whether crowded buckets remain contained',
      ]
    case 'AI_CORE_LEADERSHIP':
      return [
        'Whether diffusion into Cooling, Optical, or Power Infra begins',
        'Core semiconductor crowding risk as momentum extends',
        'Whether breadth expands from core-only to cross-stage participation',
      ]
    case 'LATE_CYCLE_CROWDING':
      return [
        'Whether AI Chip and HBM maintain or return to leading position',
        'Whether crowded bucket RS holds or begins to deteriorate',
        t.conflict_flags.length > 0 ? 'Conflict signal resolution between cycle and infra layers' : 'Whether secondary infrastructure participation stays broad',
      ]
    case 'STORY_HEAVY_SPECULATION':
      return [
        'Whether commercial revenue confirmation begins to appear',
        'Whether RS support develops for story-heavy themes',
        'Whether core semiconductor themes continue to anchor the signal',
      ]
    case 'LEADERSHIP_FATIGUE':
      return [
        'Whether AI Chip and HBM RS trajectory turns positive',
        'Whether secondary infrastructure themes hold or rotate',
        'Whether lagging bucket count continues to rise',
      ]
    case 'INDIRECT_RESOURCE_ROTATION':
      return [
        'Whether core semiconductor buckets re-establish leadership',
        'Whether indirect RS is sustained without core support',
        'Whether supply chain demand translates to core compute demand',
      ]
    case 'EARLY_RECOVERY_REENTRY':
      return [
        'Whether Emerging buckets transition to Leading state',
        'Whether infrastructure diffusion layers begin to participate',
        'Whether cycle phase confirmation becomes available',
      ]
    case 'DATA_LIMITED':
      return [
        'Monitor as valid bucket coverage improves',
        'Watch for data quality improvement across coverage-limited buckets',
      ]
    case 'NO_CLEAR_ANALOG':
      return [
        'Watch for pattern clarification as buckets establish clearer states',
        'Leading and Emerging transitions as the primary direction signal',
      ]
    default:
      return ['Monitor as context becomes available']
  }
}

// ── Tone downgrade when cross-layer conflict flags present ────────────────────

function downgradeToneForConflicts(
  tone:           InfraNarrativeTone,
  conflict_flags: string[],
): InfraNarrativeTone {
  if (tone !== 'SUPPORTIVE_CONTEXT' || conflict_flags.length === 0) return tone
  const highSeverity = conflict_flags.some(
    f => f === 'SOXX_CONTEXT_CONFLICT' || f === 'CYCLE_PHASE_INFRA_CONFLICT',
  )
  return highSeverity ? 'FRAGILE_CONTEXT' : 'MIXED_CONTEXT'
}

// ── Context / caution points ──────────────────────────────────────────────────

function buildKeyContextPoints(t: InfraToSoxxTranslation): string[] {
  return t.support_factors.slice(0, 3)
}

function buildCautionPoints(t: InfraToSoxxTranslation, a: InfraHistoricalAnalog): string[] {
  const points: string[] = []
  if (t.conflict_flags.length > 0) {
    points.push('Cycle context and infrastructure rotation are not fully aligned — confirmation quality should be interpreted cautiously.')
  }
  points.push(...t.risk_factors.slice(0, 2))
  if (a.risk_notes.length > 0) points.push(a.risk_notes[0])
  return points.slice(0, 3)
}

// ── Main export ───────────────────────────────────────────────────────────────

export function buildInfraEducationalNarrative(input: InfraEducationalNarrativeInput): InfraEducationalNarrative {
  const { infra_translation: t, infra_historical_analog: a, cycle_phase, selected_benchmark } = input

  const baseTone = deriveTone(a.pattern_id, t.soxx_context, t.infrastructure_rotation_state)
  const tone     = downgradeToneForConflicts(baseTone, t.conflict_flags)
  const title    = PATTERN_TITLE[a.pattern_id] ?? 'Context Unavailable'

  return {
    tone,
    title,
    why_it_matters:     buildWhyItMattersText(input),
    current_meaning:    buildCurrentMeaningText(input),
    watch_next:         buildWatchNextItems(input),
    key_context_points: buildKeyContextPoints(t),
    caution_points:     buildCautionPoints(t, a),
    source: {
      cycle_phase:          cycle_phase ?? null,
      infra_rotation_state: t.infrastructure_rotation_state,
      analog_pattern:       a.pattern_id,
      soxx_context:         t.soxx_context,
      soxl_context:         t.soxl_context,
      benchmark:            selected_benchmark ?? t.source.benchmark,
    },
  }
}
