import type { CSSProperties } from 'react'
import { cookies } from 'next/headers'
import { CONTENT_LANG_COOKIE, normalizeContentLang } from '@/lib/uiLang'
import ContentLangToggle from '@/components/ContentLangToggle'
import { readCacheJson } from '@/lib/readCacheJson'
import { type Current90dCache } from '@/lib/vrLive'
import VRSurvival, {
  type Tab,
  VRSurvivalData,
} from '@/components/crash/vr/VRSurvival'
import SoxlLeadershipPanel, { type SoxxContextPayload } from '@/components/crash/vr/SoxlLeadershipPanel'
import SoxlPlaybackPanel, { type SoxxSurvivalPlaybackArchive } from '@/components/crash/vr/SoxlPlaybackPanel'
import VRRiskTracksCard           from '@/components/vr/VRRiskTracksCard'
import { buildStrategyArena, type StrategyArenaView } from '../../../../../vr/arena/compute_strategy_arena'
import {
  buildVRPlaybackTransportView,
  type RawStandardPlaybackArchive,
  type RawVRSurvivalPlaybackArchive,
  type VRPlaybackEventOverrides,
  type VRPlaybackView,
} from '../../../../../vr/playback/vr_playback_loader'

type RiskV1CurrentSnapshot = {
  score: number | null
  scoreName: string | null
  scoreZone: string | null
  level: number | null
  levelLabel: string | null
  eventType: string | null
  finalRisk: string | null
  finalExposure: number | null
  brief: string | null
  date: string | null
  price: number | null
  ma50: number | null
  ma200: number | null
  ddPct: number | null
  volPct: number | null
  daysBelowMa200: number | null
  trend: number | null
  depth: number | null
  vol: number | null
  dd: number | null
}

async function readRiskV1Current(): Promise<RiskV1CurrentSnapshot> {
  try {
    const data = await readCacheJson<Record<string, unknown> | null>('risk_v1.json', null)
    const current = (data as Record<string, unknown>)?.current as Record<string, unknown> ?? {}
    const context = current?.context as Record<string, unknown> ?? {}
    return {
      score: current?.score as number ?? null,
      scoreName: current?.score_name as string ?? null,
      scoreZone: current?.score_zone as string ?? null,
      level: current?.level as number ?? null,
      levelLabel: current?.level_label as string ?? null,
      eventType: current?.event_type as string ?? null,
      finalRisk: context?.final_risk as string ?? null,
      finalExposure: context?.final_exposure as number ?? null,
      brief: context?.brief as string ?? null,
      date: current?.date as string ?? null,
      price: current?.price as number ?? null,
      ma50: current?.ma50 as number ?? null,
      ma200: current?.ma200 as number ?? null,
      ddPct: current?.dd_pct as number ?? null,
      volPct: current?.vol_pct as number ?? null,
      daysBelowMa200: current?.days_below_ma200 as number ?? null,
      trend: (current?.components as Record<string, unknown> | undefined)?.trend as number ?? null,
      depth: (current?.components as Record<string, unknown> | undefined)?.depth as number ?? null,
      vol: (current?.components as Record<string, unknown> | undefined)?.vol as number ?? null,
      dd: (current?.components as Record<string, unknown> | undefined)?.dd as number ?? null,
    }
  } catch {
    return {
      score: null, scoreName: null, scoreZone: null, level: null,
      levelLabel: null, eventType: null, finalRisk: null,
      finalExposure: null, brief: null, date: null,
      price: null, ma50: null, ma200: null, ddPct: null, volPct: null,
      daysBelowMa200: null, trend: null, depth: null, vol: null, dd: null,
    }
  }
}

type PlaybackArtifacts = {
  playbackData: VRPlaybackView | null
  strategyArena: StrategyArenaView | null
}

const FALLBACK_POOL_LOGIC: VRSurvivalData['pool_logic'] = {
  level_pools: [
    { level: 0, label: 'Normal', pool: 0, exposure: 100, color: '#22c55e' },
    { level: 1, label: 'Caution', pool: 25, exposure: 75, color: '#f59e0b' },
    { level: 2, label: 'Warning', pool: 50, exposure: 50, color: '#f97316' },
    { level: 3, label: 'High Risk', pool: 75, exposure: 25, color: '#ef4444' },
    { level: 4, label: 'Crisis', pool: 100, exposure: 0, color: '#7c3aed' },
  ],
}

function buildFallbackSurvivalData(
  riskV1: RiskV1CurrentSnapshot,
  runId?: string,
): VRSurvivalData | null {
  const exposurePct =
    typeof riskV1.finalExposure === 'number'
      ? Math.max(0, Math.min(100, riskV1.finalExposure))
      : 100
  const poolPct = Math.max(0, Math.min(100, 100 - exposurePct))
  const score = riskV1.score ?? 50
  const level = riskV1.level ?? 1
  const levelLabel = riskV1.levelLabel ?? 'Unknown'
  const today = new Date().toISOString().slice(0, 10)

  return {
    run_id: runId ?? `vr_survival_fallback_${riskV1.date ?? today}`,
    current: {
      score,
      level,
      level_label: levelLabel,
      state: riskV1.eventType ?? 'Fallback',
      pool_pct: poolPct,
      exposure_pct: exposurePct,
      survival_active: true,
      explain:
        riskV1.brief ??
        'vr_survival.json is missing, so this page is using a fallback view built from Risk System v1 and placeholder playback data.',
      structural_state: riskV1.scoreZone ?? 'Fallback',
      shock_cooldown: 0,
      days_below_ma200: riskV1.daysBelowMa200 ?? 0,
      price: riskV1.price ?? 1,
      ma50: riskV1.ma50 ?? 1,
      ma200: riskV1.ma200 ?? 1,
      dd_pct: riskV1.ddPct ?? 0,
      vol_pct: riskV1.volPct ?? 0,
      components: {
        trend: riskV1.trend ?? 0,
        depth: riskV1.depth ?? 0,
        vol: riskV1.vol ?? 0,
        dd: riskV1.dd ?? 0,
      },
    },
    pool_logic: FALLBACK_POOL_LOGIC,
  }
}

async function loadPlaybackArtifacts(simParams?: {
  event_id?: string
  sim_start?: string
  sim_capital?: string
  sim_stock_pct?: string
}, focusEventId?: string): Promise<PlaybackArtifacts> {
  const [standardArchive, survivalArchive] = await Promise.all([
    readCacheJson<RawStandardPlaybackArchive | null>('risk_v1_playback.json', null),
    readCacheJson<RawVRSurvivalPlaybackArchive | null>('vr_survival_playback.json', null),
  ])

  if (!standardArchive || !survivalArchive) {
    return { playbackData: null, strategyArena: null }
  }

  const eventOverrides: VRPlaybackEventOverrides | undefined =
    simParams?.event_id && /^\d{4}-\d{2}$/.test(simParams.event_id)
      ? {
          event_id: simParams.event_id,
          simulation_start_date: simParams.sim_start,
          initial_capital: Number(simParams.sim_capital) || undefined,
          stock_allocation_pct: Number(simParams.sim_stock_pct) || undefined,
        }
      : undefined

  let playbackData: VRPlaybackView | null = null
  let strategyArena: StrategyArenaView | null = null

  try {
    playbackData =
      buildVRPlaybackTransportView({
        standardArchive,
        survivalArchive,
        rootDir: process.cwd(),
        eventOverrides,
        focusEventId,
      }) as VRPlaybackView | null
  } catch {
    playbackData = null
  }

  try {
    strategyArena = buildStrategyArena({ standardArchive, survivalArchive }) ?? null
  } catch {
    strategyArena = null
  }

  return { playbackData, strategyArena }
}


function toSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function buildAssetHref(
  nextAsset: 'tqqq' | 'soxl',
  params: {
    tab?: string | string[]
    event?: string | string[]
    sim_event?: string | string[]
    sim_start?: string | string[]
    sim_capital?: string | string[]
    sim_stock_pct?: string | string[]
  },
) {
  const search = new URLSearchParams()
  search.set('asset', nextAsset)
  const tab = toSingleValue(params.tab)
  if (tab) search.set('tab', tab)

  if (nextAsset === 'tqqq') {
    const event = toSingleValue(params.event)
    const simEvent = toSingleValue(params.sim_event)
    const simStart = toSingleValue(params.sim_start)
    const simCapital = toSingleValue(params.sim_capital)
    const simStockPct = toSingleValue(params.sim_stock_pct)

    if (tab) search.set('tab', tab)
    if (event) search.set('event', event)
    if (simEvent) search.set('sim_event', simEvent)
    if (simStart) search.set('sim_start', simStart)
    if (simCapital) search.set('sim_capital', simCapital)
    if (simStockPct) search.set('sim_stock_pct', simStockPct)
  }

  return `?${search.toString()}`
}

const NAV_ITEMS = [
  { href: '/risk-v1', label: 'Standard (QQQ)', accent: '#f59e0b', border: 'rgba(245,158,11,0.26)', bg: 'rgba(245,158,11,0.08)' },
  { href: '/backtest', label: 'Backtests', accent: '#38bdf8', border: 'rgba(56,189,248,0.26)', bg: 'rgba(56,189,248,0.08)' },
  { href: '/crash', label: 'Crash Hub', accent: '#fb7185', border: 'rgba(251,113,133,0.26)', bg: 'rgba(251,113,133,0.08)' },
  { href: '/dashboard', label: 'Dashboard', accent: '#22c55e', border: 'rgba(34,197,94,0.26)', bg: 'rgba(34,197,94,0.08)' },
] as const

const ROLE_SPLIT_COPY =
  'Standard는 위험을 감지하고, Live는 현재 움직임을 보여주며, VR은 그 구간에서 어떤 대응 전략이 유효했는지를 보여줍니다.'

const HERO_TEXT = {
  tqqq: {
    subtitle: {
      en: 'See live TQQQ/SOXL movement first, then confirm your reasoning with Playback and Backtest — a survival analysis engine.',
      ko: 'TQQQ/SOXL의 현재 움직임을 먼저 보고, Playback과 Backtest로 근거를 확인하는 생존 분석 엔진',
    },
    body: {
      en: 'This system is a simulation engine built on the VR (Value Rebalancing) strategy for studying market responses in downturns. It shows live motion first, then uses Playback and Backtest as evidence layers to validate judgment.',
      ko: '이 시스템은 VR(Value Rebalancing) 전략을 기반으로, 하락장에서의 대응 방식을 연구하는 시뮬레이션 엔진입니다. 지금은 live motion을 먼저 보여주고, Playback과 Backtest는 그 판단의 근거를 확인하는 증거 레이어로 사용합니다.',
    },
    disclaimer: {
      en: 'This engine does not provide real-time buy/sell signals. It is a reference tool for understanding how to respond to market conditions.',
      ko: '이 엔진은 실시간 매수·매도 신호를 제공하지 않습니다. 시장 대응 방법을 이해하기 위한 참고 도구입니다.',
    },
  },
  soxl: {
    subtitle: {
      en: 'Read SOXL from a hold perspective using SOXX as anchor — trade tactically only when breadth and flow align.',
      ko: 'SOXL은 기본적으로 보유(Hold) 관점에서 읽되, SOXX를 앵커로 두고 breadth와 수급이 맞을 때만 전술적으로 다룹니다.',
    },
    body: {
      en: "The AI semiconductor cycle unfolds in two phases: ① First-wave excitement (GPU order surge) → ② Monetization Reset (revenue reassessment). This 5-step analysis determines which phase we're in and whether SOXL leverage is warranted. Read in order: 1) Runway 2) Cycle Drivers 3) Supply/Demand 4) Leadership 5) Decision Rules. Hold SOXX long-term; use SOXL tactically only when First-wave onset + broad supply advantage + leadership breadth are all confirmed. Capital preservation first during Reset phases.",
      ko: 'AI 반도체 사이클은 두 단계를 거칩니다: ① First-wave excitement (GPU 주문 폭증) → ② Monetization Reset (수익화 재평가). 이 페이지는 현재 어느 단계에 있는지, SOXL 레버리지를 쓸 수 있는지를 판단하기 위한 5단계 분석입니다. 읽는 순서는: 1) Runway(전망) 2) Cycle Drivers(원인) 3) Supply/Demand(수급) 4) Leadership(확산도) 5) Decision Rules(결정). SOXX는 장기 보유, SOXL은 First-wave 초기 + 넓은 수급 우위 확인 + 리더십 확산이 명확할 때만 전술적으로 사용합니다. Reset 구간에서는 업황이 양호해도 자본 보존이 우선입니다.',
    },
    disclaimer: {
      en: 'This view is a research brief for reading semiconductor cycles and external sensitivity — not a buy/sell signal. Default conclusion is Hold; adjust SOXL tactical weight only in exceptional cases.',
      ko: '이 화면은 매수/매도 신호가 아니라, 반도체 사이클과 외부 민감도를 읽는 리서치 브리프입니다. 기본 결론은 Hold, 예외적으로만 SOXL 전술 비중을 조정합니다.',
    },
  },
} as const

export default async function VRSurvivalPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined }
}) {
  const contentLang = normalizeContentLang(cookies().get(CONTENT_LANG_COOKIE)?.value)
  const assetParam = toSingleValue(searchParams?.asset)
  const asset = assetParam === 'soxl' ? 'soxl' : 'tqqq'
  const isSoxl = asset === 'soxl'
  const soxlTab = toSingleValue(searchParams?.tab) === 'Playback' ? 'Playback' : 'Live'
  
  const requestedTab = toSingleValue(searchParams?.tab)
  const normalizedRequestedTab = requestedTab === 'Overview' ? 'Live' : requestedTab
  const requestedEvent = toSingleValue(searchParams?.event)
  const VALID_TABS: Tab[] = ['Live', 'Backtest', 'Playback']
  const initialTab: Tab = (normalizedRequestedTab && VALID_TABS.includes(normalizedRequestedTab as Tab)) ? (normalizedRequestedTab as Tab) : 'Live'
  const initialPlaybackEventId =
    requestedEvent && /^\d{4}-\d{2}$/.test(requestedEvent) ? requestedEvent : undefined
  const simEventId = toSingleValue(searchParams?.sim_event)
  const simStart = toSingleValue(searchParams?.sim_start)
  const simCapital = toSingleValue(searchParams?.sim_capital)
  const simStockPct = toSingleValue(searchParams?.sim_stock_pct)
  const simParams =
    simEventId && /^\d{4}-\d{2}$/.test(simEventId)
      ? {
          event_id: simEventId,
          sim_start: simStart,
          sim_capital: simCapital,
          sim_stock_pct: simStockPct,
        }
      : undefined
  const [raw, riskV1, current90d, playbackArtifacts, soxxContext, soxxPlaybackArchive] = await Promise.all([
    readCacheJson<VRSurvivalData | null>('vr_survival.json', null),
    readRiskV1Current(),
    readCacheJson<Current90dCache | null>('current_90d.json', null),
    loadPlaybackArtifacts(simParams, initialPlaybackEventId),
    isSoxl
      ? readCacheJson<SoxxContextPayload | null>('soxx_context.json', null)
      : Promise.resolve(null),
    isSoxl
      ? readCacheJson<SoxxSurvivalPlaybackArchive | null>('soxx_survival_playback.json', null)
      : Promise.resolve(null),
  ])
  const { playbackData, strategyArena } = playbackArtifacts
  const effectiveRaw = raw ?? buildFallbackSurvivalData(riskV1)
  const cl = contentLang
  const heroText = isSoxl ? HERO_TEXT.soxl : HERO_TEXT.tqqq
  const heroSubtitle = heroText.subtitle[cl]
  const heroBody = heroText.body[cl]
  const disclaimer = heroText.disclaimer[cl]

  if (!effectiveRaw && asset === 'tqqq') {
    return (
      <main style={{ padding: '2.6rem', color: '#94a3b8', fontFamily: 'monospace' }}>
        <h2 style={{ color: '#ef4444' }}>vr_survival.json not found</h2>
        <p>
          Run:{' '}
          <code style={{ background: '#111827', padding: '0.26rem 0.65rem', borderRadius: 6 }}>
            py marketflow/backend/scripts/build_vr_survival.py
          </code>
        </p>
        <a href="/risk-v1" style={{ color: '#818cf8' }}>
          Risk System v1
        </a>
      </main>
    )
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top left, rgba(56,189,248,0.12), transparent 28%), radial-gradient(circle at top right, rgba(244,63,94,0.10), transparent 26%), linear-gradient(180deg, #090c13 0%, #0c0e13 48%, #090b10 100%)',
        color: '#e5e7eb',
        fontFamily: "var(--font-ui-sans, var(--font-terminal), 'Nanum Gothic Coding', 'Noto Sans KR', monospace)",
        padding: '1.35rem 1.5rem',
      }}
    >
      <div style={{ maxWidth: 1360, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              {isSoxl ? 'MARKETFLOW - SEMICONDUCTOR RESEARCH' : 'MARKETFLOW - SURVIVAL LAB'}
            </div>
            <h1 style={{ fontSize: '2.3rem', fontWeight: 900, color: '#f8fafc', margin: '0.35rem 0 0' }}>
              {isSoxl ? 'Semiconductor Regime Monitor' : 'VR Survival Lab'}
            </h1>
            <div style={{ fontSize: '0.92rem', color: '#94a3b8', marginTop: 8, lineHeight: 1.6, maxWidth: 760 }}>
              {heroSubtitle}
            </div>
            <div style={{ fontSize: '0.9rem', color: '#cbd5e1', marginTop: 10, lineHeight: 1.75, maxWidth: 860 }}>
              {heroBody}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 8, lineHeight: 1.6, maxWidth: 860 }}>
              {disclaimer}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <ContentLangToggle value={contentLang} />
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                style={{
                  ...navLinkStyle,
                  color: item.accent,
                  borderColor: item.border,
                  background: item.bg,
                  boxShadow: `0 0 0 1px ${item.border} inset`,
                }}
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>

        {/* Asset Switcher (TQQQ vs SOXL) */}
        <div style={{ display: 'flex', gap: 12, margin: '0.5rem 0' }}>
          <a
            href={buildAssetHref('tqqq', searchParams ?? {})}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: 8,
              fontSize: '1.05rem',
              fontWeight: 800,
              textDecoration: 'none',
              color: asset === 'tqqq' ? '#f8fafc' : '#94a3b8',
              background: asset === 'tqqq' ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${asset === 'tqqq' ? 'rgba(56,189,248,0.5)' : 'rgba(255,255,255,0.1)'}`,
              transition: 'all 0.2s ease',
            }}
          >
            🔴 TQQQ (NASDAQ-100)
          </a>
          <a
            href={buildAssetHref('soxl', searchParams ?? {})}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: 8,
              fontSize: '1.05rem',
              fontWeight: 800,
              textDecoration: 'none',
              color: asset === 'soxl' ? '#f8fafc' : '#94a3b8',
              background: asset === 'soxl' ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${asset === 'soxl' ? 'rgba(56,189,248,0.5)' : 'rgba(255,255,255,0.1)'}`,
              transition: 'all 0.2s ease',
            }}
          >
            🔵 SOXL (Semiconductor & AI)
          </a>
        </div>

        {asset === 'tqqq' ? (
          <>
            <div style={{ fontSize: '0.66rem', color: '#7dd3fc', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }}>
              STEP 1 OF 3 — MARKET CONDITION (STANDARD)
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)',
                gap: 12,
                alignItems: 'stretch',
              }}
            >
              <VRRiskTracksCard snapshot={riskV1} />

              <div
                style={{
                  borderRadius: 14,
                  border: '1px solid rgba(56,189,248,0.16)',
                  background: 'linear-gradient(180deg, rgba(8,16,28,0.96), rgba(7,11,18,0.98))',
                  padding: '1.05rem 1.1rem',
                  display: 'grid',
                  gap: 10,
                  boxShadow: '0 0 0 1px rgba(56,189,248,0.08) inset',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: '#7dd3fc', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 800 }}>
                  What VR Does
                </div>
                <div style={{ fontSize: '1.02rem', color: '#f8fafc', lineHeight: 1.7, fontWeight: 800 }}>
                  VR은 시장을 예측하는 엔진이 아니라, 하락장에서 어떻게 살아남는지를 보여주는 엔진입니다.
                </div>
                <div style={{ fontSize: '0.92rem', color: '#cbd5e1', lineHeight: 1.7 }}>
                  정답을 지시하지 않습니다. 대신 가능한 대응 방법과 그 결과를 비교해 보여줍니다.
                </div>
                <div style={{ fontSize: '0.86rem', color: '#94a3b8', lineHeight: 1.65 }}>
                  {ROLE_SPLIT_COPY}
                </div>
              </div>
            </div>

            <FlowDivider
              step="STEP 2 OF 3"
              label="LIVE + EVIDENCE"
              desc="Live는 현재 TQQQ 움직임과 DD를 보여주고, Playback과 Backtest는 그 해석의 근거를 확인합니다."
            />

            <VRSurvival
              data={effectiveRaw!}
              current90d={current90d}
              playbackData={playbackData}
              strategyArena={strategyArena}
              initialTab={initialTab}
              initialPlaybackEventId={initialPlaybackEventId}
              simParams={simParams}
            />

            <div style={{ fontSize: '0.75rem', color: '#475569', textAlign: 'center', paddingTop: '0.4rem' }}>
              Generated: {effectiveRaw?.run_id ?? 'Unknown'} - VR Survival Lab
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
                marginBottom: '0.85rem',
              }}
            >
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={{ fontSize: '0.72rem', color: '#7dd3fc', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }}>
                  SOXL View Modes
                </div>
                <div style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.65, maxWidth: 780 }}>
                  <b style={{ color: '#7dd3fc' }}>Live</b> — 현재 반도체 사이클의 위치(레짐)와 SOXL 전술 판단을 보여줍니다. 먼저 이 탭으로 "지금 어디에 있는가"를 읽으세요.
                  {'  '}<b style={{ color: '#a78bfa' }}>Playback</b> — 과거 SOXX 충격 구간에서 SOXL 대응이 어떻게 작동했는지 역사적 증거를 확인합니다. "왜 Hold가 기본값인지"를 이해하는 데 필요한 부록입니다.
                </div>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, border: '1px solid rgba(148, 163, 184, 0.16)', background: 'rgba(15, 23, 42, 0.72)', overflow: 'hidden' }}>
                {[
                  { label: 'Live', active: soxlTab === 'Live' },
                  { label: 'Playback', active: soxlTab === 'Playback' },
                ].map((item) => (
                  <a
                    key={item.label}
                    href={buildAssetHref('soxl', { ...searchParams, tab: item.label })}
                    style={{
                      padding: '0.62rem 0.95rem',
                      minWidth: 104,
                      textAlign: 'center',
                      textDecoration: 'none',
                      color: item.active ? '#08111f' : '#e2e8f0',
                      background: item.active
                        ? 'linear-gradient(180deg, #7dd3fc 0%, #38bdf8 100%)'
                        : 'transparent',
                      fontSize: '0.78rem',
                      fontWeight: 900,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      borderRight: item.label === 'Live' ? '1px solid rgba(148,163,184,0.12)' : 'none',
                    }}
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
            {soxlTab === 'Playback' ? <SoxlPlaybackPanel archive={soxxPlaybackArchive} /> : <SoxlLeadershipPanel context={soxxContext} />}
          </>
        )}
      </div>
    </main>
  )
}

function FlowDivider({ step, label, desc }: { step: string; label: string; desc: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '0.35rem 0' }}>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, rgba(56,189,248,0.35), transparent)' }} />
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        minWidth: 0,
        padding: '0.28rem 0.75rem',
        borderRadius: 999,
        border: '1px solid rgba(56,189,248,0.18)',
        background: 'rgba(15,23,42,0.92)',
      }}>
        <div style={{ fontSize: '0.62rem', color: '#7dd3fc', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 800, whiteSpace: 'nowrap' }}>
          {step} — {label}
        </div>
        <div style={{ fontSize: '0.71rem', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', maxWidth: 480 }}>
          {desc}
        </div>
      </div>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, rgba(251,113,133,0.35), transparent)' }} />
    </div>
  )
}

const navLinkStyle: CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 700,
  display: 'inline-flex',
  alignItems: 'center',
  textDecoration: 'none',
  padding: '0.45rem 0.95rem',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  background: 'rgba(255,255,255,0.02)',
  transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
}


