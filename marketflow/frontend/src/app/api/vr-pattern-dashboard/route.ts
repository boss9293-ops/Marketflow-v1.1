import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'
import { detectPatternMatches } from '../../../../../../engine/pattern_detector'
import { computeCurrentMarketAnalogs } from '../../../../../../vr/analog/compute_market_analog'
import { buildPostureMessage } from '../../../../../../vr/dashboard/build_posture_message'
import { mapScenarioPlaybook } from '../../../../../../vr/playbooks/playbook_mapper'
import type { RawStandardPlaybackArchive } from '../../../../../../vr/playback/vr_playback_loader'
import { generateMarketState, toPatternDetectorInput } from '../../../../../../vr/state/market_state_generator'

function formatPercent(value: number) {
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`
}

export async function GET() {
  try {
    const rootDir = join(process.cwd(), '..', '..')
    const base = join(process.cwd(), '..', 'backend', 'output')

    let preloadedStandard: RawStandardPlaybackArchive | null = null
    try {
      preloadedStandard = JSON.parse(readFileSync(join(base, 'risk_v1_playback.json'), 'utf-8')) as RawStandardPlaybackArchive
    } catch {
      // optional
    }

    const marketState = await generateMarketState({ rootDir })
    const patternMatches = detectPatternMatches(toPatternDetectorInput(marketState), { rootDir, limit: 3 })
    const scenarioPlaybook = mapScenarioPlaybook(patternMatches, { rootDir, maxScenarios: 3 })
    const historicalAnalogs = computeCurrentMarketAnalogs({
      rootDir,
      marketState,
      topPattern: patternMatches.top_matches[0] ?? null,
      minScore: 40,
      preloadedStandard,
    })

    const ma200Map: Record<string, string> = {
      above: 'Above MA200',
      test: 'Testing MA200',
      breach: 'Breached MA200',
    }
    const structureMap: Record<string, string> = {
      trend_down: 'Trend Down',
      slow_bleed: 'Slow Bleed',
      vertical_drop: 'Vertical Drop',
      range_market: 'Range Market',
      sideways: 'Sideways Consolidation',
      countertrend_rally: 'Countertrend Rally',
      breakdown_retest: 'Breakdown Retest',
    }

    const suggestedPosture = Array.from(
      new Set(scenarioPlaybook.scenarios.flatMap((s) => s.posture_guidance))
    ).slice(0, 3)

    const postureMessage = buildPostureMessage({
      marketState,
      primaryPatternName: patternMatches.top_matches[0]?.pattern_name,
      scenarios: scenarioPlaybook.scenarios.slice(0, 3).map((s) => ({
        scenario_id: s.scenario_id,
        scenario_name: s.scenario_name,
        description: s.description,
        posture_guidance: s.posture_guidance,
      })),
      suggestedPosture,
    })

    const data = {
      snapshot: {
        as_of_date: marketState.as_of_date,
        market_pattern: patternMatches.top_matches[0]?.pattern_name ?? 'No pattern analog available yet',
        nasdaq_drawdown: formatPercent(marketState.nasdaq_drawdown),
        tqqq_drawdown: formatPercent(marketState.tqqq_drawdown),
        ma200_status: ma200Map[marketState.ma200_relation] ?? 'Sustained Below MA200',
        market_structure: structureMap[marketState.price_structure] ?? marketState.price_structure,
        volatility_regime: marketState.volatility_regime.charAt(0).toUpperCase() + marketState.volatility_regime.slice(1),
        recommended_posture: suggestedPosture,
      },
      posture_message: postureMessage,
      top_matches: patternMatches.top_matches.slice(0, 3),
      scenarios: scenarioPlaybook.scenarios.slice(0, 3).map((s) => ({
        scenario_id: s.scenario_id,
        scenario_name: s.scenario_name,
        description: s.description,
        posture_guidance: s.posture_guidance,
      })),
      historical_analogs: historicalAnalogs,
      suggested_posture: suggestedPosture,
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json(
      { error: 'Failed to build pattern dashboard — run build scripts first' },
      { status: 500 }
    )
  }
}
