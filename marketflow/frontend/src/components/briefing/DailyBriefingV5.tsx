'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'

type DriverCard = {
  rank?: number
  title_ko?: string
  reaction_ko?: string
  transmission_ko?: string
  implication_ko?: string
  tone?: string
}

type BriefingV5Output = {
  headline_ko?: string
  market_call_ko?: string
  market_scene_ko?: string
  narrative_core_ko?: string
  driver_stack_ko?: {
    primary_ko?: string
    secondary_ko?: string
    counter_ko?: string
    watch_ko?: string
  }
  money_flow_ko?: string
  false_read_ko?: string
  next_session_test_ko?: string
  positioning_lens_ko?: string
  risk_overlay_ko?: string
  driver_cards?: DriverCard[]
  evidence_tape?: Record<string, string[]>
}

type DailyBriefingV5Data = {
  version?: string
  data_date?: string
  generated_at?: string
  slot?: string
  model?: {
    llm_used?: boolean
    fallback_used?: boolean
    llm_model?: string
  }
  llm_output?: BriefingV5Output
  briefing_packet?: {
    market_reaction_snapshot?: {
      sectors?: Record<string, string>
      high_beta?: Record<string, string>
      single_names?: Record<string, string>
    }
  }
  validation?: {
    passed?: boolean
    errors?: string[]
    repair_used?: boolean
  }
}

type Props = {
  data: DailyBriefingV5Data | null
}

function formatDateTime(iso?: string): string {
  if (!iso) return '--'
  try {
    return (
      new Date(iso).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }) + ' ET'
    )
  } catch {
    return iso
  }
}

function getMarketPulseColor(text?: string) {
  if (!text) return '#1E1B4B'
  if (text.includes('상승')) return '#064E3B'
  if (text.includes('하락')) return '#450A0A'
  return '#1E1B4B'
}

function highlightKeywords(text: string) {
  const regex = /'([^']+)'|"(.*?)"/g;
  const parts = [];
  let lastIdx = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.substring(lastIdx, match.index));
    }
    parts.push(
      <span key={match.index} className="text-[#22D3EE] font-bold">
        {match[0]}
      </span>
    );
    lastIdx = regex.lastIndex;
  }
  if (lastIdx < text.length) {
    parts.push(text.substring(lastIdx));
  }
  return parts.length > 0 ? parts : text;
}

export default function DailyBriefingV5({ data }: Props) {
  const router = useRouter()
  const [isGenerating, setIsGenerating] = useState(false)
  const [statusText, setStatusText] = useState('')

  const runGenerate = useCallback(
    async (force: boolean) => {
      try {
        setIsGenerating(true)
        setStatusText(force ? 'FORCE REGEN...' : 'REFRESH...')
        const res = await fetch('/api/daily-briefing-v5', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json?.ok) {
          throw new Error(String(json?.error || `HTTP ${res.status}`))
        }
        setStatusText('Done')
        router.refresh()
      } catch (error) {
        setStatusText(String(error))
      } finally {
        setIsGenerating(false)
      }
    },
    [router],
  )

  if (!data?.llm_output) {
    return (
      <section className="p-6 bg-[#0D1117] rounded-xl border border-[#374151] font-sans antialiased text-[#FFFFFF]">
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-sm text-[#9CA3AF] mb-4">No V5 briefing available yet.</p>
          <button
            type="button"
            className="px-4 py-2 bg-[#0369A1] hover:bg-[#0284C7] text-[#FFFFFF] rounded font-bold transition"
            disabled={isGenerating}
            onClick={() => void runGenerate(true)}
          >
            {isGenerating ? 'GENERATING...' : 'GENERATE V5'}
          </button>
          {statusText ? <p className="text-sm text-[#9CA3AF] mt-2">{statusText}</p> : null}
        </div>
      </section>
    )
  }

  const output = data.llm_output
  const cards = output.driver_cards || []
  
  const bgColor = getMarketPulseColor(output.market_call_ko)
  const nextSessionText = output.next_session_test_ko ? output.next_session_test_ko.split(/[.다]/)[0] : 'None'

  const narrativeBullets = (output.narrative_core_ko || '')
    .split(/[.다]\s+/)
    .filter(s => s.trim().length > 0)
    .slice(0, 4)
    .map(s => s.endsWith('다') || s.endsWith('.') ? s : s + '다.')

  const snapshot = data.briefing_packet?.market_reaction_snapshot || {}
  const allItems = { ...snapshot.sectors, ...snapshot.high_beta, ...snapshot.single_names }
  const badgeItems = Object.entries(allItems).map(([k, v]) => ({ ticker: k, value: v as string }))

  return (
    <section className="w-full mx-auto space-y-6 font-sans antialiased text-[#FFFFFF] bg-[#000000] p-4 sm:p-6 lg:p-8 rounded-xl">
      {/* Top: Market Pulse Banner */}
      <header className="rounded-xl p-5 flex flex-col md:flex-row items-start justify-between gap-4" style={{ backgroundColor: bgColor }}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold text-[#FFFFFF] m-0">{output.headline_ko || 'Market Pulse'}</h1>
            {output.next_session_test_ko && (
              <div className="px-3 py-1 border border-[#22D3EE] rounded-full bg-[#000000] text-[#22D3EE] text-sm font-bold flex items-center">
                <span className="mr-2 text-[#9CA3AF]">NEXT TEST</span>
                <span className="truncate max-w-[200px] sm:max-w-xs block">{nextSessionText}</span>
              </div>
            )}
          </div>
          <p className="text-sm text-[#E5E7EB] leading-relaxed max-w-3xl">
            {output.market_call_ko || '--'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-3 min-w-max">
          <div className="text-[12px] text-[#D1D5DB] font-mono text-right">
            <div>{formatDateTime(data.generated_at)}</div>
            <div className="text-[#9CA3AF] mt-1">model: {data.model?.llm_used ? data.model?.llm_model : 'rules'}</div>
          </div>
          <div className="flex gap-2">
            <button
              className="px-3 py-1.5 text-[12px] font-bold bg-[#374151] hover:bg-[#4B5563] text-[#FFFFFF] rounded transition"
              disabled={isGenerating}
              onClick={() => void runGenerate(false)}
            >
              REFRESH
            </button>
            <button
              className="px-3 py-1.5 text-[12px] font-bold bg-[#0369A1] hover:bg-[#0284C7] text-[#FFFFFF] rounded transition"
              disabled={isGenerating}
              onClick={() => void runGenerate(true)}
            >
              FORCE
            </button>
          </div>
          {statusText ? <span className="text-[12px] text-[#FCD34D]">{statusText}</span> : null}
        </div>
      </header>

      {/* Central: 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Side: Narrative Core */}
        <article className="bg-[#0D1117] rounded-xl border border-[#374151] p-5">
          <h2 className="text-sm font-bold text-[#9CA3AF] uppercase tracking-wider mb-4 border-b border-[#374151] pb-2">
            Narrative Core
          </h2>
          <ul className="space-y-3">
            {narrativeBullets.length > 0 ? (
              narrativeBullets.map((bullet, idx) => (
                <li key={idx} className="flex items-start text-sm leading-relaxed text-[#D1D5DB]">
                  <span className="text-[#22D3EE] mr-2 mt-0.5">•</span>
                  <span>{highlightKeywords(bullet)}</span>
                </li>
              ))
            ) : (
              <li className="text-sm leading-relaxed text-[#9CA3AF]">{output.narrative_core_ko || '--'}</li>
            )}
          </ul>
        </article>

        {/* Right Side: Money Flow Matrix */}
        <article className="bg-[#0D1117] rounded-xl border border-[#374151] p-5">
          <h2 className="text-sm font-bold text-[#9CA3AF] uppercase tracking-wider mb-4 border-b border-[#374151] pb-2">
            Money Flow Matrix
          </h2>
          <div className="mb-4 text-sm leading-relaxed text-[#D1D5DB]">
            {output.money_flow_ko ? highlightKeywords(output.money_flow_ko) : '--'}
          </div>
          
          {badgeItems.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 mt-4">
              {badgeItems.map(item => {
                const isUp = item.value.includes('+');
                const isDown = item.value.includes('-');
                const bg = isUp ? 'bg-[#064E3B]' : isDown ? 'bg-[#450A0A]' : 'bg-[#1F2937]';
                const fg = isUp ? 'text-[#34D399]' : isDown ? 'text-[#F87171]' : 'text-[#D1D5DB]';
                return (
                  <div key={item.ticker} className={`flex items-center justify-between px-2.5 py-2 rounded-md ${bg}`}>
                    <span className="font-mono text-sm text-[#FFFFFF] font-bold">{item.ticker}</span>
                    <span className={`font-mono text-sm ${fg}`}>{item.value}</span>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </div>

      {/* Bottom: Driver Stack Cards */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-[#9CA3AF] uppercase tracking-wider mb-2 pl-1">Driver Stack</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cards.map(card => (
            <article key={card.rank} className="bg-[#0D1117] rounded-xl border border-[#374151] p-5 flex flex-col h-full">
              {/* Card Header */}
              <div className="flex flex-row items-center justify-between mb-5 pb-4 border-b border-[#374151]">
                <h3 className="text-base font-bold text-[#FFFFFF]">#{card.rank} {card.title_ko}</h3>
                <span className="font-mono text-[18px] text-[#FFFFFF] bg-[#1F2937] px-2.5 py-1 rounded">
                  {card.reaction_ko || '--'}
                </span>
              </div>
              
              {/* Reaction-Transmission Separator Flow */}
              <div className="relative pl-5 space-y-5 before:absolute before:left-[9px] before:top-2 before:bottom-6 before:w-[2px] before:bg-[#374151] flex-1">
                <div className="relative">
                  <div className="absolute -left-[27px] top-1.5 w-3 h-3 rounded-full bg-[#374151] border-2 border-[#0D1117]" />
                  <span className="block text-xs font-bold text-[#9CA3AF] uppercase tracking-wider mb-1">Transmission</span>
                  <p className="text-sm leading-relaxed text-[#D1D5DB]">{card.transmission_ko || '--'}</p>
                </div>
                
                {/* Implication Box */}
                <div className="relative mt-auto pt-2">
                  <div className="absolute -left-[27px] top-4 w-3 h-3 rounded-full bg-[#22D3EE] border-2 border-[#0D1117]" />
                  <div className="bg-[#161B22] border-l-4 border-[#22D3EE] p-4 rounded-r-md">
                    <span className="block text-xs font-bold text-[#22D3EE] uppercase tracking-wider mb-1">Implication</span>
                    <p className="text-sm leading-relaxed text-[#FFFFFF] font-bold">{card.implication_ko || '--'}</p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export type { DailyBriefingV5Data }
