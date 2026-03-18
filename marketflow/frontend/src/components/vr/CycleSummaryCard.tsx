/**
 * CycleSummaryCard — WO62 Cycle Intelligence Slim
 * Horizontal scroll row of C1-Cn cards above the playback chart.
 * Shows per-cycle DD (eval delta), recovery days, and pool usage.
 * Pure display — no engine logic.
 */

import type { CycleExecutionSummary } from '../../../../../vr/types/execution_playback'

// ── Helpers ──────────────────────────────────────────────────────────────────

function ddColor(dd: number): string {
  if (dd < -40) return '#fca5a5'   // red-300
  if (dd < -20) return '#fb923c'   // orange-400
  return '#86efac'                 // green-300
}

function fmtDd(dd: number): string {
  return (dd >= 0 ? '+' : '') + dd.toFixed(1) + '%'
}

function recoveryDays(cs: CycleExecutionSummary): number | null {
  if (!cs.end_date || !cs.start_date) return null
  const ms = new Date(cs.end_date).getTime() - new Date(cs.start_date).getTime()
  if (isNaN(ms) || ms < 0) return null
  return Math.round(ms / 86400000)
}

// ── Sub-component ─────────────────────────────────────────────────────────────

function CycleCard({ cs }: { cs: CycleExecutionSummary }) {
  const dd =
    cs.start_evaluation_value > 0
      ? ((cs.end_evaluation_value / cs.start_evaluation_value) - 1) * 100
      : 0
  const color = ddColor(dd)
  const days  = recoveryDays(cs)
  const pool  = cs.pool_used_pct_in_cycle

  return (
    <div style={{
      flexShrink: 0,
      width: 110,
      padding: '0.6rem 0.75rem',
      background: 'rgba(255,255,255,0.025)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 8,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.35rem',
    }}>
      {/* Cycle label */}
      <div style={{
        fontSize: '0.62rem',
        color: '#475569',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        fontWeight: 700,
      }}>
        C{cs.cycle_no}
      </div>

      {/* DD */}
      <div>
        <div style={{ fontSize: '0.6rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em' }}>DD</div>
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color, letterSpacing: '0.02em' }}>
          {fmtDd(dd)}
        </div>
      </div>

      {/* Recovery */}
      <div>
        <div style={{ fontSize: '0.6rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Days</div>
        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8' }}>
          {days !== null ? days : '—'}
        </div>
      </div>

      {/* Pool used */}
      <div>
        <div style={{ fontSize: '0.6rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pool</div>
        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b' }}>
          {pool > 0 ? pool.toFixed(0) + '%' : '—'}
        </div>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function CycleSummaryCard({ cycleSummaries }: { cycleSummaries: CycleExecutionSummary[] }) {
  if (!cycleSummaries || cycleSummaries.length === 0) return null

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.55rem',
      overflowX: 'auto',
      paddingBottom: '0.25rem',
      marginBottom: '0.5rem',
      scrollbarWidth: 'thin',
    }}>
      {/* Label column */}
      <div style={{
        flexShrink: 0,
        paddingTop: '0.6rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
      }}>
        <div style={{
          fontSize: '0.62rem',
          color: '#334155',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          fontWeight: 700,
          whiteSpace: 'nowrap',
        }}>
          Cycles
        </div>
      </div>

      {/* Cycle cards */}
      {cycleSummaries.map((cs) => (
        <CycleCard key={cs.cycle_no} cs={cs} />
      ))}
    </div>
  )
}
