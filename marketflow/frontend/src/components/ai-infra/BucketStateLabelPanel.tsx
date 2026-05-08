'use client'
// AI Bottleneck Radar 버킷 상태 레이블 패널 — Phase D-4

import { useState, useEffect } from 'react'
import {
  STATE_DISPLAY_LABELS,
  STATE_COLORS,
  type AIInfraBucketState,
  type AIInfraStateLabel,
  type AIInfraRiskFlag,
} from '@/lib/ai-infra/aiInfraStateLabels'

// ── Risk flag display map ─────────────────────────────────────────────────────

const RISK_FLAG_LABELS: Record<AIInfraRiskFlag, string> = {
  OVERHEAT_RISK:               'Overheat',
  LOW_COVERAGE:                'Low Coverage',
  PARTIAL_DATA:                'Partial Data',
  RRG_WEAKENING:               'RRG Weakening',
  RS_UNDERPERFORMANCE:         'RS Weak',
  MOMENTUM_STRETCH:            'Stretched',
  COMMERCIALIZATION_UNCERTAINTY:'Early Stage',
  BENCHMARK_MISSING:           'No Benchmark',
}

const CONFIDENCE_COLORS: Record<string, string> = {
  HIGH:   '#22c55e',
  MEDIUM: '#fbbf24',
  LOW:    '#8b9098',
}

// ── Sort options ──────────────────────────────────────────────────────────────

type SortMode = 'score' | 'stage' | 'label'

const LABEL_ORDER: AIInfraStateLabel[] = [
  'LEADING', 'EMERGING', 'CONFIRMING', 'CROWDED',
  'DISTRIBUTION', 'LAGGING', 'STORY_ONLY', 'DATA_INSUFFICIENT',
]

function sortStates(states: AIInfraBucketState[], mode: SortMode): AIInfraBucketState[] {
  return [...states].sort((a, b) => {
    if (mode === 'score') {
      const sa = a.state_score ?? -1
      const sb = b.state_score ?? -1
      return sb - sa
    }
    if (mode === 'label') {
      return LABEL_ORDER.indexOf(a.state_label) - LABEL_ORDER.indexOf(b.state_label)
    }
    // stage order
    return (a.stage ?? '').localeCompare(b.stage ?? '')
  })
}

// ── Row component ─────────────────────────────────────────────────────────────

function StateRow({ state }: { state: AIInfraBucketState }) {
  const color      = STATE_COLORS[state.state_label]
  const label      = STATE_DISPLAY_LABELS[state.state_label]
  const confColor  = CONFIDENCE_COLORS[state.confidence] ?? '#8b9098'
  const scoreStr   = state.state_score != null ? state.state_score.toString() : '—'

  return (
    <tr style={{ borderBottom: '1px solid #1e2432' }}>
      {/* Bucket */}
      <td style={{ padding: '8px 10px', fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 13, color: '#c9cdd4', whiteSpace: 'nowrap' }}>
        {state.display_name}
      </td>

      {/* State */}
      <td style={{ padding: '8px 10px' }}>
        <span style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: 4,
          fontSize: 11,
          fontFamily: 'IBM Plex Sans, sans-serif',
          fontWeight: 600,
          letterSpacing: '0.06em',
          color: '#0f1117',
          backgroundColor: color,
        }}>
          {label}
        </span>
      </td>

      {/* Score */}
      <td style={{ padding: '8px 10px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 13, color: '#c9cdd4', textAlign: 'right' }}>
        {scoreStr}
      </td>

      {/* Confidence */}
      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
        <span style={{
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: 11,
          letterSpacing: '0.08em',
          color: confColor,
        }}>
          {state.confidence}
        </span>
      </td>

      {/* Reason */}
      <td style={{ padding: '8px 10px', fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 12, color: '#8b9098', maxWidth: 320 }}>
        {state.state_reason}
      </td>

      {/* Risk Flags */}
      <td style={{ padding: '8px 10px' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {state.risk_flags.map(flag => (
            <span
              key={flag}
              style={{
                display: 'inline-block',
                padding: '1px 6px',
                borderRadius: 3,
                fontSize: 10,
                fontFamily: 'IBM Plex Sans, sans-serif',
                letterSpacing: '0.08em',
                color: '#c9cdd4',
                backgroundColor: '#1e2432',
                border: '1px solid #2a3044',
                whiteSpace: 'nowrap',
              }}
            >
              {RISK_FLAG_LABELS[flag] ?? flag}
            </span>
          ))}
        </div>
      </td>
    </tr>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

interface ThemeMomentumResponse {
  bucket_states?: AIInfraBucketState[]
}

export default function BucketStateLabelPanel() {
  const [states, setStates]     = useState<AIInfraBucketState[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('score')

  useEffect(() => {
    fetch('/api/ai-infra/theme-momentum')
      .then(r => r.json())
      .then((data: ThemeMomentumResponse) => {
        if (Array.isArray(data.bucket_states)) {
          setStates(data.bucket_states)
        } else {
          setError('bucket_states not available')
        }
      })
      .catch(() => setError('Failed to load state labels'))
      .finally(() => setLoading(false))
  }, [])

  const sorted = sortStates(states, sortMode)

  // Summary counts
  const counts = LABEL_ORDER.reduce<Partial<Record<AIInfraStateLabel, number>>>((acc, lbl) => {
    const n = states.filter(s => s.state_label === lbl).length
    if (n > 0) acc[lbl] = n
    return acc
  }, {})

  return (
    <div style={{ background: '#0f1117', padding: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 14, fontWeight: 600, color: '#ffffff', marginBottom: 4 }}>
            Bottleneck State Labels
          </div>
          <div style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 11, color: '#8b9098', letterSpacing: '0.08em' }}>
            RULE-BASED — NOT INVESTMENT ADVICE — D-4
          </div>
        </div>

        {/* Sort selector */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['score', 'label', 'stage'] as SortMode[]).map(m => (
            <button
              key={m}
              onClick={() => setSortMode(m)}
              style={{
                padding: '3px 10px',
                borderRadius: 4,
                border: '1px solid',
                borderColor: sortMode === m ? '#22d3ee' : '#2a3044',
                background: 'transparent',
                color: sortMode === m ? '#22d3ee' : '#8b9098',
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 11,
                cursor: 'pointer',
                letterSpacing: '0.06em',
              }}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Summary chips */}
      {states.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {(Object.entries(counts) as [AIInfraStateLabel, number][]).map(([lbl, n]) => (
            <span
              key={lbl}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '2px 8px',
                borderRadius: 4,
                background: '#1a1e2a',
                border: `1px solid ${STATE_COLORS[lbl]}44`,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: STATE_COLORS[lbl], flexShrink: 0 }} />
              <span style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 11, color: '#c9cdd4' }}>
                {STATE_DISPLAY_LABELS[lbl]}
              </span>
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: STATE_COLORS[lbl] }}>
                {n}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Table */}
      {loading && (
        <div style={{ color: '#8b9098', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, padding: '20px 0' }}>
          Loading…
        </div>
      )}
      {error && (
        <div style={{ color: '#ef4444', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, padding: '20px 0' }}>
          {error}
        </div>
      )}
      {!loading && !error && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2a3044' }}>
                {['Bucket', 'State', 'Score', 'Confidence', 'Reason', 'Risk Flags'].map(h => (
                  <th
                    key={h}
                    style={{
                      padding: '6px 10px',
                      fontFamily: 'IBM Plex Mono, monospace',
                      fontSize: 10,
                      fontWeight: 600,
                      color: '#737880',
                      letterSpacing: '0.10em',
                      textAlign: h === 'Score' ? 'right' : h === 'Confidence' ? 'center' : 'left',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(s => <StateRow key={s.bucket_id} state={s} />)}
            </tbody>
          </table>
        </div>
      )}

      {/* Disclaimer */}
      <div style={{ marginTop: 14, fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 10, color: '#555a62', letterSpacing: '0.06em', lineHeight: 1.5 }}>
        State labels are price/RRG-driven rotation signals. They do not constitute investment recommendations. Score is an internal sort key only.
      </div>
    </div>
  )
}
