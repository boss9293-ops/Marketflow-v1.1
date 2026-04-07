'use client'

import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import ChartShell from '@/components/vr-simulator/ChartShell'
import ChartTooltip from '@/components/vr-simulator/ChartTooltip'
import { formatCurrency, formatShortDate } from '@/components/vr-simulator/formatters'
import { BacktestRow } from '@/lib/backtest/types'

// ── Marker dot renderers ─────────────────────────────────────────────────────
function renderBuyDot(props: any) {
  const { cx, cy, payload } = props
  if (!payload?.buySignal) return <g />
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill="#22c55e" stroke="#14532d" strokeWidth={1.5} />
      <line x1={cx} y1={cy - 10} x2={cx} y2={cy + 10} stroke="#22c55e" strokeWidth={1} opacity={0.5} />
    </g>
  )
}

function renderSellDot(props: any) {
  const { cx, cy, payload } = props
  if (!payload?.sellSignal) return <g />
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill="#ef4444" stroke="#7f1d1d" strokeWidth={1.5} />
      <line x1={cx} y1={cy - 10} x2={cx} y2={cy + 10} stroke="#ef4444" strokeWidth={1} opacity={0.5} />
    </g>
  )
}

// ── Cycle Snapshot ───────────────────────────────────────────────────────────
interface CycleSnapshot {
  cycle: number
  startDate: string
  endDate: string
  // VR Band (end of cycle)
  vref: number
  vmin: number
  vmax: number
  // Market Value (end of cycle)
  evalValue: number    // shares × close
  endShares: number
  endClose: number
  // P/L (cumulative at end of cycle)
  returnPct: number
  pnlDollar: number    // realizedPnl + unrealizedPnl
  portfolioValue: number
  // Trade (this cycle) — Request vs Actual
  initBuyAmount: number
  buyCount: number
  buyReqTotal: number   // Σ BuyRequest for buy-signal bars
  buyAmount: number     // Σ ActualBuy (actual executed)
  sellCount: number
  sellReqTotal: number  // Σ SellRequest for sell-signal bars
  sellAmount: number    // Σ ActualSell
  avgBuyPrice: number
  // Pool
  deposit: number      // fixedAdd deposited at cycle start (0 for C0)
  poolStart: number
  poolEnd: number
}

function buildCycleSnapshots(rows: BacktestRow[], fixedAdd: number): CycleSnapshot[] {
  const map = new Map<number, CycleSnapshot>()

  for (const row of rows) {
    const c = row.currentPeriod
    if (!map.has(c)) {
      map.set(c, {
        cycle: c, startDate: row.date, endDate: row.date,
        vref: row.targetValue, vmin: row.lowerBand, vmax: row.upperBand,
        evalValue: row.marketValue, endShares: row.shares, endClose: row.close,
        returnPct: row.totalReturnPct,
        pnlDollar: row.realizedPnl + row.unrealizedPnl,
        portfolioValue: row.portfolioValue,
        initBuyAmount: 0, buyCount: 0, buyReqTotal: 0, buyAmount: 0,
        sellCount: 0, sellReqTotal: 0, sellAmount: 0, avgBuyPrice: 0,
        deposit: c > 0 ? fixedAdd : 0,
        poolStart: row.cash, poolEnd: row.cash,
      })
    }
    const s = map.get(c)!
    // Update end-of-cycle fields
    s.endDate       = row.date
    s.vref          = row.targetValue
    s.vmin          = row.lowerBand
    s.vmax          = row.upperBand
    s.evalValue     = row.marketValue
    s.endShares     = row.shares
    s.endClose      = row.close
    s.returnPct     = row.totalReturnPct
    s.pnlDollar     = row.realizedPnl + row.unrealizedPnl
    s.portfolioValue = row.portfolioValue
    s.poolEnd       = row.cash

    if (row.action === 'INIT_BUY' && row.buyAmount > 0) s.initBuyAmount += row.buyAmount
    if (row.buySignal && row.action === 'BUY' && row.buyAmount > 0) {
      s.buyCount++
      s.buyReqTotal  += row.buyRequest  ?? row.buyAmount
      s.buyAmount    += row.buyAmount
    }
    if (row.sellSignal && row.sellAmount > 0) {
      s.sellCount++
      s.sellReqTotal += row.sellRequest ?? row.sellAmount
      s.sellAmount   += row.sellAmount
    }
  }

  const result = Array.from(map.values()).sort((a, b) => a.cycle - b.cycle)
  // Compute avgBuyPrice (each VR buy = 1 share, so avgBuyPrice = buyAmount / buyCount)
  for (const s of result) {
    s.avgBuyPrice = s.buyCount > 0 ? s.buyAmount / s.buyCount : 0
  }
  return result
}

// ── Table styles ─────────────────────────────────────────────────────────────
const TH_BASE: React.CSSProperties = {
  padding: '0.35rem 0.55rem',
  color: '#8ea1b9', fontSize: '0.64rem',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  whiteSpace: 'nowrap', fontWeight: 600,
  textAlign: 'right' as const,
}
const TD_BASE: React.CSSProperties = {
  padding: '0.28rem 0.55rem',
  fontSize: '0.72rem', whiteSpace: 'nowrap',
  borderBottom: '1px solid rgba(255,255,255,0.035)',
  textAlign: 'right' as const,
}

// Section header row backgrounds
const SEC: Record<string, string> = {
  cycle:  'rgba(167,139,250,0.08)',
  band:   'rgba(251,191,36,0.07)',
  mkt:    'rgba(34,211,238,0.07)',
  pl:     'rgba(74,222,128,0.07)',
  trade:  'rgba(34,197,94,0.07)',
  pool:   'rgba(248,113,113,0.07)',
}

function th(section: string, extra?: React.CSSProperties) {
  return { ...TH_BASE, background: SEC[section] ?? 'transparent', ...extra }
}
function td(extra?: React.CSSProperties) {
  return { ...TD_BASE, ...extra }
}

function fmt$(v: number, d = 0) {
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: d, maximumFractionDigits: d })
}
function fmtN(v: number, d = 2) {
  return v.toFixed(d)
}
function fmtPct(v: number) {
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'
}
function dash(v: number, fmt: (v: number) => string) {
  return v !== 0 ? fmt(v) : '—'
}

// Chart B subtitle with colored labels
const ChartBSubtitle = (
  <span style={{ lineHeight: 1.6 }}>
    <span style={{ color: '#e2e8f0' }}>Evaluation</span>
    {' · '}
    <span style={{ color: '#a3e635' }}>Vref</span>
    {' · '}
    <span style={{ color: '#fb923c' }}>Vmax ─</span>
    {' · '}
    <span style={{ color: '#38bdf8' }}>Vmin ─</span>
    <span style={{ color: '#cbd5e1' }}>
      {'  ·  '}
      <span style={{ color: '#22c55e' }}>BUY ▲</span>
      {' ON Vmin · '}
      <span style={{ color: '#ef4444' }}>SELL ▼</span>
      {' ON Vmax · cycle (|)'}
    </span>
  </span>
)

// ── Component ─────────────────────────────────────────────────────────────────
export default function PortfolioChart({ rows, fixedAdd = 0 }: { rows: BacktestRow[]; fixedAdd?: number }) {
  const cycleStarts = rows.filter((row, i) => i > 0 && row.currentPeriod !== rows[i - 1].currentPeriod)
  const snapshots   = buildCycleSnapshots(rows, fixedAdd)

  const chartData = rows.map(row => ({
    ...row,
    buyMarker:  row.buySignal  ? row.lowerBand : null,
    sellMarker: row.sellSignal ? row.upperBand : null,
  }))

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>

      {/* ── Chart B ─────────────────────────────────────────────────────── */}
      <ChartShell title="Chart B · Evaluation and VR Bands" subtitle={ChartBSubtitle}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={formatShortDate} minTickGap={40} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => formatCurrency(v, 0)} />
            <Tooltip content={<ChartTooltip />} />

            {cycleStarts.map((row, idx) => (
              <ReferenceLine
                key={row.date}
                x={row.date}
                stroke="rgba(148,163,184,0.15)"
                strokeDasharray="3 3"
                label={
                  idx % 4 === 0
                    ? { value: `C${row.currentPeriod}`, position: 'insideTopLeft', fill: '#4b5563', fontSize: 9 }
                    : undefined
                }
              />
            ))}

            <Line type="monotone" dataKey="marketValue" stroke="#e2e8f0" dot={false} activeDot={false} strokeWidth={2}   name="Evaluation" />
            <Line type="monotone" dataKey="targetValue" stroke="#a3e635" dot={false} activeDot={false} strokeWidth={1.6} name="Vref" />
            <Line type="monotone" dataKey="upperBand"   stroke="#fb923c" dot={false} activeDot={false} strokeWidth={1.4} strokeDasharray="5 4" name="Vmax" />
            <Line type="monotone" dataKey="lowerBand"   stroke="#38bdf8" dot={false} activeDot={false} strokeWidth={1.4} strokeDasharray="5 4" name="Vmin" />
            <Line type="monotone" dataKey="buyMarker"  stroke="none" dot={renderBuyDot}  activeDot={false} connectNulls={false} strokeWidth={0} name="Buy"  legendType="none" />
            <Line type="monotone" dataKey="sellMarker" stroke="none" dot={renderSellDot} activeDot={false} connectNulls={false} strokeWidth={0} name="Sell" legendType="none" />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartShell>

      {/* ── Cycle Snapshot table ────────────────────────────────────────── */}
      <div style={{
        borderRadius: 14, border: '1px solid rgba(248,113,113,0.14)',
        background: 'rgba(248,113,113,0.03)', overflow: 'hidden',
      }}>
        <div style={{ padding: '0.6rem 0.9rem 0.4rem', display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <span style={{ color: '#f87171', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Cycle Snapshot
          </span>
          <span style={{ color: '#4b6280', fontSize: '0.68rem' }}>
            사이클별 Band · Market Value · P/L · Trade · Pool
          </span>
        </div>
        <div style={{ overflowX: 'auto', maxHeight: 420 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              {/* Section label row */}
              <tr style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <th colSpan={3} style={{ ...th('cycle'), textAlign: 'center', borderRight: '1px solid rgba(167,139,250,0.15)' }}>
                  Cycle
                </th>
                <th colSpan={3} style={{ ...th('band'), textAlign: 'center', borderRight: '1px solid rgba(251,191,36,0.15)' }}>
                  VR Band
                </th>
                <th colSpan={3} style={{ ...th('mkt'), textAlign: 'center', borderRight: '1px solid rgba(34,211,238,0.15)' }}>
                  Market Value
                </th>
                <th colSpan={3} style={{ ...th('pl'), textAlign: 'center', borderRight: '1px solid rgba(74,222,128,0.15)' }}>
                  P / L
                </th>
                <th colSpan={5} style={{ ...th('trade'), textAlign: 'center', borderRight: '1px solid rgba(34,197,94,0.15)' }}>
                  Trade
                </th>
                <th colSpan={3} style={{ ...th('pool'), textAlign: 'center' }}>
                  Pool
                </th>
              </tr>
              {/* Column label row */}
              <tr style={{ position: 'sticky', top: '1.7rem', zIndex: 2 }}>
                {/* Cycle */}
                <th style={{ ...th('cycle'), textAlign: 'center' }}>#</th>
                <th style={{ ...th('cycle'), textAlign: 'left'  }}>Start</th>
                <th style={{ ...th('cycle'), textAlign: 'left', borderRight: '1px solid rgba(167,139,250,0.15)' }}>End</th>
                {/* VR Band */}
                <th style={th('band')}>Vref</th>
                <th style={{ ...th('band'), color: '#38bdf8' }}>Vmin</th>
                <th style={{ ...th('band'), color: '#fb923c', borderRight: '1px solid rgba(251,191,36,0.15)' }}>Vmax</th>
                {/* Market Value */}
                <th style={th('mkt')}>Eval$</th>
                <th style={th('mkt')}>Shares</th>
                <th style={{ ...th('mkt'), borderRight: '1px solid rgba(34,211,238,0.15)' }}>Close</th>
                {/* P/L */}
                <th style={th('pl')}>Return%</th>
                <th style={th('pl')}>P/L$</th>
                <th style={{ ...th('pl'), borderRight: '1px solid rgba(74,222,128,0.15)' }}>Total$</th>
                {/* Trade */}
                <th style={{ ...th('trade'), color: '#22c55e' }}>Buy×</th>
                <th style={{ ...th('trade'), color: '#22c55e', fontSize: '0.6rem' }}>BuyReq$</th>
                <th style={{ ...th('trade'), color: '#86efac', fontSize: '0.6rem' }}>BuyExec$</th>
                <th style={{ ...th('trade'), color: '#ef4444' }}>Sell×</th>
                <th style={{ ...th('trade'), borderRight: '1px solid rgba(34,197,94,0.15)', fontSize: '0.6rem' }}>SellReq$</th>
                {/* Pool */}
                <th style={{ ...th('pool'), color: '#4ade80' }}>Deposit</th>
                <th style={th('pool')}>Balance</th>
                <th style={{ ...th('pool'), color: '#94a3b8' }}>Net</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s, i) => {
                const poolDelta = s.poolEnd - s.poolStart
                const hasTrade  = s.buyCount > 0 || s.sellCount > 0
                const rowBg     = hasTrade ? 'rgba(255,255,255,0.028)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'
                return (
                  <tr key={s.cycle} style={{ background: rowBg }}>
                    {/* ── Cycle ── */}
                    <td style={{ ...td({ textAlign: 'center', color: '#a78bfa', fontWeight: 700, fontSize: '0.75rem' }) }}>
                      C{s.cycle}
                      {s.initBuyAmount > 0 && (
                        <div style={{ color: '#38bdf8', fontSize: '0.58rem', fontWeight: 600 }}>INIT</div>
                      )}
                    </td>
                    <td style={td({ textAlign: 'left', color: '#94a3b8', fontSize: '0.71rem' })}>{s.startDate}</td>
                    <td style={td({ textAlign: 'left', color: '#64748b', fontSize: '0.71rem', borderRight: '1px solid rgba(167,139,250,0.10)' })}>{s.endDate}</td>

                    {/* ── VR Band ── */}
                    <td style={td({ color: '#a3e635' })}>{fmt$(s.vref, 0)}</td>
                    <td style={td({ color: '#38bdf8' })}>{fmt$(s.vmin, 0)}</td>
                    <td style={td({ color: '#fb923c', borderRight: '1px solid rgba(251,191,36,0.10)' })}>{fmt$(s.vmax, 0)}</td>

                    {/* ── Market Value ── */}
                    <td style={td({ color: '#e2e8f0' })}>{fmt$(s.evalValue, 0)}</td>
                    <td style={td({ color: '#22d3ee' })}>{fmtN(s.endShares, 2)}</td>
                    <td style={td({ color: '#94a3b8', borderRight: '1px solid rgba(34,211,238,0.10)' })}>{fmt$(s.endClose, 2)}</td>

                    {/* ── P/L ── */}
                    <td style={td({ color: s.returnPct >= 0 ? '#4ade80' : '#f87171', fontWeight: 600 })}>
                      {fmtPct(s.returnPct)}
                    </td>
                    <td style={td({ color: s.pnlDollar >= 0 ? '#4ade80' : '#f87171' })}>
                      {s.pnlDollar >= 0 ? '+' : ''}{fmt$(s.pnlDollar, 0)}
                    </td>
                    <td style={td({ color: '#f8fafc', borderRight: '1px solid rgba(74,222,128,0.10)' })}>
                      {fmt$(s.portfolioValue, 0)}
                    </td>

                    {/* ── Trade (Buy×, BuyReq$, BuyExec$, Sell×, SellReq$) ── */}
                    <td style={td({ color: s.buyCount > 0 ? '#22c55e' : '#374151', textAlign: 'center' })}>
                      {s.buyCount > 0 ? s.buyCount : '—'}
                      {s.initBuyAmount > 0 && s.buyCount === 0 && (
                        <span style={{ color: '#38bdf8', fontSize: '0.6rem', marginLeft: 2 }}>I</span>
                      )}
                    </td>
                    <td style={td({ color: s.buyCount > 0 ? '#4ade80' : '#374151', fontSize: '0.68rem' })}>
                      {s.buyCount > 0 ? fmt$(s.buyReqTotal, 0) : '—'}
                    </td>
                    <td style={td({ color: s.buyCount > 0 ? '#86efac' : '#374151', fontSize: '0.68rem' })}>
                      {s.buyCount > 0 ? (
                        <>
                          {fmt$(s.buyAmount, 0)}
                          {s.buyReqTotal > s.buyAmount && (
                            <span style={{ color: '#f59e0b', fontSize: '0.6rem', marginLeft: 3 }}>
                              ↓{Math.round((1 - s.buyAmount / s.buyReqTotal) * 100)}%
                            </span>
                          )}
                        </>
                      ) : '—'}
                    </td>
                    <td style={td({ color: s.sellCount > 0 ? '#ef4444' : '#374151', textAlign: 'center' })}>
                      {s.sellCount > 0 ? s.sellCount : '—'}
                    </td>
                    <td style={td({ color: s.sellCount > 0 ? '#fca5a5' : '#374151', fontSize: '0.68rem', borderRight: '1px solid rgba(34,197,94,0.10)' })}>
                      {s.sellCount > 0 ? (
                        <>
                          {fmt$(s.sellReqTotal, 0)}
                          {s.sellAmount < s.sellReqTotal && (
                            <span style={{ color: '#f59e0b', fontSize: '0.6rem', marginLeft: 3 }}>
                              →{fmt$(s.sellAmount, 0)}
                            </span>
                          )}
                        </>
                      ) : '—'}
                    </td>

                    {/* ── Pool ── */}
                    <td style={td({ color: s.deposit > 0 ? '#4ade80' : '#374151' })}>
                      {s.deposit > 0 ? fmt$(s.deposit, 0) : '—'}
                    </td>
                    <td style={td({ color: '#f87171' })}>
                      {fmt$(s.poolEnd, 0)}
                      {poolDelta !== 0 && (
                        <span style={{ fontSize: '0.62rem', marginLeft: 3, opacity: 0.7, color: poolDelta > 0 ? '#4ade80' : '#fbbf24' }}>
                          {poolDelta > 0 ? '+' : ''}{Math.round(poolDelta).toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td style={td({ color: poolDelta > 0 ? '#4ade80' : poolDelta < 0 ? '#fbbf24' : '#374151', fontWeight: poolDelta !== 0 ? 600 : 400 })}>
                      {poolDelta !== 0 ? (poolDelta > 0 ? '+' : '') + Math.round(poolDelta).toLocaleString() : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
