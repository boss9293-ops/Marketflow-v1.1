'use client'
import { useEffect, useState } from 'react'
import type { ScenarioId }    from '@/types/scenarioMapping'
import type { MonitoredTopic } from '@/types/researchMonitor'
import { loadMonitoredTopics }  from '@/lib/researchMonitorStorage'
import { buildScenarioMappings } from '@/lib/scenarioMappingBuilder'
import {
  SCENARIO_HISTORY_MAP,
  SCENARIO_INTERPRETATION,
  MAX_HISTORY_ITEMS,
  type HistoricalItem,
  type HistoricalContext,
} from '@/lib/text/historicalContextMap'

// ── Derive best historical context from current scenario mappings ─────────────

function deriveContext(topics: MonitoredTopic[]): HistoricalContext | null {
  const mappings = buildScenarioMappings(topics)
  if (mappings.length === 0) return null

  // Prefer 'support' scenarios, then 'mixed'; sort by fit_score descending
  const ranked = [...mappings].sort((a, b) => b.fit_score - a.fit_score)
  const top = ranked.find(m => m.fit === 'support') ?? ranked.find(m => m.fit === 'mixed')

  if (!top) return null

  const id = top.scenario_id as ScenarioId
  const items = (SCENARIO_HISTORY_MAP[id] ?? []).slice(0, MAX_HISTORY_ITEMS)
  if (items.length === 0) return null

  return {
    items,
    interpretation: SCENARIO_INTERPRETATION[id] ?? '',
    scenario_label: top.scenario_label,
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function HistoryItem({ item }: { item: HistoricalItem }) {
  return (
    <div style={{
      padding:      '0.5rem 0.7rem',
      background:   'rgba(255,255,255,0.02)',
      borderRadius: 8,
      borderLeft:   '2px solid rgba(99,102,241,0.3)',
    }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#c7d2fe', marginBottom: 3 }}>
        {item.label}
      </div>
      <div style={{ fontSize: '0.77rem', color: '#94a3b8', lineHeight: 1.55 }}>
        {item.description}
      </div>
    </div>
  )
}

function EmptyContext() {
  return (
    <div style={{ fontSize: '0.8rem', color: '#475569', fontStyle: 'italic', padding: '0.25rem 0' }}>
      No direct historical analog identified. Current conditions remain under evaluation.
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function VRHistoricalContextCard() {
  const [ctx,   setCtx]   = useState<HistoricalContext | null | 'loading'>('loading')

  useEffect(() => {
    const topics = loadMonitoredTopics()
    setCtx(deriveContext(topics))
  }, [])

  if (ctx === 'loading') return null

  return (
    <section style={{
      background:   'rgba(255,255,255,0.015)',
      border:       '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14,
      padding:      '1rem 1.25rem',
      display:      'flex',
      flexDirection: 'column',
      gap:          '0.75rem',
    }}>

      {/* Header */}
      <div>
        <div style={{
          fontSize: '0.73rem', color: '#64748b',
          textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700,
        }}>
          Historical Context
        </div>
        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f1f5f9', marginTop: 2 }}>
          Prior Analogs
        </div>
        {ctx && (
          <div style={{ fontSize: '0.79rem', color: '#64748b', marginTop: 3 }}>
            Current conditions resemble prior episodes associated with{' '}
            <span style={{ color: '#a5b4fc', fontWeight: 600 }}>{ctx.scenario_label}</span>.
          </div>
        )}
      </div>

      {/* Content */}
      {!ctx
        ? <EmptyContext />
        : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {ctx.items.map((item, i) => (
                <HistoryItem key={i} item={item} />
              ))}
            </div>

            {ctx.interpretation && (
              <div style={{
                fontSize:     '0.78rem',
                color:        '#64748b',
                lineHeight:   1.55,
                padding:      '0.5rem 0.75rem',
                background:   'rgba(255,255,255,0.015)',
                borderRadius: 7,
                borderLeft:   '2px solid rgba(99,102,241,0.18)',
              }}>
                {ctx.interpretation}
              </div>
            )}
          </>
        )
      }

      <div style={{ fontSize: '0.68rem', color: '#4b5563' }}>
        Historical examples are illustrative only — past conditions do not predict future outcomes
      </div>
    </section>
  )
}
