'use client'
// AI 인프라 교육형 내러티브 패널 — BR-4

import { useState } from 'react'
import type { InfraEducationalNarrative, InfraNarrativeTone } from '@/lib/ai-infra/infraEducationalNarrative'

// ── Design tokens ─────────────────────────────────────────────────────────────
const V = {
  bg2:    'rgba(255,255,255,0.03)',
  border: 'rgba(255,255,255,0.08)',
  text:   '#E8F0F8',
  text2:  '#B8C8DC',
  text3:  '#8b9098',
  teal:   '#3FB6A8',
  amber:  '#F2A93B',
  red:    '#E55A5A',
  green:  '#22c55e',
  neutral:'#c9cdd4',
  orange: '#f97316',
  ui:     "'IBM Plex Sans', sans-serif",
  mono:   "'IBM Plex Mono', monospace",
} as const

// ── Tone colors / labels ──────────────────────────────────────────────────────
const TONE_COLORS: Record<InfraNarrativeTone, string> = {
  SUPPORTIVE_CONTEXT:    V.green,
  MIXED_CONTEXT:         V.neutral,
  FRAGILE_CONTEXT:       V.amber,
  RISK_ELEVATED_CONTEXT: V.orange,
  DATA_LIMITED_CONTEXT:  V.text3,
  UNKNOWN_CONTEXT:       V.text3,
}

const TONE_LABELS: Record<InfraNarrativeTone, string> = {
  SUPPORTIVE_CONTEXT:    'Supportive',
  MIXED_CONTEXT:         'Mixed',
  FRAGILE_CONTEXT:       'Fragile',
  RISK_ELEVATED_CONTEXT: 'Risk Elevated',
  DATA_LIMITED_CONTEXT:  'Data Limited',
  UNKNOWN_CONTEXT:       'Unknown',
}

// ── Label ─────────────────────────────────────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
  return (
    <span style={{
      fontFamily:    V.ui,
      fontSize:      10,
      letterSpacing: '0.10em',
      textTransform: 'uppercase' as const,
      color:         V.text3,
    }}>
      {label}
    </span>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function InfraEducationalNarrativePanel({ narrative: n }: { narrative: InfraEducationalNarrative }) {
  const [expanded, setExpanded] = useState(false)

  const toneColor = TONE_COLORS[n.tone]

  const card: React.CSSProperties = {
    background:   V.bg2,
    border:       `1px solid ${V.border}`,
    borderRadius: 6,
    padding:      '10px 14px',
    marginBottom: 14,
  }

  return (
    <div style={card}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8,
      }}>
        <SectionLabel label="Educational Context" />
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: V.mono, fontSize: 10, color: V.text3,
            padding: 0, letterSpacing: '0.05em',
          }}
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {/* Chip row — always visible */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' as const, alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <SectionLabel label="Context" />
          <span style={{ fontFamily: V.mono, fontSize: 12, color: V.text, fontWeight: 600 }}>
            {n.title}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <SectionLabel label="Tone" />
          <span style={{ fontFamily: V.mono, fontSize: 12, color: toneColor, fontWeight: 600 }}>
            {TONE_LABELS[n.tone]}
          </span>
        </div>
      </div>

      {/* Current meaning — always visible */}
      <div style={{ fontFamily: V.ui, fontSize: 11, color: V.text2, lineHeight: 1.5 }}>
        {n.current_meaning}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${V.border}` }}>

          {/* Why it matters */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ marginBottom: 4 }}><SectionLabel label="Why It Matters" /></div>
            <div style={{ fontFamily: V.ui, fontSize: 11, color: V.text2, lineHeight: 1.5 }}>
              {n.why_it_matters}
            </div>
          </div>

          {/* Watch next */}
          {n.watch_next.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ marginBottom: 4 }}><SectionLabel label="Watch Next" /></div>
              {n.watch_next.slice(0, 4).map((w, i) => (
                <div key={i} style={{ fontFamily: V.ui, fontSize: 11, color: V.text2, lineHeight: 1.6 }}>
                  — {w}
                </div>
              ))}
            </div>
          )}

          {/* Key context points */}
          {n.key_context_points.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ marginBottom: 4 }}><SectionLabel label="Supporting Signals" /></div>
              {n.key_context_points.map((p, i) => (
                <div key={i} style={{ fontFamily: V.mono, fontSize: 11, color: V.teal, lineHeight: 1.6 }}>
                  {p}
                </div>
              ))}
            </div>
          )}

          {/* Caution points */}
          {n.caution_points.length > 0 && (
            <div>
              <div style={{ marginBottom: 4 }}><SectionLabel label="Caution Signals" /></div>
              {n.caution_points.map((c, i) => (
                <div key={i} style={{ fontFamily: V.mono, fontSize: 11, color: V.orange, lineHeight: 1.6 }}>
                  {c}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
