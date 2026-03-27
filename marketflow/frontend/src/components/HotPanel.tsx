'use client'

import React, { useEffect, useState } from 'react'
import DataPlaceholder from '@/components/DataPlaceholder'
import BilLabel from '@/components/BilLabel'

// ── Types ──────────────────────────────────────────────────────────────────────
export interface HotItem {
  symbol: string
  name: string
  pct_change_1d: number
  hot_score: number
  triggers: string[]
  triggers_all?: string[]
  streak: number
  price: number | null
  volume_ratio: number | null
  ai_score: number
  rsi14?: number | null
  tags: string[]
  reason_text: string
}

export interface OverviewHomeData {
  generated_at?: string
  hot_top5: HotItem[]
  volume_spike_top5: HotItem[]
  ai_picks_top5: HotItem[]
  streak_hot_top10: HotItem[]
  total_pool?: number
}

type PanelTab = 'hot' | 'volume' | 'ai'

// ── Palette ────────────────────────────────────────────────────────────────────
const C = {
  bull:       '#00C853',
  transition: '#FFB300',
  defensive:  '#FF7043',
  shock:      '#D32F2F',
  neutral:    '#5E6A75',
  accent:     '#0A5AFF',   // institutional deep blue
  rsi:        '#a78bfa',   // violet — RSI overbought only
} as const

// ── Color helpers ──────────────────────────────────────────────────────────────
function chgColor(v: number): string {
  return v >= 0 ? C.bull : C.defensive
}
function fmtPct(v: number | null): string {
  if (v == null) return 'N/A'
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'
}
function hotScoreColor(s: number): string {
  if (s >= 80) return C.shock
  if (s >= 50) return C.transition
  return C.neutral
}

// ── Trigger badge labels ───────────────────────────────────────────────────────
const TRIGGER_LABELS: Record<string, string> = {
  '3D_UP':        '3D UP',
  'VOLUME_2X':    'VOL 2x',
  'RSI>70':       'RSI70+',
  'NEW_HIGH_20D': '20D High',
  'AI_SCORE_90+': 'AI90+',
  'GAP_UP':       'Gap Up',
}
function TriggerBadge({ t }: { t: string }) {
  const colors: Record<string, string> = {
    '3D_UP':        C.bull,
    'VOLUME_2X':    C.transition,
    'RSI>70':       C.rsi,
    'NEW_HIGH_20D': C.accent,
    'AI_SCORE_90+': C.accent,
    'GAP_UP':       C.transition,
  }
  const col = colors[t] || C.neutral
  return (
    <span style={{
      fontSize: '0.7rem', fontWeight: 800, color: col,
      background: `${col}18`, border: `1px solid ${col}35`,
      borderRadius: 5, padding: '2px 6px',
    }}>
      {TRIGGER_LABELS[t] || t}
    </span>
  )
}

// ── Streak badge ───────────────────────────────────────────────────────────────
function StreakBadge({ streak }: { streak: number }) {
  if (streak < 3) return null
  const is5d = streak >= 5
  const color = is5d ? C.shock : C.transition
  return (
    <span style={{
      fontSize: '0.7rem', fontWeight: 800, color,
      background: `${color}18`, border: `1px solid ${color}40`,
      borderRadius: 5, padding: '2px 6px',
    }}>
      {is5d ? `HOT ${streak}d` : `${streak}d`}
    </span>
  )
}

// ── Drawer ─────────────────────────────────────────────────────────────────────
function Drawer({ item, onClose }: { item: HotItem; onClose: () => void }) {
  const chg = item.pct_change_1d
  const allTriggers = item.triggers_all || item.triggers
  const aiColor = item.ai_score >= 80 ? C.accent : C.transition

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          zIndex: 1000, backdropFilter: 'blur(2px)',
        }}
      />
      {/* Panel */}
      <div className="mf-drawer-panel" style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: 'min(420px, 92vw)',
        background: 'var(--bg-panel)', borderLeft: '1px solid rgba(148,163,184,0.16)',
        zIndex: 1001, overflow: 'auto', display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ padding: '1rem 1rem', borderBottom: '1px solid rgba(148,163,184,0.14)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'white' }}>{item.symbol}</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: chgColor(chg) }}>{fmtPct(chg)}</span>
              {item.price != null && (
                <span style={{ fontSize: '0.82rem', color: '#d7e1ee' }}>${item.price.toLocaleString()}</span>
              )}
            </div>
            <div style={{ color: '#9fb0c3', fontSize: '0.8rem', marginTop: '0.25rem', fontWeight: 500 }}>{item.name}</div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(148,163,184,0.15)', color: '#d7e1ee', borderRadius: 8, width: 40, height: 40, cursor: 'pointer', fontSize: '1rem', flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '0.95rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
          {/* Scores */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            {[
              { label: 'HOT Score', value: item.hot_score, color: hotScoreColor(item.hot_score) },
              { label: 'AI Score', value: item.ai_score, color: aiColor },
              {
                label: 'Vol Ratio',
                value: item.volume_ratio != null
                  ? `${item.volume_ratio.toFixed(1)}x`
                  : <DataPlaceholder reason="overview_home.json missing" cacheFile="overview_home.json" script="python backend/scripts/build_cache_json.py" />,
                color: '#e5e7eb',
              },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '0.7rem', textAlign: 'center', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: '0.64rem', color: '#9fb0c3', marginBottom: '0.3rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>{label}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Streak + RSI */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '0.6rem 0.9rem', flex: 1, minWidth: 100, border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: '0.64rem', color: '#9fb0c3', marginBottom: '0.25rem', fontWeight: 700, letterSpacing: '0.06em' }}>STREAK</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#e5e7eb' }}>{item.streak}d</span>
                <StreakBadge streak={item.streak} />
              </div>
            </div>
            {item.rsi14 != null && (
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '0.6rem 0.9rem', flex: 1, minWidth: 100, border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: '0.64rem', color: '#9fb0c3', marginBottom: '0.25rem', fontWeight: 700, letterSpacing: '0.06em' }}>RSI14</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: item.rsi14 >= 70 ? C.rsi : item.rsi14 <= 30 ? C.defensive : '#e5e7eb' }}>
                  {item.rsi14.toFixed(1)}
                </div>
              </div>
            )}
          </div>

          {/* Reason text */}
          <div style={{ background: `${C.accent}0c`, border: `1px solid ${C.accent}28`, borderRadius: 10, padding: '0.85rem 1rem' }}>
            <div style={{ fontSize: '0.66rem', color: '#d7e1ee', marginBottom: '0.4rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.08em' }}>Reason</div>
            <div style={{ fontSize: '0.9rem', color: '#edf3fb', lineHeight: 1.55, fontWeight: 500 }}>{item.reason_text}</div>
          </div>

          {/* All Triggers */}
          {allTriggers.length > 0 && (
            <div>
              <div style={{ fontSize: '0.66rem', color: '#9fb0c3', marginBottom: '0.5rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.08em' }}>All Triggers ({allTriggers.length})</div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {allTriggers.map(t => <TriggerBadge key={t} t={t} />)}
              </div>
            </div>
          )}

          {/* Tags */}
          {item.tags.length > 0 && (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {item.tags.map(tag => (
                <span key={tag} style={{
                  fontSize: '0.65rem', fontWeight: 700,
                  color: tag === 'HOT' ? C.shock : tag === 'AI' ? C.accent : C.neutral,
                  background: 'rgba(255,255,255,0.06)', borderRadius: 4, padding: '2px 7px',
                }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '0.85rem 1rem', borderTop: '1px solid rgba(148,163,184,0.12)', fontSize: '0.68rem', color: '#8da0b7' }}>
          Not financial advice. Educational purposes only.
        </div>
      </div>
    </>
  )
}

// ── Stock Row ──────────────────────────────────────────────────────────────────
function StockRow({ item, rank, onSelect }: { item: HotItem; rank: number; onSelect: (item: HotItem) => void }) {
  const chg = item.pct_change_1d
  const visibleTriggers = item.triggers.slice(0, 2)
  const hiddenTriggerCount = Math.max(0, item.triggers.length - visibleTriggers.length)

  return (
    <div
      onClick={() => onSelect(item)}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.6rem',
        padding: '0.42rem 0.55rem',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 8,
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
    >
      {/* Rank */}
      <span style={{ fontSize: '0.76rem', color: '#64748b', minWidth: 14, textAlign: 'right', fontWeight: 600 }}>{rank}</span>

      {/* Symbol + name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.32rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1rem', fontWeight: 800, color: 'white', letterSpacing: '-0.01em' }}>{item.symbol}</span>
          <StreakBadge streak={item.streak} />
          {visibleTriggers.map(t => <TriggerBadge key={t} t={t} />)}
          {hiddenTriggerCount > 0 && (
            <span style={{
              fontSize: '0.68rem', fontWeight: 700, color: '#cbd5e1',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 5, padding: '2px 5px',
            }}>
              +{hiddenTriggerCount}
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.8rem', color: '#8fa0b6', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.25 }}>
          {item.reason_text}
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateRows: 'auto auto', justifyItems: 'end', gap: 2, flexShrink: 0, minWidth: 74 }}>
        <span style={{ fontSize: '0.95rem', fontWeight: 800, color: chgColor(chg), lineHeight: 1 }}>{fmtPct(chg)}</span>
        <span style={{ fontSize: '0.7rem', color: hotScoreColor(item.hot_score), lineHeight: 1.15, fontWeight: 700 }}>
          HOT {item.hot_score}
        </span>
      </div>

      {/* Chevron */}
      <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>›</span>
    </div>
  )
}

// ── Panel Tabs ─────────────────────────────────────────────────────────────────
const TABS: { key: PanelTab; label: { ko: string; en: string }; icon: string }[] = [
  { key: 'hot',    label: { ko: 'HOT 상위5', en: 'HOT Top5' }, icon: '🔥' },
  { key: 'volume', label: { ko: '변동성 급등', en: 'Vol Spike' }, icon: '📊' },
  { key: 'ai',     label: { ko: 'AI 추천', en: 'AI Picks' }, icon: '🤖' },
]

export default function HotPanel({ data }: { data: OverviewHomeData }) {
  const [tab, setTab] = useState<PanelTab>('hot')
  const [selected, setSelected] = useState<HotItem | null>(null)
  const [expanded, setExpanded] = useState(false)

  const items: HotItem[] =
    tab === 'hot'    ? data.hot_top5 :
    tab === 'volume' ? data.volume_spike_top5 :
                       data.ai_picks_top5
  const visibleItems = expanded ? items.slice(0, 5) : items.slice(0, 3)

  return (
    <>
      {/* Panel */}
      <div style={{
        background: '#11161C',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14,
        overflow: 'hidden',
      }}>
        {/* Tab header */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 0.75rem' }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setExpanded(false) }}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                borderBottom: tab === t.key ? `2px solid ${C.accent}` : '2px solid transparent',
                color: tab === t.key ? C.accent : '#6b7280',
                fontSize: '0.88rem',
                fontWeight: tab === t.key ? 700 : 400,
                padding: '0.62rem 0.45rem',
                cursor: 'pointer',
                transition: 'color 0.15s',
                marginBottom: -1,
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                <span>{t.icon}</span>
                <span style={{ color: 'inherit' }}>
                  <BilLabel ko={t.label.ko} en={t.label.en} variant="micro" />
                </span>
              </span>
            </button>
          ))}
        </div>

        {/* Rows */}
        <div style={{ padding: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.38rem' }}>
          {items.length === 0 ? (
            <div style={{ color: '#6b7280', fontSize: '0.82rem', padding: '1rem 0.5rem' }}>No data yet. Run build_cache_json.py.</div>
          ) : (
            visibleItems.map((item, i) => (
              <StockRow key={item.symbol} item={item} rank={i + 1} onSelect={setSelected} />
            ))
          )}
          {items.length > 3 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              style={{
                marginTop: 2,
                background: 'rgba(255,255,255,0.02)',
                color: 'var(--text-secondary)',
                border: '1px dashed rgba(255,255,255,0.08)',
                borderRadius: 8,
                padding: '0.5rem 0.6rem',
                fontSize: '0.82rem',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>

        {/* Footer label */}
        {data.total_pool != null && (
          <div style={{ padding: '0.5rem 1rem 0.75rem', fontSize: '0.78rem', color: '#64748b' }}>
            Pool: {data.total_pool} tickers | Updated daily</div>
        )}
      </div>

      {/* Drawer */}
      {selected && <Drawer item={selected} onClose={() => setSelected(null)} />}
    </>
  )
}

// ── Streak Section (Row 3) ─────────────────────────────────────────────────────
export function StreakSection({ data }: { data: OverviewHomeData }) {
  const [selected, setSelected] = useState<HotItem | null>(null)
  const items = data.streak_hot_top10

  if (!items || items.length === 0) return null

  return (
    <>
      <div style={{
        background: '#11161C',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14,
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: C.transition, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            🔥 연속 HOT Top10
          </span>
          <span style={{ fontSize: '0.62rem', color: '#4b5563' }}>3일↑=🟡 5일↑=🔴</span>
        </div>

        {/* Grid of rows */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '0.5rem',
          padding: '0.75rem',
        }}>
          {items.map((item, i) => {
            const chg = item.pct_change_1d
            const is5d = item.streak >= 5
            const streakColor = is5d ? C.shock : item.streak >= 3 ? C.transition : C.neutral

            return (
              <div
                key={item.symbol}
                onClick={() => setSelected(item)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  padding: '0.5rem 0.7rem',
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px solid ${is5d ? `${C.shock}20` : 'rgba(255,255,255,0.05)'}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
              >
                {/* Rank */}
                <span style={{ fontSize: '0.62rem', color: '#4b5563', minWidth: 14, textAlign: 'right' }}>{i + 1}</span>

                {/* Streak badge */}
                <span style={{
                  fontSize: '0.72rem', fontWeight: 800, color: streakColor,
                  background: `${streakColor}15`, border: `1px solid ${streakColor}35`,
                  borderRadius: 6, padding: '2px 7px', minWidth: 36, textAlign: 'center', flexShrink: 0,
                }}>
                  {is5d ? '🔴' : '🟡'}{item.streak}d
                </span>

                {/* Symbol */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.83rem', fontWeight: 800, color: 'white' }}>{item.symbol}</span>
                    {item.triggers.slice(0, 1).map(t => <TriggerBadge key={t} t={t} />)}
                  </div>
                  <div style={{ fontSize: '0.6rem', color: '#6b7280', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.reason_text}
                  </div>
                </div>

                {/* Change */}
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: chgColor(chg), flexShrink: 0 }}>
                  {fmtPct(chg)}
                </span>
                <span style={{ fontSize: '0.65rem', color: '#4b5563' }}>›</span>
              </div>
            )
          })}
        </div>
      </div>

      {selected && <Drawer item={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
