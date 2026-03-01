interface CircularProgressProps {
  value: number
  max?: number
  size?: number
  strokeWidth?: number
  color?: string
  label?: string
  sublabel?: string
}

export default function CircularProgress({
  value,
  max = 100,
  size = 120,
  strokeWidth = 10,
  color = '#00D9FF',
  label,
  sublabel,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const pct = Math.min(Math.max(value / max, 0), 1)
  const dashoffset = circumference * (1 - pct)

  const getColor = (v: number) => {
    if (v >= 70) return '#22c55e'
    if (v >= 40) return '#f97316'
    return '#ef4444'
  }

  const strokeColor = color === 'auto' ? getColor(value) : color

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: size > 100 ? '1.5rem' : '1.125rem', fontWeight: 700, color: 'white' }}>{value}</span>
          {sublabel && <span style={{ fontSize: '0.65rem', color: '#6b7280' }}>{sublabel}</span>}
        </div>
      </div>
      {label && <span style={{ fontSize: '0.875rem', color: '#9ca3af', textAlign: 'center' }}>{label}</span>}
    </div>
  )
}
