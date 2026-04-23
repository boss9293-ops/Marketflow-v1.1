'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import styles from './DailyBriefingV3.module.css'
import { pickLang as pickUiLang, useContentLang, useUiLang } from '@/lib/useLangMode'
import { applyContentLangToDocument, persistContentLang } from '@/lib/uiLang'

export type BriefingV3Section = {
  id: string
  title: string
  structural: string
  structural_ko?: string
  implication: string
  implication_ko?: string
  signal: 'bull' | 'caution' | 'bear' | 'neutral'
  color: string
}

export type BriefingV3RiskCheck = {
  triggered: boolean
  level: number
  mss: number
  zone: string
  message: string
  color: string
}

export type DailyBriefingV3PromptMeta = {
  page?: string
  version?: string
  registry_version?: string
  release?: string
  key?: string
  source?: string
  fallback_used?: boolean
}

export type DailyBriefingV3Freshness = {
  status: 'fresh' | 'lagging' | 'stale' | 'unknown'
  lag_days: number | null
  current_et_date: string
  source_data_date: string
  overview_latest_date?: string
  market_state_generated_at?: string
  warning?: string
}

export type DailyBriefingV3Data = {
  generated_at: string
  data_date: string
  slot?: string
  model: string
  release?: string
  tokens: { input: number; output: number; cost_usd: number }
  freshness?: DailyBriefingV3Freshness
  prompt?: DailyBriefingV3PromptMeta
  hook: string
  hook_ko?: string
  sections: BriefingV3Section[]
  risk_check: BriefingV3RiskCheck
  one_line: string
  one_line_ko?: string
}

type Lang = 'en' | 'ko'

type Props = {
  data: DailyBriefingV3Data | null
  initialContentLang?: Lang
}

type BadgeTone = {
  text: string
  color: string
  border: string
  bg: string
}

const BRIEF_UI_TEXT = {
  dailyBriefing: { ko: '데일리 브리핑', en: 'DAILY BRIEFING' },
  generatedLabel: { ko: '생성', en: 'Generated' },
  noBriefing: { ko: '아직 브리핑이 없습니다.', en: 'No briefing available yet.' },
  generateBriefing: { ko: '브리핑 생성', en: 'GENERATE BRIEFING' },
  generating: { ko: '생성 중...', en: 'GENERATING...' },
  refresh: { ko: '새로고침', en: 'REFRESH' },
  forceRegen: { ko: '강제 재생성', en: 'FORCE REGEN' },
  marketHook: { ko: '마켓 훅', en: 'MARKET HOOK' },
  structural: { ko: 'A · 구조', en: 'A · STRUCTURAL' },
  implication: { ko: 'B · 해석', en: 'B · IMPLICATION' },
  noStructural: { ko: '구조 설명이 없습니다.', en: 'No structural text.' },
  noImplication: { ko: '해석 문장이 없습니다.', en: 'No implication text.' },
  riskCheck: { ko: '리스크 체크', en: 'RISK CHECK' },
  oneLine: { ko: '오늘의 한줄 요약', en: 'TODAY ONE-LINER' },
  slotLabel: { ko: '슬롯', en: 'SLOT' },
  asOfLabel: { ko: '기준일', en: 'AS OF' },
  modelLabel: { ko: '모델', en: 'MODEL' },
} as const

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'America/New_York',
    })
  } catch {
    return iso
  }
}

function formatTime(iso: string): string {
  try {
    return (
      new Date(iso).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/New_York',
        hour12: false,
      }) + ' ET'
    )
  } catch {
    return iso
  }
}

function formatDateKey(iso: string): string {
  try {
    const dtf = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const parts = dtf.formatToParts(new Date(iso))
    const year = parts.find((part) => part.type === 'year')?.value
    const month = parts.find((part) => part.type === 'month')?.value
    const day = parts.find((part) => part.type === 'day')?.value
    if (year && month && day) return `${year}-${month}-${day}`
  } catch {
    // fall through
  }
  return String(iso || '').slice(0, 10)
}

function formatSlotLabel(slot: string | undefined, uiLang: Lang): string | null {
  if (!slot) return null
  const normalized = slot.trim().toLowerCase()
  if (!normalized) return null
  if (normalized === 'preopen') return pickUiLang(uiLang, '장전', 'Pre-open')
  if (normalized === 'morning' || normalized === 'open') return pickUiLang(uiLang, '장시작후', 'Open')
  if (normalized === 'close') return pickUiLang(uiLang, '장마감후', 'Close')
  if (normalized === 'manual') return pickUiLang(uiLang, '수동', 'Manual')
  return slot
}

function pick(en: string, ko: string | undefined, lang: Lang): string {
  if (lang === 'ko') return ko && ko.trim() ? ko : en
  return en && en.trim() ? en : ''
}

function formatFreshnessBadge(freshness: DailyBriefingV3Freshness | undefined, uiLang: Lang): BadgeTone | null {
  if (!freshness || freshness.status === 'fresh' || freshness.status === 'unknown') return null
  const lag = typeof freshness.lag_days === 'number' ? `${freshness.lag_days}d` : '--'
  if (freshness.status === 'stale') {
    return {
      text: pickUiLang(uiLang, `소스 지연 ${lag}`, `Source stale ${lag}`),
      color: '#fecaca',
      border: '#7f1d1d',
      bg: 'rgba(127,29,29,0.3)',
    }
  }
  return {
    text: pickUiLang(uiLang, `소스 지연 ${lag}`, `Source lagging ${lag}`),
    color: '#fde68a',
    border: '#92400e',
    bg: 'rgba(146,64,14,0.26)',
  }
}

function formatPromptBadge(prompt: DailyBriefingV3PromptMeta | undefined, uiLang: Lang): BadgeTone | null {
  if (!prompt || !prompt.version) return null
  const source = prompt.source === 'registry' ? 'Prompt registry' : 'Prompt fallback'
  if (prompt.fallback_used) {
    return {
      text: `${source} ${prompt.version}`,
      color: '#fde68a',
      border: '#92400e',
      bg: 'rgba(146,64,14,0.26)',
    }
  }
  return {
    text: `${source} ${prompt.version}`,
    color: '#7dd3fc',
    border: '#075985',
    bg: 'rgba(7,89,133,0.25)',
  }
}

function signalTone(signal: BriefingV3Section['signal'], uiLang: Lang): BadgeTone {
  const map: Record<BriefingV3Section['signal'], BadgeTone> = {
    bull: {
      text: pickUiLang(uiLang, '강세', 'BULL'),
      color: '#86efac',
      border: '#166534',
      bg: 'rgba(22,101,52,0.25)',
    },
    caution: {
      text: pickUiLang(uiLang, '주의', 'CAUTION'),
      color: '#fde68a',
      border: '#92400e',
      bg: 'rgba(146,64,14,0.25)',
    },
    bear: {
      text: pickUiLang(uiLang, '약세', 'BEAR'),
      color: '#fca5a5',
      border: '#7f1d1d',
      bg: 'rgba(127,29,29,0.25)',
    },
    neutral: {
      text: pickUiLang(uiLang, '중립', 'NEUTRAL'),
      color: '#cbd5e1',
      border: '#334155',
      bg: 'rgba(15,23,42,0.65)',
    },
  }
  return map[signal] || map.neutral
}

function formatNumber(value: number | null | undefined): string {
  const safe = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return safe.toLocaleString('en-US')
}

function toneStyle(tone: BadgeTone): CSSProperties {
  return {
    color: tone.color,
    borderColor: tone.border,
    background: tone.bg,
  }
}

function LangToggle({ lang, onChange }: { lang: Lang; onChange: (next: Lang) => void }) {
  const items: { code: Lang; label: string }[] = [
    { code: 'en', label: 'EN' },
    { code: 'ko', label: 'KR' },
  ]
  return (
    <div className={styles.langToggle}>
      {items.map((item) => {
        const active = lang === item.code
        return (
          <button
            key={item.code}
            type="button"
            className={`${styles.langButton} ${active ? styles.langButtonActive : ''}`}
            onClick={() => onChange(item.code)}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

export default function DailyBriefingV3({ data, initialContentLang = 'en' }: Props) {
  const uiLang = useUiLang()
  const contentLang = useContentLang(initialContentLang)
  const [generating, setGenerating] = useState(false)
  const [genStatus, setGenStatus] = useState<string | null>(null)
  const [lang, setLang] = useState<Lang>(contentLang)
  const router = useRouter()

  useEffect(() => {
    setLang(contentLang)
  }, [contentLang])

  const handleGenerate = useCallback(
    async (force: boolean, genLang?: Lang) => {
      setGenerating(true)
      setGenStatus(null)
      try {
        const res = await fetch('/api/daily-briefing-v3', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force, lang: genLang ?? 'ko' }),
        })
        const json = await res.json()
        if (json.ok) {
          const newDate = json?.data?.generated_at
            ? formatDateKey(String(json.data.generated_at))
            : json?.data?.data_date
            ? String(json.data.data_date)
            : null
          setGenStatus(
            newDate
              ? pickUiLang(uiLang, `업데이트 ${json.elapsed}초 · ${newDate}`, `Updated in ${json.elapsed}s · ${newDate}`)
              : pickUiLang(uiLang, `업데이트 ${json.elapsed}초`, `Updated in ${json.elapsed}s`)
          )
          router.refresh()
        } else {
          setGenStatus(pickUiLang(uiLang, `오류: ${json.error}`, `Error: ${json.error}`))
        }
      } catch (err) {
        setGenStatus(pickUiLang(uiLang, `실패: ${String(err)}`, `Failed: ${String(err)}`))
      } finally {
        setGenerating(false)
      }
    },
    [router, uiLang]
  )

  const onContentLangChange = useCallback(
    (next: Lang) => {
      setLang(next)
      persistContentLang(next)
      applyContentLangToDocument(next)
      if (next === 'en' && data && !data.hook && !generating) {
        handleGenerate(false, 'en')
      }
    },
    [data, generating, handleGenerate]
  )

  if (!data) {
    return (
      <section className={styles.shell}>
        <div className={styles.emptyPanel}>
          <p className={styles.emptyText}>{pickUiLang(uiLang, BRIEF_UI_TEXT.noBriefing.ko, BRIEF_UI_TEXT.noBriefing.en)}</p>
          <button
            type="button"
            className={`${styles.actionButton} ${styles.primaryAction}`}
            onClick={() => handleGenerate(true)}
            disabled={generating}
          >
            {generating
              ? pickUiLang(uiLang, BRIEF_UI_TEXT.generating.ko, BRIEF_UI_TEXT.generating.en)
              : pickUiLang(uiLang, BRIEF_UI_TEXT.generateBriefing.ko, BRIEF_UI_TEXT.generateBriefing.en)}
          </button>
          {genStatus && <p className={styles.statusText}>{genStatus}</p>}
        </div>
      </section>
    )
  }

  const rc = data.risk_check
  const summaryLine = pick(data.one_line, data.one_line_ko, lang).trim()
  const hookLine = pick(data.hook, data.hook_ko, lang).trim()
  const heroLine = hookLine || summaryLine
  const generatedDateKey = formatDateKey(data.generated_at)
  const marketDateKey = String(data.data_date || '').trim()
  const titleDateKey = generatedDateKey || marketDateKey || '--'
  const slotLabel = formatSlotLabel(data.slot, uiLang)
  const freshnessBadge = formatFreshnessBadge(data.freshness, uiLang)
  const promptBadge = formatPromptBadge(data.prompt, uiLang)
  const sectionList = Array.isArray(data.sections) ? data.sections : []
  const riskTone: BadgeTone = rc.triggered
    ? { text: 'triggered', color: '#fecaca', border: rc.color || '#7f1d1d', bg: 'rgba(127,29,29,0.25)' }
    : { text: 'ok', color: '#86efac', border: '#166534', bg: 'rgba(22,101,52,0.24)' }

  return (
    <section className={styles.shell}>
      <div className={styles.backGlowA} />
      <div className={styles.backGlowB} />

      <header className={`${styles.panel} ${styles.headerPanel}`}>
        <div className={styles.headerTitleGroup}>
          <p className={styles.kicker}>
            {pickUiLang(uiLang, BRIEF_UI_TEXT.dailyBriefing.ko, BRIEF_UI_TEXT.dailyBriefing.en)} · {titleDateKey}
          </p>
          <h1 className={styles.headline}>Terminal Market Pulse</h1>
          <p className={styles.subhead}>Macro risk, structure, and action lane in one glance.</p>
          <p className={styles.generatedMeta}>
            {pickUiLang(uiLang, BRIEF_UI_TEXT.generatedLabel.ko, BRIEF_UI_TEXT.generatedLabel.en)} {formatDate(data.generated_at)} · {formatTime(data.generated_at)}
          </p>
        </div>

        <div className={styles.headerActions}>
          <LangToggle lang={lang} onChange={onContentLangChange} />
          <button
            type="button"
            className={styles.actionButton}
            onClick={() => handleGenerate(false, lang)}
            disabled={generating}
          >
            {generating
              ? pickUiLang(uiLang, BRIEF_UI_TEXT.generating.ko, BRIEF_UI_TEXT.generating.en)
              : pickUiLang(uiLang, BRIEF_UI_TEXT.refresh.ko, BRIEF_UI_TEXT.refresh.en)}
          </button>
          <button
            type="button"
            className={`${styles.actionButton} ${styles.primaryAction}`}
            onClick={() => handleGenerate(true, lang)}
            disabled={generating}
          >
            {pickUiLang(uiLang, BRIEF_UI_TEXT.forceRegen.ko, BRIEF_UI_TEXT.forceRegen.en)}
          </button>
          {genStatus && <span className={styles.statusText}>{genStatus}</span>}
        </div>
      </header>

      <div className={`${styles.panel} ${styles.heroPanel}`}>
        <div className={styles.heroLabel}>{pickUiLang(uiLang, BRIEF_UI_TEXT.marketHook.ko, BRIEF_UI_TEXT.marketHook.en)}</div>
        <p className={styles.heroText}>{heroLine}</p>
      </div>

      <div className={styles.metaRow}>
        {marketDateKey && (
          <span className={styles.metaChip}>
            {pickUiLang(uiLang, BRIEF_UI_TEXT.asOfLabel.ko, BRIEF_UI_TEXT.asOfLabel.en)} {marketDateKey}
          </span>
        )}
        {slotLabel && (
          <span className={styles.metaChip}>
            {pickUiLang(uiLang, BRIEF_UI_TEXT.slotLabel.ko, BRIEF_UI_TEXT.slotLabel.en)} {slotLabel}
          </span>
        )}
        {freshnessBadge && (
          <span className={styles.metaChip} style={toneStyle(freshnessBadge)}>
            {freshnessBadge.text}
          </span>
        )}
        {promptBadge && (
          <span className={styles.metaChip} style={toneStyle(promptBadge)}>
            {promptBadge.text}
          </span>
        )}
        <span className={styles.metaChip}>
          {pickUiLang(uiLang, BRIEF_UI_TEXT.modelLabel.ko, BRIEF_UI_TEXT.modelLabel.en)} {data.model}
        </span>
      </div>

      <div className={styles.sectionGrid}>
        {sectionList.map((section, index) => {
          const structural = pick(section.structural, section.structural_ko, lang)
          const implication = pick(section.implication, section.implication_ko, lang)
          const signal = signalTone(section.signal, uiLang)
          return (
            <article key={section.id} className={styles.sectionCard} style={{ borderColor: `${section.color}66` }}>
              <div className={styles.sectionHeader}>
                <p className={styles.sectionIdTitle} style={{ color: section.color }}>
                  {String(index + 1).padStart(2, '0')} · {section.title}
                </p>
                <span className={styles.signalBadge} style={toneStyle(signal)}>
                  {signal.text}
                </span>
              </div>

              <div className={styles.sectionBlock}>
                <div className={styles.sectionLabel}>{pickUiLang(uiLang, BRIEF_UI_TEXT.structural.ko, BRIEF_UI_TEXT.structural.en)}</div>
                <p className={styles.sectionText}>
                  {structural || pickUiLang(uiLang, BRIEF_UI_TEXT.noStructural.ko, BRIEF_UI_TEXT.noStructural.en)}
                </p>
              </div>

              <div className={styles.sectionBlock}>
                <div className={styles.sectionLabel} style={{ color: section.color }}>
                  {pickUiLang(uiLang, BRIEF_UI_TEXT.implication.ko, BRIEF_UI_TEXT.implication.en)}
                </div>
                <p className={`${styles.sectionText} ${styles.implicationText}`}>
                  {implication || pickUiLang(uiLang, BRIEF_UI_TEXT.noImplication.ko, BRIEF_UI_TEXT.noImplication.en)}
                </p>
              </div>
            </article>
          )
        })}
      </div>

      <div className={`${styles.panel} ${styles.riskPanel}`} style={{ borderColor: riskTone.border, background: riskTone.bg }}>
        <div className={styles.riskTitle} style={{ color: riskTone.color }}>
          {pickUiLang(uiLang, BRIEF_UI_TEXT.riskCheck.ko, BRIEF_UI_TEXT.riskCheck.en)} · {rc.triggered ? `L${rc.level}` : 'OK'} · MSS {rc.mss}
        </div>
        <p className={styles.riskText}>{rc.message}</p>
      </div>

      <div className={`${styles.panel} ${styles.oneLinePanel}`}>
        <div className={styles.oneLineLabel}>{pickUiLang(uiLang, BRIEF_UI_TEXT.oneLine.ko, BRIEF_UI_TEXT.oneLine.en)}</div>
        <p className={styles.oneLineText}>{pick(data.one_line, data.one_line_ko, lang)}</p>
      </div>

      <footer className={styles.footerMeta}>
        {formatNumber(data.tokens?.input) + formatNumber(data.tokens?.output)} tokens · ${Number(data.tokens?.cost_usd || 0).toFixed(5)}
      </footer>
    </section>
  )
}
