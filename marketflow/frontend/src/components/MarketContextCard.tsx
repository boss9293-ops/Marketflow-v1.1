'use client'

import { useEffect, useState } from 'react'
import { buildMarketNarrative } from '@/lib/market-context/narrativeBuilder'
import { postProcessNews } from '@/lib/market-context/newsPostProcess'
import { selectMarketTone, type ToneName } from '@/lib/market-context/toneSelector'

// ── Types ──────────────────────────────────────────────────────────────────────

type Props = {
  macro: {
    lpiBand?: string | null
    rpiBand?: string | null
    vriBand?: string | null
    xconfLabel?: string | null
    ghedgeLabel?: string | null
    mps?: number | null
    snapshotDate?: string | null
  }
  health: {
    breadthScore?: number | null
    participationLabel?: string | null
    trendStrengthBand?: string | null
    shsScore?: number | null
  }
  state: {
    regimeLabel?: string | null
    crashPhase?: boolean
    riskToken?: string | null
    shockFlag?: boolean
    marketStale?: boolean
  }
  validation?: {
    status?: 'OK' | 'Watch' | null
    snapshotDate?: string | null
  }
  news?: {
    headline?: string | null
    summary?: string | null
    status?: string | null
    sources?: Array<{ title?: string | null; publisher?: string | null; published_at?: string | null; url?: string | null }> | null
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function panelClassByTone(tone: ToneName): string {
  if (tone === 'Calm')      return 'from-emerald-500/10 to-emerald-400/5 border-emerald-400/20'
  if (tone === 'Confirm')   return 'from-sky-500/10 to-sky-400/5 border-sky-400/20'
  if (tone === 'Caution')   return 'from-amber-500/10 to-amber-400/5 border-amber-400/20'
  if (tone === 'Defensive') return 'from-rose-500/10 to-red-500/5 border-rose-400/20'
  return 'from-slate-500/10 to-slate-400/5 border-slate-400/20'
}

function toneKo(tone: ToneName): string {
  const map: Record<string, string> = {
    Calm: '무난', Confirm: '확인 모드', Caution: '주의', Defensive: '방어 우선',
  }
  return map[tone] || '충격 감시'
}

function structureLevel(health: Props['health']): '강' | '중립' | '약' {
  const p = String(health.participationLabel || '').toLowerCase()
  const t = String(health.trendStrengthBand || '').toLowerCase()
  const b = typeof health.breadthScore === 'number' ? health.breadthScore : null
  if ((b !== null && b >= 70) || p.includes('broad') || p.includes('strong') || t.includes('strong')) return '강'
  if ((b !== null && b <= 40) || p.includes('weak')  || p.includes('narrow') || t.includes('weak'))   return '약'
  return '중립'
}

function sensorChipCls(v: string): string {
  if (v === 'Tight' || v === 'Restrictive' || v === 'Expanding' || v === 'Stress')
    return 'border-amber-400/30 text-amber-300 bg-amber-500/10'
  if (v === 'Easy' || v === 'Easing' || v === 'Compressed' || v === 'Align')
    return 'border-emerald-400/30 text-emerald-300 bg-emerald-500/10'
  return 'border-slate-400/30 text-slate-200 bg-slate-500/10'
}

function statusCls(status: string): string {
  if (status === 'Fresh' || status === 'OK')       return 'border-emerald-400/30 text-emerald-300 bg-emerald-500/10'
  if (status === 'Partial' || status === 'Watch')  return 'border-amber-400/30 text-amber-300 bg-amber-500/10'
  return 'border-slate-400/30 text-slate-200 bg-slate-500/10'
}

// ── Component ─────────────────────────────────────────────────────────────────
//
// SSOT 설계 원칙:
//   1) useEffect → /api/context/narrative 가 SSOT (서버 생성 나레이티브)
//   2) buildMarketNarrative (로컬) 는 API 미응답 시 폴백 전용
//   3) MacroRoomV2 의 buildMarketNarrative 직접 호출은 이 컴포넌트와 중복이므로
//      MacroRoomV2 에서는 간략 해석(interpretLiquidity 등) 헤드라인만 사용하고
//      풀 나레이티브 블록은 제거 권장 (별도 작업 필요)

export default function MarketContextCard(props: Props) {
  const [open, setOpen]   = useState(true)
  const [apiReady, setApiReady] = useState(false)

  // ── Server narrative state (SSOT) ──────────────────────────────────────────
  const [narrativeMode, setNarrativeMode] = useState<'template' | 'premium_ai' | 'template_fallback'>('template')
  const [lastGenerated,  setLastGenerated]  = useState<string | null>(null)
  const [serverBlocks,   setServerBlocks]   = useState<string[] | null>(null)
  const [serverHeadline, setServerHeadline] = useState<string | null>(null)
  const [serverTags,     setServerTags]     = useState<string[] | null>(null)
  const [premiumLines,   setPremiumLines]   = useState<string[] | null>(null)
  const [premiumLoading, setPremiumLoading] = useState(false)

  // ── Portfolio placeholder (server-driven) ─────────────────────────────────
  const [showPortfolioPlaceholder,  setShowPortfolioPlaceholder]  = useState(false)
  const [portfolioPlaceholderMsg,   setPortfolioPlaceholderMsg]   = useState<string | null>(null)
  const [showPortfolioNote,         setShowPortfolioNote]         = useState(false)

  const API_BASE           = process.env.NEXT_PUBLIC_BACKEND_API         || 'http://localhost:5001'
  const ENABLE_PREMIUM_LLM = (process.env.NEXT_PUBLIC_ENABLE_PREMIUM_LLM || 'false').toLowerCase() === 'true'
  const ENABLE_PORTFOLIO   = (process.env.NEXT_PUBLIC_ENABLE_PORTFOLIO_PLACEHOLDER || 'true').toLowerCase() === 'true'

  // ── Local fallback (used only when API is unavailable) ────────────────────
  const processed    = postProcessNews(props.news?.sources || [], 6)
  const newsQuality  = processed.quality
  const newsItems    = processed.selected
  const weakStructure = structureLevel(props.health) === '약'
  const bandValues   = [props.macro.lpiBand, props.macro.rpiBand, props.macro.vriBand]
    .map((v) => String(v || '').trim()).filter(Boolean)
  const mixedSignals =
    Boolean(props.health.shsScore != null && props.health.shsScore >= 40 && props.health.shsScore <= 60) ||
    (bandValues.length >= 2 && new Set(bandValues).size >= 2)

  const tone = selectMarketTone({
    macro: {
      lpiBand:    props.macro.lpiBand,
      rpiBand:    props.macro.rpiBand,
      vriBand:    props.macro.vriBand,
      xconfState: props.macro.xconfLabel,
      mps:        props.macro.mps,
      partial:    String(props.validation?.status || '') === 'Watch' || newsQuality === 'Partial',
      stale:      false,
    },
    health: { shsScore: props.health.shsScore ?? props.health.breadthScore ?? null, breadthWeak: weakStructure, mixedSignals },
    risk:   { riskToken: props.state.riskToken, shockFlag: props.state.shockFlag || props.state.crashPhase },
    data:   { macroStale: false, marketStale: props.state.marketStale },
  })

  // Local fallback narrative (only rendered when !apiReady)
  const fallbackNarrative = buildMarketNarrative({
    toneCode: tone.toneCode,
    toneName: tone.toneName,
    sensors: {
      lpiBand:   props.macro.lpiBand,
      rpiBand:   props.macro.rpiBand,
      vriBand:   props.macro.vriBand,
      xconf:     props.macro.xconfLabel,
      ghedge:    props.macro.ghedgeLabel,
      structure: structureLevel(props.health),
    },
    articles: newsItems,
  })

  const snapshotDate = props.validation?.snapshotDate || props.macro.snapshotDate || '—'
  const sensors = [
    { k: 'LPI',   v: props.macro.lpiBand  || 'NA' },
    { k: 'RPI',   v: props.macro.rpiBand  || 'NA' },
    { k: 'VRI',   v: props.macro.vriBand  || 'NA' },
    { k: 'XCONF', v: props.macro.xconfLabel || 'NA' },
  ]

  // ── SSOT fetch ────────────────────────────────────────────────────────────
  // All narrative rendering is driven by this single API call.
  // buildMarketNarrative above is ONLY the fallback when this fails.
  function applyApiResponse(json: any) {
    const mode = String(json?.mode || 'template') as typeof narrativeMode
    setNarrativeMode(mode)
    if (typeof json?.headline === 'string')        setServerHeadline(json.headline)
    if (Array.isArray(json?.tone_short_tags))      setServerTags(json.tone_short_tags.map(String))
    if (Array.isArray(json?.blocks))               setServerBlocks(json.blocks.map(String))
    setLastGenerated(typeof json?.last_generated === 'string' ? json.last_generated : null)
    setShowPortfolioPlaceholder(Boolean(json?.portfolio_placeholder_enabled))
    setPortfolioPlaceholderMsg(typeof json?.portfolio_placeholder_message === 'string' ? json.portfolio_placeholder_message : null)
    if (Array.isArray(json?.llm_lines) && json.llm_lines.length > 0) {
      setPremiumLines(json.llm_lines.map(String))
    }
    setApiReady(true)
  }

  useEffect(() => {
    let alive = true
    const params = new URLSearchParams({
      region:     'us',
      risk_token: props.state.riskToken || '',
      shock_flag: String(Boolean(props.state.shockFlag || props.state.crashPhase)),
    })
    fetch(`${API_BASE}/api/context/narrative?${params.toString()}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((json) => { if (alive) applyApiResponse(json) })
      .catch(() => { if (alive) setApiReady(false) }) // silently use fallback
    return () => { alive = false }
  }, [API_BASE, props.state.crashPhase, props.state.riskToken, props.state.shockFlag])

  const onGeneratePremium = async () => {
    setPremiumLoading(true)
    try {
      const params = new URLSearchParams({
        region:     'us',
        risk_token: props.state.riskToken || '',
        shock_flag: String(Boolean(props.state.shockFlag || props.state.crashPhase)),
        premium:    'true',
        force:      'true',
      })
      const res  = await fetch(`${API_BASE}/api/context/narrative?${params.toString()}`, { cache: 'no-store' })
      const json = res.ok ? await res.json() : null
      if (json) applyApiResponse(json)
      if (!Array.isArray(json?.llm_lines) || json.llm_lines.length === 0) setPremiumLines(null)
    } catch {
      setNarrativeMode('template_fallback')
      setPremiumLines(null)
    } finally {
      setPremiumLoading(false)
    }
  }

  // ── Resolved display values ───────────────────────────────────────────────
  const displayHeadline  = serverHeadline || fallbackNarrative.title
  const displaySubtitle  = serverTags?.length ? serverTags.join(' · ') : fallbackNarrative.subtitle
  const displayBlocks    = (narrativeMode === 'premium_ai' && premiumLines?.length)
    ? premiumLines
    : (serverBlocks?.length ? serverBlocks : fallbackNarrative.paragraphs)

  return (
    <div className={`rounded-2xl p-6 border bg-gradient-to-br ${panelClassByTone(tone.toneName)}`}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-slate-300">
            <span className="mf-bil-ko">시장 컨텍스트</span>
            <span className="mf-bil-en">Market Context</span>
          </div>
          <h2 className="text-[1.9rem] md:text-[2.2rem] font-bold text-white mt-1 leading-tight">
            <span className="mf-bil-ko">{displayHeadline} — {toneKo(tone.toneName)}</span>
            <span className="mf-bil-en">{displayHeadline}</span>
          </h2>
          <div className="text-sm text-slate-300 mt-1">
            <span className="mf-bil-ko">{serverTags?.length ? serverTags.join(' · ') : tone.subtitleTags.join(' · ')}</span>
            <span className="mf-bil-en">{fallbackNarrative.subtitle}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2 py-0.5 rounded-full text-xs border ${statusCls(newsQuality)}`}>
            News: {newsQuality}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-xs border ${
            narrativeMode === 'premium_ai'
              ? 'border-sky-400/30 text-sky-300 bg-sky-500/10'
              : apiReady
                ? 'border-white/20 text-slate-100 bg-white/5'
                : 'border-slate-600/30 text-slate-400 bg-slate-800/20'
          }`}>
            {narrativeMode === 'premium_ai' ? 'Premium AI' : apiReady ? 'Server' : 'Local fallback'}
          </span>
          <span className="px-2 py-0.5 rounded-full text-xs border border-white/20 text-slate-100 bg-white/5">{snapshotDate}</span>
          {lastGenerated && (
            <span className="px-2 py-0.5 rounded-full text-xs border border-white/20 text-slate-300 bg-white/5">
              {String(lastGenerated).slice(0, 16).replace('T', ' ')}
            </span>
          )}
          {ENABLE_PREMIUM_LLM && (
            <button
              type="button"
              onClick={onGeneratePremium}
              disabled={premiumLoading}
              className="px-2 py-0.5 rounded-full text-xs border border-sky-400/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20 disabled:opacity-60"
            >
              <span className="mf-bil-ko">{premiumLoading ? '생성 중...' : '프리미엄 브리핑 생성'}</span>
              <span className="mf-bil-en">{premiumLoading ? 'Generating...' : 'Generate Premium Brief'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="px-2 py-0.5 rounded-full text-xs border border-white/20 bg-white/5 text-slate-100 hover:bg-white/10"
          >
            <span className="mf-bil-ko">{open ? '접기' : '펼치기'}</span>
            <span className="mf-bil-en">{open ? 'Collapse' : 'Expand'}</span>
          </button>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      {open && (
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Narrative blocks */}
          <div className="lg:col-span-2 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="space-y-2">
              {displayBlocks.slice(0, 12).map((p, i) => (
                <p key={i} className="text-sm leading-relaxed text-slate-200">{p}</p>
              ))}
            </div>

            {/* Portfolio placeholder — server-driven flag only */}
            {ENABLE_PORTFOLIO && showPortfolioPlaceholder && (
              <div className="mt-4 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowPortfolioNote((v) => !v)}
                  className="text-xs px-2 py-1 rounded border border-white/20 text-slate-200 bg-white/5"
                  title={portfolioPlaceholderMsg || '포트폴리오 연동은 다음 릴리즈에서 활성화됩니다.'}
                >
                  내 계좌 기준 코칭 (준비중)
                </button>
                {showPortfolioNote && (
                  <div className="text-xs text-slate-400 mt-1">
                    {portfolioPlaceholderMsg || '현재는 시장 센서 기반 브리핑만 제공합니다. 포트폴리오 연동은 다음 릴리즈에서 활성화됩니다.'}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sensor evidence */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">
              <span className="mf-bil-ko">근거 센서</span>
              <span className="mf-bil-en">Sensor Evidence</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {sensors.map((s) => (
                <span key={s.k} className={`px-2 py-0.5 rounded-full text-[11px] border ${sensorChipCls(s.v)}`}>
                  {s.k}:{s.v}
                </span>
              ))}
            </div>
            <details className="mt-4">
              <summary className="text-xs text-slate-400 cursor-pointer">
                <span className="mf-bil-ko">출처 보기</span>
                <span className="mf-bil-en">Sources</span>
              </summary>
              <div className="mt-2 space-y-1">
                {(newsItems.length > 0 ? newsItems : props.news?.sources || []).slice(0, 2).map((s, i) => (
                  <div key={`${s.url || s.title || i}`} className="text-xs text-slate-300">
                    <a href={s.url || '#'} target="_blank" rel="noreferrer" className="hover:underline">
                      {s.title || 'Untitled'}
                    </a>
                    <span className="text-slate-500"> · {s.publisher || 'Unknown'} · {String(s.published_at || '').slice(0, 16).replace('T', ' ')}</span>
                  </div>
                ))}
                {fallbackNarrative.sources.length > 0 && (
                  <div className="text-xs text-slate-400 pt-1">
                    Sources: {fallbackNarrative.sources.join(', ')}
                  </div>
                )}
              </div>
            </details>
          </div>
        </div>
      )}
    </div>
  )
}
