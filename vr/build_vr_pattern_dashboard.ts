import { writeFileSync, readFileSync } from "fs"
import { join } from "path"
import { detectPatternMatches } from "../engine/pattern_detector"
import { computeCurrentMarketAnalogs } from "./analog/compute_market_analog"
import { buildPostureMessage } from "./dashboard/build_posture_message"
import { mapScenarioPlaybook } from "./playbooks/playbook_mapper"
import type { RawStandardPlaybackArchive } from "./playback/vr_playback_loader"
import { generateMarketState, toPatternDetectorInput } from "./state/market_state_generator"

function formatPercent(value: number) {
  return (value >= 0 ? "+" : "") + (value * 100).toFixed(1) + "%"
}

async function main() {
  const rootDir = join(__dirname, "..")
  const outputDir = join(__dirname, "../marketflow/backend/output")

  let preloadedStandard: RawStandardPlaybackArchive | null = null
  try {
    preloadedStandard = JSON.parse(
      readFileSync(join(outputDir, "risk_v1_playback.json"), "utf-8")
    ) as RawStandardPlaybackArchive
  } catch {}

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
    above: "Above MA200",
    test: "Testing MA200",
    breach: "Breached MA200",
  }
  const structureMap: Record<string, string> = {
    trend_down: "Trend Down",
    slow_bleed: "Slow Bleed",
    vertical_drop: "Vertical Drop",
    range_market: "Range Market",
    sideways: "Sideways Consolidation",
    countertrend_rally: "Countertrend Rally",
    breakdown_retest: "Breakdown Retest",
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

  const output = {
    snapshot: {
      as_of_date: marketState.as_of_date,
      market_pattern: patternMatches.top_matches[0]?.pattern_name ?? "No pattern analog available yet",
      nasdaq_drawdown: formatPercent(marketState.nasdaq_drawdown),
      tqqq_drawdown: formatPercent(marketState.tqqq_drawdown),
      ma200_status: ma200Map[marketState.ma200_relation] ?? "Sustained Below MA200",
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

  const outPath = join(outputDir, "vr_pattern_dashboard.json")
  writeFileSync(outPath, JSON.stringify(output, null, 2), "utf-8")
  console.log("vr_pattern_dashboard.json written")
}

main().catch(console.error)
