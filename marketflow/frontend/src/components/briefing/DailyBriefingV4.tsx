'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './DailyBriefingV3.module.css'
import { pickLang as pickUiLang, useContentLang, useUiLang } from '@/lib/useLangMode'

type Lang = 'en' | 'ko'

type TopicReview = {
  topic?: string
  status?: string
  max_impact_score?: number
  message?: string
  message_ko?: string
}

type TopDriver = {
  rank?: number
  title?: string
  title_ko?: string
  event_type?: string
  direction?: 'positive' | 'negative' | 'neutral' | string
  affected_assets?: string[]
  market_reaction?: string
  market_reaction_ko?: string
  transmission?: string
  transmission_ko?: string
  investor_implication?: string
  investor_implication_ko?: string
  confidence?: 'low' | 'medium' | 'high' | string
  market_impact_score?: number
}

type DailyBriefingV4Data = {
  generated_at: string
  data_date: string
  slot?: string
  model?: string
  hook?: string
  hook_ko?: string
  one_line?: string
  one_line_ko?: string
  market_verdict?: {
    regime?: string
    summary?: string
    summary_ko?: string
    confidence?: string
    primary_reason?: string
    primary_reason_ko?: string
  }
  price_tape?: {
    indices?: Record<string, string>
    rates_fx_vol?: Record<string, string>
    commodities?: Record<string, string>
    sector_leaders?: string[]
    sector_laggards?: string[]
    major_movers?: string[]
  }
  top_drivers?: TopDriver[]
  rotation_map?: {
    into?: string
    into_ko?: string
    out_of?: string
    out_of_ko?: string
    key_evidence?: string[]
  }
  next_session_playbook?: {
    watchpoints?: string[]
    bull_case?: string
    bull_case_ko?: string
    bear_case?: string
    bear_case_ko?: string
    key_levels?: string[]
  }
  risk_overlay?: {
    risk_level?: string
    message?: string
    message_ko?: string
    mss_score?: number
    mss_level?: number
    mss_zone?: string
  }
  optional_modules?: string[]
  topic_review?: TopicReview[]
  freshness?: {
    status?: string
    warning?: string
  }
}

type Props = {
  data: DailyBriefingV4Data | null
  initialContentLang?: Lang
}

const UI_TEXT = {
  title: { ko: '데일리 브리핑 V4', en: 'DAILY BRIEFING V4' },
  generated: { ko: '생성', en: 'Generated' },
  noBriefing: { ko: '아직 V4 브리핑이 없습니다.', en: 'No V4 briefing available yet.' },
  generate: { ko: '브리핑 생성', en: 'GENERATE BRIEFING' },
  generating: { ko: '생성 중...', en: 'GENERATING...' },
  refresh: { ko: '새로고침', en: 'REFRESH' },
  forceRegen: { ko: '강제 재생성', en: 'FORCE REGEN' },
  verdict: { ko: '마켓 버딕트', en: 'MARKET VERDICT' },
  priceTape: { ko: '가격 테이프', en: 'PRICE TAPE' },
  rotation: { ko: '로테이션', en: 'ROTATION & TRANSMISSION' },
  playbook: { ko: '다음 세션 플랜', en: 'NEXT SESSION PLAYBOOK' },
  topDrivers: { ko: '핵심 드라이버', en: 'TOP DRIVERS' },
  risk: { ko: '리스크 오버레이', en: 'RISK OVERLAY' },
  optional: { ko: '옵셔널 모듈', en: 'OPTIONAL MODULES' },
  topicReview: { ko: '토픽 리뷰', en: 'TOPIC REVIEW' },
} as const

function pick(en: string | undefined, ko: string | undefined, lang: Lang): string {
  if (lang === 'ko') return ko && ko.trim() ? ko : en || ''
  return en && en.trim() ? en : ko || ''
}

function formatDateTime(iso: string): string {
  try {
    const dt = new Date(iso)
    return dt.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }) + ' ET'
  } catch {
    return iso
  }
}

function formatSlot(slot: string | undefined, lang: Lang): string {
  const value = (slot || '').toLowerCase()
  if (value === 'preopen') return pickUiLang(lang, '장전', 'Pre-open')
  if (value === 'morning' || value === 'open') return pickUiLang(lang, '장중', 'Open')
  if (value === 'close') return pickUiLang(lang, '장마감', 'Close')
  return slot || '--'
}

function renderRecord(record: Record<string, string> | undefined): string {
  if (!record) return '-'
  const items = Object.entries(record)
  if (!items.length) return '-'
  return items.map(([k, v]) => `${k} ${v}`).join('  |  ')
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

export default function DailyBriefingV4({ data, initialContentLang = 'en' }: Props) {
  const router = useRouter()
  const uiLang = useUiLang()
  const contentLang = useContentLang(initialContentLang)
  const [lang, setLang] = useState<Lang>(contentLang)
  const [isGenerating, setIsGenerating] = useState(false)
  const [statusText, setStatusText] = useState('')

  useEffect(() => {
    setLang(contentLang)
  }, [contentLang])

  const runGenerate = useCallback(
    async (force: boolean, genLang?: Lang) => {
      try {
        setIsGenerating(true)
        setStatusText(
          force
            ? pickUiLang(uiLang, `${UI_TEXT.forceRegen.ko}...`, `${UI_TEXT.forceRegen.en}...`)
            : pickUiLang(uiLang, `${UI_TEXT.generate.ko}...`, `${UI_TEXT.generate.en}...`)
        )
        const res = await fetch('/api/daily-briefing-v4', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force, lang: genLang ?? 'ko' }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json?.ok) {
          throw new Error(String(json?.error || `HTTP ${res.status}`))
        }
        setStatusText(pickUiLang(uiLang, '완료', 'Done'))
        router.refresh()
      } catch (error) {
        setStatusText(String(error))
      } finally {
        setIsGenerating(false)
      }
    },
    [router, uiLang]
  )

  if (!data) {
    return (
      <section className={styles.shell}>
        <div className={styles.backGlowA} />
        <div className={styles.backGlowB} />
        <div className={styles.emptyPanel}>
          <p className={styles.emptyText}>{pickUiLang(uiLang, UI_TEXT.noBriefing.ko, UI_TEXT.noBriefing.en)}</p>
          <button
            type="button"
            className={`${styles.actionButton} ${styles.primaryAction}`}
            disabled={isGenerating}
            onClick={() => void runGenerate(true, lang)}
          >
            {isGenerating
              ? pickUiLang(uiLang, UI_TEXT.generating.ko, UI_TEXT.generating.en)
              : pickUiLang(uiLang, UI_TEXT.generate.ko, UI_TEXT.generate.en)}
          </button>
          {statusText ? <p className={styles.statusText}>{statusText}</p> : null}
        </div>
      </section>
    )
  }

  const verdict = data.market_verdict || {}
  const risk = data.risk_overlay || {}
  const playbook = data.next_session_playbook || {}
  const rotation = data.rotation_map || {}
  const modules = data.optional_modules || []
  const topicReview = data.topic_review || []
  const topDrivers = data.top_drivers || []
  const hook = pick(data.hook, data.hook_ko, lang)
  const oneLine = pick(data.one_line, data.one_line_ko, lang)

  return (
    <section className={styles.shell}>
      <div className={styles.backGlowA} />
      <div className={styles.backGlowB} />

      <header className={`${styles.panel} ${styles.headerPanel}`}>
        <div className={styles.headerTitleGroup}>
          <p className={styles.kicker}>{pickUiLang(uiLang, UI_TEXT.title.ko, UI_TEXT.title.en)}</p>
          <h1 className={styles.headline}>{hook || '--'}</h1>
          <p className={styles.subhead}>{oneLine || '--'}</p>
          <p className={styles.generatedMeta}>
            {pickUiLang(uiLang, UI_TEXT.generated.ko, UI_TEXT.generated.en)} {formatDateTime(data.generated_at)} ·
            {' '}
            {data.data_date} · {formatSlot(data.slot, uiLang)}
          </p>
        </div>
        <div className={styles.headerActions}>
          <LangToggle lang={lang} onChange={setLang} />
          <button
            type="button"
            className={styles.actionButton}
            disabled={isGenerating}
            onClick={() => void runGenerate(false, lang)}
          >
            {pickUiLang(uiLang, UI_TEXT.refresh.ko, UI_TEXT.refresh.en)}
          </button>
          <button
            type="button"
            className={`${styles.actionButton} ${styles.primaryAction}`}
            disabled={isGenerating}
            onClick={() => void runGenerate(true, lang)}
          >
            {pickUiLang(uiLang, UI_TEXT.forceRegen.ko, UI_TEXT.forceRegen.en)}
          </button>
          {statusText ? <span className={styles.statusText}>{statusText}</span> : null}
        </div>
      </header>

      <div className={styles.metaRow}>
        <span className={styles.metaChip}>regime {verdict.regime || '--'}</span>
        <span className={styles.metaChip}>confidence {verdict.confidence || '--'}</span>
        <span className={styles.metaChip}>risk {risk.risk_level || '--'}</span>
        <span className={styles.metaChip}>mss {risk.mss_score ?? '--'}</span>
        <span className={styles.metaChip}>model {data.model || '--'}</span>
        {data.freshness?.status ? <span className={styles.metaChip}>freshness {data.freshness.status}</span> : null}
      </div>

      <div className={styles.sectionGrid}>
        <article className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionIdTitle}>{pickUiLang(uiLang, UI_TEXT.verdict.ko, UI_TEXT.verdict.en)}</h2>
          </div>
          <div className={styles.sectionBlock}>
            <p className={styles.sectionText}>{pick(verdict.summary, verdict.summary_ko, lang) || '--'}</p>
            <p className={`${styles.sectionText} ${styles.implicationText}`}>{pick(verdict.primary_reason, verdict.primary_reason_ko, lang) || '--'}</p>
          </div>
        </article>

        <article className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionIdTitle}>{pickUiLang(uiLang, UI_TEXT.priceTape.ko, UI_TEXT.priceTape.en)}</h2>
          </div>
          <div className={styles.sectionBlock}>
            <span className={styles.sectionLabel}>indices</span>
            <p className={styles.sectionText}>{renderRecord(data.price_tape?.indices)}</p>
          </div>
          <div className={styles.sectionBlock}>
            <span className={styles.sectionLabel}>rates/fx/vol</span>
            <p className={styles.sectionText}>{renderRecord(data.price_tape?.rates_fx_vol)}</p>
          </div>
          <div className={styles.sectionBlock}>
            <span className={styles.sectionLabel}>commodities</span>
            <p className={styles.sectionText}>{renderRecord(data.price_tape?.commodities)}</p>
          </div>
        </article>

        <article className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionIdTitle}>{pickUiLang(uiLang, UI_TEXT.rotation.ko, UI_TEXT.rotation.en)}</h2>
          </div>
          <div className={styles.sectionBlock}>
            <span className={styles.sectionLabel}>into</span>
            <p className={styles.sectionText}>{pick(rotation.into, rotation.into_ko, lang) || '--'}</p>
          </div>
          <div className={styles.sectionBlock}>
            <span className={styles.sectionLabel}>out of</span>
            <p className={styles.sectionText}>{pick(rotation.out_of, rotation.out_of_ko, lang) || '--'}</p>
          </div>
          <div className={styles.sectionBlock}>
            <span className={styles.sectionLabel}>evidence</span>
            <p className={styles.sectionText}>{(rotation.key_evidence || []).join(' | ') || '--'}</p>
          </div>
        </article>

        <article className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionIdTitle}>{pickUiLang(uiLang, UI_TEXT.playbook.ko, UI_TEXT.playbook.en)}</h2>
          </div>
          <div className={styles.sectionBlock}>
            <span className={styles.sectionLabel}>watchpoints</span>
            <p className={styles.sectionText}>{(playbook.watchpoints || []).join(' | ') || '--'}</p>
          </div>
          <div className={styles.sectionBlock}>
            <span className={styles.sectionLabel}>bull case</span>
            <p className={styles.sectionText}>{pick(playbook.bull_case, playbook.bull_case_ko, lang) || '--'}</p>
          </div>
          <div className={styles.sectionBlock}>
            <span className={styles.sectionLabel}>bear case</span>
            <p className={styles.sectionText}>{pick(playbook.bear_case, playbook.bear_case_ko, lang) || '--'}</p>
          </div>
        </article>
      </div>

      <div className={`${styles.panel} ${styles.riskPanel}`}>
        <h2 className={styles.riskTitle}>{pickUiLang(uiLang, UI_TEXT.topDrivers.ko, UI_TEXT.topDrivers.en)}</h2>
        <div className={styles.sectionGrid}>
          {topDrivers.map((driver) => {
            const direction = String(driver.direction || 'neutral').toLowerCase()
            const signal =
              direction === 'positive' ? 'bull' : direction === 'negative' ? 'bear' : 'neutral'
            return (
              <article key={`${driver.rank}-${driver.title}`} className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <h3 className={styles.sectionIdTitle}>#{driver.rank} {pick(driver.title, driver.title_ko, lang)}</h3>
                  <span className={styles.signalBadge} style={{ borderColor: SIGNAL_COLOR[signal], color: SIGNAL_COLOR[signal] }}>
                    {direction}
                  </span>
                </div>
                <div className={styles.sectionBlock}>
                  <span className={styles.sectionLabel}>reaction</span>
                  <p className={styles.sectionText}>{pick(driver.market_reaction, driver.market_reaction_ko, lang) || '--'}</p>
                </div>
                <div className={styles.sectionBlock}>
                  <span className={styles.sectionLabel}>transmission</span>
                  <p className={styles.sectionText}>{pick(driver.transmission, driver.transmission_ko, lang) || '--'}</p>
                </div>
                <div className={styles.sectionBlock}>
                  <span className={styles.sectionLabel}>implication</span>
                  <p className={styles.sectionText}>{pick(driver.investor_implication, driver.investor_implication_ko, lang) || '--'}</p>
                </div>
              </article>
            )
          })}
        </div>
      </div>

      <div className={`${styles.panel} ${styles.riskPanel}`}>
        <h2 className={styles.riskTitle}>{pickUiLang(uiLang, UI_TEXT.risk.ko, UI_TEXT.risk.en)}</h2>
        <p className={styles.riskText}>{pick(risk.message, risk.message_ko, lang) || '--'}</p>
      </div>

      <div className={`${styles.panel} ${styles.oneLinePanel}`}>
        <h2 className={styles.riskTitle}>{pickUiLang(uiLang, UI_TEXT.optional.ko, UI_TEXT.optional.en)}</h2>
        <p className={styles.oneLineText}>{modules.join(' | ') || '--'}</p>
      </div>

      <div className={`${styles.panel} ${styles.oneLinePanel}`}>
        <h2 className={styles.riskTitle}>{pickUiLang(uiLang, UI_TEXT.topicReview.ko, UI_TEXT.topicReview.en)}</h2>
        <div className={styles.sectionGrid}>
          {topicReview.map((row) => (
            <article key={row.topic} className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionIdTitle}>{row.topic}</h3>
                <span className={styles.signalBadge}>{row.status || '--'}</span>
              </div>
              <p className={styles.sectionText}>{pick(row.message, row.message_ko, lang) || '--'}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

const SIGNAL_COLOR: Record<string, string> = {
  bull: '#22c55e',
  caution: '#f59e0b',
  bear: '#ef4444',
  neutral: '#64748b',
}

export type { DailyBriefingV4Data }
