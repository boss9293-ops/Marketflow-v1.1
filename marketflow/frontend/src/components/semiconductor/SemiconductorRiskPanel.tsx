'use client'
// B-4: Risk Panel — Concentration · Momentum Risk · Confirmation
import type { TranslationOutput, SignalInputs } from '@/lib/semiconductor/types'

const LEVEL_COLOR: Record<string, string> = {
  LOW: '#22c55e', MODERATE: '#eab308', ELEVATED: '#f97316', HIGH: '#ef4444',
}

function Section({ title, level, children }: { title: string; level: string; children: React.ReactNode }) {
  const color = LEVEL_COLOR[level] ?? '#94a3b8'
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>{title}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color, background: `${color}18`,
                       padding: '2px 8px', borderRadius: 4 }}>{level}</span>
      </div>
      <div style={{ fontSize: 12, color: '#94a3b8', paddingLeft: 4 }}>{children}</div>
    </div>
  )
}

interface Props { translation: TranslationOutput; signals: SignalInputs }

export default function SemiconductorRiskPanel({ translation, signals }: Props) {
  const { risk_level, risk_rule } = translation
  const { concentration, constraint_warning, momentum, equipment_state, memory_strength,
          nvda_mu_gap, concentration_score } = signals

  const momRisk = momentum === 'DECELERATING' ? 'ELEVATED' : momentum === 'NEUTRAL' ? 'MODERATE' : 'LOW'
  const confState = (equipment_state === 'IN-LINE' || equipment_state === 'LEADING') &&
                    (memory_strength === 'RECOVERING' || memory_strength === 'STRONG')
    ? 'CONFIRMED' : 'MIXED'

  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8,
                  padding: '14px 18px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: '#64748b', letterSpacing: 2 }}>RISK</div>
        <div style={{ fontSize: 12, color: LEVEL_COLOR[risk_level] ?? '#94a3b8', fontWeight: 600 }}>
          Overall: {risk_level}
        </div>
      </div>

      <Section title="Concentration" level={concentration}>
        <div>NVDA+AVGO ≈ {concentration_score}% of SOXX 30d return</div>
        {concentration === 'ELEVATED' || concentration === 'HIGH'
          ? <div style={{ color: '#f97316', marginTop: 4 }}>Single-name risk: NVDA miss = amplified index drop</div>
          : null}
      </Section>

      <Section title="Momentum Risk" level={momRisk}>
        <div>SOXX momentum: {momentum}</div>
        {constraint_warning !== 'LOW' && (
          <div style={{ marginTop: 4 }}>
            Constraint {constraint_warning} — NVDA–MU gap {(nvda_mu_gap * 100).toFixed(0)}%
          </div>
        )}
      </Section>

      <Section title="Confirmation" level={confState}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ color: memory_strength === 'WEAK' ? '#ef4444' : '#22c55e' }}>
            Memory: {memory_strength} {memory_strength === 'WEAK' ? '✗' : '✓'}
          </span>
          <span style={{ color: equipment_state === 'LAGGING' || equipment_state === 'DIVERGING' ? '#f97316' : '#22c55e' }}>
            Equipment P1: {equipment_state} {equipment_state === 'LAGGING' || equipment_state === 'DIVERGING' ? '⚠' : '✓'}
          </span>
        </div>
        <div style={{ marginTop: 4, color: '#64748b' }}>{risk_rule}</div>
      </Section>
    </div>
  )
}
