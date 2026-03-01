'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useWatchlist } from '@/contexts/WatchlistContext'

type HoldingSummary = {
  total_equity: number
  cash: number
  total_cost: number
  total_pnl: number
  total_pnl_pct: number
  mdd_pct: number
  position_count: number
}

type HoldingWeight = {
  label: string
  symbol: string
  weight_pct: number
  market_value: number
}

type HoldingHistory = {
  date: string
  equity: number
  cost: number
  pnl: number
}

export type MyHoldingsCache = {
  generated_at?: string
  data_version?: string
  status?: string
  source?: string | null
  as_of_date?: string | null
  summary: HoldingSummary
  weights: HoldingWeight[]
  charts?: {
    history?: HoldingHistory[]
  }
  rerun_hint?: string
}

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_API || 'http://localhost:5001'

function panelStyle() {
  return {
    background: 'linear-gradient(145deg, rgba(30,33,41,0.92), rgba(20,22,29,0.92))',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: '0.92rem',
  } as const
}

function fmt(v?: number | null, digits = 2) {
  if (typeof v !== 'number' || Number.isNaN(v)) return '-'
  return v.toFixed(digits)
}

function fmtPct(v?: number | null) {
  if (typeof v !== 'number' || Number.isNaN(v)) return '-'
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

function HistoryLine({ data }: { data: HoldingHistory[] }) {
  const w = 840
  const h = 240
  const left = 38
  const right = 16
  const top = 12
  const bottom = 28
  if (!data.length) return <div style={{ color: '#8b93a8', fontSize: '0.78rem' }}>No history data.</div>

  const values = data.flatMap((d) => [d.equity, d.cost])
  const minRaw = Math.min(...values)
  const maxRaw = Math.max(...values)
  const pad = (maxRaw - minRaw) * 0.08
  const min = minRaw - pad
  const max = maxRaw + pad
  const span = Math.max(1, max - min)
  const cw = w - left - right
  const ch = h - top - bottom
  const step = cw / Math.max(1, data.length - 1)
  const y = (v: number) => top + ((max - v) / span) * ch

  const points = (key: 'equity' | 'cost') =>
    data.map((d, i) => `${left + i * step},${y(d[key])}`).join(' ')

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: '100%' }}>
      {[0, 1, 2, 3, 4].map((g) => {
        const yy = top + (ch * g) / 4
        return <line key={g} x1={left} y1={yy} x2={w - right} y2={yy} stroke="rgba(255,255,255,0.06)" />
      })}
      <polyline fill="none" stroke="#22c55e" strokeWidth="1.6" points={points('equity')} />
      <polyline fill="none" stroke="#f59e0b" strokeWidth="1.4" points={points('cost')} />
    </svg>
  )
}

export default function MyDashboard({ initialData }: { initialData: MyHoldingsCache }) {
  const router = useRouter()
  const { items, selectedSymbol, setSelectedSymbol, addSymbol, removeSymbol } = useWatchlist()
  const [data, setData] = useState<MyHoldingsCache>(initialData)
  const [symbolInput, setSymbolInput] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [cashInput, setCashInput] = useState('0')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const history = useMemo(() => (data.charts?.history || []).slice(-120), [data])
  const topWeights = useMemo(() => (data.weights || []).slice(0, 6), [data])

  const donut = useMemo(() => {
    let acc = 0
    const colors = ['#22c55e', '#60a5fa', '#f59e0b', '#ef4444', '#a78bfa', '#14b8a6', '#9ca3af']
    const segments = topWeights.map((w, i) => {
      const start = acc
      acc += Math.max(0, w.weight_pct)
      return `${colors[i % colors.length]} ${start}% ${acc}%`
    })
    return segments.length ? `conic-gradient(${segments.join(', ')})` : 'conic-gradient(#374151 0% 100%)'
  }, [topWeights])

  async function onAddSymbol() {
    setMsg('')
    const result = await addSymbol(symbolInput)
    if (!result.ok) {
      setMsg(result.message || 'Failed to add symbol.')
      return
    }
    setSymbolInput('')
  }

  async function onImportCsv() {
    if (!csvFile) {
      setMsg('CSV 파일을 선택하세요.')
      return
    }
    setBusy(true)
    setMsg('')
    try {
      const form = new FormData()
      form.append('file', csvFile)
      form.append('cash', cashInput || '0')
      const res = await fetch(`${API_BASE}/api/my-holdings/import-csv`, { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) {
        setMsg(json?.error || 'Import failed.')
        return
      }
      const cacheRes = await fetch(`${API_BASE}/api/my-holdings/cache`, { cache: 'no-store' })
      const cacheJson = await cacheRes.json()
      if (cacheRes.ok) setData(cacheJson)
      setMsg(`Import 완료: ${json.positions} positions`)
      setShowImport(false)
      setCsvFile(null)
      router.refresh()
    } catch {
      setMsg('Import failed (network).')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ padding: '1.5rem 1.75rem 2rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.9rem', fontWeight: 800, color: '#f3f4f6' }}>
            My <span style={{ color: '#00D9FF' }}>Portfolio</span>
          </h1>
          <div style={{ color: '#8b93a8', fontSize: '0.78rem', marginTop: 4 }}>
            Source: {data.source || '-'} | As of: {data.as_of_date || '-'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowImport(true)} style={{ border: '1px solid rgba(96,165,250,0.35)', background: 'rgba(96,165,250,0.15)', color: '#bfdbfe', borderRadius: 8, padding: '0.35rem 0.62rem', fontSize: '0.76rem', cursor: 'pointer' }}>
            Import CSV
          </button>
          <a href={`${API_BASE}/api/my-holdings/export?format=csv`} target="_blank" style={{ border: '1px solid rgba(34,197,94,0.35)', background: 'rgba(34,197,94,0.12)', color: '#86efac', borderRadius: 8, padding: '0.35rem 0.62rem', fontSize: '0.76rem', textDecoration: 'none' }}>
            Export CSV
          </a>
          <a href={`${API_BASE}/api/my-holdings/export?format=json`} target="_blank" style={{ border: '1px solid rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.12)', color: '#fcd34d', borderRadius: 8, padding: '0.35rem 0.62rem', fontSize: '0.76rem', textDecoration: 'none' }}>
            Export JSON
          </a>
        </div>
      </div>

      {msg ? <div style={{ color: '#fbbf24', fontSize: '0.76rem' }}>{msg}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0,1fr)', gap: 10 }}>
        <section style={panelStyle()}>
          <div style={{ color: '#d1d5db', fontWeight: 700, marginBottom: 8 }}>Watchlist</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value)}
              placeholder="Add ticker"
              style={{ flex: 1, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: '#f4f6fb', borderRadius: 8, padding: '0.36rem 0.5rem', fontSize: '0.78rem' }}
            />
            <button onClick={onAddSymbol} style={{ border: '1px solid rgba(0,217,255,0.35)', background: 'rgba(0,217,255,0.12)', color: '#67e8f9', borderRadius: 8, padding: '0.34rem 0.52rem', fontSize: '0.76rem', cursor: 'pointer' }}>+</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.length === 0 ? (
              <div style={{ color: '#8b93a8', fontSize: '0.78rem' }}>No watchlist symbols.</div>
            ) : (
              items.map((w) => (
                <div key={w.symbol} style={{ border: selectedSymbol === w.symbol ? '1px solid rgba(0,217,255,0.35)' : '1px solid rgba(255,255,255,0.1)', borderRadius: 8, background: 'rgba(255,255,255,0.03)', padding: '0.4rem 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <button onClick={() => { setSelectedSymbol(w.symbol); router.push(`/chart/${encodeURIComponent(w.symbol)}`) }} style={{ background: 'none', border: 0, color: '#f3f4f6', cursor: 'pointer', textAlign: 'left', flex: 1 }}>
                    {w.symbol}
                  </button>
                  <button onClick={() => removeSymbol(w.symbol)} style={{ border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.12)', color: '#fca5a5', borderRadius: 7, padding: '0.16rem 0.4rem', fontSize: '0.72rem', cursor: 'pointer' }}>
                    x
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 10 }}>
          {[
            { title: 'Total Equity', value: `$${fmt(data.summary?.total_equity)}`, color: '#f3f4f6' },
            { title: 'Cash', value: `$${fmt(data.summary?.cash)}`, color: '#9cdcfe' },
            { title: 'PnL', value: `${fmt(data.summary?.total_pnl)} (${fmtPct(data.summary?.total_pnl_pct)})`, color: (data.summary?.total_pnl || 0) >= 0 ? '#22c55e' : '#ef4444' },
            { title: 'MDD', value: `${fmtPct(data.summary?.mdd_pct)}`, color: '#f59e0b' },
          ].map((c, i) => (
            <div key={i} style={{ ...panelStyle(), gridColumn: 'span 3' }}>
              <div style={{ color: '#9ca3af', fontSize: '0.72rem', marginBottom: 6 }}>{c.title}</div>
              <div style={{ color: c.color, fontWeight: 800, fontSize: '1.05rem' }}>{c.value}</div>
            </div>
          ))}

          <div style={{ ...panelStyle(), gridColumn: 'span 4' }}>
            <div style={{ color: '#d1d5db', fontWeight: 700, marginBottom: 8 }}>Weights Donut</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 110, height: 110, borderRadius: '50%', background: donut, border: '1px solid rgba(255,255,255,0.12)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {topWeights.map((w) => (
                  <div key={w.symbol} style={{ color: '#c7cede', fontSize: '0.75rem' }}>
                    {w.label}: {fmt(w.weight_pct)}%
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ ...panelStyle(), gridColumn: 'span 4' }}>
            <div style={{ color: '#d1d5db', fontWeight: 700, marginBottom: 8 }}>Equity vs Cost</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Equity', value: data.summary?.total_equity || 0, color: '#22c55e' },
                { label: 'Cost', value: data.summary?.total_cost || 0, color: '#f59e0b' },
              ].map((row) => {
                const maxVal = Math.max(data.summary?.total_equity || 0, data.summary?.total_cost || 0, 1)
                const w = (row.value / maxVal) * 100
                return (
                  <div key={row.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9ca3af', fontSize: '0.72rem' }}>
                      <span>{row.label}</span>
                      <span>${fmt(row.value)}</span>
                    </div>
                    <div style={{ marginTop: 3, height: 10, borderRadius: 999, background: 'rgba(255,255,255,0.06)' }}>
                      <div style={{ width: `${Math.max(3, w)}%`, height: '100%', borderRadius: 999, background: row.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ ...panelStyle(), gridColumn: 'span 4' }}>
            <div style={{ color: '#d1d5db', fontWeight: 700, marginBottom: 8 }}>Fallback</div>
            <div style={{ color: '#8b93a8', fontSize: '0.78rem', lineHeight: 1.6 }}>
              status: {data.status || '-'}
              <br />
              rerun_hint: {data.rerun_hint || '-'}
            </div>
          </div>

          <div style={{ ...panelStyle(), gridColumn: 'span 12' }}>
            <div style={{ color: '#d1d5db', fontWeight: 700, marginBottom: 8 }}>History (Equity vs Cost)</div>
            <div style={{ width: '100%', height: 240 }}>
              <HistoryLine data={history} />
            </div>
          </div>
        </section>
      </div>

      {showImport ? (
        <>
          <button onClick={() => setShowImport(false)} style={{ position: 'fixed', inset: 0, border: 0, background: 'rgba(0,0,0,0.45)', zIndex: 80 }} />
          <section style={{ position: 'fixed', zIndex: 81, top: '15%', left: '50%', transform: 'translateX(-50%)', width: 'min(560px, 92vw)', background: 'linear-gradient(150deg, #151822 0%, #11141d 100%)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: '1rem' }}>
            <div style={{ color: '#f3f4f6', fontWeight: 800, marginBottom: 10 }}>Import Holdings CSV</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input type="file" accept=".csv,text/csv" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} />
              <input value={cashInput} onChange={(e) => setCashInput(e.target.value)} placeholder="Cash (e.g., 10000)" style={{ border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: '#f4f6fb', borderRadius: 8, padding: '0.4rem 0.55rem', fontSize: '0.8rem' }} />
              <div style={{ color: '#8b93a8', fontSize: '0.74rem' }}>
                템플릿 다운로드: <a href={`${API_BASE}/api/my-holdings/template-csv`} target="_blank" style={{ color: '#7dd3fc' }}>my_holdings_template.csv</a>
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
              <button onClick={() => setShowImport(false)} style={{ border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.05)', color: '#d1d5db', borderRadius: 8, padding: '0.34rem 0.6rem', cursor: 'pointer' }}>
                Cancel
              </button>
              <button disabled={busy} onClick={onImportCsv} style={{ border: '1px solid rgba(96,165,250,0.35)', background: 'rgba(96,165,250,0.14)', color: '#bfdbfe', borderRadius: 8, padding: '0.34rem 0.6rem', cursor: 'pointer' }}>
                {busy ? 'Importing...' : 'Import'}
              </button>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}

