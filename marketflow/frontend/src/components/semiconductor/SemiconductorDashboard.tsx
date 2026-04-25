'use client'
import { useState, useMemo } from 'react'
import {
  AreaChart, Area, ComposedChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceArea,
} from 'recharts'
import {
  Activity, Globe, Zap, ShieldAlert, TrendingUp, Box, DollarSign,
  ChevronRight, AlertTriangle, History, Target, Layers,
  Clock,
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

// ── Layer definitions ─────────────────────────────────────────────────────
const LAYER_DEFS = [
  { id: 'L0', name: 'Cycle Overview',     icon: <Globe size={16}/>,      desc: 'Stage, Confidence, Conflict Detection',  color: '#6366f1' },
  { id: 'L1', name: 'Supply/Demand',      icon: <Activity size={16}/>,   desc: 'Capex Cycle, S-D Ratio (방향 결정)',       color: '#8b5cf6' },
  { id: 'L2', name: 'ASP / Spot',         icon: <DollarSign size={16}/>, desc: 'DRAM/NAND ASP, 현물가 (실시간 신호)',       color: '#ec4899' },
  { id: 'L3', name: 'Margin',             icon: <TrendingUp size={16}/>, desc: 'Gross/Op Margin (사이클 위치 판단)',        color: '#f43f5e' },
  { id: 'L4', name: 'Inventory',          icon: <Box size={16}/>,        desc: 'Weeks of Inventory (지속성 및 압축도)',     color: '#f59e0b' },
  { id: 'L5', name: 'Valuation',          icon: <Layers size={16}/>,     desc: 'P/B, Forward P/E (기대 및 왜곡 반영)',      color: '#10b981' },
  { id: 'L6', name: 'AI Infrastructure', icon: <Zap size={16}/>,        desc: 'Compute, Memory, Foundry 버킷 분석',       color: '#3b82f6' },
  { id: 'L7', name: 'Conflict/Risk',      icon: <ShieldAlert size={16}/>,desc: 'Decoupling, 지정학적 갈등 감지',           color: '#ef4444' },
]

// ── Simulated timeline data (deterministic — no Math.random) ──────────────
const SUPER_CYCLE = [
  { year: '2000', rev: 500 }, { year: '2002', rev: 450 },
  { year: '2008', rev: 480 }, { year: '2016', rev: 950 },
  { year: '2020', rev: 1250 }, { year: '2024', rev: 1750 }, { year: '2026', rev: 2350 },
]

function buildDailyData() {
  return Array.from({ length: 90 }, (_, i) => {
    const score = Math.min(100, 40 + Math.sin(i * 0.1) * 20 + i * 0.2)
    return {
      date: `D-${90 - i}`,
      score,
      supply: 110 - i * 0.3,
      compute: 100 + i * 0.8,
      memory:  100 + i * 0.6,
      foundry: 100 + i * 0.4,
      equipment: 100 + i * 0.3,
      soxx: 100 + i * 0.5,
      margin: 15 + i * 0.2,
      inventory: 120 - i * 0.4,
      price: 80 + i * 0.5 + Math.sin(i * 0.2) * 5,
    }
  })
}

const DAILY_DATA = buildDailyData()

// ── Props ─────────────────────────────────────────────────────────────────
interface Props { data: SemiconductorOutput }

// ── Main component ────────────────────────────────────────────────────────
export default function SemiconductorDashboard({ data }: Props) {
  const { stage, signals, translation } = data
  const [activeTab, setActiveTab]       = useState<'Master' | 'Engine' | 'Strategy'>('Engine')
  const [selectedLayer, setSelectedLayer] = useState('L0')

  const engineScore    = stage.stage_score
  const strategyScore  = translation.soxl.suitability
  const isDistortion   = stage.conflict_type === 'AI_DISTORTION'
  const summary        = translation.education_advanced.split('.')[0] + '.'

  const TOOLTIP_STYLE = {
    backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, fontSize: 11,
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-6 font-mono">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-900 pb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 tracking-tighter">
              SEMICONDUCTOR UNIFIED ENGINE
            </h1>
            {isDistortion && (
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-600 text-white animate-pulse">
                AI_DISTORTION
              </span>
            )}
            {stage.conflict_type === 'P1_OVERRIDE' && (
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-orange-600 text-white">
                P1_OVERRIDE
              </span>
            )}
          </div>
          <p className="text-slate-500 text-[11px] mt-1 font-bold uppercase tracking-widest flex items-center gap-2">
            <Clock size={12}/>
            {stage.stage} STAGE · {stage.confidence} · {data.as_of}
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
          {([
            { id: 'Master',   label: 'Master',         icon: <History size={13}/> },
            { id: 'Engine',   label: 'Engine (L0-L7)', icon: <Zap size={13}/> },
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ── Left sidebar — L0-L7 ────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-2">
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2 mb-3">
            Architecture Layers
          </p>

          {LAYER_DEFS.map(layer => {
            const active = selectedLayer === layer.id && activeTab === 'Engine'
            return (
              <div key={layer.id}
                onClick={() => { setSelectedLayer(layer.id); setActiveTab('Engine') }}
                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all ${
                  active
                    ? 'bg-blue-600/10 border-blue-500/40 text-blue-400'
                    : 'bg-slate-900/40 border-slate-800/50 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                }`}>
                <span className={active ? 'text-blue-400' : 'text-slate-600'}>{layer.icon}</span>
                <div className="flex-1 overflow-hidden">
                  <div className="text-[10px] font-black opacity-40 leading-none">{layer.id}</div>
                  <div className="text-sm font-bold truncate">{layer.name}</div>
                </div>
                <ChevronRight size={11} className={active ? 'opacity-100' : 'opacity-0'} />
              </div>
            )
          })}

          {/* Cycle Stats card */}
          <div className="mt-4 p-4 bg-slate-900/40 border border-slate-800 rounded-2xl">
            <p className="text-[10px] font-black text-slate-400 mb-3 uppercase tracking-tighter">Cycle Stats</p>
            <div className="space-y-2 text-[11px]">
              {[
                { label: 'Stage',      value: stage.stage,            color: 'text-blue-400' },
                { label: 'Score',      value: `${engineScore} / 100`, color: 'text-emerald-400' },
                { label: 'Confidence', value: stage.confidence,       color: 'text-amber-400' },
                { label: 'SOXL',       value: `${strategyScore} / 100`, color: strategyScore >= 60 ? 'text-emerald-400' : strategyScore >= 40 ? 'text-amber-400' : 'text-red-400' },
                { label: 'Tier 2',     value: signals.tier2_available ? 'Available' : 'Tier 1 only', color: 'text-slate-500' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between items-center border-b border-slate-800/50 pb-1">
                  <span className="text-slate-600">{label}</span>
                  <span className={`font-bold ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Main viewport ────────────────────────────────────────── */}
        <div className="lg:col-span-9">

          {/* TAB: Master — Super Cycle History */}
          {activeTab === 'Master' && (
            <div className="space-y-6">
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-xs font-black text-slate-100 flex items-center gap-2 uppercase tracking-tight mb-6">
                  <History size={14} className="text-emerald-400"/>
                  Memory Super Cycles (2000–2026)
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
                  역사적으로 주가는 펀더멘털보다 1~2분기 선행합니다. 현재 4차 슈퍼사이클은 AI 인프라 확장에 힘입어 과거 고점을 상회하는 매출 경로를 보여주고 있습니다.
                </p>
              </div>

              {/* Cycle Playback (historical event comparison) */}
              <CyclePlayback currentStage={stage.stage} />
            </div>
          )}

          {/* TAB: Engine — L0-L7 layer view */}
          {activeTab === 'Engine' && (
            <div className="space-y-6">
              {/* Layer header */}
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
                <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
                  <div>
                    <h3 className="text-xs font-black text-slate-100 uppercase tracking-tight flex items-center gap-2">
                      {LAYER_DEFS.find(l => l.id === selectedLayer)?.icon}
                      {selectedLayer}: {LAYER_DEFS.find(l => l.id === selectedLayer)?.name}
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {LAYER_DEFS.find(l => l.id === selectedLayer)?.desc}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-blue-600/10 border border-blue-500/20 rounded-full text-[10px] font-black text-blue-400">
                    ENGINE SCORE: {engineScore}
                  </span>
                </div>

                {/* L0: Cycle Overview → CycleHeader + CycleScoreChart */}
                {selectedLayer === 'L0' && (
                  <div className="space-y-4">
                    <CycleHeader stage={stage} breadth={signals.breadth_state}
                                 momentum={signals.momentum} summary={summary} />
                    <CycleScoreChart currentScore={engineScore} currentStage={stage.stage}
                                     conflictMode={stage.conflict_mode}
                                     conflictType={stage.conflict_type ?? null} />
                  </div>
                )}

                {/* L6: AI Infrastructure → Bucket charts */}
                {selectedLayer === 'L6' && (
                  <div className="space-y-4">
                    <BucketPerfChart signals={signals} />
                    <BucketRSChart currentPerf={signals.sub_bucket_perf} stage={stage.stage} />
                  </div>
                )}

                {/* L7: Conflict/Risk → LeadersBreadth + CoreDriver */}
                {selectedLayer === 'L7' && (
                  <div className="space-y-4">
                    <LeadersBreadthPanel signals={signals} />
                    <CoreDriverPanel signals={signals} />
                  </div>
                )}

                {/* L1-L5: Simulated timeline chart (data coming soon) */}
                {['L1', 'L2', 'L3', 'L4', 'L5'].includes(selectedLayer) && (
                  <div>
                    <div className="h-[380px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={DAILY_DATA}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                          <XAxis dataKey="date" stroke="#475569" fontSize={10} interval={14} tickLine={false} />
                          <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={TOOLTIP_STYLE} />
                          <ReferenceLine y={85} stroke="#ef4444" strokeDasharray="3 3"
                            label={{ position: 'right', value: 'L0 Peak',   fill: '#ef4444', fontSize: 9 }} />
                          <ReferenceLine y={65} stroke="#3b82f6" strokeDasharray="3 3"
                            label={{ position: 'right', value: 'L1 Expand', fill: '#3b82f6', fontSize: 9 }} />
                          <ReferenceLine y={45} stroke="#10b981" strokeDasharray="3 3"
                            label={{ position: 'right', value: 'L2 Build',  fill: '#10b981', fontSize: 9 }} />
                          <ReferenceLine y={25} stroke="#f59e0b" strokeDasharray="3 3"
                            label={{ position: 'right', value: 'L3 Bottom', fill: '#f59e0b', fontSize: 9 }} />
                          <ReferenceLine y={engineScore} stroke="#fff" strokeWidth={0.8} strokeDasharray="4 4"
                            label={{ position: 'left', value: `NOW ${engineScore}`, fill: '#fff', fontSize: 10, fontWeight: 900 }} />

                          {selectedLayer === 'L1' && <Bar dataKey="supply"    fill="#6366f1" opacity={0.4} barSize={14} name="Supply Index" />}
                          {selectedLayer === 'L2' && <Line type="monotone" dataKey="price"     stroke="#ec4899" strokeWidth={2} dot={false} name="ASP/Spot" />}
                          {selectedLayer === 'L3' && <Line type="monotone" dataKey="margin"    stroke="#10b981" strokeWidth={2} dot={false} name="Margin %" />}
                          {selectedLayer === 'L4' && <Line type="monotone" dataKey="inventory" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="5 3" name="Inventory Wks" />}
                          {selectedLayer === 'L5' && <Line type="monotone" dataKey="score"     stroke="#a78bfa" strokeWidth={2} dot={false} name="Valuation Score" />}

                          <defs>
                            <linearGradient id="gradScore" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.15}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <Area type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={1.5}
                                fill="url(#gradScore)" name="Engine Score" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="mt-3 text-[10px] text-slate-600 italic">
                      * {selectedLayer} 실제 데이터 연동 예정. 현재 시뮬레이션 표시.
                    </p>
                  </div>
                )}
              </div>

              {/* Always-on education layer below */}
              <EducationLayer beginner={translation.education_beginner}
                              advanced={translation.education_advanced} />
            </div>
          )}

          {/* TAB: Strategy — SOXL Tactical */}
          {activeTab === 'Strategy' && (
            <div className="space-y-6">
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
                <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
                  <div>
                    <h3 className="text-xs font-black text-slate-100 uppercase tracking-tight flex items-center gap-2">
                      <Target size={14} className="text-orange-400"/>
                      SOXX / SOXL Tactical Strategy
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-1">AVOID 구간(0–40) 검출 및 분할 매수-매도 전략</p>
                  </div>
                  <span className={`px-4 py-1 rounded-full text-[11px] font-black border ${
                    strategyScore <= 40
                      ? 'bg-red-500/10 text-red-400 border-red-500/30'
                      : strategyScore <= 60
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  }`}>
                    {strategyScore <= 40 ? 'AVOID' : strategyScore <= 60 ? 'CAUTION' : 'ENTER'} · {strategyScore}/100
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
                    ALERT: 현재 타점 {strategyScore}점으로 AVOID 구간(0–40) 내에 위치. 공격적 매수는 지양하십시오.
                  </p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      <div className="mt-8 pt-4 border-t border-slate-900 flex justify-between items-center text-[11px] text-slate-700">
        <span>Updated: {data.as_of} · Tier 2: {signals.tier2_available ? 'Available (delayed)' : 'Tier 1 only'}</span>
        <a href="/soxx-soxl" className="text-blue-600 hover:text-blue-400 transition-colors">
          Screen B standalone →
        </a>
      </div>
    </div>
  )
}
