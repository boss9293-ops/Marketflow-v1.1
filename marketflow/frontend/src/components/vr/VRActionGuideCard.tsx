'use client'
import { useEffect, useState } from 'react'
import type { ActionGuide }    from '@/lib/text/actionGuideMap'
import { ACTION_GUIDE_MAP, FALLBACK_GUIDE, refineGuide } from '@/lib/text/actionGuideMap'
import { VR_STATE_TONE }       from '@/lib/text/vrTone'
import { loadMonitoredTopics } from '@/lib/researchMonitorStorage'
import { buildScenarioMappings } from '@/lib/scenarioMappingBuilder'
import { deriveTrustData }     from '@/lib/text/trustDeriver'

interface Props {
  vrState?: string
}

// ── Posture tag ───────────────────────────────────────────────────────────────

const POSTURE_COLOR: Record<string, { bg: string; color: string; border: string }> = {
  Defensive:    { bg: 'rgba(239,68,68,0.08)',   color: '#fca5a5', border: 'rgba(239,68,68,0.2)' },
  Cautious:     { bg: 'rgba(251,191,36,0.08)',  color: '#fde68a', border: 'rgba(251,191,36,0.2)' },
  Stable:       { bg: 'rgba(34,197,94,0.08)',   color: '#86efac', border: 'rgba(34,197,94,0.2)' },
  Transitional: { bg: 'rgba(99,102,241,0.08)',  color: '#c7d2fe', border: 'rgba(99,102,241,0.2)' },
  Evaluating:   { bg: 'rgba(148,163,184,0.08)', color: '#94a3b8', border: 'rgba(148,163,184,0.15)' },
}

function PostureTag({ posture }: { posture: string }) {
  const cfg = POSTURE_COLOR[posture] ?? POSTURE_COLOR['Evaluating']
  return (
    <span style={{
      fontSize:      '0.71rem',
      fontWeight:    700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color:         cfg.color,
      background:    cfg.bg,
      border:        `1px solid ${cfg.border}`,
      borderRadius:  6,
      padding:       '0.14rem 0.52rem',
      whiteSpace:    'nowrap',
      flexShrink:    0,
    }}>
      {posture}
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function VRActionGuideCard({ vrState }: Props) {
  const [guide, setGuide] = useState<ActionGuide | null>(null)

  useEffect(() => {
    // Derive base guide from VR state
    const tone    = vrState ? (VR_STATE_TONE[vrState] ?? 'cautious') : null
    const base    = tone ? ACTION_GUIDE_MAP[tone] : FALLBACK_GUIDE

    // Refine with trust axes from localStorage
    const topics   = loadMonitoredTopics()
    const mappings = buildScenarioMappings(topics)
    const trust    = deriveTrustData(topics, mappings)

    setGuide(refineGuide(base, trust.alignment, trust.confidence))
  }, [vrState])

  if (!guide) return null

  return (
    <section style={{
      background:    'rgba(255,255,255,0.015)',
      border:        '1px solid rgba(255,255,255,0.07)',
      borderRadius:  14,
      padding:       '1rem 1.25rem',
      display:       'flex',
      flexDirection: 'column',
      gap:           '0.75rem',
    }}>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{
            fontSize: '0.73rem', color: '#64748b',
            textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700,
          }}>
            System Guidance
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f1f5f9', marginTop: 2 }}>
            Behavioral Framing
          </div>
        </div>
        <PostureTag posture={guide.posture} />
      </div>

      {/* Core message */}
      <div style={{
        fontSize:   '0.87rem',
        color:      '#e2e8f0',
        lineHeight: 1.55,
        fontWeight: 500,
      }}>
        {guide.message}
      </div>

      {/* Bullets */}
      {guide.bullets.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {guide.bullets.map((b, i) => (
            <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ color: '#6366f1', flexShrink: 0, marginTop: '0.15rem', fontSize: '0.8rem' }}>▸</span>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5 }}>{b}</span>
            </li>
          ))}
        </ul>
      )}

      <div style={{ fontSize: '0.67rem', color: '#4b5563' }}>
        Behavioral framing only — not investment advice, not a directional signal
      </div>
    </section>
  )
}
