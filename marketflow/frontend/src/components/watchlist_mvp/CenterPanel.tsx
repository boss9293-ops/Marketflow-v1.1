import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import SourceTable from '@/components/watchlist_mvp/SourceTable'
import styles from '@/components/watchlist_mvp/watchlistMvp.module.css'
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
  isNewsRefreshing: boolean
  newsLastFetchedAt: Date | null
  todayOpen: number | null
  todayClose: number | null
}

const formatMetadataValue = (value?: string | number | null): string =>
  value == null || value === '' ? 'N/A' : String(value)

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
  // 09:30 → 시가, 16:00 → 종가
  const timeKey = item.timeET || ''
  const isOpen  = timeKey.startsWith('09:30') || timeKey.startsWith('9:30')
  const isClose = timeKey.startsWith('16:00')
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
  isNewsRefreshing,
  newsLastFetchedAt,
  todayOpen,
  todayClose,
}: CenterPanelProps) {
  const dateLabel = useMemo(() => formatTerminalDateLabel(dateET), [dateET])
  const groupedTimeline = useMemo(() => {
    const grouped = new Map<string, TickerNewsItem[]>()
    timeline.forEach((item) => {
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
  }, [dateET, timeline])
  const [langMode, setLangMode] = useState<'EN' | 'KR'>('EN')
  const [synthEN, setSynthEN] = useState<Map<string, string>>(new Map())
  const [synthKO, setSynthKO] = useState<Map<string, string>>(new Map())
  const [isSynthesizingEN, setIsSynthesizingEN] = useState(false)
  const [isSynthesizingKO, setIsSynthesizingKO] = useState(false)
  const synthENRequested = useRef<Set<string>>(new Set())
  const synthKORequested = useRef<Set<string>>(new Set())

  const [exportStatus, setExportStatus] = useState<ExportUiStatus>('idle')
  const [exportFeedback, setExportFeedback] = useState<string | null>(null)

  // 심볼 변경 시 합성 캐시 초기화
  useEffect(() => {
    setSynthEN(new Map())
    setSynthKO(new Map())
    synthENRequested.current = new Set()
    synthKORequested.current = new Set()
    setLangMode('EN')
    setIsSynthesizingEN(false)
    setIsSynthesizingKO(false)
  }, [selectedSymbol])

  // EN 자동 합성 (심볼/뉴스 로드 시)
  useEffect(() => {
    const allItems = groupedTimeline.flatMap(g => g.items)
    const pending = allItems.filter(item => !synthENRequested.current.has(item.id))
    if (!pending.length) return
    pending.forEach(item => synthENRequested.current.add(item.id))
    setIsSynthesizingEN(true)
    const run = async () => {
      try {
        const payload = pending.map(item => ({ id: item.id, timeET: item.timeET, headline: item.headline ?? '', summary: item.summary ?? '' }))
        const res = await fetch('/api/terminal/news-synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol: selectedSymbol, items: payload, lang: 'en' }),
        })
        if (!res.ok) return
        const data = await res.json() as { results: Array<{ id: string; text: string }> }
        setSynthEN(prev => {
          const next = new Map(prev)
          for (const r of data.results) {
            const item = pending.find(it => it.id === r.id)
            const timeKey = item?.timeET ?? ''
            const isOpen = timeKey.startsWith('09:30') || timeKey.startsWith('9:30')
            const isClose = timeKey.startsWith('16:00')
            const price = isOpen ? todayOpen : isClose ? todayClose : null
            const priceStr = price != null ? ` $${price.toFixed(2)}` : ''
            next.set(r.id, `${selectedSymbol}${priceStr} ${r.text}`)
          }
          return next
        })
      } catch { /* ignore */ } finally { setIsSynthesizingEN(false) }
    }
    void run()
  }, [groupedTimeline, selectedSymbol, todayOpen, todayClose])

  // KR 버튼 클릭 시 한국어 합성
  useEffect(() => {
    if (langMode !== 'KR') return
    const allItems = groupedTimeline.flatMap(g => g.items)
    const pending = allItems.filter(item => !synthKORequested.current.has(item.id))
    if (!pending.length) return
    pending.forEach(item => synthKORequested.current.add(item.id))
    setIsSynthesizingKO(true)
    const run = async () => {
      try {
        const payload = pending.map(item => ({ id: item.id, timeET: item.timeET, headline: item.headline ?? '', summary: item.summary ?? '' }))
        const res = await fetch('/api/terminal/news-synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol: selectedSymbol, items: payload, lang: 'ko' }),
        })
        if (!res.ok) return
        const data = await res.json() as { results: Array<{ id: string; text: string }> }
        setSynthKO(prev => {
          const next = new Map(prev)
          for (const r of data.results) {
            const item = pending.find(it => it.id === r.id)
            const timeKey = item?.timeET ?? ''
            const isOpen = timeKey.startsWith('09:30') || timeKey.startsWith('9:30')
            const isClose = timeKey.startsWith('16:00')
            const price = isOpen ? todayOpen : isClose ? todayClose : null
            const priceStr = price != null ? ` $${price.toFixed(2)}` : ''
            next.set(r.id, `${selectedSymbol}${priceStr} ${r.text}`)
          }
          return next
        })
      } catch { /* ignore */ } finally { setIsSynthesizingKO(false) }
    }
    void run()
  }, [langMode, groupedTimeline, selectedSymbol, todayOpen, todayClose])

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
        <p className={styles.panelLabel}>Portfolio Summary</p>
        <div className={styles.selectedHeaderRow}>
          <h2 className={styles.panelTitle}>{selectedSymbol || '---'} - Daily Brief Workspace</h2>
          <span className={styles.symbolChip}>{dateLabel}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
            {newsLastFetchedAt && (
              <span style={{ fontSize: '0.68rem', color: '#475569' }}>
                {new Intl.DateTimeFormat('en-US', {
                  timeZone: 'America/New_York',
                  hour: '2-digit', minute: '2-digit', hour12: false,
                }).format(newsLastFetchedAt)} ET
              </span>
            )}
            <button
              onClick={() => setLangMode(m => m === 'EN' ? 'KR' : 'EN')}
              title="한국어/영어 전환"
              style={{
                background: langMode === 'KR' ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${langMode === 'KR' ? 'rgba(56,189,248,0.45)' : 'rgba(255,255,255,0.15)'}`,
                borderRadius: 6,
                color: langMode === 'KR' ? '#7dd3fc' : '#64748b',
                cursor: 'pointer',
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '0.2rem 0.55rem',
                letterSpacing: '0.05em',
              }}
            >
              {(langMode === 'EN' ? isSynthesizingEN : isSynthesizingKO) ? '...' : langMode}
            </button>
            <button
              onClick={onRefreshNews}
              disabled={isNewsRefreshing}
              title="뉴스 새로고침"
              style={{
                background: 'rgba(56,189,248,0.08)',
                border: '1px solid rgba(56,189,248,0.25)',
                borderRadius: 6,
                color: isNewsRefreshing ? '#475569' : '#38bdf8',
                cursor: isNewsRefreshing ? 'not-allowed' : 'pointer',
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '0.2rem 0.55rem',
                letterSpacing: '0.04em',
                transition: 'opacity 0.15s',
                opacity: isNewsRefreshing ? 0.5 : 1,
              }}
            >
              {isNewsRefreshing ? '...' : '⟳ Refresh'}
            </button>
          </div>
        </div>
      </header>

      <div className={styles.centerFeed}>
        <div className={styles.stack}>
          <div>
            {timelineStatus === 'loading' && (
              <div className={styles.panelStateBox}>Loading symbol news timeline from real API data...</div>
            )}
            {timelineStatus === 'error' && timelineError && (
              <div className={styles.panelStateBoxError}>{timelineError}</div>
            )}
            {(timelineStatus === 'ready' || timelineStatus === 'empty') && (
              <div className={styles.timelineList}>
                {groupedTimeline.map((group) => (
                  <section key={group.dateKey} className={styles.timelineDateGroup}>
                    <p className={styles.timelineDateHeader}>{group.dateLabel}</p>
                    {group.items.length ? (
                      group.items.map((item) => {
                        const isActive = selectedNewsId === item.id
                        const briefText = toBriefText(selectedSymbol, item, todayOpen, todayClose)
                        return (
                          <button
                            key={item.id}
                            type="button"
                            className={`${styles.timelineItem} ${isActive ? styles.timelineItemActive : ''}`}
                            onClick={() => onSelectNews(item)}
                          >
                            <div className={styles.timelineTop}>
                              <span className={styles.timelineTime}>{item.timeET}</span>
                              <span className={styles.timelineAction}>Open {'>'}</span>
                            </div>
                            <p className={styles.timelineSummary}>
                              {langMode === 'KR'
                                ? (synthKO.get(item.id) ?? (isSynthesizingKO ? '...' : (synthEN.get(item.id) ?? briefText)))
                                : (synthEN.get(item.id) ?? (isSynthesizingEN ? '...' : briefText))}
                            </p>
                          </button>
                        )
                      })
                    ) : (
                      <div className={styles.panelStateBox}>No 09:30 / 16:00 checkpoint item captured for this date.</div>
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
                  <p><strong>Source:</strong> {formatMetadataValue(detail.source)}</p>
                  <p><strong>Published (ET):</strong> {formatMetadataValue(detail.publishedAtET)}</p>
                  <p><strong>Symbol:</strong> {formatMetadataValue(detail.symbol)}</p>
                  <p><strong>Relevance:</strong> {formatMetadataValue(detail.relevanceScore)}</p>
                  <p><strong>Tags:</strong> {detail.tags?.length ? detail.tags.join(', ') : 'N/A'}</p>
                </div>
                <p className={styles.detailSummary}>{detail.summary}</p>
                <div className={styles.detailActions}>
                  {detail.url ? (
                    <a
                      href={detail.url}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.detailLinkButton}
                    >
                      Open Article
                    </a>
                  ) : (
                    <button type="button" className={styles.detailButtonDisabled} disabled>
                      Open Article
                    </button>
                  )}
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
