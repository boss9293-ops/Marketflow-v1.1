'use client'
// 반도체 사이클 엔진 — 3-Layer Pyramid 기반 분석 탭 (레퍼런스 HTML 직접 포팅)

import { useState } from 'react'

const V = {
  bg:'#0C1628', bg2:'#111E32', bg3:'#162238', border:'#223048', brd2:'#1A2740',
  teal:'#3FB6A8', amber:'#F2A93B', mint:'#5DCFB0', red:'#E55A5A', gold:'#D4B36A',
  blue:'#4A9EE0', text:'#E8F0F8', text2:'#B8C8DC', text3:'#6B7B95',
  ui:"'IBM Plex Sans', sans-serif", mono:"'IBM Plex Mono', monospace",
}

type CenterTab = 'map'|'cycle'|'perform'|'health'|'soxl'
type HistTab   = 'event'|'snapshot'
interface Props { live?: unknown; interpData?: unknown; history?: unknown }

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

function RegimeBars() {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:6}}>
      {[
        {name:'AI Infra', w:'78%',color:V.teal, sig:'IN LINE +4.5pp'},
        {name:'Memory',  w:'55%',color:V.amber,sig:'NOT CONF −3.6pp'},
        {name:'Foundry', w:'32%',color:V.gold, sig:'LAGGING −14.9pp'},
        {name:'Equipment',w:'18%',color:V.red, sig:'LAG AI DLY −16.5pp'},
        {name:'Rotation',w:'90%',color:V.mint, sig:'BROAD +0.0pp'},
      ].map(r=>(
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
function TabMap() {
  const buckets=[
    {color:V.teal, name:'AI Compute',        drivers:'NVDA / AVGO / AMD · Internal Driver',         m1:'+3.6%',vs:'+0.0%',vsC:V.text2},
    {color:V.amber,name:'Memory / HBM',      drivers:'MU · Internal Driver',                         m1:'+2.6%',vs:'−1.0%',vsC:V.red},
    {color:V.red,  name:'Foundry / Packaging',drivers:'TSM · Internal Driver',                        m1:'+1.6%',vs:'−2.0%',vsC:V.red},
    {color:V.gold, name:'Equipment',          drivers:'AMAT / ASML / LRCX / KLAC · Internal Driver', m1:'+1.6%',vs:'−2.0%',vsC:V.red},
  ]
  const flow=[
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
            <span style={{fontSize:13,fontWeight:500,color:V.teal,fontFamily:V.ui}}>Broad Recovery</span>
            <span style={{fontSize:11,color:V.teal,border:'1px solid rgba(63,182,168,0.3)',padding:'2px 6px',borderRadius:2,fontFamily:V.mono}}>HIGH CONF</span>
            <span style={{fontSize:10,background:'rgba(63,182,168,0.15)',color:V.teal,padding:'2px 7px',borderRadius:3,letterSpacing:'0.06em',fontFamily:V.mono}}>LIVE</span>
          </div>
        </div>
        <RegimeBars/>
        <div style={{fontSize:11,color:V.text2,fontStyle:'italic',marginTop:8,padding:'6px 8px',background:V.bg3,borderRadius:4,fontFamily:V.ui}}>Participation is broad across all semiconductor segments with no dominant concentration, consistent with an early recovery structure.</div>
      </Card>
    </div>
  )
}

// ── TAB: CYCLE VIEW ──────────────────────────────────────────────────────────
function TabCycle() {
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
          <div style={{fontSize:38,fontWeight:500,color:V.teal,fontFamily:V.mono,lineHeight:1}}>68</div>
          <div style={{fontSize:11,color:V.teal,fontWeight:500,marginTop:4,fontFamily:V.ui}}>EXPANSION</div>
          <div style={{fontSize:11,color:V.text3,marginTop:2,fontFamily:V.ui}}>High Conf · Fundamental</div>
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
              <div style={{fontSize:11,color:V.text3,fontFamily:V.ui}}>업데이트: 매월 10일</div>
            </div>
            <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:8}}>
              <span style={{fontSize:28,fontWeight:500,color:V.teal,fontFamily:V.mono}}>NT$260B</span>
              <span style={{fontSize:14,color:V.teal,fontFamily:V.mono}}>YoY +39%</span>
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
          </div>
          {/* B2B */}
          <div style={{background:V.bg2,border:`1px solid ${V.border}`,borderRadius:5,padding:10}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:8}}>
              <div style={{fontSize:11,letterSpacing:'0.12em',color:V.text3,fontWeight:500,fontFamily:V.ui}}>BOOK-TO-BILL RATIO</div>
              <div style={{fontSize:11,color:V.text3,fontFamily:V.ui}}>SEMI.org · 월 1회</div>
            </div>
            <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:8}}>
              <span style={{fontSize:28,fontWeight:500,color:V.amber,fontFamily:V.mono}}>1.18</span>
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
          </div>
          {/* SIA */}
          <div style={{background:V.bg2,border:`1px solid ${V.border}`,borderRadius:5,padding:10}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:8}}>
              <div style={{fontSize:11,letterSpacing:'0.12em',color:V.text3,fontWeight:500,fontFamily:V.ui}}>SIA GLOBAL SEMI SALES</div>
              <div style={{fontSize:11,color:V.text3,fontFamily:V.ui}}>SIA · 월 1회</div>
            </div>
            <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:8}}>
              <span style={{fontSize:28,fontWeight:500,color:V.mint,fontFamily:V.mono}}>$56.1B</span>
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
          </div>
          {/* NVDA */}
          <div style={{background:V.bg2,border:`1px solid ${V.border}`,borderRadius:5,padding:10}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:8}}>
              <div style={{fontSize:11,letterSpacing:'0.12em',color:V.text3,fontWeight:500,fontFamily:V.ui}}>NVDA DATA CENTER REVENUE</div>
              <div style={{fontSize:11,color:V.text3,fontFamily:V.ui}}>분기 실적</div>
            </div>
            <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:8}}>
              <span style={{fontSize:28,fontWeight:500,color:V.gold,fontFamily:V.mono}}>$35.6B</span>
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
            <div style={{fontSize:11,letterSpacing:'0.12em',color:V.text3,fontWeight:500,marginBottom:8,fontFamily:V.ui}}>HYPERSCALER CAPEX (합산)</div>
            <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:8}}>
              <span style={{fontSize:28,fontWeight:500,color:V.amber,fontFamily:V.mono}}>$78.4B</span>
              <span style={{fontSize:14,color:V.teal,fontFamily:V.mono}}>Q1&apos;26 · YoY +68%</span>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              {[{co:'MSFT',w:'82%',c:V.teal,v:'$21.4B'},{co:'AMZN',w:'90%',c:V.amber,v:'$24.3B'},{co:'GOOG',w:'68%',c:V.gold,v:'$17.2B'},{co:'META',w:'59%',c:V.mint,v:'$15.5B'}].map(x=>(
                <div key={x.co} style={{display:'grid',gridTemplateColumns:'40px 1fr 44px',alignItems:'center',gap:6}}>
                  <div style={{fontSize:11,color:V.text3,fontFamily:V.ui}}>{x.co}</div>
                  <div style={{height:5,background:V.bg3,borderRadius:2,overflow:'hidden'}}><div style={{height:'100%',width:x.w,background:x.c,borderRadius:2}}/></div>
                  <div style={{fontSize:11,color:V.text2,textAlign:'right',fontFamily:V.mono}}>{x.v}</div>
                </div>
              ))}
            </div>
            <div style={{fontSize:11,color:V.text3,marginTop:6,fontFamily:V.ui}}>AI 서버/GPU 수요의 직접 연료</div>
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
            <span style={{fontSize:13,fontWeight:500,color:V.gold,fontFamily:V.mono}}>0.92</span>
            <span style={{fontSize:11,color:V.text3,padding:'2px 6px',border:'1px solid rgba(107,123,149,0.3)',borderRadius:2,fontFamily:V.ui}}>실물 대비 약간 선행</span>
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
                  <span>저평가<br/>0.5↓</span><span style={{textAlign:'center',color:V.gold}}>현재 0.92<br/>약간 선행</span><span style={{textAlign:'right'}}>과열<br/>1.5↑</span>
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

// ── TAB: PERFORMANCE ─────────────────────────────────────────────────────────
function TabPerformance() {
  const perfRows = [
    {dot:V.blue, name:'SOXX Index',        d1:'+1.0%',d5:'+1.2%',m1:'+3.6%',m3:'+8.2%',m6:'+17.0%',vs:'—',dir:'Benchmark',dirC:V.teal},
    {dot:V.teal, name:'AI Infrastructure', d1:'+0.0%',d5:'+1.2%',m1:'+3.6%',m3:'+5.2%',m6:'+12.0%',vs:'+0.0%',dir:'Fading',dirC:V.amber},
    {dot:V.amber,name:'Memory / HBM',      d1:'+1.0%',d5:'+1.2%',m1:'+2.6%',m3:'+8.2%',m6:'+16.0%',vs:'−1.0%',dir:'Fading',dirC:V.amber},
    {dot:V.red,  name:'Foundry / Packaging',d1:'+1.0%',d5:'+0.2%',m1:'+1.6%',m3:'+3.2%',m6:'+10.0%',vs:'−2.0%',dir:'Fading',dirC:V.amber},
    {dot:V.gold, name:'Equipment',          d1:'+1.0%',d5:'+2.2%',m1:'+1.6%',m3:'+4.2%',m6:'+11.0%',vs:'−2.0%',dir:'Fading',dirC:V.amber},
  ]
  const tdS = (c:string):React.CSSProperties => ({padding:'7px 8px',fontSize:11,color:c,fontFamily:V.mono,textAlign:'right'})
  return (
    <div style={{padding:'12px 20px',overflowY:'auto',flex:1}}>
      <EduBox title="PERFORMANCE — 멀티 타임프레임 성과 비교">
        같은 버킷도 시간 단위에 따라 해석이 다릅니다. <strong>1D · 5D는 노이즈</strong>에 가깝고,
        <strong>1M · 3M · 6M</strong>이 실제 추세를 보여줍니다.
        VS SOXX 컬럼의 음수(−)는 해당 버킷이 SOXX 전체보다 약하다는 뜻입니다.
        Direction이 <strong>Fading</strong>이면 모멘텀이 꺾이고 있는 것, <strong>Sustaining</strong>이면 지속 중입니다.
      </EduBox>
      <SecTitle>BUCKET PERFORMANCE MATRIX</SecTitle>
      <Card>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontFamily:V.ui}}>
            <thead>
              <tr style={{borderBottom:`1px solid ${V.border}`}}>
                {['BUCKET','1D','5D','1M','3M','6M','VS SOXX 1M','DIRECTION'].map(h=>(
                  <th key={h} style={{padding:'6px 8px',fontSize:10,letterSpacing:'0.10em',color:V.text3,textAlign:h==='BUCKET'?'left':'right',fontWeight:600}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {perfRows.map(r=>(
                <tr key={r.name} style={{borderBottom:`1px solid ${V.brd2}`}}>
                  <td style={{padding:'7px 8px',fontSize:11}}>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <span style={{width:8,height:8,borderRadius:'50%',background:r.dot,flexShrink:0,display:'inline-block'}}/>
                      <span style={{color:V.text2,fontFamily:V.ui}}>{r.name}</span>
                    </div>
                  </td>
                  <td style={tdS(r.d1.startsWith('+')?V.teal:V.red)}>{r.d1}</td>
                  <td style={tdS(r.d5.startsWith('+')?V.teal:V.red)}>{r.d5}</td>
                  <td style={tdS(r.m1.startsWith('+')?V.teal:V.red)}>{r.m1}</td>
                  <td style={tdS(r.m3.startsWith('+')?V.teal:V.red)}>{r.m3}</td>
                  <td style={tdS(r.m6.startsWith('+')?V.teal:V.red)}>{r.m6}</td>
                  <td style={tdS(r.vs==='—'?V.text3:r.vs.startsWith('+')?V.teal:V.red)}>{r.vs}</td>
                  <td style={{padding:'7px 8px',fontSize:11,color:r.dirC,fontFamily:V.mono,textAlign:'right'}}>{r.dir}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <SecTitle style={{marginTop:10}}>AI REGIME LENS</SecTitle>
      <Card style={{marginBottom:0}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <div>
            <span style={{fontSize:13,fontWeight:500,color:V.teal,fontFamily:V.ui}}>Broad Recovery</span>
            <span style={{fontSize:11,color:V.teal,border:'1px solid rgba(63,182,168,0.3)',padding:'2px 6px',borderRadius:2,marginLeft:8,fontFamily:V.mono}}>HIGH CONF</span>
          </div>
          <span style={{fontSize:10,background:'rgba(63,182,168,0.15)',color:V.teal,padding:'2px 7px',borderRadius:3,letterSpacing:'0.06em',fontFamily:V.mono}}>LIVE</span>
        </div>
        <RegimeBars/>
        <div style={{fontSize:11,color:V.text2,fontStyle:'italic',marginTop:8,padding:'6px 8px',background:V.bg3,borderRadius:4,fontFamily:V.ui}}>Participation is broad across all semiconductor segments with no dominant concentration, consistent with an early recovery structure.</div>
      </Card>
    </div>
  )
}

// ── TAB: HEALTH ──────────────────────────────────────────────────────────────
function TabHealth() {
  const mRows = [
    {dot:V.blue, name:'SOXX Index',      ret:'+3.6%',vs:'—',dir:'Sustaining',dirC:V.teal,conc:'Low',concC:V.text3},
    {dot:V.teal, name:'AI Infrastructure',ret:'+3.6%',vs:'+0.0%',dir:'Fading',dirC:V.amber,conc:'Med · 36%',concC:V.gold},
    {dot:V.amber,name:'Memory',          ret:'+2.6%',vs:'−1.0%',dir:'Fading',dirC:V.amber,conc:'Low',concC:V.text3},
    {dot:V.red,  name:'Foundry',         ret:'+1.6%',vs:'−2.0%',dir:'Fading',dirC:V.amber,conc:'Low',concC:V.text3},
    {dot:V.gold, name:'Equipment',       ret:'+1.6%',vs:'−2.0%',dir:'Fading',dirC:V.amber,conc:'Low',concC:V.text3},
  ]
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
          {label:'BREADTH SCORE',  val:'100', state:'Healthy',     sub:'Confirms trend',   c:V.teal, bc:'rgba(63,182,168,0.3)'},
          {label:'MOMENTUM SIGNAL',val:'+31', state:'Sustaining',  sub:'Stable regime',    c:V.amber,bc:'rgba(242,169,59,0.3)'},
          {label:'LEADERSHIP SIGNAL',val:'+14',state:'Broad Partic.',sub:'Conf 91 · High',c:V.mint, bc:'rgba(93,207,176,0.3)'},
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
            <div style={{height:'100%',width:'100%',background:V.teal,borderRadius:6}}/>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:11,fontFamily:V.mono}}>
            <span style={{color:V.teal}}>Adv 100%</span><span style={{color:V.text3}}>Net +100</span><span style={{color:V.red}}>Dec 0%</span>
          </div>
        </div>
        <div style={{fontSize:10,color:V.text2,fontFamily:V.ui}}>% above 20MA: <span style={{color:V.teal,fontWeight:500}}>100%</span> · <span style={{color:V.teal}}>BULLISH</span></div>
        <div style={{marginTop:6,fontSize:10,fontWeight:600,letterSpacing:'0.10em',color:V.teal,padding:'4px 8px',background:'rgba(63,182,168,0.08)',border:'1px solid rgba(63,182,168,0.2)',borderRadius:4,display:'inline-block',fontFamily:V.mono}}>NO CONFLICT</div>
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
    </div>
  )
}

// ── TAB: SOXL ENV ────────────────────────────────────────────────────────────
function TabSoxlEnv({ onTab }: { onTab:(t:CenterTab)=>void }) {
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
      {/* Bridge 5 */}
      <Card style={{border:'1px solid rgba(229,90,90,0.3)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <SecTitle style={{margin:0}}>★ BRIDGE 5 — SOXL 변동성 감쇠 추적기</SecTitle>
          <span style={{fontSize:10,background:'rgba(229,90,90,0.12)',color:V.red,padding:'2px 7px',borderRadius:3,letterSpacing:'0.06em',fontFamily:V.mono}}>90D누적</span>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:10}}>
          {[
            {label:'이론 SOXL (SOXX×3)',val:'+54.0%',vc:V.teal, sub:'90D 기준',bc:''},
            {label:'실제 SOXL',          val:'+49.3%',vc:V.red,  sub:'감쇠 발생',bc:'rgba(229,90,90,0.3)'},
            {label:'누적 감쇠',           val:'−4.7%', vc:V.red,  sub:'변동성 비용',bc:'rgba(229,90,90,0.25)',bg:'rgba(229,90,90,0.06)'},
          ].map(s=>(
            <div key={s.label} style={{background:s.bg||V.bg3,border:`1px solid ${s.bc||V.border}`,borderRadius:5,padding:'8px 10px',textAlign:'center'}}>
              <div style={{fontSize:10,letterSpacing:'0.10em',color:V.text3,marginBottom:4,fontFamily:V.ui}}>{s.label}</div>
              <div style={{fontSize:22,fontWeight:500,color:s.vc,fontFamily:V.mono}}>{s.val}</div>
              <div style={{fontSize:11,color:s.vc,marginTop:2,fontFamily:V.ui}}>{s.sub}</div>
            </div>
          ))}
        </div>
        <div style={{fontSize:11,color:V.text3,marginBottom:6,fontFamily:V.ui}}>이론치 vs 실제 SOXL 90D 비교</div>
        <svg viewBox="0 0 640 120" style={{width:'100%',height:'auto',display:'block'}}>
          <line x1="40" y1="60" x2="630" y2="60" stroke="#1A2740" strokeWidth="0.5"/>
          <line x1="40" y1="30" x2="630" y2="30" stroke="#1A2740" strokeWidth="0.5"/>
          <line x1="40" y1="90" x2="630" y2="90" stroke="#1A2740" strokeWidth="0.5"/>
          <text x="36" y="33" fill="#A8BAD0" fontSize="10" textAnchor="end" fontFamily="monospace">+60%</text>
          <text x="36" y="63" fill="#A8BAD0" fontSize="10" textAnchor="end" fontFamily="monospace">+30%</text>
          <text x="36" y="93" fill="#A8BAD0" fontSize="10" textAnchor="end" fontFamily="monospace">0%</text>
          <path d="M40,90 C120,82 200,70 280,58 C360,46 440,36 530,26 C570,22 605,18 630,15" stroke="#3FB6A8" strokeWidth="1.8" fill="none" strokeDasharray="5,3"/>
          <path d="M40,90 C120,83 200,72 280,62 C360,52 440,44 530,35 C570,32 605,29 630,27" stroke="#E55A5A" strokeWidth="2.2" fill="none"/>
          <path d="M40,90 C120,82 200,70 280,58 C360,46 440,36 530,26 C570,22 605,18 630,15 L630,27 C605,29 570,32 530,35 C440,44 360,52 280,62 C200,72 120,83 40,90Z" fill="rgba(229,90,90,0.08)"/>
          <text x="634" y="17" fill="#3FB6A8" fontSize="10" fontFamily="monospace">이론</text>
          <text x="634" y="29" fill="#E55A5A" fontSize="10" fontWeight="500" fontFamily="monospace">실제</text>
          <text x="42" y="112" fill="#B8C8DC" fontSize="10" fontFamily="monospace">D-90</text>
          <text x="630" y="112" fill="#B8C8DC" fontSize="10" textAnchor="end" fontFamily="monospace">Today</text>
        </svg>
        <div style={{marginTop:8,fontSize:10,color:V.text3,lineHeight:1.6,background:V.bg3,padding:'8px 10px',borderRadius:4,fontFamily:V.ui}}>
          <span style={{color:V.gold,fontWeight:500}}>해석:</span> 고변동성 구간에서 레버리지 감쇠가 누적됩니다. 현재 −4.7% 감쇠는 <span style={{color:V.gold}}>주의 수준</span>. 무한매수 시 포지션 크기 조절 권고. 추세가 지속될 경우 이론치 대비 실제 수익 격차는 더 확대됩니다.
        </div>
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
function LeftPanel() {
  return (
    <div style={{background:V.bg2,borderRight:`1px solid ${V.border}`,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Cycle Position */}
      <div style={{padding:'12px 16px',borderBottom:`1px solid ${V.border}`}}>
        <div style={{fontSize:10,letterSpacing:'0.14em',color:V.text3,fontWeight:600,marginBottom:10,fontFamily:V.ui}}>CYCLE POSITION</div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
          <svg width="120" height="70" viewBox="0 0 120 70">
            <path d="M 10 65 A 50 50 0 0 1 110 65" stroke="#1A2740" strokeWidth="8" fill="none" strokeLinecap="round"/>
            <path d="M 10 65 A 50 50 0 0 1 87 28" stroke="#3FB6A8" strokeWidth="8" fill="none" strokeLinecap="round"/>
            <text x="60" y="58" textAnchor="middle" fill="#3FB6A8" fontSize="18" fontWeight="500" fontFamily="monospace">71%</text>
            <circle cx="87" cy="28" r="5" fill="#F2A93B"/>
          </svg>
          <div style={{fontSize:12,fontWeight:600,color:V.teal,letterSpacing:'0.10em',marginTop:4,fontFamily:V.ui}}>MID EXPANSION</div>
          <div style={{fontSize:11,color:V.text3,fontFamily:V.ui}}>Cycle Progress</div>
        </div>
        <div style={{height:8,background:V.bg3,borderRadius:4,overflow:'hidden',marginTop:8}}>
          <div style={{height:'100%',width:'71%',background:`linear-gradient(90deg,${V.teal},${V.mint})`,borderRadius:4,display:'flex',alignItems:'center',justifyContent:'flex-end',paddingRight:4}}>
            <span style={{fontSize:9,color:V.bg,fontWeight:600,fontFamily:V.mono}}>Expansion 100%</span>
          </div>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:5,fontSize:11,color:V.text3,fontFamily:V.ui}}>
          <span>Early</span><span style={{color:V.teal,fontWeight:500}}>Mid</span><span>Late</span><span>Peak</span>
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
function RightPanel({ onTab }: { onTab:(t:CenterTab)=>void }) {
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
            <span style={{fontSize:13,fontWeight:500,color:V.amber,fontFamily:V.mono}}>+18.4%</span>
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
              <div style={{fontSize:20,fontWeight:500,color:V.amber,fontFamily:V.mono}}>22pp</div>
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
          <text x="120" y="70" textAnchor="middle" fill="#D4B36A" fontSize="22" fontWeight="500" fontFamily="monospace">36%</text>
          <text x="120" y="84" textAnchor="middle" fill="#6B7B95" fontSize="10" fontFamily="'IBM Plex Sans',sans-serif">Top 5 집중도</text>
          <text x="22" y="98" fill="#3FB6A8" fontSize="10" fontFamily="'IBM Plex Sans',sans-serif">분산</text>
          <text x="218" y="98" fill="#E55A5A" fontSize="10" textAnchor="end" fontFamily="'IBM Plex Sans',sans-serif">집중</text>
          <text x="40" y="35" fill="#3FB6A8" fontSize="10" fontFamily="monospace" opacity="0.7">20%</text>
          <text x="186" y="35" fill="#E55A5A" fontSize="10" textAnchor="end" fontFamily="monospace" opacity="0.7">55%</text>
        </svg>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 8px',background:V.bg3,borderRadius:4,fontSize:10,fontFamily:V.ui}}>
          <span style={{color:V.text3}}>EW vs Cap-Weight</span>
          <span style={{color:V.text2,fontFamily:V.mono,fontWeight:500}}>−58pt</span>
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
              <span style={{fontSize:13,fontWeight:500,color:V.red,fontFamily:V.mono}}>−4.7%</span>
              <span style={{fontSize:11,color:V.red,fontFamily:V.ui}}>▲ 악화 중</span>
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
export default function AnalysisEngineCoreTab({ live, interpData, history }: Props) {
  const [centerTab, setCenterTab] = useState<CenterTab>('map')
  const [histTab,   setHistTab]   = useState<HistTab>('event')

  const tabDesc: Record<CenterTab,string> = {
    map:     '버킷 현황 한눈에 · 사이클 단계 · 자본 흐름 · AI Regime',
    cycle:   '3-Layer 실물 → AI자본 → 시장 반영도 분석',
    perform: '멀티 타임프레임 버킷 성과 비교',
    health:  'Breadth · Momentum · Participation 내부 건강도',
    soxl:    'SOXL 무한매수 환경 · 감쇠 추적 · Layer Spread',
  }

  return (
    <div style={{background:V.bg,color:V.text,fontFamily:V.ui,display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      {/* KPI Strip */}
      <div style={{display:'flex',borderBottom:`1px solid ${V.border}`,flexShrink:0}}>
        {[
          {label:'CYCLE SCORE',       val:'68',       sub:'Expansion · Fundamental 기반',    vc:V.teal},
          {label:'TSMC YoY',          val:'+39%',     sub:'2026.04 · 실물 선행 신호',         vc:V.teal},
          {label:'HYPERSCALER CAPEX', val:'$78.4B',   sub:"Q1'26 합산 · YoY +68%",           vc:V.amber},
          {label:'SOXX 반영도',        val:'0.92',     sub:'실물 대비 약간 선행',              vc:V.gold},
          {label:'SOXL ENVIRONMENT',  val:'Caution',  sub:'−4.7% decay · Layer spread 22pp', vc:V.gold},
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
          <LeftPanel/>

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
              {centerTab==='map'     && <TabMap/>}
              {centerTab==='cycle'   && <TabCycle/>}
              {centerTab==='perform' && <TabPerformance/>}
              {centerTab==='health'  && <TabHealth/>}
              {centerTab==='soxl'    && <TabSoxlEnv onTab={setCenterTab}/>}
            </div>
          </div>

          <RightPanel onTab={setCenterTab}/>
        </div>

        {/* History Card */}
        <HistoryCard histTab={histTab} setHistTab={setHistTab}/>
      </div>
    </div>
  )
}
