import type { UiLang } from '@/lib/uiLang'

export type StandardInterpretationSource = {
  current?: {
    score?: number | null
    level?: number | null
    exposure_pct?: number | null
  } | null
  total_risk?: {
    state?: string | null
  } | null
  master_signal?: {
    mode?: string | null
  } | null
  market_regime?: {
    regime?: string | null
    regime_confidence?: number | null
    stability_score?: number | null
    stability_label?: string | null
  } | null
  risk_scenario?: {
    scenario?: string | null
    confidence?: number | null
    label?: string | null
  } | null
  track_a?: {
    state?: string | null
    stage0?: boolean | null
  } | null
  track_a_early?: {
    state?: string | null
    trigger_count?: number | null
  } | null
  track_c?: {
    state?: string | null
  } | null
  breadth?: {
    divergence?: boolean | null
  } | null
}

export type StandardInterpretationDisplayModel = {
  summaryLine: string
  detailLines: string[]
  forwardNarrativeLine?: string
  interpretationState: string
  currentRegime: string
  agreementScore: number
  conflictScore: number
  trustScore: number
  subtext?: string
  isFallback: boolean
}

type StandardNarrativeState =
  | 'CALM'
  | 'WATCH'
  | 'FRAGILE'
  | 'DEFENSIVE'
  | 'UNCONFIRMED_RECOVERY'
  | 'UNAVAILABLE'

type ForwardNarrativeCategory =
  | 'LOW_RISK'
  | 'MIXED'
  | 'ELEVATED'
  | 'TAIL_HEAVY'

type StandardTemplateKey =
  | 'stable_watch'
  | 'internal_pressure_building'
  | 'fragile_watch'
  | 'credit_confirmation_pending'
  | 'shock_not_confirmed'
  | 'defensive_bias_active'
  | 'stabilizing_but_unconfirmed'
  | 'overlay_unavailable'

type StandardTemplateContext = {
  currentRegime: string
  alignmentDescriptor: string
  confidenceDescriptor: string
  mode: string
  hasEarlySignal: boolean
  hasBroadDivergence: boolean
  hasCreditConfirmation: boolean
}

type StandardNarrativeTemplate = {
  summaryLine: (context: StandardTemplateContext, uiLang: UiLang) => string
  detailLines: (context: StandardTemplateContext, uiLang: UiLang) => [string, string]
  forwardNarrativeLine?: (context: StandardTemplateContext, uiLang: UiLang) => string
  subtext?: (uiLang: UiLang) => string
}

function t(uiLang: UiLang, ko: string, en: string) {
  return uiLang === 'ko' ? ko : en
}

const STANDARD_INTERPRETATION_SUBTEXT = (uiLang: UiLang) =>
  t(uiLang, '해석 보조층이며, 기본 엔진이 우선입니다.', 'Interpretive layer only; base engine remains primary.')

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function hasStandardInterpretationSource(input: StandardInterpretationSource) {
  return Boolean(input.current && input.total_risk)
}

function normalizeRegime(regime: string | null | undefined) {
  const value = String(regime ?? '').toLowerCase()
  if (value.includes('liquidity crisis')) return 'Liquidity Crisis'
  if (value.includes('credit stress')) return 'Credit Stress'
  if (value.includes('early stress')) return 'Early Stress'
  if (value.includes('expansion')) return 'Expansion'
  return regime?.trim() || 'Base Engine'
}

function regimePressure(regime: string) {
  if (regime === 'Liquidity Crisis') return 88
  if (regime === 'Credit Stress') return 74
  if (regime === 'Early Stress') return 48
  if (regime === 'Expansion') return 18
  return 50
}

function scenarioPressure(scenario: string | null | undefined) {
  if (scenario === 'A') return 80
  if (scenario === 'B') return 65
  if (scenario === 'C') return 45
  if (scenario === 'D') return 18
  return 50
}

function rulePressure(input: StandardInterpretationSource) {
  const level = input.current?.level ?? 1
  const mode = input.master_signal?.mode ?? 'ALL_CLEAR'
  let base = level <= 0 ? 18 : level === 1 ? 34 : level === 2 ? 56 : level === 3 ? 76 : 88
  if (mode === 'EARLY_WARNING') base = Math.max(base, 58)
  if (mode === 'HEDGE_AND_HOLD') base = Math.max(base, 64)
  if (mode === 'CREDIT_CRISIS') base = Math.max(base, 78)
  if (mode === 'COMPOUND_CRISIS') base = Math.max(base, 90)
  return base
}

function buildAgreementScore(input: StandardInterpretationSource, rule: number, regime: number, scenario: number) {
  const regimeConf = input.market_regime?.regime_confidence ?? 45
  const scenarioConf = input.risk_scenario?.confidence ?? 45
  const spread = Math.max(rule, regime, scenario) - Math.min(rule, regime, scenario)
  let score = 82 - spread * 0.9
  score += (regimeConf - 50) * 0.12
  score += (scenarioConf - 50) * 0.08
  if (rule >= 65 && regime >= 65 && scenario >= 55) score += 6
  if (rule <= 35 && regime <= 35 && scenario <= 35) score += 6
  if ((input.track_a_early?.state ?? 'Normal') !== 'Normal' && input.breadth?.divergence) score += 4
  return clamp(score, 18, 94)
}

function buildConflictScore(input: StandardInterpretationSource, rule: number, regime: number, scenario: number, agreement: number) {
  const spread = Math.max(rule, regime, scenario) - Math.min(rule, regime, scenario)
  let score = spread * 1.05
  if (rule >= 70 && scenario <= 35) score += 18
  if (rule <= 35 && regime >= 70) score += 18
  if ((input.master_signal?.mode ?? 'ALL_CLEAR') === 'EARLY_WARNING' && regime <= 35 && scenario <= 35) score += 10
  if (agreement >= 70) score -= 18
  return clamp(score, 4, 88)
}

function buildTrustScore(input: StandardInterpretationSource, agreement: number, conflict: number) {
  const regimeConf = input.market_regime?.regime_confidence ?? 45
  const scenarioConf = input.risk_scenario?.confidence ?? 45
  const stabilityLabel = input.market_regime?.stability_label ?? 'TRANSITIONING'
  const mode = input.master_signal?.mode ?? 'ALL_CLEAR'
  const stabilityAdj =
    stabilityLabel === 'STABLE' ? 8 :
    stabilityLabel === 'UNSTABLE' ? -6 :
    0
  const confirmationBoost =
    input.track_a?.stage0 || mode === 'CREDIT_CRISIS' || mode === 'COMPOUND_CRISIS'
      ? 10
      : mode === 'EARLY_WARNING' || (input.track_a_early?.state ?? 'Normal') !== 'Normal'
        ? 3
        : 0
  const raw =
    regimeConf * 0.38 +
    scenarioConf * 0.24 +
    agreement * 0.23 +
    (100 - conflict) * 0.1 +
    stabilityAdj +
    confirmationBoost
  return clamp(raw, 12, 90)
}

function buildInterpretationState(input: StandardInterpretationSource, regime: string) {
  const mode = input.master_signal?.mode ?? 'ALL_CLEAR'
  const level = input.current?.level ?? 1
  const earlyState = input.track_a_early?.state ?? 'Normal'
  if (mode === 'COMPOUND_CRISIS' || mode === 'CREDIT_CRISIS' || level >= 3) return 'DEFENSIVE REVIEW'
  if (mode === 'EARLY_WARNING' || earlyState !== 'Normal' || level === 2) return 'WATCH CONDITION'
  if (regime !== 'Expansion' || input.breadth?.divergence) return 'PRESSURE BUILDING'
  return 'BASE ENGINE STABLE'
}

function confidenceDescriptor(score: number, uiLang: UiLang) {
  if (score >= 70) return t(uiLang, '높은 신뢰도', 'high confidence')
  if (score >= 45) return t(uiLang, '중간 신뢰도', 'moderate confidence')
  return t(uiLang, '제한된 신뢰도', 'limited confidence')
}

function alignmentDescriptor(agreement: number, conflict: number, uiLang: UiLang) {
  if (conflict >= 60) return t(uiLang, '혼합 정렬', 'mixed alignment')
  if (agreement >= 72) return t(uiLang, '광범위한 정렬', 'broad alignment')
  if (agreement >= 55) return t(uiLang, '부분 정렬', 'partial alignment')
  return t(uiLang, '초기 정렬', 'early alignment')
}

function buildNarrativeState(
  input: StandardInterpretationSource,
  currentRegime: string,
  interpretationState: string
): StandardNarrativeState {
  const mode = input.master_signal?.mode ?? 'ALL_CLEAR'
  const earlyTriggers = input.track_a_early?.trigger_count ?? 0
  const hasEarlySignal = (input.track_a_early?.state ?? 'Normal') !== 'Normal'
  const hasBroadDivergence = Boolean(input.breadth?.divergence)
  const hasCreditConfirmation = Boolean(input.track_a?.stage0)

  if (interpretationState === 'DEFENSIVE REVIEW') return 'DEFENSIVE'

  if (interpretationState === 'BASE ENGINE STABLE' && currentRegime !== 'Expansion') {
    return 'UNCONFIRMED_RECOVERY'
  }

  if (interpretationState === 'WATCH CONDITION') {
    if (hasBroadDivergence || hasCreditConfirmation || earlyTriggers >= 2 || currentRegime === 'Credit Stress') {
      return 'FRAGILE'
    }
    return 'WATCH'
  }

  if (interpretationState === 'PRESSURE BUILDING') {
    if (hasBroadDivergence || hasCreditConfirmation || currentRegime === 'Credit Stress' || currentRegime === 'Liquidity Crisis') {
      return 'FRAGILE'
    }
    if (mode === 'ALL_CLEAR' && !hasEarlySignal) return 'UNCONFIRMED_RECOVERY'
    return 'WATCH'
  }

  return 'CALM'
}

function selectTemplateKey(
  narrativeState: StandardNarrativeState,
  input: StandardInterpretationSource,
  currentRegime: string
): StandardTemplateKey {
  if (narrativeState === 'UNAVAILABLE') return 'overlay_unavailable'
  if (narrativeState === 'CALM') return 'stable_watch'
  if (narrativeState === 'DEFENSIVE') return 'defensive_bias_active'
  if (narrativeState === 'UNCONFIRMED_RECOVERY') return 'stabilizing_but_unconfirmed'
  if (narrativeState === 'FRAGILE') {
    return currentRegime === 'Credit Stress' || Boolean(input.track_a?.stage0)
      ? 'credit_confirmation_pending'
      : 'fragile_watch'
  }
  return (input.track_a_early?.state ?? 'Normal') !== 'Normal' || (input.master_signal?.mode ?? 'ALL_CLEAR') === 'EARLY_WARNING'
    ? 'internal_pressure_building'
    : 'shock_not_confirmed'
}

function buildForwardNarrativeCategory(
  narrativeState: StandardNarrativeState,
  currentRegime: string,
  agreementScore: number,
  conflictScore: number,
  trustScore: number
): ForwardNarrativeCategory {
  if (narrativeState === 'DEFENSIVE') {
    if (conflictScore <= 36 && trustScore >= 58) return 'TAIL_HEAVY'
    return 'ELEVATED'
  }

  if (narrativeState === 'FRAGILE') {
    if (currentRegime === 'Credit Stress' || currentRegime === 'Liquidity Crisis') return 'TAIL_HEAVY'
    return 'ELEVATED'
  }

  if (narrativeState === 'UNCONFIRMED_RECOVERY') return 'MIXED'

  if (narrativeState === 'WATCH') {
    if (agreementScore >= 62 && conflictScore <= 42) return 'ELEVATED'
    return 'MIXED'
  }

  if (narrativeState === 'CALM') {
    if (conflictScore >= 52 || trustScore < 45) return 'MIXED'
    return 'LOW_RISK'
  }

  return 'MIXED'
}

function buildForwardNarrativeLine(
  narrativeState: StandardNarrativeState,
  category: ForwardNarrativeCategory,
  uiLang: UiLang
): string | undefined {
  if (narrativeState === 'UNAVAILABLE') return undefined

  if (narrativeState === 'DEFENSIVE') {
    return category === 'TAIL_HEAVY'
      ? t(uiLang, '하방 시나리오는 여전히 유효하며, 지속적 회복이 형성되기 전까지 안정화에는 시간이 걸릴 수 있습니다.', 'Downside scenarios remain active, and stabilization may take time before a sustained recovery can form.')
      : t(uiLang, '하방 압력이 여전히 유효하며, 상황이 다소 안정돼 보여도 안정화에는 시간이 걸릴 수 있습니다.', 'Downside pressure remains active, and stabilization may take time even if conditions begin to steady.')
  }

  if (narrativeState === 'FRAGILE') {
    return category === 'TAIL_HEAVY'
      ? t(uiLang, '단기 움직임은 안정적으로 보일 수 있지만, 압력이 이어지면 구조는 추가 악화에 취약합니다.', 'Short-term moves may appear stable, but the structure is vulnerable to further deterioration if pressure continues.')
      : t(uiLang, '단기 조건은 한동안 버틸 수 있지만, 압력이 확산되면 추가 악화 가능성이 남아 있습니다.', 'Short-term conditions may hold for a time, but further deterioration remains possible if pressure broadens.')
  }

  if (narrativeState === 'UNCONFIRMED_RECOVERY') {
    return t(uiLang, '회복 시도는 나타나고 있지만, 확인은 아직 제한적이며 되돌림 가능성도 남아 있습니다.', 'Recovery attempts are forming, but confirmation is still limited and setbacks remain possible.')
  }

  if (narrativeState === 'WATCH') {
    return category === 'ELEVATED'
      ? t(uiLang, '단기 조건은 질서를 유지할 수 있지만, 광범위한 확인이 나오기 전 압력이 먼저 쌓이는 경우가 많습니다.', 'Near-term conditions may stay orderly, but early pressure often tends to build before broader confirmation appears.')
      : t(uiLang, '단기 조건은 안정적으로 유지되지만, 표면 아래에서 압력 신호가 쌓이고 있습니다.', 'Near-term conditions remain stable, but early signs of pressure are building beneath the surface.')
  }

  if (narrativeState === 'CALM') {
    return category === 'LOW_RISK'
      ? t(uiLang, '단기 조건은 안정적으로 보이지만, 표면 아래에서는 압력 변화가 나타날 수 있습니다.', 'Near-term conditions appear stable, though early shifts in pressure may still emerge beneath the surface.')
      : t(uiLang, '신호가 혼재되어 있어, 뚜렷한 방향성보다는 불안정 구간을 시사합니다.', 'Signals are mixed, suggesting a period of instability rather than a clear directional move.')
  }

  return t(uiLang, '신호가 혼재되어 있어, 뚜렷한 방향성보다는 불안정 구간을 시사합니다.', 'Signals are mixed, suggesting a period of instability rather than a clear directional move.')
}

const STANDARD_NARRATIVE_TEMPLATES: Record<StandardTemplateKey, StandardNarrativeTemplate> = {
  stable_watch: {
    summaryLine: (_, uiLang) => t(uiLang, '기본 조건은 안정적이며, watch 신호는 제한적입니다.', 'Base conditions remain stable, and watch signals stay contained.'),
    detailLines: ({ currentRegime, alignmentDescriptor: alignment, confidenceDescriptor: confidence }, uiLang) => [
      currentRegime === 'Expansion'
        ? t(uiLang, '활성 외부 shock은 확인되지 않았고, 압력은 아직 시장 전반으로 확산되지 않았습니다.', 'No active external shock is confirmed, and pressure is not yet broad across the market.')
        : t(uiLang, `${currentRegime}이 주요 배경이며, stress는 아직 광범위하지 않습니다.`, `${currentRegime} remains the main backdrop, though stress is not yet broad-based.`),
      t(uiLang, `이 구간은 ${alignment}과 ${confidence} 수준의 light watch입니다.`, `This is a light watch condition with ${alignment} and ${confidence}.`),
    ],
    forwardNarrativeLine: (_, uiLang) => t(uiLang, '단기 조건은 안정적으로 유지되지만, 표면 아래에서 압력 신호가 쌓이고 있습니다.', 'Near-term conditions remain stable, but early signs of pressure are building beneath the surface.'),
    subtext: STANDARD_INTERPRETATION_SUBTEXT,
  },
  internal_pressure_building: {
    summaryLine: (_, uiLang) => t(uiLang, '내부 압력은 높아지고 있지만, 광범위한 확인은 아직 불충분합니다.', 'Internal pressure is rising, but broad confirmation is incomplete.'),
    detailLines: ({ hasEarlySignal, confidenceDescriptor: confidence, alignmentDescriptor: alignment }, uiLang) => [
      hasEarlySignal
        ? t(uiLang, '전체 시장 확인 전에 조기 신호 전송이 활성화되어 있습니다.', 'Early signal transmission is active before full market-wide confirmation.')
        : t(uiLang, '압력은 내부에서 먼저 나타나고 있으며, 아직 광범위하게 확산되지는 않았습니다.', 'Pressure is appearing internally before it becomes broad across the tape.'),
      t(uiLang, `이 구간은 ${alignment}과 ${confidence} 수준의 watch입니다.`, `This is a watch condition with ${alignment} and ${confidence}.`),
    ],
    forwardNarrativeLine: (_, uiLang) => t(uiLang, '단기 조건은 안정적으로 유지되지만, 표면 아래에서 압력 신호가 쌓이고 있습니다.', 'Near-term conditions remain stable, but early signs of pressure are building beneath the surface.'),
    subtext: STANDARD_INTERPRETATION_SUBTEXT,
  },
  fragile_watch: {
    summaryLine: (_, uiLang) => t(uiLang, '시장 배경은 취약해 보이지만, 확인은 아직 광범위하지 않습니다.', 'The market backdrop looks fragile, though confirmation is not yet broad.'),
    detailLines: ({ hasBroadDivergence, currentRegime, confidenceDescriptor: confidence }, uiLang) => [
      hasBroadDivergence
        ? t(uiLang, 'breadth와 cross-asset 행동이 단일 구간을 넘어 압력이 확산되고 있음을 시사합니다.', 'Breadth and cross-asset behavior suggest pressure is spreading beyond a single pocket.')
        : t(uiLang, `${currentRegime}이 주요 구조 배경이며, 민감한 영역부터 압력이 넓어지고 있습니다.`, `${currentRegime} remains the main structural backdrop as pressure broadens in sensitive areas.`),
      t(uiLang, `이 구간은 ${confidence}의 fragile watch입니다.`, `This remains a fragile watch condition with ${confidence}.`),
    ],
    forwardNarrativeLine: (_, uiLang) => t(uiLang, '단기 움직임은 안정적으로 보일 수 있지만, 압력이 이어지면 구조는 추가 악화에 취약합니다.', 'Short-term moves may appear stable, but the structure is vulnerable to further deterioration if pressure continues.'),
    subtext: STANDARD_INTERPRETATION_SUBTEXT,
  },
  credit_confirmation_pending: {
    summaryLine: (_, uiLang) => t(uiLang, 'Credit-sensitive 압력이 커지고 있지만, confirmation은 아직 대기 중입니다.', 'Credit-sensitive pressure is building, but confirmation remains pending.'),
    detailLines: ({ hasCreditConfirmation, confidenceDescriptor: confidence }, uiLang) => [
      hasCreditConfirmation
        ? t(uiLang, 'credit-sensitive 약세는 보이지만, 전체 시장 확인은 아직 진행 중입니다.', 'Credit-sensitive weakness is visible, but full market-wide confirmation is still developing.')
        : t(uiLang, 'credit-sensitive 영역이 전체 시장 확인보다 먼저 약화되고 있습니다.', 'Credit-sensitive areas are weakening before full market-wide confirmation.'),
      t(uiLang, `이 구간은 defensive bias와 ${confidence}를 동반한 watch phase를 시사합니다.`, `This points to a watch phase with defensive bias and ${confidence}.`),
    ],
    forwardNarrativeLine: (_, uiLang) => t(uiLang, '단기 움직임은 안정적으로 보일 수 있지만, 압력이 이어지면 구조는 추가 악화에 취약합니다.', 'Short-term moves may appear stable, but the structure is vulnerable to further deterioration if pressure continues.'),
    subtext: STANDARD_INTERPRETATION_SUBTEXT,
  },
  shock_not_confirmed: {
    summaryLine: (_, uiLang) => t(uiLang, '내부 압력은 보이지만, active external shock은 아직 확인되지 않았습니다.', 'Internal pressure is visible, but no active external shock is confirmed.'),
    detailLines: ({ currentRegime, alignmentDescriptor: alignment, confidenceDescriptor: confidence }, uiLang) => [
      t(uiLang, `${currentRegime}이 주요 배경이며, 시장 전반의 확인은 아직 넓지 않습니다.`, `${currentRegime} remains the main backdrop while confirmation is not yet broad across the market.`),
      t(uiLang, `이 구간은 ${alignment}과 ${confidence} 수준의 watch입니다.`, `This is a watch condition with ${alignment} and ${confidence}.`),
    ],
    forwardNarrativeLine: (_, uiLang) => t(uiLang, '단기 조건은 안정적으로 유지되지만, 표면 아래에서 압력 신호가 쌓이고 있습니다.', 'Near-term conditions remain stable, but early signs of pressure are building beneath the surface.'),
    subtext: STANDARD_INTERPRETATION_SUBTEXT,
  },
  defensive_bias_active: {
    summaryLine: (_, uiLang) => t(uiLang, '하방 압력은 광범위하게 확인되었고, defensive bias가 활성화되어 있습니다.', 'Downside pressure is broadly confirmed, and a defensive bias is active.'),
    detailLines: ({ currentRegime, hasCreditConfirmation, alignmentDescriptor: alignment, confidenceDescriptor: confidence }, uiLang) => [
      hasCreditConfirmation
        ? t(uiLang, 'credit-sensitive 약세가 확인되었고, 더 이상 초기 내부 신호에만 국한되지 않습니다.', 'Credit-sensitive weakness is confirmed and no longer limited to early internal signals.')
        : t(uiLang, `${currentRegime}이 지배적 배경이며, 압력은 더 이상 좁은 신호 집합에만 머물지 않습니다.`, `${currentRegime} remains the dominant backdrop, with pressure no longer confined to a narrow signal set.`),
      t(uiLang, `정렬은 ${alignment}이며, 신뢰도는 ${confidence.replace(' confidence', '')} 수준입니다.`, `Alignment is ${alignment}, and confidence remains ${confidence.replace(' confidence', '')}.`),
    ],
    forwardNarrativeLine: (_, uiLang) => t(uiLang, '하방 시나리오는 여전히 유효하며, 지속적 회복이 형성되기 전까지 안정화에는 시간이 걸릴 수 있습니다.', 'Downside scenarios remain active, and stabilization may take time before a sustained recovery can form.'),
    subtext: STANDARD_INTERPRETATION_SUBTEXT,
  },
  stabilizing_but_unconfirmed: {
    summaryLine: (_, uiLang) => t(uiLang, '안정화 신호가 보이지만, confirmation은 아직 제한적입니다.', 'Stabilization is appearing, but confirmation is still limited.'),
    detailLines: ({ currentRegime, confidenceDescriptor: confidence, alignmentDescriptor: alignment }, uiLang) => [
      currentRegime === 'Expansion'
        ? t(uiLang, '내부 압력은 완화되었지만, 회복 신호는 아직 넓게 확인되지 않습니다.', 'Internal pressure has eased, though the recovery signal is not yet broad enough to confirm.')
        : t(uiLang, `${currentRegime}이 배경으로 남아 있지만, 상황은 다소 안정되는 모습입니다.`, `${currentRegime} remains the backdrop even as conditions appear to steady.`),
      t(uiLang, `이 구간은 ${alignment}과 ${confidence} 수준의 stabilization watch입니다.`, `This is a stabilization watch with ${alignment} and ${confidence}.`),
    ],
    forwardNarrativeLine: (_, uiLang) => t(uiLang, '회복 시도는 나타나고 있지만, 확인은 아직 제한적이며 되돌림 가능성도 남아 있습니다.', 'Recovery attempts are forming, but confirmation is still limited and setbacks remain possible.'),
    subtext: STANDARD_INTERPRETATION_SUBTEXT,
  },
  overlay_unavailable: {
    summaryLine: (_, uiLang) => t(uiLang, '해석 오버레이를 사용할 수 없습니다.', 'Interpretive overlay unavailable.'),
    detailLines: (_, uiLang) => [
      t(uiLang, '기본 엔진은 계속 활성 상태이며, 오늘은 서술 레이어가 생성되지 않았습니다.', 'Base engine remains active; narrative layer not generated today.'),
      t(uiLang, '최종 의사결정은 계속 기본 리스크 엔진을 반영합니다.', 'Final Decision continues to reflect the underlying risk engine.'),
    ],
    subtext: STANDARD_INTERPRETATION_SUBTEXT,
  },
}

export function buildStandardInterpretationDisplayModel(
  input: StandardInterpretationSource,
  uiLang: UiLang = 'en'
): StandardInterpretationDisplayModel {
  if (!hasStandardInterpretationSource(input)) {
    const template = STANDARD_NARRATIVE_TEMPLATES.overlay_unavailable
    const fallbackContext: StandardTemplateContext = {
      currentRegime: normalizeRegime(input.market_regime?.regime),
      alignmentDescriptor: 'mixed alignment',
      confidenceDescriptor: 'limited confidence',
      mode: input.master_signal?.mode ?? 'ALL_CLEAR',
      hasEarlySignal: false,
      hasBroadDivergence: false,
      hasCreditConfirmation: false,
    }
    return {
      summaryLine: template.summaryLine(fallbackContext, uiLang),
      detailLines: template.detailLines(fallbackContext, uiLang),
      forwardNarrativeLine: template.forwardNarrativeLine?.(fallbackContext, uiLang),
      interpretationState: 'UNAVAILABLE',
      currentRegime: fallbackContext.currentRegime,
      agreementScore: Number.NaN,
      conflictScore: Number.NaN,
      trustScore: Number.NaN,
      subtext: template.subtext?.(uiLang),
      isFallback: true,
    }
  }

  const currentRegime = normalizeRegime(input.market_regime?.regime)
  const rule = rulePressure(input)
  const regime = regimePressure(currentRegime)
  const scenario = scenarioPressure(input.risk_scenario?.scenario)
  const agreementScore = buildAgreementScore(input, rule, regime, scenario)
  const conflictScore = buildConflictScore(input, rule, regime, scenario, agreementScore)
  const trustScore = buildTrustScore(input, agreementScore, conflictScore)
  const rawInterpretationState = buildInterpretationState(input, currentRegime)
  const narrativeState = buildNarrativeState(input, currentRegime, rawInterpretationState)
  const templateKey = selectTemplateKey(narrativeState, input, currentRegime)
  const template = STANDARD_NARRATIVE_TEMPLATES[templateKey]
  const forwardNarrativeCategory = buildForwardNarrativeCategory(
    narrativeState,
    currentRegime,
    agreementScore,
    conflictScore,
    trustScore
  )
  const templateContext: StandardTemplateContext = {
    currentRegime,
    alignmentDescriptor: alignmentDescriptor(agreementScore, conflictScore, uiLang),
    confidenceDescriptor: confidenceDescriptor(trustScore, uiLang),
    mode: input.master_signal?.mode ?? 'ALL_CLEAR',
    hasEarlySignal: (input.track_a_early?.state ?? 'Normal') !== 'Normal',
    hasBroadDivergence: Boolean(input.breadth?.divergence),
    hasCreditConfirmation: Boolean(input.track_a?.stage0),
  }

  return {
    summaryLine: template.summaryLine(templateContext, uiLang),
    detailLines: template.detailLines(templateContext, uiLang),
    forwardNarrativeLine:
      buildForwardNarrativeLine(narrativeState, forwardNarrativeCategory, uiLang) ??
      template.forwardNarrativeLine?.(templateContext, uiLang),
    interpretationState: narrativeState,
    currentRegime,
    agreementScore,
    conflictScore,
    trustScore,
    subtext: template.subtext?.(uiLang),
    isFallback: false,
  }
}
