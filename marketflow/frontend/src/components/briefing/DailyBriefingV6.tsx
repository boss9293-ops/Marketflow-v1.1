'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'

export type BriefingV6Section = {
  id: string
  title: string
  structural: string
  structural_ko?: string
  implication: string
  implication_ko?: string
  signal: 'bull' | 'caution' | 'bear' | 'neutral'
  color: string
}

export type BriefingV6RiskCheck = {
  triggered: boolean
  level: number
  mss: number
  zone: string
  message: string
  color: string
}

export type DailyBriefingV6Data = {
  generated_at: string
  data_date: string
  slot?: string
  model: string
  hook: string
  hook_ko?: string
  sections: BriefingV6Section[]
  risk_check: BriefingV6RiskCheck
  one_line: string
  one_line_ko?: string
}

type Props = {
  data: DailyBriefingV6Data | null
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

function splitFirstSentence(text: string) {
  if (!text) return { first: '', rest: '' }
  const match = text.match(/^.*?[.!?다](?:\s|$|(?=["']))/);
  if (match) {
    return {
      first: match[0].trim(),
      rest: text.slice(match[0].length).trim()
    };
  }
  return { first: text, rest: '' };
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

export default function DailyBriefingV6({ data }: Props) {
  const router = useRouter()
  const [isGenerating, setIsGenerating] = useState(false)
  const [statusText, setStatusText] = useState('')

  const runGenerate = useCallback(
    async (force: boolean) => {
      try {
        setIsGenerating(true)
        setStatusText(force ? 'FORCE REGEN...' : 'REFRESH...')
        const res = await fetch('/api/daily-briefing-v6', {
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

  if (!data?.sections) {
    return (
      <section className="p-6 bg-[#000000] min-h-screen font-sans text-[#FFFFFF] flex flex-col items-center justify-center">
        <p className="text-[#9CA3AF] mb-4">No V6 briefing available yet.</p>
        <button
          type="button"
          className="px-6 py-2 bg-[#22D3EE] text-[#000000] font-bold tracking-widest hover:bg-[#06B6D4] transition"
          disabled={isGenerating}
          onClick={() => void runGenerate(true)}
        >
          {isGenerating ? 'GENERATING...' : 'GENERATE V6'}
        </button>
        {statusText && <p className="mt-4 text-[#FCD34D] text-sm">{statusText}</p>}
      </section>
    )
  }

  // Section Mapping (V3 Data -> V6 Layout)
  const sections = data.sections;
  const heroSection = sections[0]; // The Battleground -> The Battlefield
  const liveTriggers = sections[1]; // Live Triggers
  const moneyFlow = sections[2]; // Money Velocity & Rotation
  const macroTremors = sections[3]; // Macro Tremors
  const hotZones = sections[4]; // The Hotzones
  const radar = sections[5]; // Next 24H Radar
  const defcon = sections[6]; // System DEFCON

  const TickerStrip = () => (
    <div className="w-full bg-[#0D1117] border-b border-[#374151] flex items-center px-4 py-2 overflow-x-auto whitespace-nowrap scrollbar-hide text-xs font-mono tracking-widest">
      <div className="flex space-x-8 text-[#9CA3AF]">
        <span className="flex items-center space-x-2"><strong className="text-[#FFFFFF]">SPY</strong> <span className="text-[#22C55E]">+0.99%</span></span>
        <span className="flex items-center space-x-2"><strong className="text-[#FFFFFF]">QQQ</strong> <span className="text-[#22C55E]">+0.93%</span></span>
        <span className="flex items-center space-x-2"><strong className="text-[#FFFFFF]">IWM</strong> <span className="text-[#22C55E]">+2.16%</span></span>
        <span className="flex items-center space-x-2"><strong className="text-[#FFFFFF]">VIX</strong> <span className="text-[#EF4444]">-10.21%</span></span>
        <span className="flex items-center space-x-2"><strong className="text-[#FFFFFF]">DXY</strong> <span className="text-[#EF4444]">-0.79%</span></span>
        <span className="flex items-center space-x-2"><strong className="text-[#FFFFFF]">WTI</strong> <span className="text-[#EF4444]">-1.38%</span></span>
        <span className="flex items-center space-x-2"><strong className="text-[#FFFFFF]">US10Y</strong> <span className="text-[#EF4444]">-0.63%</span></span>
      </div>
      <div className="ml-auto pl-8 text-[#6B7280]">
        AS OF: {data.data_date} | {formatDateTime(data.generated_at)}
      </div>
    </div>
  );

  const SectionCard = ({ 
    section, 
    colSpanClass, 
    isHero = false, 
    isHotZone = false 
  }: { 
    section: BriefingV6Section, 
    colSpanClass: string, 
    isHero?: boolean, 
    isHotZone?: boolean 
  }) => {
    if (!section) return null;
    
    const structuralText = section.structural_ko || section.structural || '';
    const implicationText = section.implication_ko || section.implication || '';
    
    const { first: structFirst, rest: structRest } = splitFirstSentence(structuralText);
    const { first: implFirst, rest: implRest } = splitFirstSentence(implicationText);

    return (
      <article 
        className={`relative bg-[#000000] border p-6 md:p-8 flex flex-col ${colSpanClass} ${
          isHotZone ? 'border-[#22D3EE] shadow-[0_0_20px_rgba(34,211,238,0.15)]' : 'border-[#374151]'
        }`}
      >
        {/* Background Watermark for Hero */}
        {isHero && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-5">
            <h1 className="text-[12rem] font-black leading-none tracking-tighter ml-[-2rem] mt-[-2rem] text-[#FFFFFF] select-none">
              BATTLE<br/>FIELD
            </h1>
          </div>
        )}

        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-8 border-b border-[#1F2937] pb-4">
            <h2 className="text-sm font-mono tracking-[0.2em] uppercase text-[#9CA3AF] flex items-center">
              {isHotZone && <span className="w-2 h-2 rounded-full bg-[#22D3EE] mr-3 animate-pulse" />}
              {section.title}
            </h2>
            {isHotZone && (
              <span className="text-xs font-bold text-[#000000] bg-[#22D3EE] px-2 py-1 tracking-widest uppercase">
                HOT ZONE
              </span>
            )}
          </div>

          {/* Body Content - Surgical Logic Visualization */}
          <div className="flex flex-col md:flex-row gap-6 md:gap-8">
            
            {/* Structural Logic Bar */}
            <div className="flex-1 flex gap-4">
              <div className="w-1 shrink-0 bg-[#374151]" />
              <div className="flex-1 space-y-4">
                <span className="block text-xs font-mono text-[#6B7280] uppercase tracking-widest">Structural Flow</span>
                <p className={`text-2xl font-black font-sans leading-[1.4] text-[#FFFFFF] ${isHero ? 'md:text-3xl lg:text-4xl' : ''}`}>
                  {highlightKeywords(structFirst)}
                </p>
                {structRest && (
                  <p className="text-sm font-sans leading-[1.7] tracking-[0.02em] text-[#D1D5DB]">
                    {highlightKeywords(structRest)}
                  </p>
                )}
              </div>
            </div>

            {/* Implication Logic Bar */}
            <div className="flex-1 flex gap-4 mt-6 md:mt-0">
              <div className={`w-1 shrink-0 ${isHotZone ? 'bg-[#22D3EE]' : 'bg-[#F59E0B]'}`} />
              <div className="flex-1 space-y-4">
                <span className={`block text-xs font-mono uppercase tracking-widest ${isHotZone ? 'text-[#22D3EE]' : 'text-[#F59E0B]'}`}>
                  Implication
                </span>
                <p className="text-lg font-bold font-sans leading-[1.5] text-[#FFFFFF]">
                  {highlightKeywords(implFirst)}
                </p>
                {implRest && (
                  <p className="text-sm font-sans leading-[1.7] tracking-[0.02em] text-[#D1D5DB]">
                    {highlightKeywords(implRest)}
                  </p>
                )}
              </div>
            </div>

          </div>
        </div>
      </article>
    );
  };

  return (
    <main className="w-full min-h-screen bg-[#000000] text-[#FFFFFF] font-sans selection:bg-[#22D3EE] selection:text-[#000000]">
      {/* Ticker Strip */}
      <TickerStrip />

      {/* Main Layout */}
      <div className="max-w-[1600px] mx-auto p-4 md:p-8 lg:p-12">
        
        {/* Title Area */}
        <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="text-xs font-mono text-[#22D3EE] tracking-[0.3em] uppercase mb-4">Quant Magazine Premium</p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-[#FFFFFF]">
              {data.hook_ko || data.hook || 'Daily Briefing V6'}
            </h1>
          </div>
          <div className="flex gap-4">
            <button
              className="px-4 py-2 text-xs font-mono font-bold tracking-widest border border-[#374151] hover:bg-[#1F2937] transition uppercase"
              onClick={() => void runGenerate(false)}
              disabled={isGenerating}
            >
              Refresh
            </button>
            <button
              className="px-4 py-2 text-xs font-mono font-bold tracking-widest bg-[#22D3EE] text-[#000000] hover:bg-[#06B6D4] transition uppercase"
              onClick={() => void runGenerate(true)}
              disabled={isGenerating}
            >
              Force Regen
            </button>
          </div>
        </div>

        {/* Broken Grid System */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-min">
          
          {/* 1. The Battlefield (Hero, Full Width) */}
          <SectionCard section={heroSection} colSpanClass="md:col-span-12" isHero={true} />

          {/* 2. Live Triggers (Hot-Zone) & 3. Money Flow */}
          <SectionCard section={liveTriggers} colSpanClass="md:col-span-8" isHotZone={true} />
          <SectionCard section={moneyFlow} colSpanClass="md:col-span-4" />

          {/* 4. Macro Tremors & 5. The Hotzones */}
          <SectionCard section={macroTremors} colSpanClass="md:col-span-6" />
          <SectionCard section={hotZones} colSpanClass="md:col-span-6" />

          {/* 6. 24h Radar & 7. System Defcon */}
          <SectionCard section={radar} colSpanClass="md:col-span-4" />
          <SectionCard section={defcon} colSpanClass="md:col-span-8" />

        </div>

      </div>
    </main>
  )
}
