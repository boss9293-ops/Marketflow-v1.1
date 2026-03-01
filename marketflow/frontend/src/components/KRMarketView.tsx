'use client'

import { CSSProperties, useEffect, useMemo, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type KrTab = 'overview' | 'signals' | 'ai-history' | 'performance'
type ChartRange = '1M' | '3M' | '6M' | '12M'
type Lang = 'ko' | 'en'

interface KrSignal {
  ticker: string
  name?: string
  market?: string
  signal_date?: string
  score?: number
  final_score?: number
  vcp_ratio?: number
  volume?: number
  flow_score?: number
  buy_point?: number
  current_price?: number
  return_pct?: number
  action_openai?: string
  action_gemini?: string
}

interface KrSignalsResponse {
  signals?: KrSignal[]
  count?: number
  message?: string
}

interface KrGate {
  status?: string
  gate_score?: number
  recommendation?: string
  kospi?: { change_pct?: number }
  kosdaq?: { change_pct?: number }
  usd_krw?: number
}

interface KrAiProvider {
  model?: string
  rating?: string
  confidence?: number
  summary?: string
  summary_ko?: string
  summary_en?: string
  source?: string
}

interface KrAiSummary {
  summary?: string
  summary_ko?: string
  summary_en?: string
  providers?: {
    openai?: KrAiProvider
    gemini?: KrAiProvider
  }
}

interface KrAiHistoryPayload {
  summary?: string
  summary_ko?: string
  summary_en?: string
  signals?: KrSignal[]
}

interface KrCandle {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface KrChartResp {
  candles: KrCandle[]
}

interface KrPerf {
  win_rate?: number
  avg_return?: number
  total_positions?: number
}

interface KrCum {
  cumulative_return?: number
  winners?: number
  losers?: number
  equity_curve?: Array<{ date: string; equity: number }>
  benchmark_curve?: Array<{ date: string; equity: number }>
  kosdaq_benchmark_curve?: Array<{ date: string; equity: number }>
}

function panelStyle(): CSSProperties {
  return {
    background: 'linear-gradient(145deg, rgba(30,33,41,0.92), rgba(20,22,29,0.92))',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: '1rem',
  }
}

const asNum = (value?: number | null) => (value == null || Number.isNaN(value) ? 0 : value)
const fmtPct = (value?: number) => (value == null || Number.isNaN(value) ? '--' : `${value > 0 ? '+' : ''}${value.toFixed(2)}%`)
const fmtNum = (value?: number) => (value == null || Number.isNaN(value) ? '--' : value.toLocaleString())
const gateColor = (score?: number) => (asNum(score) >= 70 ? '#22c55e' : asNum(score) >= 40 ? '#f59e0b' : '#ef4444')
const actionStyle = (action?: string) => (action === 'BUY' ? { bg: 'rgba(34,197,94,0.18)', c: '#22c55e' } : action === 'HOLD' ? { bg: 'rgba(234,179,8,0.18)', c: '#eab308' } : { bg: 'rgba(59,130,246,0.18)', c: '#60a5fa' })

function Candles({ candles }: { candles: KrCandle[] }) {
  const w = 900
  const h = 300
  const l = 32
  const r = 70
  const t = 12
  const b = 30
  if (!candles.length) return <div style={{ color: '#8d95aa' }}>No candle data.</div>

  const min = Math.min(...candles.map((c) => c.low))
  const max = Math.max(...candles.map((c) => c.high))
  const gap = Math.max(1, max - min)
  const cw = w - l - r
  const ch = h - t - b
  const y = (p: number) => t + ((max - p) / gap) * ch
  const step = cw / candles.length
  const bw = Math.max(3, Math.min(10, step * 0.6))
  const last = candles[candles.length - 1]

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: '100%' }}>
      {[0, 1, 2, 3, 4, 5].map((g) => {
        const yy = t + (ch * g) / 5
        const p = max - (gap * g) / 5
        return (
          <g key={g}>
            <line x1={l} y1={yy} x2={w - r} y2={yy} stroke="rgba(255,255,255,0.06)" />
            <text x={w - r + 8} y={yy + 4} fill="#7f889d" fontSize="11">{p.toFixed(0)}</text>
          </g>
        )
      })}
      {candles.map((c, i) => {
        const x = l + step * i + step * 0.5
        const yo = y(c.open)
        const yc = y(c.close)
        const yh = y(c.high)
        const yl = y(c.low)
        const up = c.close >= c.open
        const color = up ? '#f43f5e' : '#3b82f6'
        const top = Math.min(yo, yc)
        const bh = Math.max(1.5, Math.abs(yc - yo))
        return (
          <g key={`${c.date}-${i}`}>
            <line x1={x} y1={yh} x2={x} y2={yl} stroke={color} />
            <rect x={x - bw / 2} y={top} width={bw} height={bh} fill={color} rx={1} />
          </g>
        )
      })}
      <line x1={l} y1={y(last.close)} x2={w - r} y2={y(last.close)} stroke="rgba(239,68,68,0.45)" strokeDasharray="4 4" />
    </svg>
  )
}

function langText(ko: string, en: string, lang: Lang) {
  return lang === 'ko' ? ko : en
}

export default function KRMarketView({ initialTab = 'overview' }: { initialTab?: KrTab }) {
  const [tab, setTab] = useState<KrTab>(initialTab)
  const [range, setRange] = useState<ChartRange>('3M')
  const [loading, setLoading] = useState(true)
  const [gate, setGate] = useState<KrGate | null>(null)
  const [signals, setSignals] = useState<KrSignalsResponse | null>(null)
  const [aiSummary, setAiSummary] = useState<KrAiSummary | null>(null)
  const [aiLang, setAiLang] = useState<Lang>('ko')
  const [selectedTicker, setSelectedTicker] = useState('')
  const [selectedName, setSelectedName] = useState('')
  const [chartData, setChartData] = useState<KrCandle[]>([])
  const [historyDates, setHistoryDates] = useState<string[]>([])
  const [selectedHistoryDate, setSelectedHistoryDate] = useState('')
  const [historyPayload, setHistoryPayload] = useState<KrAiHistoryPayload | null>(null)
  const [aiHistoryLang, setAiHistoryLang] = useState<Lang>('ko')
  const [perf, setPerf] = useState<KrPerf | null>(null)
  const [cum, setCum] = useState<KrCum | null>(null)

  const loadMain = () => {
    setLoading(true)
    Promise.all([
      fetch('http://localhost:5001/api/kr/market-gate').then((r) => r.json()).catch(() => null),
      fetch('http://localhost:5001/api/kr/signals').then((r) => r.json()).catch(() => null),
      fetch('http://localhost:5001/api/kr/performance').then((r) => r.json()).catch(() => null),
      fetch('http://localhost:5001/api/kr/cumulative-return').then((r) => r.json()).catch(() => null),
    ]).then(([g, s, p, c]) => {
      setGate(g)
      setSignals(s)
      setPerf(p)
      setCum(c)
      const first = (s?.signals || [])[0]
      if (!first) {
        setLoading(false)
        return
      }
      selectTicker(first.ticker, first.name || first.ticker, false)
    })
  }

  const selectTicker = (ticker: string, name: string, moveToOverview = false) => {
    setSelectedTicker(ticker)
    setSelectedName(name)
    if (moveToOverview) setTab('overview')
    Promise.all([
      fetch(`http://localhost:5001/api/kr/stock-chart/${ticker}`).then((r) => r.json()).catch(() => ({ candles: [] })),
      fetch(`http://localhost:5001/api/kr/ai-summary/${ticker}`).then((r) => r.json()).catch(() => null),
    ]).then(([chartResp, aiResp]: [KrChartResp, KrAiSummary | null]) => {
      setChartData(chartResp?.candles || [])
      setAiSummary(aiResp)
      setLoading(false)
    })
  }

  const loadHistoryDates = () => {
    fetch('http://localhost:5001/api/kr/ai-history-dates')
      .then((r) => r.json())
      .then((d: { dates?: string[] }) => {
        const dates = d?.dates || []
        setHistoryDates(dates)
        if (dates.length > 0) setSelectedHistoryDate(dates[0])
      })
      .catch(() => setHistoryDates([]))
  }

  const loadHistoryByDate = (date: string) => {
    if (!date) return
    fetch(`http://localhost:5001/api/kr/ai-history/${date}`)
      .then((r) => r.json())
      .then((d: KrAiHistoryPayload) => setHistoryPayload(d))
      .catch(() => setHistoryPayload(null))
  }

  useEffect(() => { loadMain(); loadHistoryDates() }, [])
  useEffect(() => { setTab(initialTab) }, [initialTab])
  useEffect(() => { if (selectedHistoryDate) loadHistoryByDate(selectedHistoryDate) }, [selectedHistoryDate])

  const topSignals = useMemo(
    () => [...(signals?.signals || [])].sort((a, b) => asNum(b.final_score ?? b.score) - asNum(a.final_score ?? a.score)).slice(0, 20),
    [signals]
  )

  const filteredCandles = useMemo(() => {
    const map: Record<ChartRange, number> = { '1M': 21, '3M': 63, '6M': 126, '12M': 252 }
    return chartData.slice(Math.max(0, chartData.length - map[range]))
  }, [chartData, range])

  const curve = useMemo(() => {
    const eq = cum?.equity_curve || []
    const bm = new Map((cum?.benchmark_curve || []).map((x) => [x.date, x.equity]))
    const km = new Map((cum?.kosdaq_benchmark_curve || []).map((x) => [x.date, x.equity]))
    return eq.map((x) => ({ x: x.date.slice(5), equity: x.equity, benchmark: bm.get(x.date), kosdaqBenchmark: km.get(x.date) }))
  }, [cum])

  const pickProviderText = (provider?: KrAiProvider, lang: Lang = aiLang) => {
    if (!provider) return 'No analysis.'
    return lang === 'ko'
      ? (provider.summary_ko || provider.summary || provider.summary_en || 'No analysis.')
      : (provider.summary_en || provider.summary || provider.summary_ko || 'No analysis.')
  }

  const pickMainSummary = (lang: Lang = aiLang) => {
    if (!aiSummary) return '-'
    return lang === 'ko'
      ? (aiSummary.summary_ko || aiSummary.summary || aiSummary.summary_en || '-')
      : (aiSummary.summary_en || aiSummary.summary || aiSummary.summary_ko || '-')
  }

  const pickHistorySummary = () => {
    if (!historyPayload) return 'No history payload selected.'
    return aiHistoryLang === 'ko'
      ? (historyPayload.summary_ko || historyPayload.summary || historyPayload.summary_en || 'No history payload selected.')
      : (historyPayload.summary_en || historyPayload.summary || historyPayload.summary_ko || 'No history payload selected.')
  }

  if (loading) return <div style={{ color: '#9ca3af', padding: '2rem' }}>Loading KR Market...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', maxWidth: 1520 }}>
      <div style={{ ...panelStyle(), padding: '0.7rem 0.95rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: '#cfd6e8', fontSize: '0.86rem' }}>/ KR Market</div>
        <div style={{ minWidth: 280, width: '46%', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 999, padding: '0.42rem 0.75rem', color: '#8891a8', fontSize: '0.82rem' }}>Search markets, tickers, or commands...</div>
      </div>

      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
        {(['overview', 'signals', 'ai-history', 'performance'] as KrTab[]).map((x) => (
          <button
            key={x}
            onClick={() => setTab(x)}
            style={{
              border: tab === x ? '1px solid rgba(244,63,94,0.42)' : '1px solid rgba(255,255,255,0.12)',
              background: tab === x ? 'rgba(244,63,94,0.16)' : 'rgba(255,255,255,0.04)',
              color: tab === x ? '#ffd5dc' : '#aeb5c5',
              borderRadius: 10,
              padding: '0.46rem 0.8rem',
              fontWeight: 700,
              fontSize: '0.84rem',
              cursor: 'pointer',
            }}
          >
            {x}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px,340px) minmax(0,1fr)', gap: '0.8rem' }}>
            <div style={panelStyle()}>
              <div style={{ color: '#8b93a8', fontSize: '0.72rem', letterSpacing: '0.12em', fontWeight: 700 }}>KR MARKET GATE</div>
              <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'center' }}>
                <svg width="140" height="140" viewBox="0 0 140 140">
                  <circle cx="70" cy="70" r="54" stroke="rgba(255,255,255,0.08)" strokeWidth="10" fill="transparent" />
                  <circle
                    cx="70"
                    cy="70"
                    r="54"
                    stroke={gateColor(gate?.gate_score)}
                    strokeWidth="10"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 54}
                    strokeDashoffset={(2 * Math.PI * 54) - ((2 * Math.PI * 54) * Math.max(0, Math.min(100, asNum(gate?.gate_score)))) / 100}
                    transform="rotate(-90 70 70)"
                  />
                </svg>
              </div>
              <div style={{ color: '#9aa3b8', fontSize: '0.82rem' }}>{gate?.recommendation || '-'}</div>
              <div style={{ marginTop: '0.45rem', color: '#aab2c4', fontSize: '0.8rem' }}>
                KOSPI {fmtPct(gate?.kospi?.change_pct)} | KOSDAQ {fmtPct(gate?.kosdaq?.change_pct)} | USD/KRW {fmtNum(gate?.usd_krw)}
              </div>
            </div>

            <div style={panelStyle()}>
              <div style={{ color: '#d7dbe8', fontSize: '0.98rem', fontWeight: 700 }}>Top Signals Snapshot</div>
              <div style={{ marginTop: '0.65rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '0.5rem' }}>
                {topSignals.slice(0, 6).map((s) => (
                  <div key={s.ticker} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '0.62rem' }}>
                    <div style={{ color: '#d5dcee', fontSize: '0.78rem', fontWeight: 700 }}>{s.name || s.ticker}</div>
                    <div style={{ marginTop: '0.2rem', color: '#f5f7ff', fontWeight: 800 }}>{asNum(s.final_score ?? s.score).toFixed(1)}</div>
                    <div style={{ marginTop: '0.1rem', color: asNum(s.return_pct) >= 0 ? '#22c55e' : '#ef4444', fontSize: '0.76rem', fontWeight: 700 }}>{fmtPct(s.return_pct)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(320px,1fr)', gap: '0.8rem' }}>
            <div style={panelStyle()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ color: '#f5f7ff', fontWeight: 700 }}>{selectedName || '-'}</div>
                  <div style={{ color: '#7f889d', fontSize: '0.8rem' }}>{selectedTicker}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.28rem' }}>
                  {(['1M', '3M', '6M', '12M'] as ChartRange[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => setRange(r)}
                      style={{
                        border: range === r ? '1px solid rgba(244,63,94,0.55)' : '1px solid rgba(255,255,255,0.12)',
                        background: range === r ? 'rgba(244,63,94,0.25)' : 'rgba(255,255,255,0.03)',
                        color: range === r ? '#ffd5dc' : '#97a0b5',
                        borderRadius: 8,
                        padding: '0.18rem 0.58rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ width: '100%', height: 310, marginTop: '0.35rem' }}>
                <Candles candles={filteredCandles} />
              </div>
            </div>

            <div style={{ ...panelStyle(), background: 'linear-gradient(165deg, rgba(69,18,31,0.88), rgba(32,14,23,0.9))' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem' }}>
                <div style={{ color: '#fb7185', fontWeight: 800, fontSize: '0.88rem' }}>{langText('AI 상세 분석', 'AI Analysis', aiLang)}</div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button onClick={() => setAiLang('ko')} style={{ border: aiLang === 'ko' ? '1px solid rgba(251,113,133,0.5)' : '1px solid rgba(255,255,255,0.14)', background: aiLang === 'ko' ? 'rgba(251,113,133,0.18)' : 'rgba(255,255,255,0.04)', color: aiLang === 'ko' ? '#ffd5dc' : '#93a0ba', borderRadius: 6, padding: '0.1rem 0.42rem', fontSize: '0.67rem', fontWeight: 700, cursor: 'pointer' }}>KO</button>
                  <button onClick={() => setAiLang('en')} style={{ border: aiLang === 'en' ? '1px solid rgba(251,113,133,0.5)' : '1px solid rgba(255,255,255,0.14)', background: aiLang === 'en' ? 'rgba(251,113,133,0.18)' : 'rgba(255,255,255,0.04)', color: aiLang === 'en' ? '#ffd5dc' : '#93a0ba', borderRadius: 6, padding: '0.1rem 0.42rem', fontSize: '0.67rem', fontWeight: 700, cursor: 'pointer' }}>EN</button>
                </div>
              </div>
              <div style={{ marginTop: '0.5rem', display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '0.45rem' }}>
                {[{ key: 'openai', data: aiSummary?.providers?.openai }, { key: 'gemini', data: aiSummary?.providers?.gemini }].map((x) => {
                  const st = actionStyle(x.data?.rating)
                  return (
                    <div key={x.key} style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ color: '#dbe4f6', fontSize: '0.76rem', fontWeight: 700 }}>{x.data?.model || x.key}</div>
                        <span style={{ background: st.bg, color: st.c, borderRadius: 6, padding: '0.08rem 0.35rem', fontSize: '0.64rem', fontWeight: 800 }}>{x.data?.rating || 'WATCH'}</span>
                      </div>
                      <div style={{ marginTop: '0.2rem', color: '#8dd6a3', fontSize: '0.72rem' }}>{langText('신뢰도', 'Confidence', aiLang)} {x.data?.confidence ?? 0}%</div>
                      <div style={{ marginTop: '0.25rem', color: '#c6cfde', fontSize: '0.75rem', lineHeight: 1.45 }}>{pickProviderText(x.data)}</div>
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: '0.62rem', color: '#c1cada', fontSize: '0.76rem', lineHeight: 1.5 }}>{pickMainSummary()}</div>
            </div>
          </div>
        </>
      )}

      {tab === 'signals' && (
        <div style={panelStyle()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: '#f5f7ff', fontWeight: 700 }}>KR Signals - VCP Scanner</div>
            <button onClick={loadMain} style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#dfe5f4', borderRadius: 8, padding: '0.34rem 0.62rem' }}>Refresh</button>
          </div>
          <div style={{ marginTop: '0.7rem', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.79rem', minWidth: 1200 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#7f889d' }}>
                  <th style={{ textAlign: 'left', padding: '0.45rem 0.35rem' }}>Ticker/Name</th>
                  <th style={{ textAlign: 'left', padding: '0.45rem 0.35rem' }}>Date</th>
                  <th style={{ textAlign: 'right', padding: '0.45rem 0.35rem' }}>Volume</th>
                  <th style={{ textAlign: 'right', padding: '0.45rem 0.35rem' }}>Flow</th>
                  <th style={{ textAlign: 'right', padding: '0.45rem 0.35rem' }}>Score</th>
                  <th style={{ textAlign: 'right', padding: '0.45rem 0.35rem' }}>VCP</th>
                  <th style={{ textAlign: 'right', padding: '0.45rem 0.35rem' }}>Buy Point</th>
                  <th style={{ textAlign: 'right', padding: '0.45rem 0.35rem' }}>Current</th>
                  <th style={{ textAlign: 'right', padding: '0.45rem 0.35rem' }}>Return</th>
                  <th style={{ textAlign: 'center', padding: '0.45rem 0.35rem' }}>OpenAI</th>
                  <th style={{ textAlign: 'center', padding: '0.45rem 0.35rem' }}>Gemini</th>
                </tr>
              </thead>
              <tbody>
                {topSignals.map((s) => {
                  const oa = actionStyle(s.action_openai)
                  const ga = actionStyle(s.action_gemini)
                  return (
                    <tr key={s.ticker} onClick={() => selectTicker(s.ticker, s.name || s.ticker, true)} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', background: selectedTicker === s.ticker ? 'rgba(245,158,11,0.12)' : 'transparent' }}>
                      <td style={{ padding: '0.45rem 0.35rem' }}><div style={{ color: '#f5f7ff', fontWeight: 700 }}>{s.ticker}</div><div style={{ color: '#a7b0c2' }}>{s.name || '-'}</div></td>
                      <td style={{ padding: '0.45rem 0.35rem', color: '#a7b0c2' }}>{s.signal_date || '-'}</td>
                      <td style={{ padding: '0.45rem 0.35rem', textAlign: 'right', color: '#5dd39e' }}>{fmtNum(s.volume)}</td>
                      <td style={{ padding: '0.45rem 0.35rem', textAlign: 'right', color: asNum(s.flow_score) >= 0 ? '#22c55e' : '#ef4444' }}>{fmtNum(s.flow_score)}</td>
                      <td style={{ padding: '0.45rem 0.35rem', textAlign: 'right', color: '#93c5fd' }}>{asNum(s.final_score ?? s.score).toFixed(1)}</td>
                      <td style={{ padding: '0.45rem 0.35rem', textAlign: 'right', color: '#34d399' }}>{asNum(s.vcp_ratio).toFixed(2)}</td>
                      <td style={{ padding: '0.45rem 0.35rem', textAlign: 'right' }}>{fmtNum(s.buy_point)}</td>
                      <td style={{ padding: '0.45rem 0.35rem', textAlign: 'right' }}>{fmtNum(s.current_price)}</td>
                      <td style={{ padding: '0.45rem 0.35rem', textAlign: 'right', color: asNum(s.return_pct) >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{fmtPct(s.return_pct)}</td>
                      <td style={{ padding: '0.45rem 0.35rem', textAlign: 'center' }}><span style={{ background: oa.bg, color: oa.c, borderRadius: 6, padding: '0.08rem 0.38rem', fontSize: '0.65rem', fontWeight: 800 }}>{s.action_openai || 'WATCH'}</span></td>
                      <td style={{ padding: '0.45rem 0.35rem', textAlign: 'center' }}><span style={{ background: ga.bg, color: ga.c, borderRadius: 6, padding: '0.08rem 0.38rem', fontSize: '0.65rem', fontWeight: 800 }}>{s.action_gemini || 'WATCH'}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'ai-history' && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px minmax(0,1fr)', gap: '0.8rem' }}>
          <div style={panelStyle()}>
            <div style={{ color: '#f5f7ff', fontWeight: 700, marginBottom: '0.55rem' }}>History Dates</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {historyDates.length === 0 && <div style={{ color: '#8d95aa', fontSize: '0.84rem' }}>No history yet.</div>}
              {historyDates.map((date) => (
                <button
                  key={date}
                  onClick={() => setSelectedHistoryDate(date)}
                  style={{
                    textAlign: 'left',
                    border: selectedHistoryDate === date ? '1px solid rgba(244,63,94,0.4)' : '1px solid rgba(255,255,255,0.09)',
                    background: selectedHistoryDate === date ? 'rgba(244,63,94,0.12)' : 'rgba(255,255,255,0.02)',
                    color: '#d8deec',
                    borderRadius: 8,
                    padding: '0.45rem 0.56rem',
                    cursor: 'pointer',
                    fontSize: '0.84rem',
                  }}
                >
                  {date}
                </button>
              ))}
            </div>
          </div>
          <div style={panelStyle()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.55rem', flexWrap: 'wrap' }}>
              <div style={{ color: '#f5f7ff', fontWeight: 700 }}>AI History {selectedHistoryDate ? `- ${selectedHistoryDate}` : ''}</div>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button onClick={() => setAiHistoryLang('ko')} style={{ border: aiHistoryLang === 'ko' ? '1px solid rgba(251,113,133,0.5)' : '1px solid rgba(255,255,255,0.14)', background: aiHistoryLang === 'ko' ? 'rgba(251,113,133,0.18)' : 'rgba(255,255,255,0.04)', color: aiHistoryLang === 'ko' ? '#ffd5dc' : '#93a0ba', borderRadius: 6, padding: '0.1rem 0.42rem', fontSize: '0.67rem', fontWeight: 700, cursor: 'pointer' }}>KO</button>
                <button onClick={() => setAiHistoryLang('en')} style={{ border: aiHistoryLang === 'en' ? '1px solid rgba(251,113,133,0.5)' : '1px solid rgba(255,255,255,0.14)', background: aiHistoryLang === 'en' ? 'rgba(251,113,133,0.18)' : 'rgba(255,255,255,0.04)', color: aiHistoryLang === 'en' ? '#ffd5dc' : '#93a0ba', borderRadius: 6, padding: '0.1rem 0.42rem', fontSize: '0.67rem', fontWeight: 700, cursor: 'pointer' }}>EN</button>
              </div>
            </div>
            <div style={{ color: '#aeb6c8', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '0.6rem' }}>{pickHistorySummary()}</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: 860 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#7f889d' }}>
                    <th style={{ textAlign: 'left', padding: '0.45rem 0.35rem' }}>{langText('티커 / 종목명', 'Ticker / Name', aiHistoryLang)}</th>
                    <th style={{ textAlign: 'right', padding: '0.45rem 0.35rem' }}>Score</th>
                    <th style={{ textAlign: 'right', padding: '0.45rem 0.35rem' }}>VCP</th>
                    <th style={{ textAlign: 'right', padding: '0.45rem 0.35rem' }}>{langText('수익률', 'Return', aiHistoryLang)}</th>
                    <th style={{ textAlign: 'center', padding: '0.45rem 0.35rem' }}>OpenAI</th>
                    <th style={{ textAlign: 'center', padding: '0.45rem 0.35rem' }}>Gemini</th>
                  </tr>
                </thead>
                <tbody>
                  {(historyPayload?.signals || []).map((s) => {
                    const oa = actionStyle(s.action_openai)
                    const ga = actionStyle(s.action_gemini)
                    return (
                      <tr key={`${s.ticker}-${s.signal_date}`} onClick={() => selectTicker(s.ticker, s.name || s.ticker, true)} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', background: selectedTicker === s.ticker ? 'rgba(245,158,11,0.12)' : 'transparent' }}>
                        <td style={{ padding: '0.45rem 0.35rem' }}><div style={{ color: '#f5f7ff', fontWeight: 700 }}>{s.ticker}</div><div style={{ color: '#a7b0c2' }}>{s.name || '-'}</div></td>
                        <td style={{ padding: '0.45rem 0.35rem', textAlign: 'right', color: '#93c5fd' }}>{asNum(s.final_score ?? s.score).toFixed(1)}</td>
                        <td style={{ padding: '0.45rem 0.35rem', textAlign: 'right', color: '#34d399' }}>{asNum(s.vcp_ratio).toFixed(2)}</td>
                        <td style={{ padding: '0.45rem 0.35rem', textAlign: 'right', color: asNum(s.return_pct) >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{fmtPct(s.return_pct)}</td>
                        <td style={{ padding: '0.45rem 0.35rem', textAlign: 'center' }}><span style={{ background: oa.bg, color: oa.c, borderRadius: 6, padding: '0.08rem 0.38rem', fontSize: '0.65rem', fontWeight: 800 }}>{s.action_openai || 'WATCH'}</span></td>
                        <td style={{ padding: '0.45rem 0.35rem', textAlign: 'center' }}><span style={{ background: ga.bg, color: ga.c, borderRadius: 6, padding: '0.08rem 0.38rem', fontSize: '0.65rem', fontWeight: 800 }}>{s.action_gemini || 'WATCH'}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'performance' && (
        <div style={panelStyle()}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '0.8rem', marginBottom: '0.8rem' }}>
            <div style={panelStyle()}><div style={{ color: '#8b93a8', fontSize: '0.72rem' }}>WIN RATE</div><div style={{ marginTop: '0.3rem', color: '#22c55e', fontSize: '1.8rem', fontWeight: 800 }}>{fmtPct(perf?.win_rate)}</div></div>
            <div style={panelStyle()}><div style={{ color: '#8b93a8', fontSize: '0.72rem' }}>AVG RETURN</div><div style={{ marginTop: '0.3rem', color: '#f5f7ff', fontSize: '1.8rem', fontWeight: 800 }}>{fmtPct(perf?.avg_return)}</div></div>
            <div style={panelStyle()}><div style={{ color: '#8b93a8', fontSize: '0.72rem' }}>POSITIONS</div><div style={{ marginTop: '0.3rem', color: '#60a5fa', fontSize: '1.8rem', fontWeight: 800 }}>{fmtNum(perf?.total_positions)}</div></div>
            <div style={panelStyle()}><div style={{ color: '#8b93a8', fontSize: '0.72rem' }}>CUMULATIVE</div><div style={{ marginTop: '0.3rem', color: '#f5f7ff', fontSize: '1.8rem', fontWeight: 800 }}>{fmtPct(cum?.cumulative_return)}</div><div style={{ marginTop: '0.25rem', color: '#9aa3b8', fontSize: '0.8rem' }}>W {fmtNum(cum?.winners)} / L {fmtNum(cum?.losers)}</div></div>
          </div>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curve}>
                <XAxis dataKey="x" tick={{ fill: '#7f889d', fontSize: 11 }} />
                <YAxis tick={{ fill: '#7f889d', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#11141a', border: '1px solid rgba(255,255,255,0.12)' }} />
                <Line type="monotone" dataKey="equity" stroke="#22c55e" dot={false} />
                <Line type="monotone" dataKey="benchmark" stroke="#60a5fa" dot={false} />
                <Line type="monotone" dataKey="kosdaqBenchmark" stroke="#f59e0b" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
