import path            from 'path'
import fs              from 'fs'
import { NextResponse } from 'next/server'

import type { MarketDataInput, MacroSnapshot } from '@/lib/semiconductor/types'
import { DEFAULT_MACRO }        from '@/lib/semiconductor/types'
import { normalizeMetrics }     from '@/lib/semiconductor/normalizeMetrics'
import { computeDomainScores }  from '@/lib/semiconductor/domainScores'
import { computeEngineScore }   from '@/lib/semiconductor/engineScore'
import { computeConfidence }    from '@/lib/semiconductor/confidenceScore'
import { translateEngineOutput } from '@/lib/semiconductor/interpretationEngine'
import type { EngineOutput }    from '@/lib/semiconductor/interpretationEngine'
import { computeAIRegimeLens }  from '@/lib/semiconductor/aiRegimeLens'

const DATA_CANDIDATES = [
  path.join(process.cwd(), '..', 'backend', 'output', 'cache', 'semiconductor_market_data.json'),
  path.join(process.cwd(), 'backend', 'output', 'cache', 'semiconductor_market_data.json'),
  path.join(process.cwd(), '..', 'backend', 'output', 'semiconductor_mvp_latest.json'),
  path.join(process.cwd(), 'backend', 'output', 'semiconductor_mvp_latest.json'),
]

function signal3(s: number): 'strong' | 'neutral' | 'weak' {
  return s > 20 ? 'strong' : s < -20 ? 'weak' : 'neutral'
}
function getMetricVal(metrics: ReturnType<typeof normalizeMetrics>, id: string): number {
  return metrics.find(m => m.id === id)?.signal_value ?? 0
}
function getNormVal(metrics: ReturnType<typeof normalizeMetrics>, id: string): number {
  return metrics.find(m => m.id === id)?.normalized_value ?? 50
}

// ── Delta computation ─────────────────────────────────────────────────────────

type Amplification = 'low' | 'medium' | 'high'

function computeDelta(e: EngineOutput): {
  amplification: Amplification
  sensitivity:   string[]
  constraint:    string
  explanation:   string
} {
  // Sensitivity factors
  const sensitivity: string[] = []
  if (e.breadth      === 'weak'    || e.breadth      === 'neutral') sensitivity.push('breadth')
  if (e.correlation  === 'rising')                                   sensitivity.push('correlation')
  if (e.map          === 'weak'    || e.map          === 'neutral')  sensitivity.push('map')
  if (e.ai_concentration === 'high')                                 sensitivity.push('ai concentration')

  // Amplification level — high takes priority
  let amplification: Amplification
  if (e.breadth === 'weak' || e.correlation === 'rising' || e.map === 'weak') {
    amplification = 'high'
  } else if (e.breadth === 'neutral' || e.map === 'neutral' || e.ai_concentration === 'high') {
    amplification = 'medium'
  } else {
    amplification = 'low'
  }

  const constraintMap: Record<Amplification, string> = {
    high:   'Weak participation, rising correlation, or unstable structure can elevate daily amplification sensitivity.',
    medium: 'Partial breadth or concentration constraints limit the quality of the daily sensitivity interpretation.',
    low:    'No major structural constraints detected in the base structure.',
  }

  const explanationMap: Record<Amplification, string> = {
    high:   'SOXL daily sensitivity is elevated because weak participation, unstable structure, or rising correlation can amplify SOXX moves.',
    medium: 'SOXL daily sensitivity is moderate because the base structure is not fully broad across participation or concentration signals.',
    low:    'SOXL daily sensitivity appears contained because the base semiconductor structure is broad and internally consistent.',
  }

  return {
    amplification,
    sensitivity: sensitivity.slice(0, 3),
    constraint:  constraintMap[amplification],
    explanation: explanationMap[amplification],
  }
}

// ── Watch conditions ──────────────────────────────────────────────────────────

function computeWatch(e: EngineOutput): string[] {
  const items: string[] = []
  if (e.breadth !== 'strong')         items.push('Breadth deterioration reduces translation quality.')
  if (e.correlation !== 'falling')    items.push('Rising correlation increases SOXL sensitivity.')
  if (e.map !== 'strong')             items.push('MAP instability lowers interpretation confidence.')
  if (e.ai_concentration === 'high')  items.push('AI concentration at elevated levels — equal-weight participation required for durability.')
  items.push('Structural watch conditions are updated on each daily data refresh.')
  return items.slice(0, 3)
}

// ── Translation summary ───────────────────────────────────────────────────────

function translationSummary(amp: Amplification): string {
  if (amp === 'low')    return 'SOXL daily sensitivity appears contained relative to SOXX structure; multi-day outcomes remain path-dependent.'
  if (amp === 'medium') return 'SOXL daily sensitivity is moderate relative to SOXX structure; partial constraints limit interpretation quality.'
  return 'SOXL daily sensitivity is elevated relative to SOXX structure; weak participation or rising correlation can amplify daily moves.'
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET() {
  try {
    let raw: MarketDataInput | null = null
    let loadedFrom = ''
    for (const p of DATA_CANDIDATES) {
      if (fs.existsSync(p)) {
        try { raw = JSON.parse(fs.readFileSync(p, 'utf-8')); loadedFrom = p } catch { /* skip */ }
        if (raw) break
      }
    }
    if (!raw) return NextResponse.json({
      error: 'DATA_UNAVAILABLE',
      message: 'Semiconductor data is unavailable.',
      dataStatus: { source: 'unavailable', note: 'Required data source could not be loaded.' },
    }, { status: 503 })

    const macro: MacroSnapshot = DEFAULT_MACRO
    const metrics = normalizeMetrics(raw, macro)
    const domains = computeDomainScores(metrics)
    const engine  = computeEngineScore(domains, metrics)
    const conf    = computeConfidence(metrics, domains, engine.conflict_type)

    const ewVsCw = getMetricVal(metrics, 'equal_weight_vs_cap_spread')
    const correlation: EngineOutput['correlation'] =
      ewVsCw < -20 ? 'rising' : ewVsCw > 10 ? 'falling' : 'stable'

    const cycleStateMap: Record<string, EngineOutput['cycle_stage']> = {
      'Trough': 'early', 'Recovery': 'early', 'Expansion': 'expansion',
      'Late Expansion': 'peak', 'Peak Risk': 'peak', 'Contraction': 'downturn',
    }
    const conflictMap: Record<string, EngineOutput['conflict_mode']> = {
      'NO_CONFLICT': 'none', 'MULTIPLE_CONFLICTS': 'strong',
    }
    const confLabelMap: Record<string, EngineOutput['confidence']> = {
      High: 'high', Medium: 'medium', Low: 'low',
    }

    const dqScore = conf.components.data_quality
    const dataQuality: EngineOutput['data_quality'] =
      dqScore >= 70 ? 'high' : dqScore >= 40 ? 'medium' : 'low'

    const top5 = getNormVal(metrics, 'leader_concentration_top5')
    const aiConcentration: EngineOutput['ai_concentration'] =
      top5 >= 75 ? 'high' : top5 >= 50 ? 'medium' : 'low'

    const engineInput: EngineOutput = {
      breadth:           signal3(domains.breadth.signal),
      momentum:          signal3(domains.momentum.signal),
      correlation,
      map:               engine.engine_score >= 60 ? 'strong' : engine.engine_score <= 40 ? 'weak' : 'neutral',
      ai_concentration:  aiConcentration,
      cycle_stage:       cycleStateMap[engine.state] ?? 'expansion',
      conflict_mode:     conflictMap[engine.conflict_type] ?? 'none',
      confidence:        confLabelMap[conf.confidence_label] ?? 'medium',
      data_quality:      dataQuality,
      historical_analog: { distance: 0.99, label: '' },
    }

    const aiRegime = computeAIRegimeLens(raw)
    const base  = translateEngineOutput({ ...engineInput, ai_regime: aiRegime })
    const delta = computeDelta(engineInput)
    const watch = computeWatch(engineInput)

    const isCachePath = loadedFrom.includes('cache')
    return NextResponse.json({
      base,
      summary:   translationSummary(delta.amplification),
      soxl_note: 'SOXL seeks daily 3x exposure; this lens interprets daily sensitivity from SOXX structure, not long-term 3x bucket attribution.',
      delta,
      watch,
      ai_regime: aiRegime,
      dataStatus: {
        source: isCachePath ? 'snapshot' : 'fallback',
        note:   isCachePath
          ? 'Semiconductor engine data loaded from cache.'
          : 'Fallback snapshot data is displayed.',
      },
      _meta: {
        as_of:        raw.as_of,
        state:        engine.state,
        conflict:     engine.conflict_type,
        engine_score: engine.engine_score,
      },
    })
  } catch (err) {
    console.error('[/api/translation]', err)
    return NextResponse.json({
      error: 'ENGINE_ERROR',
      message: 'Semiconductor translation engine processing failed.',
      dataStatus: { source: 'unavailable', note: 'Engine processing error — no data available.' },
    }, { status: 500 })
  }
}
