'use client'
// AI 인프라 역사적 유사 국면 컨텍스트 패널 — BR-3

import { useState } from 'react'
import type { InfraHistoricalAnalog, InfraAnalogPatternId, InfraAnalogConfidence } from '@/lib/ai-infra/infraHistoricalAnalogs'

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

// ── Color maps ────────────────────────────────────────────────────────────────
const PATTERN_COLORS: Record<InfraAnalogPatternId, string> = {
  AI_CORE_LEADERSHIP:         V.green,
  INFRA_DIFFUSION:            V.teal,
  LATE_CYCLE_CROWDING:        V.amber,
  STORY_HEAVY_SPECULATION:    V.orange,
  INDIRECT_RESOURCE_ROTATION: V.neutral,
  LEADERSHIP_FATIGUE:         V.red,
  EARLY_RECOVERY_REENTRY:     V.teal,
  DATA_LIMITED:               V.text3,
  NO_CLEAR_ANALOG:            V.text3,
}

const CONF_COLORS: Record<InfraAnalogConfidence, string> = {
  HIGH:   V.green,
  MEDIUM: V.amber,
  LOW:    V.text3,
}

// ── Label section ─────────────────────────────────────────────────────────────
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
export function InfraHistoricalAnalogPanel({ analog: a }: { analog: InfraHistoricalAnalog }) {
  const [expanded, setExpanded] = useState(false)

  const patternColor = PATTERN_COLORS[a.pattern_id]

  const card: React.CSSProperties = {
    background:   V.bg2,
    border:       `1px solid ${V.border}`,
    borderRadius: 6,
    padding:      '10px 14px',
    marginBottom: 14,
  }

  return (
    <div style={card}>
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8,
      }}>
        <SectionLabel label="Historical Context" />
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
          <SectionLabel label="Pattern" />
          <span style={{ fontFamily: V.mono, fontSize: 12, color: patternColor, fontWeight: 600 }}>
            {a.pattern_label}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <SectionLabel label="Confidence" />
          <span style={{ fontFamily: V.mono, fontSize: 12, color: CONF_COLORS[a.confidence], fontWeight: 600 }}>
            {a.confidence.charAt(0) + a.confidence.slice(1).toLowerCase()}
          </span>
        </div>
      </div>

      {/* One-line context — always visible */}
      <div style={{ fontFamily: V.ui, fontSize: 11, color: V.text2, lineHeight: 1.5 }}>
        {a.current_interpretation}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${V.border}` }}>

          {a.matched_conditions.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ marginBottom: 4 }}><SectionLabel label="Matched Conditions" /></div>
              {a.matched_conditions.map((c, i) => (
                <div key={i} style={{ fontFamily: V.mono, fontSize: 11, color: V.text2, lineHeight: 1.6 }}>
                  {c}
                </div>
              ))}
            </div>
          )}

          {a.watch_next.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ marginBottom: 4 }}><SectionLabel label="Watch Next" /></div>
              {a.watch_next.map((w, i) => (
                <div key={i} style={{ fontFamily: V.ui, fontSize: 11, color: V.text2, lineHeight: 1.6 }}>
                  — {w}
                </div>
              ))}
            </div>
          )}

          {a.risk_notes.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ marginBottom: 4 }}><SectionLabel label="Risk Notes" /></div>
              {a.risk_notes.map((r, i) => (
                <div key={i} style={{ fontFamily: V.mono, fontSize: 11, color: V.orange, lineHeight: 1.6 }}>
                  {r}
                </div>
              ))}
            </div>
          )}

          {a.missing_confirmations.length > 0 && (
            <div>
              <div style={{ marginBottom: 4 }}><SectionLabel label="Missing Confirmations" /></div>
              {a.missing_confirmations.map((m, i) => (
                <div key={i} style={{ fontFamily: V.ui, fontSize: 11, color: V.text3, lineHeight: 1.6 }}>
                  — {m}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
