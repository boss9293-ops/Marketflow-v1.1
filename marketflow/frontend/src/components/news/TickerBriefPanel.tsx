'use client'

import { useEffect, useState } from 'react'

interface PriceSnap {
  symbol: string
  date?: string
  close: number
  open: number
  change1d: number
  openChg: number
}

interface BriefEvent {
  id: string
  headline: string
  source: string
  timeET: string
  directness: number
  cluster: string
  sentiment: string
}

interface TickerBriefDay {
  symbol: string
  date: string
  generated_at: string
  brief: string
  sentiment: 'bullish' | 'bearish' | 'neutral'
  signal_strength: number
  price: PriceSnap
  events: BriefEvent[]
}

const SENTIMENT_COLOR = {
  bullish: 'text-emerald-400',
  bearish: 'text-rose-400',
  neutral: 'text-amber-400',
}

const SENTIMENT_BG = {
  bullish: 'bg-emerald-500/10 border-emerald-500/30',
  bearish: 'bg-rose-500/10 border-rose-500/30',
  neutral: 'bg-amber-500/10 border-amber-500/30',
}

function SignalBars({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-0.5 items-end">
      {[2, 4, 6, 8, 10].map((thresh, i) => (
        <span
          key={i}
          className={`inline-block w-1 rounded-sm ${
            value >= thresh ? 'bg-emerald-400' : 'bg-zinc-700'
          }`}
          style={{ height: `${8 + i * 2}px` }}
        />
      ))}
    </span>
  )
}

function BriefCard({ day }: { day: TickerBriefDay }) {
  const { price, brief, sentiment, signal_strength, events, date } = day
  const change = price?.change1d ?? 0
  const close = price?.close ?? 0
  const dir = change >= 0 ? '+' : ''

  // Split brief into lines for display (split on period+space)
  const sentences = brief.split(/(?<=\.)\s+/).filter(Boolean)

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${SENTIMENT_BG[sentiment]}`}>
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 font-mono">{date}</span>
          <span className={`text-xs font-semibold uppercase ${SENTIMENT_COLOR[sentiment]}`}>
            {sentiment}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <SignalBars value={signal_strength} />
          <span className="text-xs text-zinc-500">{signal_strength}/10</span>
        </div>
      </div>

      {/* Price line */}
      {close > 0 && (
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold text-white font-mono">
            ${close.toFixed(2)}
          </span>
          <span
            className={`text-sm font-semibold font-mono ${
              change >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {dir}{change.toFixed(2)}%
          </span>
          <span className="text-xs text-zinc-500">
            open ${price?.open?.toFixed(2)}
          </span>
        </div>
      )}

      {/* Brief text */}
      <div className="space-y-1.5">
        {sentences.map((s, i) => (
          <p
            key={i}
            className={`text-sm leading-relaxed ${
              i === 0
                ? 'text-zinc-100 font-medium'
                : 'text-zinc-400'
            }`}
          >
            {s}
          </p>
        ))}
      </div>

      {/* Top events */}
      {events.length > 0 && (
        <div className="space-y-1 border-t border-white/5 pt-2">
          {events.slice(0, 3).map((e) => (
            <div key={e.id} className="flex items-start gap-2 text-xs">
              <span
                className={`shrink-0 font-mono mt-0.5 ${
                  e.sentiment === 'bullish'
                    ? 'text-emerald-400'
                    : e.sentiment === 'bearish'
                    ? 'text-rose-400'
                    : 'text-zinc-500'
                }`}
              >
                {'█'.repeat(Math.min(e.directness, 5))}{'░'.repeat(Math.max(0, 5 - e.directness))}
              </span>
              <span className="text-zinc-400 leading-relaxed">{e.headline}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TickerBriefPanel({ symbol }: { symbol: string }) {
  const [briefs, setBriefs] = useState<TickerBriefDay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const apiBase = process.env.NEXT_PUBLIC_BACKEND_API ?? 'http://localhost:5001'

  useEffect(() => {
    if (!symbol) return
    setLoading(true)
    setError('')
    fetch(`${apiBase}/api/ticker-brief?symbol=${symbol}`)
      .then((r) => r.json())
      .then((data) => {
        setBriefs(data.briefs ?? [])
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message)
        setLoading(false)
      })
  }, [symbol, apiBase])

  if (loading) {
    return (
      <div className="text-zinc-500 text-sm animate-pulse p-4">
        Loading {symbol} brief...
      </div>
    )
  }

  if (error) {
    return <div className="text-rose-400 text-sm p-4">Error: {error}</div>
  }

  if (briefs.length === 0) {
    return (
      <div className="text-zinc-500 text-sm p-4">
        No brief available for {symbol}. Run build_ticker_brief.py to generate.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-zinc-300 tracking-wider uppercase">
          {symbol} · EOD Brief
        </h3>
        <span className="text-xs text-zinc-600">{briefs.length}d</span>
      </div>
      {briefs.map((day) => (
        <BriefCard key={day.date} day={day} />
      ))}
    </div>
  )
}
