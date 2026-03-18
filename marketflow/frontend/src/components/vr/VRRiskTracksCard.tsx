/**
 * VRRiskTracksCard — WO61
 * Surfaces the dual-track risk model: Event Risk vs Structural Risk
 * Data comes from vr_survival.json (event state) + risk_v1.json (MSS/structural)
 * No engine logic duplicated here — pure display + label mapping
 */

// ── Types ────────────────────────────────────────────────────────────────────

type EventTrackState = 'NORMAL' | 'EVENT_WATCH' | 'EVENT_CRASH' | 'POST_EXIT'

type StructuralTrackState =
  | 'NONE'
  | 'STRUCTURAL_WATCH'
  | 'STRUCTURAL_STRESS'
  | 'STRUCTURAL_CRASH'

export type VRRiskTracksInput = {
  /** Raw VF state string from vr_survival.json current.state */
  rawEventState: string | null
  /** Actual structural state from vr_survival.json current.structural_state */
  structuralState: string | null
  /** MSS score from risk_v1.json (kept for meta row display only) */
  mssScore: number | null
  /** MSS level from risk_v1.json (kept for meta row display only) */
  mssLevel: number | null
  /** Date of last update */
  updatedAt: string | null
}

// ── Label & color mappings ────────────────────────────────────────────────────

const EVENT_LABELS: Record<EventTrackState, string> = {
  NORMAL:      'Normal',
  EVENT_WATCH: 'Watch',
  EVENT_CRASH: 'Crash',
  POST_EXIT:   'Post-Exit',
}

const EVENT_COLORS: Record<EventTrackState, string> = {
  NORMAL:      '#86efac',   // green-300
  EVENT_WATCH: '#fde68a',   // amber-200
  EVENT_CRASH: '#fca5a5',   // red-300
  POST_EXIT:   '#c4b5fd',   // violet-300
}

const STRUCTURAL_LABELS: Record<StructuralTrackState, string> = {
  NONE:               'None',
  STRUCTURAL_WATCH:   'Watch',
  STRUCTURAL_STRESS:  'Stress',
  STRUCTURAL_CRASH:   'Crash',
}

const STRUCTURAL_COLORS: Record<StructuralTrackState, string> = {
  NONE:               '#64748b',   // slate-500 (muted — no concern)
  STRUCTURAL_WATCH:   '#fde68a',   // amber-200
  STRUCTURAL_STRESS:  '#fb923c',   // orange-400
  STRUCTURAL_CRASH:   '#fca5a5',   // red-300
}

// ── State derivation ─────────────────────────────────────────────────────────

function deriveEventState(raw: string | null): EventTrackState {
  if (!raw) return 'NORMAL'
  const s = raw.toUpperCase()
  if (s.includes('EXIT'))       return 'POST_EXIT'
  if (s.includes('CRASH') || s.includes('SHOCK') || s.includes('STRUCTURAL')) return 'EVENT_CRASH'
  if (s.includes('ARMED') || s.includes('GRIND') || s.includes('WATCH'))      return 'EVENT_WATCH'
  return 'NORMAL'
}

function deriveStructuralState(raw: string | null): StructuralTrackState {
  if (!raw) return 'NONE'
  const s = raw.toUpperCase()
  if (s === 'STRUCTURAL_CRASH')  return 'STRUCTURAL_CRASH'
  if (s === 'STRUCTURAL_STRESS') return 'STRUCTURAL_STRESS'
  if (s === 'STRUCTURAL_WATCH')  return 'STRUCTURAL_WATCH'
  return 'NONE'
}

// ── Text templates ────────────────────────────────────────────────────────────

const EVENT_DESCRIPTIONS: Record<EventTrackState, string> = {
  NORMAL:      'No active event-driven shock is currently dominating short-term behavior.',
  EVENT_WATCH: 'Short-term stress signals are elevated, but a full event-crash state has not been confirmed.',
  EVENT_CRASH: 'A short-term event-driven shock is active and has disrupted normal market behavior.',
  POST_EXIT:   'The event-driven crash phase has eased, but recovery conditions are still being evaluated.',
}

const STRUCTURAL_DESCRIPTIONS: Record<StructuralTrackState, string> = {
  NONE:              'No persistent structural deterioration is currently being confirmed.',
  STRUCTURAL_WATCH:  'Conditions are showing signs of persistent pressure beyond a typical short-lived shock.',
  STRUCTURAL_STRESS: 'The environment is displaying sustained deterioration consistent with a broader risk regime.',
  STRUCTURAL_CRASH:  'Short-term shock has evolved into a structural risk regime with persistent damage and weak recovery quality.',
}

// ── Combined summary ──────────────────────────────────────────────────────────

function combinedSummary(ev: EventTrackState, st: StructuralTrackState): string {
  if (ev === 'NORMAL' && st === 'NONE')
    return 'No active risk pressure detected on either track.'
  if (ev === 'EVENT_CRASH' && st === 'NONE')
    return 'Current risk is primarily event-driven — may still be temporary.'
  if ((ev === 'EVENT_WATCH' || ev === 'EVENT_CRASH') && st === 'STRUCTURAL_WATCH')
    return 'Current risk is transitioning from event shock to structural watch.'
  if ((ev === 'EVENT_WATCH' || ev === 'EVENT_CRASH') && st === 'STRUCTURAL_STRESS')
    return 'Short-term shock is active inside a deteriorating broader regime.'
  if (ev === 'EVENT_CRASH' && st === 'STRUCTURAL_CRASH')
    return 'Highest concern state — both immediate disruption and persistent structural damage are active.'
  if (ev === 'POST_EXIT' && (st === 'STRUCTURAL_STRESS' || st === 'STRUCTURAL_CRASH'))
    return 'The sharp shock has eased, but the broader structural environment remains weak.'
  if (ev === 'NORMAL' && st !== 'NONE')
    return 'No active event shock, but background structural pressure remains elevated.'
  return 'Current risk is primarily event-driven.'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TrackPanel({
  trackLabel,
  state,
  stateLabel,
  color,
  description,
}: {
  trackLabel: string
  state: string
  stateLabel: string
  color: string
  description: string
}) {
  return (
    <div style={{
      flex: 1,
      minWidth: 0,
      padding: '1rem 1.1rem',
      background: 'rgba(255,255,255,0.025)',
      borderRadius: 8,
      border: '1px solid rgba(255,255,255,0.07)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.55rem',
    }}>
      {/* Track label */}
      <div style={{
        fontSize: '0.64rem',
        color: '#475569',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        fontWeight: 700,
      }}>
        {trackLabel}
      </div>

      {/* State pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontSize: '0.82rem',
          fontWeight: 700,
          color,
          background: color + '18',
          padding: '0.18rem 0.65rem',
          borderRadius: 5,
          border: `1px solid ${color}30`,
          letterSpacing: '0.04em',
        }}>
          {stateLabel}
        </span>
      </div>

      {/* Description */}
      <div style={{
        fontSize: '0.78rem',
        color: '#94a3b8',
        lineHeight: 1.55,
      }}>
        {description}
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function VRRiskTracksCard({ rawEventState, structuralState: rawStructural, mssScore, mssLevel, updatedAt }: VRRiskTracksInput) {
  const eventState      = deriveEventState(rawEventState)
  const structuralState = deriveStructuralState(rawStructural)
  const summary         = combinedSummary(eventState, structuralState)

  const eventColor      = EVENT_COLORS[eventState]
  const structuralColor = STRUCTURAL_COLORS[structuralState]

  // Unavailable fallback
  if (rawEventState === null && mssScore === null) {
    return (
      <div style={{
        background: '#111827',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10,
        padding: '1rem 1.25rem',
        color: '#475569',
        fontSize: '0.82rem',
      }}>
        <span style={{ color: '#64748b', fontWeight: 600 }}>Risk Tracks</span>
        {' '}— classification temporarily unavailable. VR posture remains based on current system state.
      </div>
    )
  }

  return (
    <div style={{
      background: '#111827',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10,
      padding: '1rem 1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
        <div>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1', letterSpacing: '0.03em' }}>
            Risk Structure
          </span>
          <span style={{ fontSize: '0.72rem', color: '#475569', marginLeft: 8 }}>
            Short-term shock vs persistent structural pressure
          </span>
        </div>
        {updatedAt && (
          <span style={{ fontSize: '0.68rem', color: '#334155', whiteSpace: 'nowrap' }}>
            {updatedAt}
          </span>
        )}
      </div>

      {/* Two track panels */}
      <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
        <TrackPanel
          trackLabel="Event Risk"
          state={eventState}
          stateLabel={EVENT_LABELS[eventState]}
          color={eventColor}
          description={EVENT_DESCRIPTIONS[eventState]}
        />
        <TrackPanel
          trackLabel="Structural Risk"
          state={structuralState}
          stateLabel={STRUCTURAL_LABELS[structuralState]}
          color={structuralColor}
          description={STRUCTURAL_DESCRIPTIONS[structuralState]}
        />
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

      {/* Combined summary */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontSize: '0.64rem', color: '#334155', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, paddingTop: 2, flexShrink: 0 }}>
          Combined
        </span>
        <span style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5 }}>
          {summary}
        </span>
      </div>

      {/* Score meta row (compact, muted) */}
      {mssScore !== null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <MetaItem label="MSS" value={String(Math.round(mssScore))} />
          <MetaItem label="Level" value={mssLevel !== null ? String(mssLevel) : '—'} />
          <MetaItem label="Source" value="WO60-B Engine" />
        </div>
      )}
    </div>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ fontSize: '0.64rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
        {label}
      </span>
      <span style={{ fontSize: '0.68rem', color: '#475569', fontWeight: 500 }}>
        {value}
      </span>
    </div>
  )
}
