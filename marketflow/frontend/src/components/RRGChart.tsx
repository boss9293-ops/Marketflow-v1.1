'use client'
import { useEffect, useState, useRef, useMemo } from 'react'
import { clientApiUrl } from '@/lib/backendApi'

// ── 타입 ──────────────────────────────────────────────
interface TrailPoint { ratio: number; momentum: number }
interface SectorData {
  symbol: string
  name: string
  current: TrailPoint
  trail: TrailPoint[]
  price: number
  change: number
}
interface RRGResponse { timestamp: string; sectors: SectorData[] }

// ── 섹터 색상 ─────────────────────────────────────────
const COLORS: Record<string, string> = {
  XLK:  '#06b6d4',
  XLV:  '#8b5cf6',
  XLF:  '#ef4444',
  XLE:  '#10b981',
  XLY:  '#f59e0b',
  XLP:  '#ec4899',
  XLI:  '#6366f1',
  XLB:  '#f97316',
  XLRE: '#14b8a6',
  XLU:  '#a855f7',
  XLC:  '#eab308',
}

// ── 사분면 ────────────────────────────────────────────
const QUADS = {
  Leading:   { color: '#22c55e', bg: 'rgba(34,197,94,0.10)' },
  Weakening: { color: '#eab308', bg: 'rgba(234,179,8,0.10)' },
  Lagging:   { color: '#ef4444', bg: 'rgba(239,68,68,0.10)' },
  Improving: { color: '#3b82f6', bg: 'rgba(59,130,246,0.10)' },
} as const

function getQuadrant(ratio: number, momentum: number): keyof typeof QUADS {
  if (ratio >= 100 && momentum >= 100) return 'Leading'
  if (ratio >= 100 && momentum < 100)  return 'Weakening'
  if (ratio < 100  && momentum >= 100) return 'Improving'
  return 'Lagging'
}

// ── 캔버스 그리기 ─────────────────────────────────────
function drawRRG(
  canvas: HTMLCanvasElement,
  sectors: SectorData[],
  visible: Set<string>,
  tailLength: number,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const DPR = window.devicePixelRatio || 1
  const W = canvas.clientWidth
  const H = canvas.clientHeight
  canvas.width  = W * DPR
  canvas.height = H * DPR
  ctx.scale(DPR, DPR)

  const PAD  = { top: 36, right: 20, bottom: 44, left: 52 }
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top  - PAD.bottom

  // 트레일 슬라이스 (tailLength 적용)
  const slicedSectors = sectors.map(s => ({
    ...s,
    trail: s.trail.slice(-tailLength),
  }))

  // 범위 계산: 보이는 섹터 기준 동적 범위
  const pts = slicedSectors
    .filter(s => visible.has(s.symbol))
    .flatMap(s => [...s.trail, s.current])

  let xMin = 96, xMax = 104, yMin = 96, yMax = 104
  if (pts.length) {
    const xVals = pts.map(p => p.ratio)
    const yVals = pts.map(p => p.momentum)
    const pad = 2
    xMin = Math.min(94, Math.min(...xVals) - pad)
    xMax = Math.max(106, Math.max(...xVals) + pad)
    yMin = Math.min(94, Math.min(...yVals) - pad)
    yMax = Math.max(106, Math.max(...yVals) + pad)
  }

  function toX(v: number) { return PAD.left + ((v - xMin) / (xMax - xMin)) * plotW }
  function toY(v: number) { return PAD.top  + ((yMax - v) / (yMax - yMin)) * plotH }

  ctx.clearRect(0, 0, W, H)

  // 사분면 배경
  const cx = toX(100), cy = toY(100)
  const quads: [number, number, number, number, keyof typeof QUADS][] = [
    [cx,         PAD.top,  PAD.left + plotW - cx,         cy - PAD.top,         'Leading'],
    [PAD.left,   PAD.top,  cx - PAD.left,                 cy - PAD.top,         'Improving'],
    [PAD.left,   cy,       cx - PAD.left,                 PAD.top + plotH - cy, 'Lagging'],
    [cx,         cy,       PAD.left + plotW - cx,         PAD.top + plotH - cy, 'Weakening'],
  ]
  quads.forEach(([x, y, w, h, key]) => {
    ctx.fillStyle = QUADS[key].bg
    ctx.fillRect(x, y, w, h)
  })

  // 사분면 레이블
  ctx.font = '600 11px system-ui, sans-serif'
  const qLabels: [string, number, number, CanvasTextAlign, CanvasTextBaseline][] = [
    ['Leading',   cx + 6,             PAD.top + 4,         'left',  'top'],
    ['Improving', cx - 6,             PAD.top + 4,         'right', 'top'],
    ['Lagging',   cx - 6,             PAD.top + plotH - 4, 'right', 'bottom'],
    ['Weakening', cx + 6,             PAD.top + plotH - 4, 'left',  'bottom'],
  ]
  qLabels.forEach(([label, lx, ly, align, base]) => {
    const key = label as keyof typeof QUADS
    ctx.fillStyle = QUADS[key].color + 'bb'
    ctx.textAlign = align
    ctx.textBaseline = base
    ctx.fillText(label, lx, ly)
  })

  // 격자선 (1단위)
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'
  ctx.lineWidth = 0.8
  for (let v = Math.ceil(xMin); v <= Math.floor(xMax); v++) {
    ctx.beginPath(); ctx.moveTo(toX(v), PAD.top); ctx.lineTo(toX(v), PAD.top + plotH); ctx.stroke()
  }
  for (let v = Math.ceil(yMin); v <= Math.floor(yMax); v++) {
    ctx.beginPath(); ctx.moveTo(PAD.left, toY(v)); ctx.lineTo(PAD.left + plotW, toY(v)); ctx.stroke()
  }

  // 중앙선
  ctx.strokeStyle = '#3a3f47'
  ctx.lineWidth = 1.2
  ctx.setLineDash([5, 4])
  ctx.beginPath(); ctx.moveTo(cx, PAD.top); ctx.lineTo(cx, PAD.top + plotH); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(PAD.left, cy); ctx.lineTo(PAD.left + plotW, cy); ctx.stroke()
  ctx.setLineDash([])

  // 테두리
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'
  ctx.lineWidth = 1
  ctx.strokeRect(PAD.left, PAD.top, plotW, plotH)

  // 축 눈금
  ctx.font = '10px system-ui, sans-serif'
  ctx.fillStyle = '#4b5563'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (let v = Math.ceil(xMin); v <= Math.floor(xMax); v += 2)
    ctx.fillText(String(v), toX(v), PAD.top + plotH + 4)
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (let v = Math.ceil(yMin); v <= Math.floor(yMax); v += 2)
    ctx.fillText(String(v), PAD.left - 4, toY(v))

  // 축 레이블
  ctx.font = '600 10px system-ui, sans-serif'
  ctx.fillStyle = '#6b7280'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText('MF RS-Ratio  →', PAD.left + plotW / 2, H - 2)
  ctx.save()
  ctx.translate(14, PAD.top + plotH / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.textBaseline = 'top'
  ctx.fillText('MF RS-Momentum  ↑', 0, 0)
  ctx.restore()

  // ── 섹터 렌더링 ──────────────────────────────────────
  slicedSectors
    .filter(s => visible.has(s.symbol))
    .forEach(s => {
      const color = COLORS[s.symbol] || '#9ca3af'
      const all   = [...s.trail, s.current]

      // Trail 선 (bezier smooth)
      if (all.length > 1) {
        const mapped = all.map(pt => ({ x: toX(pt.ratio), y: toY(pt.momentum) }))
        ctx.beginPath()
        ctx.strokeStyle = color + '70'
        ctx.lineWidth = 1.8
        ctx.moveTo(mapped[0].x, mapped[0].y)
        for (let i = 1; i < mapped.length - 1; i++) {
          const xc = (mapped[i].x + mapped[i + 1].x) / 2
          const yc = (mapped[i].y + mapped[i + 1].y) / 2
          ctx.quadraticCurveTo(mapped[i].x, mapped[i].y, xc, yc)
        }
        ctx.lineTo(mapped[mapped.length - 1].x, mapped[mapped.length - 1].y)
        ctx.stroke()
      }

      // Trail 점 (페이드)
      s.trail.forEach((pt, i) => {
        const alpha = Math.round(((i + 1) / s.trail.length) * 160)
          .toString(16).padStart(2, '0')
        ctx.beginPath()
        ctx.arc(toX(pt.ratio), toY(pt.momentum), 3, 0, Math.PI * 2)
        ctx.fillStyle = color + alpha
        ctx.fill()
      })

      // 현재 위치 원
      const px = toX(s.current.ratio)
      const py = toY(s.current.momentum)
      ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2)
      ctx.fillStyle = color + '30'; ctx.fill()
      ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2)
      ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.stroke()

      // 심볼 레이블
      ctx.font = 'bold 9px system-ui, sans-serif'
      ctx.fillStyle = color
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText(s.symbol, px, py - 10)
    })
}

// 52주 = 12mo, 26주 = 6mo, 13주 = 3mo
const RANGE_POINTS_W: Record<string, number> = { '3mo': 13, '6mo': 26, '12mo': 52 }

const SECTOR_SYMS = 'XLK,XLV,XLF,XLE,XLY,XLP,XLI,XLB,XLRE,XLU,XLC'

// ── 메인 컴포넌트 ─────────────────────────────────────
export default function RRGChart() {
  const [data,        setData]        = useState<RRGResponse | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [visible,     setVisible]     = useState<Set<string>>(new Set())
  const [tailLength,  setTailLength]  = useState<number>(7)
  const [range,       setRange]       = useState<'3mo'|'6mo'|'12mo'>('12mo')
  const [tailOffset,  setTailOffset]  = useState(0)
  const [period,      setPeriod]      = useState<'weekly'|'daily'>('weekly')
  const canvasRef                     = useRef<HTMLCanvasElement>(null)
  const initVisibleRef                = useRef(false)

  useEffect(() => {
    setLoading(true)
    setError('')

    const tail = period === 'weekly' ? '7' : '10'
    const params = new URLSearchParams({ symbols: SECTOR_SYMS, benchmark: 'SPY', period, tail })

    fetch(`${clientApiUrl('/api/rrg/candidate-d')}?${params}`, { cache: 'no-store' })
      .then(res => {
        if (!res.ok) throw new Error(`API ${res.status}`)
        return res.json()
      })
      .then(json => {
        const sectors: SectorData[] = (json.symbols ?? [])
          .filter((s: { error?: string; latest?: unknown }) => !s.error && s.latest)
          .map((s: { symbol: string; latest: { rs_ratio: number; rs_momentum: number }; tail?: Array<{ rs_ratio: number; rs_momentum: number }> }) => ({
            symbol:  s.symbol,
            name:    s.symbol,
            current: { ratio: s.latest.rs_ratio, momentum: s.latest.rs_momentum },
            trail:   (s.tail ?? []).map(pt => ({ ratio: pt.rs_ratio, momentum: pt.rs_momentum })),
            price:   0,
            change:  0,
          }))
        setData({ timestamp: json.timestamp ?? new Date().toISOString(), sectors })
        initVisibleRef.current = false
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : String(err))
        setData({ timestamp: new Date().toISOString(), sectors: [] })
      })
      .finally(() => setLoading(false))
  }, [period])

  const displaySectors = useMemo(() => {
    if (!data?.sectors?.length) return []
    const rp = RANGE_POINTS_W[range]
    return data.sectors.map(s => {
      const all  = [...s.trail, s.current]
      const rng  = all.slice(-rp)
      const end  = Math.max(1, rng.length - tailOffset)
      const start = Math.max(0, end - tailLength)
      const trail   = rng.slice(start, Math.max(0, end - 1))
      const current = rng[Math.max(0, end - 1)] ?? s.current
      return { ...s, trail, current }
    })
  }, [data, range, tailOffset, tailLength])

  // Reset offset when range changes
  useEffect(() => { setTailOffset(0) }, [range])

  useEffect(() => {
    if (!displaySectors.length || !canvasRef.current) return
    drawRRG(canvasRef.current, displaySectors, visible, 99999)
  }, [displaySectors, visible])

  // Reset tail default when period changes
  useEffect(() => {
    setTailLength(period === 'weekly' ? 7 : 10)
    setTailOffset(0)
  }, [period])

  useEffect(() => {
    if (initVisibleRef.current) return
    if (data?.sectors?.length) {
      setVisible(new Set(data.sectors.map(s => s.symbol)))
      initVisibleRef.current = true
    }
  }, [data])

  useEffect(() => {
    const obs = new ResizeObserver(() => {
      if (displaySectors.length && canvasRef.current)
        drawRRG(canvasRef.current, displaySectors, visible, 99999)
    })
    if (canvasRef.current) obs.observe(canvasRef.current)
    return () => obs.disconnect()
  }, [displaySectors, visible])

  const sectors   = data?.sectors ?? []
  const maxTail   = sectors.length > 0
    ? Math.min(Math.max(...sectors.map(s => s.trail.length)), 30)
    : 30
  const maxOffset = sectors.length > 0
    ? Math.max(0, Math.min(...sectors.map(s =>
        Math.min([...s.trail, s.current].length, RANGE_POINTS_W[range])
      )) - tailLength)
    : 0
  const ts      = data?.timestamp
    ? new Date(data.timestamp).toLocaleString('ko-KR') : ''

  const toggle    = (sym: string) =>
    setVisible(prev => { const s = new Set(prev); s.has(sym) ? s.delete(sym) : s.add(sym); return s })
  const selectAll = () => setVisible(new Set(sectors.map(s => s.symbol)))
  const clearAll  = () => setVisible(new Set())

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h3 style={{ color: '#F8FCFF', fontWeight: 800, fontSize: '1.34rem', margin: 0, letterSpacing: '0.01em' }}>
            Relative Rotation Graph
          </h3>
          <p style={{ color: '#D2E0F1', fontSize: '0.9rem', marginTop: 5, fontWeight: 600 }}>
            {period === 'weekly'
              ? 'Weekly Sector Rotation · 7-week tail'
              : 'Daily Sector Momentum · 10-day tail'}
            {' '}— vs SPY · {ts}
          </p>
        </div>

        {/* Controls row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>

          {/* Period toggle */}
          <div style={{ display: 'flex', gap: 3 }}>
            {(['weekly','daily'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                padding: '4px 9px',
                background: period === p ? 'rgba(0,217,255,0.15)' : 'rgba(255,255,255,0.04)',
                border: period === p ? '1px solid rgba(0,217,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: 7, color: period === p ? '#67EEFF' : '#6b7280',
                cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, textTransform: 'capitalize',
              }}>
                {p === 'weekly' ? 'Weekly ★' : 'Daily'}
              </button>
            ))}
          </div>

          {/* Range buttons */}
          <div style={{ display: 'flex', gap: 3 }}>
            {(['3mo','6mo','12mo'] as const).map(r => (
              <button key={r} onClick={() => setRange(r)} style={{
                padding: '4px 10px',
                background: range === r ? 'rgba(0,217,255,0.10)' : 'rgba(255,255,255,0.04)',
                border: range === r ? '1px solid rgba(0,217,255,0.3)' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: 7, color: range === r ? '#67EEFF' : '#6b7280',
                cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700,
              }}>{r}</button>
            ))}
          </div>

          {/* Tail length */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '0.48rem 0.85rem' }}>
            <span style={{ color: '#D7E5F6', fontSize: '0.85rem', whiteSpace: 'nowrap', fontWeight: 700 }}>Tail</span>
            <input type="range" min={1} max={maxTail} value={tailLength}
              onChange={e => setTailLength(Number(e.target.value))}
              style={{ width: 90, accentColor: '#00D9FF', cursor: 'pointer' }} />
            <span style={{ color: '#67EEFF', fontWeight: 800, fontSize: '0.95rem', minWidth: 26, textAlign: 'right' }}>{tailLength}</span>
          </div>

          {/* Position scrubber */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '0.48rem 0.85rem' }}>
            <span style={{ color: '#D7E5F6', fontSize: '0.85rem', whiteSpace: 'nowrap', fontWeight: 700 }}>
              {tailOffset === 0 ? 'Now' : `-${tailOffset}${period === 'weekly' ? 'w' : 'd'}`}
            </span>
            <input type="range" min={0} max={maxOffset}
              value={maxOffset - tailOffset}
              onChange={e => setTailOffset(maxOffset - Number(e.target.value))}
              style={{ width: 90, accentColor: '#f59e0b', cursor: 'pointer' }} />
            <span style={{ color: '#f59e0b', fontWeight: 800, fontSize: '0.88rem', minWidth: 30, textAlign: 'right' }}>
              {tailOffset === 0 ? 'NOW' : tailOffset}
            </span>
          </div>
        </div>
      </div>

      {/* 차트 + 우측 패널 (75% / 25%) */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>

        {/* 캔버스 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <div style={{
              height: 600, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#6b7280',
              background: '#111113', borderRadius: 8,
            }}>
              RRG 데이터 로딩 중...
            </div>
          ) : error || sectors.length === 0 ? (
            <div style={{
              height: 600, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#fca5a5',
              background: '#111113', borderRadius: 8, padding: '1.5rem',
              textAlign: 'center',
            }}>
              RRG 데이터를 불러오지 못했습니다. {error}
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              style={{ width: '100%', height: '600px', borderRadius: '8px', background: '#111113', display: 'block' }}
            />
          )}
        </div>

        {/* 우측 심볼 패널 */}
        <div style={{
          width: 196, flexShrink: 0,
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 10, padding: '0.875rem',
        }}>
          {/* All / None */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.7rem' }}>
            <span style={{ color: '#F6FBFF', fontWeight: 700, fontSize: '0.96rem' }}>Symbols</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {([['All', selectAll], ['None', clearAll]] as const).map(([label, fn]) => (
                <button key={label} onClick={fn} style={{
                  fontSize: '0.78rem', padding: '3px 8px', borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.07)', color: '#D0DDF0', cursor: 'pointer', fontWeight: 700,
                }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 섹터 체크박스 목록 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {sectors.map(s => {
              const checked = visible.has(s.symbol)
              const color   = COLORS[s.symbol] || '#9ca3af'
              return (
                <label key={s.symbol} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 5px', cursor: 'pointer', borderRadius: 5,
                  background: checked ? `${color}12` : 'transparent',
                  transition: 'background 0.15s',
                }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(s.symbol)}
                    style={{ accentColor: color, width: 13, height: 13, cursor: 'pointer', flexShrink: 0 }}
                  />
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: color, flexShrink: 0,
                  }} />
                  <span style={{ color: checked ? color : '#D0DDF0', fontWeight: 700, fontSize: '0.84rem', width: 38, flexShrink: 0 }}>
                    {s.symbol}
                  </span>
                  <span style={{ color: '#C0D0E4', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.name}
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      </div>

      {/* 하단 테이블 */}
      {sectors.length > 0 && (
        <div style={{ marginTop: '1.25rem', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {['Visible', 'Symbol', 'Name', 'MF RS-Ratio', 'MF RS-Momentum', 'Quadrant', '% Chg'].map(h => (
                  <th key={h} style={{
                    padding: '0.5rem 0.75rem',
                    textAlign: h === 'Visible' ? 'center' : 'left',
                    color: '#D1DDF0', fontWeight: 700, fontSize: '0.86rem', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sectors.map(s => {
                const checked = visible.has(s.symbol)
                const color   = COLORS[s.symbol] || '#9ca3af'
                const quad    = getQuadrant(s.current.ratio, s.current.momentum)
                const qStyle  = QUADS[quad]
                return (
                  <tr
                    key={s.symbol}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}
                    onClick={() => toggle(s.symbol)}
                  >
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(s.symbol)}
                        onClick={e => e.stopPropagation()}
                        style={{ accentColor: color, cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
                        <span style={{ color, fontWeight: 700 }}>{s.symbol}</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', color: '#d1d5db' }}>{s.name}</td>
                    <td style={{ padding: '0.5rem 0.75rem', color: s.current.ratio >= 100 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                      {s.current.ratio.toFixed(2)}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', color: s.current.momentum >= 100 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                      {s.current.momentum.toFixed(2)}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 600,
                        color: qStyle.color, background: qStyle.bg,
                        padding: '2px 8px', borderRadius: 9999,
                      }}>{quad}</span>
                    </td>
                    <td style={{
                      padding: '0.5rem 0.75rem', fontWeight: 600,
                      color: s.change >= 0 ? '#22c55e' : '#ef4444',
                    }}>
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
