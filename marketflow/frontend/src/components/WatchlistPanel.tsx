'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import BilLabel from '@/components/BilLabel'
import TickerReportCard from '@/components/ticker/TickerReportCard'
import { buildTickerReport, type TickerChartLike, type TickerSummaryLike } from '@/lib/tickerReport'
import { uiColor, uiType } from '@/lib/uiTokens'

const STORAGE_KEY = 'mf_watchlist'
const API_BASE = process.env.NEXT_PUBLIC_BACKEND_API || 'http://localhost:5001'

function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase()
}

function parseStoredSymbols(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const seen = new Set<string>()
    const next: string[] = []
    for (const item of parsed) {
      const symbol = typeof item === 'string'
        ? normalizeSymbol(item)
        : normalizeSymbol(String((item as { symbol?: unknown })?.symbol || ''))
      if (!symbol || seen.has(symbol)) continue
      seen.add(symbol)
      next.push(symbol)
    }
    return next
  } catch {
    return []
  }
}

function panelStyle() {
  return {
    width: 'min(880px, 100%)',
    background: 'var(--bg-panel)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: '1rem',
  } as const
}

function WatchlistDrawer({
  symbol,
  onClose,
}: {
  symbol: string
  onClose: () => void
}) {
  const [summary, setSummary] = useState<TickerSummaryLike>(null)
  const [chart, setChart] = useState<TickerChartLike>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([
      fetch(`${API_BASE}/api/ticker-summary?symbol=${encodeURIComponent(symbol)}`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
      fetch(`${API_BASE}/api/chart?symbol=${encodeURIComponent(symbol)}&days=240`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
    ]).then(([s, c]) => {
      if (!alive) return
      setSummary(s)
      setChart(c)
    }).finally(() => {
      if (alive) setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [symbol])

  const report = buildTickerReport({ symbol, summary, chart })

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)', zIndex: 1000 }}
      />
      <div
        className="mf-drawer-panel"
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          width: 'min(640px, 100vw)',
          zIndex: 1001,
          borderLeft: '1px solid rgba(255,255,255,0.09)',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-panel)',
        }}
      >
        <div style={{ padding: '0.9rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ color: uiColor.textPrimary }}>
            <BilLabel ko="티커 리포트" en="Ticker Report" variant="label" />
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ width: 40, height: 40, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: uiColor.textPrimary, cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {loading && (
            <div style={{ color: uiColor.textSecondary, fontSize: uiType.base }}>
              <BilLabel ko="데이터 불러오는 중" en="Loading ticker data" variant="micro" />
            </div>
          )}
          <TickerReportCard report={report} symbolHref={`/ticker/${encodeURIComponent(symbol)}`} compact />
          <div style={{ color: uiColor.textMuted }}>
            <BilLabel ko="상세 차트·뉴스는 전체 페이지에서 확인하세요." en="Open the full page for chart and detailed context." variant="micro" />
          </div>
        </div>
      </div>
    </>
  )
}

export default function WatchlistPanel() {
  const [items, setItems] = useState<string[]>([])
  const [symbolInput, setSymbolInput] = useState('')
  const [errorText, setErrorText] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setItems(parseStoredSymbols(window.localStorage.getItem(STORAGE_KEY)))
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready || typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items, ready])

  function onAdd(e: FormEvent) {
    e.preventDefault()
    const symbol = normalizeSymbol(symbolInput)
    if (!symbol) {
      setErrorText('심볼을 입력하세요')
      return
    }
    if (!/^[A-Z0-9.\-]{1,10}$/.test(symbol)) {
      setErrorText('유효하지 않은 심볼')
      return
    }
    setItems((prev) => (prev.includes(symbol) ? prev : [symbol, ...prev]))
    setSymbolInput('')
    setErrorText(null)
  }

  function onRemove(symbol: string) {
    setItems((prev) => prev.filter((x) => x !== symbol))
    if (selected === symbol) setSelected(null)
  }

  return (
    <>
      <section style={panelStyle()}>
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: uiColor.textPrimary }}>
              <BilLabel ko="관심 종목" en="Watchlist" variant="title" />
            </div>
            <div style={{ color: uiColor.textSecondary, marginTop: 4 }}>
              <BilLabel ko="행을 클릭하면 요약 리포트가 열립니다." en="Click a row to open the summary report drawer." variant="label" />
            </div>
          </div>
          <div style={{ color: uiColor.textMuted, fontSize: uiType.label }}>local · {STORAGE_KEY}</div>
        </div>

        <form onSubmit={onAdd} style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <input
            value={symbolInput}
            onChange={(e) => setSymbolInput(e.target.value)}
            placeholder="AAPL, TSLA..."
            style={{
              flex: 1,
              minWidth: 180,
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(255,255,255,0.03)',
              color: uiColor.textPrimary,
              borderRadius: 10,
              padding: '0.75rem 0.8rem',
              fontSize: '1.05rem',
            }}
          />
          <button
            type="submit"
            style={{
              border: '1px solid rgba(10,90,255,0.35)',
              background: 'rgba(10,90,255,0.12)',
              color: '#bfdbfe',
              borderRadius: 10,
              padding: '0.7rem 0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              minHeight: 44,
            }}
          >
            <BilLabel ko="추가" en="Add" variant="label" />
          </button>
        </form>

        {errorText && <div style={{ color: 'var(--state-defensive)', fontSize: uiType.label, marginBottom: 8 }}>{errorText}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.length === 0 ? (
            <div style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '0.75rem' }}>
              <div style={{ color: uiColor.textSecondary }}>
                <BilLabel ko="종목이 없습니다" en="No symbols yet" variant="label" />
              </div>
              <div style={{ color: uiColor.textMuted, marginTop: 4 }}>
                <BilLabel ko="심볼을 추가하면 티커 리포트를 바로 열 수 있습니다." en="Add symbols to open the ticker report instantly." variant="label" />
              </div>
            </div>
          ) : (
            items.map((symbol) => (
              <div
                key={symbol}
                style={{
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.02)',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  gap: 8,
                  alignItems: 'center',
                  padding: '0.7rem 0.75rem',
                }}
              >
                <button
                  type="button"
                  onClick={() => setSelected(symbol)}
                  style={{
                    background: 'none',
                    border: 0,
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: uiColor.textPrimary,
                    minWidth: 0,
                  }}
                >
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.01em' }}>{symbol}</div>
                  <div style={{ color: uiColor.textMuted, fontSize: uiType.label, marginTop: 4 }}>
                    <BilLabel ko="요약 리포트 열기" en="Open summary report" variant="label" />
                  </div>
                </button>
                <Link
                  href={`/ticker/${encodeURIComponent(symbol)}`}
                  style={{
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.03)',
                    color: uiColor.textPrimary,
                    textDecoration: 'none',
                    borderRadius: 9,
                    padding: '0.5rem 0.65rem',
                    minHeight: 42,
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  <BilLabel ko="전체" en="Full" variant="label" />
                </Link>
                <button
                  type="button"
                  onClick={() => onRemove(symbol)}
                  style={{
                    border: '1px solid rgba(255,112,67,0.28)',
                    background: 'rgba(255,112,67,0.10)',
                    color: '#fdba74',
                    borderRadius: 9,
                    padding: '0.5rem 0.65rem',
                    cursor: 'pointer',
                    minHeight: 42,
                  }}
                >
                  <BilLabel ko="삭제" en="Remove" variant="label" />
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {selected && <WatchlistDrawer symbol={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
