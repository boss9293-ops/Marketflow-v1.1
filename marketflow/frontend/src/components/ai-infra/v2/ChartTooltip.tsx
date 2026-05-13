// AI 인프라 V2 — 차트 공통 툴팁 (절대 위치 HTML 오버레이)

export interface TooltipData {
  date:        string
  price:       number
  returnPct:   number
  domX:        number
  domY:        number
  svgX:        number
  svgY:        number
  isRightHalf: boolean
  isTouch:     boolean
}

interface Props {
  data: TooltipData
}

const V = {
  bg:       '#1a1f2a',
  border:   'rgba(255,255,255,0.18)',
  text:     '#E8F0F8',
  text3:    '#8b9098',
  positive: '#22c55e',
  negative: '#ef4444',
  neutral:  '#B8C8DC',
  mono:     "'IBM Plex Mono', monospace",
  ui:       "'IBM Plex Sans', sans-serif",
} as const

export function ChartTooltip({ data }: Props) {
  const retColor = data.returnPct > 0 ? V.positive
                 : data.returnPct < 0 ? V.negative
                 : V.neutral
  const retStr   = (data.returnPct >= 0 ? '+' : '') + data.returnPct.toFixed(1) + '%'

  const topPx: number | string = data.isTouch ? 6 : Math.max(4, data.domY - 50)
  const leftVal  = data.isRightHalf ? undefined : data.domX + 12
  const rightVal = data.isRightHalf ? `calc(100% - ${data.domX - 12}px)` : undefined

  return (
    <div
      role="tooltip"
      aria-live="polite"
      style={{
        position:      'absolute',
        top:           topPx,
        left:          leftVal,
        right:         rightVal,
        zIndex:        10,
        pointerEvents: 'none',
        background:    V.bg,
        border:        `1px solid ${V.border}`,
        borderRadius:  4,
        padding:       '6px 10px',
        minWidth:      130,
        boxShadow:     '0 4px 12px rgba(0,0,0,0.40)',
      }}
    >
      <div style={{ fontFamily: V.mono, fontSize: 11, color: V.text3, marginBottom: 3 }}>
        {data.date}
      </div>
      <div style={{
        fontFamily: V.mono, fontSize: 13, fontWeight: 700, color: V.text, marginBottom: 2,
      }}>
        ${data.price.toFixed(2)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontFamily: V.mono, fontSize: 12, fontWeight: 700, color: retColor }}>
          {retStr}
        </span>
        <span style={{ fontFamily: V.ui, fontSize: 10, color: V.text3 }}>
          시작일 대비
        </span>
      </div>
    </div>
  )
}
