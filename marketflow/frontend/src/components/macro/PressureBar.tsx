'use client'

export type PressureLevel = '안정' | '중립' | '경계' | '위험'

export function badgeClass(level: PressureLevel) {
  if (level === '위험') return 'border-rose-500/30 text-rose-200 bg-rose-500/10'
  if (level === '경계') return 'border-amber-500/30 text-amber-200 bg-amber-500/10'
  if (level === '중립') return 'border-sky-500/30 text-sky-200 bg-sky-500/10'
  return 'border-emerald-500/30 text-emerald-200 bg-emerald-500/10'
}

function gaugeColor(value: number) {
  if (value >= 85) return '#f87171'
  if (value >= 66) return '#fb923c'
  if (value >= 33) return '#facc15'
  return '#34d399'
}

export function levelFromValue(value: number): PressureLevel {
  if (value >= 85) return '위험'
  if (value >= 66) return '경계'
  if (value >= 33) return '중립'
  return '안정'
}

export function HalfGauge({ value, size = 60 }: { value: number; size?: number }) {
  const clamped = Math.max(0, Math.min(100, value))
  const ratio = size / 60
  const r = 24 * ratio
  const cx = 30 * ratio
  const cy = 30 * ratio
  const p = clamped / 100
  const a = Math.PI - p * Math.PI
  const nx = cx + (r - 6 * ratio) * Math.cos(a)
  const ny = cy - (r - 6 * ratio) * Math.sin(a)

  const polar = (ratio: number) => {
    const ang = Math.PI - Math.max(0, Math.min(1, ratio)) * Math.PI
    return { x: cx + r * Math.cos(ang), y: cy - r * Math.sin(ang) }
  }
  const arcSeg = (start: number, end: number) => {
    const s = polar(start)
    const e = polar(end)
    return `M ${s.x} ${s.y} A ${r} ${r} 0 0 1 ${e.x} ${e.y}`
  }

  return (
    <svg width={60 * ratio} height={42 * ratio} viewBox={`0 0 ${60 * ratio} ${42 * ratio}`} aria-hidden="true">
      <path d={arcSeg(0.00, 0.325)} fill="none" stroke="#34d399" strokeWidth={4 * ratio} strokeLinecap="butt" />
      <path d={arcSeg(0.335, 0.655)} fill="none" stroke="#facc15" strokeWidth={4 * ratio} strokeLinecap="butt" />
      <path d={arcSeg(0.665, 0.845)} fill="none" stroke="#fb923c" strokeWidth={4 * ratio} strokeLinecap="butt" />
      <path d={arcSeg(0.855, 1.00)} fill="none" stroke="#f87171" strokeWidth={4 * ratio} strokeLinecap="butt" />
      {[0.33, 0.66, 0.85].map((b) => {
        const o = polar(b)
        const i = { x: cx + (r - 5 * ratio) * Math.cos(Math.PI - b * Math.PI), y: cy - (r - 5 * ratio) * Math.sin(Math.PI - b * Math.PI) }
        return <line key={b} x1={o.x} y1={o.y} x2={i.x} y2={i.y} stroke="rgba(15,23,42,0.9)" strokeWidth={1.3 * ratio} />
      })}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="rgba(255,255,255,0.92)" strokeWidth={1.8 * ratio} />
      <circle cx={cx} cy={cy} r={2.8 * ratio} fill="rgba(255,255,255,0.95)" />
      <circle cx={cx} cy={cy} r={1.4 * ratio} fill={gaugeColor(clamped)} />
    </svg>
  )
}

export default function PressureBar({
  icon,
  label,
  value,
  level,
}: {
  icon: string
  label: string
  value: number
  level: PressureLevel
}) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div className="rounded-xl border border-white/10 bg-[#16181c] px-4 py-3.5 min-h-[104px]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-lg text-slate-100 leading-none">{icon} {label}</div>
          <div className="text-sm text-slate-300 mt-2">압박 점수 {Math.round(clamped)} / 100</div>
        </div>
        <div className="flex items-center gap-2">
          <HalfGauge value={clamped} size={76} />
          <span className={`px-2.5 py-1 rounded-full text-xs border ${badgeClass(level)}`}>{level}</span>
        </div>
      </div>
    </div>
  )
}
