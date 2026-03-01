'use client'

import { CSSProperties, useEffect, useMemo, useState } from 'react'

interface HotItem {
  symbol: string
  name: string
  sector: string
  price: number
  change_pct: number
  volume: number
  vol_ratio: number | null
  rsi14: number | null
  ai_score: number
  tags: string[]
  triggers: string[]
  hot_score: number
  streak: number
}

interface HotSummary {
  data_date: string | null
  total_symbols: number
  hot_symbols: number
  streak_3plus: number
  avg_hot_score: number
  leaders_count: number
  trending_count: number
  trigger_counts: Record<string, number>
}

interface HotZoneData {
  generated_at: string
  leaders: HotItem[]
  trending: HotItem[]
  summary: HotSummary
}

type TabKey = 'leaders' | 'trending'

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'leaders', label: 'Leaders', icon: '🏁' },
  { key: 'trending', label: 'Trending', icon: '📈' },
]

const TAG_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  HOT: { bg: 'rgba(239,68,68,0.18)', color: '#fca5a5', border: 'rgba(239,68,68,0.45)' },
  GAIN: { bg: 'rgba(34,197,94,0.15)', color: '#86efac', border: 'rgba(34,197,94,0.4)' },
  VOLUME_SPIKE: { bg: 'rgba(139,92,246,0.18)', color: '#c4b5fd', border: 'rgba(139,92,246,0.45)' },
  AI: { bg: 'rgba(0,217,255,0.12)', color: '#67e8f9', border: 'rgba(0,217,255,0.4)' },
  BREAKOUT: { bg: 'rgba(245,158,11,0.15)', color: '#fcd34d', border: 'rgba(245,158,11,0.4)' },
}

const TRIGGER_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  '3D_UP': { bg: 'rgba(34,197,94,0.16)', color: '#86efac', border: 'rgba(34,197,94,0.45)' },
  'VOLUME_2X': { bg: 'rgba(139,92,246,0.18)', color: '#d8b4fe', border: 'rgba(139,92,246,0.45)' },
  'RSI>70': { bg: 'rgba(245,158,11,0.18)', color: '#fcd34d', border: 'rgba(245,158,11,0.45)' },
  'NEW_HIGH_20D': { bg: 'rgba(251,191,36,0.16)', color: '#fde68a', border: 'rgba(251,191,36,0.45)' },
  'AI_SCORE_90+': { bg: 'rgba(6,182,212,0.16)', color: '#67e8f9', border: 'rgba(6,182,212,0.45)' },
  'GAP_UP': { bg: 'rgba(239,68,68,0.16)', color: '#fca5a5', border: 'rgba(239,68,68,0.45)' },
}

function badgeStyle(tag: string): CSSProperties {
  const c = TAG_COLORS[tag] ?? { bg: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: 'rgba(255,255,255,0.15)' }
  return {
    background: c.bg,
    color: c.color,
    border: `1px solid ${c.border}`,
    borderRadius: 999,
    padding: '2px 7px',
    fontSize: '0.62rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
  }
}

function triggerStyle(trigger: string): CSSProperties {
  const c = TRIGGER_COLORS[trigger] ?? { bg: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: 'rgba(255,255,255,0.15)' }
  return {
    background: c.bg,
    color: c.color,
    border: `1px solid ${c.border}`,
    borderRadius: 999,
    padding: '2px 7px',
    fontSize: '0.61rem',
    fontWeight: 800,
    letterSpacing: '0.02em',
    whiteSpace: 'nowrap',
  }
}

function scoreBadge(score: number): CSSProperties {
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#6b7280'
  return {
    background: `${color}22`,
    color,
    border: `1px solid ${color}66`,
    borderRadius: 6,
    padding: '1px 6px',
    fontSize: '0.68rem',
    fontWeight: 800,
    minWidth: 34,
    textAlign: 'center',
  }
}

function changePctColor(v: number): string {
  if (v > 0) return '#22c55e'
  if (v < 0) return '#ef4444'
  return '#9ca3af'
}

function HotCard({ item }: { item: HotItem }) {
  const isOnFire = Number(item.streak || 0) >= 3
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #1a1d24 0%, #151720 100%)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 12,
        padding: '0.82rem 0.9rem',
        display: 'flex',
        flexDirection: 'column',
        gap: 7,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ color: '#f0f4ff', fontWeight: 800, fontSize: '0.95rem', letterSpacing: '0.02em' }}>
            {item.symbol} {isOnFire ? '🔥' : ''}
          </span>
          <span style={scoreBadge(item.hot_score)}>{item.hot_score}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#e5e7eb', fontSize: '0.82rem', fontWeight: 700 }}>
            ${Number(item.price || 0).toFixed(2)}
          </div>
          <div style={{ color: changePctColor(item.change_pct), fontSize: '0.78rem', fontWeight: 700 }}>
            {item.change_pct > 0 ? '+' : ''}{Number(item.change_pct || 0).toFixed(2)}%
          </div>
        </div>
      </div>

      <div style={{ color: '#6b7280', fontSize: '0.72rem', lineHeight: 1.3, minHeight: 20 }}>
        <span style={{ color: '#9ca3af' }}>{item.name?.length > 22 ? item.name.slice(0, 22) + '..' : item.name}</span>
        {item.sector && (
          <span style={{ marginLeft: 4, color: '#4b5563' }}>| {item.sector.split(' ')[0]}</span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, fontSize: '0.7rem', color: '#6b7280' }}>
        <span>
          Streak <span style={{ color: isOnFire ? '#f97316' : '#9ca3af', fontWeight: 700 }}>{Number(item.streak || 0)}</span>
        </span>
        {item.vol_ratio != null && (
          <span>
            Vol <span style={{ color: item.vol_ratio >= 2 ? '#c4b5fd' : '#9ca3af', fontWeight: 700 }}>{item.vol_ratio.toFixed(1)}x</span>
          </span>
        )}
        {item.rsi14 != null && (
          <span>
            RSI <span style={{ color: item.rsi14 >= 70 ? '#fcd34d' : item.rsi14 <= 35 ? '#f87171' : '#9ca3af', fontWeight: 700 }}>{item.rsi14.toFixed(0)}</span>
          </span>
        )}
      </div>

      {item.triggers?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {item.triggers.map((trigger) => (
            <span key={trigger} style={triggerStyle(trigger)}>{trigger}</span>
          ))}
        </div>
      )}

      {item.tags?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {item.tags.map((tag) => (
            <span key={tag} style={badgeStyle(tag)}>{tag}</span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function HotZone() {
  const [data, setData] = useState<HotZoneData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('leaders')

  useEffect(() => {
    fetch('http://localhost:5001/api/hot-zone')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(setData)
      .catch((e) => setError(e.message))
  }, [])

  const items: HotItem[] = useMemo(() => {
    if (!data) return []
    const raw = data[activeTab] ?? []
    return [...raw].sort((a, b) => {
      if ((b.hot_score || 0) !== (a.hot_score || 0)) return (b.hot_score || 0) - (a.hot_score || 0)
      if ((b.streak || 0) !== (a.streak || 0)) return (b.streak || 0) - (a.streak || 0)
      return (b.change_pct || 0) - (a.change_pct || 0)
    })
  }, [data, activeTab])

  if (error) {
    return (
      <div style={{ color: '#f87171', fontSize: '0.9rem', padding: '0.75rem 1rem', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 10 }}>
        HOT ZONE unavailable: {error}
      </div>
    )
  }

  if (!data) {
    return (
      <div style={{ color: '#4b5563', fontSize: '0.85rem', padding: '1rem', textAlign: 'center' }}>
        Loading HOT ZONE...
      </div>
    )
  }

  const summary = data.summary || {
    data_date: null,
    total_symbols: 0,
    hot_symbols: 0,
    streak_3plus: 0,
    avg_hot_score: 0,
    leaders_count: 0,
    trending_count: 0,
    trigger_counts: {},
  }

  return (
    <div
      style={{
        background: 'linear-gradient(145deg, #0f1117 0%, #0c0e14 100%)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 16,
        padding: '1.1rem 1.2rem',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.9rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
          <div
            style={{
              background: 'linear-gradient(135deg, #ef4444, #f97316)',
              borderRadius: 8,
              padding: '3px 9px',
              color: '#fff',
              fontWeight: 900,
              fontSize: '0.78rem',
              letterSpacing: '0.1em',
              boxShadow: '0 0 14px rgba(239,68,68,0.45)',
            }}
          >
            HOT ZONE v2
          </div>
          <span style={{ color: '#374151', fontSize: '0.72rem' }}>
            {summary.data_date || '-'} | total {summary.total_symbols}
          </span>
        </div>
        <span style={{ color: '#374151', fontSize: '0.68rem' }}>
          {data.generated_at?.slice(11, 16)} updated
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginBottom: '0.8rem' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '0.45rem 0.55rem' }}>
          <div style={{ fontSize: '0.68rem', color: '#6b7280' }}>HOT Symbols</div>
          <div style={{ fontSize: '0.9rem', color: '#fca5a5', fontWeight: 800 }}>{summary.hot_symbols}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '0.45rem 0.55rem' }}>
          <div style={{ fontSize: '0.68rem', color: '#6b7280' }}>Streak 3+</div>
          <div style={{ fontSize: '0.9rem', color: '#fb923c', fontWeight: 800 }}>{summary.streak_3plus}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '0.45rem 0.55rem' }}>
          <div style={{ fontSize: '0.68rem', color: '#6b7280' }}>Avg Hot Score</div>
          <div style={{ fontSize: '0.9rem', color: '#22c55e', fontWeight: 800 }}>{Number(summary.avg_hot_score || 0).toFixed(1)}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '0.45rem 0.55rem' }}>
          <div style={{ fontSize: '0.68rem', color: '#6b7280' }}>Leaders / Trending</div>
          <div style={{ fontSize: '0.9rem', color: '#93c5fd', fontWeight: 800 }}>{summary.leaders_count} / {summary.trending_count}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: '0.9rem', flexWrap: 'wrap' }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key
          const count = (data[tab.key] ?? []).length
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: isActive
                  ? 'linear-gradient(135deg, rgba(239,68,68,0.25), rgba(249,115,22,0.15))'
                  : 'rgba(255,255,255,0.03)',
                border: isActive ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8,
                color: isActive ? '#fca5a5' : '#6b7280',
                padding: '0.38rem 0.7rem',
                fontSize: '0.78rem',
                fontWeight: isActive ? 700 : 400,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 150ms',
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              <span
                style={{
                  background: isActive ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.07)',
                  borderRadius: 999,
                  padding: '0px 6px',
                  fontSize: '0.65rem',
                  color: isActive ? '#fca5a5' : '#4b5563',
                  fontWeight: 700,
                }}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {items.length === 0 ? (
        <div style={{ color: '#374151', fontSize: '0.85rem', padding: '1rem 0', textAlign: 'center' }}>
          No data available for this section.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '0.65rem',
          }}
        >
          {items.map((item) => (
            <HotCard key={`${activeTab}-${item.symbol}`} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
