'use client'
// B-5: Action Layer — SOXX + SOXL + invalidation + thesis
import type { TranslationOutput } from '@/lib/semiconductor/types'


const ACTION_COLOR: Record<string, string> = {
  'ADD / HOLD': '#22c55e', 'HOLD / ADD ON DIPS': '#38bdf8',
  'HOLD / ADD GRADUALLY': '#38bdf8', HOLD: '#94a3b8',
  'HOLD / REDUCE': '#f97316', REDUCE: '#ef4444',
}
const WINDOW_COLOR: Record<string, string> = {
  ALLOWED: '#22c55e', 'TACTICAL ONLY': '#f59e0b', AVOID: '#ef4444',
}
const INV_COLOR: Record<string, string> = { 'not triggered': '#22c55e', TRIGGERED: '#ef4444' }

interface Props { translation: TranslationOutput }

const UI_FONT = "'Inter', 'Pretendard', sans-serif";
const DATA_FONT = "'JetBrains Mono', 'Roboto Mono', monospace";

export default function ActionLayer({ translation }: Props) {
  const { soxx, soxl, conflict_mode, conflict_note,
          inv1_status, inv2_status, divergences } = translation

  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8,
                  padding: '14px 18px' }}>
      <div style={{ fontSize: 11, color: '#64748b', letterSpacing: 2, marginBottom: 14 }}>
        ACTION
      </div>

      {/* SOXX */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 12,
                    padding: '10px 12px', background: '#0a1122', borderRadius: 6 }}>
        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, width: 50 }}>SOXX</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: ACTION_COLOR[soxx.action] ?? '#94a3b8' }}>
            {soxx.action}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>Reason: {soxx.reason}</div>
          <div style={{ fontSize: 11, color: '#818cf8', marginTop: 2 }}>Dominant: {soxx.dominant_signal}</div>
        </div>
      </div>

      {/* SOXL */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 14,
                    padding: '10px 12px', background: '#0a1122', borderRadius: 6 }}>
        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, width: 50 }}>SOXL</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: WINDOW_COLOR[soxl.window] ?? '#94a3b8' }}>
            {soxl.window}
            {soxl.window !== 'AVOID' && (
              <span style={{ fontSize: 12, fontWeight: 400, color: '#94a3b8', marginLeft: 8 }}>
                ({soxl.sizing}, {soxl.hold_window})
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>Reason: {soxl.reason}</div>
          <div style={{ fontSize: 11, color: '#818cf8', marginTop: 2 }}>Dominant: {soxl.dominant_signal}</div>
        </div>
      </div>

      {/* Conflict mode */}
      <div style={{ marginBottom: 12, fontSize: 12 }}>
        <span style={{ color: '#64748b' }}>Conflict Mode: </span>
        <span style={{ color: conflict_mode ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
          {conflict_mode ? 'ON' : 'OFF'}
        </span>
        {conflict_mode && conflict_note && (
          <div style={{ color: '#f97316', marginTop: 4, fontSize: 11 }}>⚠ {conflict_note}</div>
        )}
      </div>

      {/* Watch items */}
      <div style={{ marginBottom: 12, padding: '8px 12px', background: '#0c1a2e',
                    borderRadius: 6, border: '1px solid #1e3a5f' }}>
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>WATCH</div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>Equipment: {divergences.soxx_equip_gap}</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>NVDA–MU: {divergences.nvda_mu_gap}</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>Leaders vs Rest: {divergences.leaders_vs_rest}</div>
      </div>

      {/* Invalidation status */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 12, fontSize: 12 }}>
        <div>
          <span style={{ color: '#64748b' }}>INV-1 (Breadth collapse): </span>
          <span style={{ color: INV_COLOR[inv1_status], fontWeight: 600 }}>
            {inv1_status.toUpperCase()}
          </span>
        </div>
        <div>
          <span style={{ color: '#64748b' }}>INV-2 (Stage → RESET): </span>
          <span style={{ color: INV_COLOR[inv2_status], fontWeight: 600 }}>
            {inv2_status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Thesis */}
      <div style={{ padding: '8px 12px', background: '#0a1122', borderRadius: 6,
                    fontSize: 12, color: '#94a3b8', borderLeft: '2px solid #334155' }}>
        <span style={{ color: '#64748b' }}>Thesis: </span>
        {translation.action_summary}
      </div>
    </div>
  )
}
