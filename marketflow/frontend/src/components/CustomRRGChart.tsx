'use client'
import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { clientApiUrl } from '@/lib/backendApi'

// ── Types ──────────────────────────────────────────────────────────────────────
interface TrailPoint { ratio: number; momentum: number }
interface SymbolData {
  symbol:  string
  name:    string
  current: TrailPoint
  trail:   TrailPoint[]
  price:   number | null
  change:  number | null
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
    price?:       number | null
    change?:      number | null
  }>
  failed?: string[]
}

// ── Quadrants ─────────────────────────────────────────────────────────────────
const QUADS = {
  Leading:   { color: '#22c55e', bg: 'rgba(34,197,94,0.18)'   },
  Weakening: { color: '#eab308', bg: 'rgba(234,179,8,0.18)'   },
  Lagging:   { color: '#ef4444', bg: 'rgba(239,68,68,0.18)'   },
  Improving: { color: '#3b82f6', bg: 'rgba(59,130,246,0.18)'  },
} as const

function getQuadrant(ratio: number, momentum: number): keyof typeof QUADS {
  if (ratio >= 100 && momentum >= 100) return 'Leading'
  if (ratio >= 100 && momentum <  100) return 'Weakening'
  if (ratio <  100 && momentum >= 100) return 'Improving'
  return 'Lagging'
}

// ── Adaptive viewport ─────────────────────────────────────────────────────────
type ViewScaleMode = 'tight' | 'normal' | 'wide'
type RrgDomain = { xMin: number; xMax: number; yMin: number; yMax: number }
type ViewScaleConfig = {
  xPadding: number; yPadding: number
  tailLowPct: number; tailHighPct: number
  minXSpan: number; minYSpan: number
  maxXSpan: number; maxYSpan: number
}
const VIEW_CONFIGS: Record<ViewScaleMode, ViewScaleConfig> = {
  tight:  { xPadding: 3,  yPadding: 1.5, tailLowPct: 10, tailHighPct: 90,  minXSpan: 20, minYSpan: 8,  maxXSpan: 35, maxYSpan: 12 },
  normal: { xPadding: 5,  yPadding: 2,   tailLowPct: 5,  tailHighPct: 95,  minXSpan: 25, minYSpan: 10, maxXSpan: 60, maxYSpan: 20 },
  wide:   { xPadding: 10, yPadding: 4,   tailLowPct: 0,  tailHighPct: 100, minXSpan: 30, minYSpan: 10, maxXSpan: 80, maxYSpan: 28 },
}
function floorToStep(v: number, s: number) { return Math.floor(v / s) * s }
function ceilToStep(v: number, s: number)  { return Math.ceil(v / s) * s }
function clampV(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }
function pctile(arr: number[], p: number) {
  if (!arr.length) return 100
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx), hi = Math.ceil(idx)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}
function computeRrgDomain(
  symbols: SymbolData[],
  visible: Set<string>,
  mode: ViewScaleMode,
): RrgDomain {
  const cfg = VIEW_CONFIGS[mode]
  const vis = symbols.filter(s => visible.has(s.symbol))
  if (!vis.length) return { xMin: 90, xMax: 110, yMin: 96, yMax: 104 }
  const latX  = vis.map(s => s.current.ratio)
  const latY  = vis.map(s => s.current.momentum)
  const tailX = vis.flatMap(s => s.trail.map(p => p.ratio))
  const tailY = vis.flatMap(s => s.trail.map(p => p.momentum))
  const xLo = Math.min(Math.min(...latX), tailX.length ? pctile(tailX, cfg.tailLowPct)  : Math.min(...latX))
  const xHi = Math.max(Math.max(...latX), tailX.length ? pctile(tailX, cfg.tailHighPct) : Math.max(...latX))
  const yLo = Math.min(Math.min(...latY), tailY.length ? pctile(tailY, cfg.tailLowPct)  : Math.min(...latY))
  const yHi = Math.max(Math.max(...latY), tailY.length ? pctile(tailY, cfg.tailHighPct) : Math.max(...latY))
  let xMin = floorToStep(Math.min(xLo, 100) - cfg.xPadding, 5)
  let xMax = ceilToStep(Math.max(xHi, 100) + cfg.xPadding, 5)
  let yMin = floorToStep(Math.min(yLo, 100) - cfg.yPadding, 2)
  let yMax = ceilToStep(Math.max(yHi, 100) + cfg.yPadding, 2)
  if (xMax - xMin < cfg.minXSpan) {
    const cx = clampV((Math.min(...latX) + Math.max(...latX)) / 2, 100 - cfg.minXSpan / 2, 100 + cfg.minXSpan / 2)
    xMin = floorToStep(cx - cfg.minXSpan / 2, 5); xMax = ceilToStep(cx + cfg.minXSpan / 2, 5)
  }
  if (yMax - yMin < cfg.minYSpan) {
    const cy = clampV((Math.min(...latY) + Math.max(...latY)) / 2, 100 - cfg.minYSpan / 2, 100 + cfg.minYSpan / 2)
    yMin = floorToStep(cy - cfg.minYSpan / 2, 2); yMax = ceilToStep(cy + cfg.minYSpan / 2, 2)
  }
  if (xMax - xMin > cfg.maxXSpan) {
    const cx = (Math.min(...latX) + Math.max(...latX)) / 2
    let lo = cx - cfg.maxXSpan / 2, hi = cx + cfg.maxXSpan / 2
    const lmin = Math.min(...latX) - cfg.xPadding, lmax = Math.max(...latX) + cfg.xPadding
    if (lmin < lo) { hi += lo - lmin; lo = lmin }
    if (lmax > hi) { lo -= lmax - hi; hi = lmax }
    xMin = floorToStep(lo, 5); xMax = ceilToStep(hi, 5)
  }
  if (yMax - yMin > cfg.maxYSpan) {
    const cy = (Math.min(...latY) + Math.max(...latY)) / 2
    let lo = cy - cfg.maxYSpan / 2, hi = cy + cfg.maxYSpan / 2
    const lmin = Math.min(...latY) - cfg.yPadding, lmax = Math.max(...latY) + cfg.yPadding
    if (lmin < lo) { hi += lo - lmin; lo = lmin }
    if (lmax > hi) { lo -= lmax - hi; hi = lmax }
    yMin = floorToStep(lo, 2); yMax = ceilToStep(hi, 2)
  }
  if (xMin > 100) xMin = floorToStep(100 - cfg.xPadding, 5)
  if (xMax < 100) xMax = ceilToStep(100 + cfg.xPadding, 5)
  if (yMin > 100) yMin = floorToStep(100 - cfg.yPadding, 2)
  if (yMax < 100) yMax = ceilToStep(100 + cfg.yPadding, 2)
  return { xMin, xMax, yMin, yMax }
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

// ── Tail curve mode (internal dev constant — not exposed to users) ─────────────
// Smoothing is visual only; RRG point coordinates are not modified.
type TailCurveMode = 'linear' | 'catmullRom' | 'bspline' | 'bezierAnchored'
const TAIL_CURVE_MODE: TailCurveMode = 'bezierAnchored'

// ── Catmull-Rom spline (sampled lineTo) ───────────────────────────────────────
function catmullRomSpline(
  pts: { x: number; y: number }[],
  samplesPerSeg = 8,
  tension = 0.5,
): { x: number; y: number }[] {
  if (pts.length < 2) return pts.slice()
  const out: { x: number; y: number }[] = []
  const p = [pts[0], ...pts, pts[pts.length - 1]]
  for (let i = 1; i < p.length - 2; i++) {
    const p0 = p[i - 1], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2]
    for (let s = 0; s < samplesPerSeg; s++) {
      const t = s / samplesPerSeg, t2 = t * t, t3 = t2 * t
      const b0 = -tension * t3 + 2 * tension * t2 - tension * t
      const b1 = (2 - tension) * t3 + (tension - 3) * t2 + 1
      const b2 = (tension - 2) * t3 + (3 - 2 * tension) * t2 + tension * t
      const b3 = tension * t3 - tension * t2
      out.push({
        x: b0 * p0.x + b1 * p1.x + b2 * p2.x + b3 * p3.x,
        y: b0 * p0.y + b1 * p1.y + b2 * p2.y + b3 * p3.y,
      })
    }
  }
  out.push({ ...pts[pts.length - 1] })
  return out
}

// ── Cubic uniform B-spline (smooth, does not pass through interior dots) ──────
function bsplineInterpolate(
  pts: { x: number; y: number }[],
  samplesPerSeg = 12,
): { x: number; y: number }[] {
  if (pts.length < 2) return pts.slice()
  const out: { x: number; y: number }[] = []
  const f = pts[0], l = pts[pts.length - 1]
  // Extrapolation phantoms → curve passes through first and last actual point
  const p = [
    { x: 2 * f.x - pts[1].x, y: 2 * f.y - pts[1].y },
    ...pts,
    { x: 2 * l.x - pts[pts.length - 2].x, y: 2 * l.y - pts[pts.length - 2].y },
  ]
  for (let i = 1; i < p.length - 2; i++) {
    const p0 = p[i - 1], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2]
    for (let s = 0; s < samplesPerSeg; s++) {
      const t = s / samplesPerSeg, t2 = t * t, t3 = t2 * t
      const b0 = (1 - 3 * t + 3 * t2 - t3) / 6
      const b1 = (4 - 6 * t2 + 3 * t3) / 6
      const b2 = (1 + 3 * t + 3 * t2 - 3 * t3) / 6
      const b3 = t3 / 6
      out.push({
        x: b0 * p0.x + b1 * p1.x + b2 * p2.x + b3 * p3.x,
        y: b0 * p0.y + b1 * p1.y + b2 * p2.y + b3 * p3.y,
      })
    }
  }
  out.push({ ...pts[pts.length - 1] }) // force latest point exact
  return out
}

// ── Bezier-anchored: native ctx.bezierCurveTo, Catmull-Rom tangents ───────────
// Passes through every actual point. No sampling artifacts (GPU-smooth).
function drawBezierAnchored(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
): void {
  if (pts.length < 2) return
  const n = pts.length
  const p = [pts[0], ...pts, pts[n - 1]] // duplicate-endpoint phantoms
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < n; i++) {
    const p0 = p[i - 1], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2]
    const cp1x = p1.x + (p2.x - p0.x) / 6, cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6, cp2y = p2.y - (p3.y - p1.y) / 6
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y)
  }
}

// ── Canvas drawing ────────────────────────────────────────────────────────────
function drawRRG(
  canvas:        HTMLCanvasElement,
  symbols:       SymbolData[],
  visible:       Set<string>,
  tailLength:    number,
  domain:        RrgDomain,
  focusedSymbol: string | null = null,
  showTrails:    boolean = true,
  showLabels:    boolean = true,
  activeQuads:   Set<string> = new Set(['Leading','Weakening','Lagging','Improving']),
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

  const { xMin, xMax, yMin, yMax } = domain

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

  // Grid (every 5 units)
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 0.8
  for (let v = Math.ceil(xMin / 5) * 5; v <= Math.floor(xMax); v += 5) {
    ctx.beginPath(); ctx.moveTo(toX(v), PAD.top); ctx.lineTo(toX(v), PAD.top + plotH); ctx.stroke()
  }
  for (let v = Math.ceil(yMin / 2) * 2; v <= Math.floor(yMax); v += 2) {
    ctx.beginPath(); ctx.moveTo(PAD.left, toY(v)); ctx.lineTo(PAD.left + plotW, toY(v)); ctx.stroke()
  }

  // Center lines
  ctx.strokeStyle = '#3a3f47'; ctx.lineWidth = 1.2; ctx.setLineDash([5, 4])
  ctx.beginPath(); ctx.moveTo(cx, PAD.top); ctx.lineTo(cx, PAD.top + plotH); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(PAD.left, cy); ctx.lineTo(PAD.left + plotW, cy); ctx.stroke()
  ctx.setLineDash([])

  // Border
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1
  ctx.strokeRect(PAD.left, PAD.top, plotW, plotH)

  // Axis tick labels
  ctx.font = '11px system-ui,sans-serif'; ctx.fillStyle = '#9ca3af'
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'
  for (let v = Math.ceil(xMin / 5) * 5; v <= Math.floor(xMax); v += 5)
    ctx.fillText(String(v), toX(v), PAD.top + plotH + 4)
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
  for (let v = Math.ceil(yMin / 2) * 2; v <= Math.floor(yMax); v += 2)
    ctx.fillText(String(v), PAD.left - 4, toY(v))

  // Axis labels
  ctx.font = '600 10px system-ui,sans-serif'; ctx.fillStyle = '#6b7280'
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
  ctx.fillText('MF RS-Ratio  →', PAD.left + plotW / 2, H - 2)
  ctx.save()
  ctx.translate(14, PAD.top + plotH / 2); ctx.rotate(-Math.PI / 2)
  ctx.textBaseline = 'top'; ctx.fillText('MF RS-Momentum  ↑', 0, 0)
  ctx.restore()

  // Symbols — quadrant filter + focus-aware rendering
  const filteredSliced = sliced.filter(s => {
    if (!visible.has(s.symbol)) return false
    if (activeQuads.size < 4) {
      const q = getQuadrant(s.current.ratio, s.current.momentum)
      if (!activeQuads.has(q)) return false
    }
    return true
  })

  // Draw non-focused symbols first (z-order: focused on top)
  const drawOrder = focusedSymbol
    ? [...filteredSliced.filter(s => s.symbol !== focusedSymbol), ...filteredSliced.filter(s => s.symbol === focusedSymbol)]
    : filteredSliced

  drawOrder.forEach(s => {
    const color    = s.color || '#9ca3af'
    const isFocused = focusedSymbol === s.symbol
    const dimmed    = focusedSymbol !== null && !isFocused
    const all       = [...s.trail, s.current]

    // Trail line — default 45%, focused 95%, dimmed 8%
    if (showTrails && all.length > 1) {
      const mapped    = all.map(pt => ({ x: toX(pt.ratio), y: toY(pt.momentum) }))
      const lineAlpha = isFocused ? 'f2' : (dimmed ? '14' : '73')
      const lineWidth = isFocused ? 2.8  : (dimmed ? 1.0  : 1.5)
      ctx.beginPath()
      if (TAIL_CURVE_MODE === 'linear') {
        ctx.moveTo(mapped[0].x, mapped[0].y)
        mapped.slice(1).forEach(p => ctx.lineTo(p.x, p.y))
      } else if (TAIL_CURVE_MODE === 'catmullRom') {
        const sp = catmullRomSpline(mapped, 8, 0.5)
        ctx.moveTo(sp[0].x, sp[0].y); sp.slice(1).forEach(p => ctx.lineTo(p.x, p.y))
      } else if (TAIL_CURVE_MODE === 'bspline') {
        const sp = bsplineInterpolate(mapped, 12)
        ctx.moveTo(sp[0].x, sp[0].y); sp.slice(1).forEach(p => ctx.lineTo(p.x, p.y))
      } else {
        drawBezierAnchored(ctx, mapped)
      }
      ctx.strokeStyle = color + lineAlpha; ctx.lineWidth = lineWidth
      ctx.stroke()
    }

    // Trail dots — age-based, further dimmed when not focused
    if (showTrails) {
      s.trail.forEach((pt, i) => {
        const age     = s.trail.length > 1 ? i / (s.trail.length - 1) : 1
        const baseOp  = 0.35 + age * 0.35
        const finalOp = dimmed ? baseOp * 0.2 : baseOp
        const alpha   = Math.round(finalOp * 255).toString(16).padStart(2, '0')
        const radius  = dimmed ? 2 : (2.5 + age * 1.5)
        ctx.beginPath(); ctx.arc(toX(pt.ratio), toY(pt.momentum), radius, 0, Math.PI * 2)
        ctx.fillStyle = color + alpha; ctx.fill()
      })
    }

    // Latest point — focused larger, dimmed smaller
    const px    = toX(s.current.ratio), py = toY(s.current.momentum)
    const latR  = isFocused ? 9 : (dimmed ? 5 : 7)
    ctx.beginPath(); ctx.arc(px, py, latR, 0, Math.PI * 2)
    ctx.fillStyle = color + (dimmed ? '28' : '30'); ctx.fill()
    ctx.beginPath(); ctx.arc(px, py, latR, 0, Math.PI * 2)
    ctx.strokeStyle = color + (dimmed ? '50' : 'ff'); ctx.lineWidth = isFocused ? 3.0 : (dimmed ? 1.5 : 2.2); ctx.stroke()

    // Symbol label — latest only, dimmed when not focused
    if (showLabels) {
      ctx.font      = (isFocused ? 'bold 10px' : (dimmed ? '9px' : 'bold 9px')) + ' system-ui,sans-serif'
      ctx.fillStyle = color + (dimmed ? '50' : 'ff')
      let labelX = px + 10; let labelAlign: CanvasTextAlign = 'left'
      if (labelX + s.symbol.length * 6 > PAD.left + plotW - 4) { labelX = px - 10; labelAlign = 'right' }
      let labelY = py - (latR + 5); let labelBase: CanvasTextBaseline = 'bottom'
      if (labelY < PAD.top + 4) { labelY = py + latR + 5; labelBase = 'top' }
      ctx.textAlign = labelAlign; ctx.textBaseline = labelBase
      ctx.fillText(s.symbol, labelX, labelY)
    }
  })
}

const RANGE_POINTS: Record<string, number> = {
  '3mo':  65,   // daily 65 bars / weekly 13 bars (display slice only)
  '6mo':  130,
  '12mo': 260,
}
const RANGE_POINTS_W: Record<string, number> = { '3mo': 13, '6mo': 26, '12mo': 52 }

// ── Main component ────────────────────────────────────────────────────────────
const DEFAULT_SYMS = ['XLK','XLV','XLF','XLE','XLY','XLP','XLI','XLB','XLRE','XLU','XLC']

const PRESETS = [
  { label: 'Sector ETFs', syms: ['XLK','XLV','XLF','XLE','XLY','XLP','XLI','XLB','XLRE','XLU','XLC'], bench: 'SPY' },
  { label: 'Mega Cap', syms: ['AAPL','MSFT','NVDA','AMZN','GOOGL','META','TSLA','AVGO','BRK.B','JPM'], bench: 'SPY' },
  { label: 'Mixed', syms: ['XLK','XLE','NVDA','AMZN','JPM','XLV','GLD','TLT'], bench: 'SPY' },
]

export default function CustomRRGChart() {
  const [symbols,    setSymbols]    = useState<string[]>(DEFAULT_SYMS)
  const [benchmark,  setBenchmark]  = useState('SPY')
  const [inputSym,   setInputSym]   = useState('')
  const [inputBench, setInputBench] = useState('SPY')
  const [data,       setData]       = useState<ApiResponse | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [visible,    setVisible]    = useState<Set<string>>(new Set(DEFAULT_SYMS))
  const [tailLength,  setTailLength]  = useState(5)
  const [period,     setPeriod]     = useState<'daily'|'weekly'>('weekly')
  const [range,      setRange]      = useState<'3mo'|'6mo'|'12mo'>('12mo')
  const [tailOffset, setTailOffset] = useState(0)
  const [viewScale,     setViewScale]     = useState<ViewScaleMode>('normal')
  const [focusedSymbol, setFocusedSymbol] = useState<string | null>(null)
  const [showTrails,    setShowTrails]    = useState(true)
  const [showLabels,    setShowLabels]    = useState(true)
  const [activeQuads,   setActiveQuads]   = useState<Set<string>>(
    new Set(['Leading', 'Weakening', 'Lagging', 'Improving'])
  )
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const domainRef   = useRef<RrgDomain>({ xMin: 90, xMax: 110, yMin: 96, yMax: 104 })

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
        price:   s.price  != null ? Number(s.price)  : null,
        change:  s.change != null ? Number(s.change) : null,
        color:   PALETTE[i % PALETTE.length],
      }
    })
  }, [])

  const fetchData = useCallback(async (
    syms: string[], bench: string, per: string,
  ) => {
    if (!syms.length) { setData(null); return }
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({
        symbols:   syms.join(','),
        benchmark: bench,
        tail:      '52',
        period:    per,
      })
      const res = await fetch(`${clientApiUrl('/api/rrg/candidate-d')}?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const wrapped: ApiResponse = {
        timestamp:        json.timestamp ?? '',
        benchmark:        json.benchmark ?? bench,
        benchmark_price:  0,
        benchmark_prices: [],
        benchmark_dates:  [],
        sectors: (json.sectors ?? json.symbols ?? [])
          .filter((s: { error?: string }) => !s.error)
          .map((s: {
            symbol: string
            latest?: { rs_ratio?: number; rs_momentum?: number }
            current?: { ratio?: number; momentum?: number }
            tail?: Array<{ rs_ratio?: number; rs_momentum?: number }>
            trail?: Array<{ ratio?: number; momentum?: number }>
            price?: number
            price_change?: number
            change?: number
          }) => {
            const ratio    = s.latest?.rs_ratio    ?? s.current?.ratio    ?? 100
            const momentum = s.latest?.rs_momentum ?? s.current?.momentum ?? 100
            const rawTrail = s.tail ?? s.trail ?? []
            return {
              symbol:      s.symbol,
              name:        s.symbol,
              rs_ratio:    ratio,
              rs_momentum: momentum,
              current:     { ratio, momentum },
              trail: rawTrail.slice(0, -1).map(pt => ({
                ratio:    (pt as { rs_ratio?: number; ratio?: number }).rs_ratio ?? (pt as { ratio?: number }).ratio ?? 100,
                momentum: (pt as { rs_momentum?: number; momentum?: number }).rs_momentum ?? (pt as { momentum?: number }).momentum ?? 100,
              })),
              price:  s.price ?? null,
              change: s.price_change ?? s.change ?? null,
            }
          }),
        failed: (json.sectors ?? json.symbols ?? [])
          .filter((s: { error?: string }) => s.error)
          .map((s: { symbol: string }) => s.symbol),
      }
      setData(wrapped)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(symbols, benchmark, period)
  }, [symbols, benchmark, period, fetchData])

  const symbolDataList = data ? normalize(data) : []

  const displaySymbols = useMemo(() => {
    const rp = period === 'weekly' ? RANGE_POINTS_W[range] : RANGE_POINTS[range]
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

  const autoDomain = useMemo(
    () => computeRrgDomain(displaySymbols, visible, viewScale),
    [displaySymbols, visible, viewScale],
  )

  // Reset offset when range changes
  useEffect(() => { setTailOffset(0) }, [range])

  // Reset range + tail when period changes
  useEffect(() => {
    setRange(period === 'weekly' ? '12mo' : '3mo')
    setTailLength(5)
    setTailOffset(0)
  }, [period])

  useEffect(() => {
    domainRef.current = autoDomain
    if (!canvasRef.current || !displaySymbols.length) return
    drawRRG(canvasRef.current, displaySymbols, visible, 99999, autoDomain,
      focusedSymbol, showTrails, showLabels, activeQuads)
  }, [displaySymbols, visible, autoDomain, focusedSymbol, showTrails, showLabels, activeQuads])

  useEffect(() => {
    const obs = new ResizeObserver(() => {
      if (canvasRef.current && displaySymbols.length)
        drawRRG(canvasRef.current, displaySymbols, visible, 99999, domainRef.current,
          focusedSymbol, showTrails, showLabels, activeQuads)
    })
    if (canvasRef.current) obs.observe(canvasRef.current)
    return () => obs.disconnect()
  }, [displaySymbols, visible, focusedSymbol, showTrails, showLabels, activeQuads])

  // Click-to-highlight: click latest point to focus, click again or Clear to unfocus
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !displaySymbols.length) return
    const rect  = canvasRef.current.getBoundingClientRect()
    const cssX  = e.clientX - rect.left
    const cssY  = e.clientY - rect.top
    const dom   = domainRef.current
    const PAD   = { top: 36, right: 20, bottom: 44, left: 52 }
    const plotW = rect.width  - PAD.left - PAD.right
    const plotH = rect.height - PAD.top  - PAD.bottom
    const toPixX = (v: number) => PAD.left + ((v - dom.xMin) / (dom.xMax - dom.xMin)) * plotW
    const toPixY = (v: number) => PAD.top  + ((dom.yMax - v) / (dom.yMax - dom.yMin)) * plotH
    let nearest: string | null = null
    let minDist = Infinity
    for (const s of displaySymbols.filter(ss => visible.has(ss.symbol))) {
      const dx = toPixX(s.current.ratio) - cssX
      const dy = toPixY(s.current.momentum) - cssY
      const d  = Math.sqrt(dx * dx + dy * dy)
      if (d < minDist && d < 24) { minDist = d; nearest = s.symbol }
    }
    setFocusedSymbol(prev => nearest === null ? null : prev === nearest ? null : nearest)
  }, [displaySymbols, visible])

  // Reset focus when symbol list changes
  useEffect(() => { setFocusedSymbol(null) }, [symbols])

  const addSymbol = () => {
    const sym = inputSym.trim().toUpperCase()
    if (!sym || symbols.includes(sym) || symbols.length >= 25) return
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

  const maxOffset = symbolDataList.length
    ? Math.max(0, Math.min(...symbolDataList.map(s =>
        Math.min([...s.trail, s.current].length,
          period === 'weekly' ? RANGE_POINTS_W[range] : RANGE_POINTS[range])
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
          MarketFlow Relative Rotation — vs {benchmark}
        </p>
        <p style={{ color: '#4b5563', fontSize: '0.72rem', marginTop: 2 }}>
          Relative strength and momentum rotation
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
          {benchPrice != null && benchPrice > 0 && (
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
            <canvas ref={canvasRef} onClick={handleCanvasClick} style={{
              width: '100%', height: '500px',
              borderRadius: 8, background: '#111113', display: 'block',
              cursor: 'crosshair',
            }} />
          )}

          {/* Data table — directly below the chart canvas */}
          {symbolDataList.length > 0 && (
            <div style={{ marginTop: '0.5rem', overflowX: 'auto', width: '90%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: 32 }} />
                  <col />
                  <col />
                  <col />
                  <col />
                  <col />
                  <col />
                </colgroup>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <th style={{ padding: '0.35rem 0.45rem', textAlign: 'center', color: '#D1DDF0', fontWeight: 700, fontSize: '0.82rem' }}></th>
                    <th style={{ padding: '0.35rem 0.45rem', textAlign: 'left', color: '#D1DDF0', fontWeight: 700, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>Symbol</th>
                    <th style={{ padding: '0.35rem 0.45rem', textAlign: 'left', color: '#D1DDF0', fontWeight: 700, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>MF RS-Ratio</th>
                    <th style={{ padding: '0.35rem 0.45rem', textAlign: 'left', color: '#D1DDF0', fontWeight: 700, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>MF RS-Momentum</th>
                    <th style={{ padding: '0.35rem 0.45rem', textAlign: 'left', color: '#D1DDF0', fontWeight: 700, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>Quadrant</th>
                    <th style={{ padding: '0.35rem 0.45rem', textAlign: 'left', color: '#D1DDF0', fontWeight: 700, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>Price</th>
                    <th style={{ padding: '0.35rem 0.45rem', textAlign: 'left', color: '#D1DDF0', fontWeight: 700, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>% Chg</th>
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
                        <td style={{ padding: '0.35rem 0.45rem', textAlign: 'center' }}>
                          <input type="checkbox" checked={checked}
                            onChange={() => toggle(s.symbol)}
                            onClick={e => e.stopPropagation()}
                            style={{ accentColor: s.color, cursor: 'pointer' }} />
                        </td>
                        <td style={{ padding: '0.35rem 0.45rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block', flexShrink: 0 }} />
                            <span style={{ color: s.color, fontWeight: 700 }}>{s.symbol}</span>
                          </div>
                        </td>
                        <td style={{ padding: '0.35rem 0.45rem', fontWeight: 600,
                          color: s.current.ratio >= 100 ? '#22c55e' : '#ef4444' }}>
                          {s.current.ratio.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.35rem 0.45rem', fontWeight: 600,
                          color: s.current.momentum >= 100 ? '#22c55e' : '#ef4444' }}>
                          {s.current.momentum.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.35rem 0.45rem' }}>
                          <span style={{
                            fontSize: '0.68rem', fontWeight: 600,
                            color: qStyle.color, background: qStyle.bg,
                            padding: '2px 7px', borderRadius: 9999,
                          }}>{quad}</span>
                        </td>
                        <td style={{ padding: '0.35rem 0.45rem', color: '#d1d5db', fontWeight: 600 }}>
                          {s.price != null ? `$${s.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'N/A'}
                        </td>
                        <td style={{ padding: '0.35rem 0.45rem', fontWeight: 600,
                          color: s.change == null ? '#737880' : s.change >= 0 ? '#22c55e' : '#ef4444' }}>
                          {s.change == null ? 'N/A' : `${s.change >= 0 ? '+' : ''}${s.change.toFixed(2)}%`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
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
          {/* Presets */}
          <div>
            <div style={{ color: '#6b7280', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 5 }}>
              Preset
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {PRESETS.map(p => {
                const active = p.syms.join(',') === symbols.join(',') && p.bench === benchmark
                return (
                  <button key={p.label} onClick={() => {
                    setSymbols(p.syms)
                    setVisible(new Set(p.syms))
                    setBenchmark(p.bench)
                    setInputBench(p.bench)
                  }} style={{
                    padding: '5px 8px', textAlign: 'left',
                    background: active ? 'rgba(0,217,255,0.12)' : 'rgba(255,255,255,0.04)',
                    border: active ? '1px solid rgba(0,217,255,0.35)' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 6, color: active ? '#67EEFF' : '#9ca3af',
                    cursor: 'pointer', fontSize: '0.73rem', fontWeight: 700,
                  }}>{p.label}</button>
                )
              })}
            </div>
          </div>

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
            <div style={{ color: '#6b7280', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 5 }}>
              Tail Length
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {([5, 7, 10] as const).map(n => (
                <button key={n} onClick={() => setTailLength(n)} style={{
                  flex: 1, padding: '4px 0',
                  background: tailLength === n ? 'rgba(0,217,255,0.15)' : 'rgba(255,255,255,0.04)',
                  border: tailLength === n ? '1px solid rgba(0,217,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 6, color: tailLength === n ? '#67EEFF' : '#6b7280',
                  cursor: 'pointer', fontSize: '0.73rem', fontWeight: 700,
                }}>{n}</button>
              ))}
            </div>
          </div>

          {/* Position scrubber */}
          <div>
            <div style={{ color: '#6b7280', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 5 }}>
              Position — {tailOffset === 0 ? 'Now' : `-${tailOffset}${period === 'weekly' ? 'w' : 'd'}`}
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

          {/* View Scale */}
          <div>
            <div style={{ color: '#6b7280', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 5 }}>
              View Scale
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              {(['tight','normal','wide'] as const).map(m => (
                <button key={m} onClick={() => setViewScale(m)} style={{
                  flex: 1, padding: '4px 0',
                  background: viewScale === m ? 'rgba(251,191,36,0.18)' : 'rgba(255,255,255,0.04)',
                  border: viewScale === m ? '1px solid rgba(251,191,36,0.5)' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 6, color: viewScale === m ? '#fbbf24' : '#6b7280',
                  cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, textTransform: 'capitalize',
                }}>{m}</button>
              ))}
              <button onClick={() => { setViewScale('normal'); setTailLength(5); setFocusedSymbol(null) }} style={{
                flexShrink: 0, padding: '4px 7px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 6, color: '#6b7280',
                cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700,
              }} title="Reset to normal">↺</button>
            </div>
          </div>

          {/* Display toggles */}
          <div>
            <div style={{ color: '#6b7280', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 5 }}>
              Display
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {([['Trails', showTrails, setShowTrails], ['Labels', showLabels, setShowLabels]] as const).map(([label, active, setter]) => (
                <button key={label} onClick={() => (setter as (v: boolean) => void)(!active)} style={{
                  flex: 1, padding: '4px 0',
                  background: active ? 'rgba(0,217,255,0.12)' : 'rgba(255,255,255,0.04)',
                  border: active ? '1px solid rgba(0,217,255,0.35)' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 6, color: active ? '#67EEFF' : '#6b7280',
                  cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700,
                }}>{label}</button>
              ))}
            </div>
          </div>

          {/* Quadrant filter */}
          <div>
            <div style={{ color: '#6b7280', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 5 }}>
              Quadrants
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {(['Leading','Weakening','Lagging','Improving'] as const).map(q => {
                const on = activeQuads.has(q)
                const qc = { Leading: '#22c55e', Weakening: '#eab308', Lagging: '#ef4444', Improving: '#3b82f6' }[q]
                return (
                  <button key={q} onClick={() => setActiveQuads(prev => {
                    const s = new Set(prev); s.has(q) ? s.delete(q) : s.add(q); return s
                  })} style={{
                    padding: '3px 6px',
                    background: on ? `${qc}22` : 'rgba(255,255,255,0.04)',
                    border: on ? `1px solid ${qc}66` : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 5, color: on ? qc : '#6b7280',
                    cursor: 'pointer', fontSize: '0.65rem', fontWeight: 700,
                  }}>{q.slice(0,4)}</button>
                )
              })}
            </div>
          </div>

          {/* Focus indicator */}
          {focusedSymbol && (
            <div>
              <div style={{ color: '#6b7280', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 5 }}>
                Focus
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#fbbf24', fontWeight: 800, fontSize: '0.88rem', flex: 1 }}>{focusedSymbol}</span>
                <button onClick={() => setFocusedSymbol(null)} style={{
                  padding: '2px 8px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 5, color: '#9ca3af',
                  cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700,
                }}>Clear</button>
              </div>
            </div>
          )}

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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ color: '#6b7280', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase' }}>
                Symbols ({symbols.length}/25)
              </div>
              <button
                onClick={() => {
                  const allVisible = symbols.every(s => visible.has(s))
                  setVisible(allVisible ? new Set() : new Set(symbols))
                }}
                style={{
                  padding: '2px 7px',
                  background: symbols.every(s => visible.has(s)) ? 'rgba(0,217,255,0.12)' : 'rgba(255,255,255,0.04)',
                  border: symbols.every(s => visible.has(s)) ? '1px solid rgba(0,217,255,0.35)' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 5, color: symbols.every(s => visible.has(s)) ? '#67EEFF' : '#6b7280',
                  cursor: 'pointer', fontSize: '0.62rem', fontWeight: 700,
                }}
              >
                {symbols.every(s => visible.has(s)) ? 'ALL OFF' : 'ALL ON'}
              </button>
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


    </div>
  )
}
