'use client'

import { useMemo, useState } from 'react'
import BilLabel from '@/components/BilLabel'

export type SignalAlert = {
  date?: string | null
  signal_type?: string | null
  score?: number | null
  status?: string | null
  strength?: number | null
  severity_label?: string | null
  streak?: number | null
  regime_label?: string | null
  recovery_streak?: number | null
  created_at?: string | null
  payload_json?: {
    rule?: string | null
    trend?: {
      gate_score?: number | null
      market_phase?: string | null
      risk_level?: string | null
      risk_trend?: string | null
      gate_delta_5d?: number | null
    } | null
    [key: string]: unknown
  } | null
}

const C = {
  bull: '#00C853',
  transition: '#FFB300',
  defensive: '#FF7043',
  shock: '#D32F2F',
  neutral: '#5E6A75',
  panel: '#11161C',
} as const

function sevColor(sev?: string | null) {
  const v = (sev || '').toUpperCase()
  if (v === 'HIGH') return C.defensive
  if (v === 'MED') return C.transition
  return C.bull
}

function regimeColor(regime?: string | null) {
  const v = (regime || '').toUpperCase()
  if (v === 'STRUCTURAL') return '#a78bfa'
  if (v === 'EVENT') return '#fb923c'
  return C.neutral
}

function phaseColor(phase?: string | null) {
  const v = (phase || '').toUpperCase()
  if (v === 'BULL') return C.bull
  if (v === 'BEAR') return C.defensive
  if (v === 'NEUTRAL') return C.transition
  return C.neutral
}

function riskColor(risk?: string | null) {
  const v = (risk || '').toUpperCase()
  if (v === 'LOW') return C.bull
  if (v === 'MEDIUM') return C.transition
  if (v === 'HIGH') return C.defensive
  return C.neutral
}

function fmtNum(v: number | null | undefined, digits = 0) {
  return typeof v === 'number' ? v.toFixed(digits) : '--'
}

function fmtSigned(v: number | null | undefined, digits = 0) {
  return typeof v === 'number' ? `${v > 0 ? '+' : ''}${v.toFixed(digits)}` : '--'
}

function AlertDrawer({ item, onClose }: { item: SignalAlert; onClose: () => void }) {
  const trend = item.payload_json?.trend
  const severity = (item.severity_label || 'LOW').toUpperCase()
  const sev = sevColor(severity)
  const reg = regimeColor(item.regime_label)

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.55)',
          zIndex: 1000,
          backdropFilter: 'blur(2px)',
        }}
      />
      <div
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          width: 'min(440px, 94vw)',
          background: C.panel,
          borderLeft: '1px solid rgba(255,255,255,0.1)',
          zIndex: 1001,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
        }}
      >
        <div
          style={{
            padding: '1.1rem 1.3rem',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#e5e7eb' }}>
              <BilLabel ko="알림 상세" en="Alert Detail" variant="title" />
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{item.date || '--'}</span>
              <span
                style={{
                  fontSize: '0.64rem',
                  fontWeight: 700,
                  color: sev,
                  background: `${sev}16`,
                  border: `1px solid ${sev}35`,
                  borderRadius: 999,
                  padding: '2px 7px',
                }}
              >
                {severity}
              </span>
              <span
                style={{
                  fontSize: '0.64rem',
                  fontWeight: 700,
                  color: reg,
                  background: `${reg}14`,
                  border: `1px solid ${reg}30`,
                  borderRadius: 999,
                  padding: '2px 7px',
                }}
              >
                {(item.regime_label || 'NOISE').toUpperCase()}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: 'none',
              color: '#9ca3af',
              borderRadius: 8,
              width: 32,
              height: 32,
              cursor: 'pointer',
              fontSize: '1rem',
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '1.1rem 1.3rem', display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
            {[
              { label: 'Score', value: fmtNum(item.score, 0), color: '#e5e7eb' },
              { label: 'Strength', value: fmtNum(item.strength, 0), color: sev },
              { label: 'Streak', value: fmtNum(item.streak, 0), color: '#93c5fd' },
            ].map((m) => (
              <div key={m.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '0.7rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.6rem', color: '#6b7280', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '0.8rem 0.9rem' }}>
            <div style={{ color: '#9ca3af', fontSize: '0.65rem', marginBottom: 6 }}>Signal</div>
            <div style={{ color: '#e5e7eb', fontWeight: 700, fontSize: '0.9rem' }}>
              {item.signal_type || '--'}
            </div>
            <div style={{ color: '#6b7280', fontSize: '0.68rem', marginTop: 4 }}>
              Status: {(item.status || 'unknown').toUpperCase()} / Recovery streak: {fmtNum(item.recovery_streak, 0)}
            </div>
          </div>

          {trend && (
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '0.8rem 0.9rem' }}>
              <div style={{ color: '#9ca3af', fontSize: '0.65rem', marginBottom: 8 }}>Trend Context</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '6px 12px' }}>
                <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>Gate</div>
                <div style={{ fontSize: '0.72rem', color: '#e5e7eb', fontWeight: 700 }}>{fmtNum(trend.gate_score, 0)}</div>
                <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>Phase</div>
                <div style={{ fontSize: '0.72rem', color: phaseColor(trend.market_phase), fontWeight: 700 }}>{trend.market_phase || '--'}</div>
                <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>Risk</div>
                <div style={{ fontSize: '0.72rem', color: riskColor(trend.risk_level), fontWeight: 700 }}>{trend.risk_level || '--'}</div>
                <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>Risk Trend</div>
                <div style={{ fontSize: '0.72rem', color: '#d1d5db' }}>{trend.risk_trend || '--'}</div>
                <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>Gate Δ5d</div>
                <div style={{ fontSize: '0.72rem', color: '#d1d5db' }}>{fmtSigned(trend.gate_delta_5d, 0)}</div>
              </div>
            </div>
          )}

          {item.payload_json?.rule && (
            <div style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 10, padding: '0.8rem 0.9rem' }}>
              <div style={{ color: '#60a5fa', fontSize: '0.65rem', marginBottom: 6, fontWeight: 700 }}>Rule</div>
              <div style={{ color: '#dbeafe', fontSize: '0.75rem', lineHeight: 1.5, wordBreak: 'break-word' }}>
                {item.payload_json.rule}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '0.85rem 1.3rem', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '0.66rem', color: '#374151' }}>
          Created: {item.created_at || '--'}
        </div>
      </div>
    </>
  )
}

export default function SignalsAlertsPanel({ alerts }: { alerts: SignalAlert[] }) {
  const [selected, setSelected] = useState<SignalAlert | null>(null)

  const activeAlerts = useMemo(
    () => (Array.isArray(alerts) ? alerts : []).filter((a) => (a?.status || 'active').toLowerCase() === 'active'),
    [alerts]
  )

  return (
    <>
      <div
        style={{
          background: C.panel,
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 14,
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.07)', color: '#e5e7eb' }}>
          <BilLabel ko="활성 알림" en="Active Alerts" variant="label" />
        </div>

        {activeAlerts.length === 0 ? (
          <div style={{ color: '#6b7280', fontSize: '0.82rem', padding: '1rem' }}>
            활성 알림이 없습니다.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {activeAlerts.map((a, i) => {
              const sev = sevColor(a.severity_label)
              const reg = regimeColor(a.regime_label)
              return (
                <button
                  key={`${a.date || 'na'}-${a.signal_type || 'alert'}-${i}`}
                  onClick={() => setSelected(a)}
                  style={{
                    textAlign: 'left',
                    background: i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    color: 'inherit',
                    padding: '0.8rem 1rem',
                    cursor: 'pointer',
                    display: 'grid',
                    gridTemplateColumns: '5.8rem 1fr auto',
                    gap: '0.75rem',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{a.date || '--'}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.76rem', color: '#e5e7eb', fontWeight: 700 }}>
                        {a.signal_type || 'ALERT'}
                      </span>
                      <span style={{ fontSize: '0.62rem', color: sev, border: `1px solid ${sev}35`, background: `${sev}12`, borderRadius: 999, padding: '1px 6px', fontWeight: 700 }}>
                        {(a.severity_label || 'LOW').toUpperCase()}
                      </span>
                      <span style={{ fontSize: '0.62rem', color: reg, border: `1px solid ${reg}30`, background: `${reg}10`, borderRadius: 999, padding: '1px 6px', fontWeight: 700 }}>
                        {(a.regime_label || 'NOISE').toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {a.payload_json?.rule || 'Click to view details'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 62 }}>
                    <div style={{ fontSize: '0.74rem', color: '#d1d5db', fontWeight: 700 }}>
                      {typeof a.score === 'number' ? a.score.toFixed(0) : '--'}
                    </div>
                    <div style={{ fontSize: '0.62rem', color: '#4b5563' }}>
                      streak {typeof a.streak === 'number' ? a.streak : '--'}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {selected && <AlertDrawer item={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
