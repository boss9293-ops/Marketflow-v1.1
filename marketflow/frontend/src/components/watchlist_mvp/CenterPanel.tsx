import { useEffect, useMemo, useRef, useState } from 'react'

import SourceTable from '@/components/watchlist_mvp/SourceTable'
import styles from '@/components/watchlist_mvp/watchlistMvp.module.css'
import { useContentLang } from '@/lib/useLangMode'
import type {
  ETDateString,
  ETTimezone,
  EvidenceRow,
  NewsDetail,
  TickerNewsItem,
} from '@/lib/terminal-mvp/types'

type SectionStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error'
type ExportUiStatus = 'idle' | 'submitting' | 'success' | 'error'
type AskStatus = 'idle' | 'submitting' | 'ready' | 'error'

type CenterPanelProps = {
  selectedSymbol: string
  selectedItem: {
    symbol: string
    companyName?: string
    lastPrice: string
    changePercent: string
    rangeLabel: string
  } | null
  dateET: ETDateString
  timezone: ETTimezone
  timeline: TickerNewsItem[]
  timelineStatus: SectionStatus
  timelineError: string | null
  selectedNewsId: string | null
  onSelectNews: (item: TickerNewsItem) => void
  isDetailOpen: boolean
  detailStatus: SectionStatus
  detailError: string | null
  detail: NewsDetail | null
  onExportNews: (newsId: string) => Promise<unknown>
  askQuestionInput: string
  onAskQuestionInputChange: (value: string) => void
  onAskSubmit: () => Promise<void>
  askStatus: AskStatus
  askError: string | null
  askAnswerKo: string
  activeSessionId: string | null
  evidenceRows: EvidenceRow[]
  evidenceStatus: SectionStatus
  evidenceError: string | null
  onExportEvidenceToSheet: (sessionId: string) => Promise<unknown>
  onCloseDetail: () => void
  onRefreshNews: () => void
  isRefreshLocked?: boolean
  isNewsRefreshing: boolean
  newsLastFetchedAt: Date | null
  todayOpen: number | null
  todayHigh: number | null
  todayLow: number | null
  todayClose: number | null
  todayCloseSymbol: string | null
  todayVolume: number | null
  ohlcvByDate?: Map<string, { close: number; changePct: number | null }>
}

const formatMetadataValue = (value?: string | number | null): string =>
  value == null || value === '' ? 'N/A' : String(value)

const formatPrice = (value: number): string => `$${value.toFixed(2)}`

const formatCompactNumber = (value: number): string => {
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return `${Math.round(value)}`
}

const parseLooseNumber = (value?: string | number | null): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value !== 'string') return null

  const normalized = value
    .replace(/[%,$\s]/g, '')
    .replace(/[^0-9.-]/g, '')

  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const normalizeNewsText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const NEWS_CATALYST_KEYWORDS = [
  'earnings',
  'guidance',
  'analyst',
  'target',
  'rating',
  'upgrade',
  'downgrade',
  'revenue',
  'margin',
  'delivery',
  'deliveries',
  'shipment',
  'shipments',
  'order',
  'orders',
  'contract',
  'deal',
  'approval',
  'regulation',
  'probe',
  'tariff',
  'export',
  'supply chain',
  'ai',
  'artificial intelligence',
  'chip',
  'chips',
  'semiconductor',
  'semiconductors',
  'gpu',
  'data center',
  'cloud',
  'hyperscaler',
  'blackwell',
  'cuda',
  'inference',
  'server',
  'power',
  'oil',
  'crude',
  'rate',
  'rates',
  'inflation',
  'fed',
  'cpi',
  'ppi',
  'yield',
  'treasury',
  'geopolitical',
  'china',
  'iran',
  'israel',
  'cyber',
  'hack',
  'antitrust',
]

const TICKER_NEWS_DISPLAY_DAYS = 4

const NEWS_NOISE_KEYWORDS = [
  'sneaker',
  'fashion',
  'movie',
  'concert',
  'recipe',
  'celebrity',
  'sports',
  'wedding',
  'gossip',
  'travel',
  'airline',
  'hotel',
  'restaurant',
  'music',
  'beauty',
  'lifestyle',
]

const COMPANY_STOPWORDS = new Set([
  'inc',
  'incorporated',
  'corporation',
  'corp',
  'company',
  'co',
  'ltd',
  'limited',
  'holdings',
  'holding',
  'class',
  'common',
  'shares',
  'share',
])

const scoreNewsItem = (
  item: TickerNewsItem,
  symbol: string,
  companyName?: string,
): number => {
  const text = normalizeNewsText(`${item.headline || ''} ${item.summary || ''}`)
  const normalizedSymbol = normalizeNewsText(symbol)
  let score = 0

  if (normalizedSymbol && text.includes(normalizedSymbol)) {
    score += 6
  }

  const companyTokens = normalizeNewsText(companyName ?? '')
    .split(' ')
    .filter((token) => token.length >= 4 && !COMPANY_STOPWORDS.has(token))

  if (companyTokens.some((token) => text.includes(token))) {
    score += 4
  }

  if (NEWS_CATALYST_KEYWORDS.some((keyword) => text.includes(keyword))) {
    score += 3
  }

  if (NEWS_NOISE_KEYWORDS.some((keyword) => text.includes(keyword))) {
    score -= 3
  }

  if (!normalizedSymbol && !companyTokens.length) {
    score -= 1
  }

  return score
}

const buildMarketLead = (
  symbol: string,
  todayOpen: number | null,
  todayHigh: number | null,
  todayLow: number | null,
  todayClose: number | null,
  todayVolume: number | null,
  selectedItem: {
    lastPrice: string
    rangeLabel: string
  } | null,
): string => {
  const clauses: string[] = []

  if (todayOpen != null && todayClose != null) {
    clauses.push(`opened at ${formatPrice(todayOpen)} and closed at ${formatPrice(todayClose)}`)
  } else if (todayOpen != null) {
    clauses.push(`opened at ${formatPrice(todayOpen)}`)
  } else if (todayClose != null) {
    clauses.push(`closed at ${formatPrice(todayClose)}`)
  } else if (selectedItem?.lastPrice) {
    clauses.push(`last traded at ${selectedItem.lastPrice}`)
  }

  const baseForRange = todayOpen ?? todayClose
  if (todayHigh != null && todayLow != null && baseForRange != null && baseForRange > 0) {
    const rangePct = ((todayHigh - todayLow) / baseForRange) * 100
    if (Number.isFinite(rangePct)) {
      clauses.push(`trading in a ${rangePct.toFixed(2)}% intraday range`)
    }
  } else if (selectedItem?.rangeLabel) {
    clauses.push(selectedItem.rangeLabel.replace(/^Day Range(?: placeholder)?[:\s-]*/i, 'daily range '))
  }

  if (todayVolume != null) {
    clauses.push(`on ${formatCompactNumber(todayVolume)} shares`)
  }

  if (!clauses.length) return `${symbol}.`
  return `${symbol} ${clauses.join(', ')}.`
}

const stripLeadingTerminalNumbering = (text: string): string =>
  text.replace(/^\s*(?:\d+[.)]|[-*])\s*/u, '').trim()

const getCurrentEtDate = (): ETDateString =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

const getCurrentEtMinutes = (): number => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0')
  return hour * 60 + minute
}

const parseClockMinutes = (value: string): number | null => {
  const match = value.match(/(\d{1,2}):(\d{2})/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  return hour * 60 + minute
}

const formatTerminalDateLabel = (dateET: ETDateString): string => {
  const parsed = new Date(`${dateET}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return dateET
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
  })
    .format(parsed)
    .toUpperCase()
  return `${dateET}  ${weekday}`
}

const formatPublishedEtLabel = (
  publishedAtET: string,
  fallbackDateET?: string,
  fallbackTimeET?: string,
): string => {
  const raw = publishedAtET?.trim()
  if (raw) {
    const parsed = new Date(raw)
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: false,
        timeZoneName: 'short',
      }).format(parsed)
    }
    const etMatch = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?\s*ET$/)
    if (etMatch) {
      return `${etMatch[1]} ${etMatch[2]} ET`
    }
    return raw.replace('T', ' ')
  }
  const date = fallbackDateET?.trim() || ''
  const time = fallbackTimeET?.trim() || ''
  if (date && time) return `${date} ${time} ET`
  if (date) return date
  if (time) return `${time} ET`
  return 'N/A'
}

const formatTimelineDateHeader = (dateKey: string): string => {
  const parsed = new Date(`${dateKey}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return dateKey
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed)
}

const getNewsDateKey = (item: TickerNewsItem): string => {
  const matched = item.publishedAtET.match(/^\d{4}-\d{2}-\d{2}/)
  return matched?.[0] ?? item.dateET
}

const toBriefText = (
  symbol: string,
  item: TickerNewsItem,
  todayOpen: number | null,
  todayClose: number | null,
): string => {
  const headline = (item.headline || '').trim()
  const summary = (item.summary || '').trim()
  const body = [headline, summary].filter(Boolean).join(' ')
  // 09:30 ET -> open, 16:30 ET -> close
  const timeKey = item.timeET || ''
  const isOpen  = timeKey.startsWith('09:30') || timeKey.startsWith('9:30')
  const isClose = timeKey.startsWith('16:30')
  const price = isOpen ? todayOpen : isClose ? todayClose : null
  const priceStr = price != null ? ` $${price.toFixed(2)}` : ''
  const prefix = `${symbol}${priceStr}`
  return body ? `${prefix} ${body}` : prefix
}

export default function CenterPanel({
  selectedSymbol,
  selectedItem,
  dateET,
  timezone,
  timeline = [],
  timelineStatus,
  timelineError,
  selectedNewsId,
  onSelectNews,
  isDetailOpen,
  detailStatus,
  detailError,
  detail,
  onExportNews,
  askQuestionInput,
  onAskQuestionInputChange,
  onAskSubmit,
  askStatus,
  askError,
  askAnswerKo,
  activeSessionId,
  evidenceRows,
  evidenceStatus,
  evidenceError,
  onExportEvidenceToSheet,
  onCloseDetail,
  onRefreshNews,
  isRefreshLocked = false,
  isNewsRefreshing,
  newsLastFetchedAt,
  todayOpen,
  todayHigh,
  todayLow,
  todayClose,
  todayCloseSymbol,
  todayVolume,
  ohlcvByDate,
}: CenterPanelProps) {
  const dateLabel = useMemo(() => formatTerminalDateLabel(dateET), [dateET])
  const marketLead = useMemo(
    () => buildMarketLead(
      selectedSymbol,
      todayOpen,
      todayHigh,
      todayLow,
      todayClose,
      todayVolume,
      selectedItem,
    ),
    [selectedSymbol, todayOpen, todayHigh, todayLow, todayClose, todayVolume, selectedItem],
  )
  const newsMarketContext = useMemo(() => {
    const parts: string[] = []
    if (selectedItem?.lastPrice) parts.push(`${selectedSymbol} ${selectedItem.lastPrice}`)
    if (selectedItem?.changePercent) parts.push(`change ${selectedItem.changePercent}`)
    if (selectedItem?.rangeLabel) parts.push(selectedItem.rangeLabel)
    const joined = parts.filter(Boolean).join(' | ').trim()
    return joined || marketLead
  }, [marketLead, selectedItem, selectedSymbol])
  const currentEtDate = getCurrentEtDate()
  const currentEtMinutes = getCurrentEtMinutes()
  const groupedTimeline = useMemo(() => {
    const grouped = new Map<string, TickerNewsItem[]>()
    const recentDateKeys = Array.from(new Set(timeline.map((item) => item.dateET)))
      .sort((a, b) => b.localeCompare(a))
      .slice(0, TICKER_NEWS_DISPLAY_DAYS)
    const recentDateSet = new Set(recentDateKeys)
    const recentItems = timeline.filter((item) => recentDateSet.has(item.dateET))
    const visibleItems =
      dateET === currentEtDate
        ? (() => {
            const pastItems = recentItems.filter((item) => {
              const itemMinutes = parseClockMinutes(item.timeET)
              if (itemMinutes == null) return true
              return itemMinutes <= currentEtMinutes
            })
            // If we are pre-open and nothing has elapsed yet, surface the recent window
            // instead of showing a blank panel.
            return pastItems.length ? pastItems : recentItems
          })()
        : recentItems

    visibleItems
      .forEach((item) => {
        const dateKey = getNewsDateKey(item)
        const items = grouped.get(dateKey) ?? []
        items.push(item)
        grouped.set(dateKey, items)
      })
    return Array.from(grouped.entries())
      .map(([dateKey, items]) => ({
        dateKey,
        dateLabel: formatTimelineDateHeader(dateKey),
        items: [...items].sort((a, b) => b.publishedAtET.localeCompare(a.publishedAtET)),
      }))
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
  }, [currentEtDate, currentEtMinutes, dateET, timeline])
  const contentLang = useContentLang()
  const [langMode, setLangMode] = useState<'EN' | 'KR'>(contentLang === 'ko' ? 'KR' : 'EN')
  const [synthEN, setSynthEN] = useState<Map<string, string>>(new Map())
  const [synthKO, setSynthKO] = useState<Map<string, string>>(new Map())
  const [isSynthesizingEN, setIsSynthesizingEN] = useState(false)
  const [isSynthesizingKO, setIsSynthesizingKO] = useState(false)
  const digestGenerationRef = useRef(0)
  const synthENRequested = useRef<Set<string>>(new Set())
  const synthKORequested = useRef<Set<string>>(new Set())
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [synthSignal, setSynthSignal] = useState<Map<string, 'bull' | 'bear' | 'neutral'>>(new Map())
  const [synthCommentaryType, setSynthCommentaryType] = useState<Map<string, string>>(new Map())
  const [synthCoreQuestion, setSynthCoreQuestion] = useState<Map<string, string>>(new Map())
  const [synthWatchNext, setSynthWatchNext] = useState<Map<string, string[]>>(new Map())

  const [exportStatus, setExportStatus] = useState<ExportUiStatus>('idle')
  const [exportFeedback, setExportFeedback] = useState<string | null>(null)

  useEffect(() => {
    setLangMode(contentLang === 'ko' ? 'KR' : 'EN')
  }, [contentLang])

  // Reset synthesized content when the session context changes, but keep the chosen language mode.
  useEffect(() => {
    digestGenerationRef.current += 1
    setSynthEN(new Map())
    setSynthKO(new Map())
    synthENRequested.current = new Set()
    synthKORequested.current = new Set()
    setIsSynthesizingEN(false)
    setIsSynthesizingKO(false)
    setExpandedItems(new Set())
    setSynthSignal(new Map())
    setSynthCommentaryType(new Map())
    setSynthCoreQuestion(new Map())
    setSynthWatchNext(new Map())
  }, [dateET, selectedSymbol, todayClose, todayCloseSymbol])

  // EN auto synthesis — only when EN mode
  useEffect(() => {
    if (langMode !== 'EN') return
    if (todayClose == null || todayCloseSymbol !== selectedSymbol) return
    const pendingGroups = groupedTimeline.filter(g =>
      g.items.some(item => !synthENRequested.current.has(item.id))
    )
    if (!pendingGroups.length) return
    const requestGeneration = digestGenerationRef.current
    const requestSymbol = selectedSymbol
    setIsSynthesizingEN(true)
    const runAll = async () => {
      try {
        await Promise.allSettled(pendingGroups.map(async (group) => {
          const groupPending = group.items.filter(item => !synthENRequested.current.has(item.id))
          if (!groupPending.length) return
          groupPending.forEach(item => synthENRequested.current.add(item.id))
          const groupOhlcv = ohlcvByDate?.get(group.dateKey)
          const digestPrice = groupOhlcv?.close ?? parseLooseNumber(selectedItem?.lastPrice) ?? todayClose
          const digestChangePct = groupOhlcv?.changePct ?? parseLooseNumber(selectedItem?.changePercent) ?? null
          const payload = groupPending.map(item => ({
            id: item.id,
            dateET: item.dateET,
            publishedAtET: item.publishedAtET,
            timeET: item.timeET,
            headline: item.headline ?? '',
            summary: item.summary ?? '',
            source: item.source ?? '',
            url: item.url ?? '',
          }))
          const res = await fetch('/api/terminal/news-synthesize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              symbol: requestSymbol,
              companyName: selectedItem?.companyName ?? '',
              dateET: group.dateKey,
              price: digestPrice,
              changePct: digestChangePct,
              session: 'auto',
              items: payload,
              lang: 'en',
              marketContext: newsMarketContext,
            }),
          })
          if (!res.ok || digestGenerationRef.current !== requestGeneration) return
          const data = await res.json() as { results: Array<{ id: string; text: string; signal?: string; commentary_type?: string; core_question?: string; watch_next?: string[] }> }
          if (digestGenerationRef.current !== requestGeneration) return
          setSynthEN(prev => {
            const next = new Map(prev)
            for (const r of data.results) next.set(r.id, r.text.trim())
            return next
          })
          setSynthSignal(prev => {
            const next = new Map(prev)
            for (const r of data.results) {
              const sig = r.signal === 'bull' || r.signal === 'bear' ? r.signal : 'neutral'
              next.set(r.id, sig)
            }
            return next
          })
          setSynthCommentaryType(prev => {
            const next = new Map(prev)
            for (const r of data.results) if (r.commentary_type) next.set(r.id, r.commentary_type)
            return next
          })
          setSynthCoreQuestion(prev => {
            const next = new Map(prev)
            for (const r of data.results) if (r.core_question) next.set(r.id, r.core_question)
            return next
          })
          setSynthWatchNext(prev => {
            const next = new Map(prev)
            for (const r of data.results) if (Array.isArray(r.watch_next) && r.watch_next.length) next.set(r.id, r.watch_next)
            return next
          })
        }))
      } catch { /* ignore */ } finally {
        if (digestGenerationRef.current === requestGeneration) setIsSynthesizingEN(false)
  }
}

    void runAll()
  }, [langMode, groupedTimeline, selectedItem?.companyName, selectedItem?.changePercent, selectedItem?.lastPrice, selectedSymbol, dateET, todayClose, todayCloseSymbol])

  // KR 踰꾪듉 ?대┃ ???쒓뎅???⑹꽦
  // KO synthesis — one call per date group (triggered on langMode=KR)
  useEffect(() => {
    if (langMode !== 'KR') return
    if (todayClose == null || todayCloseSymbol !== selectedSymbol) return
    const pendingGroups = groupedTimeline.filter(g =>
      g.items.some(item => !synthKORequested.current.has(item.id))
    )
    if (!pendingGroups.length) return
    const requestGeneration = digestGenerationRef.current
    const requestSymbol = selectedSymbol
    setIsSynthesizingKO(true)
    const runAll = async () => {
      try {
        await Promise.allSettled(pendingGroups.map(async (group) => {
          const groupPending = group.items.filter(item => !synthKORequested.current.has(item.id))
          if (!groupPending.length) return
          groupPending.forEach(item => synthKORequested.current.add(item.id))
          const groupOhlcv = ohlcvByDate?.get(group.dateKey)
          const digestPrice = groupOhlcv?.close ?? parseLooseNumber(selectedItem?.lastPrice) ?? todayClose
          const digestChangePct = groupOhlcv?.changePct ?? parseLooseNumber(selectedItem?.changePercent) ?? null
          const payload = groupPending.map(item => ({
            id: item.id,
            dateET: item.dateET,
            publishedAtET: item.publishedAtET,
            timeET: item.timeET,
            headline: item.headline ?? '',
            summary: item.summary ?? '',
            source: item.source ?? '',
            url: item.url ?? '',
          }))
          const res = await fetch('/api/terminal/news-synthesize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              symbol: requestSymbol,
              companyName: selectedItem?.companyName ?? '',
              dateET: group.dateKey,
              price: digestPrice,
              changePct: digestChangePct,
              session: 'auto',
              items: payload,
              lang: 'ko',
              marketContext: newsMarketContext,
            }),
          })
          if (!res.ok || digestGenerationRef.current !== requestGeneration) return
          const data = await res.json() as { results: Array<{ id: string; text: string; signal?: string; commentary_type?: string; core_question?: string; watch_next?: string[] }> }
          if (digestGenerationRef.current !== requestGeneration) return
          setSynthKO(prev => {
            const next = new Map(prev)
            for (const r of data.results) next.set(r.id, r.text.trim())
            return next
          })
          setSynthSignal(prev => {
            const next = new Map(prev)
            for (const r of data.results) {
              const sig = r.signal === 'bull' || r.signal === 'bear' ? r.signal : 'neutral'
              if (!prev.has(r.id)) next.set(r.id, sig)
            }
            return next
          })
          setSynthCommentaryType(prev => {
            const next = new Map(prev)
            for (const r of data.results) if (r.commentary_type) next.set(r.id, r.commentary_type)
            return next
          })
          setSynthCoreQuestion(prev => {
            const next = new Map(prev)
            for (const r of data.results) if (r.core_question) next.set(r.id, r.core_question)
            return next
          })
          setSynthWatchNext(prev => {
            const next = new Map(prev)
            for (const r of data.results) if (Array.isArray(r.watch_next) && r.watch_next.length) next.set(r.id, r.watch_next)
            return next
          })
        }))
      } catch { /* ignore */ } finally {
        if (digestGenerationRef.current === requestGeneration) setIsSynthesizingKO(false)
      }
    }
    void runAll()
  }, [langMode, groupedTimeline, selectedItem?.companyName, selectedItem?.changePercent, selectedItem?.lastPrice, selectedSymbol, dateET, todayClose, todayCloseSymbol])

  useEffect(() => {
    setExportStatus('idle')
    setExportFeedback(null)
  }, [selectedNewsId, detail?.id, isDetailOpen])

  const handleExport = async () => {
    if (!detail || exportStatus === 'submitting') return
    setExportStatus('submitting')
    setExportFeedback(null)
    try {
      await onExportNews(detail.id)
      setExportStatus('success')
      setExportFeedback('Queued for export.')
    } catch {
      setExportStatus('error')
      setExportFeedback('Failed to queue export.')
    }
  }

  return (
    <section className={`${styles.panel} ${styles.centerPanel}`}>
      <header className={styles.panelHeader}>
        <div className={styles.selectedHeaderRow}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', flexWrap: 'wrap' }}>
            <h2 className={styles.symbolTitle}>{selectedSymbol || '---'}</h2>
            {selectedItem?.lastPrice && (
              <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 500 }}>
                — ${selectedItem.lastPrice}
              </span>
            )}
            {selectedItem?.changePercent && (
              <span style={{
                fontSize: '0.88rem', fontWeight: 700, letterSpacing: '0.02em',
                color: selectedItem.changePercent.startsWith('-') ? '#f87171' : '#4ade80',
              }}>
                · {selectedItem.changePercent}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              border: '1px solid rgba(56,189,248,0.22)',
              borderRadius: 6, overflow: 'hidden',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              boxShadow: '0 0 6px rgba(56,189,248,0.06)',
            }}>
              {(['KR', 'EN'] as const).map((m, idx) => {
                const active = langMode === m
                const isBusy = m === 'EN' ? isSynthesizingEN : isSynthesizingKO
                const flag = m === 'EN' ? '🇺🇸' : '🇰🇷'
                return (
                  <button
                    key={m}
                    onClick={() => { if (langMode !== m) setLangMode(m) }}
                    style={{
                      background: active ? 'rgba(56,189,248,0.12)' : 'transparent',
                      color: active ? '#38bdf8' : '#475569',
                      border: 'none',
                      borderRight: idx === 0 ? '1px solid rgba(56,189,248,0.15)' : 'none',
                      padding: '3px 10px',
                      fontSize: '0.72rem', fontWeight: 700,
                      letterSpacing: '0.08em',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 4,
                      minWidth: 44, justifyContent: 'center',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                      outline: 'none',
                      transition: 'background 0.12s, color 0.12s',
                    }}
                  >
                    <span style={{ fontSize: '0.9em', lineHeight: 1 }}>{flag}</span>
                    <span>{isBusy && active ? '…' : m}</span>
                    {active && (
                      <span style={{
                        width: 3, height: 3, borderRadius: '50%',
                        background: '#38bdf8', flexShrink: 0,
                        boxShadow: '0 0 3px #38bdf8',
                      }} />
                    )}
                  </button>
                )
              })}
            </div>
            <button
              onClick={onRefreshNews}
              disabled={isNewsRefreshing || isRefreshLocked}
              title={isRefreshLocked ? 'Weekend / holiday refresh locked' : 'Refresh news'}
              style={{
                background: 'none',
                border: '1px solid rgba(56,189,248,0.25)',
                borderRadius: 5,
                color: isNewsRefreshing || isRefreshLocked ? '#475569' : '#38bdf8',
                cursor: isNewsRefreshing || isRefreshLocked ? 'not-allowed' : 'pointer',
                fontSize: '0.70rem', fontWeight: 600,
                padding: '0.18rem 0.5rem',
                opacity: isNewsRefreshing || isRefreshLocked ? 0.5 : 1,
              }}
            >
              {isRefreshLocked ? 'LOCKED' : isNewsRefreshing ? '...' : 'Refresh'}
            </button>
          </div>
        </div>
        <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#64748b', fontWeight: 500, letterSpacing: '0.01em' }}>
          Selected ET session: {dateLabel}
        </p>
      </header>

      <div className={styles.centerFeed}>
        <div className={styles.stack}>
          <div>
            {timelineStatus === 'loading' && (
              <div className={styles.panelStateBox}>Loading news...</div>
            )}
            {timelineStatus === 'error' && timelineError && (
              <div className={styles.panelStateBoxError}>{timelineError}</div>
            )}
            {(timelineStatus === 'ready' || timelineStatus === 'empty') && (
              <div className={styles.timelineList}>
                {groupedTimeline.map((group, groupIndex) => (
                  <section key={group.dateKey} className={styles.timelineDateGroup}>
                    <p className={styles.timelineDateHeader}>{group.dateLabel}</p>
                    {group.items.length ? (
                      (() => {
                        // Only render items that have been synthesized in active lang
                        const displayItems = group.items.filter(item =>
                          langMode === 'KR' ? synthKO.has(item.id) : synthEN.has(item.id)
                        )
                        if (displayItems.length === 0) {
                          return (
                            <div style={{ padding: '0.75rem 0', color: '#475569', fontSize: '0.74rem', fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.04em' }}>
                              {(isSynthesizingEN || isSynthesizingKO) ? 'Analyzing...' : null}
                            </div>
                          )
                        }
                        return displayItems.map((item, itemIndex) => {
                        const briefText = [item.headline, item.summary].filter(Boolean).join(' ')
                        const synthText = langMode === 'KR'
                          ? (synthKO.get(item.id) ?? (synthEN.get(item.id) ?? briefText))
                          : (synthEN.get(item.id) ?? briefText)
                        const bodyText = stripLeadingTerminalNumbering(synthText)
                        const isFirstItem = groupIndex === 0 && itemIndex === 0
                        const isExpanded = expandedItems.has(item.id)
                        const timeLabel = formatPublishedEtLabel(item.publishedAtET, item.dateET, item.timeET)
                        const signal = synthSignal.get(item.id)
                        const commentaryType = synthCommentaryType.get(item.id)
                        const coreQuestion = synthCoreQuestion.get(item.id)
                        const watchNext = synthWatchNext.get(item.id)
                        const signalColor = signal === 'bull' ? '#4ade80' : signal === 'bear' ? '#f87171' : '#94a3b8'
                        const signalBg = signal === 'bull' ? 'rgba(34,197,94,0.1)' : signal === 'bear' ? 'rgba(239,68,68,0.1)' : 'rgba(148,163,184,0.08)'
                        const signalLabel = signal === 'bull' ? (langMode === 'KR' ? '강세' : 'BULL') : signal === 'bear' ? (langMode === 'KR' ? '약세' : 'BEAR') : (langMode === 'KR' ? '중립' : 'NEUTRAL')
                        return (
                          <div
                            key={item.id}
                            style={isFirstItem ? {
                              padding: '1rem',
                              marginBottom: '0.75rem',
                              background: 'rgba(15,23,42,0.55)',
                              border: '1px solid rgba(148,163,184,0.12)',
                              borderRadius: 6,
                            } : {
                              padding: '0.75rem 0',
                              borderBottom: '1px solid rgba(148,163,184,0.06)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                              {timeLabel && (
                                <p style={{
                                  margin: 0,
                                  fontSize: isFirstItem ? '0.75rem' : '0.70rem',
                                  color: isFirstItem ? '#64748b' : '#475569',
                                  fontFamily: 'var(--font-mono, monospace)',
                                  letterSpacing: '0.06em',
                                }}>
                                  Published ET: {timeLabel}
                                </p>
                              )}
                              {signal && (
                                <span style={{
                                  fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em',
                                  padding: '0.08rem 0.38rem', borderRadius: 3,
                                  color: signalColor, background: signalBg,
                                  border: `1px solid ${signalColor}40`,
                                  fontFamily: 'var(--font-mono, monospace)',
                                }}>
                                  {signalLabel}
                                </span>
                              )}
                            </div>
                            <p style={{
                              margin: 0,
                              fontSize: isFirstItem ? '0.92rem' : '0.86rem',
                              lineHeight: 1.7,
                              color: isFirstItem ? '#e2e8f0' : '#94a3b8',
                              overflow: isExpanded ? 'visible' : 'hidden',
                              display: isExpanded ? 'block' : '-webkit-box',
                              WebkitLineClamp: isExpanded ? undefined : (isFirstItem ? 5 : 3),
                              WebkitBoxOrient: isExpanded ? undefined : 'vertical',
                            }}>
                              {bodyText}
                            </p>
                            {isExpanded && (
                              <>
                                {commentaryType && (
                                  <span style={{
                                    display: 'inline-block',
                                    marginTop: '0.5rem',
                                    fontSize: '0.60rem',
                                    fontWeight: 700,
                                    letterSpacing: '0.10em',
                                    padding: '0.06rem 0.32rem',
                                    borderRadius: 3,
                                    color: '#737880',
                                    background: 'rgba(148,163,184,0.07)',
                                    border: '1px solid rgba(148,163,184,0.15)',
                                    fontFamily: 'var(--font-mono, monospace)',
                                  }}>
                                    {commentaryType}
                                  </span>
                                )}
                                {coreQuestion && (
                                  <p style={{
                                    margin: '0.45rem 0 0',
                                    fontSize: '0.78rem',
                                    lineHeight: 1.5,
                                    color: '#8b9098',
                                    borderLeft: '2px solid rgba(148,163,184,0.20)',
                                    paddingLeft: '0.55rem',
                                  }}>
                                    {coreQuestion}
                                  </p>
                                )}
                                {watchNext && watchNext.length > 0 && (
                                  <ul style={{ margin: '0.4rem 0 0', padding: 0, listStyle: 'none' }}>
                                    {watchNext.slice(0, 3).map((w, wIdx) => (
                                      <li key={wIdx} style={{
                                        fontSize: '0.74rem',
                                        lineHeight: 1.5,
                                        color: '#737880',
                                        paddingLeft: '0.9rem',
                                        position: 'relative',
                                      }}>
                                        <span style={{ position: 'absolute', left: 0 }}>→</span>
                                        {w}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedItems(prev => {
                                  const n = new Set(prev)
                                  if (n.has(item.id)) n.delete(item.id)
                                  else n.add(item.id)
                                  return n
                                })
                              }}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: '#475569', fontSize: '0.70rem', padding: '0.3rem 0 0',
                                fontWeight: 600, letterSpacing: '0.03em',
                              }}
                            >
                              {isExpanded ? 'Less' : '...More'}
                            </button>
                          </div>
                        )
                        })
                      })()
                    ) : (
                      <div className={styles.panelStateBox}>No checkpoint items for this date.</div>
                    )}
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className={styles.askPanel}>
        <div className={styles.askBox}>
          <div className={styles.askHeader}>
            <p className={styles.askTitle}>Ask Panel</p>
            <p className={styles.askContext}>
              Research session scope: {selectedSymbol || '---'}, {dateET} ({timezone}), same-day evidence only.
            </p>
          </div>
          <div className={styles.askInputRow}>
            <input
              className={styles.askInput}
              placeholder="Ask a same-day question for the selected symbol..."
              value={askQuestionInput}
              onChange={(e) => onAskQuestionInputChange(e.target.value)}
            />
            <button
              className={styles.askButton}
              type="button"
              onClick={() => void onAskSubmit()}
              disabled={askStatus === 'submitting'}
            >
              {askStatus === 'submitting' ? 'Researching...' : 'Submit'}
            </button>
          </div>

          {askError && (
            <div className={styles.panelStateBoxError}>{askError}</div>
          )}

          {!askError && askStatus === 'ready' && (
            <div className={styles.askAnswerBlock}>
              <p className={styles.askAnswerTitle}>
                Answer (KO) {activeSessionId ? `| Session ${activeSessionId.slice(0, 8)}` : ''}
              </p>
              <p className={styles.askAnswerText}>{askAnswerKo}</p>
            </div>
          )}

          <SourceTable
            sessionId={activeSessionId}
            rows={evidenceRows}
            status={evidenceStatus}
            errorMessage={evidenceError}
            onExportToSheet={onExportEvidenceToSheet}
          />

          <span className={styles.askHint}>
            Source table rows are loaded from internal evidence API and remain independent from sheet export.
          </span>
        </div>
      </footer>

      {isDetailOpen && (
        <div className={styles.detailOverlay} role="dialog" aria-modal="true" aria-label="News detail">
          <div className={styles.detailPanel}>
            <div className={styles.detailHeader}>
              <div>
                <p className={styles.panelLabel}>News Detail</p>
                <h3 className={styles.panelTitle}>Metadata View</h3>
              </div>
              <button type="button" className={styles.ghostButton} onClick={onCloseDetail}>
                Close
              </button>
            </div>

            {detailStatus === 'loading' && (
              <div className={styles.panelStateBox}>Loading selected news metadata...</div>
            )}
            {detailStatus === 'error' && detailError && (
              <div className={styles.panelStateBoxError}>{detailError}</div>
            )}
            {detailStatus === 'ready' && detail && (
              <div className={styles.detailBody}>
                <p className={styles.detailHeadline}>{detail.headline}</p>
                <div className={styles.detailMetaGrid}>
                  <p><strong>Published (ET):</strong> {formatMetadataValue(detail.publishedAtET)}</p>
                  <p><strong>Symbol:</strong> {formatMetadataValue(detail.symbol)}</p>
                  <p><strong>Relevance:</strong> {formatMetadataValue(detail.relevanceScore)}</p>
                  <p><strong>Tags:</strong> {detail.tags?.length ? detail.tags.join(', ') : 'N/A'}</p>
                </div>
                <p className={styles.detailSummary}>{detail.summary}</p>
                <div className={styles.detailActions}>
                  <button
                    type="button"
                    className={styles.detailExportButton}
                    onClick={handleExport}
                    disabled={exportStatus === 'submitting'}
                  >
                    {exportStatus === 'submitting' ? 'Exporting...' : 'Export to Sheet'}
                  </button>
                </div>
                {exportFeedback && (
                  <p className={exportStatus === 'success' ? styles.detailExportSuccess : styles.detailExportError}>
                    {exportFeedback}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

