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

export async function GET() {
  try {
    // Load market data — try all candidate paths in order
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

    // Run engine pipeline
    const metrics = normalizeMetrics(raw, macro)
    const domains = computeDomainScores(metrics)
    const engine  = computeEngineScore(domains, metrics)
    const conf    = computeConfidence(metrics, domains, engine.conflict_type)

    // Map to EngineOutput
    const ewVsCw = getMetricVal(metrics, 'equal_weight_vs_cap_spread')
    const correlation: EngineOutput['correlation'] =
      ewVsCw < -20 ? 'rising' : ewVsCw > 10 ? 'falling' : 'stable'

    const cycleStateMap: Record<string, EngineOutput['cycle_stage']> = {
      'Trough':         'early',
      'Recovery':       'early',
      'Expansion':      'expansion',
      'Late Expansion': 'peak',
      'Peak Risk':      'peak',
      'Contraction':    'downturn',
    }

    const conflictMap: Record<string, EngineOutput['conflict_mode']> = {
      'NO_CONFLICT':                   'none',
      'AI_DISTORTION':                 'mild',
      'BREADTH_DIVERGENCE':            'mild',
      'MOMENTUM_DIVERGENCE':           'mild',
      'SECTOR_ROTATION':               'mild',
      'MACRO_OVERRIDE':                'mild',
      'VALUATION_STRETCH':             'mild',
      'AI_INFRA_SUSTAINABILITY_RISK':  'mild',
      'MULTIPLE_CONFLICTS':            'strong',
    }

    const confLabelMap: Record<string, EngineOutput['confidence']> = {
      High:   'high',
      Medium: 'medium',
      Low:    'low',
    }

    const dqScore = conf.components.data_quality
    const dataQuality: EngineOutput['data_quality'] =
      dqScore >= 70 ? 'high' : dqScore >= 40 ? 'medium' : 'low'

    const top5 = getNormVal(metrics, 'leader_concentration_top5')
    const aiConcentration: EngineOutput['ai_concentration'] =
      top5 >= 75 ? 'high' : top5 >= 50 ? 'medium' : 'low'

    const aiRegime = computeAIRegimeLens(raw)

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
      ai_regime:         aiRegime,
    }

    const interpretation = translateEngineOutput(engineInput)

    const isCachePath = loadedFrom.includes('cache')
    return NextResponse.json({
      ...interpretation,
      ai_regime: aiRegime,
      dataStatus: {
        source: isCachePath ? 'snapshot' : 'fallback',
        note:   isCachePath
          ? 'Semiconductor engine data loaded from cache.'
          : 'Fallback snapshot data is displayed.',
      },
      _meta: {
        as_of:      raw.as_of,
        state:      engine.state,
        conflict:   engine.conflict_type,
        engine_score: engine.engine_score,
      },
    })
  } catch (err) {
    console.error('[/api/interpretation]', err)
    return NextResponse.json({
      error: 'ENGINE_ERROR',
      message: 'Semiconductor engine processing failed.',
      dataStatus: { source: 'unavailable', note: 'Engine processing error — no data available.' },
    }, { status: 500 })
  }
}
