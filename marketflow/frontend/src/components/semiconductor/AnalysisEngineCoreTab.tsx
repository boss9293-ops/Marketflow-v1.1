'use client'
// 반도체 사이클 엔진 — 3-Layer Pyramid 기반 분석 탭 (레퍼런스 HTML 직접 포팅)

import { useState, useEffect } from 'react'
import type { SemiconductorFundamentalsPayload, FundamentalMetric, DataStatus } from '@/lib/semiconductor/fundamentalDataContract'
import type { BenchmarkId, BenchmarkRSPayload, RelativeStatus } from '@/lib/semiconductor/benchmarkRelativeStrength'
import { formatReturn, formatRelative, PENDING_RS_PAYLOAD } from '@/lib/semiconductor/benchmarkRelativeStrength'
import type { RrgPathPayload } from '@/lib/semiconductor/rrgPathData'
import { PENDING_RRG_PAYLOAD } from '@/lib/semiconductor/rrgPathData'
import type { BucketSeverity, LeadershipMode } from '@/lib/semiconductor/rrgInterpretation'
import { classifyBucketRotation, classifyRrgRotation } from '@/lib/semiconductor/rrgInterpretation'
import type { SoxlDecayPayload, SoxlDecayWindow, SoxlDecayStatus } from '@/lib/semiconductor/soxlDecay'
import { PENDING_SOXL_DECAY, DECAY_STATUS_COLOR, DECAY_STATUS_LABEL, fmtDecay, fmtReturn } from '@/lib/semiconductor/soxlDecay'
import type { SemiconductorFlowProxyPayload } from '@/lib/semiconductor/flowProxy'
import { PENDING_FLOW_PROXY, FLOW_STATUS_COLOR, FLOW_STATUS_DOT } from '@/lib/semiconductor/flowProxy'

const V = {
  bg:'#0C1628', bg2:'#111E32', bg3:'#162238', border:'#223048', brd2:'#1A2740',
  teal:'#3FB6A8', amber:'#F2A93B', mint:'#5DCFB0', red:'#E55A5A', gold:'#D4B36A',
  blue:'#4A9EE0', text:'#E8F0F8', text2:'#B8C8DC', text3:'#6B7B95',
  ui:"'IBM Plex Sans', sans-serif", mono:"'IBM Plex Mono', monospace",
}

type CenterTab = 'map'|'cycle'|'perform'|'health'|'soxl'
type HistTab   = 'event'|'snapshot'

// ── Live data types ───────────────────────────────────────────────────────────
type AIComp = { state: string; signal: number; spread: number; note: string; sources: string[] }
type InterpAIRegime = {
  regime_label: string; regime_confidence: string; data_mode?: string
  ai_infra: AIComp; memory: AIComp; foundry: AIComp; equipment: AIComp; rotation_risk: AIComp
}
type LiveBucket = { name: string; color: string; m6: string; vs_soxx: string; up: boolean }
type RsRow      = { name: string; rs: string; vs: string; up: boolean }
type LiveKpis   = {
  engine_score: number; stage: string; cycle_position: number
  breadth_pct: number; advancing_pct: number; declining_pct: number
  confidence_label: string; confidence_score: number
  leader_concentration_top5: number | null; equal_weight_vs_cap_spread: number | null
  market_regime: string
}
type BreadthDetail  = { pct_above_ma20: number | null; pct_above_ma50: number | null; pct_above_ma200: number | null }
type MomentumDetail = { rsi_14: number | null; roc_1m: number | null; roc_3m: number | null }
type HistRow = { date: string; comp: number; phase: string }

interface Props {
  live?: {
    kpis: LiveKpis; buckets: LiveBucket[]; rs_table: RsRow[]
    breadth_detail?: BreadthDetail | null
    momentum_detail?: MomentumDetail | null
  } | null
  interpData?: {
    ai_regime?: InterpAIRegime; regime_context?: string
    summary?: string; interpretation?: string
  } | null
  history?: { rows: HistRow[] } | null
  onViewDataLab?: () => void
  dataStatusCounts?: { live: number; cache: number; static: number; pending: number }
  fundamentals?: SemiconductorFundamentalsPayload | null
  fundamentalsLoading?: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function stageColor(stage: string): string {
  const s = stage.toUpperCase()
  if (s.includes('CONTRACTION') || s.includes('PEAK')) return V.red
  if (s.includes('LATE')) return V.amber
  if (s.includes('EARLY')) return V.mint
  return V.teal
}
function flowBadge(state: string): { badge: string; color: string } {
  const s = (state ?? '').toLowerCase()
  if (s === 'confirmed' || s === 'strong')   return { badge:'CONFIRMED', color:V.teal }
  if (s === 'partial')                        return { badge:'PARTIAL',   color:V.teal }
  if (s === 'lagging' || s === 'declining')   return { badge:'LAGGING',   color:V.red  }
  return                                             { badge:'WEAK',      color:V.amber }
}
function fmtPp(v: number): string { return `${v>=0?'+':''}${v.toFixed(1)}pp` }
function barW(state: string): string {
  const b = flowBadge(state).badge
  if (b==='CONFIRMED') return '80%'; if (b==='PARTIAL') return '65%'; if (b==='LAGGING') return '20%'; return '40%'
}
function regimeDisplay(label: string): string {
  const m: Record<string,string> = {AI_LED_BROAD:'AI-led Broadening',AI_LED_NARROW:'Narrow AI Leadership',ROTATING:'Capital Rotation',BROAD_RECOVERY:'Broad Recovery',CONTRACTION:'Semiconductor Contraction'}
  return m[label] ?? label.replace(/_/g,' ')
}
function gaugeArc(cx: number, cy: number, r: number, pct: number) {
  const p = Math.max(0.5, Math.min(99.5, pct))
  const t = Math.PI * (1 - p / 100)
  const ex = cx + r * Math.cos(t), ey = cy - r * Math.sin(t)
  return { path:`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${ex.toFixed(1)} ${ey.toFixed(1)}`, ex, ey }
}

function EduBox({ title, children }: { title:string; children:React.ReactNode }) {
  return (
    <div style={{background:'rgba(63,182,168,0.06)',border:'1px solid rgba(63,182,168,0.2)',borderRadius:5,padding:'10px 12px',marginBottom:12,fontSize:12,color:V.text2,lineHeight:1.6,fontFamily:V.ui}}>
      <div style={{fontSize:11,fontWeight:600,color:V.teal,letterSpacing:'0.10em',marginBottom:5,fontFamily:V.ui}}>{title}</div>
      {children}
    </div>
  )
}

function Card({ children, style }: { children:React.ReactNode; style?:React.CSSProperties }) {
  return <div style={{background:V.bg2,border:`1px solid ${V.border}`,borderRadius:6,padding:'10px 12px',marginBottom:8,...style}}>{children}</div>
}

function SecTitle({ children, style }: { children:React.ReactNode; style?:React.CSSProperties }) {
  return <div style={{fontSize:10,fontWeight:600,letterSpacing:'0.16em',color:V.text3,marginBottom:8,display:'flex',alignItems:'center',justifyContent:'space-between',fontFamily:V.ui,...style}}>{children}</div>
}

function RegimeBars({ aiRegime }: { aiRegime?: InterpAIRegime }) {
  const rows = aiRegime ? [
    {name:'AI Infra',  w:barW(aiRegime.ai_infra.state),   color:V.teal,  sig:`${flowBadge(aiRegime.ai_infra.state).badge} ${fmtPp(aiRegime.ai_infra.spread)}`},
    {name:'Memory',   w:barW(aiRegime.memory.state),      color:V.amber, sig:`${flowBadge(aiRegime.memory.state).badge} ${fmtPp(aiRegime.memory.spread)}`},
    {name:'Foundry',  w:barW(aiRegime.foundry.state),     color:V.gold,  sig:`${flowBadge(aiRegime.foundry.state).badge} ${fmtPp(aiRegime.foundry.spread)}`},
    {name:'Equipment',w:barW(aiRegime.equipment.state),   color:V.red,   sig:`${flowBadge(aiRegime.equipment.state).badge} ${fmtPp(aiRegime.equipment.spread)}`},
    {name:'Rotation', w:barW(aiRegime.rotation_risk.state),color:V.mint, sig:`BROAD ${fmtPp(aiRegime.rotation_risk.spread)}`},
  ] : [
    {name:'AI Infra', w:'78%',color:V.teal, sig:'IN LINE +4.5pp'},
    {name:'Memory',   w:'55%',color:V.amber,sig:'NOT CONF −3.6pp'},
    {name:'Foundry',  w:'32%',color:V.gold, sig:'LAGGING −14.9pp'},
    {name:'Equipment',w:'18%',color:V.red,  sig:'LAG AI DLY −16.5pp'},
    {name:'Rotation', w:'90%',color:V.mint, sig:'BROAD +0.0pp'},
  ]
  return (
    <div style={{display:'flex',flexDirection:'column',gap:6}}>
      {rows.map(r=>(
        <div key={r.name} style={{display:'grid',gridTemplateColumns:'70px 1fr 140px',alignItems:'center',gap:8}}>
          <div style={{fontSize:11,color:V.text2,fontFamily:V.ui}}>{r.name}</div>
          <div style={{height:5,background:V.bg3,borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',width:r.w,background:r.color,borderRadius:3}}/></div>
          <div style={{fontSize:10,color:r.color,textAlign:'right',fontFamily:V.mono}}>{r.sig}</div>
        </div>
      ))}
    </div>
  )
}

// ── TAB: MAP ────────────────────────────────────────────────────────────────
const STATIC_BUCKET_META = [
  {color:V.teal, key:'AI Compute',         name:'AI Compute',         drivers:'NVDA / AVGO / AMD · Internal Driver'},
  {color:V.amber,key:'Memory',             name:'Memory / HBM',       drivers:'MU · Internal Driver'},
  {color:V.red,  key:'Foundry',            name:'Foundry / Packaging',drivers:'TSM · Internal Driver'},
  {color:V.gold, key:'Equipment',          name:'Equipment',          drivers:'AMAT / ASML / LRCX / KLAC · Internal Driver'},
]
function TabMap({ rsTable, aiRegime }: { rsTable?: RsRow[]; aiRegime?: InterpAIRegime }) {
  const findRs = (key: string) => rsTable?.find(r => r.name.toLowerCase().includes(key.toLowerCase()))
  const buckets = STATIC_BUCKET_META.map(b => {
    const r = findRs(b.key)
    return { color:b.color, name:b.name, drivers:b.drivers, m1:r?.rs??'—', vs:r?.vs??'—', vsC:r ? (r.up?V.teal:V.red) : V.text2 }
  })
  const ar = aiRegime
  const aiComp  = ar?.ai_infra,  memComp = ar?.memory, fndComp = ar?.foundry, eqComp = ar?.equipment, rotComp = ar?.rotation_risk
  const flow = ar ? [
    {label:'AI Compute',badge:flowBadge(aiComp!.state).badge, bc:flowBadge(aiComp!.state).color,  pp:fmtPp(aiComp!.spread),  pc:flowBadge(aiComp!.state).color},
    {label:'Memory',    badge:flowBadge(memComp!.state).badge,bc:flowBadge(memComp!.state).color,  pp:fmtPp(memComp!.spread), pc:flowBadge(memComp!.state).color},
    {label:'Foundry',   badge:flowBadge(fndComp!.state).badge,bc:flowBadge(fndComp!.state).color,  pp:fmtPp(fndComp!.spread), pc:flowBadge(fndComp!.state).color},
    {label:'Equipment', badge:flowBadge(eqComp!.state).badge, bc:flowBadge(eqComp!.state).color,   pp:fmtPp(eqComp!.spread),  pc:flowBadge(eqComp!.state).color},
    {label:'Broad',     badge:flowBadge(rotComp!.state).badge,bc:flowBadge(rotComp!.state).color,  pp:fmtPp(rotComp!.spread), pc:flowBadge(rotComp!.state).color},
  ] : [
    {label:'AI Compute',badge:'PARTIAL',bc:V.teal, pp:'+4.5pp',pc:V.teal},
    {label:'Memory',    badge:'WEAK',   bc:V.amber,pp:'−3.6pp',pc:V.amber},
    {label:'Foundry',   badge:'WEAK',   bc:V.amber,pp:'−14.9pp',pc:V.amber},
    {label:'Equipment', badge:'LAGGING',bc:V.red,  pp:'−16.5pp',pc:V.red},
    {label:'Broad',     badge:'WEAK',   bc:V.amber,pp:'+0.0pp',pc:V.amber},
  ]
  return (
    <div style={{padding:'12px 20px',overflowY:'auto',flex:1}}>
      <EduBox title="MAP 탭 — 지금 SOXX의 전체 상태를 한눈에">
        <strong>4개 버킷(AI Compute · Memory · Foundry · Equipment)</strong>이 SOXX 지수를 구성합니다.
        각 버킷이 SOXX 대비 얼마나 강하게 움직이는지, AI 자본이 밸류체인 어디까지 흘렀는지를 이 화면에서 즉시 파악합니다.
        Capital Flow Stage의 방향(<strong>PARTIAL → WEAK → LAGGING</strong>)은 자본이 아직 AI Compute에만 머물고 있음을 의미합니다.
      </EduBox>
      <SecTitle>BUCKET MAP
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          <span style={{fontSize:11,color:V.text3,fontFamily:V.ui}}>equal-size</span>
          <span style={{fontSize:10,background:'rgba(242,169,59,0.15)',color:V.amber,padding:'2px 7px',borderRadius:3,letterSpacing:'0.06em',fontFamily:V.ui}}>SOXX BENCHMARK · +3.6% 1M · Score 71</span>
        </div>
      </SecTitle>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
        {buckets.map(b=>(
          <div key={b.name} style={{background:V.bg2,border:`1px solid ${V.border}`,borderRadius:6,padding:'10px 12px'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
              <div style={{width:8,height:8,borderRadius:'50%',background:b.color,flexShrink:0}}/>
              <div style={{fontSize:12,fontWeight:600,color:V.text,fontFamily:V.ui}}>{b.name}</div>
            </div>
            <div style={{fontSize:11,color:V.text3,marginBottom:8,fontFamily:V.ui}}>{b.drivers}</div>
            <div style={{display:'flex',gap:16,marginBottom:8}}>
              <div><div style={{fontSize:10,color:V.text3,fontFamily:V.ui}}>1M</div><div style={{fontSize:13,fontWeight:500,color:V.teal,fontFamily:V.mono}}>{b.m1}</div></div>
              <div><div style={{fontSize:10,color:V.text3,fontFamily:V.ui}}>vs SOXX</div><div style={{fontSize:13,fontWeight:500,color:b.vsC,fontFamily:V.mono}}>{b.vs}</div></div>
            </div>
            <span style={{fontSize:10,background:'rgba(184,200,220,0.12)',color:V.text2,padding:'2px 7px',borderRadius:10,fontFamily:V.ui}}>Neutral</span>
          </div>
        ))}
      </div>
      <Card>
        <SecTitle style={{marginBottom:8}}>CAPITAL FLOW STAGE <span style={{fontSize:11,color:V.text3,fontWeight:400,letterSpacing:0}}> — AI 자본이 반도체 밸류체인 어디까지 흘렀는가</span></SecTitle>
        <div style={{display:'flex',alignItems:'flex-start',gap:4,flexWrap:'wrap'}}>
          {flow.map((f,i)=>(
            <div key={f.label} style={{display:'flex',alignItems:'center',gap:4}}>
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:11,color:V.text2,fontFamily:V.ui}}>{f.label}</div>
                <div style={{fontSize:10,fontWeight:600,background:`rgba(${f.bc===V.teal?'63,182,168':f.bc===V.amber?'242,169,59':'229,90,90'},0.15)`,color:f.bc,padding:'2px 6px',borderRadius:3,letterSpacing:'0.06em',fontFamily:V.mono,margin:'3px 0'}}>{f.badge}</div>
                <div style={{fontSize:11,color:f.pc,fontFamily:V.mono}}>{f.pp}</div>
              </div>
              {i<flow.length-1&&<div style={{color:V.text3,fontSize:14,margin:'0 2px'}}>→</div>}
            </div>
          ))}
        </div>
      </Card>
      <Card style={{marginBottom:0}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <SecTitle style={{margin:0}}>AI REGIME LENS</SecTitle>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:13,fontWeight:500,color:V.teal,fontFamily:V.ui}}>{ar ? regimeDisplay(ar.regime_label) : 'Broad Recovery'}</span>
            <span style={{fontSize:11,color:V.teal,border:'1px solid rgba(63,182,168,0.3)',padding:'2px 6px',borderRadius:2,fontFamily:V.mono}}>{ar?.regime_confidence?.toUpperCase() ?? 'HIGH CONF'}</span>
            <span style={{fontSize:10,background:ar?'rgba(63,182,168,0.15)':'rgba(107,123,149,0.15)',color:ar?V.teal:V.text3,padding:'2px 7px',borderRadius:3,letterSpacing:'0.06em',fontFamily:V.mono}}>{ar?'LIVE':'STATIC'}</span>
          </div>
        </div>
        <RegimeBars aiRegime={aiRegime}/>
        <div style={{fontSize:11,color:V.text2,fontStyle:'italic',marginTop:8,padding:'6px 8px',background:V.bg3,borderRadius:4,fontFamily:V.ui}}>{'Participation is broad across all semiconductor segments with no dominant concentration, consistent with an early recovery structure.'}</div>
      </Card>
    </div>
  )
}

// ── TAB: CYCLE VIEW ──────────────────────────────────────────────────────────
// ── Metric safe-access helpers ────────────────────────────────────────────────
function getMetricDisplay(metric: FundamentalMetric | undefined | null, fallback: string): string {
  if (!metric) return fallback
  if (typeof metric.displayValue === 'string' && metric.displayValue.trim()) return metric.displayValue
  if (metric.value !== null && metric.value !== undefined) return String(metric.value)
  return fallback
}
function getMetricStatus(metric: FundamentalMetric | undefined | null, fallback: DataStatus = 'STATIC'): DataStatus {
  return metric?.status ?? fallback
}
function statusBadgeStyle(status: DataStatus): React.CSSProperties {
  const c: Record<DataStatus, string> = {
    LIVE: '#22c55e', CACHE: '#22d3ee', STATIC: '#fbbf24',
    MANUAL: '#fbbf24', PENDING: '#737880', UNAVAILABLE: '#ef4444',
  }
  const col = c[status] ?? '#fbbf24'
  return { fontSize:10, padding:'1px 5px', border:`1px solid ${col}33`, color:col, borderRadius:2, fontFamily:'monospace', letterSpacing:'0.05em' }
}

function TabCycle({ score, stage, confidenceLabel, fundamentals }: { score?: number; stage?: string; confidenceLabel?: string; fundamentals?: SemiconductorFundamentalsPayload | null }) {
  const f1 = fundamentals?.l1Fundamentals
  const f2 = fundamentals?.l2CapitalFlow
  const f3 = fundamentals?.l3MarketConfirmation
  // pre-computed display values with fallback
  const tsmcYoyDisp  = getMetricDisplay(f1?.tsmcRevenueYoY, '+39%')
  const b2bDisp      = getMetricDisplay(f1?.bookToBill, '1.18')
  const siaDisp      = getMetricDisplay(f1?.siaSemiSales, '$56.1B')
  const nvdaDisp     = getMetricDisplay(f1?.nvdaDataCenterRevenue, '$35.6B')
  const capexDisp    = getMetricDisplay(f2?.hyperscalerCapex, '$78.4B')
  const msftDisp     = getMetricDisplay(f2?.microsoftCapex, '$21.4B')
  const amznDisp     = getMetricDisplay(f2?.amazonCapex, '$24.3B')
  const googDisp     = getMetricDisplay(f2?.googleCapex, '$17.2B')
  const metaDisp     = getMetricDisplay(f2?.metaCapex, '$15.5B')
  const soxxRefDisp  = getMetricDisplay(f3?.soxxReflection, '0.92')
  // pre-computed statuses for badges
  const tsmcSt   = getMetricStatus(f1?.tsmcRevenueYoY, 'MANUAL')
  const b2bSt    = getMetricStatus(f1?.bookToBill, 'MANUAL')
  const siaSt    = getMetricStatus(f1?.siaSemiSales, 'MANUAL')
  const nvdaSt   = getMetricStatus(f1?.nvdaDataCenterRevenue, 'STATIC')
  const capexSt  = getMetricStatus(f2?.hyperscalerCapex, 'STATIC')
  const soxxRefSt = getMetricStatus(f3?.soxxReflection, 'STATIC')
  return (
    <div style={{padding:'12px 20px',overflowY:'auto',flex:1}}>
      <EduBox title="CYCLE VIEW — 실물이 기준, SOXX는 반영도">
        기관 애널리스트는 주가를 먼저 보지 않습니다. <strong>TSMC 매출 → Book-to-Bill → Hyperscaler CapEx → SOXX</strong> 순으로 읽습니다.
        실물이 강한데 SOXX가 덜 올랐으면 <strong>매수 근거</strong>, 실물이 꺾이는데 SOXX가 아직 고점이면 <strong>SOXL 위험 신호</strong>입니다.
        Reflection Score는 실물 대비 시장이 얼마나 선행 또는 후행하는지를 0~2 사이로 표현합니다 (1.0 = 완전 동행).
      </EduBox>
      {/* Score header */}
      <div style={{display:'grid',gridTemplateColumns:'auto 1fr',gap:12,alignItems:'stretch',marginBottom:12}}>
        <div style={{background:V.bg2,border:`1px solid ${V.border}`,borderRadius:6,padding:'14px 20px',display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',minWidth:130}}>
          <div style={{fontSize:11,letterSpacing:'0.16em',color:V.text3,fontWeight:500,marginBottom:6,fontFamily:V.ui}}>CYCLE SCORE</div>
          <div style={{fontSize:38,fontWeight:500,color:V.teal,fontFamily:V.mono,lineHeight:1}}>{score ?? 68}</div>
          <div style={{fontSize:11,color:stageColor(stage??'EXPANSION'),fontWeight:500,marginTop:4,fontFamily:V.ui}}>{stage ? stage.replace('MID ','').replace('EARLY ','') : 'EXPANSION'}</div>
          <div style={{fontSize:11,color:V.text3,marginTop:2,fontFamily:V.ui}}>{confidenceLabel ?? 'High Conf'} · Fundamental</div>
        </div>
        <div style={{background:V.bg2,border:`1px solid ${V.border}`,borderRadius:6,padding:'12px 16px'}}>
          <div style={{fontSize:11,letterSpacing:'0.16em',color:V.text3,fontWeight:500,marginBottom:10,fontFamily:V.ui}}>3-LAYER CONTRIBUTION</div>
          <div style={{display:'flex',flexDirection:'column',gap:7}}>
            {[
              {label:'L1 · Fundamental',   color:V.teal, w:'72%',val:'37.4/55',grad:`linear-gradient(90deg,${V.teal},${V.mint})`},
              {label:'L2 · AI Capital Flow',color:V.amber,w:'65%',val:'19.5/30',grad:`linear-gradient(90deg,${V.amber},${V.gold})`},
              {label:'L3 · Market (SOXX)', color:V.text3,w:'74%',val:'11.1/15',grad:'linear-gradient(90deg,#6B7B95,#9DA8BD)'},
            ].map(r=>(
              <div key={r.label} style={{display:'grid',gridTemplateColumns:'140px 1fr 60px',alignItems:'center',gap:8}}>
                <div style={{fontSize:10,color:r.color,fontFamily:V.ui}}>{r.label}</div>
                <div style={{height:6,background:V.bg3,borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',width:r.w,background:r.grad,borderRadius:3}}/></div>
                <div style={{fontSize:10,color:r.color,textAlign:'right',fontFamily:V.mono}}>{r.val}</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:10,fontSize:10,color:V.text2,fontStyle:'italic',fontFamily:V.ui}}>실물 사이클이 시장을 이끄는 구간 · SOXX는 실물보다 약간 선행 중</div>
        </div>
      </div>
      {/* L1 */}
      <div style={{border:'1px solid rgba(63,182,168,0.25)',borderRadius:6,padding:12,marginBottom:10,background:'rgba(63,182,168,0.03)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:11,letterSpacing:'0.16em',color:V.teal,fontWeight:500,fontFamily:V.ui}}>LAYER 1 · FUNDAMENTAL REALITY</span>
            <span style={{fontSize:11,color:V.text3,fontFamily:V.ui}}>선행 2~6개월 · 반도체 실물 온도계</span>
          </div>
          <span style={{fontSize:11,padding:'2px 8px',border:'1px solid rgba(63,182,168,0.3)',color:V.teal,borderRadius:2,fontFamily:V.mono}}>EXPANSION</span>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          {/* TSMC */}
          <div style={{background:V.bg2,border:`1px solid ${V.border}`,borderRadius:5,padding:10}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:8}}>
              <div style={{fontSize:11,letterSpacing:'0.12em',color:V.text3,fontWeight:500,fontFamily:V.ui}}>TSMC MONTHLY REVENUE</div>
              <div style={{display:'flex',alignItems:'center',gap:5}}>
                <span style={statusBadgeStyle(tsmcSt)}>{tsmcSt}</span>
                <span style={{fontSize:11,color:V.text3,fontFamily:V.ui}}>매월 10일</span>
              </div>
            </div>
            <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:8}}>
              <span style={{fontSize:28,fontWeight:500,color:V.teal,fontFamily:V.mono}}>NT$260B</span>
              <span style={{fontSize:14,color:V.teal,fontFamily:V.mono}}>YoY {tsmcYoyDisp}</span>
            </div>
            <svg viewBox="0 0 280 70" style={{width:'100%',height:'55px',display:'block'}}>
              <defs><linearGradient id="tsmc-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3FB6A8" stopOpacity="0.35"/><stop offset="100%" stopColor="#3FB6A8" stopOpacity="0.02"/></linearGradient></defs>
              <line x1="20" y1="10" x2="275" y2="10" stroke="#1A2740" strokeWidth="0.5"/><line x1="20" y1="35" x2="275" y2="35" stroke="#1A2740" strokeWidth="0.5"/><line x1="20" y1="60" x2="275" y2="60" stroke="#1A2740" strokeWidth="0.5"/>
              <text x="16" y="13" fill="#B8C8DC" fontSize="10" textAnchor="end" fontFamily="monospace">+50%</text><text x="16" y="38" fill="#B8C8DC" fontSize="10" textAnchor="end" fontFamily="monospace">+25%</text><text x="16" y="63" fill="#B8C8DC" fontSize="10" textAnchor="end" fontFamily="monospace">0%</text>
              <path d="M20,55 C45,52 65,48 85,42 C105,36 125,28 150,22 C170,17 200,13 225,11 C245,10 262,10 275,9 L275,60 L20,60Z" fill="url(#tsmc-g)"/>
              <path d="M20,55 C45,52 65,48 85,42 C105,36 125,28 150,22 C170,17 200,13 225,11 C245,10 262,10 275,9" stroke="#3FB6A8" strokeWidth="1.8" fill="none"/>
              <circle cx="275" cy="9" r="3" fill="#3FB6A8"/>
              <text x="20" y="68" fill="#B8C8DC" fontSize="10" fontFamily="monospace">2025.05</text><text x="275" y="68" fill="#3FB6A8" fontSize="10" textAnchor="end" fontFamily="monospace">2026.04</text>
            </svg>
            <div style={{fontSize:12,color:V.text3,marginTop:4,fontFamily:V.ui}}>파운드리 전체 온도계 · SOXX 2~3주 선행</div>
            {f1?.tsmcRevenueYoY.asOf && <div style={{fontSize:10,color:V.text3,opacity:0.6,marginTop:2,fontFamily:V.mono}}>{f1.tsmcRevenueYoY.source} · As of {f1.tsmcRevenueYoY.asOf}</div>}
          </div>
          {/* B2B */}
          <div style={{background:V.bg2,border:`1px solid ${V.border}`,borderRadius:5,padding:10}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:8}}>
              <div style={{fontSize:11,letterSpacing:'0.12em',color:V.text3,fontWeight:500,fontFamily:V.ui}}>BOOK-TO-BILL RATIO</div>
              <div style={{display:'flex',alignItems:'center',gap:5}}>
                <span style={statusBadgeStyle(b2bSt)}>{b2bSt}</span>
                <span style={{fontSize:11,color:V.text3,fontFamily:V.ui}}>SEMI.org · 월 1회</span>
              </div>
            </div>
            <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:8}}>
              <span style={{fontSize:28,fontWeight:500,color:V.amber,fontFamily:V.mono}}>{b2bDisp}</span>
              <span style={{fontSize:14,color:V.teal,fontFamily:V.ui}}>수주 증가 중</span>
            </div>
            <svg viewBox="0 0 280 70" style={{width:'100%',height:'55px',display:'block'}}>
              <defs><linearGradient id="btb-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F2A93B" stopOpacity="0.3"/><stop offset="100%" stopColor="#F2A93B" stopOpacity="0.02"/></linearGradient></defs>
              <line x1="20" y1="42" x2="275" y2="42" stroke="#3FB6A8" strokeWidth="0.8" strokeDasharray="3,3" opacity="0.7"/>
              <text x="16" y="45" fill="#3FB6A8" fontSize="10" textAnchor="end" fontFamily="monospace">1.0</text>
              <line x1="20" y1="10" x2="275" y2="10" stroke="#1A2740" strokeWidth="0.5"/><line x1="20" y1="60" x2="275" y2="60" stroke="#1A2740" strokeWidth="0.5"/>
              <text x="16" y="13" fill="#B8C8DC" fontSize="10" textAnchor="end" fontFamily="monospace">1.3</text><text x="16" y="63" fill="#B8C8DC" fontSize="10" textAnchor="end" fontFamily="monospace">0.8</text>
              <path d="M20,50 C45,47 65,44 85,40 C105,36 125,32 150,28 C170,24 200,20 225,17 C245,15 262,14 275,13 L275,42 C262,42 245,42 225,42 C200,42 170,42 150,42 C125,42 105,42 85,42 C65,42 45,42 20,42Z" fill="url(#btb-g)"/>
              <path d="M20,50 C45,47 65,44 85,40 C105,36 125,32 150,28 C170,24 200,20 225,17 C245,15 262,14 275,13" stroke="#F2A93B" strokeWidth="1.8" fill="none"/>
              <circle cx="275" cy="13" r="3" fill="#F2A93B"/>
              <text x="20" y="68" fill="#B8C8DC" fontSize="10" fontFamily="monospace">2025.05</text><text x="275" y="68" fill="#F2A93B" fontSize="10" textAnchor="end" fontFamily="monospace">1.18</text>
            </svg>
            <div style={{fontSize:12,color:V.text3,marginTop:4,fontFamily:V.ui}}>장비 수주/출하 · 제조 투자 3~6개월 선행</div>
            {f1?.bookToBill.asOf && <div style={{fontSize:10,color:V.text3,opacity:0.6,marginTop:2,fontFamily:V.mono}}>{f1.bookToBill.source} · As of {f1.bookToBill.asOf}</div>}
          </div>
          {/* SIA */}
          <div style={{background:V.bg2,border:`1px solid ${V.border}`,borderRadius:5,padding:10}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:8}}>
              <div style={{fontSize:11,letterSpacing:'0.12em',color:V.text3,fontWeight:500,fontFamily:V.ui}}>SIA GLOBAL SEMI SALES</div>
              <div style={{display:'flex',alignItems:'center',gap:5}}>
                <span style={statusBadgeStyle(siaSt)}>{siaSt}</span>
                <span style={{fontSize:11,color:V.text3,fontFamily:V.ui}}>SIA · 월 1회</span>
              </div>
            </div>
            <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:8}}>
              <span style={{fontSize:28,fontWeight:500,color:V.mint,fontFamily:V.mono}}>{siaDisp}</span>
              <span style={{fontSize:14,color:V.teal,fontFamily:V.mono}}>YoY +28%</span>
            </div>
            <svg viewBox="0 0 280 70" style={{width:'100%',height:'55px',display:'block'}}>
              <defs><linearGradient id="sia-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5DCFB0" stopOpacity="0.3"/><stop offset="100%" stopColor="#5DCFB0" stopOpacity="0.02"/></linearGradient></defs>
              <line x1="20" y1="10" x2="275" y2="10" stroke="#1A2740" strokeWidth="0.5"/><line x1="20" y1="35" x2="275" y2="35" stroke="#1A2740" strokeWidth="0.5"/><line x1="20" y1="60" x2="275" y2="60" stroke="#1A2740" strokeWidth="0.5"/>
              <text x="16" y="13" fill="#B8C8DC" fontSize="10" textAnchor="end" fontFamily="monospace">$60B</text><text x="16" y="63" fill="#B8C8DC" fontSize="10" textAnchor="end" fontFamily="monospace">$35B</text>
              <path d="M20,52 C45,50 65,46 85,42 C105,38 125,30 150,24 C170,19 200,14 225,12 C245,11 262,11 275,10 L275,60 L20,60Z" fill="url(#sia-g)"/>
              <path d="M20,52 C45,50 65,46 85,42 C105,38 125,30 150,24 C170,19 200,14 225,12 C245,11 262,11 275,10" stroke="#5DCFB0" strokeWidth="1.8" fill="none"/>
              <circle cx="275" cy="10" r="3" fill="#5DCFB0"/>
              <text x="20" y="68" fill="#B8C8DC" fontSize="10" fontFamily="monospace">2025.05</text><text x="275" y="68" fill="#5DCFB0" fontSize="10" textAnchor="end" fontFamily="monospace">$56.1B</text>
            </svg>
            <div style={{fontSize:12,color:V.text3,marginTop:4,fontFamily:V.ui}}>전체 반도체 시장 크기 공식 데이터</div>
            {f1?.siaSemiSales.asOf && <div style={{fontSize:10,color:V.text3,opacity:0.6,marginTop:2,fontFamily:V.mono}}>{f1.siaSemiSales.source} · As of {f1.siaSemiSales.asOf}</div>}
          </div>
          {/* NVDA */}
          <div style={{background:V.bg2,border:`1px solid ${V.border}`,borderRadius:5,padding:10}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:8}}>
              <div style={{fontSize:11,letterSpacing:'0.12em',color:V.text3,fontWeight:500,fontFamily:V.ui}}>NVDA DATA CENTER REVENUE</div>
              <div style={{display:'flex',alignItems:'center',gap:5}}>
                <span style={statusBadgeStyle(nvdaSt)}>{nvdaSt}</span>
                <span style={{fontSize:11,color:V.text3,fontFamily:V.ui}}>분기 실적</span>
              </div>
            </div>
            <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:8}}>
              <span style={{fontSize:28,fontWeight:500,color:V.gold,fontFamily:V.mono}}>{nvdaDisp}</span>
              <span style={{fontSize:14,color:V.teal,fontFamily:V.mono}}>QoQ +12%</span>
            </div>
            <svg viewBox="0 0 280 70" style={{width:'100%',height:'55px',display:'block'}}>
              <line x1="20" y1="10" x2="275" y2="10" stroke="#1A2740" strokeWidth="0.5"/><line x1="20" y1="60" x2="275" y2="60" stroke="#1A2740" strokeWidth="0.5"/>
              <rect x="24" y="58" width="22" height="2" fill="#D4B36A" opacity="0.4" rx="1"/>
              <rect x="56" y="54" width="22" height="6" fill="#D4B36A" opacity="0.5" rx="1"/>
              <rect x="88" y="48" width="22" height="12" fill="#D4B36A" opacity="0.6" rx="1"/>
              <rect x="120" y="40" width="22" height="20" fill="#D4B36A" opacity="0.7" rx="1"/>
              <rect x="152" y="32" width="22" height="28" fill="#D4B36A" opacity="0.8" rx="1"/>
              <rect x="184" y="22" width="22" height="38" fill="#D4B36A" opacity="0.9" rx="1"/>
              <rect x="216" y="14" width="22" height="46" fill="#D4B36A" rx="1"/>
              <rect x="248" y="10" width="22" height="50" fill="#D4B36A" rx="1" opacity="0.85"/>
              <rect x="248" y="10" width="22" height="50" fill="none" stroke="#D4B36A" strokeWidth="1" rx="1" strokeDasharray="2,2"/>
              <text x="248" y="8" fill="#D4B36A" fontSize="10" textAnchor="middle" fontFamily="monospace">Guide</text>
              <text x="20" y="68" fill="#B8C8DC" fontSize="10" fontFamily="monospace">Q1&apos;24</text>
              <text x="275" y="68" fill="#D4B36A" fontSize="10" textAnchor="end" fontFamily="monospace">Q1&apos;26</text>
            </svg>
            <div style={{fontSize:12,color:V.text3,marginTop:4,fontFamily:V.ui}}>AI 가속기 수요 직접 신호 · 가이던스 방향 핵심</div>
            {f1?.nvdaDataCenterRevenue.asOf && <div style={{fontSize:10,color:V.text3,opacity:0.6,marginTop:2,fontFamily:V.mono}}>{f1.nvdaDataCenterRevenue.source} · As of {f1.nvdaDataCenterRevenue.asOf}</div>}
          </div>
        </div>
      </div>
      {/* L2 */}
      <div style={{border:'1px solid rgba(242,169,59,0.25)',borderRadius:6,padding:12,marginBottom:10,background:'rgba(242,169,59,0.02)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:11,letterSpacing:'0.16em',color:V.amber,fontWeight:500,fontFamily:V.ui}}>LAYER 2 · AI CAPITAL FLOW</span>
            <span style={{fontSize:11,color:V.text3,fontFamily:V.ui}}>선행 1~3개월 · AI 자본이 실물로 흐르는 신호</span>
          </div>
          <span style={{fontSize:11,padding:'2px 8px',border:'1px solid rgba(242,169,59,0.3)',color:V.amber,borderRadius:2,fontFamily:V.mono}}>ACCELERATING</span>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div style={{background:V.bg2,border:`1px solid ${V.border}`,borderRadius:5,padding:10}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
              <div style={{fontSize:11,letterSpacing:'0.12em',color:V.text3,fontWeight:500,fontFamily:V.ui}}>HYPERSCALER CAPEX (합산)</div>
              <span style={statusBadgeStyle(capexSt)}>{capexSt}</span>
            </div>
            <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:8}}>
              <span style={{fontSize:28,fontWeight:500,color:V.amber,fontFamily:V.mono}}>{capexDisp}</span>
              <span style={{fontSize:14,color:V.teal,fontFamily:V.mono}}>Q1&apos;26 · YoY +68%</span>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              {[{co:'MSFT',w:'82%',c:V.teal,v:msftDisp},{co:'AMZN',w:'90%',c:V.amber,v:amznDisp},{co:'GOOG',w:'68%',c:V.gold,v:googDisp},{co:'META',w:'59%',c:V.mint,v:metaDisp}].map(x=>(
                <div key={x.co} style={{display:'grid',gridTemplateColumns:'40px 1fr 44px',alignItems:'center',gap:6}}>
                  <div style={{fontSize:11,color:V.text3,fontFamily:V.ui}}>{x.co}</div>
                  <div style={{height:5,background:V.bg3,borderRadius:2,overflow:'hidden'}}><div style={{height:'100%',width:x.w,background:x.c,borderRadius:2}}/></div>
                  <div style={{fontSize:11,color:V.text2,textAlign:'right',fontFamily:V.mono}}>{x.v}</div>
                </div>
              ))}
            </div>
            <div style={{fontSize:11,color:V.text3,marginTop:6,fontFamily:V.ui}}>AI 서버/GPU 수요의 직접 연료</div>
            {f2?.hyperscalerCapex.asOf && <div style={{fontSize:10,color:V.text3,opacity:0.6,marginTop:2,fontFamily:V.mono}}>{f2.hyperscalerCapex.source ?? 'MSFT·AMZN·GOOG·META'} · As of {f2.hyperscalerCapex.asOf}</div>}
          </div>
          <div style={{background:V.bg2,border:`1px solid ${V.border}`,borderRadius:5,padding:10}}>
            <div style={{fontSize:11,letterSpacing:'0.12em',color:V.text3,fontWeight:500,marginBottom:10,fontFamily:V.ui}}>AI 인프라 공급 신호</div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {[
                {label:'HBM 수급',val:'Tight',vc:V.red,sub:'SK하이닉스 기준'},
                {label:'ASML 신규수주',val:'€7.1B',vc:V.teal,sub:'QoQ +22% · EUV 확장'},
                {label:'DC 전력 수요',val:'~50GW 2026',vc:V.amber,sub:'IEA 전망 · YoY +30%'},
              ].map(s=>(
                <div key={s.label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 8px',background:V.bg3,borderRadius:4}}>
                  <div><div style={{fontSize:11,color:V.text3,fontFamily:V.ui}}>{s.label}</div><div style={{fontSize:10,color:s.vc,fontWeight:500,fontFamily:V.mono}}>{s.val}</div></div>
                  <div style={{fontSize:11,color:V.text3,fontFamily:V.ui}}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* L3 */}
      <div style={{border:'1px solid rgba(107,123,149,0.3)',borderRadius:6,padding:12,background:'rgba(107,123,149,0.02)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:11,letterSpacing:'0.16em',color:V.text3,fontWeight:500,fontFamily:V.ui}}>LAYER 3 · MARKET PRICING — SOXX/SOXL 반영도</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:13,fontWeight:500,color:V.gold,fontFamily:V.mono}}>{soxxRefDisp}</span>
            <span style={{fontSize:11,color:V.text3,padding:'2px 6px',border:'1px solid rgba(107,123,149,0.3)',borderRadius:2,fontFamily:V.ui}}>실물 대비 약간 선행</span>
            <span style={statusBadgeStyle(soxxRefSt)}>{soxxRefSt}</span>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div style={{background:V.bg2,border:`1px solid ${V.border}`,borderRadius:5,padding:10}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:8}}>
              <div style={{fontSize:11,letterSpacing:'0.12em',color:V.text3,fontWeight:500,fontFamily:V.ui}}>SOXX + MA · 절대가격</div>
              <div style={{display:'flex',gap:8,fontSize:11}}>
                <span style={{color:V.amber,fontFamily:V.mono}}>━ 20W</span><span style={{color:V.text3,fontFamily:V.mono}}>━ 40W</span>
              </div>
            </div>
            <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:8}}>
              <span style={{fontSize:28,fontWeight:500,color:V.text,fontFamily:V.mono}}>$568</span>
              <span style={{fontSize:14,color:V.teal,fontFamily:V.ui}}>20W 위 · Bullish</span>
            </div>
            <svg viewBox="0 0 280 80" style={{width:'100%',height:'auto',display:'block'}}>
              <defs><linearGradient id="soxx-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4A9EE0" stopOpacity="0.25"/><stop offset="100%" stopColor="#4A9EE0" stopOpacity="0.02"/></linearGradient></defs>
              <line x1="20" y1="10" x2="275" y2="10" stroke="#1A2740" strokeWidth="0.5"/><line x1="20" y1="40" x2="275" y2="40" stroke="#1A2740" strokeWidth="0.5"/><line x1="20" y1="70" x2="275" y2="70" stroke="#1A2740" strokeWidth="0.5"/>
              <text x="16" y="13" fill="#B8C8DC" fontSize="10" textAnchor="end" fontFamily="monospace">$620</text><text x="16" y="43" fill="#B8C8DC" fontSize="10" textAnchor="end" fontFamily="monospace">$480</text><text x="16" y="73" fill="#B8C8DC" fontSize="10" textAnchor="end" fontFamily="monospace">$340</text>
              <path d="M20,60 C60,56 100,50 140,44 C180,38 220,34 275,30" stroke="#A0B0C8" strokeWidth="1" fill="none" strokeDasharray="3,2"/>
              <path d="M20,58 C60,52 100,44 140,36 C180,28 220,22 275,18" stroke="#F2A93B" strokeWidth="1.2" fill="none" strokeDasharray="4,2"/>
              <path d="M20,62 C40,55 60,48 80,52 C100,56 120,42 140,32 C160,22 180,16 210,13 C230,11 255,12 275,11 L275,70 L20,70Z" fill="url(#soxx-g)"/>
              <path d="M20,62 C40,55 60,48 80,52 C100,56 120,42 140,32 C160,22 180,16 210,13 C230,11 255,12 275,11" stroke="#4A9EE0" strokeWidth="1.8" fill="none"/>
              <circle cx="275" cy="11" r="3" fill="#4A9EE0"/>
              <text x="20" y="78" fill="#B8C8DC" fontSize="10" fontFamily="monospace">2025.05</text><text x="275" y="78" fill="#4A9EE0" fontSize="10" textAnchor="end" fontFamily="monospace">$568</text>
            </svg>
          </div>
          <div style={{background:V.bg2,border:`1px solid ${V.border}`,borderRadius:5,padding:10}}>
            <div style={{fontSize:11,letterSpacing:'0.12em',color:V.text3,fontWeight:500,marginBottom:8,fontFamily:V.ui}}>반영도 지표</div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              <div style={{padding:8,background:V.bg3,borderRadius:4}}>
                <div style={{fontSize:11,color:V.text3,marginBottom:4,fontFamily:V.ui}}>Reflection Score — 실물 대비 시장 선행도</div>
                <div style={{height:6,background:V.bg,borderRadius:3,position:'relative',overflow:'visible'}}>
                  <div style={{height:'100%',width:'100%',background:'linear-gradient(90deg,#3FB6A8,#F2A93B,#E55A5A)',borderRadius:3,opacity:0.3}}/>
                  <div style={{position:'absolute',top:-3,left:'71%',width:12,height:12,background:V.gold,borderRadius:'50%',transform:'translateX(-50%)',border:`2px solid ${V.bg2}`}}/>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:V.text3,marginTop:4,fontFamily:V.ui}}>
                  <span>저평가<br/>0.5↓</span><span style={{textAlign:'center',color:V.gold}}>현재 {soxxRefDisp}<br/>약간 선행</span><span style={{textAlign:'right'}}>과열<br/>1.5↑</span>
                </div>
              </div>
              <div style={{padding:8,background:V.bg3,borderRadius:4}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div><div style={{fontSize:11,color:V.text3,fontFamily:V.ui}}>SOXX/SMH Spread</div><div style={{fontSize:11,color:V.text2,fontWeight:500,fontFamily:V.ui}}>SMH &gt; SOXX</div></div>
                  <div style={{textAlign:'right'}}><div style={{fontSize:13,color:V.amber,fontWeight:500,fontFamily:V.mono}}>+2.1%</div><div style={{fontSize:11,color:V.text3,fontFamily:V.ui}}>NVDA 집중 신호</div></div>
                </div>
              </div>
              <div style={{padding:8,background:'rgba(242,169,59,0.06)',border:'1px solid rgba(242,169,59,0.2)',borderRadius:4}}>
                <div style={{fontSize:11,color:V.amber,fontWeight:500,marginBottom:4,fontFamily:V.ui}}>★ AI vs Legacy Layer</div>
                <div style={{display:'flex',justifyContent:'space-between'}}>
                  <span style={{fontSize:10,color:V.amber,fontFamily:V.mono}}>AI Compute +18.4%</span>
                  <span style={{fontSize:10,color:V.red,fontFamily:V.mono}}>Legacy −3.8%</span>
                </div>
                <div style={{fontSize:11,color:V.text3,marginTop:2,fontFamily:V.ui}}>Spread 22pp · AI 단독 랠리</div>
              </div>
            </div>
          </div>
        </div>
        <div style={{marginTop:8,fontSize:10,color:V.text2,padding:'8px 10px',background:V.bg2,borderRadius:4,borderLeft:`2px solid ${V.text3}`,fontFamily:V.ui}}>
          <span style={{color:V.gold,fontWeight:500}}>반영도 해석:</span> Reflection Score 0.92 — 실물 사이클이 강한데 시장(SOXX)이 아직 실물만큼 충분히 반영하지 않았거나, 약간 먼저 달리고 있음. 실물 Layer 1~2가 지속 강세면 SOXX 추가 상승 근거 유효.
        </div>
      </div>
    </div>
  )
}

// ── RELATIVE ROTATION MAP CARD ───────────────────────────────────────────────
type RRGBench    = 'SOXX' | 'QQQ' | 'SPY'
type RRGLookback = 4 | 8 | 12 | 24
interface RRGBucket {
  name: string; short: string; color: string
  path: number[][]   // 24 weekly pts, index 0=oldest, 23=current
  note: string       // shown after [quad] label in interpretation strip
  isBm?: boolean
}
// 24-week fixture paths — EXPANSION cycle, AI Compute leading
const SEMI_RRG_BUCKETS: RRGBucket[] = [
  {
    name:'AI Compute', short:'AI', color:'#3FB6A8',
    note:'RS & momentum sustained · cycle driver',
    path:[
      [98.1,98.2],[98.3,98.3],[98.6,98.5],[99.0,98.7],[99.4,99.0],[99.8,99.3],
      [100.2,99.7],[100.6,100.1],[101.0,100.4],[101.4,100.7],[101.8,101.0],[102.2,101.3],
      [102.6,101.6],[103.0,101.9],[103.4,102.1],[103.8,102.3],[104.2,102.5],[104.6,102.7],
      [105.0,102.9],[105.3,103.0],[105.6,103.1],[105.8,103.2],[106.0,103.3],[106.2,103.4],
    ],
  },
  {
    name:'Memory / HBM', short:'MEM', color:'#F2A93B',
    note:'AI Compute 3W 후행 · 모멘텀 고점 접근',
    path:[
      [97.2,97.1],[97.5,97.3],[97.8,97.5],[98.2,97.8],[98.6,98.1],[99.0,98.5],
      [99.4,98.9],[99.8,99.3],[100.1,99.7],[100.4,100.0],[100.7,100.3],[101.0,100.6],
      [101.3,100.9],[101.6,101.1],[101.9,101.3],[102.2,101.5],[102.5,101.7],[102.8,101.9],
      [103.1,102.0],[103.3,102.1],[103.6,102.2],[103.8,102.3],[104.0,102.3],[104.1,102.3],
    ],
  },
  {
    name:'Equipment', short:'EQP', color:'#D4B36A',
    note:'Leading 진입 직전 · Lagging에서 회복 중',
    path:[
      [97.8,98.0],[97.9,98.1],[98.0,98.2],[98.1,98.3],[98.3,98.4],[98.5,98.6],
      [98.7,98.8],[99.0,99.0],[99.2,99.2],[99.4,99.4],[99.6,99.6],[99.8,99.8],
      [100.0,100.0],[100.1,100.1],[100.2,100.2],[100.4,100.3],[100.5,100.4],[100.7,100.5],
      [100.8,100.6],[100.9,100.7],[101.0,100.7],[101.1,100.8],[101.2,100.8],[101.2,100.8],
    ],
  },
  {
    name:'Foundry / Pkg', short:'FND', color:'#E55A5A',
    note:'RS 기준선 미달 · 가장 느린 회복',
    path:[
      [97.0,97.5],[97.1,97.6],[97.2,97.7],[97.3,97.8],[97.5,97.9],[97.7,98.0],
      [97.9,98.2],[98.1,98.4],[98.2,98.6],[98.4,98.8],[98.5,99.0],[98.6,99.2],
      [98.7,99.4],[98.8,99.5],[98.9,99.6],[99.0,99.7],[99.1,99.8],[99.1,99.9],
      [99.2,100.0],[99.2,100.1],[99.3,100.2],[99.3,100.3],[99.4,100.4],[99.4,100.5],
    ],
  },
  {
    name:'SOXX', short:'SOX', color:'#4A9EE0', isBm: true,
    note:'기준지수 참조점 (100, 100)',
    path: Array.from({length:24}, ()=>[100.0,100.0]),
  },
]
const BENCH_CONTEXT: Record<RRGBench, string> = {
  SOXX: '내부 반도체 섹터 순환',
  QQQ:  '반도체 vs 기술시장 상대강도',
  SPY:  '반도체 vs 전체시장 상대강도',
}
function SemiconductorRRGCard() {
  const [bench,    setBench]    = useState<RRGBench>('SOXX')
  const [lookback, setLookback] = useState<RRGLookback>(8)
  const [rrgPayload,   setRrgPayload]   = useState<RrgPathPayload>(PENDING_RRG_PAYLOAD)
  const [rrgLoading,   setRrgLoading]   = useState(false)
  const [rrgError,     setRrgError]     = useState<string | null>(null)
  useEffect(() => {
    setRrgLoading(true)
    fetch('/api/semiconductor-rrg-paths')
      .then(r => r.json())
      .then((d: RrgPathPayload) => { setRrgPayload(d); setRrgLoading(false) })
      .catch((e: unknown) => { setRrgError(String(e)); setRrgLoading(false) })
  }, [])
  const pathStatus = rrgPayload.dataStatus

  const W=520, H=272, L=44, R=20, T=24, B=38
  const CW=W-L-R, CH=H-T-B
  const xMin=95, xMax=108, yMin=96, yMax=106

  const toSvg = (rs:number, mom:number) => ({
    x: L+(rs-xMin)/(xMax-xMin)*CW,
    y: T+(1-(mom-yMin)/(yMax-yMin))*CH,
  })
  const {x:cx, y:cy} = toSvg(100, 100)
  const quadLabel = (rs:number, mom:number) =>
    rs>=100&&mom>=100 ? 'Leading' : rs>=100&&mom<100 ? 'Weakening'
    : rs<100&&mom>=100 ? 'Improving' : 'Lagging'

  const quadColor = (q:string) =>
    q==='Leading' ? V.teal : q==='Improving' ? V.blue : q==='Weakening' ? V.amber : V.red

  type Direction = 'Accelerating' | 'Sustaining' | 'Flattening' | 'Rolling Over' | 'Recovering' | 'Pending'
  const dirColor = (d:Direction): string => {
    if (d==='Accelerating'||d==='Sustaining') return V.teal
    if (d==='Recovering') return V.blue
    if (d==='Flattening') return V.amber
    if (d==='Rolling Over') return V.red
    return V.text3
  }
  const inferDirection = (b: RRGBucket): Direction => {
    const path = b.path
    if (path.length < 2) return 'Pending'
    const cur  = path[path.length-1]
    const prev4 = path[path.length-1-4] ?? path[0]
    const prev1 = path[path.length-2]
    const old12 = path[path.length-1-12] ?? path[0]
    const drs4  = cur[0]-prev4[0], dmom4 = cur[1]-prev4[1]
    const dmom1 = cur[1]-prev1[1]
    const oldQ  = quadLabel(old12[0], old12[1])
    const curQ  = quadLabel(cur[0], cur[1])
    if ((oldQ==='Lagging'||oldQ==='Weakening') && (curQ==='Improving'||curQ==='Leading')) return 'Recovering'
    if (curQ==='Leading' && dmom1 < -0.1) return 'Rolling Over'
    if (drs4>0.8 && dmom4>0.25 && dmom1>=0) return 'Accelerating'
    if (curQ==='Leading' && Math.abs(dmom1)<0.08) return 'Flattening'
    if (drs4>0||dmom4>0) return 'Sustaining'
    return 'Flattening'
  }

  // ── Live payload → RenderBuckets ────────────────────────────────────────
  interface RenderBucket {
    id: string; name: string; short: string; color: string
    isBm?: boolean; note: string; path: number[][]
    quadrant: string; direction: string
  }
  const SERIES_META: Record<string, {color: string; short: string}> = {
    ai_compute:  { color: '#3FB6A8', short: 'AI'  },
    memory_hbm:  { color: '#F2A93B', short: 'MEM' },
    foundry_pkg: { color: '#E55A5A', short: 'FND' },
    equipment:   { color: '#D4B36A', short: 'EQP' },
    soxx_vs_qqq: { color: '#4A9EE0', short: 'SOX' },
    soxx_vs_spy: { color: '#4A9EE0', short: 'SOX' },
    qqq_vs_spy:  { color: '#4A9EE0', short: 'Q/S' },
  }
  // QQQ/SPY bucket paths not yet available — soxx_vs_qqq/spy are benchmark context only, not bucket paths
  const seriesForBench = rrgPayload.series.filter(s => {
    if (bench === 'SOXX') return ['ai_compute','memory_hbm','foundry_pkg','equipment'].includes(s.id)
    return false
  })
  const hasLive = seriesForBench.some(s => s.source !== 'PENDING' && s.points.length > 0)

  const renderBuckets: RenderBucket[] = hasLive
    ? [
        ...seriesForBench.map(s => {
          const meta = SERIES_META[s.id] ?? { color: V.text3, short: s.id.slice(0,3).toUpperCase() }
          const path = s.points
            .filter(p => p.rsRatio !== null && p.rsMomentum !== null)
            .map(p => [p.rsRatio as number, p.rsMomentum as number])
          return { id: s.id, name: s.label, short: meta.short, color: meta.color,
                   note: s.note ?? '', path, quadrant: s.quadrant, direction: s.direction }
        }),
        ...(bench === 'SOXX' ? [{
          id: 'bm_soxx', name: 'SOXX', short: 'SOX', color: '#4A9EE0', isBm: true,
          note: '기준지수 참조점 (100, 100)',
          path: [[100.0, 100.0]], quadrant: 'Leading', direction: 'Pending',
        }] : []),
      ]
    : (bench === 'SOXX'
        ? SEMI_RRG_BUCKETS.map(b => ({
            id: b.name, name: b.name, short: b.short, color: b.color,
            isBm: b.isBm, note: b.note, path: b.path,
            quadrant: b.path.length > 0 ? quadLabel(b.path[b.path.length-1][0], b.path[b.path.length-1][1]) : 'Pending',
            direction: (b.isBm ? 'Pending' : inferDirection(b)) as string,
          }))
        : [])

  const isPending = renderBuckets.filter(r => !r.isBm).length === 0

  // ── Interpretation layer ─────────────────────────────────────────────────
  const liveSeriesForBench = seriesForBench.filter(s => s.source !== 'PENDING' && s.points.length > 0)
  const bucketInterps = liveSeriesForBench.map(classifyBucketRotation)
  const rotationSummary = classifyRrgRotation(liveSeriesForBench)

  const sevColor = (s: BucketSeverity) =>
    s === 'positive' ? V.teal : s === 'neutral' ? V.blue :
    s === 'caution' ? V.amber : s === 'weak' ? V.red : V.text3
  const sevBg = (s: BucketSeverity) =>
    s === 'positive' ? 'rgba(63,182,168,0.09)' : s === 'neutral' ? 'rgba(74,158,224,0.09)' :
    s === 'caution' ? 'rgba(242,169,59,0.09)' : s === 'weak' ? 'rgba(229,90,90,0.09)' : V.bg3
  const modeColor = (m: LeadershipMode) =>
    m === 'Rotation Broadening' || m === 'Broad Leadership' ? V.teal :
    m === 'Narrow Leadership' ? V.amber :
    m === 'Rotation Weakening' ? V.red :
    m === 'High Dispersion' ? V.gold : V.text3

  return (
    <div style={{background:V.bg2,border:`1px solid ${V.border}`,borderRadius:6,padding:16,minHeight:340}}>
      {/* ── Header ── */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
        <div>
          <div style={{fontSize:11,letterSpacing:'0.16em',color:V.teal,fontWeight:500,fontFamily:V.ui,marginBottom:2}}>RELATIVE ROTATION MAP</div>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <span style={{fontSize:11,color:V.text3,fontFamily:V.ui}}>vs {bench}</span>
            <span style={{fontSize:10,color:V.text3,fontFamily:V.ui,opacity:0.7}}>· {BENCH_CONTEXT[bench]}</span>
          </div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:4,alignItems:'flex-end'}}>
          <div style={{display:'flex',gap:3}}>
            {(['SOXX','QQQ','SPY'] as RRGBench[]).map(b=>(
              <button key={b} onClick={()=>setBench(b)} style={{
                fontSize:10,padding:'2px 8px',borderRadius:2,cursor:'pointer',
                border:`1px solid ${bench===b?'rgba(63,182,168,0.4)':V.border}`,
                background:bench===b?'rgba(63,182,168,0.12)':V.bg3,
                color:bench===b?V.teal:V.text3,fontFamily:'monospace',letterSpacing:'0.05em',
              }}>{b}</button>
            ))}
          </div>
          <div style={{display:'flex',gap:3}}>
            {([4,8,12,24] as RRGLookback[]).map(n=>(
              <button key={n} onClick={()=>setLookback(n)} style={{
                fontSize:10,padding:'1px 6px',borderRadius:2,cursor:'pointer',
                border:`1px solid ${lookback===n?'rgba(107,123,149,0.5)':V.border}`,
                background:lookback===n?'rgba(107,123,149,0.12)':V.bg3,
                color:lookback===n?V.text2:V.text3,fontFamily:'monospace',letterSpacing:'0.05em',
              }}>{n}W</button>
            ))}
          </div>
        </div>
      </div>
      {/* ── Korean helper ── */}
      <div style={{fontSize:10,color:V.text3,fontFamily:V.ui,marginBottom:10,padding:'4px 8px',background:V.bg3,borderRadius:3}}>
        RS Ratio (가로) · RS Momentum (세로) 이동 경로로 섹터 순환 단계를 읽는 회전 지도입니다.
      </div>

      {rrgError ? (
        <div style={{height:220,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:6,background:V.bg3,borderRadius:4}}>
          <div style={{fontSize:11,color:V.red,fontFamily:V.ui}}>DATA ERROR</div>
          <div style={{fontSize:10,color:V.text3,fontFamily:V.ui}}>API fetch failed — showing fallback fixture</div>
        </div>
      ) : rrgLoading ? (
        <div style={{height:220,display:'flex',alignItems:'center',justifyContent:'center',background:V.bg3,borderRadius:4}}>
          <div style={{fontSize:11,color:V.text3,fontFamily:V.ui}}>Loading RRG paths…</div>
        </div>
      ) : isPending ? (
        <div style={{height:220,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:6,background:V.bg3,borderRadius:4}}>
          <div style={{fontSize:11,color:V.text3,fontFamily:V.ui}}>PENDING</div>
          <div style={{fontSize:10,color:V.text3,fontFamily:V.ui}}>Bucket path pending for {bench} benchmark</div>
          {bench !== 'SOXX' && <div style={{fontSize:10,color:V.text3,fontFamily:V.ui,opacity:0.6}}>SOXX vs {bench} context available but bucket series not yet generated</div>}
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'auto',display:'block'}}>
          {/* Quadrant backgrounds */}
          <rect x={cx} y={T}  width={W-cx-R} height={cy-T}   fill="rgba(63,182,168,0.10)"/>
          <rect x={cx} y={cy} width={W-cx-R} height={H-cy-B} fill="rgba(251,191,36,0.10)"/>
          <rect x={L}  y={cy} width={cx-L}   height={H-cy-B} fill="rgba(229,90,90,0.10)"/>
          <rect x={L}  y={T}  width={cx-L}   height={cy-T}   fill="rgba(74,158,224,0.07)"/>
          {/* Quadrant labels */}
          <text x={cx+6}  y={T+14}  fill="#3FB6A8" fontSize={9} fontFamily="'IBM Plex Sans',sans-serif" letterSpacing=".10em" fontWeight="600">LEADING</text>
          <text x={W-R-6} y={H-B-8} fill="#6B7B95" fontSize={9} fontFamily="'IBM Plex Sans',sans-serif" letterSpacing=".10em" fontWeight="600" textAnchor="end">WEAKENING</text>
          <text x={L+6}   y={H-B-8} fill="#6B7B95" fontSize={9} fontFamily="'IBM Plex Sans',sans-serif" letterSpacing=".10em" fontWeight="600">LAGGING</text>
          <text x={cx-6}  y={T+14}  fill="#4A9EE0" fontSize={9} fontFamily="'IBM Plex Sans',sans-serif" letterSpacing=".10em" fontWeight="600" textAnchor="end">IMPROVING</text>
          {/* Subtle grid */}
          {[96,98,100,102,104,106,108].map(v=>{
            const px=L+(v-xMin)/(xMax-xMin)*CW
            return <g key={`gx${v}`}><line x1={px} y1={T} x2={px} y2={H-B} stroke={V.brd2} strokeWidth={0.5}/><text x={px} y={H-B+12} textAnchor="middle" fill={V.text3} fontSize={8} fontFamily="'IBM Plex Mono',monospace">{v}</text></g>
          })}
          {[97,99,101,103,105].map(v=>{
            const py=T+(1-(v-yMin)/(yMax-yMin))*CH
            return <line key={`gy${v}`} x1={L} y1={py} x2={W-R} y2={py} stroke={V.brd2} strokeWidth={0.5}/>
          })}
          {/* 100/100 center axis — emphasized */}
          <line x1={cx} y1={T}  x2={cx}  y2={H-B} stroke="rgba(107,123,149,0.55)" strokeWidth={1.5} strokeDasharray="5,3"/>
          <line x1={L}  y1={cy} x2={W-R} y2={cy}  stroke="rgba(107,123,149,0.55)" strokeWidth={1.5} strokeDasharray="5,3"/>
          {/* Axis labels */}
          <text x={W/2} y={H-4}  textAnchor="middle" fill={V.text3} fontSize={9} fontFamily="'IBM Plex Mono',monospace">RS Ratio →</text>
          <text x={10}  y={H/2}  textAnchor="middle" fill={V.text3} fontSize={9} fontFamily="'IBM Plex Mono',monospace" transform={`rotate(-90,10,${H/2})`}>RS Mom ↑</text>
          {/* Trails + current points */}
          {renderBuckets.map(bucket => {
            if (bucket.isBm) {
              return (
                <g key={bucket.id}>
                  <circle cx={cx} cy={cy} r={5} fill={bucket.color} opacity={0.22}/>
                  <text x={cx+8} y={cy-3} fill={bucket.color} fontSize={8} fontFamily="'IBM Plex Mono',monospace" opacity={0.35}>BM</text>
                </g>
              )
            }
            if (!bucket.path.length) return null
            const slice = bucket.path.slice(-(lookback+1))
            const n = slice.length
            const cur = slice[n-1]
            const {x:curX, y:curY} = toSvg(cur[0], cur[1])
            const trailPts = slice.slice(0, n-1)
            const polyPts = slice.map(pt=>{ const p=toSvg(pt[0],pt[1]); return `${p.x},${p.y}` }).join(' ')
            return (
              <g key={bucket.id}>
                {trailPts.length > 0 && <>
                  <polyline points={polyPts} fill="none" stroke={bucket.color} strokeWidth={1.4} opacity={0.38} strokeLinejoin="round" strokeLinecap="round"/>
                  {trailPts.map((pt,i)=>{
                    const {x,y}=toSvg(pt[0],pt[1])
                    const op=0.10+(i/trailPts.length)*0.42
                    return <circle key={i} cx={x} cy={y} r={3} fill={bucket.color} opacity={op}/>
                  })}
                </>}
                <circle cx={curX} cy={curY} r={13} fill="none" stroke={bucket.color} strokeWidth={1.2} opacity={0.4}/>
                <circle cx={curX} cy={curY} r={10} fill={bucket.color} opacity={0.9}/>
                <text x={curX} y={curY-17} textAnchor="middle" fill={bucket.color} fontSize={9} fontWeight="700" fontFamily="'IBM Plex Mono',monospace">{bucket.short}</text>
                {trailPts.length === 0 && (
                  <text x={curX} y={curY+22} textAnchor="middle" fill={bucket.color} fontSize={7} fontFamily="'IBM Plex Mono',monospace" opacity={0.45}>path pending</text>
                )}
              </g>
            )
          })}
        </svg>
      )}

      {/* ── Legend ── */}
      <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:8}}>
        {renderBuckets.map(b=>(
          <div key={b.id} style={{display:'flex',alignItems:'center',gap:4}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:b.color,flexShrink:0,opacity:b.isBm?0.3:1}}/>
            <span style={{fontSize:10,color:b.isBm?V.text3:V.text2,fontFamily:V.ui}}>{b.name}{b.isBm?' (BM)':''}</span>
          </div>
        ))}
      </div>

      {/* ── Interpretation strip ── */}
      {!isPending && (
        <div style={{marginTop:10,borderTop:`1px solid ${V.border}`,paddingTop:8}}>
          {/* Compact phase chips */}
          <div style={{fontSize:10,letterSpacing:'0.10em',color:V.text3,fontWeight:600,fontFamily:V.ui,marginBottom:6}}>ROTATION INTERPRETATION</div>
          {bucketInterps.length > 0 ? (
            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
              {bucketInterps.map(b=>(
                <div key={b.id} style={{display:'flex',alignItems:'center',gap:5,padding:'3px 9px',
                  background:sevBg(b.severity),borderRadius:3,
                  border:`1px solid ${sevColor(b.severity)}33`}}>
                  <div style={{width:6,height:6,borderRadius:'50%',background:sevColor(b.severity),flexShrink:0}}/>
                  <span style={{fontSize:10,color:V.text2,fontFamily:V.ui,fontWeight:500}}>{b.label}</span>
                  <span style={{fontSize:10,color:V.text3,fontFamily:V.ui}}>·</span>
                  <span style={{fontSize:10,color:sevColor(b.severity),fontFamily:V.mono}}>{b.phase}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{fontSize:10,color:V.text3,fontFamily:V.ui,marginBottom:10}}>Live path data not yet available — chips pending</div>
          )}

          {/* Rotation Read panel */}
          {bucketInterps.length > 0 && (
            <div style={{background:V.bg3,borderRadius:4,padding:'8px 10px',marginBottom:8,
              borderLeft:`2px solid ${modeColor(rotationSummary.leadershipMode)}`}}>
              <div style={{fontSize:10,letterSpacing:'0.10em',color:V.text3,fontWeight:600,fontFamily:V.ui,marginBottom:6}}>회전 해석</div>
              <div style={{display:'grid',gridTemplateColumns:'auto 1fr',gap:'4px 10px',alignItems:'baseline'}}>
                <span style={{fontSize:10,color:V.text3,fontFamily:V.ui}}>리더십 모드</span>
                <span style={{fontSize:10,color:modeColor(rotationSummary.leadershipMode),fontFamily:V.mono,fontWeight:600}}>{rotationSummary.leadershipMode}</span>
                {rotationSummary.leadBuckets.length > 0 && <>
                  <span style={{fontSize:10,color:V.text3,fontFamily:V.ui}}>주도 버킷</span>
                  <span style={{fontSize:10,color:V.teal,fontFamily:V.ui}}>{rotationSummary.leadBuckets.join(', ')}</span>
                </>}
                {rotationSummary.recoveringBuckets.length > 0 && <>
                  <span style={{fontSize:10,color:V.text3,fontFamily:V.ui}}>회복 버킷</span>
                  <span style={{fontSize:10,color:V.blue,fontFamily:V.ui}}>{rotationSummary.recoveringBuckets.join(', ')}</span>
                </>}
                {rotationSummary.weakeningBuckets.length > 0 && <>
                  <span style={{fontSize:10,color:V.text3,fontFamily:V.ui}}>둔화 버킷</span>
                  <span style={{fontSize:10,color:V.amber,fontFamily:V.ui}}>{rotationSummary.weakeningBuckets.join(', ')}</span>
                </>}
                {rotationSummary.laggingBuckets.length > 0 && <>
                  <span style={{fontSize:10,color:V.text3,fontFamily:V.ui}}>약세 버킷</span>
                  <span style={{fontSize:10,color:V.red,fontFamily:V.ui}}>{rotationSummary.laggingBuckets.join(', ')}</span>
                </>}
              </div>
              <div style={{marginTop:6,fontSize:10,color:V.text2,fontFamily:V.ui,lineHeight:1.5}}>
                {rotationSummary.koreanSummary}
              </div>
            </div>
          )}

          {/* Data source note */}
          <div style={{fontSize:10,color:V.text3,fontFamily:V.ui,padding:'3px 8px',background:V.bg3,borderRadius:3,borderLeft:`2px solid ${hasLive?V.teal:V.border}`}}>
            {hasLive
              ? `RRG path: ${rrgPayload.lookback} real data · benchmark ${rrgPayload.benchmark} · generated ${rrgPayload.generatedAt ? new Date(rrgPayload.generatedAt).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}) : '—'}`
              : pathStatus.hasBucketPath
                ? 'Bucket path connected — real RS data'
                : pathStatus.hasBenchmarkPath
                  ? 'Benchmark path connected · Bucket path pending'
                  : 'Fixture data · pipeline not yet run'}
          </div>
        </div>
      )}
    </div>
  )
}

// ── TAB: PERFORMANCE ─────────────────────────────────────────────────────────
const STATUS_COLOR: Record<RelativeStatus, string> = {
  Leading: '#22c55e', Neutral: '#c9cdd4', Lagging: '#ef4444', Pending: '#737880',
}
function TabPerformance({ buckets, aiRegime }: { buckets?: LiveBucket[]; aiRegime?: InterpAIRegime }) {
  const [benchRS,  setBenchRS]  = useState<BenchmarkRSPayload>(PENDING_RS_PAYLOAD)
  const [selBench, setSelBench] = useState<BenchmarkId>('SOXX')
  useEffect(() => {
    fetch('/api/semiconductor-benchmark-rs')
      .then(r => r.json())
      .then(d => setBenchRS(d as BenchmarkRSPayload))
      .catch(() => {})
  }, [])

  const bm   = benchRS.benchmarks
  const rel  = benchRS.relative
  const summ = benchRS.summary

  const perfRows = [
    {dot:V.blue, name:'SOXX Index',         d1:formatReturn(bm.SOXX.returns['1D']), d5:formatReturn(bm.SOXX.returns['5D']), m1:formatReturn(bm.SOXX.returns['1M']), m3:formatReturn(bm.SOXX.returns['3M']), m6:formatReturn(bm.SOXX.returns['6M']), dir:'Benchmark',  dirC:V.teal},
    {dot:V.teal, name:'AI Infrastructure',  d1:'+0.0%', d5:'+1.2%', m1:'+3.6%', m3:'+5.2%', m6:'+12.0%', dir:'Fading', dirC:V.amber},
    {dot:V.amber,name:'Memory / HBM',       d1:'+1.0%', d5:'+1.2%', m1:'+2.6%', m3:'+8.2%', m6:'+16.0%', dir:'Fading', dirC:V.amber},
    {dot:V.red,  name:'Foundry / Packaging',d1:'+1.0%', d5:'+0.2%', m1:'+1.6%', m3:'+3.2%', m6:'+10.0%', dir:'Fading', dirC:V.amber},
    {dot:V.gold, name:'Equipment',          d1:'+1.0%', d5:'+2.2%', m1:'+1.6%', m3:'+4.2%', m6:'+11.0%', dir:'Fading', dirC:V.amber},
  ]
  const tdS = (c:string):React.CSSProperties => ({padding:'7px 8px',fontSize:11,color:c,fontFamily:V.mono,textAlign:'right'})

  // VS column: SOXX row shows benchmark relative; bucket rows show PENDING until bucket RS wired
  const vsVal = (rowName: string, selBm: BenchmarkId): string => {
    if (rowName === 'SOXX Index') return '—'
    if (selBm === 'SOXX') {
      const vsSOXX: Record<string, string> = {
        'AI Infrastructure': '+0.0%', 'Memory / HBM': '−1.0%', 'Foundry / Packaging': '−2.0%', 'Equipment': '−2.0%',
      }
      return vsSOXX[rowName] ?? '—'
    }
    return '—'
  }
  const vsColor = (v: string): string =>
    v === '—' ? V.text3 : v.startsWith('+') ? V.teal : V.red

  return (
    <div style={{padding:'12px 20px',overflowY:'auto',flex:1}}>
      {/* Benchmark Context Card */}
      <div style={{background:V.bg2,border:`1px solid ${V.border}`,borderRadius:6,padding:'10px 14px',marginBottom:12}}>
        <div style={{fontSize:10,letterSpacing:'0.12em',color:V.text3,fontWeight:600,fontFamily:V.ui,marginBottom:8}}>BENCHMARK CONTEXT</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px 20px'}}>
          {(['SOXX_vs_QQQ','SOXX_vs_SPY'] as const).map(key => {
            const label = key === 'SOXX_vs_QQQ' ? 'SOXX vs QQQ' : 'SOXX vs SPY'
            const status: RelativeStatus = summ[key]
            const relMap = key === 'SOXX_vs_QQQ' ? rel.SOXX_vs_QQQ : rel.SOXX_vs_SPY
            const rel1d  = relMap['1D']
            return (
              <div key={key} style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span style={{fontSize:11,color:V.text2,fontFamily:V.ui}}>{label}</span>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:10,color:V.text3,fontFamily:V.mono}}>{formatRelative(rel1d)} 1D</span>
                  <span style={{fontSize:10,padding:'1px 6px',border:`1px solid ${STATUS_COLOR[status]}33`,color:STATUS_COLOR[status],borderRadius:2,fontFamily:V.mono,letterSpacing:'0.05em'}}>{status}</span>
                </div>
              </div>
            )
          })}
        </div>
        <div style={{marginTop:6,fontSize:10,color:V.text3,fontFamily:V.ui}}>
          SOXX proxy: SMH · 1M relative pending (snapshot history &lt;30d)
        </div>
      </div>

      <EduBox title="PERFORMANCE — 멀티 타임프레임 성과 비교">
        같은 버킷도 시간 단위에 따라 해석이 다릅니다. <strong>1D · 5D는 노이즈</strong>에 가깝고,
        <strong>1M · 3M · 6M</strong>이 실제 추세를 보여줍니다.
        VS SOXX 컬럼의 음수(−)는 해당 버킷이 SOXX 전체보다 약하다는 뜻입니다.
        Direction이 <strong>Fading</strong>이면 모멘텀이 꺾이고 있는 것, <strong>Sustaining</strong>이면 지속 중입니다.
      </EduBox>

      {/* Matrix with benchmark selector */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
        <SecTitle style={{marginBottom:0}}>BUCKET PERFORMANCE MATRIX</SecTitle>
        <div style={{display:'flex',gap:3,alignItems:'center'}}>
          <span style={{fontSize:10,color:V.text3,fontFamily:V.ui,marginRight:4}}>vs</span>
          {(['SOXX','QQQ','SPY'] as BenchmarkId[]).map(b=>(
            <button key={b} onClick={()=>setSelBench(b)} style={{
              fontSize:10,padding:'2px 7px',borderRadius:2,cursor:'pointer',
              border:`1px solid ${selBench===b?'rgba(63,182,168,0.4)':V.border}`,
              background:selBench===b?'rgba(63,182,168,0.12)':V.bg3,
              color:selBench===b?V.teal:V.text3,fontFamily:V.mono,letterSpacing:'0.05em',
            }}>{b}</button>
          ))}
        </div>
      </div>
      <Card>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontFamily:V.ui}}>
            <thead>
              <tr style={{borderBottom:`1px solid ${V.border}`}}>
                {['BUCKET','1D','5D','1M','3M','6M',`VS ${selBench} 1M`,'DIRECTION'].map(h=>(
                  <th key={h} style={{padding:'6px 8px',fontSize:10,letterSpacing:'0.10em',color:V.text3,textAlign:h==='BUCKET'?'left':'right',fontWeight:600}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {perfRows.map(r=>{
                const vs = vsVal(r.name, selBench)
                return (
                  <tr key={r.name} style={{borderBottom:`1px solid ${V.brd2}`}}>
                    <td style={{padding:'7px 8px',fontSize:11}}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <span style={{width:8,height:8,borderRadius:'50%',background:r.dot,flexShrink:0,display:'inline-block'}}/>
                        <span style={{color:V.text2,fontFamily:V.ui}}>{r.name}</span>
                      </div>
                    </td>
                    <td style={tdS(r.d1.startsWith('+')?V.teal:r.d1.startsWith('−')||r.d1.startsWith('-')?V.red:V.text3)}>{r.d1}</td>
                    <td style={tdS(r.d5.startsWith('+')?V.teal:r.d5.startsWith('−')||r.d5.startsWith('-')?V.red:V.text3)}>{r.d5}</td>
                    <td style={tdS(r.m1.startsWith('+')?V.teal:r.m1.startsWith('−')||r.m1.startsWith('-')?V.red:V.text3)}>{r.m1}</td>
                    <td style={tdS(r.m3.startsWith('+')?V.teal:r.m3.startsWith('−')||r.m3.startsWith('-')?V.red:V.text3)}>{r.m3}</td>
                    <td style={tdS(r.m6.startsWith('+')?V.teal:r.m6.startsWith('−')||r.m6.startsWith('-')?V.red:V.text3)}>{r.m6}</td>
                    <td style={tdS(vsColor(vs))}>{vs}</td>
                    <td style={{padding:'7px 8px',fontSize:11,color:r.dirC,fontFamily:V.mono,textAlign:'right'}}>{r.dir}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <SecTitle style={{marginTop:10}}>AI REGIME LENS</SecTitle>
      <Card style={{marginBottom:0}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <div>
            <span style={{fontSize:13,fontWeight:500,color:V.teal,fontFamily:V.ui}}>{aiRegime ? regimeDisplay(aiRegime.regime_label) : 'Broad Recovery'}</span>
            <span style={{fontSize:11,color:V.teal,border:'1px solid rgba(63,182,168,0.3)',padding:'2px 6px',borderRadius:2,marginLeft:8,fontFamily:V.mono}}>{aiRegime?.regime_confidence?.toUpperCase() ?? 'HIGH CONF'}</span>
          </div>
          <span style={{fontSize:10,background:aiRegime?'rgba(63,182,168,0.15)':'rgba(107,123,149,0.15)',color:aiRegime?V.teal:V.text3,padding:'2px 7px',borderRadius:3,letterSpacing:'0.06em',fontFamily:V.mono}}>{aiRegime?'LIVE':'STATIC'}</span>
        </div>
        <RegimeBars aiRegime={aiRegime}/>
        <div style={{fontSize:11,color:V.text2,fontStyle:'italic',marginTop:8,padding:'6px 8px',background:V.bg3,borderRadius:4,fontFamily:V.ui}}>{'Participation is broad across all semiconductor segments with no dominant concentration, consistent with an early recovery structure.'}</div>
      </Card>
      <SecTitle style={{marginTop:10}}>RELATIVE ROTATION MAP</SecTitle>
      <SemiconductorRRGCard />
    </div>
  )
}

// ── TAB: HEALTH ──────────────────────────────────────────────────────────────
const BUCKET_DOT: Record<string,string> = {'AI Compute':V.teal,'Memory / HBM':V.amber,'Memory':V.amber,'Foundry / Packaging':V.red,'Foundry':V.red,'Equipment':V.gold,'SOXX':V.blue,'SOXX Index':V.blue}
function TabHealth({ rsTable, kpis, breadthDetail, concentrationTop5 }:
  { rsTable?: RsRow[]; kpis?: LiveKpis; breadthDetail?: BreadthDetail | null; concentrationTop5?: number | null }) {
  const [flowProxy, setFlowProxy] = useState<SemiconductorFlowProxyPayload>(PENDING_FLOW_PROXY)
  useEffect(() => {
    fetch('/api/semiconductor-flow-proxy')
      .then(r => r.json())
      .then((d: SemiconductorFlowProxyPayload) => setFlowProxy(d))
      .catch(() => {})
  }, [])
  const liveRows = rsTable?.map(r => ({
    dot: BUCKET_DOT[r.name] ?? V.blue,
    name: r.name, ret: r.rs, vs: r.vs,
    dir: r.up ? 'Sustaining' : 'Fading', dirC: r.up ? V.teal : V.amber,
    conc: r.name.toLowerCase().includes('ai') ? `Med · ${Math.round(concentrationTop5 ?? 36)}%` : 'Low',
    concC: r.name.toLowerCase().includes('ai') ? V.gold : V.text3,
  }))
  const mRows = liveRows ?? [
    {dot:V.blue, name:'SOXX Index',      ret:'+3.6%',vs:'—',dir:'Sustaining',dirC:V.teal,conc:'Low',concC:V.text3},
    {dot:V.teal, name:'AI Infrastructure',ret:'+3.6%',vs:'+0.0%',dir:'Fading',dirC:V.amber,conc:`Med · ${Math.round(concentrationTop5??36)}%`,concC:V.gold},
    {dot:V.amber,name:'Memory',          ret:'+2.6%',vs:'−1.0%',dir:'Fading',dirC:V.amber,conc:'Low',concC:V.text3},
    {dot:V.red,  name:'Foundry',         ret:'+1.6%',vs:'−2.0%',dir:'Fading',dirC:V.amber,conc:'Low',concC:V.text3},
    {dot:V.gold, name:'Equipment',       ret:'+1.6%',vs:'−2.0%',dir:'Fading',dirC:V.amber,conc:'Low',concC:V.text3},
  ]
  const breadthScore = Math.round(kpis?.breadth_pct ?? 100)
  const advPct = Math.round(kpis?.advancing_pct ?? 100)
  const decPct = Math.round(kpis?.declining_pct ?? 0)
  const ma20pct = breadthDetail?.pct_above_ma20 ?? 100
  const conflictLabel = kpis ? (kpis.breadth_pct < 40 ? 'BREADTH WEAK' : 'NO CONFLICT') : 'NO CONFLICT'
  const conflictC = kpis ? (kpis.breadth_pct < 40 ? V.red : V.teal) : V.teal
  return (
    <div style={{padding:'12px 20px',overflowY:'auto',flex:1}}>
      <EduBox title="HEALTH — SOXX 내부가 건강한가">
        <strong>Breadth(폭)</strong>는 SOXX 안에서 오르는 종목이 얼마나 많은지입니다. 100%면 전원 상승 — 최고 건강 상태.
        <strong>Momentum(모멘텀)</strong>은 현재 추세의 강도입니다. +31 Sustaining은 상승세가 유지되고 있다는 뜻.
        <strong>Leadership Signal +14</strong>는 시장 전반의 참여도가 넓다는 신호입니다.
        세 지표가 모두 긍정적이면 <strong>SOXL 무한매수 환경에 우호적</strong>입니다.
      </EduBox>
      <SecTitle>HEALTH COMPOSITE — BREADTH · MOMENTUM · PARTICIPATION</SecTitle>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:8}}>
        {[
          {label:'BREADTH SCORE',    val:String(breadthScore), state:breadthScore>=70?'Healthy':breadthScore>=40?'Mixed':'Weak', sub:'Confirms trend',   c:breadthScore>=70?V.teal:breadthScore>=40?V.amber:V.red,  bc:breadthScore>=70?'rgba(63,182,168,0.3)':'rgba(242,169,59,0.3)'},
          {label:'MOMENTUM SIGNAL',  val:'+31',  state:'Sustaining',    sub:'Stable regime',    c:V.amber,bc:'rgba(242,169,59,0.3)'},
          {label:'LEADERSHIP SIGNAL',val:'+14',  state:'Broad Partic.', sub:'Conf 91 · High',   c:V.mint, bc:'rgba(93,207,176,0.3)'},
        ].map(h=>(
          <div key={h.label} style={{background:V.bg2,border:`1px solid ${h.bc}`,borderRadius:6,padding:'10px 12px',textAlign:'center'}}>
            <div style={{fontSize:10,letterSpacing:'0.12em',color:V.text3,marginBottom:6,fontFamily:V.ui}}>{h.label}</div>
            <div style={{fontSize:28,fontWeight:500,color:h.c,fontFamily:V.mono,lineHeight:1}}>{h.val}</div>
            <div style={{fontSize:11,color:h.c,fontWeight:500,marginTop:4,fontFamily:V.ui}}>{h.state}</div>
            <div style={{fontSize:10,color:V.text3,marginTop:4,fontFamily:V.ui}}>{h.sub}</div>
          </div>
        ))}
      </div>
      <Card>
        <SecTitle style={{marginBottom:8}}>ADVANCING / DECLINING</SecTitle>
        <div style={{marginBottom:8}}>
          <div style={{height:12,background:V.bg3,borderRadius:6,overflow:'hidden',marginBottom:6}}>
            <div style={{height:'100%',width:`${advPct}%`,background:V.teal,borderRadius:6}}/>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:11,fontFamily:V.mono}}>
            <span style={{color:V.teal}}>Adv {advPct}%</span><span style={{color:V.text3}}>Net +{advPct - decPct}</span><span style={{color:V.red}}>Dec {decPct}%</span>
          </div>
        </div>
        <div style={{fontSize:10,color:V.text2,fontFamily:V.ui}}>% above 20MA: <span style={{color:ma20pct!=null&&ma20pct>=60?V.teal:V.amber,fontWeight:500}}>{ma20pct!=null?`${Math.round(ma20pct)}%`:'—'}</span> · <span style={{color:ma20pct!=null&&ma20pct>=60?V.teal:V.amber}}>{ma20pct!=null&&ma20pct>=60?'BULLISH':'MIXED'}</span></div>
        <div style={{marginTop:6,fontSize:10,fontWeight:600,letterSpacing:'0.10em',color:conflictC,padding:'4px 8px',background:`rgba(${conflictC===V.teal?'63,182,168':'229,90,90'},0.08)`,border:`1px solid rgba(${conflictC===V.teal?'63,182,168':'229,90,90'},0.2)`,borderRadius:4,display:'inline-block',fontFamily:V.mono}}>{conflictLabel}</div>
        <div style={{fontSize:11,color:V.text2,fontStyle:'italic',marginTop:6,fontFamily:V.ui}}>Participation is consistent with the current trend. Broad advance confirms expansion regime.</div>
      </Card>
      <SecTitle style={{marginTop:10}}>BUCKET MOMENTUM RANKING <span style={{color:V.text3,fontSize:11,fontWeight:400,letterSpacing:0}}>1M return proxy</span></SecTitle>
      <Card style={{marginBottom:0}}>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontFamily:V.ui}}>
            <thead>
              <tr style={{borderBottom:`1px solid ${V.border}`}}>
                {['BUCKET','1M RET','VS SOXX','DIRECTION','CONCENTRATION RISK'].map(h=>(
                  <th key={h} style={{padding:'6px 8px',fontSize:10,letterSpacing:'0.10em',color:V.text3,textAlign:h==='BUCKET'?'left':'right',fontWeight:600}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mRows.map(r=>(
                <tr key={r.name} style={{borderBottom:`1px solid ${V.brd2}`}}>
                  <td style={{padding:'7px 8px',fontSize:11}}>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <span style={{width:8,height:8,borderRadius:'50%',background:r.dot,flexShrink:0,display:'inline-block'}}/>
                      <span style={{color:V.text2,fontFamily:V.ui}}>{r.name}</span>
                    </div>
                  </td>
                  <td style={{padding:'7px 8px',fontSize:11,color:r.ret.startsWith('+')?V.teal:V.red,fontFamily:V.mono,textAlign:'right'}}>{r.ret}</td>
                  <td style={{padding:'7px 8px',fontSize:11,color:r.vs==='—'?V.text3:r.vs.startsWith('+')?V.teal:V.red,fontFamily:V.mono,textAlign:'right'}}>{r.vs}</td>
                  <td style={{padding:'7px 8px',fontSize:11,color:r.dirC,fontFamily:V.mono,textAlign:'right'}}>{r.dir}</td>
                  <td style={{padding:'7px 8px',fontSize:10,color:r.concC,fontFamily:V.ui,textAlign:'right'}}>{r.conc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{marginTop:6,fontSize:10,fontWeight:600,letterSpacing:'0.10em',color:V.teal,padding:'4px 8px',background:'rgba(63,182,168,0.08)',border:'1px solid rgba(63,182,168,0.2)',borderRadius:4,display:'inline-block',fontFamily:V.mono}}>NO CONFLICT</div>
        <div style={{fontSize:11,color:V.text2,fontStyle:'italic',marginTop:6,fontFamily:V.ui}}>Momentum is consistent with the current trend. No divergence detected across buckets.</div>
      </Card>

      {/* ── Flow / Volume Confirmation ── */}
      <SecTitle style={{marginTop:10}}>FLOW / VOLUME CONFIRMATION <span style={{color:V.text3,fontSize:11,fontWeight:400,letterSpacing:0}}>20D vol proxy · local OHLCV</span></SecTitle>
      <Card style={{marginBottom:0}}>
        {flowProxy.buckets.length > 0 ? (
          <>
            <div style={{display:'grid',gridTemplateColumns:'1fr auto auto auto',gap:'4px 16px',alignItems:'center',marginBottom:8}}>
              <span style={{fontSize:10,letterSpacing:'0.10em',color:V.text3,fontWeight:600,fontFamily:V.ui}}>BUCKET</span>
              <span style={{fontSize:10,letterSpacing:'0.10em',color:V.text3,fontWeight:600,fontFamily:V.ui,textAlign:'right'}}>VOL 5D/20D</span>
              <span style={{fontSize:10,letterSpacing:'0.10em',color:V.text3,fontWeight:600,fontFamily:V.ui,textAlign:'right'}}>RET 20D</span>
              <span style={{fontSize:10,letterSpacing:'0.10em',color:V.text3,fontWeight:600,fontFamily:V.ui,textAlign:'right'}}>STATUS</span>
              {flowProxy.buckets.map(b => {
                const sc = FLOW_STATUS_COLOR[b.status as keyof typeof FLOW_STATUS_COLOR] ?? V.text3
                const dot = FLOW_STATUS_DOT[b.status as keyof typeof FLOW_STATUS_DOT] ?? '—'
                return (
                  <><span key={`n-${b.id}`} style={{fontSize:11,color:V.text2,fontFamily:V.ui}}>{b.label}</span>
                  <span key={`v-${b.id}`} style={{fontSize:11,color:V.text2,fontFamily:V.mono,textAlign:'right'}}>
                    {b.volumeRatio5D != null ? `×${b.volumeRatio5D.toFixed(2)}` : '—'}
                  </span>
                  <span key={`r-${b.id}`} style={{fontSize:11,fontFamily:V.mono,textAlign:'right',color:b.return20D != null ? (b.return20D >= 0 ? V.teal : V.red) : V.text3}}>
                    {b.return20D != null ? `${b.return20D >= 0 ? '+' : ''}${b.return20D.toFixed(1)}%` : '—'}
                  </span>
                  <span key={`s-${b.id}`} style={{fontSize:11,color:sc,fontFamily:V.mono,textAlign:'right',fontWeight:500}}>
                    {dot} {b.status}
                  </span></>
                )
              })}
            </div>
            <div style={{marginTop:6,fontSize:10,color:V.text2,fontFamily:V.ui,padding:'6px 8px',background:V.bg3,borderRadius:3,
              borderLeft:`2px solid ${FLOW_STATUS_COLOR[flowProxy.summary.overallStatus as keyof typeof FLOW_STATUS_COLOR]??V.border}`}}>
              {flowProxy.summary.koreanSummary}
            </div>
            <div style={{marginTop:4,fontSize:10,color:V.text3,fontFamily:V.ui}}>
              generated {flowProxy.generatedAt ? new Date(flowProxy.generatedAt).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '—'} · benchmark {flowProxy.benchmark} · vol 5D/20D ratio (local OHLCV, not fund flow data)
            </div>
          </>
        ) : (
          <div style={{padding:16,textAlign:'center'}}>
            <div style={{fontSize:11,color:V.text3,fontFamily:V.ui}}>Flow / volume proxy pending — run build_semiconductor_flow_proxy.py</div>
          </div>
        )}
      </Card>
    </div>
  )
}

// ── TAB: SOXL ENV ────────────────────────────────────────────────────────────
function TabSoxlEnv({ onTab }: { onTab:(t:CenterTab)=>void }) {
  const [decay,       setDecay]       = useState<SoxlDecayPayload>(PENDING_SOXL_DECAY)
  const [decayWindow, setDecayWindow] = useState<SoxlDecayWindow>('3M')
  useEffect(() => {
    fetch('/api/soxl-decay')
      .then(r => r.json())
      .then((d: SoxlDecayPayload) => { setDecay(d); setDecayWindow(d.defaultWindow ?? '3M') })
      .catch(() => {})
  }, [])
  const curMetric  = decay.metrics.find(m => m.window === decayWindow) ?? null
  const bm         = decay.benchmark === 'PENDING' ? 'SOXX' : decay.benchmark
  const curStatus  = (curMetric?.status ?? 'PENDING') as SoxlDecayStatus
  const statusColor = DECAY_STATUS_COLOR[curStatus]

  return (
    <div style={{padding:'12px 20px',overflowY:'auto',flex:1}}>
      <EduBox title="SOXL ENV — 무한매수 환경 진단 (추천 아님 · 환경 인식)">
        <strong>SOXL은 SOXX의 3배 레버리지</strong>이지만, 실제 수익은 이론치(×3)보다 항상 작습니다.
        이 차이를 <strong>변동성 감쇠(Volatility Decay)</strong>라고 합니다.
        변동성이 높을수록 감쇠가 커지고, 무한매수의 비용이 증가합니다.
        <strong>AI vs Legacy Layer Spread가 클수록</strong>(AI 단독 랠리) SOXX 폭이 좁아져 SOXL의 변동성이 높아집니다.
        이 탭은 &quot;사라&quot;가 아니라 <strong>&quot;지금 환경이 어떤 상태인가&quot;</strong>를 알려줍니다.
      </EduBox>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <SecTitle style={{margin:0}}>★ SOXL ENVIRONMENT — 무한매수 환경 진단</SecTitle>
        <span style={{fontSize:10,background:'rgba(229,90,90,0.15)',color:V.red,border:'1px solid rgba(229,90,90,0.25)',padding:'2px 7px',borderRadius:3,letterSpacing:'0.06em',fontFamily:V.mono}}>NOT INVESTMENT ADVICE · CONTEXT ONLY</span>
      </div>
      {/* Hero */}
      <div style={{display:'grid',gridTemplateColumns:'auto 1fr',gap:16,marginBottom:10}}>
        {/* Gauge */}
        <div style={{background:V.bg2,border:`1px solid ${V.border}`,borderRadius:6,padding:'12px 16px',display:'flex',flexDirection:'column',alignItems:'center',minWidth:150}}>
          <div style={{fontSize:10,letterSpacing:'0.12em',color:V.text3,marginBottom:8,fontFamily:V.ui}}>SOXL ENVIRONMENT</div>
          <svg width="120" height="80" viewBox="0 0 120 80">
            <path d="M 10 72 A 50 50 0 0 1 110 72" stroke="#1A2740" strokeWidth="10" fill="none" strokeLinecap="round"/>
            <path d="M 10 72 A 50 50 0 0 1 60 22" stroke="#D4B36A" strokeWidth="10" fill="none" strokeLinecap="round"/>
            <line x1="60" y1="72" x2="60" y2="28" stroke="#D4B36A" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="60" cy="72" r="4" fill="#D4B36A"/>
            <text x="14" y="76" fill="#5DCFB0" fontSize="10" fontFamily="monospace">GO</text>
            <text x="90" y="76" fill="#E55A5A" fontSize="10" fontFamily="monospace">RISK</text>
          </svg>
          <div style={{fontSize:12,fontWeight:600,color:V.gold,marginTop:4,fontFamily:V.ui}}>⬤ CAUTION</div>
          <div style={{fontSize:11,color:V.text3,textAlign:'center',marginTop:4,lineHeight:1.4,fontFamily:V.ui}}>Elevated vol · AI-only rally<br/>Proceed with reduced size</div>
        </div>
        {/* Layer Diag */}
        <div style={{background:V.bg2,border:`1px solid ${V.border}`,borderRadius:6,padding:12}}>
          <div style={{fontSize:11,letterSpacing:'0.14em',color:V.amber,fontWeight:500,marginBottom:10,fontFamily:V.ui}}>★ BRIDGE 3 LAYER SPLIT — SOXX 이중구조 진단</div>
          {[
            {name:'AI Compute Layer',  tickers:'NVDA / AVGO / AMD / ASML / TSM / MRVL',w:'75%',c:V.amber,val:'+18.4%'},
            {name:'Legacy Layer',      tickers:'INTC / ON / NXP / MCHP / TXN / ADI',   w:'18%',c:V.red,  val:'−3.8%'},
          ].map(l=>(
            <div key={l.name} style={{marginBottom:10}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div>
                  <div style={{fontSize:11,fontWeight:500,color:l.c,fontFamily:V.ui}}>{l.name}</div>
                  <div style={{fontSize:11,color:V.text3,marginBottom:5,fontFamily:V.ui}}>{l.tickers}</div>
                  <div style={{height:6,background:V.bg3,borderRadius:3,overflow:'hidden',width:'100%'}}>
                    <div style={{height:'100%',width:l.w,background:l.c,borderRadius:3}}/>
                  </div>
                </div>
                <div style={{fontSize:18,fontWeight:500,color:l.c,fontFamily:V.mono,marginLeft:12}}>{l.val}</div>
              </div>
            </div>
          ))}
          <div style={{background:'rgba(242,169,59,0.08)',border:'1px solid rgba(242,169,59,0.2)',borderRadius:4,padding:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontSize:11,color:V.amber,fontFamily:V.ui}}>Layer Spread</div>
              <div style={{fontSize:11,color:V.text3,fontFamily:V.ui}}>AI 단독 랠리 · 폭 좁음</div>
            </div>
            <div style={{fontSize:22,fontWeight:500,color:V.amber,fontFamily:V.mono}}>22pp</div>
          </div>
        </div>
      </div>
      {/* Bridge 5 — SOXL decay tracker (live data) */}
      <Card style={{border:'1px solid rgba(229,90,90,0.3)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <SecTitle style={{margin:0}}>★ BRIDGE 5 — SOXL 변동성 감쇠 추적기</SecTitle>
          <span style={{fontSize:10,background:`${statusColor}1A`,color:statusColor,padding:'2px 7px',borderRadius:3,letterSpacing:'0.06em',fontFamily:V.mono}}>
            {decayWindow} · {DECAY_STATUS_LABEL[curStatus]}
          </span>
        </div>
        {/* Window selector */}
        <div style={{display:'flex',gap:4,marginBottom:10}}>
          {(['5D','1M','3M','6M','1Y'] as SoxlDecayWindow[]).map(w=>(
            <button key={w} onClick={()=>setDecayWindow(w)} style={{
              fontSize:10,padding:'2px 8px',borderRadius:2,cursor:'pointer',
              border:`1px solid ${decayWindow===w?`${statusColor}66`:V.border}`,
              background:decayWindow===w?`${statusColor}1A`:V.bg3,
              color:decayWindow===w?statusColor:V.text3,fontFamily:V.mono,letterSpacing:'0.05em',
            }}>{w}</button>
          ))}
          {decay.benchmark !== 'PENDING' && (
            <span style={{fontSize:10,color:V.text3,fontFamily:V.ui,alignSelf:'center',marginLeft:4}}>
              vs ideal 3x {bm}
            </span>
          )}
        </div>
        {/* Stat boxes */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:10}}>
          {curMetric && curMetric.status !== 'PENDING' ? (
            <>
              <div style={{background:V.bg3,border:`1px solid ${V.border}`,borderRadius:5,padding:'8px 10px',textAlign:'center'}}>
                <div style={{fontSize:10,letterSpacing:'0.10em',color:V.text3,marginBottom:4,fontFamily:V.ui}}>이론 SOXL ({bm}×3)</div>
                <div style={{fontSize:22,fontWeight:500,color:V.teal,fontFamily:V.mono}}>{fmtReturn(curMetric.ideal3xReturnPct)}</div>
                <div style={{fontSize:11,color:V.text3,marginTop:2,fontFamily:V.ui}}>{decayWindow} 기준 (단순계산)</div>
              </div>
              <div style={{background:V.bg3,border:`1px solid ${statusColor}44`,borderRadius:5,padding:'8px 10px',textAlign:'center'}}>
                <div style={{fontSize:10,letterSpacing:'0.10em',color:V.text3,marginBottom:4,fontFamily:V.ui}}>실제 SOXL</div>
                <div style={{fontSize:22,fontWeight:500,color:statusColor,fontFamily:V.mono}}>{fmtReturn(curMetric.actualSoxlReturnPct)}</div>
                <div style={{fontSize:11,color:statusColor,marginTop:2,fontFamily:V.ui}}>
                  {curStatus === 'FAVORABLE' ? '이론치 초과' : curStatus === 'NEUTRAL' ? '이론치 근접' : '감쇠 발생'}
                </div>
              </div>
              <div style={{background:`${statusColor}0D`,border:`1px solid ${statusColor}33`,borderRadius:5,padding:'8px 10px',textAlign:'center'}}>
                <div style={{fontSize:10,letterSpacing:'0.10em',color:V.text3,marginBottom:4,fontFamily:V.ui}}>누적 감쇠</div>
                <div style={{fontSize:22,fontWeight:500,color:statusColor,fontFamily:V.mono}}>{fmtDecay(curMetric.decayPct)}</div>
                <div style={{fontSize:11,color:statusColor,marginTop:2,fontFamily:V.ui}}>변동성 비용 프록시</div>
              </div>
            </>
          ) : (
            <div style={{gridColumn:'1/-1',padding:20,textAlign:'center',background:V.bg3,borderRadius:5}}>
              <div style={{fontSize:11,color:V.text3,fontFamily:V.ui}}>
                {decay.benchmark === 'PENDING'
                  ? 'SOXL 감쇠 데이터 대기 중 — SOXX/SMH 데이터 없음'
                  : `${decayWindow} 구간 데이터 부족 · 다른 구간을 선택하세요`}
              </div>
            </div>
          )}
        </div>
        <div style={{fontSize:11,color:V.text3,marginBottom:6,fontFamily:V.ui}}>
          이론치 vs 실제 SOXL {decayWindow} 비교 (단순 점대점 비교 · JdK 공식 아님)
        </div>
        <svg viewBox="0 0 640 120" style={{width:'100%',height:'auto',display:'block'}}>
          <line x1="40" y1="60" x2="630" y2="60" stroke="#1A2740" strokeWidth="0.5"/>
          <line x1="40" y1="30" x2="630" y2="30" stroke="#1A2740" strokeWidth="0.5"/>
          <line x1="40" y1="90" x2="630" y2="90" stroke="#1A2740" strokeWidth="0.5"/>
          <text x="36" y="33" fill="#A8BAD0" fontSize="10" textAnchor="end" fontFamily="monospace">+60%</text>
          <text x="36" y="63" fill="#A8BAD0" fontSize="10" textAnchor="end" fontFamily="monospace">+30%</text>
          <text x="36" y="93" fill="#A8BAD0" fontSize="10" textAnchor="end" fontFamily="monospace">0%</text>
          <path d="M40,90 C120,82 200,70 280,58 C360,46 440,36 530,26 C570,22 605,18 630,15" stroke="#3FB6A8" strokeWidth="1.8" fill="none" strokeDasharray="5,3"/>
          <path d="M40,90 C120,83 200,72 280,62 C360,52 440,44 530,35 C570,32 605,29 630,27" stroke={statusColor} strokeWidth="2.2" fill="none"/>
          <path d="M40,90 C120,82 200,70 280,58 C360,46 440,36 530,26 C570,22 605,18 630,15 L630,27 C605,29 570,32 530,35 C440,44 360,52 280,62 C200,72 120,83 40,90Z" fill={`${statusColor}14`}/>
          <text x="634" y="17" fill="#3FB6A8" fontSize="10" fontFamily="monospace">이론</text>
          <text x="634" y="29" fill={statusColor} fontSize="10" fontWeight="500" fontFamily="monospace">실제</text>
          <text x="42" y="112" fill="#B8C8DC" fontSize="10" fontFamily="monospace">D-{decayWindow}</text>
          <text x="630" y="112" fill="#B8C8DC" fontSize="10" textAnchor="end" fontFamily="monospace">Today</text>
        </svg>
        <div style={{marginTop:8,fontSize:10,color:V.text3,lineHeight:1.6,background:V.bg3,padding:'8px 10px',borderRadius:4,fontFamily:V.ui,borderLeft:`2px solid ${statusColor}`}}>
          <span style={{color:statusColor,fontWeight:500}}>해석 ({DECAY_STATUS_LABEL[curStatus]}):</span>{' '}
          {decay.summary.koreanSummary}
          {bm === 'SMH' && <span style={{color:V.text3}}> · SOXX 데이터 없어 SMH 기준 적용</span>}
        </div>
        {curMetric && curMetric.startDate && (
          <div style={{marginTop:4,fontSize:10,color:V.text3,fontFamily:V.ui}}>
            {curMetric.startDate} → {curMetric.endDate} · {curMetric.observations}거래일 · source: {curMetric.source}
          </div>
        )}
      </Card>
      {/* Env Summary */}
      <Card style={{border:'1px solid rgba(212,179,106,0.3)',marginBottom:0}}>
        <SecTitle style={{marginBottom:10}}>환경 종합 판단</SecTitle>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:8}}>
          {[
            {label:'SOXX 추세',val:'Expansion',vc:V.teal,bg:V.bg3,bc:V.border},
            {label:'레이어 폭', val:'AI 단독',  vc:V.amber,bg:V.bg3,bc:V.border},
            {label:'변동성',    val:'Elevated',  vc:V.gold, bg:V.bg3,bc:V.border},
            {label:'종합 신호', val:'⬤ CAUTION',vc:V.gold,bg:'rgba(212,179,106,0.08)',bc:'rgba(212,179,106,0.25)'},
          ].map(s=>(
            <div key={s.label} style={{background:s.bg,border:`1px solid ${s.bc}`,borderRadius:4,padding:8,textAlign:'center'}}>
              <div style={{fontSize:11,color:V.text3,fontFamily:V.ui}}>{s.label}</div>
              <div style={{fontSize:s.label==='종합 신호'?13:11,fontWeight:500,color:s.vc,marginTop:4,fontFamily:V.ui}}>{s.val}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ── LEFT PANEL ───────────────────────────────────────────────────────────────
function LeftPanel({ stage, progress }: { stage?: string; progress?: number }) {
  return (
    <div style={{background:V.bg2,borderRight:`1px solid ${V.border}`,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Cycle Position */}
      <div style={{padding:'12px 16px',borderBottom:`1px solid ${V.border}`}}>
        <div style={{fontSize:10,letterSpacing:'0.14em',color:V.text3,fontWeight:600,marginBottom:10,fontFamily:V.ui}}>CYCLE POSITION</div>
        {(()=>{
          const pct = progress ?? 71
          const stg = stage ?? 'MID EXPANSION'
          const sc  = stageColor(stg)
          const {path, ex, ey} = gaugeArc(60, 65, 50, pct)
          return (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
              <svg width="120" height="70" viewBox="0 0 120 70">
                <path d="M 10 65 A 50 50 0 0 1 110 65" stroke="#1A2740" strokeWidth="8" fill="none" strokeLinecap="round"/>
                <path d={path} stroke={sc} strokeWidth="8" fill="none" strokeLinecap="round"/>
                <text x="60" y="58" textAnchor="middle" fill={sc} fontSize="18" fontWeight="500" fontFamily="monospace">{Math.round(pct)}%</text>
                <circle cx={ex.toFixed(1)} cy={ey.toFixed(1)} r="5" fill="#F2A93B"/>
              </svg>
              <div style={{fontSize:12,fontWeight:600,color:sc,letterSpacing:'0.10em',marginTop:4,fontFamily:V.ui}}>{stg}</div>
              <div style={{fontSize:11,color:V.text3,fontFamily:V.ui}}>Cycle Progress</div>
            </div>
          )
        })()}
        <div style={{height:8,background:V.bg3,borderRadius:4,overflow:'hidden',marginTop:8}}>
          <div style={{height:'100%',width:`${progress ?? 71}%`,background:`linear-gradient(90deg,${V.teal},${V.mint})`,borderRadius:4,display:'flex',alignItems:'center',justifyContent:'flex-end',paddingRight:4}}>
            <span style={{fontSize:9,color:V.bg,fontWeight:600,fontFamily:V.mono}}>{stage?.replace('MID ','').replace('EARLY ','') ?? 'Expansion'} 100%</span>
          </div>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:5,fontSize:11,color:V.text3,fontFamily:V.ui}}>
          <span>Early</span><span style={{color:stageColor(stage??'MID EXPANSION'),fontWeight:500}}>Mid</span><span>Late</span><span>Peak</span>
        </div>
      </div>
      {/* 5Y Cycle Band */}
      <div style={{padding:'12px 16px',flex:1,overflowY:'auto'}}>
        <div style={{fontSize:10,letterSpacing:'0.14em',color:V.text3,fontWeight:600,marginBottom:10,fontFamily:V.ui}}>5Y CYCLE HISTORY</div>
        <svg viewBox="0 0 220 310" xmlns="http://www.w3.org/2000/svg" style={{width:'100%',height:'auto',display:'block',marginBottom:8}}>
          <line x1="30" y1="8" x2="30" y2="298" stroke="#1A2740" strokeWidth="1"/>
          <text x="26" y="14" fill="#6B7B95" fontSize="9" textAnchor="end" fontFamily="monospace">2022</text>
          <text x="26" y="90" fill="#6B7B95" fontSize="9" textAnchor="end" fontFamily="monospace">2023</text>
          <text x="26" y="168" fill="#6B7B95" fontSize="9" textAnchor="end" fontFamily="monospace">2024</text>
          <text x="26" y="235" fill="#6B7B95" fontSize="9" textAnchor="end" fontFamily="monospace">2025</text>
          <text x="26" y="300" fill="#6B7B95" fontSize="9" textAnchor="end" fontFamily="monospace">Now</text>
          <line x1="28" y1="10" x2="33" y2="10" stroke="#1A2740" strokeWidth="1"/>
          <line x1="28" y1="88" x2="33" y2="88" stroke="#1A2740" strokeWidth="1"/>
          <line x1="28" y1="166" x2="33" y2="166" stroke="#1A2740" strokeWidth="1"/>
          <line x1="28" y1="233" x2="33" y2="233" stroke="#1A2740" strokeWidth="1"/>
          <rect x="35" y="10" width="178" height="28" fill="rgba(242,169,59,0.18)" stroke="rgba(242,169,59,0.4)" strokeWidth="0.8" rx="3"/>
          <text x="42" y="22" fill="#F2A93B" fontSize="10" fontWeight="600" fontFamily="'IBM Plex Sans',sans-serif">Contraction</text>
          <text x="42" y="34" fill="#6B7B95" fontSize="9" fontFamily="monospace">2022.07 ~ 2022.12</text>
          <rect x="35" y="42" width="178" height="28" fill="rgba(93,207,176,0.12)" stroke="rgba(93,207,176,0.3)" strokeWidth="0.8" rx="3"/>
          <text x="42" y="54" fill="#5DCFB0" fontSize="10" fontWeight="600" fontFamily="'IBM Plex Sans',sans-serif">Early Cycle</text>
          <text x="42" y="66" fill="#6B7B95" fontSize="9" fontFamily="monospace">2022.12 ~ 2023.05</text>
          <rect x="35" y="74" width="178" height="28" fill="rgba(229,90,90,0.15)" stroke="rgba(229,90,90,0.35)" strokeWidth="0.8" rx="3"/>
          <text x="42" y="86" fill="#E55A5A" fontSize="10" fontWeight="600" fontFamily="'IBM Plex Sans',sans-serif">Peak</text>
          <text x="100" y="86" fill="#6B7B95" fontSize="9" fontFamily="monospace">2023.01 ~ 05</text>
          <rect x="35" y="106" width="178" height="28" fill="rgba(63,182,168,0.15)" stroke="rgba(63,182,168,0.35)" strokeWidth="0.8" rx="3"/>
          <text x="42" y="118" fill="#3FB6A8" fontSize="10" fontWeight="600" fontFamily="'IBM Plex Sans',sans-serif">Expansion</text>
          <text x="130" y="118" fill="#6B7B95" fontSize="9" fontFamily="monospace">2023.06~10</text>
          <rect x="35" y="138" width="178" height="28" fill="rgba(93,207,176,0.12)" stroke="rgba(93,207,176,0.3)" strokeWidth="0.8" rx="3"/>
          <text x="42" y="150" fill="#5DCFB0" fontSize="10" fontWeight="600" fontFamily="'IBM Plex Sans',sans-serif">Early Cycle</text>
          <text x="42" y="162" fill="#6B7B95" fontSize="9" fontFamily="monospace">2023.11 ~ 2024.04</text>
          <rect x="35" y="170" width="178" height="26" fill="rgba(242,169,59,0.18)" stroke="rgba(242,169,59,0.4)" strokeWidth="0.8" rx="3"/>
          <text x="42" y="182" fill="#F2A93B" fontSize="10" fontWeight="600" fontFamily="'IBM Plex Sans',sans-serif">Contraction</text>
          <text x="140" y="182" fill="#6B7B95" fontSize="9" fontFamily="monospace">2024.04~07</text>
          <rect x="35" y="200" width="178" height="26" fill="rgba(63,182,168,0.12)" stroke="rgba(63,182,168,0.28)" strokeWidth="0.8" rx="3"/>
          <text x="42" y="212" fill="#3FB6A8" fontSize="10" fontWeight="600" fontFamily="'IBM Plex Sans',sans-serif">Early Expansion</text>
          <text x="42" y="222" fill="#6B7B95" fontSize="9" fontFamily="monospace">2024.08 ~ 10</text>
          <rect x="35" y="230" width="178" height="60" fill="rgba(63,182,168,0.22)" stroke="#3FB6A8" strokeWidth="1.5" rx="4"/>
          <text x="42" y="247" fill="#3FB6A8" fontSize="11" fontWeight="600" fontFamily="'IBM Plex Sans',sans-serif">Expansion</text>
          <text x="42" y="262" fill="#6B7B95" fontSize="9" fontFamily="monospace">2024.11 ~ Now</text>
          <rect x="128" y="240" width="76" height="22" fill="rgba(63,182,168,0.35)" rx="3"/>
          <text x="166" y="255" fill="#3FB6A8" fontSize="11" fontWeight="700" textAnchor="middle" fontFamily="'IBM Plex Sans',sans-serif">▶ NOW  68%</text>
          <line x1="30" y1="290" x2="213" y2="290" stroke="#3FB6A8" strokeWidth="1" strokeDasharray="3,2" opacity="0.5"/>
          <circle cx="30" cy="290" r="4" fill="#3FB6A8"/>
        </svg>
        {/* Legend */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,padding:'0 2px'}}>
          {[
            {bg:'rgba(63,182,168,0.3)',bc:'rgba(63,182,168,0.5)',label:'Expansion'},
            {bg:'rgba(229,90,90,0.2)', bc:'rgba(229,90,90,0.4)', label:'Peak'},
            {bg:'rgba(242,169,59,0.2)',bc:'rgba(242,169,59,0.4)',label:'Contraction'},
            {bg:'rgba(93,207,176,0.15)',bc:'rgba(93,207,176,0.3)',label:'Early'},
          ].map(l=>(
            <div key={l.label} style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:V.text3,fontFamily:V.ui}}>
              <span style={{width:8,height:8,borderRadius:2,background:l.bg,border:`1px solid ${l.bc}`,flexShrink:0,display:'inline-block'}}/>
              {l.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── RIGHT PANEL ──────────────────────────────────────────────────────────────
function RightPanel({ onTab, aiRegime, concentrationTop5, ewSpread, aiBucketReturn, onViewDataLab, dataStatusCounts }:
  { onTab:(t:CenterTab)=>void; aiRegime?: InterpAIRegime; concentrationTop5?: number | null; ewSpread?: number | null; aiBucketReturn?: string; onViewDataLab?: () => void; dataStatusCounts?: { live: number; cache: number; static: number; pending: number } }) {
  const [rpDecay, setRpDecay] = useState<{decayPct: number|null; status: SoxlDecayStatus; bm: string}>({decayPct: null, status: 'PENDING', bm: 'SOXX'})
  const [rpFlow,  setRpFlow]  = useState<{status: string; generatedAt: string}>({status: 'Pending', generatedAt: ''})
  useEffect(() => {
    fetch('/api/soxl-decay')
      .then(r => r.json())
      .then((d: SoxlDecayPayload) => setRpDecay({
        decayPct: d.summary?.currentDecayPct ?? null,
        status:   (d.summary?.status ?? 'PENDING') as SoxlDecayStatus,
        bm:       d.benchmark === 'PENDING' ? 'SOXX' : d.benchmark,
      }))
      .catch(() => {})
    fetch('/api/semiconductor-flow-proxy')
      .then(r => r.json())
      .then((d: SemiconductorFlowProxyPayload) => setRpFlow({
        status:      d.summary?.overallStatus ?? 'Pending',
        generatedAt: d.generatedAt ?? '',
      }))
      .catch(() => {})
  }, [])
  return (
    <div style={{background:V.bg2,borderLeft:`1px solid ${V.border}`,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* ① AI vs Legacy */}
      <div style={{padding:'12px 16px',borderBottom:'2px solid rgba(242,169,59,0.2)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
          <div style={{fontSize:10,letterSpacing:'0.12em',color:V.text3,fontWeight:600,fontFamily:V.ui}}>★ AI vs LEGACY LAYER</div>
          <span style={{fontSize:11,color:V.amber,letterSpacing:'0.08em',fontWeight:500,fontFamily:V.mono}}>BRIDGE 3</span>
        </div>
        {/* AI Compute */}
        <div style={{marginBottom:8}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:4}}>
            <span style={{fontSize:11,fontWeight:500,color:V.amber,fontFamily:V.ui}}>AI Compute</span>
            <span style={{fontSize:13,fontWeight:500,color:V.amber,fontFamily:V.mono}}>{aiBucketReturn ?? '+18.4%'}</span>
          </div>
          <div style={{height:7,background:V.bg3,borderRadius:3,overflow:'hidden'}}>
            <div style={{height:'100%',width:'75%',background:`linear-gradient(90deg,${V.amber},${V.gold})`,borderRadius:3}}/>
          </div>
          <div style={{fontSize:11,color:V.text3,marginTop:2,fontFamily:V.ui}}>NVDA · AVGO · AMD · ASML · TSM</div>
        </div>
        {/* Legacy */}
        <div style={{marginBottom:10}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:4}}>
            <span style={{fontSize:11,fontWeight:500,color:V.text2,fontFamily:V.ui}}>Legacy</span>
            <span style={{fontSize:13,fontWeight:500,color:V.red,fontFamily:V.mono}}>−3.8%</span>
          </div>
          <div style={{height:7,background:V.bg3,borderRadius:3,overflow:'hidden'}}>
            <div style={{height:'100%',width:'18%',background:V.red,borderRadius:3,opacity:0.7}}/>
          </div>
          <div style={{fontSize:11,color:V.text3,marginTop:2,fontFamily:V.ui}}>INTC · ON · NXP · MCHP · TXN</div>
        </div>
        {/* Spread */}
        <div style={{background:'rgba(242,169,59,0.08)',border:'1px solid rgba(242,169,59,0.2)',borderRadius:4,padding:8}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontSize:11,color:V.text3,fontFamily:V.ui}}>Layer Spread</div>
              <div style={{fontSize:11,color:V.text3,marginTop:1,fontFamily:V.ui}}>AI 단독 랠리 · 폭 좁음</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:20,fontWeight:500,color:V.amber,fontFamily:V.mono}}>{aiRegime ? `${Math.round(Math.abs(aiRegime.ai_infra.spread))}pp` : '22pp'}</div>
              <div style={{fontSize:11,color:V.gold,fontFamily:V.mono}}>↑ 전주 +4pp</div>
            </div>
          </div>
          <svg viewBox="0 0 160 28" style={{width:'100%',height:'auto',display:'block',marginTop:6}}>
            <line x1="0" y1="14" x2="160" y2="14" stroke="#223048" strokeWidth="0.5"/>
            <path d="M 0 20 C 20 19 40 18 60 17 C 80 16 100 14 120 11 C 135 9 148 7 160 6" stroke="#F2A93B" strokeWidth="1.5" fill="none"/>
            <circle cx="160" cy="6" r="2.5" fill="#F2A93B"/>
            <text x="2" y="26" fill="#6B7B95" fontSize="10" fontFamily="monospace">6W ago</text>
            <text x="158" y="26" fill="#F2A93B" fontSize="10" textAnchor="end" fontFamily="monospace">Now</text>
          </svg>
        </div>
        {/* Risk Pulse */}
        <div style={{display:'flex',alignItems:'center',gap:6,marginTop:8,padding:'6px 8px',background:'rgba(212,179,106,0.08)',borderRadius:4,borderLeft:`2px solid ${V.gold}`}}>
          <div style={{width:7,height:7,borderRadius:'50%',background:V.gold,flexShrink:0}}/>
          <span style={{fontSize:10,fontWeight:500,color:V.gold,fontFamily:V.mono}}>Caution</span>
          <span style={{fontSize:11,color:V.text3,marginLeft:'auto',fontFamily:V.ui}}>변동성 elevated</span>
        </div>
      </div>
      {/* ② Concentration */}
      <div style={{padding:'12px 16px',borderBottom:`1px solid ${V.border}`}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
          <div style={{fontSize:10,letterSpacing:'0.12em',color:V.text3,fontWeight:600,fontFamily:V.ui}}>SOXX 집중도</div>
        </div>
        <svg viewBox="0 0 240 100" style={{width:'100%',height:'auto',display:'block'}}>
          <path d="M 30 88 A 80 80 0 0 1 210 88" stroke="#162238" strokeWidth="12" fill="none" strokeLinecap="round"/>
          <path d="M 30 88 A 80 80 0 0 1 120 12" stroke="#D4B36A" strokeWidth="12" fill="none" strokeLinecap="round"/>
          <line x1="120" y1="88" x2="120" y2="18" stroke="#D4B36A" strokeWidth="2.5" strokeLinecap="round"/>
          <circle cx="120" cy="88" r="5" fill="#D4B36A"/>
          <text x="120" y="70" textAnchor="middle" fill="#D4B36A" fontSize="22" fontWeight="500" fontFamily="monospace">{concentrationTop5!=null?`${Math.round(concentrationTop5)}%`:'36%'}</text>
          <text x="120" y="84" textAnchor="middle" fill="#6B7B95" fontSize="10" fontFamily="'IBM Plex Sans',sans-serif">Top 5 집중도</text>
          <text x="22" y="98" fill="#3FB6A8" fontSize="10" fontFamily="'IBM Plex Sans',sans-serif">분산</text>
          <text x="218" y="98" fill="#E55A5A" fontSize="10" textAnchor="end" fontFamily="'IBM Plex Sans',sans-serif">집중</text>
          <text x="40" y="35" fill="#3FB6A8" fontSize="10" fontFamily="monospace" opacity="0.7">20%</text>
          <text x="186" y="35" fill="#E55A5A" fontSize="10" textAnchor="end" fontFamily="monospace" opacity="0.7">55%</text>
        </svg>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 8px',background:V.bg3,borderRadius:4,fontSize:10,fontFamily:V.ui}}>
          <span style={{color:V.text3}}>EW vs Cap-Weight</span>
          <span style={{color:V.text2,fontFamily:V.mono,fontWeight:500}}>{ewSpread!=null?`${ewSpread>0?'+':''}${Math.round(ewSpread)}pt`:'−58pt'}</span>
          <span style={{color:V.text3}}>Cap 쏠림</span>
        </div>
      </div>
      {/* ③ SOXL mini */}
      <div style={{padding:'12px 16px',borderTop:'1px solid rgba(229,90,90,0.2)',borderBottom:`1px solid ${V.border}`}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
          <div style={{fontSize:10,letterSpacing:'0.12em',color:V.red,fontWeight:600,fontFamily:V.ui}}>SOXL ENVIRONMENT</div>
          <button onClick={()=>onTab('soxl')} style={{background:'transparent',border:'1px solid rgba(229,90,90,0.3)',color:V.red,fontSize:11,padding:'3px 8px',borderRadius:3,cursor:'pointer',letterSpacing:'0.06em',fontFamily:V.mono}}>상세 →</button>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
          <svg viewBox="0 0 80 52" style={{width:85,height:'auto'}}>
            <path d="M 6 46 A 34 34 0 0 1 74 46" stroke="#162238" strokeWidth="9" fill="none" strokeLinecap="round"/>
            <path d="M 6 46 A 34 34 0 0 1 40 14" stroke="#D4B36A" strokeWidth="9" fill="none" strokeLinecap="round"/>
            <line x1="40" y1="46" x2="40" y2="18" stroke="#D4B36A" strokeWidth="2.5"/>
            <circle cx="40" cy="46" r="4" fill="#D4B36A"/>
            <text x="40" y="42" textAnchor="middle" fill="#D4B36A" fontSize="10" fontWeight="600" fontFamily="'IBM Plex Sans',sans-serif">CAU</text>
          </svg>
          <div>
            <div style={{fontSize:12,fontWeight:500,color:V.gold,fontFamily:V.ui}}>CAUTION</div>
            <div style={{fontSize:11,color:V.text3,fontFamily:V.ui}}>무한매수 주의 구간</div>
          </div>
        </div>
        <div style={{marginBottom:8}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:4}}>
            <span style={{fontSize:11,color:V.text3,fontFamily:V.ui}}>90D 누적 감쇠</span>
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <span style={{fontSize:13,fontWeight:500,color:DECAY_STATUS_COLOR[rpDecay.status],fontFamily:V.mono}}>
                {rpDecay.decayPct !== null ? fmtDecay(rpDecay.decayPct) : '—'}
              </span>
              <span style={{fontSize:11,color:DECAY_STATUS_COLOR[rpDecay.status],fontFamily:V.ui}}>
                {DECAY_STATUS_LABEL[rpDecay.status]}
              </span>
            </div>
          </div>
          <svg viewBox="0 0 160 36" style={{width:'100%',height:'auto',display:'block'}}>
            <line x1="0" y1="18" x2="160" y2="18" stroke="#223048" strokeWidth="0.5"/>
            <path d="M 0 28 C 30 26 60 22 90 17 C 115 13 140 9 160 7" stroke="#3FB6A8" strokeWidth="1.2" fill="none" strokeDasharray="4,2" opacity="0.6"/>
            <path d="M 0 28 C 30 27 60 24 90 20 C 115 17 140 14 160 12" stroke="#E55A5A" strokeWidth="1.8" fill="none"/>
            <path d="M 0 28 C 30 26 60 22 90 17 C 115 13 140 9 160 7 L 160 12 C 140 14 115 17 90 20 C 60 24 30 27 0 28Z" fill="rgba(229,90,90,0.1)"/>
            <text x="2" y="35" fill="#6B7B95" fontSize="10" fontFamily="monospace">D-90</text>
            <text x="158" y="35" fill="#E55A5A" fontSize="10" textAnchor="end" fontFamily="monospace">Today</text>
          </svg>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:10,padding:'5px 8px',background:V.bg3,borderRadius:4,fontFamily:V.ui}}>
          <span style={{color:V.text3}}>Layer Spread</span>
          <span style={{color:V.amber,fontWeight:500,fontFamily:V.mono}}>22pp</span>
          <span style={{color:V.text3}}>폭 좁음</span>
        </div>
      </div>
      {/* ④ Quick Nav */}
      <div style={{padding:'12px 16px',flex:1,display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
        <div style={{fontSize:10,letterSpacing:'0.12em',color:V.text3,fontWeight:600,marginBottom:8,fontFamily:V.ui}}>빠른 이동</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:5}}>
          {[
            {label:'MAP',   t:'map'  as CenterTab,bg:'rgba(63,182,168,0.1)', bc:'rgba(63,182,168,0.25)',c:V.teal},
            {label:'CYCLE', t:'cycle'as CenterTab,bg:'rgba(242,169,59,0.08)',bc:'rgba(242,169,59,0.2)', c:V.amber},
            {label:'★SOXL', t:'soxl' as CenterTab,bg:'rgba(229,90,90,0.1)', bc:'rgba(229,90,90,0.3)',  c:V.red},
          ].map(b=>(
            <button key={b.label} onClick={()=>onTab(b.t)} style={{background:b.bg,border:`1px solid ${b.bc}`,color:b.c,fontSize:11,padding:'6px 0',borderRadius:3,cursor:'pointer',letterSpacing:'0.06em',fontWeight:500,fontFamily:V.mono}}>{b.label}</button>
          ))}
        </div>
        <div style={{fontSize:11,color:V.text3,marginTop:6,textAlign:'center',lineHeight:1.4,fontFamily:V.ui}}>
          데이터 기준: SOXX 2026-04-29<br/>
          <span style={{color:V.teal}}>● CONNECTED</span>
        </div>
      </div>
      {/* DATA LAB summary card */}
      <div style={{padding:'12px 16px',borderTop:`1px solid ${V.border}`,marginTop:'auto'}}>
        <div style={{fontSize:10,letterSpacing:'0.12em',color:V.text3,fontWeight:600,marginBottom:8,fontFamily:V.ui}}>DATA LAB 연결 상태</div>
        <div style={{display:'flex',flexDirection:'column',gap:5}}>
          {[
            { label: 'SOXX Structure', val: 'Broad',       vc: V.teal  },
            { label: 'Bucket Coverage',val: '~48%',        vc: V.text2 },
            { label: 'Flow Proxy',     val: rpFlow.status, vc: FLOW_STATUS_COLOR[rpFlow.status as keyof typeof FLOW_STATUS_COLOR] ?? V.text3 },
            { label: 'Contribution',   val: 'Unavailable', vc: V.text3 },
          ].map(r => (
            <div key={r.label} style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
              <span style={{fontSize:11,color:V.text3,fontFamily:V.ui}}>{r.label}</span>
              <span style={{fontSize:11,fontWeight:500,color:r.vc,fontFamily:V.mono}}>{r.val}</span>
            </div>
          ))}
          <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:2}}>
            {([
              [`${dataStatusCounts?.live    ?? 4} LIVE`,    '#22c55e'],
              [`${dataStatusCounts?.cache   ?? 1} CACHE`,   '#22d3ee'],
              [`${dataStatusCounts?.static  ?? 3} STATIC`,  '#fbbf24'],
              [`${dataStatusCounts?.pending ?? 3} PENDING`, '#737880'],
            ] as [string, string][]).map(([l,c])=>(
              <span key={l} style={{fontSize:10,padding:'1px 5px',border:`1px solid ${c}33`,color:c,borderRadius:2,fontFamily:'monospace'}}>{l}</span>
            ))}
          </div>
        </div>
        {onViewDataLab && (
          <button onClick={onViewDataLab}
            style={{marginTop:8,width:'100%',padding:'6px 0',background:'rgba(34,211,238,0.07)',border:'1px solid rgba(34,211,238,0.25)',color:V.teal,fontSize:11,borderRadius:3,cursor:'pointer',letterSpacing:'0.06em',fontWeight:600,fontFamily:V.mono}}>
            전체 보기 → DATA LAB
          </button>
        )}
      </div>
    </div>
  )
}

// ── HISTORY CARD ─────────────────────────────────────────────────────────────
function HistoryCard({ histTab, setHistTab }: { histTab:HistTab; setHistTab:(t:HistTab)=>void }) {
  const thS:React.CSSProperties = {padding:'6px 8px',fontSize:10,letterSpacing:'0.10em',color:V.text3,fontWeight:600,textAlign:'left',background:V.bg2,fontFamily:V.ui,borderBottom:`1px solid ${V.border}`}
  const tdS:React.CSSProperties = {padding:'6px 8px',fontSize:11,color:V.text,borderBottom:`1px solid ${V.brd2}`,fontFamily:V.ui}
  const events = [
    {date:'2026-05-06',type:'📊 FUNDAMENTAL',tc:V.teal,event:'TSMC 4월 매출 NT$260B 발표 — YoY +39% 확인',basis:'TSMC IR · 10일 발표',impact:'사이클 강세 유지',ic:V.teal},
    {date:'2026-04-30',type:'⚠️ RISK FLAG',  tc:V.red, event:'SOXL 감쇠 −4.7% — 경계 수준 진입',        basis:'Layer Spread 22pp · 변동성 elevated',impact:'무한매수 주의',ic:V.gold},
    {date:'2026-04-23',type:'💰 AI CAPITAL', tc:V.amber,event:'Hyperscaler Q1 CapEx 합산 $78.4B — YoY +68%',basis:'MSFT·AMZN·GOOG·META 실적',impact:'AI 수요 가속',ic:V.teal},
    {date:'2026-04-01',type:'⚡ CYCLE SHIFT',tc:V.mint,event:'Book-to-Bill 1.08 → 1.18 상승 — 수주 모멘텀 강화',basis:'SEMI.org 3월 발표',impact:'장비 투자 가속',ic:V.teal},
    {date:'2026-03-15',type:'💰 AI CAPITAL', tc:V.amber,event:'NVDA Q4 DC 매출 $35.6B · GB200 수요 타이트 코멘트',basis:'NVDA 분기 실적',impact:'HBM 공급 병목',ic:V.teal},
    {date:'2026-02-10',type:'📊 FUNDAMENTAL',tc:V.teal,event:'TSMC 1월 매출 YoY +34% — 3개월 연속 가속',basis:'TSMC IR',impact:'Cycle Score +7pt',ic:V.teal},
    {date:'2025-12-20',type:'⚡ CYCLE SHIFT',tc:V.mint,event:'사이클 Early Cycle → Expansion 전환 확정',basis:'TSMC YoY +28% · B2B 1.08 진입',impact:'Stage 변경',ic:V.teal},
  ]
  const snapshots = [
    {month:'2026-05',stage:'Expansion',     sc:V.teal, score:'68',  tsmc:'+39%',capex:'Accelerating',capC:V.amber,spread:'22pp',note:'AI 단독 랠리',  current:true},
    {month:'2026-04',stage:'Expansion',     sc:V.teal, score:'64',  tsmc:'+35%',capex:'Building',    capC:V.amber,spread:'18pp',note:'',              current:false},
    {month:'2026-03',stage:'Mid Expansion', sc:V.teal, score:'61',  tsmc:'+31%',capex:'Building',    capC:V.amber,spread:'14pp',note:'B2B 전환점',    current:false},
    {month:'2026-02',stage:'Early Expansion',sc:V.mint,score:'55',  tsmc:'+28%',capex:'Pre-build',   capC:V.text2,spread:'8pp', note:'',              current:false},
    {month:'2026-01',stage:'Early Expansion',sc:V.mint,score:'52',  tsmc:'+24%',capex:'Pre-build',   capC:V.text2,spread:'5pp', note:'',              current:false},
    {month:'2025-12',stage:'Early Cycle',   sc:V.mint, score:'48',  tsmc:'+22%',capex:'Pre-build',   capC:V.text3,spread:'3pp', note:'⚡ Stage 전환', current:false},
  ]
  return (
    <div style={{background:V.bg2,borderTop:`1px solid ${V.border}`,flexShrink:0}}>
      <div style={{display:'flex',borderBottom:`1px solid ${V.border}`}}>
        {(['event','snapshot'] as HistTab[]).map(t=>(
          <button key={t} onClick={()=>setHistTab(t)} style={{background:'transparent',border:'none',borderBottom:histTab===t?`2px solid ${V.teal}`:'2px solid transparent',color:histTab===t?V.teal:V.text3,fontSize:11,padding:'8px 16px',cursor:'pointer',letterSpacing:'0.10em',fontWeight:600,fontFamily:V.mono,marginBottom:-1}}>
            {t==='event'?'EVENT LOG':'CYCLE SNAPSHOT'}
          </button>
        ))}
      </div>
      <div style={{maxHeight:170,overflowY:'auto'}}>
        {histTab==='event' ? (
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr>
              <th style={{...thS,width:90}}>DATE</th>
              <th style={{...thS,width:110}}>TYPE</th>
              <th style={thS}>EVENT</th>
              <th style={{...thS,width:140}}>근거 지표</th>
              <th style={{...thS,width:80}}>IMPACT</th>
            </tr></thead>
            <tbody>
              {events.map(e=>(
                <tr key={e.date}>
                  <td style={{...tdS,color:V.text3,fontSize:10,fontFamily:V.mono}}>{e.date}</td>
                  <td style={tdS}><span style={{background:`rgba(${e.tc===V.teal?'63,182,168':e.tc===V.red?'229,90,90':e.tc===V.amber?'242,169,59':'93,207,176'},0.15)`,color:e.tc,fontSize:11,padding:'2px 7px',borderRadius:2,fontWeight:500,fontFamily:V.ui}}>{e.type}</span></td>
                  <td style={tdS}>{e.event}</td>
                  <td style={{...tdS,color:V.text3,fontSize:10,fontFamily:V.ui}}>{e.basis}</td>
                  <td style={{...tdS,color:e.ic,fontWeight:500,fontSize:10,fontFamily:V.ui}}>{e.impact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr>
              <th style={{...thS,width:70}}>월</th>
              <th style={{...thS,width:110}}>사이클 단계</th>
              <th style={{...thS,width:80}}>Cycle Score</th>
              <th style={{...thS,width:80}}>TSMC YoY</th>
              <th style={{...thS,width:100}}>CapEx 단계</th>
              <th style={{...thS,width:80}}>Layer Spread</th>
              <th style={thS}>비고</th>
            </tr></thead>
            <tbody>
              {snapshots.map(s=>(
                <tr key={s.month} style={s.current?{background:'rgba(63,182,168,0.05)'}:{}}>
                  <td style={{...tdS,color:s.current?V.teal:V.text2,fontWeight:s.current?500:400,fontFamily:V.mono}}>{s.month}</td>
                  <td style={{...tdS,color:s.sc,fontFamily:V.ui}}>{s.stage}</td>
                  <td style={{...tdS,color:s.current?V.teal:V.text2,fontFamily:V.mono,textAlign:'right'}}>{s.score}</td>
                  <td style={{...tdS,color:s.current?V.teal:V.text2,fontFamily:V.mono,textAlign:'right'}}>{s.tsmc}</td>
                  <td style={{...tdS,color:s.capC,fontFamily:V.ui}}>{s.capex}</td>
                  <td style={{...tdS,color:s.current?V.amber:V.text2,fontFamily:V.mono,textAlign:'right'}}>{s.spread}</td>
                  <td style={{...tdS,color:s.note.startsWith('⚡')?V.teal:V.text3,fontSize:10,fontFamily:V.ui}}>{s.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────
export default function AnalysisEngineCoreTab({ live, interpData, history, onViewDataLab, dataStatusCounts, fundamentals }: Props) {
  const [centerTab, setCenterTab] = useState<CenterTab>('map')
  const [histTab,   setHistTab]   = useState<HistTab>('event')
  const [kpiDecay,  setKpiDecay]  = useState<{decayPct: number|null; status: SoxlDecayStatus; bm: string}>({decayPct: null, status: 'PENDING', bm: 'SOXX'})
  useEffect(() => {
    fetch('/api/soxl-decay')
      .then(r => r.json())
      .then((d: SoxlDecayPayload) => setKpiDecay({
        decayPct: d.summary?.currentDecayPct ?? null,
        status:   (d.summary?.status ?? 'PENDING') as SoxlDecayStatus,
        bm:       d.benchmark === 'PENDING' ? 'SOXX' : d.benchmark,
      }))
      .catch(() => {})
  }, [])

  const kpis      = live?.kpis
  const ar        = interpData?.ai_regime
  const score     = kpis?.engine_score
  const stage     = kpis?.stage
  const progress  = kpis?.cycle_position
  const aiBucket  = live?.buckets?.find(b => b.name.toLowerCase().includes('ai'))
  const aiBucketReturn = aiBucket ? (aiBucket.up ? `+${aiBucket.m6}` : aiBucket.m6) : undefined
  const kpiTsmcYoy    = getMetricDisplay(fundamentals?.l1Fundamentals?.tsmcRevenueYoY, '+39%')
  const kpiCapex      = getMetricDisplay(fundamentals?.l2CapitalFlow?.hyperscalerCapex, '$78.4B')
  const kpiReflection = getMetricDisplay(fundamentals?.l3MarketConfirmation?.soxxReflection, '0.92')

  const tabDesc: Record<CenterTab,string> = {
    map:     '버킷 현황 한눈에 · 사이클 단계 · 자본 흐름 · AI Regime',
    cycle:   '3-Layer 실물 → AI자본 → 시장 반영도 분석',
    perform: '멀티 타임프레임 버킷 성과 비교',
    health:  'Breadth · Momentum · Participation 내부 건강도',
    soxl:    'SOXL 무한매수 환경 · 감쇠 추적 · Layer Spread',
  }

  return (
    <div style={{background:V.bg,color:V.text,fontFamily:V.ui,display:'flex',flexDirection:'column',height:'100%',overflow:'hidden',paddingLeft:16,paddingRight:16,width:'90%',margin:'0 auto'}}>
      {/* KPI Strip */}
      <div style={{display:'flex',borderBottom:`1px solid ${V.border}`,flexShrink:0}}>
        {[
          {label:'CYCLE SCORE',       val:String(score??68),  sub:`${stage??'Expansion'} · Fundamental 기반`,    vc:V.teal},
          {label:'TSMC YoY',          val:kpiTsmcYoy,         sub:'2026.04 · 실물 선행 신호',                    vc:V.teal},
          {label:'HYPERSCALER CAPEX', val:kpiCapex,           sub:"Q1'26 합산 · YoY +68%",                      vc:V.amber},
          {label:'SOXX 반영도',        val:kpiReflection,     sub:'실물 대비 약간 선행',                        vc:V.gold},
          {label:'SOXL ENVIRONMENT',  val:ar ? regimeDisplay(ar.regime_label).split(' ')[0] : DECAY_STATUS_LABEL[kpiDecay.status], sub:ar?`${ar.ai_infra.spread.toFixed(1)}pp spread`:`${kpiDecay.decayPct !== null ? fmtDecay(kpiDecay.decayPct) : '—'} 3M decay · ${kpiDecay.bm} 기준`, vc:DECAY_STATUS_COLOR[kpiDecay.status]},
        ].map(k=>(
          <div key={k.label} style={{flex:1,padding:'10px 18px',borderRight:`1px solid ${V.border}`}}>
            <div style={{fontSize:10,letterSpacing:'0.12em',color:V.text3,marginBottom:4,fontWeight:600,fontFamily:V.ui}}>{k.label}</div>
            <div style={{fontSize:28,fontWeight:500,color:k.vc,fontFamily:V.mono,lineHeight:1}}>{k.val}</div>
            <div style={{fontSize:12,color:V.text3,marginTop:4,fontFamily:V.ui}}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Main 3-column layout */}
      <div style={{flex:1,minHeight:0,display:'flex',flexDirection:'column'}}>
        <div style={{flex:1,minHeight:0,display:'grid',gridTemplateColumns:'234px 1fr 252px'}}>
          <LeftPanel stage={stage} progress={progress}/>

          {/* Center Panel */}
          <div style={{display:'flex',flexDirection:'column',overflow:'hidden'}}>
            {/* Tab bar */}
            <div style={{display:'flex',alignItems:'center',borderBottom:`1px solid ${V.border}`,flexShrink:0,background:V.bg2}}>
              {([['map','MAP'],['cycle','CYCLE VIEW'],['perform','PERFORMANCE'],['health','HEALTH'],['soxl','★ SOXL ENV']] as [CenterTab,string][]).map(([t,label])=>(
                <button key={t} onClick={()=>setCenterTab(t)} style={{background:'transparent',border:'none',borderBottom:centerTab===t?`2px solid ${V.teal}`:'2px solid transparent',color:centerTab===t?V.teal:V.text3,fontSize:11,padding:'10px 14px',cursor:'pointer',letterSpacing:'0.08em',fontWeight:600,fontFamily:V.mono,flexShrink:0,marginBottom:-1}}>
                  {label}
                </button>
              ))}
              <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'flex-end',paddingRight:12}}>
                <span style={{fontSize:11,color:V.text3,fontStyle:'italic',fontFamily:V.ui}}>{tabDesc[centerTab]}</span>
              </div>
            </div>
            {/* Tab content */}
            <div style={{flex:1,minHeight:0,overflow:'hidden',display:'flex',flexDirection:'column',background:V.bg}}>
              {centerTab==='map'     && <TabMap rsTable={live?.rs_table} aiRegime={ar}/>}
              {centerTab==='cycle'   && <TabCycle score={score} stage={stage} confidenceLabel={kpis?.confidence_label} fundamentals={fundamentals}/>}
              {centerTab==='perform' && <TabPerformance buckets={live?.buckets} aiRegime={ar}/>}
              {centerTab==='health'  && <TabHealth rsTable={live?.rs_table} kpis={kpis} breadthDetail={live?.breadth_detail} concentrationTop5={kpis?.leader_concentration_top5}/>}
              {centerTab==='soxl'    && <TabSoxlEnv onTab={setCenterTab}/>}
            </div>
          </div>

          <RightPanel onTab={setCenterTab} aiRegime={ar} concentrationTop5={kpis?.leader_concentration_top5} ewSpread={kpis?.equal_weight_vs_cap_spread} aiBucketReturn={aiBucketReturn} onViewDataLab={onViewDataLab} dataStatusCounts={dataStatusCounts}/>
        </div>

        {/* History Card */}
        <HistoryCard histTab={histTab} setHistTab={setHistTab}/>
      </div>
    </div>
  )
}
