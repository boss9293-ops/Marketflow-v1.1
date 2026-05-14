'use client'
// 반도체 사이클 맥락을 인프라섹터렌즈 상단에 표시하는 읽기 전용 배너 (BR-1)

import { useEffect, useState } from 'react'
import type { SemiconductorOutput } from '@/lib/semiconductor/types'
import {
  normalizeCyclePhase,
  formatCyclePhase,
  normalizeCycleConfidence,
  deriveSOXXJudgment,
  normalizeSOXLEnvironment,
  normalizeConflictMode,
  getPhaseInterpretationNote,
  formatConfidence,
  type InfrastructureCycleContext,
  type SemiconductorSOXXJudgment,
  type SemiconductorSOXLEnvironment,
  type SemiconductorCycleConfidence,
} from '@/lib/ai-infra/infrastructureCycleContext'

// ── Design tokens (matches AIInfrastructureRadar) ─────────────────────────────
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
  ui:     "'IBM Plex Sans', sans-serif",
  mono:   "'IBM Plex Mono', monospace",
} as const

// ── Color maps ────────────────────────────────────────────────────────────────
const SOXX_COLORS: Record<SemiconductorSOXXJudgment, string> = {
  SUPPORTIVE:    V.green,
  NEUTRAL:       V.neutral,
  FRAGILE:       V.amber,
  RISK_ELEVATED: V.red,
  UNKNOWN:       V.text3,
}

const SOXX_LABELS: Record<SemiconductorSOXXJudgment, string> = {
  SUPPORTIVE:    'Supportive',
  NEUTRAL:       'Neutral',
  FRAGILE:       'Fragile',
  RISK_ELEVATED: 'Risk Elevated',
  UNKNOWN:       '—',
}

const SOXL_COLORS: Record<SemiconductorSOXLEnvironment, string> = {
  LEVERAGE_SENSITIVE:   V.green,
  CONFIRMATION_NEEDED:  V.neutral,
  TACTICAL_ONLY:        V.amber,
  HIGH_VOLATILITY:      V.red,
  UNKNOWN:              V.text3,
}

const SOXL_LABELS: Record<SemiconductorSOXLEnvironment, string> = {
  LEVERAGE_SENSITIVE:   'Leverage Sensitive',
  CONFIRMATION_NEEDED:  'Confirmation Needed',
  TACTICAL_ONLY:        'Tactical Only',
  HIGH_VOLATILITY:      'High Volatility',
  UNKNOWN:              '—',
}

const CONF_COLORS: Record<SemiconductorCycleConfidence, string> = {
  HIGH:    V.green,
  MEDIUM:  V.amber,
  LOW:     V.red,
  UNKNOWN: V.text3,
}

// ── Chip ──────────────────────────────────────────────────────────────────────
function Chip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{
        fontFamily:    V.ui,
        fontSize:      10,
        letterSpacing: '0.10em',
        textTransform: 'uppercase' as const,
        color:         V.text3,
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: V.mono,
        fontSize:   12,
        color,
        fontWeight: 600,
      }}>
        {value}
      </span>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function InfrastructureCycleContextBanner() {
  const [ctx, setCtx]       = useState<InfrastructureCycleContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed]  = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/semiconductor')
      .then(r => r.ok ? r.json() as Promise<SemiconductorOutput> : Promise.reject())
      .then((data) => {
        if (cancelled) return
        const phase = normalizeCyclePhase(data.stage?.stage)
        setCtx({
          cycle_score:      data.stage?.stage_score ?? null,
          cycle_phase:      phase,
          cycle_confidence: normalizeCycleConfidence(data.stage?.confidence),
          soxx_judgment:    deriveSOXXJudgment(phase, data.stage?.conflict_mode ?? false),
          soxl_environment: normalizeSOXLEnvironment(data.translation?.soxl?.window),
          conflict_mode:    normalizeConflictMode(data.stage?.conflict_mode ?? false),
          source: { from: 'SEMICONDUCTOR_LENS', as_of: data.as_of ?? null, stale: false },
        })
      })
      .catch(() => { if (!cancelled) setFailed(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const card: React.CSSProperties = {
    background:   V.bg2,
    border:       `1px solid ${V.border}`,
    borderRadius: 6,
    padding:      '10px 14px',
    marginBottom: 14,
  }

  if (loading) {
    return (
      <div style={card}>
        <span style={{ fontFamily: V.ui, fontSize: 11, color: V.text3 }}>
          Loading cycle context…
        </span>
      </div>
    )
  }

  if (failed || !ctx) {
    return (
      <div style={card}>
        <span style={{ fontFamily: V.ui, fontSize: 11, color: V.text3 }}>
          Cycle context unavailable
        </span>
      </div>
    )
  }

  const score = ctx.cycle_score != null ? Math.round(ctx.cycle_score) : '—'
  const note  = getPhaseInterpretationNote(ctx.cycle_phase)

  return (
    <div style={card}>
      {/* Label row */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        marginBottom:   10,
      }}>
        <span style={{
          fontFamily:    V.ui,
          fontSize:      10,
          letterSpacing: '0.10em',
          textTransform: 'uppercase' as const,
          color:         V.text3,
        }}>
          Semiconductor Cycle Context
        </span>
        {ctx.source?.as_of && (
          <span style={{ fontFamily: V.mono, fontSize: 10, color: V.text3 }}>
            {ctx.source.as_of}
          </span>
        )}
      </div>

      {/* Chip row */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' as const, alignItems: 'flex-start' }}>
        <Chip label="Cycle Score" value={String(score)}                               color={V.text} />
        <Chip label="Phase"       value={formatCyclePhase(ctx.cycle_phase)}           color={V.teal} />
        <Chip label="SOXX"        value={SOXX_LABELS[ctx.soxx_judgment]}              color={SOXX_COLORS[ctx.soxx_judgment]} />
        <Chip label="SOXL"        value={SOXL_LABELS[ctx.soxl_environment]}           color={SOXL_COLORS[ctx.soxl_environment]} />
        <Chip label="Confidence"  value={formatConfidence(ctx.cycle_confidence)}      color={CONF_COLORS[ctx.cycle_confidence]} />
      </div>

      {/* Note */}
      {note && (
        <div style={{
          marginTop:  10,
          paddingTop: 10,
          borderTop:  `1px solid ${V.border}`,
          fontFamily: V.ui,
          fontSize:   11,
          color:      V.text2,
          lineHeight: 1.5,
        }}>
          {note}
        </div>
      )}
    </div>
  )
}
