import type { ReactNode } from 'react'

type Tone = 'neutral' | 'info' | 'good' | 'watch' | 'warn' | 'danger'

function toneStyles(tone: Tone) {
  switch (tone) {
    case 'info':
      return { border: 'rgba(56, 189, 248, 0.26)', bg: 'rgba(8, 22, 38, 0.94)', fg: '#e0f2fe', accent: '#7dd3fc' }
    case 'good':
      return { border: 'rgba(34, 197, 94, 0.26)', bg: 'rgba(9, 25, 18, 0.94)', fg: '#dcfce7', accent: '#86efac' }
    case 'watch':
      return { border: 'rgba(245, 158, 11, 0.28)', bg: 'rgba(34, 24, 8, 0.94)', fg: '#fef3c7', accent: '#fbbf24' }
    case 'warn':
      return { border: 'rgba(249, 115, 22, 0.28)', bg: 'rgba(40, 17, 6, 0.94)', fg: '#ffedd5', accent: '#fdba74' }
    case 'danger':
      return { border: 'rgba(244, 63, 94, 0.30)', bg: 'rgba(35, 8, 16, 0.94)', fg: '#ffe4e6', accent: '#fda4af' }
    default:
      return { border: 'rgba(148, 163, 184, 0.18)', bg: 'rgba(15, 23, 42, 0.88)', fg: '#e2e8f0', accent: '#94a3b8' }
  }
}

function toneFromState(state: string | null | undefined): Tone {
  const upper = String(state ?? '').toUpperCase()
  if (!upper) return 'neutral'
  if (['LEADING', 'GOOD', 'CORE', 'EXPANDING', 'RISK_ON', 'ABOVE'].includes(upper)) return 'good'
  if (['WATCH', 'CAUTION', 'MIXED', 'GRINDING'].includes(upper)) return 'watch'
  if (['DEFENSIVE', 'LAGGING', 'BELOW', 'CRISIS', 'SHOCK', 'BEAR'].includes(upper)) return 'danger'
  return 'neutral'
}

function toneFromStage(stage: string | null | undefined): Tone {
  const upper = String(stage ?? '').toUpperCase()
  if (upper === 'MONETIZATION') return 'good'
  if (upper === 'EXPECTATION') return 'watch'
  if (upper === 'OVERINVESTMENT') return 'warn'
  if (upper === 'CONTRACTION') return 'danger'
  return 'neutral'
}

function formatNumber(value: number | null | undefined, digits = 1): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '--'
}

function formatPct(value: number | null | undefined, digits = 1): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(digits)}%`
}

function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const styles = toneStyles(tone)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        border: `1px solid ${styles.border}`,
        background: styles.bg,
        color: styles.fg,
        padding: '0.34rem 0.72rem',
        fontSize: '0.72rem',
        fontWeight: 800,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

function Section({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section
      style={{
        borderRadius: 22,
        border: '1px solid rgba(148, 163, 184, 0.14)',
        background: 'linear-gradient(180deg, rgba(10, 14, 24, 0.98), rgba(7, 11, 18, 0.98))',
        boxShadow: '0 24px 70px rgba(0, 0, 0, 0.24), 0 0 0 1px rgba(56, 189, 248, 0.04) inset',
        padding: '1.1rem 1.1rem 1.15rem',
        display: 'grid',
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontSize: '0.68rem', color: '#7dd3fc', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }}>{eyebrow}</div>
        <h3 style={{ margin: '0.35rem 0 0', fontSize: '1.08rem', color: '#f8fafc', fontWeight: 900 }}>{title}</h3>
        {description ? <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem', lineHeight: 1.72, color: '#94a3b8' }}>{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

function Row({ label, value, detail, tone = 'neutral' }: { label: string; value: string; detail?: string; tone?: Tone }) {
  const styles = toneStyles(tone)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '170px minmax(0, 1fr)', gap: 14, padding: '0.9rem 0', borderTop: '1px solid rgba(148, 163, 184, 0.10)' }}>
      <div style={{ fontSize: '0.72rem', color: styles.accent, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 800 }}>{label}</div>
      <div style={{ display: 'grid', gap: 4 }}>
        <div style={{ fontSize: '1rem', fontWeight: 900, color: styles.fg, lineHeight: 1.35 }}>{value}</div>
        {detail ? <div style={{ fontSize: '0.84rem', lineHeight: 1.62, color: '#cbd5e1' }}>{detail}</div> : null}
      </div>
    </div>
  )
}

export default function SoxlResearchPanel({ context }: { context: any }) {
  if (!context?.current) {
    return (
      <section style={{ borderRadius: 22, border: '1px dashed rgba(148,163,184,0.24)', background: 'rgba(15, 23, 42, 0.76)', padding: '1.1rem', color: '#cbd5e1', lineHeight: 1.7 }}>
        <div style={{ fontSize: '0.72rem', color: '#7dd3fc', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }}>SOXL research lens</div>
        <h2 style={{ margin: '0.45rem 0 0', fontSize: '1.35rem', color: '#f8fafc', fontWeight: 900 }}>SOXX context is still missing</h2>
        <p style={{ margin: '0.6rem 0 0', maxWidth: 760 }}>
          Run <code style={{ background: 'rgba(15,23,42,0.9)', padding: '0.18rem 0.42rem', borderRadius: 6 }}>python marketflow/backend/scripts/build_soxx_context.py</code>
          {' '}to rebuild the SOXX context cache, then refresh this page.
        </p>
      </section>
    )
  }

  const c = context.current
  const ai = c.ai_cycle ?? {}
  const macro = c.macro ?? {}
  const earnings = c.earnings ?? {}
  const relative = c.relative_strength ?? {}
  const risk = c.risk ?? {}
  const soxx = c.soxx ?? {}
  const qqq = c.qqq ?? {}
  const peers = c.peers ?? {}
  const brief = c.brief ?? {}
  const stageTone = toneFromStage(ai.stage)
  const scoreTone = stageTone
  const macroTone = toneFromState(macro.state ?? macro.phase)
  const earningsTone = toneFromState(earnings.state)
  const leadTone = toneFromState(relative.lead_state)
  const guardTone = toneFromState(risk.soxl_guard_band)
  const sensitivityItems = brief.sensitivity?.items ?? [
    { label: 'Rates / volatility', state: macro.state ?? macro.phase ?? '--', detail: `Phase ${macro.phase ?? '--'} · VRI ${formatNumber(macro.vri, 1)} · MPS ${formatNumber(macro.mps, 1)}` },
    { label: 'AI capex density', state: earnings.state ?? '--', detail: earnings.summary ?? 'No earnings summary available.' },
    { label: 'QQQ relative strength', state: relative.lead_state ?? '--', detail: `SOXX vs QQQ 60D ${formatPct(relative.rs_60d_vs_qqq_pct, 1)} · 252D ${formatPct(relative.rs_252d_vs_qqq_pct, 1)}` },
    { label: 'SOXL stress', state: risk.soxl_guard_band ?? '--', detail: `Proxy DD ${formatPct(risk.soxl_proxy_dd_pct, 1)} · SOXX DD ${formatPct(risk.soxx_dd_pct, 1)}` },
  ]
  const structureItems = brief.structure?.items ?? [
    { label: 'NVIDIA', state: 'CORE', detail: `60D ${formatPct(peers.NVDA?.ret_60d_pct, 1)} · still the center of gravity.` },
    { label: 'TSMC / packaging', state: 'BOTTLENECK', detail: `60D ${formatPct(peers.TSM?.ret_60d_pct, 1)} · CoWoS, HBM, and power delivery matter.` },
    { label: 'Hyperscaler custom silicon', state: 'DIVERSIFYING', detail: 'Google, Microsoft, Meta, and AWS are broadening the demand map.' },
  ]
  const monitorItems = brief.action?.monitor ?? [
    `SOXX MA200 ${soxx.ma200_state ?? '--'}`,
    `Macro ${macro.phase ?? '--'}`,
    `Earnings ${earnings.state ?? '--'}`,
    `Lead ${relative.lead_state ?? '--'}`,
  ]
  const questions = brief.questions ?? [
    'Is AI demand still training-led or shifting to inference-led expansion?',
    'Are hyperscaler custom chips broadening the stack or capping NVIDIA concentration?',
    'Are rates and volatility still the dominant constraint on SOXL leverage?',
  ]

  return (
    <section style={{ display: 'grid', gap: 14 }}>
      <div style={{ borderRadius: 24, border: '1px solid rgba(56, 189, 248, 0.14)', background: 'linear-gradient(135deg, rgba(7, 12, 22, 0.98), rgba(8, 16, 30, 0.96))', boxShadow: '0 28px 90px rgba(0, 0, 0, 0.24)', padding: '1.15rem 1.15rem 1.2rem', display: 'grid', gap: 14 }}>
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', alignItems: 'stretch' }}>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ fontSize: '0.68rem', color: '#7dd3fc', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }}>Semiconductor / AI Regime</div>
            <h2 style={{ margin: 0, fontSize: '1.95rem', lineHeight: 1.1, color: '#f8fafc', fontWeight: 950 }}>{brief.headline ?? 'SOXL research lens'}</h2>
            <p style={{ margin: 0, maxWidth: 860, fontSize: '0.97rem', lineHeight: 1.82, color: '#cbd5e1' }}>{brief.summary ?? 'SOXL is best monitored as a semiconductor regime asset, not as a generic leverage hold.'}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Badge label={`Data ${context.data_as_of ?? '--'}`} tone="neutral" />
              <Badge label={`Generated ${context.generated_at ?? '--'}`} tone="neutral" />
              <Badge label={`${context.history_window ?? 252}D window`} tone="neutral" />
              <Badge label={context.schema_version ?? 'soxx_context_v3'} tone="neutral" />
            </div>
          </div>

          <div style={{ borderRadius: 20, border: `1px solid ${toneStyles(scoreTone).border}`, background: toneStyles(scoreTone).bg, padding: '1rem', display: 'grid', gap: 12, alignSelf: 'start' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={{ fontSize: '0.68rem', color: toneStyles(scoreTone).accent, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }}>Cycle read</div>
                <div style={{ fontSize: '2.2rem', lineHeight: 1, fontWeight: 950, color: toneStyles(scoreTone).fg }}>
                  {formatNumber(ai.score, 1)}
                  <span style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: 700 }}> / 100</span>
                </div>
              </div>
              <Badge label={ai.stage ?? 'UNKNOWN'} tone={stageTone} />
            </div>
            <div style={{ fontSize: '0.9rem', lineHeight: 1.75, color: '#cbd5e1' }}>{ai.explanation ?? 'No cycle explanation available yet.'}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Badge label={`Macro ${macro.phase ?? '--'}`} tone={macroTone} />
              <Badge label={`Earnings ${earnings.state ?? '--'}`} tone={earningsTone} />
              <Badge label={`Lead ${relative.lead_state ?? '--'}`} tone={leadTone} />
              <Badge label={`Guard ${risk.soxl_guard_band ?? '--'}`} tone={guardTone} />
            </div>
          </div>
        </div>
      </div>

      <Section eyebrow="Regime" title="What the current cycle says" description="SOXL only works when the regime, the macro layer, and the earnings/capex layer stay aligned.">
        <Row label="Cycle state" value={ai.stage ?? '--'} detail={ai.explanation ?? 'No cycle explanation available.'} tone={stageTone} />
        <Row label="Macro phase" value={macro.phase ?? '--'} detail={macro.summary ?? 'Macro overlay unavailable.'} tone={macroTone} />
        <Row label="Earnings window" value={earnings.state ?? '--'} detail={earnings.summary ?? 'Earnings overlay unavailable.'} tone={earningsTone} />
        <Row label="Leadership vs QQQ" value={relative.lead_state ?? '--'} detail={`SOXX vs QQQ 60D ${formatPct(relative.rs_60d_vs_qqq_pct, 1)} · 252D ${formatPct(relative.rs_252d_vs_qqq_pct, 1)}`} tone={leadTone} />
      </Section>

      <Section eyebrow="Sensitivity" title="What really moves SOXL" description="Rates, volatility, capex crowding, and relative leadership are the main swing factors.">
        {sensitivityItems.map((item: any) => (
          <Row key={item.label} label={item.label ?? 'Driver'} value={item.state ?? '--'} detail={item.detail ?? undefined} tone={toneFromState(item.state)} />
        ))}
      </Section>

      <Section eyebrow="Structure" title="Why the industry structure matters" description="The market is shifting from pure GPU demand to a more heterogeneous AI stack.">
        {structureItems.map((item: any) => (
          <Row key={item.label} label={item.label ?? 'Structure'} value={item.state ?? '--'} detail={item.detail ?? undefined} tone={toneFromState(item.state)} />
        ))}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
          <Badge label={`SOXX ${formatNumber(soxx.close, 1)}`} tone="neutral" />
          <Badge label={`QQQ ${formatNumber(qqq.close, 1)}`} tone="neutral" />
          <Badge label={`NVDA 60D ${formatPct(peers.NVDA?.ret_60d_pct, 1)}`} tone={toneFromState((peers.NVDA?.ret_60d_pct ?? 0) >= 0 ? 'LEADING' : 'LAGGING')} />
          <Badge label={`TSM 60D ${formatPct(peers.TSM?.ret_60d_pct, 1)}`} tone={toneFromState((peers.TSM?.ret_60d_pct ?? 0) >= 0 ? 'LEADING' : 'LAGGING')} />
        </div>
      </Section>

      <Section eyebrow="Action" title="What to monitor before acting" description="SOXL needs proof from structure and macro alignment before leverage becomes attractive.">
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontSize: '1.08rem', lineHeight: 1.7, color: '#f8fafc', fontWeight: 900 }}>{brief.action?.headline ?? 'Wait for proof before adding leverage.'}</div>
          <div style={{ fontSize: '0.94rem', lineHeight: 1.8, color: '#cbd5e1' }}>{brief.action?.detail ?? 'SOXL should be treated as a tactical instrument tied to regime confirmation, not a generic long-term hold.'}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {monitorItems.map((item: any) => (
              <Badge key={item} label={String(item)} tone="info" />
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 800 }}>Research questions</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {questions.map((question: any) => (
              <div key={question} style={{ borderRadius: 16, border: '1px solid rgba(148,163,184,0.12)', background: 'rgba(15,23,42,0.75)', padding: '0.85rem 0.95rem', color: '#dbeafe', lineHeight: 1.7 }}>
                {question}
              </div>
            ))}
          </div>
        </div>
      </Section>

      <div style={{ display: 'grid', gap: 8, fontSize: '0.82rem', lineHeight: 1.7, color: '#94a3b8' }}>
        {(c.signals ?? []).slice(0, 4).map((signal: string) => (
          <div key={signal}>• {signal}</div>
        ))}
      </div>
    </section>
  )
}
