'use client'

import { useState } from 'react'
import TerminalXDashboard from './TerminalXDashboard'
import AIInfrastructureRadar from '@/components/ai-infra/AIInfrastructureRadar'
import { SEMICONDUCTOR_INTELLIGENCE_COPY } from '@/lib/semiconductor/semiconductorIntelligenceCopy'

type SemiconductorIntelligenceTab = 'lens' | 'radar'

const TABS: Array<{
  id: SemiconductorIntelligenceTab
  label: string
  description: string
}> = [
  {
    id: 'lens',
    label: SEMICONDUCTOR_INTELLIGENCE_COPY.soxxLens.label,
    description: SEMICONDUCTOR_INTELLIGENCE_COPY.soxxLens.shortDescription,
  },
  {
    id: 'radar',
    label: SEMICONDUCTOR_INTELLIGENCE_COPY.aiInfrastructureRadar.label,
    description: SEMICONDUCTOR_INTELLIGENCE_COPY.aiInfrastructureRadar.shortDescription,
  },
]

export function SemiconductorIntelligenceShell() {
  const [activeTab, setActiveTab] = useState<SemiconductorIntelligenceTab>('lens')
  const activeTabMeta = TABS.find((tab) => tab.id === activeTab) ?? TABS[0]

  return (
    <div className="min-h-screen bg-[#020408] text-slate-300">
      <section className="border-b border-slate-800 bg-[#05080e] px-4 py-3 md:px-6 xl:px-10 2xl:px-14">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-400">
              {SEMICONDUCTOR_INTELLIGENCE_COPY.coreTagline}
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-white">
              {SEMICONDUCTOR_INTELLIGENCE_COPY.sectionName}
            </h1>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-400">
              {SEMICONDUCTOR_INTELLIGENCE_COPY.shortSubtitle}
            </p>
          </div>

          <div className="flex flex-col gap-2 xl:items-end">
            <div className="flex gap-1 rounded-sm border border-slate-800 bg-slate-950/60 p-1">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    title={tab.description}
                    className={[
                      'min-w-[150px] rounded-sm px-3 py-2 text-left transition',
                      isActive
                        ? 'bg-cyan-400 text-slate-950'
                        : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200',
                    ].join(' ')}
                  >
                    <span className="block text-[11px] font-black uppercase tracking-[0.14em]">
                      {tab.label}
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="max-w-xl text-xs leading-5 text-slate-500 xl:text-right">
              {activeTabMeta.description}
            </p>
          </div>
        </div>
      </section>

      {activeTab === 'lens' ? <TerminalXDashboard /> : <AIInfrastructureRadar />}
    </div>
  )
}
