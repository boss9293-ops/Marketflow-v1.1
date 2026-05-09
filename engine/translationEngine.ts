export type EngineOutput = {
  breadth:           'strong' | 'neutral' | 'weak'
  momentum:          'strong' | 'neutral' | 'weak'
  correlation:       'rising' | 'stable' | 'falling'
  map:               'strong' | 'neutral' | 'weak'
  ai_concentration:  'high' | 'medium' | 'low'
  cycle_stage:       'early' | 'expansion' | 'peak' | 'downturn'
  conflict_mode:     'none' | 'mild' | 'strong'
  confidence:        'high' | 'medium' | 'low'
  data_quality:      'high' | 'medium' | 'low'
  historical_analog: { distance: number; label: string }
}

export type InterpretationOutput = {
  summary:        string
  alignment:      string
  support:        string[]
  weakness:       string[]
  interpretation: string
  context?:       string
  confidence:     string
}

export type SignalMeaningMap = {
  breadth:          string
  momentum:         string
  correlation:      string
  map:              string
  ai_concentration: string
  cycle_stage:      string
}

// ── Mapping dictionaries ──────────────────────────────────────────────────────

const BREADTH_MAP: Record<EngineOutput['breadth'], string> = {
  strong:  'broad participation',
  neutral: 'moderate participation',
  weak:    'narrow participation',
}

const MOMENTUM_MAP: Record<EngineOutput['momentum'], string> = {
  strong:  'persistent price strength',
  neutral: 'limited price persistence',
  weak:    'weakening price structure',
}

const CORRELATION_MAP: Record<EngineOutput['correlation'], string> = {
  rising:  'reduced diversification',
  stable:  'stable diversification conditions',
  falling: 'improving diversification',
}

const MAP_SIGNAL_MAP: Record<EngineOutput['map'], string> = {
  strong:  'stable market structure',
  neutral: 'transitional market structure',
  weak:    'unstable market structure',
}

const AI_CONCENTRATION_MAP: Record<EngineOutput['ai_concentration'], string> = {
  high:   'concentrated AI infrastructure leadership',
  medium: 'moderately distributed AI infrastructure leadership',
  low:    'broadly distributed AI infrastructure leadership',
}

const CYCLE_STAGE_MAP: Record<EngineOutput['cycle_stage'], string> = {
  early:     'early-phase structure',
  expansion: 'expansion-phase structure',
  peak:      'late-stage structure',
  downturn:  'contraction-phase structure',
}

// ── Helper ────────────────────────────────────────────────────────────────────

export function mapSignals(input: EngineOutput): SignalMeaningMap {
  return {
    breadth:          BREADTH_MAP[input.breadth],
    momentum:         MOMENTUM_MAP[input.momentum],
    correlation:      CORRELATION_MAP[input.correlation],
    map:              MAP_SIGNAL_MAP[input.map],
    ai_concentration: AI_CONCENTRATION_MAP[input.ai_concentration],
    cycle_stage:      CYCLE_STAGE_MAP[input.cycle_stage],
  }
}

// ── Alignment detection ───────────────────────────────────────────────────────

export type AlignmentResult = {
  alignment: 'Aligned' | 'Mixed' | 'Divergent'
  severity:  'None' | 'Mild' | 'Structural'
  reason:    string
}

export function detectAlignment(input: EngineOutput): AlignmentResult {
  const { breadth, momentum, correlation, map, ai_concentration } = input

  // Divergent — any structural conflict pair fires
  const divergentPairs: Array<[boolean, string]> = [
    [momentum === 'strong' && breadth === 'weak',
     'Momentum remains strong while breadth is weak.'],
    [breadth === 'weak' && correlation === 'rising',
     'Breadth is narrow while correlation is rising, compressing diversification.'],
    [ai_concentration === 'high' && breadth === 'weak',
     'AI concentration is elevated while broad participation is absent.'],
    [map === 'weak' && momentum === 'strong',
     'Market structure is unstable despite persistent momentum.'],
  ]

  for (const [cond, reason] of divergentPairs) {
    if (cond) return { alignment: 'Divergent', severity: 'Structural', reason }
  }

  // Mixed — partial mismatch without full structural conflict
  const mixedPairs: Array<[boolean, string]> = [
    [momentum === 'strong' && breadth !== 'strong',
     'Signals are partially aligned — momentum is strong but participation is not broadly confirmed.'],
    [map === 'neutral' && momentum === 'strong',
     'Momentum is strong but market structure remains transitional rather than fully supportive.'],
    [ai_concentration === 'high' && breadth !== 'weak',
     'AI concentration is elevated while participation remains at moderate levels.'],
  ]

  for (const [cond, reason] of mixedPairs) {
    if (cond) return { alignment: 'Mixed', severity: 'Mild', reason }
  }

  return {
    alignment: 'Aligned',
    severity:  'None',
    reason:    'Breadth, momentum, and market structure are pointing in the same structural direction.',
  }
}

// ── Structural interpretation ─────────────────────────────────────────────────

export type StructuralInterpretation = {
  structure: string    // WHAT (1 sentence)
  cause:     string    // WHY  (1 sentence)
  support:   string[]  // max 2
  weakness:  string[]  // max 2
}

const CYCLE_CLAUSE: Record<EngineOutput['cycle_stage'], string> = {
  early:     ' within an early-phase context',
  expansion: ' within an expansion phase',
  peak:      ' within a late-stage structure',
  downturn:  ' within a contraction phase',
}

function join(items: string[]): string {
  return items.length === 2 ? `${items[0]} and ${items[1]}` : items[0] ?? ''
}

function selectSupportWeakness(
  input:    EngineOutput,
  meanings: SignalMeaningMap,
): { support: string[]; weakness: string[] } {
  const support: string[] = []
  if (input.breadth   === 'strong') support.push(meanings.breadth)
  if (input.map       === 'strong') support.push(meanings.map)
  if (input.momentum  === 'strong' && support.length < 2) support.push(meanings.momentum)

  const weakness: string[] = []
  if (input.breadth          === 'weak'   ) weakness.push(meanings.breadth)
  if (input.map              === 'weak'   ) weakness.push(meanings.map)
  if (input.correlation      === 'rising'  && weakness.length < 2) weakness.push(meanings.correlation)
  if (input.ai_concentration === 'high'   && weakness.length < 2) weakness.push(meanings.ai_concentration)

  return { support: support.slice(0, 2), weakness: weakness.slice(0, 2) }
}

export function buildStructuralInterpretation(
  input:           EngineOutput,
  meanings:        SignalMeaningMap,
  alignmentResult: AlignmentResult,
): StructuralInterpretation {
  const { support, weakness } = selectSupportWeakness(input, meanings)

  // WHAT — structure statement
  const baseStatement =
    alignmentResult.alignment === 'Aligned'   ? 'The structure is broadly supported, while constraints remain limited'   :
    alignmentResult.alignment === 'Mixed'     ? 'The structure is partially supported, while key constraints limit full participation' :
                                                'The structure is internally inconsistent, while key signals contradict each other'

  const structure = baseStatement + CYCLE_CLAUSE[input.cycle_stage] + '.'

  // WHY — causal explanation
  const cause = weakness.length > 0
    ? `This is driven by ${join(support)}, while ${join(weakness)}.`
    : `This is driven by ${join(support)}.`

  return { structure, cause, support, weakness }
}

// ── Main function ─────────────────────────────────────────────────────────────

const STRUCTURAL_BEHAVIOR: Record<AlignmentResult['alignment'], string> = {
  Aligned:   'broad structural support and consistent participation',
  Mixed:     'partial support with uneven participation across segments',
  Divergent: 'narrow leadership and conflicting internal signals',
}

export function translateEngineOutput(input: EngineOutput): InterpretationOutput {
  const meanings        = mapSignals(input)
  const alignmentResult = detectAlignment(input)
  const structural      = buildStructuralInterpretation(input, meanings, alignmentResult)

  // context — historical analog
  const context: string | undefined = input.historical_analog.distance < 0.35
    ? `This setup is historically similar to ${input.historical_analog.label}. Historically similar setups showed ${STRUCTURAL_BEHAVIOR[alignmentResult.alignment]}.`
    : undefined

  // confidence
  const confLevel: 'high' | 'medium' | 'low' =
    alignmentResult.alignment === 'Aligned' && input.data_quality === 'high' ? 'high'   :
    alignmentResult.alignment === 'Divergent' || input.data_quality === 'low' ? 'low'   : 'medium'

  const confReason =
    confLevel === 'high'   ? 'signals are aligned and data quality is strong'                      :
    confLevel === 'medium' ? 'signals are partially aligned with some constraints present'          :
                             'core signals are in conflict or data quality is limited'

  const confidence = `Interpretation confidence is ${confLevel}, because ${confReason}.`

  return {
    summary:        structural.structure,
    alignment:      `Signal alignment is ${alignmentResult.alignment}, because ${alignmentResult.reason}`,
    support:        structural.support,
    weakness:       structural.weakness,
    interpretation: `${structural.structure} ${structural.cause}`,
    context,
    confidence,
  }
}
