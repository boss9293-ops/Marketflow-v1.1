'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ComposedChart, Line, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

// ?? ???????????????????????????????????????????????????????????????????????
interface HistoryPoint {
  date: string
  soxx_rebased: number
  rel_compute: number; rel_memory: number
  rel_foundry: number; rel_equipment: number
  contrib_compute: number; contrib_memory: number
  contrib_foundry: number; contrib_equipment: number
  stage: string
  NVDA?: number; AMD?: number; AVGO?: number
  MU?: number; TSM?: number
  ASML?: number; AMAT?: number; LRCX?: number; KLAC?: number
}

interface TickerData {
  ticker: string
  return_30d: number
  return_60d: number
}

interface BucketAttributionChartProps {
  tickers: Record<string, TickerData>
  subBucketPerf: { compute: number; memory: number; foundry: number; equipment: number }
  stage: string
}

// ?? ?곸닔 ????????????????????????????????????????????????????????????????????
type BucketKey = 'compute' | 'memory' | 'foundry' | 'equipment'
type RangeKey  = '6m' | '1y' | '18m'

const RANGE_DAYS: Record<RangeKey, number> = { '6m': 180, '1y': 365, '18m': 540 }

const BUCKET_CONFIG: Record<BucketKey, {
  label: string; color: string
  tickers: string[]
  tickerColors: string[]
}> = {
  compute: {
    label: 'Compute',
    color: '#a78bfa',
    tickers: ['NVDA', 'AMD', 'AVGO'],
    tickerColors: ['#a78bfa', '#7c3aed', '#c4b5fd'],
  },
  memory: {
    label: 'Memory P2',
    color: '#38bdf8',
    tickers: ['MU'],
    tickerColors: ['#38bdf8'],
  },
  foundry: {
    label: 'Foundry',
    color: '#22c55e',
    tickers: ['TSM'],
    tickerColors: ['#22c55e'],
  },
  equipment: {
    label: 'Equipment P1',
    color: '#f97316',
    tickers: ['ASML', 'AMAT', 'LRCX', 'KLAC'],
    tickerColors: ['#f97316', '#fb923c', '#fed7aa', '#fde68a'],
  },
}

// ?? Tooltip ?ㅽ??????????????????????????????????????????????????????????????
const TT_STYLE = {
  backgroundColor: '#0f172a',
  border: '1px solid #1e293b',
  borderRadius: 6,
  padding: 8,
  fontSize: 11,
  fontFamily: 'monospace',
  color: '#e2e8f0',
}

// ?? Heatmap ? ?됱긽 ??????????????????????????????????????????????????????????
function cellColor(v: number): string {
  if (v >  1.5) return '#042C53'
  if (v >  0.5) return '#185FA5'
  if (v >  0.1) return '#1e3a5f'
  if (v > -0.1) return '#1e2736'
  if (v > -0.5) return '#5c1c1c'
  if (v > -1.5) return '#7c1f1f'
  return '#A32D2D'
}

// ?? 硫붿씤 而댄룷?뚰듃 ???????????????????????????????????????????????????????????
export default function BucketAttributionChart({
  tickers, subBucketPerf, stage
}: BucketAttributionChartProps) {
  const [range, setRange]         = useState<RangeKey>('1y')
  const [activeBkt, setActiveBkt] = useState<BucketKey>('compute')
  const [history, setHistory]     = useState<HistoryPoint[]>([])
  const [loading, setLoading]     = useState(true)

  const fetchHistory = useCallback(async (days: number) => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/semiconductor/history?days=${days}`)
      const data = await res.json()
      setHistory(data.history ?? [])
    } catch {
      setHistory([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHistory(RANGE_DAYS[range])
  }, [range, fetchHistory])

  const fmtDate = (d: string) => d?.slice(5) ?? ''

  const bktCfg    = BUCKET_CONFIG[activeBkt]
  const tickerRets = bktCfg.tickers.map(t => ({
    ticker: t,
    ret60d: tickers[t]?.return_60d ?? 0,
    ret30d: tickers[t]?.return_30d ?? 0,
  }))

  const hmBuckets: { key: BucketKey; label: string; color: string }[] = [
    { key: 'compute',   label: 'Compute',   color: '#a78bfa' },
    { key: 'memory',    label: 'Memory',    color: '#38bdf8' },
    { key: 'foundry',   label: 'Foundry',   color: '#22c55e' },
    { key: 'equipment', label: 'Equipment', color: '#f97316' },
  ]

  const xInterval = Math.max(1, Math.floor(history.length / 7))

  return (
    <div style={{ fontFamily: 'monospace' }}>

      {/* ?ㅻ뜑 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 10, flexWrap: 'wrap', gap: 8,
      }}>
        <div>
          <div style={{ fontSize: 11, color: '#64748b', letterSpacing: 2 }}>
            BUCKET ATTRIBUTION ??4 PANEL
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
            ?꾧? SOXX瑜??대걣怨??덈굹 쨌 媛쒕퀎 醫낅ぉ ?ㅼ젣 ?吏곸엫 ?ы븿
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['6m', '1y', '18m'] as RangeKey[]).map(r => (
            <button key={r} onClick={() => setRange(r)} style={{
              padding: '3px 10px', borderRadius: 4, fontSize: 11,
              border: '1px solid', fontFamily: 'monospace', cursor: 'pointer',
              borderColor: range === r ? '#475569' : '#1e293b',
              background:  range === r ? '#1e293b'  : 'transparent',
              color:       range === r ? '#e2e8f0'  : '#475569',
            }}>
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#334155', fontSize: 12 }}>
          Loading...
        </div>
      ) : (
        <>

          {/* ?? PANEL 1: SOXX Price ?? */}
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8,
            padding: '11px 14px', marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 8, fontSize: 10, color: '#64748b', letterSpacing: 1.2 }}>
              <span>PANEL 1 ??SOXX Price (湲곗?異?쨌 Rebased 100)</span>
              <span style={{ fontSize: 11, fontWeight: 500, color: '#185FA5' }}>
                ?꾩옱 {history[history.length - 1]?.soxx_rebased?.toFixed(1) ?? '--'}
              </span>
            </div>
            <div style={{ height: 80 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={history} margin={{ top: 2, right: 8, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2736" strokeWidth={0.5} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={fmtDate}
                    tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }}
                    tickLine={false} axisLine={{ stroke: '#1e2736' }} interval={xInterval} />
                  <YAxis tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }}
                    tickLine={false} axisLine={false} width={28}
                    tickFormatter={v => `${v >= 100 ? '+' : ''}${(v - 100).toFixed(0)}%`} />
                  <Tooltip contentStyle={TT_STYLE}
                    formatter={(v: number) => [`${v >= 100 ? '+' : ''}${(v - 100).toFixed(1)}%`, 'SOXX']} />
                  <ReferenceLine y={100} stroke="#334155" strokeWidth={1} />
                  <Line type="monotone" dataKey="soxx_rebased" stroke="#185FA5"
                    strokeWidth={2} dot={false} activeDot={{ r: 3, fill: '#38bdf8' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ?? PANEL 2: Relative Performance ?? */}
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8,
            padding: '11px 14px', marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 8 }}>
              <span style={{ fontSize: 10, color: '#64748b', letterSpacing: 1.2 }}>
                PANEL 2 ??Relative Performance (Bucket / SOXX 쨌 湲곗? 1.0)
              </span>
              <span style={{ fontSize: 11, fontWeight: 500, color: '#a78bfa' }}>
                Compute 二쇰룄 쨌 Equipment ?댄깉
              </span>
            </div>
            <div style={{ height: 120 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={history} margin={{ top: 2, right: 8, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2736" strokeWidth={0.5} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={fmtDate}
                    tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }}
                    tickLine={false} axisLine={{ stroke: '#1e2736' }} interval={xInterval} />
                  <YAxis tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }}
                    tickLine={false} axisLine={false} width={32}
                    tickFormatter={v => v.toFixed(1) + 'x'} />
                  <Tooltip contentStyle={TT_STYLE}
                    formatter={(v: number, name: string) => [`${v.toFixed(2)}x`, name]} />
                  <ReferenceLine y={1.0} stroke="#334155" strokeWidth={1} strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="rel_compute"   name="Compute"      stroke="#a78bfa" strokeWidth={2}   dot={false} />
                  <Line type="monotone" dataKey="rel_memory"    name="Memory P2"    stroke="#38bdf8" strokeWidth={2}   dot={false} />
                  <Line type="monotone" dataKey="rel_foundry"   name="Foundry"      stroke="#22c55e" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="rel_equipment" name="Equipment P1" stroke="#f97316" strokeWidth={2}
                    strokeDasharray="4 3" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8, paddingTop: 8,
              borderTop: '1px solid #1e2736', flexWrap: 'wrap', fontSize: 10, color: '#64748b' }}>
              {[
                { color: '#a78bfa', label: 'Compute',      dash: false },
                { color: '#38bdf8', label: 'Memory P2',    dash: false },
                { color: '#22c55e', label: 'Foundry',      dash: false },
                { color: '#f97316', label: 'Equipment P1',    dash: true },
                { color: '#334155', label: '湲곗? 1.0',      dash: true },
              ].map(({ color, label, dash }) => (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 14, height: 0, borderTop: `${dash ? '1px dashed' : '1.5px solid'} ${color}`, display: 'inline-block' }} />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* ?? PANEL 3: Contribution Heatmap ?? */}
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8,
            padding: '11px 14px', marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 10 }}>
              <span style={{ fontSize: 10, color: '#64748b', letterSpacing: 1.2 }}>
                PANEL 3 ??Contribution Heatmap (SOXX 湲곗뿬 쨌 ?뚮옉=湲곗뿬 / 鍮④컯=?듭젣)
              </span>
              <div style={{ display: 'flex', gap: 8, fontSize: 10, color: '#64748b' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 1, background: '#185FA5', display: 'inline-block' }} />湲곗뿬
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 1, background: '#A32D2D', display: 'inline-block' }} />?듭젣
                </span>
              </div>
            </div>
            {hmBuckets.map(({ key, label, color }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                <div style={{ fontSize: 10, color, width: 72, textAlign: 'right', flexShrink: 0 }}>
                  {label}
                </div>
                <div style={{ display: 'flex', gap: 1.5, flex: 1 }}>
                  {history.map((pt, i) => {
                    const v = pt[`contrib_${key}` as keyof HistoryPoint] as number ?? 0
                    return (
                      <div key={i} title={`${label} 쨌 ${pt.date} 쨌 ${v > 0 ? '+' : ''}${v.toFixed(1)}`}
                        style={{ height: 20, flex: 1, borderRadius: 2, background: cellColor(v), cursor: 'pointer' }}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 1.5, paddingLeft: 76, marginTop: 4 }}>
              {history.map((pt, i) => (
                <div key={i} style={{ flex: 1, fontSize: 10, color: '#475569', textAlign: 'center',
                  overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {i % xInterval === 0 ? fmtDate(pt.date) : ''}
                </div>
              ))}
            </div>
          </div>

          {/* ?? PANEL 4: Bucket Raw Price ?? */}
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8,
            padding: '11px 14px', marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: '#64748b', letterSpacing: 1.2, marginBottom: 10 }}>
              PANEL 4 ??Bucket Raw Price (Rebased 100 쨌 媛쒕퀎 醫낅ぉ ?ㅼ젣 ?吏곸엫)
            </div>

            {/* 踰꾪궥 ??*/}
            <div style={{ display: 'flex', gap: 0, border: '1px solid #1e293b', borderRadius: 6,
              overflow: 'hidden', marginBottom: 10 }}>
              {(Object.keys(BUCKET_CONFIG) as BucketKey[]).map(bkt => {
                const cfg = BUCKET_CONFIG[bkt]
                const isOn = activeBkt === bkt
                const tileColors: Record<BucketKey, string> = {
                  compute: '#EEEDFE', memory: '#E6F1FB', foundry: '#EAF3DE', equipment: '#FAEEDA',
                }
                const textColors: Record<BucketKey, string> = {
                  compute: '#3C3489', memory: '#0C447C', foundry: '#27500A', equipment: '#633806',
                }
                return (
                  <button key={bkt} onClick={() => setActiveBkt(bkt)} style={{
                    flex: 1, fontSize: 10, fontWeight: 500, padding: '5px 0',
                    textAlign: 'center', border: 'none', cursor: 'pointer',
                    borderRight: '1px solid #1e293b', fontFamily: 'monospace',
                    background: isOn ? tileColors[bkt] : 'transparent',
                    color:      isOn ? textColors[bkt] : '#64748b',
                  }}>
                    {cfg.label}
                  </button>
                )
              })}
            </div>

            {/* 醫낅ぉ 移대뱶 */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${bktCfg.tickers.length}, 1fr)`,
              gap: 6, marginBottom: 10 }}>
              {tickerRets.map(({ ticker, ret60d, ret30d }, i) => (
                <div key={ticker} style={{ background: '#0a1122', borderRadius: 6, padding: '8px 10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                    marginBottom: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: bktCfg.tickerColors[i] }}>
                      {ticker}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 500,
                      color: ret60d >= 0 ? '#22c55e' : '#ef4444' }}>
                      {ret60d >= 0 ? '+' : ''}{(ret60d * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: '#475569' }}>
                    30d: {ret30d >= 0 ? '+' : ''}{(ret30d * 100).toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>

            {/* 醫낅ぉ蹂?Rebased 李⑦듃 */}
            <div style={{ height: 130 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={history} margin={{ top: 2, right: 8, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2736" strokeWidth={0.5} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={fmtDate}
                    tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }}
                    tickLine={false} axisLine={{ stroke: '#1e2736' }} interval={xInterval} />
                  <YAxis tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }}
                    tickLine={false} axisLine={false} width={32}
                    tickFormatter={v => `${v >= 100 ? '+' : ''}${(v - 100).toFixed(0)}%`} />
                  <Tooltip contentStyle={TT_STYLE}
                    formatter={(v: number, name: string) => [
                      `${v >= 100 ? '+' : ''}${(v - 100).toFixed(1)}%`, name
                    ]} />
                  <ReferenceLine y={100} stroke="#334155" strokeWidth={1} strokeDasharray="2 2" />
                  <Line type="monotone" dataKey="soxx_rebased" name="SOXX"
                    stroke="rgba(148,163,184,0.4)" strokeWidth={1} strokeDasharray="2 2" dot={false} />
                  {bktCfg.tickers.map((ticker, i) => (
                    <Line key={ticker} type="monotone" dataKey={ticker} name={ticker}
                      stroke={bktCfg.tickerColors[i]}
                      strokeWidth={i === 0 ? 2 : 1.5}
                      strokeDasharray={i === 0 ? undefined : '4 3'}
                      dot={false}
                      activeDot={{ r: 3, fill: bktCfg.tickerColors[i] }} />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* 踰붾? */}
            <div style={{ display: 'flex', gap: 12, marginTop: 8, paddingTop: 8,
              borderTop: '1px solid #1e2736', flexWrap: 'wrap', fontSize: 10, color: '#64748b' }}>
              {bktCfg.tickers.map((ticker, i) => (
                <span key={ticker} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 14, height: 0,
                    borderTop: `${i === 0 ? '2px solid' : '1.5px dashed'} ${bktCfg.tickerColors[i]}`,
                    display: 'inline-block' }} />
                  {ticker}
                </span>
              ))}
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 14, height: 0, borderTop: '1px dotted rgba(148,163,184,0.5)',
                  display: 'inline-block' }} />
                SOXX (湲곗?)
              </span>
            </div>
          </div>

        </>
      )}
    </div>
  )
}
