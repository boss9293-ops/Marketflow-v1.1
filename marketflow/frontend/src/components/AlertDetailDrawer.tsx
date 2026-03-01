'use client'

import { useEffect, useMemo } from 'react'
import BilLabel from '@/components/BilLabel'

export type AlertTrend = {
  gate_score?: number | null
  market_phase?: string | null
  risk_level?: string | null
  risk_trend?: string | null
  phase_shift_flag?: number | null
  gate_delta_5d?: number | null
}

export type AlertItemDetail = {
  date?: string | null
  signal_type?: string | null
  score?: number | null
  strength?: number | null
  streak?: number | null
  severity_label?: string | null
  regime_label?: string | null
  status?: string | null
  payload_json?: {
    rule?: string | null
    trend?: AlertTrend | null
  } | null
}

export type AlertEvidenceContext = {
  gateScore?: number | null
  phase?: string | null
  riskLabel?: string | null
  riskScore?: number | null
  vix?: number | null
  qqqDistPct?: number | null
  exposureBand?: string | null
  asOfDate?: string | null
}

const C = {
  bull: '#00C853',
  transition: '#FFB300',
  defensive: '#FF7043',
  neutral: '#5E6A75',
} as const

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

function sevColor(sev?: string | null) {
  const v = (sev || '').toUpperCase()
  if (v === 'HIGH') return C.defensive
  if (v === 'MED') return C.transition
  return C.bull
}

function fmt(v: number | null | undefined, digits = 0) {
  return typeof v === 'number' ? v.toFixed(digits) : '—'
}

function fmtPct(v: number | null | undefined) {
  return typeof v === 'number' ? `${v > 0 ? '+' : ''}${v.toFixed(2)}%` : '—'
}

function deriveSummary(alert: AlertItemDetail, evidence: AlertEvidenceContext) {
  const sev = (alert.severity_label || 'LOW').toUpperCase()
  const regime = (alert.regime_label || 'NOISE').toUpperCase()
  const phase = alert.payload_json?.trend?.market_phase || evidence.phase || 'UNKNOWN'
  const gate = alert.payload_json?.trend?.gate_score ?? evidence.gateScore
  const risk = alert.payload_json?.trend?.risk_level || evidence.riskLabel || 'UNKNOWN'
  const date = alert.date || evidence.asOfDate || '--'

  const en = `This ${sev} ${regime} alert signals elevated uncertainty around ${date}. Current context suggests phase ${phase}, gate ${gate != null ? gate.toFixed(0) : '—'}, and risk ${risk}. Treat any action as probabilistic, not deterministic.`
  const ko = `${date} 기준 ${sev} ${regime} 성격의 알림으로, 단기 불확실성이 높아진 구간을 의미합니다. 현재 맥락은 국면 ${phase}, 게이트 ${gate != null ? gate.toFixed(0) : '—'}, 리스크 ${risk} 수준으로 해석되며, 대응은 확률적 판단으로 접근해야 합니다.`
  return { ko, en }
}

function deriveActions(alert: AlertItemDetail, evidence: AlertEvidenceContext) {
  const sev = (alert.severity_label || '').toUpperCase()
  const risk = (alert.payload_json?.trend?.risk_level || evidence.riskLabel || '').toUpperCase()
  const band = evidence.exposureBand || '—'
  const vix = evidence.vix

  const a1 = {
    ko: sev === 'HIGH' ? '포지션 확대는 분할로 접근하고, 신규 진입 전 확인 신호를 1개 이상 추가로 확인하세요.' : '추세 추종은 가능하지만 진입 타이밍을 분할해 변동성 리스크를 낮추세요.',
    en: sev === 'HIGH' ? 'Scale entries and require at least one additional confirmation before new risk is added.' : 'Trend-following is possible, but stagger entries to reduce volatility timing risk.',
  }
  const a2 = {
    ko: `현재 노출 가이드는 ${band}이며, 실제 보유 비중과 괴리가 크면 급격한 조정보다 단계적 리밸런싱을 우선하세요.`,
    en: `Current exposure guidance is ${band}; if your portfolio is far from target, prefer gradual rebalancing over abrupt changes.`,
  }
  const a3 = {
    ko: `리스크 ${risk || '—'} / VIX ${typeof vix === 'number' ? vix.toFixed(2) : '—'} 구간에서는 손절·현금 비중·헤지 규칙을 미리 정해두는 것이 유리합니다.`,
    en: `With risk ${risk || '—'} and VIX ${typeof vix === 'number' ? vix.toFixed(2) : '—'}, pre-define stop, cash, and hedge rules before acting.`,
  }

  return [a1, a2, a3]
}

function Chevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TimelineRow({
  alert,
  index,
  selected,
  onSelect,
}: {
  alert: AlertItemDetail
  index: number
  selected?: boolean
  onSelect: (a: AlertItemDetail) => void
}) {
  const sev = sevColor(alert.severity_label)
  const rg = (alert.regime_label || 'NOISE').toUpperCase()
  return (
    <button
      type="button"
      onClick={() => onSelect(alert)}
      style={{
        width: '100%',
        textAlign: 'left',
        background: selected ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.015)',
        border: selected ? '1px solid rgba(255,255,255,0.14)' : '1px solid rgba(255,255,255,0.04)',
        borderRadius: 8,
        color: 'inherit',
        padding: '0.55rem 0.6rem',
        cursor: 'pointer',
        display: 'grid',
        gridTemplateColumns: '4.8rem 1fr auto',
        gap: '0.5rem',
        alignItems: 'center',
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = 'rgba(255,255,255,0.015)'
      }}
    >
      <span style={{ color: '#9ca3af', fontSize: '0.67rem' }}>{alert.date || '-'}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ color: '#e5e7eb', fontSize: '0.73rem', fontWeight: 700 }}>
            {alert.signal_type || `Alert #${index + 1}`}
          </span>
          <span style={{ color: sev }}>
            <BilLabel ko={(alert.severity_label || 'LOW').toUpperCase() === 'HIGH' ? '높음' : (alert.severity_label || 'LOW').toUpperCase() === 'MED' ? '중간' : '낮음'} en={(alert.severity_label || 'LOW').toUpperCase()} variant="micro" />
          </span>
          <span style={{ color: '#c4b5fd' }}>
            <BilLabel ko={rg === 'EVENT' ? '이벤트' : rg === 'STRUCTURAL' ? '구조' : '노이즈'} en={rg} variant="micro" />
          </span>
        </div>
      </div>
      <span style={{ color: '#6b7280', display: 'inline-flex', alignItems: 'center' }}>
        <Chevron />
      </span>
    </button>
  )
}

export default function AlertDetailDrawer({
  open,
  selected,
  alerts,
  evidence,
  onClose,
  onSelect,
}: {
  open: boolean
  selected: AlertItemDetail | null
  alerts: AlertItemDetail[]
  evidence: AlertEvidenceContext
  onClose: () => void
  onSelect: (a: AlertItemDetail) => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const summary = useMemo(
    () => (selected ? deriveSummary(selected, evidence) : { ko: '선택된 알림이 없습니다.', en: 'No alert selected.' }),
    [selected, evidence]
  )

  const actions = useMemo(
    () => deriveActions(selected || {}, evidence),
    [selected, evidence]
  )

  if (!open || !selected) return null

  const trend = selected.payload_json?.trend || {}
  const gateScore = trend.gate_score ?? evidence.gateScore ?? null
  const phase = trend.market_phase ?? evidence.phase ?? null
  const riskLabel = trend.risk_level ?? evidence.riskLabel ?? null
  const riskScore = evidence.riskScore ?? selected.score ?? null
  const asOf = selected.date || evidence.asOfDate || '—'

  const kvs = [
    { ko: '게이트 점수', en: 'Gate score', value: fmt(gateScore, 0), color: gateScore != null ? phaseColor(phase) : '#d1d5db' },
    { ko: '국면', en: 'Phase', value: phase || '—', color: phaseColor(phase) },
    { ko: '리스크 라벨', en: 'Risk label', value: riskLabel || '—', color: riskColor(riskLabel) },
    { ko: '리스크 점수', en: 'Risk score', value: fmt(riskScore, 0), color: '#d1d5db' },
    { ko: 'VIX', en: 'VIX', value: fmt(evidence.vix, 2), color: '#d1d5db' },
    { ko: 'QQQ 거리', en: 'QQQ dist%', value: fmtPct(evidence.qqqDistPct), color: evidence.qqqDistPct != null && evidence.qqqDistPct >= 0 ? C.bull : C.defensive },
    { ko: '노출 밴드', en: 'Exposure band', value: evidence.exposureBand || '—', color: '#93c5fd' },
    { ko: '기준일', en: 'As-of date', value: asOf, color: '#9ca3af' },
  ]

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, backdropFilter: 'blur(2px)' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="mf-drawer-panel"
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          width: 'min(520px, 100vw)',
          background: 'var(--bg-panel)',
          borderLeft: '1px solid rgba(255,255,255,0.1)',
          zIndex: 1001,
          overflowY: 'auto',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '1rem 1rem 0.85rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div style={{ color: '#e5e7eb' }}>
            <BilLabel ko="알림 상세" en="Alert Details" variant="title" />
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.07)', border: 'none', color: '#9ca3af', borderRadius: 8, width: 40, height: 40, cursor: 'pointer', fontSize: '1rem' }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '0.95rem 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
          <section style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: '0.8rem 0.9rem' }}>
            <div style={{ color: '#e5e7eb', marginBottom: 8 }}>
              <BilLabel ko="요약" en="Summary" variant="label" />
            </div>
            <div style={{ color: '#e5e7eb', fontSize: '0.83rem', lineHeight: 1.55 }}>{summary.ko || summary.en}</div>
            <div style={{ color: '#4b5563', fontSize: '0.69rem', lineHeight: 1.45, marginTop: 6 }}>{summary.en}</div>
          </section>

          <section style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: '0.8rem 0.9rem' }}>
            <div style={{ color: '#e5e7eb', marginBottom: 8 }}>
              <BilLabel ko="근거" en="Evidence" variant="label" />
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '7px 12px',
              }}
            >
              {kvs.map((kv) => (
                <div key={kv.en} style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  <div style={{ color: '#9ca3af' }}>
                    <BilLabel ko={kv.ko} en={kv.en} variant="micro" />
                  </div>
                  <div style={{ color: kv.color, fontSize: '0.78rem', fontWeight: 700, lineHeight: 1.2, wordBreak: 'break-word' }}>
                    {kv.value}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: '0.8rem 0.9rem' }}>
            <div style={{ color: '#e5e7eb', marginBottom: 8 }}>
              <BilLabel ko="대응" en="What to do" variant="label" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {actions.map((a, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '12px 1fr', gap: 8, alignItems: 'start' }}>
                  <span style={{ color: '#6b7280', fontSize: '0.8rem', lineHeight: 1.5 }}>•</span>
                  <div>
                    <div style={{ color: '#e5e7eb', fontSize: '0.8rem', lineHeight: 1.45 }}>{a.ko}</div>
                    <div style={{ color: '#4b5563', fontSize: '0.67rem', lineHeight: 1.35, marginTop: 3 }}>{a.en}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ color: '#374151', fontSize: '0.64rem', marginTop: 8 }}>Probabilistic guidance only. Not financial advice.</div>
          </section>

          <section style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: '0.8rem 0.9rem' }}>
            <div style={{ color: '#e5e7eb', marginBottom: 8 }}>
              <BilLabel ko="최근 기록" en="Recent timeline" variant="label" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(Array.isArray(alerts) ? alerts : []).slice(0, 8).map((a, idx) => (
                <TimelineRow
                  key={`${a.date || 'na'}-${idx}`}
                  alert={a}
                  index={idx}
                  selected={a === selected}
                  onSelect={onSelect}
                />
              ))}
              {(!Array.isArray(alerts) || alerts.length === 0) && (
                <div style={{ color: '#6b7280', fontSize: '0.78rem' }}>No alert history.</div>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
