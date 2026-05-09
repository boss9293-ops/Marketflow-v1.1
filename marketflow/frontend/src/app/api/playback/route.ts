import path            from 'path'
import fs              from 'fs'
import { NextResponse } from 'next/server'

type TimelinePoint = {
  date: string; cycleDay: number; stage: string
  breadth: string; momentum: string; map: string; conflict: string
}

function vrStateToStage(state: string, regime: string): string {
  if (state === 'High Risk' || state === 'Crisis') return 'Trough'
  if (state === 'Warning')   return 'Contraction'
  if (state === 'Caution')   return 'Contraction Watch'
  if (regime === 'Liquidity Crisis') return 'Contraction'
  return 'Expansion'
}

function loadReplayTimeline(file: string): TimelinePoint[] | null {
  const candidates = [
    path.join(process.cwd(), '..', 'backend', 'output', 'replay', file),
    path.join(process.cwd(), 'backend', 'output', 'replay', file),
  ]
  const p = candidates.find(c => fs.existsSync(c))
  if (!p) return null
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8'))
    const snaps: Array<{
      date: string; state: string; regime: string
      mss: number; total_risk: number; crisis_stage_label: string
    }> = raw.snapshots ?? []
    if (!snaps.length) return null
    // Sample ~every 22 trading days (≈monthly) for readable display
    const step = Math.max(1, Math.floor(snaps.length / 11))
    const sampled = snaps.filter((_, i) => i % step === 0)
    return sampled.map((s, i) => ({
      date:      s.date,
      cycleDay:  i * step + 1,
      stage:     vrStateToStage(s.state, s.regime),
      breadth:   s.mss >= 100 ? 'Broad' : s.mss >= 92 ? 'Mixed' : 'Narrow',
      momentum:  s.total_risk < 20 ? 'Strong' : s.total_risk < 45 ? 'Neutral' : 'Weak',
      map:       s.regime === 'Liquidity Crisis' ? 'Unstable' : 'Stable',
      conflict:  s.crisis_stage_label === 'Normal' ? 'None' : s.crisis_stage_label,
    }))
  } catch { return null }
}

const PERIODS = [
  {
    id: 'ai_expansion_2024',
    label: '2024 AI Infrastructure Expansion',
    startDate: '2024-01-01',
    endDate: '2024-07-31',
    cycleStage: 'expansion',
    regime_label: 'AI_LED_NARROW',
    description: 'AI infrastructure leadership with broad semiconductor participation.',
  },
  {
    id: 'contraction_2022',
    label: '2022 Semiconductor Contraction',
    startDate: '2022-01-01',
    endDate: '2022-12-31',
    cycleStage: 'downturn',
    regime_label: 'CONTRACTION',
    description: 'Broad semiconductor weakness during tightening liquidity conditions.',
  },
  {
    id: 'recovery_2020',
    label: '2020 Post-Shock Recovery',
    startDate: '2020-04-01',
    endDate: '2020-12-31',
    cycleStage: 'early',
    regime_label: 'BROAD_RECOVERY',
    description: 'Early recovery structure following the liquidity shock.',
  },
]

function aiExpansionSeries() {
  const pts = [
    { date: 'Jan 24', soxx: 100, aiInfra: 100, memory: 100, foundry: 100, equipment: 100 },
    { date: 'Feb 24', soxx: 108, aiInfra: 115, memory: 102, foundry: 105, equipment: 104 },
    { date: 'Mar 24', soxx: 115, aiInfra: 128, memory: 108, foundry: 110, equipment: 109 },
    { date: 'Apr 24', soxx: 122, aiInfra: 140, memory: 110, foundry: 115, equipment: 113 },
    { date: 'May 24', soxx: 118, aiInfra: 138, memory: 107, foundry: 112, equipment: 111 },
    { date: 'Jun 24', soxx: 125, aiInfra: 148, memory: 112, foundry: 118, equipment: 115 },
    { date: 'Jul 24', soxx: 128, aiInfra: 155, memory: 116, foundry: 120, equipment: 118 },
  ]
  return pts
}

function contractionSeries() {
  const pts = [
    { date: 'Jan 22', soxx: 100, aiInfra: 100, memory: 100, foundry: 100, equipment: 100 },
    { date: 'Mar 22', soxx: 88,  aiInfra: 90,  memory: 82,  foundry: 92,  equipment: 88  },
    { date: 'May 22', soxx: 80,  aiInfra: 85,  memory: 68,  foundry: 86,  equipment: 82  },
    { date: 'Jul 22', soxx: 72,  aiInfra: 80,  memory: 55,  foundry: 80,  equipment: 74  },
    { date: 'Sep 22', soxx: 68,  aiInfra: 78,  memory: 48,  foundry: 78,  equipment: 70  },
    { date: 'Nov 22', soxx: 65,  aiInfra: 76,  memory: 44,  foundry: 77,  equipment: 68  },
    { date: 'Dec 22', soxx: 67,  aiInfra: 78,  memory: 46,  foundry: 80,  equipment: 70  },
  ]
  return pts
}

function recoverySeries() {
  const pts = [
    { date: 'Apr 20', soxx: 100, aiInfra: 100, memory: 100, foundry: 100, equipment: 100 },
    { date: 'May 20', soxx: 118, aiInfra: 122, memory: 112, foundry: 110, equipment: 114 },
    { date: 'Jun 20', soxx: 130, aiInfra: 138, memory: 120, foundry: 118, equipment: 124 },
    { date: 'Jul 20', soxx: 145, aiInfra: 158, memory: 132, foundry: 128, equipment: 136 },
    { date: 'Aug 20', soxx: 155, aiInfra: 170, memory: 140, foundry: 135, equipment: 145 },
    { date: 'Sep 20', soxx: 150, aiInfra: 165, memory: 138, foundry: 132, equipment: 142 },
    { date: 'Oct 20', soxx: 160, aiInfra: 178, memory: 148, foundry: 140, equipment: 152 },
    { date: 'Nov 20', soxx: 170, aiInfra: 190, memory: 158, foundry: 148, equipment: 162 },
    { date: 'Dec 20', soxx: 185, aiInfra: 205, memory: 170, foundry: 158, equipment: 175 },
  ]
  return pts
}

function aiExpansionTimeline() {
  return [
    { date: 'Jan 24', cycleDay: 1,   stage: 'Expansion',     breadth: 'Broad',   momentum: 'Strong',  map: 'Stable',       conflict: 'None' },
    { date: 'Feb 24', cycleDay: 22,  stage: 'Expansion',     breadth: 'Broad',   momentum: 'Strong',  map: 'Stable',       conflict: 'None' },
    { date: 'Mar 24', cycleDay: 44,  stage: 'Expansion',     breadth: 'Broad',   momentum: 'Strong',  map: 'Stable',       conflict: 'None' },
    { date: 'Apr 24', cycleDay: 65,  stage: 'Mid Expansion', breadth: 'Broad',   momentum: 'Strong',  map: 'Stable',       conflict: 'AI Distortion' },
    { date: 'May 24', cycleDay: 87,  stage: 'Mid Expansion', breadth: 'Mixed',   momentum: 'Neutral', map: 'Transitional', conflict: 'AI Distortion' },
    { date: 'Jun 24', cycleDay: 108, stage: 'Mid Expansion', breadth: 'Broad',   momentum: 'Strong',  map: 'Stable',       conflict: 'None' },
    { date: 'Jul 24', cycleDay: 130, stage: 'Mid Expansion', breadth: 'Broad',   momentum: 'Strong',  map: 'Stable',       conflict: 'None' },
  ]
}

function contractionTimeline() {
  return [
    { date: 'Jan 22', cycleDay: 1,   stage: 'Peak',        breadth: 'Mixed',  momentum: 'Weak',    map: 'Transitional', conflict: 'Momentum Div' },
    { date: 'Mar 22', cycleDay: 44,  stage: 'Contraction', breadth: 'Narrow', momentum: 'Weak',    map: 'Unstable',     conflict: 'None' },
    { date: 'May 22', cycleDay: 86,  stage: 'Contraction', breadth: 'Narrow', momentum: 'Weak',    map: 'Unstable',     conflict: 'None' },
    { date: 'Jul 22', cycleDay: 128, stage: 'Contraction', breadth: 'Narrow', momentum: 'Weak',    map: 'Unstable',     conflict: 'None' },
    { date: 'Sep 22', cycleDay: 170, stage: 'Contraction', breadth: 'Narrow', momentum: 'Weak',    map: 'Unstable',     conflict: 'None' },
    { date: 'Nov 22', cycleDay: 212, stage: 'Trough',      breadth: 'Narrow', momentum: 'Neutral', map: 'Stabilizing',  conflict: 'None' },
    { date: 'Dec 22', cycleDay: 234, stage: 'Trough',      breadth: 'Mixed',  momentum: 'Neutral', map: 'Stabilizing',  conflict: 'None' },
  ]
}

function recoveryTimeline() {
  return [
    { date: 'Apr 20', cycleDay: 1,   stage: 'Early Cycle', breadth: 'Mixed',  momentum: 'Neutral', map: 'Transitional', conflict: 'None' },
    { date: 'May 20', cycleDay: 22,  stage: 'Early Cycle', breadth: 'Mixed',  momentum: 'Strong',  map: 'Transitional', conflict: 'None' },
    { date: 'Jun 20', cycleDay: 44,  stage: 'Early Cycle', breadth: 'Broad',  momentum: 'Strong',  map: 'Stable',       conflict: 'None' },
    { date: 'Jul 20', cycleDay: 65,  stage: 'Recovery',    breadth: 'Broad',  momentum: 'Strong',  map: 'Stable',       conflict: 'None' },
    { date: 'Aug 20', cycleDay: 87,  stage: 'Recovery',    breadth: 'Broad',  momentum: 'Strong',  map: 'Stable',       conflict: 'None' },
    { date: 'Sep 20', cycleDay: 108, stage: 'Recovery',    breadth: 'Broad',  momentum: 'Neutral', map: 'Transitional', conflict: 'Momentum Div' },
    { date: 'Oct 20', cycleDay: 130, stage: 'Recovery',    breadth: 'Broad',  momentum: 'Strong',  map: 'Stable',       conflict: 'None' },
    { date: 'Nov 20', cycleDay: 152, stage: 'Expansion',   breadth: 'Broad',  momentum: 'Strong',  map: 'Stable',       conflict: 'None' },
    { date: 'Dec 20', cycleDay: 173, stage: 'Expansion',   breadth: 'Broad',  momentum: 'Strong',  map: 'Stable',       conflict: 'None' },
  ]
}

const PERIOD_DATA: Record<string, {
  series: object[]; timeline: object[]
  interpretation: {
    summary: string; alignment: string; support: string[]; weakness: string[]
    interpretation: string; context: string; confidence: string
  }
}> = {
  ai_expansion_2024: {
    series: aiExpansionSeries(),
    timeline: aiExpansionTimeline(),
    interpretation: {
      summary: 'Broad semiconductor participation is supporting the expansion structure, driven by AI infrastructure leadership with elevated concentration.',
      alignment: 'Mixed',
      support: [
        'Price strength is persistent across the period',
        'Broad participation confirmed across most segments',
        'AI Infra leadership is sustained throughout',
      ],
      weakness: [
        'Leadership is concentrated in few names',
        'Concentration risk elevated above historical threshold',
      ],
      interpretation: 'The structure is partially supported within an expansion phase, while concentrated AI leadership and elevated concentration limit full structural confirmation. This is driven by persistent momentum and stable market structure, while participation remains broad but concentration is elevated.',
      context: 'Historically similar to mid-cycle periods where strong momentum and structure coexisted with concentrated leadership and unconfirmed participation across all segments. Historically similar setups showed continued momentum in leading segments while broader participation lagged the structural advance.',
      confidence: 'Medium',
    },
  },
  contraction_2022: {
    series: contractionSeries(),
    timeline: contractionTimeline(),
    interpretation: {
      summary: 'All primary signals confirm broad structural deterioration — participation, momentum, and market structure are aligned in decline within a contraction phase.',
      alignment: 'Aligned',
      support: ['Leadership broadly distributed — no dominant concentration'],
      weakness: [
        'Narrow participation across all segments',
        'Structure is unstable throughout the period',
        'Momentum is weakening across all measures',
        'Diversification is weakening — rising correlation',
      ],
      interpretation: 'The structure is deteriorating broadly within a contraction phase, while all primary signals confirm the structural decline. This is driven by narrow participation and unstable market structure, while weakening momentum and rising correlation reinforce the structural decline.',
      context: 'Historically similar to broad contraction phases where participation, momentum, and structure deteriorated simultaneously while diversification conditions weakened. Historically similar setups showed broad-based structural weakness until participation and market structure stabilized.',
      confidence: 'Low',
    },
  },
  recovery_2020: {
    series: recoverySeries(),
    timeline: recoveryTimeline(),
    interpretation: {
      summary: 'Structure is transitioning from early recovery to expansion, while participation is broadening and momentum is confirming directional support.',
      alignment: 'Mixed',
      support: [
        'Price strength is persistent and broadening',
        'Participation confirming across multiple segments',
        'Diversification conditions are improving',
      ],
      weakness: [
        'Structure remains transitional in the early phase',
        'Participation not yet fully confirmed across all segments',
      ],
      interpretation: 'The structure is recovering within an early expansion phase, while participation is broadening and momentum conditions are confirming the directional shift. This is driven by improving breadth and persistent momentum, while market structure remains in transition and not yet fully stable.',
      context: 'Historically similar to early recovery structures following liquidity shocks where participation broadened progressively with momentum confirming the structural shift. Historically similar setups showed continued breadth improvement as the cycle transitioned from early to mid-expansion.',
      confidence: 'Medium',
    },
  },
}

export async function GET() {
  try {
    const realTimeline = loadReplayTimeline('2022_tightening.json')
    const hasRealTimeline = realTimeline !== null

    const periodData = {
      ...PERIOD_DATA,
      contraction_2022: {
        ...PERIOD_DATA.contraction_2022,
        timeline: hasRealTimeline ? realTimeline : PERIOD_DATA.contraction_2022.timeline,
      },
    }

    return NextResponse.json({
      periods: PERIODS,
      periodData,
      dataStatus: {
        source: hasRealTimeline ? 'snapshot' : 'fallback',
        note: hasRealTimeline
          ? 'The 2022 Contraction period uses real VR engine replay data. This period is shown as a legacy stress reference, not as a direct AI-regime analog.'
          : 'Historical period data is based on a static fallback dataset. Real-time engine backfill is in development.',
        missing: ['bucket_series'],
      },
    })
  } catch (err) {
    console.error('[/api/playback]', err)
    return NextResponse.json({
      error: 'DATA_UNAVAILABLE',
      message: 'Playback data is unavailable.',
      dataStatus: { source: 'unavailable', note: 'Playback data could not be loaded.' },
    }, { status: 503 })
  }
}
