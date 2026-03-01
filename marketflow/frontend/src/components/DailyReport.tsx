'use client'

import React, { useEffect, useState } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'

// ── Types ─────────────────────────────────────────────────────────────────────
interface MarketSummary {
  lines: string[]
  bullets: string[]
  action_hint: string
  overall_tone: 'bullish' | 'bearish' | 'neutral'
  overall_tone_label: string
  tone_reason_codes: string[]
  gate_score: number | null
  gate_signal: string | null
  regime_label: string
  signals: string[]
  raw_signals: string[]
}

interface HotStock {
  symbol: string
  price: number | null
  change_pct: number | null
  vol_ratio: number | null
  ai_score: number | null
  rsi: number | null
  tags: string[]
  comment: string
}

interface SectorItem {
  symbol: string
  name: string
  change_1d: number | null
  change_3m: number | null
}

interface SectorBrief {
  phase: string
  phase_label: string
  phase_color: string
  interp: string
  leaders: SectorItem[]
  laggers: SectorItem[]
  lines: string[]
}

interface AlertItem {
  type: string
  symbol: string
  message: string
}

interface RiskBrief {
  risk_level: 'low' | 'medium' | 'high'
  risk_label: string
  gate_score: number | null
  lines: string[]
  alerts: AlertItem[]
  alerts_hidden_count: number
  raw_alert_count: number
}

interface MissingDetail {
  file: string
  affects: string
  fix: string
}

interface DataCoverage {
  available: number
  total: number
  pct: number
  sources: Record<string, boolean>
  missing_inputs: string[]
  missing_details: MissingDetail[]
  rerun_hint: string | null
}

interface Narratives {
  market: string
  sector: string
  risk: string
}

interface DailyReportData {
  generated_at: string | null
  data_coverage: DataCoverage
  market_summary: MarketSummary
  hot_stocks_brief: HotStock[]
  sector_brief: SectorBrief
  risk_brief: RiskBrief
  narratives?: Narratives
}

// ── Tone color ─────────────────────────────────────────────────────────────────
function toneColor(tone: string): string {
  if (tone === 'bullish') return '#22c55e'
  if (tone === 'bearish') return '#ef4444'
  return '#f59e0b'
}

function toneGlow(tone: string): string {
  if (tone === 'bullish') return 'rgba(34,197,94,0.15)'
  if (tone === 'bearish') return 'rgba(239,68,68,0.15)'
  return 'rgba(245,158,11,0.15)'
}

// ── Risk color ─────────────────────────────────────────────────────────────────
function riskColor(level: string): string {
  if (level === 'low') return '#22c55e'
  if (level === 'high') return '#ef4444'
  return '#f59e0b'
}

// ── Change color ───────────────────────────────────────────────────────────────
function chgColor(v: number | null): string {
  if (v == null) return '#6b7280'
  return v >= 0 ? '#22c55e' : '#ef4444'
}

function fmtPct(v: number | null): string {
  if (v == null) return 'N/A'
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'
}

// ── Alert type badge ────────────────────────────────────────────────────────────
function AlertTypeBadge({ type }: { type: string }) {
  const configs: Record<string, { label: string; color: string; bg: string }> = {
    SMART_MONEY: { label: 'SM', color: '#00D9FF', bg: 'rgba(0,217,255,0.1)' },
    VCP:         { label: 'VCP', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    STRUCTURAL:  { label: 'STR', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    EVENT:       { label: 'EVT', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  }
  const cfg = configs[type] || { label: type.slice(0, 3), color: '#6b7280', bg: 'rgba(107,114,128,0.1)' }
  return (
    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: cfg.color, background: cfg.bg, borderRadius: 3, padding: '1px 5px', minWidth: 32, textAlign: 'center', display: 'inline-block' }}>
      {cfg.label}
    </span>
  )
}

// ── Tone reason code badge ──────────────────────────────────────────────────────
function ToneReasonBadge({ code }: { code: string }) {
  const bearishCodes = new Set(['INDEX_DOWN', 'GATE_RED', 'VIX_FEAR', 'VIX_HIGH', 'REGIME_RISK_OFF'])
  const bullishCodes = new Set(['INDEX_UP', 'GATE_GREEN', 'VIX_LOW', 'REGIME_RISK_ON'])
  const color = bearishCodes.has(code) ? '#ef4444' : bullishCodes.has(code) ? '#22c55e' : '#6b7280'
  return (
    <span style={{ fontSize: '0.65rem', fontWeight: 600, color, background: `${color}18`, borderRadius: 4, padding: '1px 6px', border: `1px solid ${color}30` }}>
      {code}
    </span>
  )
}

// ── AI Score badge ─────────────────────────────────────────────────────────────
function AIBadge({ score }: { score: number | null }) {
  if (score == null) return null
  const bg = score >= 80 ? 'rgba(0,217,255,0.18)' : score >= 60 ? 'rgba(245,158,11,0.18)' : 'rgba(107,114,128,0.2)'
  const col = score >= 80 ? '#00D9FF' : score >= 60 ? '#f59e0b' : '#9ca3af'
  return (
    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: col, background: bg, borderRadius: 4, padding: '1px 5px' }}>
      AI {score}
    </span>
  )
}

// ── Coverage badge ─────────────────────────────────────────────────────────────
function CoverageBadge({ cov }: { cov: DataCoverage }) {
  const color = cov.pct >= 75 ? '#22c55e' : '#f59e0b'
  return (
    <span style={{ fontSize: '0.7rem', color, background: 'rgba(255,255,255,0.05)', border: `1px solid ${color}40`, borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>
      데이터 {cov.available}/{cov.total}
    </span>
  )
}

// ── Section wrapper ─────────────────────────────────────────────────────────────
function Section({ title, accent, children }: { title: string; accent?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#1c1c1e', borderRadius: 12, padding: '1.25rem 1.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: accent || '#00D9FF', marginBottom: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

// ── A) Market Summary ──────────────────────────────────────────────────────────
function NarrativeSummaryCard({ narratives }: { narratives?: Narratives }) {
  const emptyText = '데이터가 충분하지 않아 요약을 생성하지 못했습니다.'
  const items = [
    { key: 'market', title: 'Market', text: narratives?.market || emptyText, color: '#00D9FF' },
    { key: 'sector', title: 'Sector', text: narratives?.sector || emptyText, color: '#f59e0b' },
    { key: 'risk', title: 'Risk', text: narratives?.risk || emptyText, color: '#ef4444' },
  ]

  return (
    <div style={{ background: '#1c1c1e', borderRadius: 12, padding: '1rem 1.2rem', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#9ca3af', marginBottom: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Narrative Summary
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.7rem' }}>
        {items.map(item => (
          <div key={item.key} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)', padding: '0.7rem 0.8rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: item.color, marginBottom: '0.35rem', textTransform: 'uppercase' }}>
              {item.title}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#d1d5db', lineHeight: 1.6 }}>
              {item.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MarketSummaryCard({ ms }: { ms: MarketSummary }) {
  const color = toneColor(ms.overall_tone)
  const glow  = toneGlow(ms.overall_tone)
  // Use bullets if available (v1.1), fall back to lines (v1.0)
  const displayLines = (ms.bullets && ms.bullets.length > 0) ? ms.bullets : ms.lines

  return (
    <div style={{ background: glow, border: `1px solid ${color}40`, borderRadius: 12, padding: '1.25rem 1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '1.1rem', fontWeight: 800, color }}>
          {ms.overall_tone === 'bullish' ? '▲' : ms.overall_tone === 'bearish' ? '▼' : '◆'} 시장 {ms.overall_tone_label}
        </span>
        {ms.gate_score != null && (
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#00D9FF', background: 'rgba(0,217,255,0.12)', borderRadius: 6, padding: '3px 10px' }}>
            Gate {ms.gate_score}
          </span>
        )}
        {ms.gate_signal && (
          <span style={{ fontSize: '0.75rem', color: '#aeb5c5' }}>{ms.gate_signal}</span>
        )}
      </div>

      {/* Bullets / Summary lines — v1.1 uses larger font */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
        {displayLines.map((line, i) => (
          <div key={i} style={{
            fontSize: '0.9rem',
            color: '#e2e8f0',
            lineHeight: 1.65,
            paddingLeft: '0.6rem',
            borderLeft: `2px solid ${color}50`,
            fontWeight: i === displayLines.length - 1 && ms.bullets?.length ? 600 : 400,
          }}>
            {line}
          </div>
        ))}
      </div>

      {/* Action hint highlight (v1.1) */}
      {ms.action_hint && (
        <div style={{
          background: `${color}12`,
          border: `1px solid ${color}30`,
          borderRadius: 8,
          padding: '0.5rem 0.8rem',
          fontSize: '0.85rem',
          fontWeight: 700,
          color,
          marginBottom: '0.65rem',
        }}>
          ▶ {ms.action_hint}
        </div>
      )}

      {/* Tone reason codes — collapsible (v1.1) */}
      {ms.tone_reason_codes && ms.tone_reason_codes.length > 0 && (
        <details style={{ marginBottom: '0.5rem' }}>
          <summary style={{
            fontSize: '0.72rem',
            color: '#6b7280',
            cursor: 'pointer',
            userSelect: 'none',
            listStyle: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}>
            <span style={{ fontSize: '0.65rem' }}>▶</span>
            <span>판단 근거 ({ms.tone_reason_codes.length}개)</span>
          </summary>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.5rem', paddingLeft: '0.75rem' }}>
            {ms.tone_reason_codes.map(code => (
              <ToneReasonBadge key={code} code={code} />
            ))}
          </div>
        </details>
      )}

      {/* Signals */}
      {ms.signals.length > 0 && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
          {ms.signals.map(s => (
            <span key={s} style={{ fontSize: '0.68rem', fontWeight: 700, color: '#6b7280', background: 'rgba(255,255,255,0.06)', borderRadius: 4, padding: '2px 6px' }}>
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── B) HOT Stocks Brief ────────────────────────────────────────────────────────
function HotStocksCard({ stocks }: { stocks: HotStock[] }) {
  if (!stocks.length) {
    return <div style={{ color: '#6b7280', fontSize: '0.82rem', padding: '0.5rem 0' }}>HOT ZONE 데이터 없음 — run_all.py 실행 필요</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
      {stocks.map(s => (
        <div key={s.symbol} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'white', minWidth: 52 }}>{s.symbol}</span>
          <span style={{ fontSize: '0.8rem', color: '#9ca3af', minWidth: 60 }}>
            {s.price ? `$${s.price.toLocaleString()}` : ''}
          </span>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: chgColor(s.change_pct), minWidth: 52 }}>
            {fmtPct(s.change_pct)}
          </span>
          <AIBadge score={s.ai_score} />
          <span style={{ fontSize: '0.78rem', color: '#9ca3af', flex: 1, minWidth: 120 }}>{s.comment}</span>
          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
            {s.tags.map(t => (
              <span key={t} style={{ fontSize: '0.62rem', fontWeight: 700, color: t === 'HOT' ? '#ef4444' : t === 'AI' ? '#00D9FF' : t === 'VOLUME_SPIKE' ? '#f59e0b' : '#6b7280', background: 'rgba(255,255,255,0.05)', borderRadius: 3, padding: '1px 5px' }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── C) Sector Brief ────────────────────────────────────────────────────────────
function SectorBriefCard({ sb }: { sb: SectorBrief }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: sb.phase_color, background: `${sb.phase_color}22`, borderRadius: 6, padding: '3px 10px', border: `1px solid ${sb.phase_color}40` }}>
          {sb.phase_label || sb.phase}
        </span>
        <span style={{ fontSize: '0.8rem', color: '#d1d5db' }}>{sb.interp}</span>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        {sb.leaders.length > 0 && (
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#22c55e', marginBottom: '0.35rem', textTransform: 'uppercase' }}>리더 Top 3</div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {sb.leaders.map(l => (
                <div key={l.symbol} style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '0.4rem 0.7rem', minWidth: 100 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#22c55e' }}>{l.symbol}</div>
                  <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{l.name}</div>
                  <div style={{ fontSize: '0.72rem', color: chgColor(l.change_1d) }}>1D {fmtPct(l.change_1d)}</div>
                  <div style={{ fontSize: '0.7rem', color: chgColor(l.change_3m) }}>3M {fmtPct(l.change_3m)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {sb.laggers.length > 0 && (
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#ef4444', marginBottom: '0.35rem', textTransform: 'uppercase' }}>약세 Bottom 3</div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {sb.laggers.map(l => (
                <div key={l.symbol} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '0.4rem 0.7rem', minWidth: 100 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ef4444' }}>{l.symbol}</div>
                  <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{l.name}</div>
                  <div style={{ fontSize: '0.72rem', color: chgColor(l.change_1d) }}>1D {fmtPct(l.change_1d)}</div>
                  <div style={{ fontSize: '0.7rem', color: chgColor(l.change_3m) }}>3M {fmtPct(l.change_3m)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        {sb.lines.slice(1).map((line, i) => (
          <div key={i} style={{ fontSize: '0.8rem', color: '#9ca3af', paddingLeft: '0.5rem', borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
            {line}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── D) Risk Brief ──────────────────────────────────────────────────────────────
function RiskBriefCard({ rb }: { rb: RiskBrief }) {
  const color = riskColor(rb.risk_level)
  const hiddenCount = rb.alerts_hidden_count ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Risk level */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 800, color, background: `${color}22`, borderRadius: 6, padding: '3px 10px', border: `1px solid ${color}40` }}>
          리스크 {rb.risk_label}
        </span>
        {rb.gate_score != null && (
          <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Gate {rb.gate_score}/100</span>
        )}
      </div>

      {/* Lines */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {rb.lines.map((line, i) => (
          <div key={i} style={{ fontSize: '0.82rem', color: '#d1d5db', paddingLeft: '0.5rem', borderLeft: `2px solid ${color}50` }}>
            {line}
          </div>
        ))}
      </div>

      {/* Alerts — max 3 visible (v1.1) */}
      {rb.alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginTop: '0.25rem' }}>최근 알림</div>
          {rb.alerts.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.45rem 0.7rem', background: 'rgba(255,255,255,0.03)', borderRadius: 7 }}>
              <AlertTypeBadge type={a.type} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'white', minWidth: 44 }}>{a.symbol}</span>
              <span style={{ fontSize: '0.75rem', color: '#9ca3af', flex: 1 }}>{a.message}</span>
            </div>
          ))}
          {/* Hidden count indicator (v1.1) */}
          {hiddenCount > 0 && (
            <div style={{ fontSize: '0.7rem', color: '#4b5563', textAlign: 'right', paddingRight: '0.25rem' }}>
              + 숨김 {hiddenCount}개 (우선순위 초과)
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function DailyReport() {
  const [data, setData] = useState<DailyReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API}/api/daily-report`)
      .then(r => r.json())
      .then(d => {
        if (d.error && !d.generated_at) {
          setError(d.error)
        } else {
          setData(d)
        }
      })
      .catch(() => setError('서버에 연결할 수 없습니다'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
        리포트 로딩 중...
      </div>
    )
  }

  // Graceful fallback
  if (!data) {
    return (
      <div style={{ padding: '2rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'white' }}>
            AI Daily <span style={{ color: '#f59e0b' }}>Report</span>
          </h1>
          <p style={{ color: '#6b7280', marginTop: '0.4rem', fontSize: '0.85rem' }}>
            {error || '리포트 데이터 없음'}
          </p>
        </div>
        <div style={{ background: '#1c1c1e', borderRadius: 12, padding: '1.5rem', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b', fontSize: '0.85rem' }}>
          ⚠ daily_report.json이 아직 생성되지 않았습니다.<br />
          <code style={{ color: '#9ca3af', fontSize: '0.8rem' }}>python backend/scripts/build_daily_report.py</code> 또는<br />
          <code style={{ color: '#9ca3af', fontSize: '0.8rem' }}>python backend/run_all.py</code> 를 실행하세요.
        </div>
      </div>
    )
  }

  const ms = data.market_summary
  const cov = data.data_coverage

  return (
    <div style={{ padding: '1.5rem 1.75rem 2.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'white', margin: 0 }}>
            AI Daily <span style={{ color: '#f59e0b' }}>Report</span>
          </h1>
          <p style={{ color: '#6b7280', marginTop: '0.3rem', fontSize: '0.8rem' }}>
            룰 기반 시장 요약 · {data.generated_at ? new Date(data.generated_at).toLocaleString('ko-KR') : ''}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CoverageBadge cov={cov} />
          {/* Tone pill */}
          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: toneColor(ms.overall_tone), background: toneGlow(ms.overall_tone), border: `1px solid ${toneColor(ms.overall_tone)}40`, borderRadius: 8, padding: '4px 12px' }}>
            {ms.overall_tone_label}
          </span>
        </div>
      </div>

      {/* ── A) Market Summary ── */}
      <NarrativeSummaryCard narratives={data.narratives} />
      <MarketSummaryCard ms={ms} />

      {/* ── B + C layout (2-col on wide screen) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
        {/* B) HOT Stocks */}
        <Section title="🔥 HOT 주목 종목" accent="#f59e0b">
          <HotStocksCard stocks={data.hot_stocks_brief} />
        </Section>

        {/* C) Sector Brief */}
        <Section title="🔄 섹터 브리프" accent="#00D9FF">
          <SectorBriefCard sb={data.sector_brief} />
        </Section>
      </div>

      {/* ── D) Risk Brief ── */}
      <Section title="⚠ 리스크 & 알림" accent={riskColor(data.risk_brief.risk_level)}>
        <RiskBriefCard rb={data.risk_brief} />
      </Section>

      {/* ── Missing Inputs Warning ── */}
      {cov.missing_inputs && cov.missing_inputs.length > 0 && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, padding: '0.9rem 1.1rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b', marginBottom: '0.5rem' }}>
            ⚠ 누락된 입력 파일 ({cov.missing_inputs.length}개)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {cov.missing_details?.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <code style={{ fontSize: '0.72rem', color: '#fbbf24', background: 'rgba(0,0,0,0.3)', borderRadius: 4, padding: '1px 6px' }}>{d.file}</code>
                <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>→ {d.affects} 섹션 영향</span>
                <code style={{ fontSize: '0.68rem', color: '#6b7280' }}>{d.fix}</code>
              </div>
            ))}
          </div>
          {cov.rerun_hint && (
            <div style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: '#9ca3af' }}>
              재실행: <code style={{ color: '#fbbf24', background: 'rgba(0,0,0,0.3)', borderRadius: 4, padding: '1px 6px' }}>{cov.rerun_hint}</code>
            </div>
          )}
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{ fontSize: '0.72rem', color: '#374151', textAlign: 'right' }}>
        데이터 커버리지: {cov.available}/{cov.total} ({cov.pct}%) · 룰 기반 자동 생성 · LLM 미사용
      </div>
    </div>
  )
}
