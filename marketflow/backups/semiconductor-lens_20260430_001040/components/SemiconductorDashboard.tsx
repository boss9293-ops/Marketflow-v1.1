'use client'
import { useState } from 'react'
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceArea,
} from 'recharts'
import {
  Zap, AlertTriangle, History, Target, Clock,
} from 'lucide-react'
import type { SemiconductorOutput } from '@/lib/semiconductor/types'

// Sub-components embedded in Engine layers
import CycleScoreChart    from '@/components/semiconductor/CycleScoreChart'
import BucketPerfChart    from '@/components/semiconductor/BucketPerfChart'
import BucketRSChart      from '@/components/semiconductor/BucketRSChart'
import CyclePlayback      from '@/components/semiconductor/CyclePlayback'
import SoxxAnchor         from '@/components/semiconductor/SoxxAnchor'
import SoxlTactical       from '@/components/semiconductor/SoxlTactical'
import SoxlScoreChart     from '@/components/semiconductor/SoxlScoreChart'
import ActionLayer        from '@/components/semiconductor/ActionLayer'
import LeadersBreadthPanel from '@/components/semiconductor/LeadersBreadthPanel'
import CoreDriverPanel    from '@/components/semiconductor/CoreDriverPanel'
import EducationLayer     from '@/components/semiconductor/EducationLayer'
import CycleHeader        from '@/components/semiconductor/CycleHeader'


// ?? Simulated timeline data (deterministic ??no Math.random) ??????????????
const SUPER_CYCLE = [
  { year: '2000', rev: 500 }, { year: '2002', rev: 450 },
  { year: '2008', rev: 480 }, { year: '2016', rev: 950 },
  { year: '2020', rev: 1250 }, { year: '2024', rev: 1750 }, { year: '2026', rev: 2350 },
]

// ?? Props ?????????????????????????????????????????????????????????????????
interface Props { data: SemiconductorOutput }

// ?? Main component ????????????????????????????????????????????????????????
export default function SemiconductorDashboard({ data }: Props) {
  const { stage, signals, translation } = data
  const [activeTab, setActiveTab] = useState<'Master' | 'Engine' | 'Strategy'>('Engine')

  const engineScore    = stage.stage_score
  const strategyScore  = translation.soxl.suitability
  const isDistortion   = stage.conflict_type === 'AI_DISTORTION'
  const summary        = translation.education_advanced.split('.')[0] + '.'

  const TOOLTIP_STYLE = {
    backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, fontSize: 11,
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-6 font-mono">

      {/* ?? Header ???????????????????????????????????????????????????? */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-900 pb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 tracking-tighter">
              SEMICONDUCTOR UNIFIED ENGINE
            </h1>
            {isDistortion && (
              <span className="px-2 py-0.5 rounded text-[11px] font-black bg-purple-600 text-white animate-pulse">
                AI_DISTORTION
              </span>
            )}
            {stage.conflict_type === 'P1_OVERRIDE' && (
              <span className="px-2 py-0.5 rounded text-[11px] font-black bg-orange-600 text-white">
                P1_OVERRIDE
              </span>
            )}
          </div>
          <p className="text-slate-500 text-[11px] mt-1 font-bold uppercase tracking-widest flex items-center gap-2">
            <Clock size={12}/>
            {stage.stage} STAGE 쨌 {stage.confidence} 쨌 {data.as_of}
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
          {([
            { id: 'Master',   label: 'Master',         icon: <History size={13}/> },
            { id: 'Engine',   label: 'Engine',          icon: <Zap size={13}/> },
            { id: 'Strategy', label: 'Strategy',        icon: <Target size={13}/> },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === t.id
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-slate-500 hover:text-slate-300'
              }`}>
              {t.icon}
              <span className="hidden md:inline">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>

        {/* ?? Main viewport ?????????????????????????????????????????? */}
        <div>

          {/* TAB: Master ??Super Cycle History */}
          {activeTab === 'Master' && (
            <div className="space-y-6">
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-xs font-black text-slate-100 flex items-center gap-2 uppercase tracking-tight mb-6">
                  <History size={14} className="text-emerald-400"/>
                  Memory Super Cycles (2000??026)
                </h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={SUPER_CYCLE}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="year" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <ReferenceArea x1="2020" x2="2026" fill="#3b82f6" fillOpacity={0.05}
                        label={{ position: 'top', value: '4th Cycle (AI)', fill: '#3b82f6', fontSize: 10 }} />
                      <defs>
                        <linearGradient id="gradMaster" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="rev" stroke="#3b82f6" strokeWidth={2.5}
                            fill="url(#gradMaster)" name="Industry Revenue ($B)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-4 text-[11px] text-slate-500 italic leading-relaxed border-l-2 border-slate-700 pl-3">
                  ??궗?곸쑝濡?二쇨?????붾찘?몃낫??1~2遺꾧린 ?좏뻾?⑸땲?? ?꾩옱 4李??덊띁?ъ씠?댁? AI ?명봽???뺤옣???섏엯??怨쇨굅 怨좎젏???곹쉶?섎뒗 留ㅼ텧 寃쎈줈瑜?蹂댁뿬二쇨퀬 ?덉뒿?덈떎.
                </p>
              </div>

              {/* Cycle Playback (historical event comparison) */}
              <CyclePlayback currentStage={stage.stage} />
            </div>
          )}

          {/* TAB: Engine */}
          {activeTab === 'Engine' && (
            <div className="space-y-6">
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
                <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
                  <h3 className="text-xs font-black text-slate-100 uppercase tracking-tight flex items-center gap-2">
                    <Zap size={14} className="text-blue-400"/>
                    Cycle Engine
                  </h3>
                  <span className="px-3 py-1 bg-blue-600/10 border border-blue-500/20 rounded-full text-[11px] font-black text-blue-400">
                    ENGINE SCORE: {engineScore}
                  </span>
                </div>

                <div className="space-y-4">
                  <CycleHeader stage={stage} breadth={signals.breadth_state}
                               momentum={signals.momentum} summary={summary} />
                  <CycleScoreChart currentScore={engineScore} currentStage={stage.stage}
                                   conflictMode={stage.conflict_mode}
                                   conflictType={stage.conflict_type ?? null} />
                </div>
              </div>

              <LeadersBreadthPanel signals={signals} />
              <CoreDriverPanel signals={signals} />

              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-4">
                <BucketPerfChart signals={signals} />
                <BucketRSChart currentPerf={signals.sub_bucket_perf} stage={stage.stage} />
              </div>

              <EducationLayer beginner={translation.education_beginner}
                              advanced={translation.education_advanced} />
            </div>
          )}

          {/* TAB: Strategy ??SOXL Tactical */}
          {activeTab === 'Strategy' && (
            <div className="space-y-6">
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
                <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
                  <div>
                    <h3 className="text-xs font-black text-slate-100 uppercase tracking-tight flex items-center gap-2">
                      <Target size={14} className="text-orange-400"/>
                      SOXX / SOXL Tactical Strategy
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1">AVOID 援ш컙(0??0) 寃異?諛?遺꾪븷 留ㅼ닔-留ㅻ룄 ?꾨왂</p>
                  </div>
                  <span className={`px-4 py-1 rounded-full text-[11px] font-black border ${
                    strategyScore <= 40
                      ? 'bg-red-500/10 text-red-400 border-red-500/30'
                      : strategyScore <= 60
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  }`}>
                    {strategyScore <= 40 ? 'AVOID' : strategyScore <= 60 ? 'CAUTION' : 'ENTER'} 쨌 {strategyScore}/100
                  </span>
                </div>

                {/* SOXL Score trend */}
                <SoxlScoreChart currentScore={strategyScore} currentStage={stage.stage} />
              </div>

              {/* SOXX Anchor */}
              <SoxxAnchor soxx={translation.soxx} signals={signals} />

              {/* SOXL Tactical */}
              <SoxlTactical soxl={translation.soxl} />

              {/* Action Layer */}
              <ActionLayer translation={translation} />

              {strategyScore <= 40 && (
                <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl flex items-start gap-3">
                  <AlertTriangle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-400 font-bold">
                    ALERT: ?꾩옱 ???{strategyScore}?먯쑝濡?AVOID 援ш컙(0??0) ?댁뿉 ?꾩튂. 怨듦꺽??留ㅼ닔??吏?묓븯??떆??
                  </p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      <div className="mt-8 pt-4 border-t border-slate-900 flex justify-between items-center text-[11px] text-slate-700">
        <span>Updated: {data.as_of} 쨌 Tier 2: {signals.tier2_available ? 'Available (delayed)' : 'Tier 1 only'}</span>
        <a href="/soxx-soxl" className="text-blue-600 hover:text-blue-400 transition-colors">
          Screen B standalone ??        </a>
      </div>
    </div>
  )
}
