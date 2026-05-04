'use client'
import { useState, useMemo } from 'react'
import type { SemiconductorOutput } from '@/lib/semiconductor/types'


// ???? Fonts injected once ????????????????????????????????????????????????????????????????????????????????????????????????????????
const FONT_STYLE = `@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=JetBrains+Mono:wght@400;500&display=swap');`
const PAGE_ZOOM = '108%'
const CARD_ZOOM = '112.5%'

// ???? Deterministic line generator (Math.sin ??no hydration issue) ??????????????????????
const MONTHS = Array.from({ length: 33 }, (_, i) => `M${i}`)
const YEARS  = Array.from({ length: 31 }, (_, i) => 2000 + i)

function genLine(base: number, vol: number, trend: number, seed: number): number[] {
  let v = base
  return MONTHS.map((_, i) => {
    const r = Math.sin(seed + i * 0.7) * vol + Math.cos(seed + i * 1.3) * vol * 0.5
    v = v + trend + r
    return Math.max(60, Math.round(v * 10) / 10)
  })
}

const SOXX_LINES = {
  scenA:   genLine(100, 3, 0.6, 2),
  currTraj:genLine(100, 4, 0.15, 5),
  preAvg:  genLine(100, 2.5, 0.3, 1),
  scenC:   genLine(97, 3, -0.3, 8),
}

const SC2030_LINES = {
  hist:  [22,25,28,35,30,32,38,55,45,50,62,70,60,55,80,95,85,90,110,120,null,null,null,null,null,null,null,null,null,null,null] as (number|null)[],
  scenA: [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,120,130,145,158,172,180,185,190,192,195,198] as (number|null)[],
  scenB: [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,120,125,135,142,150,155,157,158,160,162,165] as (number|null)[],
  scenC: [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,120,112,105,95,88,85,87,90,92,94,96] as (number|null)[],
}

const RADAR_AXES = ['Hyperscaler\nCapex', 'GPU\nDemand', 'HBM\nSupply', 'Power\nBottleneck', 'L2\nASP/Spot', 'L5\nValuation', 'Geopolitics']
const RADAR_VALS = {
  A: [0.85, 0.90, 0.75, 0.60, 0.70, 0.80, 0.55],
  B: [0.70, 0.75, 0.80, 0.50, 0.60, 0.65, 0.45],
  C: [0.40, 0.45, 0.55, 0.85, 0.35, 0.30, 0.75],
}

// ???? SVG Line Chart ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????
interface LineData { vals: (number|null)[]; color: string; dashed?: boolean; label: string }
function SvgLineChart({ lines, xLabels, yMin, yMax, height = 140 }: {
  lines: LineData[]; xLabels: (string|number)[]; yMin: number; yMax: number; height?: number
}) {
  const W = 480; const H = height
  const pad = { l: 28, r: 8, t: 6, b: 18 }
  const iw = W - pad.l - pad.r; const ih = H - pad.t - pad.b
  const xs = (i: number) => pad.l + (i / (xLabels.length - 1)) * iw
  const ys = (v: number) => pad.t + ih - ((v - yMin) / (yMax - yMin)) * ih
  const gridStep = Math.round((yMax - yMin) / 4)
  const gridVals: number[] = []
  for (let v = yMin; v <= yMax; v += gridStep) gridVals.push(v)
  const xStep = Math.floor(xLabels.length / 7)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <defs>
        {lines.map((l, i) => (
          <linearGradient key={i} id={`lg${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={l.color} stopOpacity="0.12" />
            <stop offset="100%" stopColor={l.color} stopOpacity="0.01" />
          </linearGradient>
        ))}
      </defs>
      {gridVals.map(v => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={ys(v)} y2={ys(v)} stroke="#1a2d50" strokeWidth="0.5" />
          <text x={pad.l - 3} y={ys(v) + 3} textAnchor="end" fill="#7aaccf" fontSize="9" fontFamily="monospace">{v}</text>
        </g>
      ))}
      {xLabels.map((label, i) => i % xStep === 0 && (
        <text key={i} x={xs(i)} y={H - 3} textAnchor="middle" fill="#7aaccf" fontSize="9" fontFamily="monospace">{label}</text>
      ))}
      {lines.map((line, li) => {
        const segs: [number, number][][] = []
        let seg: [number, number][] = []
        line.vals.forEach((v, i) => {
          if (v !== null) { seg.push([i, v]) }
          else if (seg.length) { segs.push(seg); seg = [] }
        })
        if (seg.length) segs.push(seg)
        return segs.map((s, si) => {
          if (s.length < 2) return null
          const d = s.map(([i, v], idx) => `${idx === 0 ? 'M' : 'L'} ${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`).join(' ')
          const aD = `${d} L ${xs(s[s.length-1][0]).toFixed(1)} ${(pad.t+ih).toFixed(1)} L ${xs(s[0][0]).toFixed(1)} ${(pad.t+ih).toFixed(1)} Z`
          return (
            <g key={`${li}-${si}`}>
              {!line.dashed && si === 0 && <path d={aD} fill={`url(#lg${li})`} />}
              <path d={d} fill="none" stroke={line.color}
                strokeWidth={line.dashed ? 1.2 : 1.8}
                strokeDasharray={line.dashed ? '5,4' : undefined} opacity={0.9} />
            </g>
          )
        })
      })}
    </svg>
  )
}

// ???? SVG Radar Chart ????????????????????????????????????????????????????????????????????????????????????????????????????????????????
function SvgRadarChart({ vals, color, size = 160 }: { vals: number[]; color: string; size?: number }) {
  const n = RADAR_AXES.length
  const cx = size / 2; const cy = size / 2; const r = size * 0.34
  const ang = (i: number) => (Math.PI * 2 * i / n) - Math.PI / 2
  const px = (i: number, s: number) => cx + Math.cos(ang(i)) * r * s
  const py = (i: number, s: number) => cy + Math.sin(ang(i)) * r * s
  const poly = vals.map((v, i) => `${i === 0 ? 'M' : 'L'} ${px(i, v).toFixed(1)} ${py(i, v).toFixed(1)}`).join(' ') + ' Z'
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
      {[0.25, 0.5, 0.75, 1].map(s => (
        <polygon key={s} fill="none" stroke="#1a2d50" strokeWidth="0.7"
          points={RADAR_AXES.map((_, i) => `${px(i, s).toFixed(1)},${py(i, s).toFixed(1)}`).join(' ')} />
      ))}
      {RADAR_AXES.map((_, i) => (
        <line key={i} x1={cx} y1={cy} x2={px(i, 1).toFixed(1)} y2={py(i, 1).toFixed(1)} stroke="#1a2d50" strokeWidth="0.7" />
      ))}
      <path d={poly} fill={color} fillOpacity="0.25" stroke={color} strokeWidth="1.5" />
      {vals.map((v, i) => <circle key={i} cx={px(i, v)} cy={py(i, v)} r="2.5" fill={color} />)}
      {RADAR_AXES.map((label, i) => {
        const lx = px(i, 1.3); const ly = py(i, 1.3)
        const parts = label.split('\n')
        return (
          <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fill="#a8cce0" fontSize="9" fontFamily="Inter,sans-serif">
            {parts.map((p, pi) => <tspan key={pi} x={lx} dy={pi === 0 ? (parts.length > 1 ? -4 : 0) : 8}>{p}</tspan>)}
          </text>
        )
      })}
    </svg>
  )
}

// ???? CSS-in-JS constants ????????????????????????????????????????????????????????????????????????????????????????????????????????
const BG  = { bg0: '#03060e', bg1: '#070d1a', bg2: '#0a1225', bg3: '#0f1b35', border: '#1a2d50', border2: '#1f3a66' }
const CLR = { cyan: '#00e5ff', green: '#00ff88', yellow: '#ffd700', orange: '#ff8c00', red: '#ff3d5a', dim: '#5a7aaa', white: '#e8f0fe' }

// ???? Main component ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????
const UI_FONT = "'Inter', 'Pretendard', sans-serif";
const DATA_FONT = "'JetBrains Mono', 'Roboto Mono', monospace";

export default function SoxxSoxlDashboard({ data }: { data: SemiconductorOutput }) {
  const { stage, signals, translation } = data

  const [activeScen, setActiveScen] = useState<'A' | 'B' | 'C'>('A')
  const [aiDist, setAiDist] = useState(stage.conflict_type === 'AI_DISTORTION')

  const radarVals  = RADAR_VALS[activeScen]
  const radarColor = activeScen === 'A' ? CLR.green : activeScen === 'B' ? '#a78bfa' : CLR.red

  // Derive live signals from API
  const liveSignals = useMemo(() => [
    {
      name: 'Hyperscaler Capex', icon: 'CPX',
      str: signals.capex_signal === 'STRONG' || signals.capex_signal === 'EXPANDING' ? 'strong' : signals.capex_signal === 'CONTRACTING' ? 'weak' : 'warn',
      sub: `Capex: ${signals.capex_signal} 夷?Score ${signals.capex_score}/100`,
    },
    {
      name: 'GPU / Compute', icon: 'GPU',
      str: signals.sub_bucket_perf.compute >= 0 ? 'strong' : signals.sub_bucket_perf.compute >= -5 ? 'warn' : 'weak',
      sub: `Compute bucket ${signals.sub_bucket_perf.compute > 0 ? '+' : ''}${signals.sub_bucket_perf.compute}pp vs SOXX`,
    },
    {
      name: 'HBM / Memory', icon: 'HBM',
      str: signals.memory_strength === 'STRONG' ? 'strong' : signals.memory_strength === 'RECOVERING' ? 'warn' : 'weak',
      sub: `Memory: ${signals.memory_strength} 夷?Score ${signals.memory_score}/100`,
    },
    {
      name: 'Power / Constraint', icon: 'PWR',
      str: signals.constraint_warning === 'LOW' ? 'strong' : signals.constraint_warning === 'HIGH' ? 'weak' : 'warn',
      sub: `Constraint: ${signals.constraint_warning} 夷?${signals.constraint_score}/100`,
    },
    {
      name: 'Geopolitics / Breadth', icon: 'GEO',
      str: signals.breadth_state === 'VERY BROAD' || signals.breadth_state === 'BROAD' ? 'strong' : signals.breadth_state === 'NARROW' ? 'weak' : 'warn',
      sub: `Breadth: ${signals.breadth_state} 夷?${signals.breadth_score}/100`,
    },
    {
      name: 'L2 ASP / Price', icon: 'ASP',
      str: signals.price === 'RISING' ? 'strong' : signals.price === 'DECLINING' ? 'weak' : 'warn',
      sub: `Price: ${signals.price} 夷?SOXX vs QQQ ${signals.soxx_vs_qqq_60d > 0 ? '+' : ''}${(signals.soxx_vs_qqq_60d * 100).toFixed(1)}%`,
    },
  ], [signals])

  // Status pill colors
  const stageColor = { PEAK: CLR.yellow, EXPAND: CLR.green, BUILD: '#60a5fa', RESET: CLR.red, BOTTOM: '#a78bfa' }[stage.stage] ?? CLR.white
  const soxxColor  = translation.soxx.action === 'BUY' ? CLR.green : translation.soxx.action === 'HOLD' ? '#60a5fa' : CLR.red
  const soxlColor  = translation.soxl.window === 'ALLOWED' ? CLR.green : translation.soxl.window === 'TACTICAL ONLY' ? CLR.yellow : CLR.red

  const sc = {
    A: { pct: stage.confidence === 'HIGH' ? '70%' : stage.confidence === 'MODERATE' ? '55%' : '40%',
         desc: 'AI Capex cycle sustains ??Hyperscaler demand drives SOXX above prior cycle peaks. Equipment P1 lag reflects AI investment delay, not cycle end.' },
    B: { pct: '25%',
         desc: 'Moderate AI demand ??Equipment cycle recovery partial. SOXX tracks historical average. Memory normalization keeps upside contained.' },
    C: { pct: stage.confidence === 'LOW' ? '35%' : '15%',
         desc: 'AI Capex stalls ??Power bottleneck + geopolitics compress SOXX. Equipment LAGGING becomes classical downturn signal.' },
  }

  const soxxActionLabel = `${translation.soxx.action} [${translation.soxx.dominant_signal}]`
  const soxlActionLabel = `${translation.soxl.window} 夷?${translation.soxl.sizing}`

  const S: React.CSSProperties = {}

  return (
    <>
      <style suppressHydrationWarning>{FONT_STYLE}</style>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh',
                    background: BG.bg0, color: CLR.white, fontFamily: 'Inter, sans-serif', fontSize: 13, zoom: PAGE_ZOOM }}>

        {/* ???? HEADER ???????????????????????????????????????????????????????????????????????????????????????????????????? */}
        <div style={{ background: 'linear-gradient(180deg,#0a1530 0%,#070d1a 100%)', borderBottom: `1px solid ${BG.border2}`, padding: '8px 16px 0', flexShrink: 0 }}>
          <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 18, fontWeight: 900, letterSpacing: '0.1em',
                        background: 'linear-gradient(90deg,#00e5ff 0%,#a5f3ff 40%,#fff 70%,#00ff88 100%)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 6 }}>
            POST-AI SEMICONDUCTOR CYCLE ENGINE
          </div>
          <div style={{ display: 'flex', alignItems: 'center', height: 28, gap: 0 }}>
            {[
              { label: 'CURRENT PHASE:', val: stage.stage, color: stageColor },
              { label: 'CONFLICT:', val: stage.conflict_type ?? 'NONE', color: stage.conflict_type === 'AI_DISTORTION' ? '#a78bfa' : stage.conflict_type ? CLR.orange : CLR.dim },
              { label: 'SOXX JUDGMENT:', val: translation.soxx.action, color: soxxColor },
              { label: 'SOXL JUDGMENT:', val: translation.soxl.window, color: soxlColor },
              { label: 'AS OF:', val: data.as_of, color: CLR.dim },
            ].map((p, i, arr) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', height: 28,
                                    border: `1px solid ${BG.border2}`, borderRight: i < arr.length - 1 ? 'none' : `1px solid ${BG.border2}`,
                                    background: BG.bg2, fontSize: 12,
                                    borderRadius: i === 0 ? '3px 0 0 3px' : i === arr.length - 1 ? '0 3px 3px 0' : 0 }}>
                <span style={{ color: CLR.dim }}>{p.label}</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: p.color }}>{p.val}</span>
              </div>
            ))}
          </div>
          <div style={{ height: 8 }} />
        </div>

        {/* ???? MAIN scroll container ???????????????????????????????????????????????????????????????????? */}
        <div style={{ flex: 1, overflowY: 'auto', background: BG.bg2, borderTop: `1px solid ${BG.border2}`, padding: '24px 0' }}>
          <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 64px', display: 'flex', flexDirection: 'column', gap: 20, zoom: CARD_ZOOM }}>

          {/* ???? PANEL 1 ??Pre/Post AI ?????????????????????????????????????????????????????????????????? */}
          <div style={{ height: 580, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 10, gap: 8, background: BG.bg1, borderRadius: 6, border: `1px solid ${BG.border}` }}>

            {/* Pre/Post comparison cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, flexShrink: 0 }}>
              {/* Pre-AI card */}
              <div style={{ background: BG.bg2, border: `1px solid ${BG.border2}`, borderRadius: 4, padding: 10, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#60a5fa,#2563eb)' }} />
                <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: '#60a5fa', marginBottom: 3 }}>Pre-AI (2000-2023)</div>
                <div style={{ fontSize: 11, color: CLR.dim, marginBottom: 6, lineHeight: 1.4 }}>
                  Cycle: <span style={{ color: '#93c5fd' }}>4-5 years / Predictable</span><br/>
                  SOXX Explanatory Power: <span style={{ color: '#93c5fd' }}>85%</span>
                </div>
                <div style={{ height: 1, background: BG.border, margin: '4px 0' }} />
                {[['E', 'Equipment P1 Leading'], ['D', 'DRAM/NAND ASP'], ['P', 'PC/Smartphone Shipments'], ['R', 'Interest/Dollar Rates'], ['I', 'Inventory Weeks']].map(([icon, text], i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 0', fontSize: 12, color: '#a0b8d8', borderBottom: i < 4 ? `1px solid #0d1a30` : 'none' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: CLR.dim, width: 12 }}>{i+1}.</span>
                    <span style={{ fontSize: 13 }}>{icon}</span>
                    <span>{text}</span>
                  </div>
                ))}
              </div>

              {/* Post-AI card */}
              <div style={{ background: BG.bg2, border: `1px solid ${BG.border2}`, borderRadius: 4, padding: 10, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#00e5ff,#00ff88)' }} />
                <div style={{ position: 'absolute', top: 10, right: 10, width: 6, height: 6, borderRadius: '50%', background: CLR.red, boxShadow: `0 0 6px ${CLR.red}` }} />
                <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: CLR.cyan, marginBottom: 3 }}>Post-AI (2024-2030)</div>
                <div style={{ fontSize: 11, color: CLR.dim, marginBottom: 6, lineHeight: 1.4 }}>
                  Cycle: <span style={{ color: CLR.cyan }}>Uncertain / AI Structural Demand</span><br/>
                  Baseline Model Explanatory Power: <span style={{ color: CLR.cyan }}>40??0%</span>
                </div>
                <div style={{ height: 1, background: BG.border, margin: '4px 0' }} />
                {[['C', 'Hyperscaler Capex'], ['G', 'GPU/AI Accelerator'], ['H', 'HBM Supply'], ['P', 'Power/Infra Bottleneck'], ['R', 'Geopolitics']].map(([icon, text], i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 0', fontSize: 12, color: '#a0b8d8', borderBottom: i < 4 ? `1px solid #0d1a30` : 'none' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: CLR.dim, width: 12 }}>{i+1}.</span>
                    <span style={{ fontSize: 13 }}>{icon}</span>
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* SOXX Rebased Chart */}
            <div style={{ flex: 1, background: BG.bg2, border: `1px solid ${BG.border}`, borderRadius: 4, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: CLR.cyan, padding: '6px 12px', borderBottom: `1px solid ${BG.border}`, flexShrink: 0, letterSpacing: '0.04em' }}>
                SOXX/SOXL ??Pre vs Post AI Reaction Gap (Rebased 100)
              </div>
              <div style={{ flex: 1, padding: '4px 8px', minHeight: 0 }}>
                <SvgLineChart
                  lines={[
                    { vals: SOXX_LINES.scenA,    color: '#00ff88', label: 'Post-AI Scenario A' },
                    { vals: SOXX_LINES.currTraj,  color: '#f472b6', label: 'Current Trajectory' },
                    { vals: SOXX_LINES.preAvg,    color: '#60a5fa', dashed: true, label: 'Pre-AI Avg (4 Cycles)' },
                    { vals: SOXX_LINES.scenC,     color: '#f87171', dashed: true, label: 'Post-AI Scenario C' },
                  ]}
                  xLabels={MONTHS} yMin={65} yMax={145}
                />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '4px 12px 6px', borderTop: `1px solid ${BG.border}`, flexShrink: 0 }}>
                {[
                  { color: '#00ff88', label: 'Post-AI Scenario A', dash: false },
                  { color: '#f472b6', label: 'Current Trajectory', dash: false },
                  { color: '#60a5fa', label: 'Pre-AI Avg (4 Cycles)', dash: true },
                  { color: '#f87171', label: 'Post-AI Scenario C', dash: true },
                ].map((l, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: CLR.dim }}>
                    <div style={{ width: 18, borderTop: `2px ${l.dash ? 'dashed' : 'solid'} ${l.color}`, opacity: 0.85 }} />
                    {l.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Footer note */}
            <div style={{ fontSize: 11, color: '#3a5878', lineHeight: 1.5, flexShrink: 0 }}>
              Equipment P1 leading signal was the strongest predictor of SOXX decline in Pre-AI. In Post-AI, Equipment LAGGING does not mean &apos;end of cycle&apos; but &apos;AI investment delay&apos; ??the same interpretation is not applicable.
              {stage.conflict_type === 'AI_DISTORTION' && <span style={{ color: '#a78bfa', fontWeight: 600 }}> [AI_DISTORTION active]</span>}
            </div>
          </div>

          {/* ???? PANEL 2 ??Scenario / Signals ???????????????????????????????????????????????????? */}
          <div style={{ height: 720, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: BG.bg0, borderRadius: 6, border: `1px solid ${BG.border}` }}>

            {/* AI Distortion toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 14px', background: BG.bg1, borderBottom: `1px solid ${BG.border}`, flexShrink: 0, fontSize: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: CLR.dim }}>AI Distortion:</span>
                <div onClick={() => setAiDist(v => !v)} style={{ width: 32, height: 14, background: aiDist ? '#00b4d8' : BG.bg2, borderRadius: 7, position: 'relative', cursor: 'pointer', transition: 'background 0.2s', border: `1px solid ${BG.border2}` }}>
                  <div style={{ position: 'absolute', top: 2, left: aiDist ? 18 : 2, width: 10, height: 10, borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
                </div>
                <span style={{ color: aiDist ? CLR.cyan : CLR.dim, fontWeight: 600 }}>{aiDist ? 'ON' : 'OFF'}</span>
                {aiDist && <span style={{ fontSize: 11, color: '#a78bfa', background: '#1a0d35', padding: '1px 6px', borderRadius: 3, fontFamily: 'monospace' }}>AI_DISTORTION: {stage.conflict_note?.slice(0, 50)}...</span>}
              </div>
              <span style={{ fontSize: 11, color: CLR.dim }}>Engine v2.0</span>
            </div>

            {/* Scenario 2030 section ??top half */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 8, gap: 6, borderBottom: `1px solid ${BG.border2}` }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5, flexShrink: 0 }}>
                {(['A', 'B', 'C'] as const).map(id => {
                  const colors = { A: { border: activeScen === 'A' ? '#00ff88' : '#00aa55', bg: '#001a0a', label: '#00ff88' }, B: { border: activeScen === 'B' ? '#a78bfa' : '#7c3aed', bg: '#0d0d1e', label: '#a78bfa' }, C: { border: activeScen === 'C' ? '#ff3d5a' : '#b91c1c', bg: '#1a0508', label: '#f87171' } }[id]
                  return (
                    <div key={id} onClick={() => setActiveScen(id)} style={{ borderRadius: 4, padding: 8, border: `1px solid ${colors.border}`, background: colors.bg, cursor: 'pointer', boxShadow: activeScen === id ? `0 0 10px ${colors.border}30` : 'none', transition: 'all 0.15s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontFamily: 'Orbitron, monospace', fontSize: 12, fontWeight: 700, color: colors.label }}>Scenario {id}</span>
                        <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600, color: colors.label }}>{sc[id].pct}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#6a8aaa', lineHeight: 1.4 }}>{sc[id].desc}</div>
                    </div>
                  )
                })}
              </div>

              <div style={{ flex: 1, background: BG.bg2, border: `1px solid ${BG.border}`, borderRadius: 4, overflow: 'hidden', minHeight: 0 }}>
                <SvgLineChart
                  lines={[
                    { vals: SC2030_LINES.hist,  color: '#60a5fa', dashed: true, label: 'Historical' },
                    { vals: SC2030_LINES.scenA, color: '#00ff88', label: 'Scenario A' },
                    { vals: SC2030_LINES.scenB, color: '#a78bfa', label: 'Scenario B' },
                    { vals: SC2030_LINES.scenC, color: '#f87171', dashed: true, label: 'Scenario C' },
                  ]}
                  xLabels={YEARS} yMin={15} yMax={210} height={110}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, flexShrink: 0 }}>
                {[
                  { label: 'SOXX Action Guideline:', val: soxxActionLabel, color: soxxColor },
                  { label: 'SOXL Action Guideline:', val: soxlActionLabel, color: soxlColor },
                ].map((p, i) => (
                  <div key={i} style={{ background: BG.bg3, border: `1px solid ${BG.border2}`, borderRadius: 3, padding: '5px 10px', fontSize: 11, textAlign: 'center' }}>
                    <div style={{ color: CLR.dim, marginBottom: 2 }}>{p.label}</div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: p.color }}>{p.val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Signal section ??bottom half */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1, overflow: 'hidden', minHeight: 0 }}>
                {/* Radar */}
                <div style={{ padding: 8, borderRight: `1px solid ${BG.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <div style={{ fontSize: 11, color: CLR.dim, letterSpacing: '0.05em' }}>SCENARIO {activeScen} ??FACTOR MAP</div>
                  <SvgRadarChart vals={radarVals} color={radarColor} size={160} />
                </div>

                {/* Signal cards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: 6, overflowY: 'auto', alignContent: 'start' }}>
                  {liveSignals.map((s, i) => {
                    const strColor = s.str === 'strong' ? CLR.green : s.str === 'warn' ? CLR.orange : CLR.red
                    const strBg    = s.str === 'strong' ? '#00331a' : s.str === 'warn' ? '#331a00' : '#330d14'
                    const strLabel = s.str === 'strong' ? 'Strong' : s.str === 'warn' ? 'Caution' : 'Weak'
                    return (
                      <div key={i} style={{ background: BG.bg2, border: `1px solid ${BG.border}`, borderRadius: 3, padding: '5px 7px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: 16 }}>{s.icon}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: CLR.white, lineHeight: 1.2 }}>{s.name}</span>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 5px', borderRadius: 2, background: strBg, color: strColor, display: 'inline-block' }}>{strLabel}</span>
                        <span style={{ fontSize: 11, color: CLR.dim, lineHeight: 1.3 }}>{s.sub}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Final judgment bar */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: `1px solid ${BG.border2}`, flexShrink: 0 }}>
                <div style={{ padding: '6px 12px', textAlign: 'center', borderRight: `1px solid ${BG.border2}` }}>
                  <div style={{ fontSize: 11, color: CLR.dim, marginBottom: 2 }}>SOXX Final Judgment</div>
                  <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 14, fontWeight: 700, letterSpacing: '0.05em', color: soxxColor }}>{translation.soxx.action} ??{translation.soxx.dominant_signal}</div>
                </div>
                <div style={{ padding: '6px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: CLR.dim, marginBottom: 2 }}>SOXL Final Judgment</div>
                  <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 14, fontWeight: 700, letterSpacing: '0.05em', color: soxlColor }}>{translation.soxl.window} {translation.soxl.sizing}</div>
                </div>
              </div>
            </div>
          </div>
          </div>{/* end centering wrapper */}
        </div>{/* end scroll container */}
      </div>
    </>
  )
}

