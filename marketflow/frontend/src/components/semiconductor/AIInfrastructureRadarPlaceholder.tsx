'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import {
  SOXX_LINK_TYPE_DEFINITIONS,
  INITIAL_AI_INFRASTRUCTURE_THEMES,
  getDataStatusLabel,
  getSoxxLinkExplanation,
  getSoxxLinkLabel,
  type AIInfrastructureDataStatus,
  type AIInfrastructureSoxxLinkType,
} from '@/lib/semiconductor/aiInfrastructureRadar'
import {
  AI_INFRA_MANUAL_NEWS,
  getWatchlistByTheme,
} from '@/lib/semiconductor/aiInfrastructureManualData'
import {
  buildThemeMomentumFromReturns,
  formatMomentumPct,
  getMomentumStatusLabel,
} from '@/lib/semiconductor/aiInfrastructureMomentum'
import {
  loadAIInfraThemeMomentum,
  type AIInfraThemeMomentumLoadResult,
} from '@/lib/semiconductor/aiInfrastructureMomentumAdapter'
import {
  getLatestThemeNews,
  getThemeNewsStatus,
} from '@/lib/semiconductor/aiInfrastructureNews'
import {
  getCapexCompanies,
  getCapexDirectionLabel,
  getLatestCapexNotes,
} from '@/lib/semiconductor/aiInfrastructureCapex'
import { getAIInfraScorePolicy } from '@/lib/semiconductor/aiInfrastructureScorePolicy'
import { SEMICONDUCTOR_INTELLIGENCE_COPY } from '@/lib/semiconductor/semiconductorIntelligenceCopy'

const SOXX_LINK_BADGE_CLASS: Record<AIInfrastructureSoxxLinkType, string> = {
  direct: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  indirect: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  outside: 'border-slate-700 bg-slate-900/70 text-slate-300',
}

const STATUS_BADGE_CLASS = {
  cyan: 'border-cyan-500/20 bg-cyan-500/5 text-cyan-200',
  amber: 'border-amber-500/20 bg-amber-500/5 text-amber-200',
  emerald: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-200',
  slate: 'border-slate-700 bg-slate-900/70 text-slate-300',
} as const

const RADAR_BETA_GUARDRAIL =
  'Beta context only. Not a forecast, recommendation, or trading signal.'

function BetaStatusBadge({
  children,
  tone = 'slate',
}: {
  children: ReactNode
  tone?: keyof typeof STATUS_BADGE_CLASS
}) {
  return (
    <span
      className={`rounded-sm border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${STATUS_BADGE_CLASS[tone]}`}
    >
      {children}
    </span>
  )
}

function formatRadarDataStatus(status: AIInfrastructureDataStatus): string {
  if (status === 'partial') return 'Partial data'
  if (status === 'manual') return 'Manual context'
  if (status === 'placeholder') return 'Data not connected'
  return getDataStatusLabel(status)
}

const SOXX_LINK_ORDER: AIInfrastructureSoxxLinkType[] = ['direct', 'indirect', 'outside']

export function AIInfrastructureRadarPlaceholder() {
  const [momentumPayload, setMomentumPayload] =
    useState<AIInfraThemeMomentumLoadResult | null>(null)
  const [selectedThemeId, setSelectedThemeId] = useState<string>(
    INITIAL_AI_INFRASTRUCTURE_THEMES[0]?.id ?? '',
  )

  useEffect(() => {
    let cancelled = false
    loadAIInfraThemeMomentum().then((payload) => {
      if (!cancelled) setMomentumPayload(payload)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const momentumByTheme = useMemo(
    () => new Map((momentumPayload?.themes ?? []).map((t) => [t.themeId, t])),
    [momentumPayload],
  )

  const isMomentumConnected =
    momentumPayload?.status === 'available' || momentumPayload?.status === 'partial'
  const hasSourceBackedManualContext =
    AI_INFRA_MANUAL_NEWS.length > 0 || getLatestCapexNotes().length > 0

  const selectedTheme = useMemo(
    () =>
      INITIAL_AI_INFRASTRUCTURE_THEMES.find((t) => t.id === selectedThemeId) ??
      INITIAL_AI_INFRASTRUCTURE_THEMES[0],
    [selectedThemeId],
  )

  const selectedThemeData = useMemo(() => {
    if (!selectedTheme) return null
    const theme = selectedTheme
    const watchlist = getWatchlistByTheme(theme.id)
    const latestNews = getLatestThemeNews(AI_INFRA_MANUAL_NEWS, theme.id, 2)
    const newsStatus = getThemeNewsStatus({ newsCount: latestNews.length })
    const capexCompanies = theme.id === 'cloud_capex' ? getCapexCompanies() : []
    const capexNotes = theme.id === 'cloud_capex' ? getLatestCapexNotes() : []
    const hasManualContext = latestNews.length > 0 || capexNotes.length > 0
    const fallbackMomentum1D = buildThemeMomentumFromReturns({
      themeId: theme.id,
      themeName: theme.name,
      period: '1D',
      tickerReturns: [],
      soxxReturnPct: null,
    })
    const fallbackMomentum5D = buildThemeMomentumFromReturns({
      themeId: theme.id,
      themeName: theme.name,
      period: '5D',
      tickerReturns: [],
      soxxReturnPct: null,
    })
    const fallbackMomentum1M = buildThemeMomentumFromReturns({
      themeId: theme.id,
      themeName: theme.name,
      period: '1M',
      tickerReturns: [],
      soxxReturnPct: null,
    })
    const themeMomentum = momentumByTheme.get(theme.id)
    const momentum1D = themeMomentum?.periods['1D'] ?? fallbackMomentum1D
    const momentum5D = themeMomentum?.periods['5D'] ?? fallbackMomentum5D
    const momentum1M = themeMomentum?.periods['1M'] ?? fallbackMomentum1M
    const hasMomentumData =
      Boolean(themeMomentum) &&
      [momentum1D, momentum5D, momentum1M].some(
        (item) => item && item.dataStatus !== 'unavailable',
      )
    const effectiveDataStatus: AIInfrastructureDataStatus = hasMomentumData
      ? 'partial'
      : hasManualContext
        ? 'manual'
        : theme.dataStatus
    const scorePolicy = getAIInfraScorePolicy({
      dataStatus: effectiveDataStatus,
      hasMomentumData,
      hasNewsContext: latestNews.length > 0,
      hasCapexContext: capexNotes.length > 0,
    })
    return {
      theme,
      watchlist,
      latestNews,
      newsStatus,
      capexCompanies,
      capexNotes,
      hasManualContext,
      momentum1D,
      momentum5D,
      momentum1M,
      hasMomentumData,
      effectiveDataStatus,
      scorePolicy,
    }
  }, [selectedTheme, momentumByTheme])

  return (
    <section className="min-h-screen bg-[#020408] px-4 py-4 text-slate-300 md:px-6 xl:px-10 2xl:px-14">
      <div className="mx-auto max-w-[1440px] space-y-3">

        {/* Compact header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-400">
              Beta Radar
            </div>
            <h2 className="mt-0.5 text-xl font-black tracking-tight text-white">
              {SEMICONDUCTOR_INTELLIGENCE_COPY.aiInfrastructureRadar.label}
            </h2>
            <p className="mt-1 text-[12px] leading-5 text-slate-400">
              Beta monitoring layer for broader AI infrastructure themes and SOXX/SOXL relevance.
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-1.5 sm:justify-end">
            <BetaStatusBadge tone="cyan">Beta</BetaStatusBadge>
            {isMomentumConnected ? (
              <>
                <BetaStatusBadge tone="cyan">Partial data</BetaStatusBadge>
                <BetaStatusBadge tone="emerald">Price momentum connected</BetaStatusBadge>
              </>
            ) : hasSourceBackedManualContext ? (
              <BetaStatusBadge tone="amber">Manual context</BetaStatusBadge>
            ) : (
              <BetaStatusBadge tone="amber">Data not connected</BetaStatusBadge>
            )}
            {hasSourceBackedManualContext && isMomentumConnected && (
              <BetaStatusBadge tone="slate">Manual context</BetaStatusBadge>
            )}
          </div>
        </div>

        {/* Compact legend row */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-sm border border-slate-800 bg-slate-950/40 px-3 py-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.10em] text-slate-500">
            SOXX Link
          </span>
          {SOXX_LINK_ORDER.map((lt) => (
            <span key={lt} className="flex items-center gap-2">
              <span
                className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.10em] ${SOXX_LINK_BADGE_CLASS[lt]}`}
              >
                {SOXX_LINK_TYPE_DEFINITIONS[lt].label}
              </span>
              <span className="text-[11px] leading-4 text-slate-500">
                {SOXX_LINK_TYPE_DEFINITIONS[lt].short}
              </span>
            </span>
          ))}
        </div>

        <div className="rounded-sm border border-slate-800 bg-slate-950/40 px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.10em] text-slate-500">
            How to read this Radar
          </div>
          <div className="mt-1 grid gap-x-3 gap-y-1 text-[11px] leading-4 text-slate-400 sm:grid-cols-2">
            <p>Theme = broader AI infrastructure area being monitored.</p>
            <p>SOXX Link = how the theme relates to SOXX/SOXL.</p>
            <p>Watchlist = exploratory basket, not recommendations.</p>
            <p>Momentum = market context, not a trading signal.</p>
            <p>Data Confidence = how much real data is connected.</p>
          </div>
        </div>

        {/* Two-column body */}
        <div className="flex flex-col gap-3 lg:flex-row lg:gap-6">

          {/* Left: Theme Navigator */}
          <nav className="flex flex-col gap-1.5 lg:w-[320px] lg:shrink-0 xl:w-[340px]">
            {INITIAL_AI_INFRASTRUCTURE_THEMES.map((theme) => {
              const isSelected = theme.id === selectedThemeId
              const tm = momentumByTheme.get(theme.id)
              const hasMomentum =
                Boolean(tm) &&
                [tm?.periods['1D'], tm?.periods['5D'], tm?.periods['1M']].some(
                  (item) => item && item.dataStatus !== 'unavailable',
                )
              const hasNews = getLatestThemeNews(AI_INFRA_MANUAL_NEWS, theme.id, 1).length > 0
              const navStatus: AIInfrastructureDataStatus = hasMomentum
                ? 'partial'
                : hasNews
                  ? 'manual'
                  : theme.dataStatus

              return (
                <button
                  key={theme.id}
                  onClick={() => setSelectedThemeId(theme.id)}
                  className={`w-full rounded-sm border p-3 text-left transition-colors ${
                    isSelected
                      ? 'border-cyan-500/30 bg-cyan-500/5'
                      : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[13px] font-semibold leading-5 text-slate-100">
                      {theme.name}
                    </span>
                    <span
                      className={`shrink-0 rounded-sm border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.10em] ${SOXX_LINK_BADGE_CLASS[theme.soxxLinkType]}`}
                    >
                      {getSoxxLinkLabel(theme.soxxLinkType).replace(' SOXX', '')}
                    </span>
                  </div>
                  <div className="mt-1">
                    <span className="rounded-sm border border-slate-800 bg-slate-900/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.10em] text-slate-400">
                      {formatRadarDataStatus(navStatus)}
                    </span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[11px] leading-[1.45] text-slate-500">
                    {theme.description}
                  </p>
                </button>
              )
            })}
          </nav>

          {/* Right: Selected theme detail */}
          {selectedThemeData && (
            <div className="min-w-0 flex-1 space-y-3">

              {/* 1. Theme Overview */}
              <div className="rounded-sm border border-slate-800 bg-[#04070d] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                      {selectedThemeData.theme.category}
                    </div>
                    <h3 className="mt-1 text-lg font-black tracking-tight text-white">
                      {selectedThemeData.theme.name}
                    </h3>
                  </div>
                  <span
                    className={`shrink-0 rounded-sm border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${SOXX_LINK_BADGE_CLASS[selectedThemeData.theme.soxxLinkType]}`}
                  >
                    {getSoxxLinkLabel(selectedThemeData.theme.soxxLinkType)}
                  </span>
                </div>
                <p className="mt-3 text-[13px] leading-6 text-slate-300">
                  {selectedThemeData.theme.description}
                </p>
                <p className="mt-2 text-[12px] leading-5 text-slate-500">
                  {getSoxxLinkExplanation(selectedThemeData.theme)}
                </p>
                {selectedThemeData.theme.relatedSoxxBuckets.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedThemeData.theme.relatedSoxxBuckets.map((bucket) => (
                      <span
                        key={bucket}
                        className="rounded-sm border border-slate-800 bg-slate-950/50 px-2 py-0.5 text-[10px] text-slate-400"
                      >
                        {bucket}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Compact Metrics Row */}
              <div className="rounded-sm border border-slate-800 bg-[#04070d] p-4">
                <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    Theme Momentum
                  </span>
                  <span className="rounded-sm border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    {getMomentumStatusLabel(selectedThemeData.momentum1M.dataStatus)}
                  </span>
                </div>
                {selectedThemeData.hasMomentumData ? (
                  <>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                      {(
                        [
                          { label: '1D', value: formatMomentumPct(selectedThemeData.momentum1D?.basketReturnPct) },
                          { label: '5D', value: formatMomentumPct(selectedThemeData.momentum5D.basketReturnPct) },
                          { label: '1M', value: formatMomentumPct(selectedThemeData.momentum1M.basketReturnPct) },
                          {
                            label: 'vs SOXX (1M)',
                            value: formatMomentumPct(selectedThemeData.momentum1M.relativeToSoxxPct),
                          },
                          {
                            label: 'Coverage',
                            value: `${selectedThemeData.momentum1M.availableTickerCount} / ${selectedThemeData.momentum1M.tickerCount}`,
                          },
                        ] as const
                      ).map(({ label, value }) => (
                        <div key={label} className="rounded-sm bg-slate-900/60 px-3 py-2 text-center">
                          <div className="text-[10px] font-bold uppercase tracking-[0.10em] text-slate-500">
                            {label}
                          </div>
                          <div className="mt-1 font-mono text-[14px] font-semibold text-slate-100">
                            {value}
                          </div>
                        </div>
                      ))}
                    </div>
                    {selectedThemeData.momentum1M.missingTickers.length > 0 && (
                      <p className="mt-2 text-[10px] leading-4 text-amber-400">
                        Partial data: {selectedThemeData.momentum1M.availableTickerCount}/
                        {selectedThemeData.momentum1M.tickerCount} tickers.
                      </p>
                    )}
                    <p className="mt-1.5 text-[10px] leading-4 text-slate-500">
                      Market context, not a trading signal.
                    </p>
                  </>
                ) : (
                  <p className="mt-3 text-[12px] leading-5 text-slate-500">
                    Theme momentum unavailable. Price source is not connected yet.
                  </p>
                )}
              </div>

              {/* 3. Why It Matters */}
              <div className="rounded-sm border border-slate-800 bg-[#04070d] px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  Why It Matters
                </div>
                <p className="mt-2 text-[13px] leading-6 text-slate-300">
                  {selectedThemeData.theme.whyItMatters}
                </p>
                {selectedThemeData.theme.risk && (
                  <p className="mt-1.5 text-[12px] leading-5 text-slate-500">
                    <span className="font-semibold text-slate-400">Risk: </span>
                    {selectedThemeData.theme.risk}
                  </p>
                )}
              </div>

              {/* 4. Watchlist */}
              {selectedThemeData.watchlist.length > 0 && (
                <div className="rounded-sm border border-slate-800 bg-[#04070d] px-4 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    Watchlist
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedThemeData.watchlist.map((item) => (
                      <span
                        key={item.ticker}
                        title={item.role}
                        className="rounded-sm border border-slate-700 bg-slate-900/70 px-2 py-1 font-mono text-[12px] font-semibold text-slate-200"
                      >
                        {item.ticker}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] leading-4 text-slate-500">
                    Exploratory manual watchlist, not a recommendation.
                  </p>
                </div>
              )}

              {/* Cloud CAPEX tracker */}
              {selectedThemeData.theme.id === 'cloud_capex' &&
                (selectedThemeData.capexNotes.length > 0 ||
                  selectedThemeData.capexCompanies.length > 0) && (
                  <div className="rounded-sm border border-slate-800 bg-[#04070d] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                        CAPEX Tracker
                      </span>
                      <span className="rounded-sm border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Manual notes: {selectedThemeData.capexNotes.length}
                      </span>
                    </div>
                    {selectedThemeData.capexNotes.length > 0 ? (
                      <div className="mt-2 space-y-1.5">
                        {selectedThemeData.capexNotes.slice(0, 5).map((note) => (
                          <div
                            key={`${note.ticker}-${note.quarter}`}
                            className="rounded-sm border border-slate-800 bg-slate-900/50 px-2 py-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-[10px] font-bold text-slate-200">
                                {note.ticker}
                              </span>
                              <span className="rounded-sm border border-cyan-500/20 bg-cyan-500/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-200">
                                {getCapexDirectionLabel(note.capexDirection)}
                              </span>
                            </div>
                            <p className="mt-1 text-[10px] leading-4 text-slate-500">
                              {note.quarter}: source-backed manual note.
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 space-y-2">
                        <p className="text-[11px] leading-5 text-slate-500">
                          No curated CAPEX notes yet. Source-backed CAPEX notes will appear after
                          manual review.
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedThemeData.capexCompanies.map((company) => (
                            <span
                              key={company.ticker}
                              title={company.role}
                              className="rounded-sm border border-slate-700 bg-slate-900/70 px-2 py-1 font-mono text-[10px] font-semibold text-slate-300"
                            >
                              {company.ticker}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="mt-2 text-[10px] leading-4 text-slate-500">
                      CAPEX is a demand signal, not a trading signal.
                    </p>
                  </div>
                )}

              {/* 5. Recent Context */}
              <div className="rounded-sm border border-slate-800 bg-[#04070d] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    Recent Context
                  </span>
                  <span className="rounded-sm border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    {selectedThemeData.newsStatus}
                  </span>
                </div>
                {selectedThemeData.latestNews.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {selectedThemeData.latestNews.map((item) => (
                      <div key={item.id} className="text-[12px] leading-5">
                        <div className="font-semibold text-slate-200">{item.headline}</div>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          {item.url ? (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:text-cyan-300"
                            >
                              {item.source}
                            </a>
                          ) : (
                            item.source
                          )}{' '}
                          | {item.publishedDate}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-[12px] leading-5 text-slate-500">
                    No curated news yet. Source-backed notes will appear after manual review.
                  </p>
                )}
              </div>

              {/* 6. Data Confidence */}
              <div className="rounded-sm border border-slate-800 bg-[#04070d] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    Data Confidence
                  </span>
                  <span className="rounded-sm border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    Level {selectedThemeData.scorePolicy.confidenceLevel} |{' '}
                    {selectedThemeData.scorePolicy.label}
                  </span>
                </div>
                <p className="mt-2 text-[12px] leading-5 text-slate-500">
                  {selectedThemeData.hasMomentumData
                    ? selectedThemeData.hasManualContext
                      ? 'Price momentum and source-backed manual context connected.'
                      : 'Price momentum connected. Manual context limited.'
                    : selectedThemeData.scorePolicy.displayState === 'numeric_allowed'
                      ? 'Numeric score requires a documented calculation method.'
                      : 'Score hidden until enough real data is connected.'}{' '}
                  {!selectedThemeData.hasMomentumData &&
                    selectedThemeData.scorePolicy.explanation}
                </p>
              </div>

            </div>
          )}
        </div>

        {/* Guardrail footer */}
        <p className="rounded-sm border border-slate-800 bg-slate-950/40 px-3 py-2 text-[11px] leading-5 text-slate-500">
          {RADAR_BETA_GUARDRAIL}
        </p>

      </div>
    </section>
  )
}

