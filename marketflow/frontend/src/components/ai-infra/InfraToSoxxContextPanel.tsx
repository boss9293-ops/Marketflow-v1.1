'use client'
// AI 인프라 → SOXX/SOXL 환경 컨텍스트 패널 — BR-2

import type {
  InfraToSoxxTranslation,
  InfraRotationState,
  InfraSoxxContext,
  InfraSoxlContext,
  InfraConflictFlag,
} from '@/lib/ai-infra/infraToSoxxTranslation'

// ── Design tokens (matches AIInfrastructureRadar) ─────────────────────────────
const V = {
  bg2:    'rgba(255,255,255,0.03)',
  bg3:    'rgba(255,255,255,0.02)',
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

// ── Color/label maps ──────────────────────────────────────────────────────────
const ROTATION_COLORS: Record<InfraRotationState, string> = {
  BROADENING:  V.green,
  DIFFUSING:   V.teal,
  NARROWING:   V.amber,
  CONCENTRATED: V.amber,
  FRAGILE:     V.red,
  DATA_LIMITED: V.text3,
  UNKNOWN:     V.text3,
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

const SOXX_COLORS: Record<InfraSoxxContext, string> = {
  SUPPORTIVE:          V.green,
  NEUTRAL:             V.neutral,
  FRAGILE:             V.amber,
  RISK_ELEVATED:       V.red,
  CONFIRMATION_NEEDED: V.neutral,
  DATA_LIMITED:        V.text3,
}

const SOXX_LABELS: Record<InfraSoxxContext, string> = {
  SUPPORTIVE:          'Supportive',
  NEUTRAL:             'Neutral',
  FRAGILE:             'Fragile',
  RISK_ELEVATED:       'Risk Elevated',
  CONFIRMATION_NEEDED: 'Confirmation Needed',
  DATA_LIMITED:        'Data Limited',
}

const SOXL_COLORS: Record<InfraSoxlContext, string> = {
  LEVERAGE_SENSITIVE:   V.green,
  CONFIRMATION_NEEDED:  V.neutral,
  TACTICAL_ONLY:        V.amber,
  HIGH_VOLATILITY:      V.red,
  DATA_LIMITED:         V.text3,
}

const SOXL_LABELS: Record<InfraSoxlContext, string> = {
  LEVERAGE_SENSITIVE:   'Leverage Sensitive',
  CONFIRMATION_NEEDED:  'Confirmation Needed',
  TACTICAL_ONLY:        'Tactical Only',
  HIGH_VOLATILITY:      'High Volatility',
  DATA_LIMITED:         'Data Limited',
}

const CONF_COLORS: Record<'HIGH' | 'MEDIUM' | 'LOW', string> = {
  HIGH:   V.green,
  MEDIUM: V.amber,
  LOW:    V.red,
}

const CONFLICT_LABELS: Record<InfraConflictFlag, string> = {
  CYCLE_INFRA_DIVERGENCE:    'Cycle / Infra Divergence',
  SOXX_CONTEXT_CONFLICT:     'SOXX / Infra Divergence',
  SOXL_CONTEXT_CONFLICT:     'SOXL / Infra Divergence',
  CYCLE_PHASE_INFRA_CONFLICT:'Cycle Phase / Infra Conflict',
}

// Conflict flag severity order (highest first)
const CONFLICT_SEVERITY: Record<InfraConflictFlag, number> = {
  CYCLE_PHASE_INFRA_CONFLICT: 4,
  SOXX_CONTEXT_CONFLICT:      3,
  CYCLE_INFRA_DIVERGENCE:     2,
  SOXL_CONTEXT_CONFLICT:      1,
}

// ── Chip ──────────────────────────────────────────────────────────────────────
function Chip({ label, value, color, sublabel }: {
  label:     string
  value:     string
  color:     string
  sublabel?: string
}) {
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
      <span style={{ fontFamily: V.mono, fontSize: 12, color, fontWeight: 600 }}>
        {value}
      </span>
      {sublabel && (
        <span style={{ fontFamily: V.ui, fontSize: 10, color: V.text3, fontStyle: 'italic' }}>
          {sublabel}
        </span>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function InfraToSoxxContextPanel({ translation: t }: { translation: InfraToSoxxTranslation }) {
  const card: React.CSSProperties = {
    background:   V.bg2,
    border:       `1px solid ${V.border}`,
    borderRadius: 6,
    padding:      '10px 14px',
    marginBottom: 14,
  }

  const hasConflicts   = t.conflict_flags.length > 0
  const hasLeading     = t.leading_buckets.length > 0
  const hasEmerging    = t.emerging_buckets.length > 0
  // Show top 3 by severity; collapse the rest
  const sortedFlags    = [...t.conflict_flags].sort(
    (a, b) => (CONFLICT_SEVERITY[b] ?? 0) - (CONFLICT_SEVERITY[a] ?? 0),
  )
  const displayedFlags = sortedFlags.slice(0, 3)
  const hiddenFlagCount = sortedFlags.length - displayedFlags.length

  return (
    <div style={card}>
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10,
      }}>
        <span style={{
          fontFamily: V.ui, fontSize: 10, letterSpacing: '0.10em',
          textTransform: 'uppercase' as const, color: V.text3,
        }}>
          Infrastructure → SOXX/SOXL Context
        </span>
        <span style={{
          fontFamily: V.mono, fontSize: 10, color: V.text3,
        }}>
          {t.source.valid_bucket_count}/{t.source.bucket_count} buckets valid
        </span>
      </div>

      {/* Chip row */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' as const, alignItems: 'flex-start' }}>
        <Chip label="Rotation"   value={ROTATION_LABELS[t.infrastructure_rotation_state]} color={ROTATION_COLORS[t.infrastructure_rotation_state]} />
        <Chip label="SOXX"       value={SOXX_LABELS[t.soxx_context]}                       color={SOXX_COLORS[t.soxx_context]} />
        <Chip
          label="SOXL"
          value={SOXL_LABELS[t.soxl_context]}
          color={SOXL_COLORS[t.soxl_context]}
          sublabel={t.soxl_context === 'TACTICAL_ONLY' ? 'leveraged exposure remains context-sensitive' : undefined}
        />
        <Chip label="Confidence" value={t.confidence.charAt(0) + t.confidence.slice(1).toLowerCase()} color={CONF_COLORS[t.confidence]} />
      </div>

      {/* Leading / Emerging compact list */}
      {(hasLeading || hasEmerging) && (
        <div style={{
          marginTop: 10, paddingTop: 10,
          borderTop: `1px solid ${V.border}`,
          display: 'flex', gap: 16, flexWrap: 'wrap' as const,
        }}>
          {hasLeading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontFamily: V.ui, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase' as const, color: V.text3 }}>
                Leading
              </span>
              <span style={{ fontFamily: V.mono, fontSize: 11, color: V.green }}>
                {t.leading_buckets.join(' · ')}
              </span>
            </div>
          )}
          {hasEmerging && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontFamily: V.ui, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase' as const, color: V.text3 }}>
                Emerging
              </span>
              <span style={{ fontFamily: V.mono, fontSize: 11, color: V.teal }}>
                {t.emerging_buckets.join(' · ')}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Conflict flags — top 3 by severity, collapse the rest */}
      {hasConflicts && (
        <div style={{
          marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' as const, alignItems: 'center',
        }}>
          {displayedFlags.map(flag => (
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
          {hiddenFlagCount > 0 && (
            <span style={{ fontFamily: V.mono, fontSize: 10, color: V.text3 }}>
              +{hiddenFlagCount} more
            </span>
          )}
        </div>
      )}

      {/* Interpretation note */}
      {t.interpretation_note && (
        <div style={{
          marginTop:  10,
          paddingTop: 10,
          borderTop:  `1px solid ${V.border}`,
          fontFamily: V.ui,
          fontSize:   11,
          color:      V.text2,
          lineHeight: 1.5,
        }}>
          {t.interpretation_note}
        </div>
      )}
    </div>
  )
}
