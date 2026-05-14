// AI 인프라 버킷 조합을 역사적 유사 국면 패턴에 매핑하는 결정론적 레이어 — BR-3

import type { AIInfraBucketState } from '@/lib/ai-infra/aiInfraStateLabels'
import type { InfraToSoxxTranslation } from '@/lib/ai-infra/infraToSoxxTranslation'
import type { SemiconductorCyclePhase } from '@/lib/ai-infra/infrastructureCycleContext'

// ── Types ─────────────────────────────────────────────────────────────────────

export type InfraAnalogPatternId =
  | 'AI_CORE_LEADERSHIP'
  | 'INFRA_DIFFUSION'
  | 'LATE_CYCLE_CROWDING'
  | 'STORY_HEAVY_SPECULATION'
  | 'INDIRECT_RESOURCE_ROTATION'
  | 'LEADERSHIP_FATIGUE'
  | 'EARLY_RECOVERY_REENTRY'
  | 'DATA_LIMITED'
  | 'NO_CLEAR_ANALOG'

export type InfraAnalogConfidence = 'HIGH' | 'MEDIUM' | 'LOW'

export interface InfraHistoricalAnalog {
  pattern_id:             InfraAnalogPatternId
  pattern_label:          string
  confidence:             InfraAnalogConfidence
  matched_conditions:     string[]
  missing_confirmations:  string[]
  risk_notes:             string[]
  historical_context:     string
  current_interpretation: string
  watch_next:             string[]
  source: {
    cycle_phase?:                    string | null
    infrastructure_rotation_state?:  string | null
    benchmark?:                      'SOXX' | 'QQQ' | 'SPY'
    bucket_count:                    number
    valid_bucket_count:              number
  }
}

export interface InfraAnalogInput {
  bucket_states:       AIInfraBucketState[]
  infra_translation:   InfraToSoxxTranslation
  cycle_phase?:        SemiconductorCyclePhase | null
  selected_benchmark?: 'SOXX' | 'QQQ' | 'SPY'
}

// ── Classification sets (mirrors infraToSoxxTranslation.ts) ───────────────────

const CORE_IDS:      ReadonlySet<string> = new Set(['AI_CHIP', 'HBM_MEMORY', 'PACKAGING'])
const INDIRECT_IDS:  ReadonlySet<string> = new Set(['RAW_MATERIAL', 'GLASS_SUBSTRATE', 'CLEANROOM_WATER', 'SPECIALTY_GAS'])
const DIFFUSION_IDS: ReadonlySet<string> = new Set(['COOLING', 'OPTICAL_NETWORK', 'POWER_INFRA'])

// ── Pattern labels ────────────────────────────────────────────────────────────

const PATTERN_LABELS: Record<InfraAnalogPatternId, string> = {
  AI_CORE_LEADERSHIP:         'Core Semiconductor Leadership',
  INFRA_DIFFUSION:            'Infrastructure Diffusion',
  LATE_CYCLE_CROWDING:        'Late-Cycle Crowding',
  STORY_HEAVY_SPECULATION:    'Story-Heavy Speculation',
  INDIRECT_RESOURCE_ROTATION: 'Indirect Resource Rotation',
  LEADERSHIP_FATIGUE:         'Leadership Fatigue',
  EARLY_RECOVERY_REENTRY:     'Early Recovery',
  DATA_LIMITED:               'Data Limited',
  NO_CLEAR_ANALOG:            'No Clear Analog',
}

// ── Input summarizer ──────────────────────────────────────────────────────────

export function summarizeInfraAnalogInputs(states: AIInfraBucketState[]) {
  const byId = (id: string) => states.find(s => s.bucket_id === id)

  const isLeadingOrEmerging = (id: string) => {
    const s = byId(id)
    return s?.state_label === 'LEADING' || s?.state_label === 'EMERGING'
  }
  const isLeading = (id: string) => byId(id)?.state_label === 'LEADING'
  const isWeak = (id: string) => {
    const s = byId(id)
    return s?.state_label === 'LAGGING' || s?.state_label === 'DISTRIBUTION'
  }

  const valid = states.filter(s => s.state_label !== 'DATA_INSUFFICIENT')

  return {
    leading_count:            states.filter(s => s.state_label === 'LEADING').length,
    emerging_count:           states.filter(s => s.state_label === 'EMERGING').length,
    crowded_count:            states.filter(s => s.state_label === 'CROWDED').length,
    story_count:              states.filter(s => s.state_label === 'STORY_ONLY').length,
    lagging_count:            states.filter(s => s.state_label === 'LAGGING' || s.state_label === 'DISTRIBUTION').length,
    data_insufficient_count:  states.filter(s => s.state_label === 'DATA_INSUFFICIENT').length,
    valid_count:              valid.length,
    core_leading_or_emerging: [...CORE_IDS].filter(isLeadingOrEmerging),
    core_leading:             [...CORE_IDS].filter(isLeading),
    diffusion_leading_or_emerging: [...DIFFUSION_IDS].filter(isLeadingOrEmerging),
    indirect_leading:         [...INDIRECT_IDS].filter(isLeading),
    ai_chip_weakening:        isWeak('AI_CHIP'),
    hbm_weakening:            isWeak('HBM_MEMORY'),
    glass_substrate_state:    byId('GLASS_SUBSTRATE')?.state_label ?? null,
  }
}

// ── Pattern matching (priority order: DATA_LIMITED → STORY_HEAVY → LATE_CYCLE_CROWDING
//                                      → LEADERSHIP_FATIGUE → INFRA_DIFFUSION
//                                      → AI_CORE_LEADERSHIP → INDIRECT_RESOURCE_ROTATION
//                                      → EARLY_RECOVERY_REENTRY → NO_CLEAR_ANALOG) ─────────

export function matchInfraAnalogPattern(input: InfraAnalogInput): InfraHistoricalAnalog {
  const { bucket_states, infra_translation: t, cycle_phase, selected_benchmark } = input
  const s = summarizeInfraAnalogInputs(bucket_states)

  const source = {
    cycle_phase:                   cycle_phase ?? null,
    infrastructure_rotation_state: t.infrastructure_rotation_state,
    benchmark:                     selected_benchmark ?? t.source.benchmark,
    bucket_count:                  t.source.bucket_count,
    valid_bucket_count:            t.source.valid_bucket_count,
  }

  // 1. DATA_LIMITED — insufficient data makes all other patterns unreliable
  if (
    t.infrastructure_rotation_state === 'DATA_LIMITED' ||
    s.valid_count < 8 ||
    s.data_insufficient_count >= 6
  ) {
    return {
      pattern_id:             'DATA_LIMITED',
      pattern_label:          PATTERN_LABELS['DATA_LIMITED'],
      confidence:             'LOW',
      matched_conditions:     ['Insufficient valid bucket data'],
      missing_confirmations:  ['Minimum 8 valid buckets required for pattern matching'],
      risk_notes:             [],
      historical_context:     'Pattern matching requires sufficient valid bucket data to be meaningful.',
      current_interpretation: 'Not enough reliable data to identify a historical analog pattern.',
      watch_next:             ['Monitor as more bucket data becomes available'],
      source,
    }
  }

  // 2. STORY_HEAVY_SPECULATION — speculative signal must not be masked by positive labels
  const glassStoryHeavy = s.glass_substrate_state === 'STORY_ONLY'
  const storyHeavy = t.story_heavy_buckets.length >= 1 || s.story_count >= 2
  if (storyHeavy) {
    const matched: string[] = []
    const missing: string[] = []
    const risk: string[] = []

    if (t.story_heavy_buckets.length > 0) matched.push(`Story-heavy: ${t.story_heavy_buckets.join(', ')}`)
    if (glassStoryHeavy) matched.push('Glass Substrate classified as Story Only (pre-commercial)')
    if (s.story_count >= 2) matched.push(`${s.story_count} buckets in Story Only state`)
    if (s.crowded_count > 0) risk.push(`${s.crowded_count} bucket(s) Crowded alongside story-heavy themes`)
    if (s.core_leading.length === 0) risk.push('No core semiconductor buckets Leading')
    if (s.core_leading.length > 0) missing.push('Core semiconductor confirmation present — monitor RS support for story themes')

    return {
      pattern_id:             'STORY_HEAVY_SPECULATION',
      pattern_label:          PATTERN_LABELS['STORY_HEAVY_SPECULATION'],
      confidence:             s.story_count >= 2 ? 'HIGH' : 'MEDIUM',
      matched_conditions:     matched,
      missing_confirmations:  missing,
      risk_notes:             risk,
      historical_context:     'Speculative theme rotation patterns emerge when narrative-driven themes outpace commercial revenue confirmation.',
      current_interpretation: 'This resembles a speculative theme rotation rather than broad infrastructure confirmation. Story-heavy participation without RS support has historically resolved through theme reversion rather than continuation.',
      watch_next:             [
        'RS confirmation in story-heavy buckets',
        'Commercialization milestone progress',
        'Core semiconductor bucket strength as anchor signal',
      ],
      source,
    }
  }

  // 3. LATE_CYCLE_CROWDING — crowding risk overrides broadening interpretation
  const lateCycleCrowding =
    s.crowded_count >= 3 ||
    (s.crowded_count >= 2 && (s.ai_chip_weakening || s.hbm_weakening))
  if (lateCycleCrowding) {
    const matched: string[] = []
    const missing: string[] = []
    const risk: string[] = []

    matched.push(`${s.crowded_count} crowded bucket(s)`)
    if (t.crowded_buckets.length > 0) matched.push(`Crowded: ${t.crowded_buckets.join(', ')}`)
    if (s.ai_chip_weakening) matched.push('AI Chip not in leading position')
    if (s.hbm_weakening) matched.push('HBM Memory not in leading position')
    if (cycle_phase === 'LATE_EXPANSION') matched.push('Semiconductor cycle in Late Expansion phase')
    if (s.indirect_leading.length > 0) matched.push(`Indirect buckets leading: ${s.indirect_leading.join(', ')}`)
    risk.push('Crowded themes are sensitive to rotation reversals')
    if (s.core_leading.length === 0) risk.push('No core semiconductor confirmation — crowding concentrated in secondary layers')
    if (t.infrastructure_rotation_state === 'BROADENING') risk.push('BR-2 rotation shows Broadening but crowding is present — treat broadening signal as potentially fragile')
    if (s.core_leading.length > 0) missing.push('Core semiconductor participation would support continued strength')
    missing.push('RS divergence between crowded and core buckets is the key watch item')

    return {
      pattern_id:             'LATE_CYCLE_CROWDING',
      pattern_label:          PATTERN_LABELS['LATE_CYCLE_CROWDING'],
      confidence:             s.crowded_count >= 3 ? 'HIGH' : 'MEDIUM',
      matched_conditions:     matched,
      missing_confirmations:  missing,
      risk_notes:             risk,
      historical_context:     'Late-cycle crowding patterns emerge when capital moves into secondary and indirect infrastructure beneficiaries after core themes have stretched.',
      current_interpretation: 'This resembles late-stage diffusion where capital moves into secondary or indirect beneficiaries. Infrastructure themes may remain active, but confirmation quality from core semiconductor layers is limited.',
      watch_next:             [
        'AI Chip and HBM return to leading position',
        'Crowded bucket RS deterioration',
        'Indirect and power infrastructure crowding as late-cycle signal',
      ],
      source,
    }
  }

  // 4. LEADERSHIP_FATIGUE — core weakness overrides secondary strength
  const leadershipFatigue =
    (s.ai_chip_weakening || s.hbm_weakening) &&
    (t.infrastructure_rotation_state === 'NARROWING' || t.infrastructure_rotation_state === 'FRAGILE') &&
    (s.indirect_leading.length > 0 || s.diffusion_leading_or_emerging.length > 0)
  if (leadershipFatigue) {
    const matched: string[] = []
    const missing: string[] = []
    const risk: string[] = []

    if (s.ai_chip_weakening) matched.push('AI Chip weakening or not Leading')
    if (s.hbm_weakening) matched.push('HBM Memory weakening or not Leading')
    if (s.indirect_leading.length > 0) matched.push(`Indirect buckets remain active: ${s.indirect_leading.join(', ')}`)
    if (s.diffusion_leading_or_emerging.length > 0) matched.push(`Infrastructure layers still participating: ${s.diffusion_leading_or_emerging.join(', ')}`)
    matched.push(`Rotation state: ${t.infrastructure_rotation_state}`)
    risk.push('Secondary theme strength without core confirmation has historically been fragile')
    if (s.lagging_count > 0) risk.push(`${s.lagging_count} lagging bucket(s) indicate broad deterioration pressure`)
    missing.push('AI Chip and HBM recovery to Leading or Emerging required for pattern resolution')

    return {
      pattern_id:             'LEADERSHIP_FATIGUE',
      pattern_label:          PATTERN_LABELS['LEADERSHIP_FATIGUE'],
      confidence:             (s.ai_chip_weakening && s.hbm_weakening) ? 'HIGH' : 'MEDIUM',
      matched_conditions:     matched,
      missing_confirmations:  missing,
      risk_notes:             risk,
      historical_context:     'Leadership fatigue patterns emerge when core semiconductor themes soften while downstream infrastructure themes temporarily sustain relative strength.',
      current_interpretation: 'This resembles leadership fatigue where secondary themes remain active after core momentum softens. Infrastructure secondary strength without core confirmation has historically been a transitional rather than sustainable condition.',
      watch_next:             [
        'AI Chip and HBM RS trajectory as the primary signal',
        'Whether secondary infrastructure themes hold or rotate',
        'Breadth of lagging buckets as deterioration gauge',
      ],
      source,
    }
  }

  // 5. INFRA_DIFFUSION
  const infraDiffusion =
    s.core_leading_or_emerging.length >= 1 &&
    s.diffusion_leading_or_emerging.length >= 1 &&
    (t.infrastructure_rotation_state === 'BROADENING' || t.infrastructure_rotation_state === 'DIFFUSING')
  if (infraDiffusion) {
    const matched: string[] = []
    const missing: string[] = []
    const risk: string[] = []

    matched.push(`Core participating: ${s.core_leading_or_emerging.join(', ')}`)
    matched.push(`Infrastructure diffusion layers: ${s.diffusion_leading_or_emerging.join(', ')}`)
    matched.push(`Rotation state: ${t.infrastructure_rotation_state}`)
    if (t.leading_buckets.length > 0) matched.push(`Leading: ${t.leading_buckets.join(', ')}`)
    if (t.emerging_buckets.length > 0) matched.push(`Emerging: ${t.emerging_buckets.join(', ')}`)

    if (!s.diffusion_leading_or_emerging.includes('OPTICAL_NETWORK')) missing.push('Optical Network confirmation broadens the pattern')
    if (!s.diffusion_leading_or_emerging.includes('POWER_INFRA')) missing.push('Power Infrastructure participation confirms extended diffusion')
    if (s.crowded_count > 0) risk.push(`${s.crowded_count} bucket(s) Crowded — monitor for crowding risk`)

    return {
      pattern_id:             'INFRA_DIFFUSION',
      pattern_label:          PATTERN_LABELS['INFRA_DIFFUSION'],
      confidence:             (s.core_leading_or_emerging.length >= 2 && s.diffusion_leading_or_emerging.length >= 2) ? 'HIGH' : 'MEDIUM',
      matched_conditions:     matched,
      missing_confirmations:  missing,
      risk_notes:             risk,
      historical_context:     'AI infrastructure diffusion patterns emerge when core semiconductor momentum begins spreading into downstream infrastructure layers such as cooling, optical networking, and power.',
      current_interpretation: 'This resembles a mid-cycle AI infrastructure broadening pattern. Core and infrastructure layers participating together is consistent with mid-cycle diffusion context. Confirmation quality depends on whether Optical and Power Infra continue to broaden.',
      watch_next:             [
        'Optical Network and Power Infra confirmation',
        'Crowding risk in diffusion layers',
        'Core semiconductor RS as the anchor signal',
      ],
      source,
    }
  }

  // 6. AI_CORE_LEADERSHIP
  const coreLeadership = s.core_leading_or_emerging.length >= 1 && s.crowded_count <= 2 && s.story_count <= 1
  if (coreLeadership) {
    const matched: string[] = []
    const missing: string[] = []
    const risk: string[] = []

    matched.push(`Core buckets active: ${s.core_leading_or_emerging.join(', ')}`)
    if (t.leading_buckets.length > 0) matched.push(`Leading: ${t.leading_buckets.join(', ')}`)
    if (s.diffusion_leading_or_emerging.length === 0) missing.push('Infrastructure diffusion layers (Cooling, Optical, Power) would broaden the pattern')
    if (s.core_leading.length < 2) missing.push('Two or more core buckets Leading would strengthen the signal')
    if (s.crowded_count > 0) risk.push(`${s.crowded_count} bucket(s) Crowded — monitor stretch risk`)

    return {
      pattern_id:             'AI_CORE_LEADERSHIP',
      pattern_label:          PATTERN_LABELS['AI_CORE_LEADERSHIP'],
      confidence:             s.core_leading.length >= 2 ? 'HIGH' : 'MEDIUM',
      matched_conditions:     matched,
      missing_confirmations:  missing,
      risk_notes:             risk,
      historical_context:     'Core semiconductor leadership patterns are characterized by AI Chip and HBM Memory driving momentum before diffusion into infrastructure layers occurs.',
      current_interpretation: 'Core semiconductor leadership remains intact. Infrastructure confirmation is still secondary. This is consistent with an early or mid-cycle pattern where AI compute demand is the primary driver.',
      watch_next:             [
        'Whether diffusion into Cooling, Optical, or Power Infra begins',
        'Core bucket crowding risk',
        'Broadening into packaging and memory-adjacent themes',
      ],
      source,
    }
  }

  // 7. INDIRECT_RESOURCE_ROTATION
  const indirectRotation = s.indirect_leading.length >= 1 && s.core_leading.length === 0
  if (indirectRotation) {
    const matched: string[] = []
    const missing: string[] = []
    const risk: string[] = []

    matched.push(`Indirect leading: ${s.indirect_leading.join(', ')}`)
    matched.push('No core semiconductor buckets Leading')
    if (t.indirect_exposure_buckets.length > 0) matched.push(`Indirect exposure buckets: ${t.indirect_exposure_buckets.join(', ')}`)
    missing.push('Core semiconductor (AI Chip, HBM) confirmation would validate the rotation')
    risk.push('Indirect resource leading without core semiconductor confirmation has historically been an unreliable primary signal')

    return {
      pattern_id:             'INDIRECT_RESOURCE_ROTATION',
      pattern_label:          PATTERN_LABELS['INDIRECT_RESOURCE_ROTATION'],
      confidence:             'MEDIUM',
      matched_conditions:     matched,
      missing_confirmations:  missing,
      risk_notes:             risk,
      historical_context:     'Indirect resource rotation patterns emerge when physical input or supply chain themes lead without direct AI semiconductor confirmation.',
      current_interpretation: 'This resembles indirect resource rotation, not direct AI semiconductor confirmation. Raw material or physical infrastructure leading without core semiconductor participation has historically been a secondary rotation pattern.',
      watch_next:             [
        'AI Chip and HBM participation as primary confirmation',
        'Whether indirect theme RS is sustainable without core support',
        'Raw material and specialty chemical demand drivers',
      ],
      source,
    }
  }

  // 8. EARLY_RECOVERY_REENTRY — cycle_phase = RECOVERY 필수
  // emerging_count만으로 트리거하면 LOW-confidence 긍정 레이블 노출 → DATA_LIMITED보다 misleading (Amendment BR-3B 5.8)
  const earlyRecovery =
    cycle_phase === 'RECOVERY' &&
    s.core_leading_or_emerging.length >= 1 &&
    s.crowded_count <= 1
  if (earlyRecovery) {
    const matched: string[] = []
    const missing: string[] = []
    const risk: string[] = []

    if (cycle_phase === 'RECOVERY') matched.push('Semiconductor cycle in Recovery phase')
    if (s.core_leading_or_emerging.length > 0) matched.push(`Core buckets improving: ${s.core_leading_or_emerging.join(', ')}`)
    if (s.emerging_count >= 2) matched.push(`${s.emerging_count} buckets in Emerging state`)
    missing.push('More Leading buckets would confirm recovery progression')
    missing.push('Infrastructure diffusion layer participation (Cooling, Optical) as confirmation')
    if (s.lagging_count > 4) risk.push(`${s.lagging_count} buckets still Lagging — breadth remains limited`)

    return {
      pattern_id:             'EARLY_RECOVERY_REENTRY',
      pattern_label:          PATTERN_LABELS['EARLY_RECOVERY_REENTRY'],
      confidence:             cycle_phase === 'RECOVERY' ? 'MEDIUM' : 'LOW',
      matched_conditions:     matched,
      missing_confirmations:  missing,
      risk_notes:             risk,
      historical_context:     'Early recovery patterns emerge when core semiconductor themes begin improving from weakness before broader infrastructure confirmation develops.',
      current_interpretation: 'This resembles early recovery rather than full expansion. Multiple buckets improving without crowding is consistent with early re-entry context, though confirmation breadth remains limited.',
      watch_next:             [
        'Core semiconductor RS improving from lagging',
        'Emerging buckets transitioning to Leading',
        'Infrastructure layer participation broadening',
      ],
      source,
    }
  }

  // 9. NO_CLEAR_ANALOG
  return {
    pattern_id:             'NO_CLEAR_ANALOG',
    pattern_label:          PATTERN_LABELS['NO_CLEAR_ANALOG'],
    confidence:             'LOW',
    matched_conditions:     [
      `Leading: ${t.leading_buckets.length}, Emerging: ${t.emerging_buckets.length}, Crowded: ${t.crowded_buckets.length}`,
      `Rotation state: ${t.infrastructure_rotation_state}`,
    ],
    missing_confirmations:  ['No single pattern threshold is clearly met'],
    risk_notes:             [],
    historical_context:     'Mixed bucket configurations that do not fit cleanly into known historical analog patterns.',
    current_interpretation: 'The current infrastructure bucket configuration shows mixed signals. No single historical analog pattern is clearly dominant at this time.',
    watch_next:             [
      'Pattern clarification as more buckets establish clear states',
      'Leading and Emerging bucket transitions as the primary signal',
    ],
    source,
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export function computeInfraHistoricalAnalog(input: InfraAnalogInput): InfraHistoricalAnalog {
  return matchInfraAnalogPattern(input)
}
