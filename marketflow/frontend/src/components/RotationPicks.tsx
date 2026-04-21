'use client'
import { useEffect, useState } from 'react'

// ── 타입 (sector_rotation.json 기준) ─────────────────────────────
interface SectorPerfItem {
  symbol: string
  name: string
  price: number | null
  change_1d: number | null
  change_1w: number | null
  change_1m: number | null
  change_3m: number | null
  change_6m: number | null
  change_1y: number | null
  rank_3m: number
}

interface RotationStock {
  symbol: string
  score: number
  signal: string
  relative_strength: number
  stock_return_3m: number
  sector_return_3m: number
  volume_ratio: number
  current_price: number
  pivot: number
  distance_to_pivot: number
  rsi: number
  above_sma20: boolean
  above_sma50: boolean
  sma_cross: boolean
  vol_contraction: boolean
}

interface Coverage {
  ohlcv_symbols: number
  total_universe: number
  coverage_pct: number
  latest_date: string | null
  etf_missing: string[]
  etf_missing_cnt: number
  low_coverage: boolean
}

interface SectorRotationData {
  generated_at: string
  phase: string
  phase_label: string
  phase_color: string
  leading_sectors: string[]
  lagging_sectors: string[]
  sector_perf: SectorPerfItem[]
  rotation_picks_top: RotationStock[]
  coverage: Coverage
}

// ── 상수 ─────────────────────────────────────────────────────────
const PHASE_ICON: Record<string, string> = {
  early_recovery: '🌱',
  expansion:      '🚀',
  peak:           '🏔',
  slowdown:       '🍂',
}

const SIGNAL_COLOR: Record<string, string> = {
  'Strong Buy': '#22c55e',
  'Buy':        '#00D9FF',
  'Watch':      '#f59e0b',
}

const ALL_PHASES = [
  { key: 'early_recovery', label: 'Early Recovery', sectors: 'XLK · XLY · XLC', color: '#22c55e' },
  { key: 'expansion',      label: 'Expansion',      sectors: 'XLI · XLB · XLE', color: '#00D9FF' },
  { key: 'peak',           label: 'Peak',           sectors: 'XLF · XLRE',       color: '#f59e0b' },
  { key: 'slowdown',       label: 'Slowdown',       sectors: 'XLV · XLP · XLU',  color: '#ef4444' },
]

// ── 컴포넌트 ─────────────────────────────────────────────────────
function PhaseWheel({ current }: { current: string }) {
  return (
    <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
      {ALL_PHASES.map(p => {
        const active = p.key === current
        return (
          <div key={p.key} style={{
            padding: '0.42rem 0.75rem',
            borderRadius: 9999,
            border: `1px solid ${active ? p.color : 'rgba(255,255,255,0.06)'}`,
            background: active ? `${p.color}16` : 'rgba(255,255,255,0.01)',
            opacity: active ? 1 : 0.62,
            transition: 'all 0.3s',
          }}>
            <div style={{ fontSize: '0.78rem', fontWeight: active ? 800 : 600, color: active ? p.color : '#97A5BA' }}>
              {PHASE_ICON[p.key]} {p.label}
            </div>
            <div style={{ fontSize: '0.64rem', color: '#7E8EA7', marginTop: 2 }}>{p.sectors}</div>
          </div>
        )
      })}
    </div>
  )
}

function SectorBadge({
  item, isLeading, isLagging,
}: {
  item: SectorPerfItem
  isLeading: boolean
  isLagging: boolean
}) {
  const ret = item.change_3m ?? 0
  const retColor = ret >= 0 ? '#22c55e' : '#ef4444'
  const borderColor = isLeading ? 'rgba(0,217,255,0.25)' : isLagging ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'
  const bgColor     = isLeading ? 'rgba(0,217,255,0.06)' : isLagging ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.02)'
  return (
    <div style={{
      background: bgColor, border: `1px solid ${borderColor}`,
      borderRadius: 10, padding: '0.6rem 0.875rem',
      display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, color: isLeading ? '#00D9FF' : isLagging ? '#ef4444' : '#9ca3af', fontSize: '0.8rem' }}>
          {item.symbol}
        </span>
        {isLeading && <span style={{ fontSize: '0.66rem', color: '#34e7ff', border: '1px solid rgba(0,217,255,0.34)', borderRadius: 4, padding: '2px 5px', fontWeight: 700 }}>TOP</span>}
        {isLagging && <span style={{ fontSize: '0.66rem', color: '#fb7185', border: '1px solid rgba(239,68,68,0.32)', borderRadius: 4, padding: '2px 5px', fontWeight: 700 }}>LAG</span>}
      </div>
      <div style={{ fontSize: '0.8rem', color: '#A6B7CF', lineHeight: 1.25, fontWeight: 500 }}>{item.name}</div>
      <div style={{ display: 'flex', gap: 8, fontSize: '0.84rem' }}>
        <span style={{ color: retColor, fontWeight: 700 }}>
          {ret >= 0 ? '+' : ''}{ret.toFixed(2)}%
        </span>
        <span style={{ color: '#93A8C4', fontSize: '0.72rem', fontWeight: 600 }}>3M</span>
      </div>
      {item.change_1d != null && (
        <div style={{ fontSize: '0.78rem', color: item.change_1d >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
          {item.change_1d >= 0 ? '+' : ''}{item.change_1d.toFixed(2)}% 1D
        </div>
      )}
    </div>
  )
}

function CoverageBadge({ coverage }: { coverage: Coverage }) {
  const isLow = coverage.low_coverage
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: isLow ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.08)',
      border: `1px solid ${isLow ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.2)'}`,
      borderRadius: 999, padding: '2px 10px', fontSize: '0.68rem',
    }}>
      <span style={{ color: isLow ? '#f59e0b' : '#22c55e', fontWeight: 700 }}>
        {coverage.ohlcv_symbols}/{coverage.total_universe}
      </span>
      <span style={{ color: '#6b7280' }}>DB coverage</span>
      {coverage.etf_missing_cnt > 0 && (
        <span style={{ color: '#f59e0b' }}>· {coverage.etf_missing_cnt} ETF missing</span>
      )}
    </div>
  )
}

function formatPct(v: number | null | undefined) {
  if (typeof v !== 'number' || Number.isNaN(v)) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

function buildSectorNarrative(data: SectorRotationData, sorted: SectorPerfItem[]) {
  const top3 = sorted.slice(0, 3)
  const bottom3 = [...sorted].slice(-3)
  const oneDayLeaders = [...data.sector_perf]
    .filter((s) => typeof s.change_1d === 'number')
    .sort((a, b) => (b.change_1d ?? -999) - (a.change_1d ?? -999))
    .slice(0, 2)
  const oneDayLaggards = [...data.sector_perf]
    .filter((s) => typeof s.change_1d === 'number')
    .sort((a, b) => (a.change_1d ?? 999) - (b.change_1d ?? 999))
    .slice(0, 2)

  const topNames = top3.map((s) => s.symbol).join(', ')
  const bottomNames = bottom3.map((s) => s.symbol).join(', ')
  const leadNames = oneDayLeaders.map((s) => `${s.symbol}(${formatPct(s.change_1d)})`).join(' · ')
  const lagNames = oneDayLaggards.map((s) => `${s.symbol}(${formatPct(s.change_1d)})`).join(' · ')

  return {
    ko: [
      top3.length
        ? `최근 3개월 기준 상대 강도는 ${topNames} 중심으로 우세합니다.`
        : '최근 섹터 상대 강도 데이터가 제한적입니다.',
      oneDayLeaders.length
        ? `당일 기준 강세는 ${leadNames} 쪽에 모이고 있습니다.`
        : '당일 섹터 강세/약세 데이터 확인이 필요합니다.',
      bottom3.length
        ? `반대로 ${bottomNames}${oneDayLaggards.length ? ` (당일 약세: ${lagNames})` : ''}는 상대적으로 둔한 흐름입니다.`
        : '약세 섹터 해석은 추가 데이터 확인이 필요합니다.',
    ],
    en: [
      top3.length
        ? `3M relative strength is concentrated in ${topNames}.`
        : 'Sector relative-strength data is limited right now.',
      oneDayLeaders.length
        ? `On a 1D basis, leadership is leaning toward ${leadNames}.`
        : '1D sector leadership data needs verification.',
      bottom3.length
        ? `${bottomNames}${oneDayLaggards.length ? ` (1D laggards: ${lagNames})` : ''} remain relatively weak.`
        : 'Laggard interpretation needs more data.',
    ],
  }
}

function StockRow({ s, rank }: { s: RotationStock; rank: number }) {
  const sigColor = SIGNAL_COLOR[s.signal] || '#6b7280'
  const rsColor  = s.relative_strength >= 0 ? '#22c55e' : '#ef4444'
  const retColor = s.stock_return_3m >= 0 ? '#22c55e' : '#ef4444'
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '28px 80px 60px 70px 70px 70px 60px 60px auto',
      gap: '0.5rem', alignItems: 'center',
      padding: '0.6rem 0.75rem', borderRadius: 8,
      background: rank <= 3 ? 'rgba(0,217,255,0.04)' : 'rgba(255,255,255,0.02)',
      border: `1px solid ${rank <= 3 ? 'rgba(0,217,255,0.12)' : 'rgba(255,255,255,0.04)'}`,
    }}>
      <span style={{ fontSize: '0.7rem', color: rank <= 3 ? '#00D9FF' : '#4b5563', fontWeight: 700, textAlign: 'center' }}>
        {rank}
      </span>
      <div>
        <div style={{ fontWeight: 700, color: '#00D9FF', fontSize: '0.85rem' }}>{s.symbol}</div>
        <div style={{ fontSize: '0.82rem', color: '#A8BAD2', fontWeight: 500 }}>${s.current_price}</div>
      </div>
      <span style={{
        padding: '2px 6px', borderRadius: 9999,
        background: `${sigColor}18`, color: sigColor,
        fontSize: '0.6rem', fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap',
      }}>{s.signal}</span>
      <div>
        <div style={{ fontSize: '0.72rem', color: '#93A5BE', fontWeight: 500 }}>Score</div>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'white' }}>{s.score}</div>
      </div>
      <div>
        <div style={{ fontSize: '0.72rem', color: '#93A5BE', fontWeight: 500 }}>RS</div>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: rsColor }}>
          {s.relative_strength >= 0 ? '+' : ''}{s.relative_strength}%
        </div>
      </div>
      <div>
        <div style={{ fontSize: '0.72rem', color: '#93A5BE', fontWeight: 500 }}>3M</div>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: retColor }}>
          {s.stock_return_3m >= 0 ? '+' : ''}{s.stock_return_3m}%
        </div>
      </div>
      <div>
        <div style={{ fontSize: '0.72rem', color: '#93A5BE', fontWeight: 500 }}>Pivot</div>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: s.distance_to_pivot < 3 ? '#22c55e' : 'white' }}>
          -{s.distance_to_pivot.toFixed(1)}%
        </div>
      </div>
      <div>
        <div style={{ fontSize: '0.72rem', color: '#93A5BE', fontWeight: 500 }}>Vol×</div>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: s.volume_ratio > 1.2 ? '#22c55e' : 'white' }}>
          {s.volume_ratio}×
        </div>
      </div>
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {[
          { label: 'SMA20', ok: s.above_sma20 },
          { label: 'SMA50', ok: s.above_sma50 },
          { label: 'Cross', ok: s.sma_cross },
          { label: 'VDry',  ok: s.vol_contraction },
        ].map(({ label, ok }) => (
          <span key={label} style={{
            fontSize: '0.64rem', padding: '2px 6px', borderRadius: 4,
            background: ok ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)',
            color: ok ? '#34d399' : '#94A6C0',
            border: ok ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(255,255,255,0.05)',
            fontWeight: ok ? 700 : 600,
          }}>{label}</span>
        ))}
      </div>
    </div>
  )
}

export default function RotationPicks() {
  const [data, setData] = useState<SectorRotationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(false)

  useEffect(() => {
    fetch('/api/sector-rotation')
      .then(r => r.json())
      .then(d => {
        if (!d.error) setData(d)
        else setErr(true)
        setLoading(false)
      })
      .catch(() => { setErr(true); setLoading(false) })
  }, [])

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>Loading sector rotation...</div>
  }
  if (err || !data) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
        Sector rotation cache not available. Run backend pipeline.
      </div>
    )
  }

  const sorted = [...data.sector_perf].sort((a, b) => (a.rank_3m ?? 99) - (b.rank_3m ?? 99))
  const sectorNarrative = buildSectorNarrative(data, sorted)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Phase header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1.1fr) minmax(280px, 1fr) auto', alignItems: 'start', gap: '0.75rem' }} className="max-xl:grid-cols-1">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.6rem' }}>{PHASE_ICON[data.phase] || '📊'}</span>
            <div>
              <div style={{ fontSize: '1.34rem', fontWeight: 900, color: data.phase_color }}>
                {data.phase_label || data.phase}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#B8C7DA', marginTop: 4, lineHeight: 1.35, fontWeight: 500 }}>
                Leading: {data.leading_sectors.join(' · ')}
                {data.lagging_sectors.length > 0 && (
                  <> &nbsp;·&nbsp; Lagging: <span style={{ color: '#ef4444' }}>{data.lagging_sectors.join(' · ')}</span></>
                )}
              </div>
            </div>
          </div>
          {/* Phase wheel becomes a secondary cycle map (less duplicated emphasis) */}
          <div style={{ marginTop: '0.55rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ color: '#AFC0D8', fontSize: '0.76rem', fontWeight: 700, letterSpacing: '0.08em' }}>
              CYCLE MAP
            </div>
            <PhaseWheel current={data.phase} />
          </div>
        </div>
        <div
          style={{
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.02)',
            padding: '0.75rem 0.9rem',
            minHeight: 92,
            marginTop: '0.15rem',
          }}
        >
          <div style={{ color: '#F2F7FF', fontWeight: 900, fontSize: '1.02rem' }}>
            최근 섹터 흐름 요약
          </div>
          <div style={{ color: '#45E6FF', fontSize: '0.82rem', marginTop: 3, letterSpacing: '0.08em', fontWeight: 700 }}>
            SECTOR READ
          </div>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5, lineHeight: 1.4 }}>
            {sectorNarrative.ko.slice(0, 3).map((line, i) => (
              <div key={`ko-${i}`} style={{ color: '#D5E0EF', fontSize: '0.96rem', fontWeight: 500 }}>{line}</div>
            ))}
            {sectorNarrative.en.slice(0, 2).map((line, i) => (
              <div key={`en-${i}`} style={{ color: '#9AAECE', fontSize: '0.86rem' }}>{line}</div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          {data.coverage && <CoverageBadge coverage={data.coverage} />}
          <span style={{ fontSize: '0.68rem', color: '#374151' }}>
            {data.generated_at?.slice(0, 16).replace('T', ' ')}
          </span>
        </div>
      </div>

      {/* Sector performance grid — 단일 소스: sector_perf */}
      <div>
        <div style={{ fontSize: '0.9rem', color: '#BDCAE0', marginBottom: '0.55rem', letterSpacing: '0.08em', fontWeight: 800 }}>
          SECTOR PERFORMANCE — 3M RANK
        </div>
        {sorted.length === 0 ? (
          <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>
            No sector performance data. Run <code style={{ color: '#f59e0b' }}>sector_performance.py</code> first.
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {sorted.map(item => (
              <SectorBadge
                key={item.symbol}
                item={item}
                isLeading={data.leading_sectors.includes(item.symbol)}
                isLagging={data.lagging_sectors.includes(item.symbol)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Top rotation stocks */}
      <div>
        <div style={{ fontSize: '0.82rem', color: '#AEBED4', marginBottom: '0.5rem', letterSpacing: '0.08em', fontWeight: 700 }}>
          TOP ROTATION PICKS — {data.rotation_picks_top.length} 종목
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {data.rotation_picks_top.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
              No rotation picks. Run{' '}
              <code style={{ color: '#f59e0b' }}>sector_rotation_stocks.py</code> to generate.
            </div>
          ) : (
            data.rotation_picks_top.map((s, i) => <StockRow key={s.symbol} s={s} rank={i + 1} />)
          )}
        </div>
      </div>

      {/* Coverage warning */}
      {data.coverage?.etf_missing_cnt > 0 && (
        <div style={{
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: 8, padding: '0.6rem 0.875rem', fontSize: '0.72rem', color: '#9ca3af',
        }}>
          ⚠ ETF OHLCV missing ({data.coverage.etf_missing.join(', ')}).
          Run <span style={{ color: '#f59e0b' }}>update_ohlcv.py</span> to populate DB.
          ETFs have been added to universe_symbols and will be fetched automatically.
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.65rem', color: '#4b5563', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem' }}>
        <span><span style={{ color: '#22c55e' }}>●</span> Strong Buy (≥85)</span>
        <span><span style={{ color: '#00D9FF' }}>●</span> Buy (70-84)</span>
        <span><span style={{ color: '#f59e0b' }}>●</span> Watch (&lt;70)</span>
        <span style={{ marginLeft: 'auto' }}>
          Source: <span style={{ color: '#6b7280' }}>sector_rotation.json</span>
        </span>
      </div>
    </div>
  )
}
