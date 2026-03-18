'use client'
import { useEffect, useState } from 'react'
import type { VRTrustData, ConfidenceLevel, AlignmentLevel, ClarityLevel } from '@/lib/text/trustDeriver'
import { deriveTrustData, EMPTY_TRUST } from '@/lib/text/trustDeriver'
import { loadMonitoredTopics }           from '@/lib/researchMonitorStorage'
import { buildScenarioMappings }          from '@/lib/scenarioMappingBuilder'

// ── Color helpers ────────────────────────────────────────────────────────────

type ValueLevel = ConfidenceLevel | AlignmentLevel | ClarityLevel

const LEVEL_COLOR: Record<string, string> = {
  // positive
  High: '#86efac', Strong: '#86efac', Clear: '#86efac',
  // neutral
  Medium: '#fde68a', Mixed: '#fde68a', Transitional: '#fde68a',
  // stress
  Low: '#fca5a5', Conflicting: '#fca5a5', Unstable: '#fca5a5',
}

function valueColor(v: string): string {
  return LEVEL_COLOR[v] ?? '#94a3b8'
}

// ── Metric pill ──────────────────────────────────────────────────────────────

function Metric({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div
      title={title}
      style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: title ? 'help' : 'default' }}
    >
      <span style={{ fontSize: '0.72rem', color: '#475569', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
        {label}
      </span>
      <span style={{
        fontSize:   '0.75rem',
        fontWeight: 700,
        color:      valueColor(value),
        background: valueColor(value) + '18',
        padding:    '0.12rem 0.5rem',
        borderRadius: 5,
        border:     `1px solid ${valueColor(value)}30`,
        whiteSpace: 'nowrap',
      }}>
        {value}
      </span>
    </div>
  )
}

// ── Divider ──────────────────────────────────────────────────────────────────

function Divider() {
  return (
    <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
  )
}

// ── Explanations shown as tooltips ───────────────────────────────────────────

const CONFIDENCE_TIPS: Record<string, string> = {
  High:   'Signals are consistent and the pattern is strong.',
  Medium: 'Signals show partial agreement.',
  Low:    'Signals are weak or insufficient for a clear assessment.',
}
const ALIGNMENT_TIPS: Record<string, string> = {
  Strong:      'Signals are pointing in the same direction.',
  Mixed:       'Some signals are in partial conflict.',
  Conflicting: 'Signals are opposing each other.',
}
const CLARITY_TIPS: Record<string, string> = {
  Clear:        'The current regime is well-defined.',
  Transitional: 'Conditions are shifting and regime direction is unclear.',
  Unstable:     'Signals are noisy and the regime is difficult to read.',
}

// ── Main component ───────────────────────────────────────────────────────────

export default function VRTrustStrip() {
  const [trust, setTrust] = useState<VRTrustData | null>(null)

  useEffect(() => {
    const topics   = loadMonitoredTopics()
    const mappings = buildScenarioMappings(topics)
    setTrust(deriveTrustData(topics, mappings))
  }, [])

  // Render nothing while loading to avoid flash
  if (trust === null) return null

  const noData = !trust.has_data

  return (
    <div style={{
      display:        'flex',
      alignItems:     'center',
      gap:            16,
      padding:        '0.55rem 1rem',
      background:     'rgba(255,255,255,0.02)',
      border:         '1px solid rgba(255,255,255,0.07)',
      borderRadius:   14,
      flexWrap:       'wrap',
    }}>

      {/* Label */}
      <span style={{ fontSize: '0.73rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', flexShrink: 0 }}>
        System Clarity
      </span>

      <Divider />

      {noData ? (
        <span style={{ fontSize: '0.75rem', color: '#475569', fontStyle: 'italic' }}>
          System state is being evaluated.
        </span>
      ) : (
        <>
          <Metric
            label="Confidence"
            value={trust.confidence}
            title={CONFIDENCE_TIPS[trust.confidence]}
          />
          <Divider />
          <Metric
            label="Alignment"
            value={trust.alignment}
            title={ALIGNMENT_TIPS[trust.alignment]}
          />
          <Divider />
          <Metric
            label="Clarity"
            value={trust.clarity}
            title={CLARITY_TIPS[trust.clarity]}
          />
        </>
      )}

      <span style={{ marginLeft: 'auto', fontSize: '0.66rem', color: '#4b5563', flexShrink: 0 }}>
        derived from monitored research
      </span>
    </div>
  )
}
