import type {
  RawStandardPlaybackArchive,
  RawVRSurvivalPlaybackArchive,
} from '../playback/vr_playback_loader'

type StrategyKey = 'buy_hold' | 'ma200_risk_control' | 'fixed_stop_loss' | 'adaptive_exposure' | 'original_vr_scaled'

type StandardPlaybackPoint = RawStandardPlaybackArchive['events'][number]['playback'][number]
type SurvivalPlaybackPoint = RawVRSurvivalPlaybackArchive['events'][number]['playback'][number]

export type StrategyArenaMetric = {
  final_return_pct: number
  max_drawdown_pct: number
  recovery_time_days: number | null
  exposure_stability_pct: number
}

export type StrategyArenaEventView = {
  id: string
  label: string
  standard_event_name: string
  playback_event_id: string
  start: string
  end: string
  vr_source: 'survival_archive' | null
  metrics: Partial<Record<StrategyKey, StrategyArenaMetric>>
  chart_data: Array<{
    date: string
    buy_hold_equity: number
    ma200_risk_control_equity: number
    fixed_stop_loss_equity: number
    adaptive_exposure_equity: number | null
    original_vr_scaled_equity: number | null
    buy_hold_drawdown: number
    ma200_risk_control_drawdown: number
    fixed_stop_loss_drawdown: number
    adaptive_exposure_drawdown: number | null
    original_vr_scaled_drawdown: number | null
    buy_hold_exposure: number
    ma200_risk_control_exposure: number
    fixed_stop_loss_exposure: number
    adaptive_exposure_exposure: number | null
    original_vr_scaled_exposure: number | null
  }>
}

export type StrategyArenaView = {
  events: StrategyArenaEventView[]
  methodology: {
    fixed_stop_loss_rule: string
    ma200_rule: string
    vr_source_priority: string
  }
}

const ARENA_TARGETS = [
  { id: '2008-crash', label: '2008 Crash', standard_event_name: '2007-07 Risk Event' },
  { id: '2011-debt-crisis', label: '2011 Debt Crisis', standard_event_name: '2011-06 Risk Event' },
  { id: '2018-volmageddon', label: '2018 Volmageddon', standard_event_name: '2018-02 Risk Event' },
  { id: '2020-covid-crash', label: '2020 COVID Crash', standard_event_name: '2020-02 Risk Event' },
  { id: '2022-bear-market', label: '2022 Bear Market', standard_event_name: '2021-12 Risk Event' },
  { id: '2024-yen-carry', label: '2024 Yen Carry', standard_event_name: '2024-07 Risk Event' },
  { id: '2025-tariff', label: '2025 Tariff Crisis', standard_event_name: '2025 Tariff Event' },
] as const

function toDateValue(value: string) {
  return new Date(`${value}T00:00:00Z`).getTime()
}

function overlapDays(
  left: Pick<RawStandardPlaybackArchive['events'][number], 'start' | 'end'>,
  right: Pick<RawVRSurvivalPlaybackArchive['events'][number], 'start' | 'end'>
) {
  const start = Math.max(toDateValue(left.start), toDateValue(right.start))
  const end = Math.min(toDateValue(left.end), toDateValue(right.end))
  if (end < start) return 0
  return Math.floor((end - start) / 86400000) + 1
}

function buildSyntheticTqqqProxy(points: StandardPlaybackPoint[]) {
  let syntheticN: number | null = null

  return points.map((point, index) => {
    const prevQqq = index > 0 ? points[index - 1]?.qqq_n : null
    const currentQqq = point.qqq_n

    if (typeof currentQqq !== 'number') {
      return null
    }

    if (syntheticN == null) {
      syntheticN = currentQqq > 0 ? currentQqq : 100
    } else if (typeof prevQqq === 'number' && prevQqq > 0) {
      const qqqReturn = (currentQqq - prevQqq) / prevQqq
      syntheticN = Math.max(1, syntheticN * (1 + qqqReturn * 3))
    }

    return Number(syntheticN.toFixed(2))
  })
}

function findMatchingSurvivalEvent(
  standardEvent: RawStandardPlaybackArchive['events'][number],
  survivalArchive: RawVRSurvivalPlaybackArchive | null
) {
  if (!survivalArchive?.events?.length) return null

  const exact = survivalArchive.events.find((event) => event.name === standardEvent.name)
  if (exact) return exact

  const ranked = survivalArchive.events
    .map((event) => ({
      event,
      overlap: overlapDays(standardEvent, event),
    }))
    .filter((item) => item.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)

  return ranked[0]?.event ?? null
}

function normalizeCurve(points: Array<{ date: string; value: number; exposure: number }>) {
  const peakSeed = points[0]?.value ?? 100
  let peak = peakSeed

  return points.map((point) => {
    peak = Math.max(peak, point.value)
    const drawdown = peak > 0 ? Number((((point.value - peak) / peak) * 100).toFixed(2)) : 0
    return {
      date: point.date,
      equity: Number(point.value.toFixed(2)),
      drawdown,
      exposure: Number(point.exposure.toFixed(2)),
    }
  })
}

function computeRecoveryTimeDays(curve: Array<{ equity: number }>) {
  if (!curve.length) return null
  let peak = curve[0].equity
  let troughIndex = 0
  let troughDrawdown = 0

  for (let index = 0; index < curve.length; index += 1) {
    peak = Math.max(peak, curve[index].equity)
    const dd = peak > 0 ? (curve[index].equity - peak) / peak : 0
    if (dd < troughDrawdown) {
      troughDrawdown = dd
      troughIndex = index
    }
  }

  if (troughDrawdown === 0) return 0

  const targetPeak = curve.slice(0, troughIndex + 1).reduce((best, point) => Math.max(best, point.equity), curve[0].equity)
  for (let index = troughIndex + 1; index < curve.length; index += 1) {
    if (curve[index].equity >= targetPeak) {
      return index - troughIndex
    }
  }

  return null
}

function computeExposureStability(exposures: number[]) {
  if (exposures.length <= 1) return 100
  let totalChange = 0
  for (let index = 1; index < exposures.length; index += 1) {
    totalChange += Math.abs(exposures[index] - exposures[index - 1])
  }
  const maxChange = (exposures.length - 1) * 100
  if (maxChange === 0) return 100
  return Number((100 - (totalChange / maxChange) * 100).toFixed(1))
}

function computeMetric(curve: Array<{ equity: number; drawdown: number; exposure: number }>): StrategyArenaMetric {
  const first = curve[0]?.equity ?? 100
  const last = curve[curve.length - 1]?.equity ?? first
  const maxDrawdown = curve.reduce((best, point) => Math.min(best, point.drawdown), 0)
  return {
    final_return_pct: Number((((last / first) - 1) * 100).toFixed(1)),
    max_drawdown_pct: Number(maxDrawdown.toFixed(1)),
    recovery_time_days: computeRecoveryTimeDays(curve),
    exposure_stability_pct: computeExposureStability(curve.map((point) => point.exposure)),
  }
}

function buildBuyHoldCurve(assetSeries: Array<{ date: string; asset_n: number }>) {
  const first = assetSeries[0]?.asset_n ?? 100
  return normalizeCurve(
    assetSeries.map((point) => ({
      date: point.date,
      value: (point.asset_n / first) * 100,
      exposure: 100,
    }))
  )
}

function buildMA200Curve(assetSeries: Array<{ date: string; asset_n: number; qqq_n: number; ma200_n: number | null }>) {
  let equity = 100
  let exposure = assetSeries[0] && assetSeries[0].qqq_n >= (assetSeries[0].ma200_n ?? Number.NEGATIVE_INFINITY) ? 100 : 0
  const points: Array<{ date: string; value: number; exposure: number }> = [
    { date: assetSeries[0]?.date ?? '', value: equity, exposure },
  ]

  for (let index = 1; index < assetSeries.length; index += 1) {
    const prev = assetSeries[index - 1]
    const current = assetSeries[index]
    const assetReturn = prev.asset_n > 0 ? (current.asset_n - prev.asset_n) / prev.asset_n : 0
    equity *= 1 + assetReturn * (exposure / 100)
    exposure = current.qqq_n >= (current.ma200_n ?? Number.NEGATIVE_INFINITY) ? 100 : 0
    points.push({ date: current.date, value: equity, exposure })
  }

  return normalizeCurve(points)
}

function buildFixedStopCurve(assetSeries: Array<{ date: string; asset_n: number; qqq_n: number; ma50_n: number | null }>) {
  let equity = 100
  let exposure = 100
  let inPosition = true
  let peakSinceEntry = assetSeries[0]?.asset_n ?? 100
  const points: Array<{ date: string; value: number; exposure: number }> = [
    { date: assetSeries[0]?.date ?? '', value: equity, exposure },
  ]

  for (let index = 1; index < assetSeries.length; index += 1) {
    const prev = assetSeries[index - 1]
    const current = assetSeries[index]
    const assetReturn = prev.asset_n > 0 ? (current.asset_n - prev.asset_n) / prev.asset_n : 0
    equity *= 1 + assetReturn * (exposure / 100)

    if (inPosition) {
      peakSinceEntry = Math.max(peakSinceEntry, current.asset_n)
      const drawdownFromPeak = peakSinceEntry > 0 ? (current.asset_n - peakSinceEntry) / peakSinceEntry : 0
      if (drawdownFromPeak <= -0.12) {
        inPosition = false
        exposure = 0
      }
    } else {
      const prevQqq = index > 0 ? assetSeries[index - 1]?.qqq_n : current.qqq_n
      const canReEnter =
        current.qqq_n > (current.ma50_n ?? Number.POSITIVE_INFINITY * -1) &&
        current.qqq_n >= prevQqq
      if (canReEnter) {
        inPosition = true
        exposure = 100
        peakSinceEntry = current.asset_n
      }
    }

    points.push({ date: current.date, value: equity, exposure })
  }

  return normalizeCurve(points)
}

// Adaptive Exposure: VR engine's exposure decisions applied to TQQQ returns
// Same instrument as all other Backtest curves; exposure_pct from survival archive
function buildAdaptiveExposureCurve(
  survivalEvent: RawVRSurvivalPlaybackArchive['events'][number] | null,
  assetSeries: Array<{ date: string; asset_n: number }>
): ReturnType<typeof normalizeCurve> | null {
  if (!survivalEvent?.playback?.length) return null

  const vrByDate = new Map(survivalEvent.playback.map((point) => [point.d, point.exposure_pct]))

  let equity = 100
  const points: Array<{ date: string; value: number; exposure: number }> = []

  for (let index = 0; index < assetSeries.length; index++) {
    const { date, asset_n } = assetSeries[index]
    const exposure = vrByDate.get(date)
    if (exposure == null) continue

    if (points.length > 0) {
      const prevAssetN = assetSeries[index - 1]?.asset_n
      if (typeof prevAssetN === 'number' && prevAssetN > 0) {
        const assetReturn = (asset_n - prevAssetN) / prevAssetN
        equity *= 1 + assetReturn * (exposure / 100)
      }
    }

    points.push({ date, value: equity, exposure })
  }

  if (points.length < 2) return null
  return normalizeCurve(points)
}

// Original VR (Scaled): pre-computed vr_10k from survival archive, scaled to TQQQ magnitude
// Formula: TQQQ_BH[t] × (vr_10k[t] / bh_10k[t])
// This preserves the VR engine's QQQ-space alpha while placing the curve on the same
// TQQQ scale as all other Backtest curves — making divergence from Adaptive Exposure visible.
function buildOriginalVRCurve(
  survivalEvent: RawVRSurvivalPlaybackArchive['events'][number] | null,
  assetSeries: Array<{ date: string; asset_n: number }>
): ReturnType<typeof normalizeCurve> | null {
  if (!survivalEvent?.playback?.length) return null

  const vrByDate = new Map(survivalEvent.playback.map((point) => [point.d, point]))
  const firstAsset = assetSeries[0]?.asset_n ?? 0
  if (firstAsset <= 0) return null

  const points: Array<{ date: string; value: number; exposure: number }> = []

  for (const { date, asset_n } of assetSeries) {
    const vrPoint = vrByDate.get(date)
    if (!vrPoint || vrPoint.bh_10k <= 0) continue

    const tqqqBH = (asset_n / firstAsset) * 100          // TQQQ B&H normalized to 100
    const vrEfficiency = vrPoint.vr_10k / vrPoint.bh_10k // VR vs B&H ratio in QQQ space
    points.push({ date, value: tqqqBH * vrEfficiency, exposure: vrPoint.exposure_pct })
  }

  if (points.length < 2) return null
  return normalizeCurve(points)
}

function zipChartData(input: {
  buyHold: ReturnType<typeof buildBuyHoldCurve>
  ma200: ReturnType<typeof buildMA200Curve>
  fixedStop: ReturnType<typeof buildFixedStopCurve>
  adaptiveExposure: ReturnType<typeof buildAdaptiveExposureCurve>
  originalVR: ReturnType<typeof buildOriginalVRCurve>
}) {
  const baseLength = Math.min(input.buyHold.length, input.ma200.length, input.fixedStop.length)
  const length = [
    baseLength,
    ...(input.adaptiveExposure ? [input.adaptiveExposure.length] : []),
    ...(input.originalVR ? [input.originalVR.length] : []),
  ].reduce((a, b) => Math.min(a, b))
  return Array.from({ length }, (_, index) => ({
    date: input.buyHold[index].date,
    buy_hold_equity: input.buyHold[index].equity,
    ma200_risk_control_equity: input.ma200[index].equity,
    fixed_stop_loss_equity: input.fixedStop[index].equity,
    adaptive_exposure_equity: input.adaptiveExposure ? input.adaptiveExposure[index].equity : null,
    original_vr_scaled_equity: input.originalVR ? input.originalVR[index]?.equity ?? null : null,
    buy_hold_drawdown: input.buyHold[index].drawdown,
    ma200_risk_control_drawdown: input.ma200[index].drawdown,
    fixed_stop_loss_drawdown: input.fixedStop[index].drawdown,
    adaptive_exposure_drawdown: input.adaptiveExposure ? input.adaptiveExposure[index].drawdown : null,
    original_vr_scaled_drawdown: input.originalVR ? input.originalVR[index]?.drawdown ?? null : null,
    buy_hold_exposure: input.buyHold[index].exposure,
    ma200_risk_control_exposure: input.ma200[index].exposure,
    fixed_stop_loss_exposure: input.fixedStop[index].exposure,
    adaptive_exposure_exposure: input.adaptiveExposure ? input.adaptiveExposure[index].exposure : null,
    original_vr_scaled_exposure: input.originalVR ? input.originalVR[index]?.exposure ?? null : null,
  }))
}

export function buildStrategyArena(input: {
  standardArchive: RawStandardPlaybackArchive | null
  survivalArchive: RawVRSurvivalPlaybackArchive | null
}): StrategyArenaView | null {
  if (!input.standardArchive?.events?.length) return null

  const events = ARENA_TARGETS.map((target) => {
    const standardEvent = input.standardArchive?.events.find((event) => event.name === target.standard_event_name)
    if (!standardEvent) return null

    const survivalEvent = findMatchingSurvivalEvent(standardEvent, input.survivalArchive)
    const standardSynthetic = buildSyntheticTqqqProxy(standardEvent.playback)
    const standardByDate = new Map(
      standardEvent.playback.map((point, index) => [
        point.d,
        {
          point,
          synthetic_tqqq_n: standardSynthetic[index] ?? null,
        },
      ])
    )

    const masterDates =
      survivalEvent?.playback?.length ? survivalEvent.playback.map((point) => point.d) : standardEvent.playback.map((point) => point.d)

    const assetSeries = masterDates
      .map((date) => {
        const standardPoint = standardByDate.get(date)?.point
        if (!standardPoint || typeof standardPoint.qqq_n !== 'number') return null
        const assetN =
          typeof standardPoint.tqqq_n === 'number'
            ? standardPoint.tqqq_n
            : standardByDate.get(date)?.synthetic_tqqq_n
        if (typeof assetN !== 'number') return null

        return {
          date,
          asset_n: assetN,
          qqq_n: standardPoint.qqq_n,
          ma50_n: standardPoint.ma50_n,
          ma200_n: standardPoint.ma200_n,
          level: standardPoint.level,
        }
      })
      .filter((point): point is NonNullable<typeof point> => Boolean(point))

    if (assetSeries.length < 2) return null

    const buyHold = buildBuyHoldCurve(assetSeries)
    const ma200 = buildMA200Curve(assetSeries)
    const fixedStop = buildFixedStopCurve(assetSeries)
    const adaptiveExposure = buildAdaptiveExposureCurve(survivalEvent, assetSeries)
    const originalVR = buildOriginalVRCurve(survivalEvent, assetSeries)

    return {
      id: target.id,
      label: target.label,
      standard_event_name: standardEvent.name,
      playback_event_id: standardEvent.start.slice(0, 7),
      start: assetSeries[0].date,
      end: assetSeries[assetSeries.length - 1].date,
      vr_source: survivalEvent ? 'survival_archive' as const : null,
      metrics: {
        buy_hold: computeMetric(buyHold),
        ma200_risk_control: computeMetric(ma200),
        fixed_stop_loss: computeMetric(fixedStop),
        ...(adaptiveExposure ? { adaptive_exposure: computeMetric(adaptiveExposure) } : {}),
        ...(originalVR ? { original_vr_scaled: computeMetric(originalVR) } : {}),
      },
      chart_data: zipChartData({ buyHold, ma200, fixedStop, adaptiveExposure, originalVR }),
    }
  })
  // Validation log — verify all curves start at 100 and share same TQQQ baseline
  .map((event) => {
    if (!event) return null
    const cd = event.chart_data
    const startDate = cd[0]?.date ?? 'n/a'
    const first5 = (vals: (number | null | undefined)[]) => JSON.stringify(vals.filter(v => v != null).slice(0, 5).map(v => +(v as number).toFixed(2)))
    const curves: Array<[string, (number | null)[] | undefined]> = [
      ['Buy & Hold', cd.map(p => p.buy_hold_equity)],
      ['MA200 Risk Control', cd.map(p => p.ma200_risk_control_equity)],
      ['Fixed Stop Loss', cd.map(p => p.fixed_stop_loss_equity)],
      ['Adaptive Exposure', cd.map(p => p.adaptive_exposure_equity)],
      ['Original VR (Scaled)', cd.map(p => p.original_vr_scaled_equity)],
    ]
    curves.forEach(([name, vals]) => {
      if (!vals?.length) return
      const first = vals.find(v => v != null)
      const warn = (first != null && Math.abs(first - 100) > 0.5) ? ' ⚠ DOES NOT START AT 100' : ''
      console.log(`Arena ${event.label} | ${name} | asset=TQQQ | start=${startDate} | first5=${first5(vals)}${warn}`)
    })
    return event
  })
  .filter((event) => event !== null) as StrategyArenaEventView[]

  return {
    events,
    methodology: {
      fixed_stop_loss_rule: 'Exit after a 12% instrument drawdown from entry peak. Re-enter on MA50 reclaim with improving price.',
      ma200_rule: 'Stay fully invested above MA200 and move to cash below MA200.',
      vr_source_priority: 'Adaptive Exposure applies VR exposure_pct decisions to TQQQ returns (daily fractional model, asset=TQQQ). Original VR (Scaled) applies the archive efficiency ratio (vr_10k/bh_10k) to the TQQQ B&H curve — it is a scaled reference, not a TQQQ re-execution of the VR engine. Both require a survival archive.',
    },
  }
}

export function runStrategyArenaExamples(view: StrategyArenaView | null) {
  const cases = [
    { label: '2008 Crash', expect: '2007-07 Risk Event' },
    { label: '2020 COVID Crash', expect: '2020-02 Risk Event' },
    { label: '2026 Risk Event', expect: '2026-02 Risk Event' },
  ] as const

  return cases.map((testCase) => {
    const event = view?.events.find((item) => item.label === testCase.label) ?? null
    return {
      label: testCase.label,
      passed:
        event?.standard_event_name === testCase.expect &&
        event.chart_data.length > 1 &&
        Object.values(event.metrics).every((metric) => Number.isFinite(metric.final_return_pct)),
      vr_source: event?.vr_source ?? null,
      standard_event_name: event?.standard_event_name ?? null,
    }
  })
}
