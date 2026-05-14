'use client'
// BR-1~BR-4 브리지 스택 압축 레이아웃 — 4-블록 그리드 + Details 드로어 (BR-6)

import { useState } from 'react'
import type { InfrastructureCycleContext } from '@/lib/ai-infra/infrastructureCycleContext'
import { formatCyclePhase, formatConfidence } from '@/lib/ai-infra/infrastructureCycleContext'
import type { InfraToSoxxTranslation, InfraRotationState, InfraConflictFlag } from '@/lib/ai-infra/infraToSoxxTranslation'
import type { InfraHistoricalAnalog, InfraAnalogConfidence } from '@/lib/ai-infra/infraHistoricalAnalogs'
import type { InfraEducationalNarrative, InfraNarrativeTone } from '@/lib/ai-infra/infraEducationalNarrative'
import InfrastructureCycleContextBanner from './InfrastructureCycleContextBanner'
import { InfraToSoxxContextPanel } from './InfraToSoxxContextPanel'
import { InfraHistoricalAnalogPanel } from './InfraHistoricalAnalogPanel'
import { InfraEducationalNarrativePanel } from './InfraEducationalNarrativePanel'

const V = {
  bg2:     'rgba(255,255,255,0.03)',
  border:  'rgba(255,255,255,0.08)',
  text2:   '#B8C8DC',
  text3:   '#8b9098',
  teal:    '#3FB6A8',
  amber:   '#F2A93B',
  red:     '#E55A5A',
  green:   '#22c55e',
  neutral: '#c9cdd4',
  orange:  '#f97316',
  ui:      "'IBM Plex Sans', sans-serif",
  mono:    "'IBM Plex Mono', monospace",
} as const

const ROTATION_COLORS: Record<InfraRotationState, string> = {
  BROADENING:   V.green,
  DIFFUSING:    V.teal,
  NARROWING:    V.amber,
  CONCENTRATED: V.amber,
  FRAGILE:      V.red,
  DATA_LIMITED: V.text3,
  UNKNOWN:      V.text3,
}

const ROTATION_LABELS: Record<InfraRotationState, string> = {
  BROADENING:   'Broadening',
  DIFFUSING:    'Diffusing',
  NARROWING:    'Narrowing',
  CONCENTRATED: 'Concentrated',
  FRAGILE:      'Fragile',
  DATA_LIMITED: 'Data Limited',
  UNKNOWN:      '—',
}

const TONE_COLORS: Record<InfraNarrativeTone, string> = {
  SUPPORTIVE_CONTEXT:    V.green,
  MIXED_CONTEXT:         V.neutral,
  FRAGILE_CONTEXT:       V.amber,
  RISK_ELEVATED_CONTEXT: V.red,
  DATA_LIMITED_CONTEXT:  V.text3,
  UNKNOWN_CONTEXT:       V.text3,
}

const TONE_LABELS: Record<InfraNarrativeTone, string> = {
  SUPPORTIVE_CONTEXT:    'Supportive',
  MIXED_CONTEXT:         'Mixed',
  FRAGILE_CONTEXT:       'Fragile',
  RISK_ELEVATED_CONTEXT: 'Risk Elevated',
  DATA_LIMITED_CONTEXT:  'Data Limited',
  UNKNOWN_CONTEXT:       '—',
}

const CONF_COLORS: Record<InfraAnalogConfidence, string> = {
  HIGH:   V.green,
  MEDIUM: V.amber,
  LOW:    V.text3,
}

const SOXX_JUDGMENT_COLORS: Record<string, string> = {
  SUPPORTIVE:    V.green,
  NEUTRAL:       V.neutral,
  FRAGILE:       V.amber,
  RISK_ELEVATED: V.red,
  UNKNOWN:       V.text3,
}

const CONFLICT_LABELS: Record<InfraConflictFlag, string> = {
  CYCLE_INFRA_DIVERGENCE:     'Cycle / Infra Divergence',
  SOXX_CONTEXT_CONFLICT:      'SOXX / Infra Divergence',
  SOXL_CONTEXT_CONFLICT:      'SOXL / Infra Divergence',
  CYCLE_PHASE_INFRA_CONFLICT: 'Cycle Phase / Infra Conflict',
}

function fmtEnum(s: string): string {
  return s.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')
}

function CompactBlock({ label, value, valueColor, sub }: {
  label:      string
  value:      string
  valueColor: string
  sub?:       string
}) {
  return (
    <div style={{
      background:    V.bg2,
      border:        `1px solid ${V.border}`,
      borderRadius:  6,
      padding:       '10px 14px',
      display:       'flex',
      flexDirection: 'column' as const,
      gap:           4,
      minWidth:      0,
    }}>
      <span style={{
        fontFamily:    V.ui,
        fontSize:      10,
        letterSpacing: '0.10em',
        textTransform: 'uppercase' as const,
        color:         V.text3,
      }}>
        {label}
      </span>
      <span style={{ fontFamily: V.mono, fontSize: 12, color: valueColor, fontWeight: 600, lineHeight: 1.3 }}>
        {value}
      </span>
      {sub && (
        <span style={{ fontFamily: V.ui, fontSize: 11, color: V.text2, lineHeight: 1.3 }}>
          {sub}
        </span>
      )}
    </div>
  )
}

export interface InfraBridgeCompactSummaryProps {
  cycleCtx:    InfrastructureCycleContext | null
  translation: InfraToSoxxTranslation     | null
  analog:      InfraHistoricalAnalog       | null
  narrative:   InfraEducationalNarrative   | null
}

export function InfraBridgeCompactSummary({
  cycleCtx, translation, analog, narrative,
}: InfraBridgeCompactSummaryProps) {
  const [showDetails, setShowDetails] = useState(false)

  const hasCycle     = cycleCtx !== null && cycleCtx.cycle_phase !== 'UNKNOWN'
  const conflicts    = hasCycle ? (translation?.conflict_flags ?? []) : []
  const hasConflicts = conflicts.length > 0

  // Block 1: Cycle
  const cycleValue = hasCycle ? formatCyclePhase(cycleCtx!.cycle_phase) : 'Unavailable'
  const cycleColor = hasCycle ? (SOXX_JUDGMENT_COLORS[cycleCtx!.soxx_judgment] ?? V.text2) : V.text3
  const cycleSub   = hasCycle
    ? `SOXX: ${fmtEnum(cycleCtx!.soxx_judgment)} · ${formatConfidence(cycleCtx!.cycle_confidence)}`
    : undefined

  // Block 2: Infra rotation
  const infraValue = translation ? ROTATION_LABELS[translation.infrastructure_rotation_state] : '—'
  const infraColor = translation ? ROTATION_COLORS[translation.infrastructure_rotation_state] : V.text3
  const infraSub   = translation
    ? `${fmtEnum(translation.soxx_context)} / ${fmtEnum(translation.soxl_context)}`
    : undefined

  // Block 3: Historical analog
  const analogValue = analog ? analog.pattern_label : '—'
  const analogColor = analog ? CONF_COLORS[analog.confidence] : V.text3
  const analogSub   = analog ? `Confidence: ${fmtEnum(analog.confidence)}` : undefined

  // Block 4: Educational context
  const ctxValue = narrative ? narrative.title : '—'
  const ctxColor = narrative ? TONE_COLORS[narrative.tone] : V.text3
  const ctxSub   = narrative ? TONE_LABELS[narrative.tone] : undefined

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <span style={{
          fontFamily:    V.mono,
          fontSize:      10,
          color:         V.text3,
          letterSpacing: '0.10em',
          textTransform: 'uppercase' as const,
        }}>
          Infrastructure Bridge Context
        </span>
        <button
          onClick={() => setShowDetails(v => !v)}
          style={{
            padding:       '2px 10px',
            border:        `1px solid ${V.border}`,
            borderRadius:  3,
            background:    'transparent',
            color:         V.text2,
            fontFamily:    V.mono,
            fontSize:      10,
            letterSpacing: '0.08em',
            cursor:        'pointer',
          }}
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {/* 4-block responsive grid — CSS media queries avoid SSR/hydration flash */}
      <style>{`.ibcsg{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}@media(max-width:1023px){.ibcsg{grid-template-columns:repeat(2,1fr)}}@media(max-width:767px){.ibcsg{grid-template-columns:1fr}}`}</style>
      <div className="ibcsg" style={{ marginBottom: hasConflicts ? 8 : 0 }}>
        <CompactBlock label="Cycle"          value={cycleValue} valueColor={cycleColor} sub={cycleSub} />
        <CompactBlock label="Infra Rotation" value={infraValue} valueColor={infraColor} sub={infraSub} />
        <CompactBlock label="Analog"         value={analogValue} valueColor={analogColor} sub={analogSub} />
        <CompactBlock label="Context"        value={ctxValue}   valueColor={ctxColor}   sub={ctxSub} />
      </div>

      {/* Conflict badges — only shown when cycle context is available */}
      {hasConflicts && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
          {conflicts.map(flag => (
            <span key={flag} style={{
              fontFamily:    V.mono,
              fontSize:      10,
              color:         V.orange,
              background:    `${V.orange}18`,
              border:        `1px solid ${V.orange}40`,
              borderRadius:  3,
              padding:       '1px 6px',
              letterSpacing: '0.05em',
            }}>
              {CONFLICT_LABELS[flag]}
            </span>
          ))}
        </div>
      )}

      {/* Details drawer — conditionally renders full panel stack */}
      {showDetails && (
        <div style={{
          marginTop:  10,
          paddingTop: 10,
          borderTop:  `1px solid ${V.border}`,
        }}>
          <InfrastructureCycleContextBanner />
          {translation && <InfraToSoxxContextPanel translation={translation} />}
          {analog      && <InfraHistoricalAnalogPanel analog={analog} />}
          {narrative   && <InfraEducationalNarrativePanel narrative={narrative} />}
        </div>
      )}
    </div>
  )
}
