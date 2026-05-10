'use client'
// AI Investment Tower 10-레이어 RRG 현황 보드 — 사분면 그룹 네비게이션

const V = {
  text:   '#E8F0F8',
  text2:  '#B8C8DC',
  text3:  '#8b9098',
  teal:   '#3FB6A8',
  green:  '#22c55e',
  amber:  '#fbbf24',
  red:    '#ef4444',
  purple: '#c026d3',
  bg2:    'rgba(255,255,255,0.03)',
  bg3:    'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.08)',
  ui:     "'IBM Plex Sans', sans-serif",
  mono:   "'IBM Plex Mono', monospace",
} as const

// ── Types ─────────────────────────────────────────────────────────────────────

export type LayerRRGBoardItem = {
  layerId:     string
  koreanLabel: string
  statusLabel: string
  rrgState:    'LEADING' | 'IMPROVING' | 'WEAKENING' | 'LAGGING' | 'MIXED' | 'UNKNOWN'
  riskLabel:   string
  signal?:     string
}

// ── Quadrant config ───────────────────────────────────────────────────────────

type QuadrantKey = 'LEADING' | 'IMPROVING' | 'WEAKENING' | 'LAGGING' | 'NEUTRAL'

const QUADRANTS: {
  key:     QuadrantKey
  states:  LayerRRGBoardItem['rrgState'][]
  title:   string
  helper:  string
  accent:  string
}[] = [
  {
    key:    'LEADING',
    states: ['LEADING'],
    title:  '주도 구간',
    helper: '상대적으로 강하고 흐름도 양호한 레이어입니다.',
    accent: V.green,
  },
  {
    key:    'IMPROVING',
    states: ['IMPROVING'],
    title:  '회복 구간',
    helper: '아직 완전한 주도는 아니지만 개선 흐름이 나타나는 레이어입니다.',
    accent: V.teal,
  },
  {
    key:    'WEAKENING',
    states: ['WEAKENING'],
    title:  '둔화 구간',
    helper: '아직 강하지만 단기 모멘텀이 약해지는 레이어입니다.',
    accent: V.amber,
  },
  {
    key:    'LAGGING',
    states: ['LAGGING'],
    title:  '소외 구간',
    helper: '상대적으로 약하고 회복 신호가 부족한 레이어입니다.',
    accent: V.red,
  },
  {
    key:    'NEUTRAL',
    states: ['MIXED', 'UNKNOWN'],
    title:  '확인 필요',
    helper: '신호가 혼재되어 추가 확인이 필요한 레이어입니다.',
    accent: V.text3,
  },
]

// ── Risk helpers ──────────────────────────────────────────────────────────────

const RISK_COLOR: Record<string, string> = {
  LOW:      V.green,
  MODERATE: V.teal,
  ELEVATED: V.amber,
  HIGH:     V.red,
  EXTREME:  V.purple,
  UNKNOWN:  V.text3,
}

const RISK_KR: Record<string, string> = {
  LOW:      '안정',
  MODERATE: '주의',
  ELEVATED: '과열',
  HIGH:     '고위험',
  EXTREME:  '극단',
  UNKNOWN:  '—',
}

// ── Layer chip ────────────────────────────────────────────────────────────────

function LayerChip({
  item,
  selected,
  accent,
  onClick,
}: {
  item:     LayerRRGBoardItem
  selected: boolean
  accent:   string
  onClick:  () => void
}) {
  const riskColor = RISK_COLOR[item.riskLabel] ?? V.text3
  const riskKr    = RISK_KR[item.riskLabel]   ?? '—'

  return (
    <button
      onClick={onClick}
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          6,
        padding:      '4px 10px 4px 8px',
        borderRadius: 5,
        border:       selected
          ? `1px solid ${accent}80`
          : `1px solid ${V.border}`,
        background:   selected
          ? `${accent}12`
          : V.bg3,
        cursor:       'pointer',
        textAlign:    'left',
        width:        '100%',
        transition:   'border-color 0.12s, background 0.12s',
      }}
    >
      {/* Risk dot */}
      <span style={{
        width:        6,
        height:       6,
        borderRadius: '50%',
        background:   riskColor,
        flexShrink:   0,
      }} />

      {/* Layer name */}
      <span style={{
        fontFamily: V.ui,
        fontSize:   12,
        color:      selected ? V.text : V.text2,
        fontWeight: selected ? 600 : 400,
        flex:       1,
        whiteSpace: 'nowrap',
        overflow:   'hidden',
        textOverflow: 'ellipsis',
      }}>
        {item.koreanLabel}
      </span>

      {/* Risk badge */}
      {(item.riskLabel === 'ELEVATED' || item.riskLabel === 'HIGH' || item.riskLabel === 'EXTREME') && (
        <span style={{
          fontFamily:   V.mono,
          fontSize:     9,
          color:        riskColor,
          background:   `${riskColor}18`,
          border:       `1px solid ${riskColor}40`,
          borderRadius: 3,
          padding:      '0 5px',
          whiteSpace:   'nowrap',
          letterSpacing:'0.04em',
        }}>
          {riskKr}
        </span>
      )}
    </button>
  )
}

// ── Quadrant card ─────────────────────────────────────────────────────────────

function QuadrantCard({
  title,
  helper,
  accent,
  items,
  selectedLayerId,
  onSelectLayer,
}: {
  title:          string
  helper:         string
  accent:         string
  items:          LayerRRGBoardItem[]
  selectedLayerId: string | null
  onSelectLayer:  (id: string) => void
}) {
  return (
    <div style={{
      flex:         '1 1 0',
      minWidth:     150,
      padding:      '10px 12px 12px',
      background:   V.bg2,
      border:       `1px solid ${V.border}`,
      borderTop:    `2px solid ${accent}50`,
      borderRadius: 6,
      display:      'flex',
      flexDirection:'column',
      gap:          6,
    }}>
      {/* Title */}
      <div style={{ fontFamily: V.mono, fontSize: 11, color: accent, fontWeight: 700, letterSpacing: '0.06em' }}>
        {title}
      </div>

      {/* Helper */}
      <div style={{ fontFamily: V.ui, fontSize: 10, color: V.text3, lineHeight: 1.5, marginBottom: 2 }}>
        {helper}
      </div>

      {/* Layer chips */}
      {items.length === 0 ? (
        <div style={{ fontFamily: V.ui, fontSize: 11, color: V.text3, fontStyle: 'italic' }}>
          해당 레이어 없음
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.map(item => (
            <LayerChip
              key={item.layerId}
              item={item}
              selected={selectedLayerId === item.layerId}
              accent={accent}
              onClick={() => onSelectLayer(item.layerId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main board ────────────────────────────────────────────────────────────────

export function AIInvestmentLayerRRGBoard({
  items,
  selectedLayerId,
  onSelectLayer,
}: {
  items:           LayerRRGBoardItem[]
  selectedLayerId: string | null
  onSelectLayer:   (layerId: string) => void
}) {
  return (
    <div style={{
      background:   V.bg2,
      border:       `1px solid ${V.border}`,
      borderRadius: 6,
      marginBottom: 16,
      overflow:     'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding:      '9px 16px 8px',
        borderBottom: `1px solid ${V.border}`,
        display:      'flex',
        alignItems:   'center',
        gap:          8,
      }}>
        <span style={{ fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.10em', flex: 1 }}>
          10-LAYER RRG 현황
        </span>
        <span style={{ fontFamily: V.ui, fontSize: 11, color: V.text3 }}>
          레이어를 클릭하면 상세 정보가 업데이트됩니다.
        </span>
      </div>

      {/* Quadrant grid */}
      <div style={{ padding: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {QUADRANTS.map(q => {
          const qItems = items.filter(item => q.states.includes(item.rrgState))
          return (
            <QuadrantCard
              key={q.key}
              title={q.title}
              helper={q.helper}
              accent={q.accent}
              items={qItems}
              selectedLayerId={selectedLayerId}
              onSelectLayer={onSelectLayer}
            />
          )
        })}
      </div>
    </div>
  )
}
