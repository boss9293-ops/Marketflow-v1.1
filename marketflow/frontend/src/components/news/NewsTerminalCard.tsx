'use client'

/**
 * NewsTerminalCard.tsx — Stage 3
 * Dark card UI for MarketBrief. X-terminal style.
 * Shows 5-part brief with signal strength, sentiment color, and directness bars.
 */

import type { MarketBrief } from '@/lib/terminal-mvp/briefGenerator'
import type { EventSentiment } from '@/lib/terminal-mvp/eventExtractor'

// ─── SENTIMENT COLORS ──────────────────────────────────────────────────────

const SENTIMENT_COLORS: Record<EventSentiment, { border: string; badge: string; glow: string }> = {
  bullish: {
    border: 'border-emerald-500/30',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    glow: 'shadow-[0_0_24px_-4px_rgba(16,185,129,0.18)]',
  },
  bearish: {
    border: 'border-rose-500/30',
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    glow: 'shadow-[0_0_24px_-4px_rgba(244,63,94,0.18)]',
  },
  neutral: {
    border: 'border-amber-500/25',
    badge: 'bg-amber-500/12 text-amber-300 border-amber-500/25',
    glow: 'shadow-[0_0_24px_-4px_rgba(245,158,11,0.12)]',
  },
}

const PART_ACCENT: Record<string, string> = {
  SIGNAL: 'text-cyan-400',
  EVENT: 'text-violet-400',
  CONTEXT: 'text-slate-400',
  WATCH: 'text-amber-400',
  RISK: 'text-rose-400',
}

// ─── SUBCOMPONENTS ─────────────────────────────────────────────────────────

function SignalBars({ strength }: { strength: number }) {
  // strength 0–10, show 5 bars
  const bars = 5
  const filled = Math.round((strength / 10) * bars)
  return (
    <div className="flex items-center gap-[3px]" title={`Signal strength: ${strength}/10`}>
      {Array.from({ length: bars }, (_, i) => (
        <div
          key={i}
          className={[
            'h-2.5 w-1 rounded-sm transition-all',
            i < filled
              ? 'bg-cyan-400'
              : 'bg-slate-700',
          ].join(' ')}
        />
      ))}
      <span className="ml-1 text-[10px] font-mono text-slate-500">{strength}/10</span>
    </div>
  )
}

function BriefPartRow({ label, body }: { label: string; body: string }) {
  const accent = PART_ACCENT[label] ?? 'text-slate-400'
  const lines = body.split('\n')

  return (
    <div className="flex gap-3 py-2.5 border-b border-white/[0.05] last:border-0">
      <div className={`w-[72px] shrink-0 text-[10px] font-mono font-bold tracking-widest pt-0.5 ${accent}`}>
        {label}
      </div>
      <div className="flex-1 min-w-0">
        {lines.map((line, i) => (
          <p
            key={i}
            className={[
              'text-sm leading-relaxed',
              i === 0 ? 'text-slate-100 font-medium' : 'text-slate-400 text-xs mt-0.5',
            ].join(' ')}
          >
            {line}
          </p>
        ))}
      </div>
    </div>
  )
}

function TimestampBadge({ iso }: { iso: string }) {
  const formatted = (() => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        month: 'short',
        day: 'numeric',
      }).format(new Date(iso))
    } catch {
      return iso
    }
  })()
  return (
    <span className="text-[10px] font-mono text-slate-500">{formatted} ET</span>
  )
}

// ─── SKELETON ──────────────────────────────────────────────────────────────

export function NewsTerminalCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-3 w-24 rounded bg-slate-800" />
        <div className="h-3 w-16 rounded bg-slate-800" />
      </div>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex gap-3 py-2.5 border-b border-white/[0.05]">
          <div className="h-3 w-16 rounded bg-slate-800 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 rounded bg-slate-800" />
            <div className="h-2.5 w-3/4 rounded bg-slate-800/60" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── EMPTY STATE ───────────────────────────────────────────────────────────

export function NewsTerminalCardEmpty() {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-6 text-center">
      <p className="text-xs font-mono text-slate-600 uppercase tracking-widest mb-1">Market Brief</p>
      <p className="text-sm text-slate-500">No high-signal events detected</p>
      <p className="text-xs text-slate-600 mt-1">directness threshold not met</p>
    </div>
  )
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────

type NewsTerminalCardProps = {
  brief: MarketBrief
  onCopyPrompt?: () => void
  className?: string
}

export default function NewsTerminalCard({
  brief,
  onCopyPrompt,
  className = '',
}: NewsTerminalCardProps) {
  const colors = SENTIMENT_COLORS[brief.sentiment]

  const handleCopy = () => {
    navigator.clipboard.writeText(brief.promptText).catch(() => {})
    onCopyPrompt?.()
  }

  return (
    <div
      className={[
        'rounded-2xl border bg-slate-950/80 backdrop-blur-sm overflow-hidden',
        colors.border,
        colors.glow,
        className,
      ].join(' ')}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <span className={`text-[9px] font-mono font-bold tracking-[0.3em] uppercase px-2 py-0.5 rounded-full border ${colors.badge}`}>
            {brief.sentiment === 'bullish' ? 'BULL' : brief.sentiment === 'bearish' ? 'BEAR' : 'NEUTRAL'}
          </span>
          <SignalBars strength={brief.signalStrength} />
        </div>
        <div className="flex items-center gap-3">
          <TimestampBadge iso={brief.generatedAt} />
          {onCopyPrompt && (
            <button
              onClick={handleCopy}
              title="Copy LLM prompt"
              className="text-[10px] font-mono text-slate-600 hover:text-slate-300 transition-colors px-2 py-0.5 rounded border border-white/10 hover:border-white/20"
            >
              GPT ↗
            </button>
          )}
        </div>
      </div>

      {/* 5-Part Brief */}
      <div className="px-4 py-1">
        {brief.parts.map((part) => (
          <BriefPartRow key={part.label} label={part.label} body={part.body} />
        ))}
      </div>

      {/* Footer: lead event directness */}
      {brief.leadEvent && (
        <div className="px-4 pb-3 pt-1 flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-600">TOP EVENT</span>
          <span className="text-[10px] font-mono text-slate-500 truncate">
            {brief.leadEvent.headline.slice(0, 60)}
          </span>
          <span className="ml-auto shrink-0 text-[10px] font-mono text-cyan-600">
            d={brief.leadEvent.directness}
          </span>
        </div>
      )}
    </div>
  )
}
