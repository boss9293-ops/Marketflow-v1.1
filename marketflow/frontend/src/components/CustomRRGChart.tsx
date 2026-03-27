'use client'
import { useEffect, useState, useRef, useCallback, useMemo } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────
interface TrailPoint { ratio: number; momentum: number }
interface SymbolData {
  symbol:  string
  name:    string
  current: TrailPoint
  trail:   TrailPoint[]
  price:   number
  change:  number
  color:   string
}
interface ApiResponse {
  timestamp:        string
  benchmark:        string
  benchmark_price:  number
  benchmark_prices: number[]
  benchmark_dates:  string[]
  sectors: Array<{
    symbol:       string
    name:         string
    current?:     TrailPoint
    trail?:       TrailPoint[]
    rs_ratio?:    number
    rs_momentum?: number
    price?:       number
    change?:      number
  }>
  failed?: string[]
}

// ── Quadrants ─────────────────────────────────────────────────────────────────
const QUADS = {
  Leading:   { color: '#22c55e', bg: 'rgba(34,197,94,0.10)'   },
  Weakening: { color: '#eab308', bg: 'rgba(234,179,8,0.10)'   },
  Lagging:   { color: '#ef4444', bg: 'rgba(239,68,68,0.10)'   },
  Improving: { color: '#3b82f6', bg: 'rgba(59,130,246,0.10)'  },
} as const

function getQuadrant(ratio: number, momentum: number): keyof typeof QUADS {
  if (ratio >= 100 && momentum >= 100) return 'Leading'
  if (ratio >= 100 && momentum <  100) return 'Weakening'
  if (ratio <  100 && momentum >= 100) return 'Improving'
  return 'Lagging'
}

// ── Color palette ─────────────────────────────────────────────────────────────
const PALETTE = [
  '#06b6d4','#f59e0b','#ef4444','#22c55e',
  '#8b5cf6','#ec4899','#f97316','#6366f1',
  '#14b8a6','#eab308','#3b82f6','#d946ef',
]

// ── Benchmark sparkline ───────────────────────────────────────────────────────
function Sparkline({ prices }: { prices: number[] }) {
  const W = 600, H = 60
  if (prices.length < 2) return <div style={{ height: H }} />
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const pad = 3
  const pts = prices.map((p, i) => ({
    x: (i / (prices.length - 1)) * W,
    y: H - pad - ((p - min) / range) * (H - pad * 2),
  }))
  const line = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ')
  const fill = `${line} L${W},${H} L0,${H} Z`
  const isUp  = prices[prices.length - 1] >= prices[0]
  const color = isUp ? '#22c55e' : '#ef4444'
  const last  = pts[pts.length - 1]
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="crrg-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#crrg-fill)" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" />
      <circle cx={last.x} cy={last.y} r="3" fill={color} />
    </svg>
  )
}

// ── Canvas drawing ────────────────────────────────────────────────────────────
function drawRRG(
  canvas:     HTMLCanvasElement,
  symbols:    SymbolData[],
  visible:    Set<string>,
  tailLength: number,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const DPR = window.devicePixelRatio || 1
  const W   = canvas.clientWidth
  const H   = canvas.clientHeight
  canvas.width  = W * DPR
  canvas.height = H * DPR
  ctx.scale(DPR, DPR)

  const PAD   = { top: 36, right: 20, bottom: 44, left: 52 }
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top  - PAD.bottom

  const sliced = symbols.map(s => ({ ...s, trail: s.trail.slice(-tailLength) }))
  const pts = sliced
    .filter(s => visible.has(s.symbol))
    .flatMap(s => [...s.trail, s.current])

  let xMin = 96, xMax = 104, yMin = 96, yMax = 104
  if (pts.length) {
    const xs = pts.map(p => p.ratio)
    const ys = pts.map(p => p.momentum)
    const p  = 2
    xMin = Math.min(94, Math.min(...xs) - p)
    xMax = Math.max(106, Math.max(...xs) + p)
    yMin = Math.min(94, Math.min(...ys) - p)
    yMax = Math.max(106, Math.max(...ys) + p)
  }

  const toX = (v: number) => PAD.left + ((v - xMin) / (xMax - xMin)) * plotW
  const toY = (v: number) => PAD.top  + ((yMax - v) / (yMax - yMin)) * plotH

  ctx.clearRect(0, 0, W, H)
  const cx = toX(100), cy = toY(100)

  // Quadrant backgrounds
  const quads: [number, number, number, number, keyof typeof QUADS][] = [
    [cx,       PAD.top, PAD.left + plotW - cx,        cy - PAD.top,         'Leading'],
    [PAD.left, PAD.top, cx - PAD.left,                cy - PAD.top,         'Improving'],
    [PAD.left, cy,      cx - PAD.left,                PAD.top + plotH - cy, 'Lagging'],
    [cx,       cy,      PAD.left + plotW - cx,        PAD.top + plotH - cy, 'Weakening'],
  ]
  quads.forEach(([x, y, w, h, k]) => { ctx.fillStyle = QUADS[k].bg; ctx.fillRect(x, y, w, h) })

  // Quadrant labels
  ctx.font = '600 11px system-ui,sans-serif'
  const ql: [string, number, number, CanvasTextAlign, CanvasTextBaseline][] = [
    ['Leading',   cx + 6,           PAD.top + 4,         'left',  'top'],
    ['Improving', cx - 6,           PAD.top + 4,         'right', 'top'],
    ['Lagging',   cx - 6,           PAD.top + plotH - 4, 'right', 'bottom'],
    ['Weakening', cx + 6,           PAD.top + plotH - 4, 'left',  'bottom'],
  ]
  ql.forEach(([label, lx, ly, align, base]) => {
    const k = label as keyof typeof QUADS
    ctx.fillStyle = QUADS[k].color + 'bb'
    ctx.textAlign = align; ctx.textBaseline = base
    ctx.fillText(label, lx, ly)
  })

  // Grid (every 1 unit)
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 0.8
  for (let v = Math.ceil(xMin); v <= Math.floor(xMax); v++) {
    ctx.beginPath(); ctx.moveTo(toX(v), PAD.top); ctx.lineTo(toX(v), PAD.top + plotH); ctx.stroke()
  }
  for (let v = Math.ceil(yMin); v <= Math.floor(yMax); v++) {
    ctx.beginPath(); ctx.moveTo(PAD.left, toY(v)); ctx.lineTo(PAD.left + plotW, toY(v)); ctx.stroke()
  }

  // Center lines
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.2; ctx.setLineDash([5, 4])
  ctx.beginPath(); ctx.moveTo(cx, PAD.top); ctx.lineTo(cx, PAD.top + plotH); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(PAD.left, cy); ctx.lineTo(PAD.left + plotW, cy); ctx.stroke()
  ctx.setLineDash([])

  // Border
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1
  ctx.strokeRect(PAD.left, PAD.top, plotW, plotH)

  // Axis tick labels
  ctx.font = '10px system-ui,sans-serif'; ctx.fillStyle = '#4b5563'
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'
  for (let v = Math.ceil(xMin); v <= Math.floor(xMax); v += 2)
    ctx.fillText(String(v), toX(v), PAD.top + plotH + 4)
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
  for (let v = Math.ceil(yMin); v <= Math.floor(yMax); v += 2)
    ctx.fillText(String(v), PAD.left - 4, toY(v))

  // Axis labels
  ctx.font = '600 10px system-ui,sans-serif'; ctx.fillStyle = '#6b7280'
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
  ctx.fillText('JdK RS-Ratio  →', PAD.left + plotW / 2, H - 2)
  ctx.save()
  ctx.translate(14, PAD.top + plotH / 2); ctx.rotate(-Math.PI / 2)
  ctx.textBaseline = 'top'; ctx.fillText('JdK RS-Momentum  ↑', 0, 0)
  ctx.restore()

  // Symbols
  sliced.filter(s => visible.has(s.symbol)).forEach(s => {
    const color = s.color || '#9ca3af'
    const all   = [...s.trail, s.current]

    if (all.length > 1) {
      const mapped = all.map(pt => ({ x: toX(pt.ratio), y: toY(pt.momentum) }))
      ctx.beginPath(); ctx.strokeStyle = color + '70'; ctx.lineWidth = 1.8
      ctx.moveTo(mapped[0].x, mapped[0].y)
      for (let i = 1; i < mapped.length - 1; i++) {
        const xc = (mapped[i].x + mapped[i + 1].x) / 2
        const yc = (mapped[i].y + mapped[i + 1].y) / 2
        ctx.quadraticCurveTo(mapped[i].x, mapped[i].y, xc, yc)
      }
      ctx.lineTo(mapped[mapped.length - 1].x, mapped[mapped.length - 1].y)
      ctx.stroke()
    }

    s.trail.forEach((pt, i) => {
      const alpha = Math.round(((i + 1) / s.trail.length) * 160).toString(16).padStart(2, '0')
      ctx.beginPath(); ctx.arc(toX(pt.ratio), toY(pt.momentum), 3, 0, Math.PI * 2)
      ctx.fillStyle = color + alpha; ctx.fill()
    })

    const px = toX(s.current.ratio), py = toY(s.current.momentum)
    ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.fillStyle = color + '30'; ctx.fill()
    ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.stroke()

    ctx.font = 'bold 9px system-ui,sans-serif'; ctx.fillStyle = color
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
    ctx.fillText(s.symbol, px, py - 10)
  })
}

const RANGE_POINTS: Record<string, number> = { '3mo': 65, '6mo': 130, '12mo': 260 }
const RANGE_RS: Record<string, Record<string, number>> = {
  daily:  { '3mo': 65,  '6mo': 130, '12mo': 260 },
  weekly: { '3mo': 13,  '6mo': 26,  '12mo': 52  },
}

// ── Main component ────────────────────────────────────────────────────────────
const FLASK = 'http://localhost:5001'
const DEFAULT_SYMS = ['TSLA', 'NVDA']

export default function CustomRRGChart() {
  const [symbols,    setSymbols]    = useState<string[]>(DEFAULT_SYMS)
  const [benchmark,  setBenchmark]  = useState('SPY')
  const [weeks,      setWeeks]      = useState(10)
  const [inputSym,   setInputSym]   = useState('')
  const [inputBench, setInputBench] = useState('SPY')
  const [data,       setData]       = useState<ApiResponse | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [visible,    setVisible]    = useState<Set<string>>(new Set(DEFAULT_SYMS))
  const [tailLength,  setTailLength]  = useState(8)
  const [period,     setPeriod]     = useState<'daily'|'weekly'>('daily')
  const [range,      setRange]      = useState<'3mo'|'6mo'|'12mo'>('6mo')
  const [tailOffset, setTailOffset] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const normalize = useCallback((resp: ApiResponse): SymbolData[] => {
    if (!resp.sectors?.length) return []
    return resp.sectors.map((s, i) => {
      const trailRaw = Array.isArray(s.trail) ? s.trail : []
      const trail = trailRaw.filter(
        (pt): pt is TrailPoint => typeof pt?.ratio === 'number' && typeof pt?.momentum === 'number'
      )
      const ratio    = s.current?.ratio    ?? s.rs_ratio    ?? trail.at(-1)?.ratio    ?? 100
      const momentum = s.current?.momentum ?? s.rs_momentum ?? trail.at(-1)?.momentum ?? 100
      return {
        symbol:  s.symbol,
        name:    s.name || s.symbol,
        current: { ratio: Number(ratio), momentum: Number(momentum) },
        trail,
        price:   Number(s.price  ?? 0),
        change:  Number(s.change ?? 0),
        color:   PALETTE[i % PALETTE.length],
      }
    })
  }, [])

  const fetchData = useCallback(async (syms: string[], bench: string, wk: number, per: string) => {
    if (!syms.length) { setData(null); return }
    setLoading(true); setError('')
    try {
      const res = await fetch(
        `${FLASK}/api/rrg/custom?symbols=${syms.join(',')}&benchmark=${bench}&weeks=${wk}&period=${per}`,
        { cache: 'no-store' }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(symbols, benchmark, weeks, period) }, [symbols, benchmark, weeks, period, fetchData])

  const symbolDataList = data ? normalize(data) : []

  const displaySymbols = useMemo(() => {
    const rp = RANGE_POINTS[range]
    return symbolDataList.map(s => {
      const all  = [...s.trail, s.current]
      const rng  = all.slice(-rp)
      const end  = Math.max(1, rng.length - tailOffset)
      const start = Math.max(0, end - tailLength)
      const trail   = rng.slice(start, Math.max(0, end - 1))
      const current = rng[Math.max(0, end - 1)] ?? s.current
      return { ...s, trail, current }
    })
  }, [symbolDataList, range, tailOffset, tailLength])

  // Reset offset + RS period when range changes
  useEffect(() => {
    setTailOffset(0)
    setWeeks(RANGE_RS[period]?.[range] ?? RANGE_POINTS[range])
  }, [range, period])

  useEffect(() => {
    if (!canvasRef.current || !displaySymbols.length) return
    drawRRG(canvasRef.current, displaySymbols, visible, 99999)
  }, [displaySymbols, visible])

  useEffect(() => {
    const obs = new ResizeObserver(() => {
      if (canvasRef.current && displaySymbols.length)
        drawRRG(canvasRef.current, displaySymbols, visible, 99999)
    })
    if (canvasRef.current) obs.observe(canvasRef.current)
    return () => obs.disconnect()
  }, [displaySymbols, visible])

  const addSymbol = () => {
    const sym = inputSym.trim().toUpperCase()
    if (!sym || symbols.includes(sym) || symbols.length >= 10) return
    setSymbols(p => [...p, sym])
    setVisible(v => new Set([...v, sym]))
    setInputSym('')
  }
  const removeSymbol = (sym: string) => {
    setSymbols(p => p.filter(s => s !== sym))
    setVisible(v => { const s = new Set(v); s.delete(sym); return s })
  }
  const toggle = (sym: string) =>
    setVisible(p => { const s = new Set(p); s.has(sym) ? s.delete(sym) : s.add(sym); return s })

  const applyBench = () => {
    const b = inputBench.trim().toUpperCase()
    if (b && b !== benchmark) setBenchmark(b)
  }

  const maxTail   = symbolDataList.length
    ? Math.min(Math.max(...symbolDataList.map(s => s.trail.length), 1), 30)
    : 30
  const maxOffset = symbolDataList.length
    ? Math.max(0, Math.min(...symbolDataList.map(s =>
        Math.min([...s.trail, s.current].length, RANGE_POINTS[range])
      )) - tailLength)
    : 0

  const benchPrice  = data?.benchmark_price
  const benchPrices = data?.benchmark_prices ?? []
  const failed      = data?.failed ?? []

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '0.75rem' }}>
        <h3 style={{ color: '#F8FCFF', fontWeight: 800, fontSize: '1.15rem', margin: 0 }}>
          Custom Symbol RRG
        </h3>
        <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 3 }}>
          임의 심볼 JdK RS-Ratio &amp; RS-Momentum — vs {benchmark}
        </p>
      </div>

      {/* Benchmark sparkline bar */}
      <div style={{
        background: '#0d1117',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 8,
        padding: '0.6rem 1rem',
        marginBottom: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
      }}>
        <div style={{ flexShrink: 0 }}>
          <div style={{ color: '#6b7280', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' }}>Benchmark</div>
          <div style={{ color: '#F8FCFF', fontWeight: 800, fontSize: '1rem' }}>${benchmark}</div>
          {benchPrice != null && (
            <div style={{ color: '#94a3b8', fontSize: '0.82rem', fontWeight: 600 }}>
              ${benchPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0, height: 60 }}>
          <Sparkline prices={benchPrices} />
        </div>
      </div>

      {/* Errors */}
      {error && (
        <div style={{ color: '#ef4444', fontSize: '0.78rem', marginBottom: '0.5rem' }}>{error}</div>
      )}
      {failed.length > 0 && (
        <div style={{ color: '#f59e0b', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
          데이터 없음: {failed.join(', ')} (DB에 히스토리 부족)
        </div>
      )}

      {/* Chart + Settings */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
        {/* Canvas */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <div style={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#6b7280', background: '#111113', borderRadius: 8, fontSize: '0.85rem' }}>
              로딩 중...
            </div>
          ) : !symbols.length ? (
            <div style={{ height: 500, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', color: '#4b5563', background: '#111113', borderRadius: 8, gap: '0.4rem' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>심볼을 추가하세요</div>
              <div style={{ fontSize: '0.75rem' }}>우측 패널 입력창에 티커를 입력하세요 (예: AAPL, MSFT)</div>
            </div>
          ) : symbolDataList.length === 0 ? (
            <div style={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#6b7280', background: '#111113', borderRadius: 8 }}>
              데이터를 불러오는 중...
            </div>
          ) : (
            <canvas ref={canvasRef} style={{
              width: '100%', height: '500px',
              borderRadius: 8, background: '#111113', display: 'block',
            }} />
          )}
        </div>

        {/* Settings panel */}
        <div style={{
          width: 204, flexShrink: 0,
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 10, padding: '0.875rem',
          display: 'flex', flexDirection: 'column', gap: '0.85rem',
        }}>
          {/* Benchmark */}
          <div>
            <div style={{ color: '#6b7280', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 5 }}>
              Benchmark Symbol
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                value={inputBench}
                onChange={e => setInputBench(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && applyBench()}
                style={{
                  flex: 1, background: '#1a1f28',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 6, color: '#F8FCFF',
                  padding: '4px 8px', fontSize: '0.84rem', fontWeight: 700, outline: 'none',
                }}
              />
              <button onClick={applyBench} style={{
                padding: '4px 9px', background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6,
                color: '#d1d5db', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700,
              }}>↵</button>
            </div>
          </div>

          {/* RS Period */}
          <div>
            <div style={{ color: '#6b7280', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 5 }}>
              RS Period — {weeks} {period === 'daily' ? 'days' : 'weeks'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="range" min={5} max={RANGE_RS[period]?.[range] ?? 260} value={weeks}
                onChange={e => setWeeks(Number(e.target.value))}
                style={{ flex: 1, accentColor: '#00D9FF' }} />
              <span style={{ color: '#67EEFF', fontWeight: 800, fontSize: '0.88rem', minWidth: 22, textAlign: 'right' }}>
                {weeks}
              </span>
            </div>
          </div>

          {/* Range */}
          <div>
            <div style={{ color: '#6b7280', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 5 }}>
              Range
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['3mo','6mo','12mo'] as const).map(r => (
                <button key={r} onClick={() => setRange(r)} style={{
                  flex: 1, padding: '4px 0',
                  background: range === r ? 'rgba(0,217,255,0.15)' : 'rgba(255,255,255,0.04)',
                  border: range === r ? '1px solid rgba(0,217,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 6, color: range === r ? '#67EEFF' : '#6b7280',
                  cursor: 'pointer', fontSize: '0.73rem', fontWeight: 700, textTransform: 'uppercase',
                }}>{r}</button>
              ))}
            </div>
          </div>

          {/* Tail length */}
          <div>
            <div style={{ color: '#6b7280', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 5 }}>
              Tail — {Math.min(tailLength, maxTail)} pts
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="range" min={1} max={maxTail} value={Math.min(tailLength, maxTail)}
                onChange={e => setTailLength(Number(e.target.value))}
                style={{ flex: 1, accentColor: '#00D9FF' }} />
              <span style={{ color: '#67EEFF', fontWeight: 800, fontSize: '0.88rem', minWidth: 22, textAlign: 'right' }}>
                {Math.min(tailLength, maxTail)}
              </span>
            </div>
          </div>

          {/* Position scrubber */}
          <div>
            <div style={{ color: '#6b7280', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 5 }}>
              Position — {tailOffset === 0 ? 'Now' : `-${tailOffset}d`}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="range" min={0} max={maxOffset}
                value={maxOffset - tailOffset}
                onChange={e => setTailOffset(maxOffset - Number(e.target.value))}
                style={{ flex: 1, accentColor: '#f59e0b' }} />
              <span style={{ color: '#f59e0b', fontWeight: 800, fontSize: '0.88rem', minWidth: 26, textAlign: 'right' }}>
                {tailOffset === 0 ? 'NOW' : tailOffset}
              </span>
            </div>
          </div>

          {/* Period toggle */}
          <div>
            <div style={{ color: '#6b7280', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 5 }}>
              Data Period
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['daily','weekly'] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)} style={{
                  flex: 1, padding: '4px 0',
                  background: period === p ? 'rgba(0,217,255,0.15)' : 'rgba(255,255,255,0.04)',
                  border: period === p ? '1px solid rgba(0,217,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 6, color: period === p ? '#67EEFF' : '#6b7280',
                  cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase',
                }}>{p}</button>
              ))}
            </div>
          </div>

          {/* Symbol list */}
          <div>
            <div style={{ color: '#6b7280', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>
              Symbols ({symbols.length}/10)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {symbols.map((sym, i) => {
                const color   = PALETTE[i % PALETTE.length]
                const checked = visible.has(sym)
                return (
                  <div key={sym} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '4px 6px', borderRadius: 6,
                    background: checked ? `${color}14` : 'transparent',
                    cursor: 'pointer',
                  }} onClick={() => toggle(sym)}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ color: checked ? color : '#8f97ab', fontWeight: 700, fontSize: '0.84rem', flex: 1 }}>
                      {sym}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); removeSymbol(sym) }}
                      style={{
                        background: 'none', border: 'none', color: '#4b5563',
                        cursor: 'pointer', padding: '0 2px', fontSize: '0.9rem', lineHeight: 1,
                      }}
                    >×</button>
                  </div>
                )
              })}
            </div>

            {symbols.length < 10 && (
              <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                <input
                  value={inputSym}
                  onChange={e => setInputSym(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && addSymbol()}
                  placeholder="AAPL..."
                  style={{
                    flex: 1, background: '#1a1f28',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 6, color: '#F8FCFF',
                    padding: '4px 8px', fontSize: '0.82rem', outline: 'none',
                  }}
                />
                <button onClick={addSymbol} style={{
                  padding: '4px 9px',
                  background: 'rgba(0,217,255,0.1)',
                  border: '1px solid rgba(0,217,255,0.25)',
                  borderRadius: 6, color: '#67EEFF',
                  cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700,
                }}>+</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Data table */}
      {symbolDataList.length > 0 && (
        <div style={{ marginTop: '1.25rem', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {['', 'Symbol', 'RS-Ratio', 'RS-Momentum', 'Quadrant', 'Price', '% Chg'].map(h => (
                  <th key={h} style={{
                    padding: '0.5rem 0.75rem',
                    textAlign: h === '' ? 'center' : 'left',
                    color: '#D1DDF0', fontWeight: 700, fontSize: '0.84rem', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {symbolDataList.map(s => {
                const checked = visible.has(s.symbol)
                const quad    = getQuadrant(s.current.ratio, s.current.momentum)
                const qStyle  = QUADS[quad]
                return (
                  <tr key={s.symbol}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}
                    onClick={() => toggle(s.symbol)}>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                      <input type="checkbox" checked={checked}
                        onChange={() => toggle(s.symbol)}
                        onClick={e => e.stopPropagation()}
                        style={{ accentColor: s.color, cursor: 'pointer' }} />
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                        <span style={{ color: s.color, fontWeight: 700 }}>{s.symbol}</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600,
                      color: s.current.ratio >= 100 ? '#22c55e' : '#ef4444' }}>
                      {s.current.ratio.toFixed(2)}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600,
                      color: s.current.momentum >= 100 ? '#22c55e' : '#ef4444' }}>
                      {s.current.momentum.toFixed(2)}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 600,
                        color: qStyle.color, background: qStyle.bg,
                        padding: '2px 8px', borderRadius: 9999,
                      }}>{quad}</span>
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', color: '#d1d5db', fontWeight: 600 }}>
                      ${s.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600,
                      color: s.change >= 0 ? '#22c55e' : '#ef4444' }}>
                      {s.change >= 0 ? '+' : ''}{s.change.toFixed(2)}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
