import type { ReactNode, CSSProperties } from 'react'

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

function toneFromSavedPct(value: number | null | undefined): Tone {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'neutral'
  if (value >= 60) return 'good'
  if (value >= 35) return 'info'
  if (value >= 15) return 'watch'
  return 'warn'
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
    <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, border: `1px solid ${styles.border}`, background: styles.bg, color: styles.fg, padding: '0.34rem 0.72rem', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

function Section({ eyebrow, title, description, children }: { eyebrow: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section style={{ borderRadius: 22, border: '1px solid rgba(148, 163, 184, 0.14)', background: 'linear-gradient(180deg, rgba(10, 14, 24, 0.98), rgba(7, 11, 18, 0.98))', boxShadow: '0 24px 70px rgba(0, 0, 0, 0.24), 0 0 0 1px rgba(56, 189, 248, 0.04) inset', padding: '1.1rem 1.1rem 1.15rem', display: 'grid', gap: 12 }}>
      <div>
        <div style={{ fontSize: '0.68rem', color: '#7dd3fc', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }}>{eyebrow}</div>
        <h3 style={{ margin: '0.35rem 0 0', fontSize: '1.08rem', color: '#f8fafc', fontWeight: 900 }}>{title}</h3>
        {description ? <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem', lineHeight: 1.72, color: '#94a3b8' }}>{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

function buildTakeaway(savedPct: number | null | undefined): string {
  if (typeof savedPct !== 'number' || !Number.isFinite(savedPct)) {
    return 'This episode shows why SOXL needs a regime rule instead of a buy-and-hold instinct.'
  }
  if (savedPct >= 60) return 'Leverage damage was severe enough that stepping aside early preserved most of the capital.'
  if (savedPct >= 35) return 'Defense helped, but the window still demanded cautious sizing and fast reactions.'
  if (savedPct >= 15) return 'This was a wait-and-protect window, not a place for blind averaging down.'
  return 'The archive warns that leverage can collapse faster than the underlying cycle repairs.'
}

export default function SoxlArchivePanel({ archive }: { archive: any }) {
  if (!archive?.events?.length) {
    return (
      <section style={{ borderRadius: 22, border: '1px dashed rgba(148,163,184,0.24)', background: 'rgba(15, 23, 42, 0.76)', padding: '1.1rem', color: '#cbd5e1', lineHeight: 1.7 }}>
        <div style={{ fontSize: '0.72rem', color: '#7dd3fc', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }}>SOXX archive</div>
        <h2 style={{ margin: '0.45rem 0 0', fontSize: '1.35rem', color: '#f8fafc', fontWeight: 900 }}>Playback archive is not available yet</h2>
        <p style={{ margin: '0.6rem 0 0', maxWidth: 820 }}>
          Run <code style={{ background: 'rgba(15,23,42,0.9)', padding: '0.18rem 0.42rem', borderRadius: 6 }}>python marketflow/backend/scripts/build_soxx_survival_playback.py</code>
          {' '}to rebuild the SOXX survival archive, then refresh this page.
        </p>
      </section>
    )
  }

  const events = [...archive.events].sort((a: any, b: any) => (b.stats?.capital_saved_pct ?? -1) - (a.stats?.capital_saved_pct ?? -1))
  const savedValues = events.map((event: any) => event.stats?.capital_saved_pct).filter((value: any): value is number => typeof value === 'number' && Number.isFinite(value))
  const bestSaved = savedValues.length ? Math.max(...savedValues) : null
  const avgSaved = savedValues.length ? savedValues.reduce((sum: number, value: number) => sum + value, 0) / savedValues.length : null
  const coverageStart = events[0]?.start ?? null
  const coverageEnd = events[events.length - 1]?.end ?? null

  return (
    <section style={{ display: 'grid', gap: 14 }}>
      <div style={{ borderRadius: 24, border: '1px solid rgba(56, 189, 248, 0.14)', background: 'linear-gradient(135deg, rgba(7, 12, 22, 0.98), rgba(8, 16, 30, 0.96))', boxShadow: '0 28px 90px rgba(0, 0, 0, 0.24)', padding: '1.15rem 1.15rem 1.2rem', display: 'grid', gap: 14 }}>
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', alignItems: 'stretch' }}>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ fontSize: '0.68rem', color: '#7dd3fc', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }}>Historical evidence</div>
            <h2 style={{ margin: 0, fontSize: '1.95rem', lineHeight: 1.1, color: '#f8fafc', fontWeight: 950 }}>SOXX shock archive</h2>
            <p style={{ margin: 0, maxWidth: 860, fontSize: '0.95rem', lineHeight: 1.78, color: '#cbd5e1' }}>
              This archive is not a prediction engine. It is a reference for how leverage behaved when the semiconductor regime broke, paused, or re-accelerated.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Badge label={`Run ${archive.run_id ?? 'unknown'}`} tone="neutral" />
              <Badge label={`${events.length} events`} tone="info" />
              <Badge label={`${coverageStart ?? '--'} → ${coverageEnd ?? '--'}`} tone="neutral" />
            </div>
          </div>

          <div style={{ borderRadius: 20, border: `1px solid ${toneStyles(toneFromSavedPct(bestSaved)).border}`, background: toneStyles(toneFromSavedPct(bestSaved)).bg, padding: '1rem', display: 'grid', gap: 12, alignSelf: 'start' }}>
            <div style={{ display: 'grid', gap: 4 }}>
              <div style={{ fontSize: '0.68rem', color: toneStyles(toneFromSavedPct(bestSaved)).accent, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 800 }}>Archive scoreboard</div>
              <div style={{ fontSize: '2.2rem', lineHeight: 1, fontWeight: 950, color: toneStyles(toneFromSavedPct(bestSaved)).fg }}>
                {formatPct(bestSaved, 1)}
                <span style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: 700 }}> best saved</span>
              </div>
            </div>
            <div style={{ fontSize: '0.9rem', lineHeight: 1.72, color: '#cbd5e1' }}>
              Average capital saved across the archive: {formatPct(avgSaved, 1)}.
              {' '}The archive matters because SOXL is supposed to be judged by capital preservation under stress, not by a smooth-looking chart.
            </div>
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
              <div style={miniStyle}>
                <div style={miniLabelStyle}>Coverage</div>
                <div style={miniValueStyle}>{coverageStart ?? '--'} → {coverageEnd ?? '--'}</div>
              </div>
              <div style={miniStyle}>
                <div style={miniLabelStyle}>Average saved</div>
                <div style={miniValueStyle}>{formatPct(avgSaved, 1)}</div>
              </div>
              <div style={miniStyle}>
                <div style={miniLabelStyle}>Best saved</div>
                <div style={miniValueStyle}>{formatPct(bestSaved, 1)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Section eyebrow="Windows" title="Historical SOXX shock windows" description="Sorted by capital preservation so the most informative windows are closest to the top.">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr>
                <th style={thStyle}>Window</th>
                <th style={thStyle}>Period</th>
                <th style={thStyle}>Saved</th>
                <th style={thStyle}>Risk on/off</th>
                <th style={thStyle}>Stress tags</th>
                <th style={thStyle}>Takeaway</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event: any) => {
                const savedTone = toneFromSavedPct(event.stats?.capital_saved_pct)
                return (
                  <tr key={event.id} style={{ borderTop: '1px solid rgba(148,163,184,0.10)' }}>
                    <td style={tdStyle}>
                      <div style={{ display: 'grid', gap: 4 }}>
                        <div style={{ color: '#f8fafc', fontWeight: 900, lineHeight: 1.45 }}>{event.name}</div>
                        <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>#{event.id}</div>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ color: '#e2e8f0', fontWeight: 800 }}>{event.start ?? '--'}</div>
                      <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>{event.end ?? '--'}</div>
                    </td>
                    <td style={tdStyle}>
                      <Badge label={formatPct(event.stats?.capital_saved_pct, 1)} tone={savedTone} />
                      <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 6 }}>SOXX {formatNumber(event.stats?.soxx_trough, 1)} · SOXL {formatNumber(event.stats?.soxl_trough, 1)}</div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        <Badge label={`ON ${event.risk_on ?? '--'}`} tone="watch" />
                        <Badge label={`OFF ${event.risk_off ?? '--'}`} tone="good" />
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        <Badge label={`Shock ${event.shock_dates?.length ?? 0}`} tone="danger" />
                        <Badge label={`Structure ${event.struct_dates?.length ?? 0}`} tone="warn" />
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ color: '#cbd5e1', lineHeight: 1.7 }}>{buildTakeaway(event.stats?.capital_saved_pct)}</div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section eyebrow="Rules" title="What this archive teaches" description="The archive is useful only if it changes how you size and time SOXL.">
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={ruleStyle}>SOXL should be treated as a tactical instrument that depends on regime confirmation, not as a generic long-term hold.</div>
          <div style={ruleStyle}>The relevant damage control question is how quickly SOXX loses structure, not how smooth the underlying trend looks in isolation.</div>
          <div style={ruleStyle}>When AI CAPEX clusters, leverage works only if relative strength and macro conditions stay aligned at the same time.</div>
        </div>
      </Section>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <a
          href="/api/data/soxx_survival_playback.json"
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: '0.78rem', color: '#7dd3fc', textDecoration: 'none', borderBottom: '1px solid rgba(125, 211, 252, 0.35)', paddingBottom: 2 }}
        >
          Open raw SOXX cycle playback JSON
        </a>
      </div>
    </section>
  )
}

const thStyle: CSSProperties = {
  textAlign: 'left',
  fontSize: '0.68rem',
  color: '#94a3b8',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  fontWeight: 800,
  padding: '0 0.6rem 0.9rem 0',
}

const tdStyle: CSSProperties = {
  verticalAlign: 'top',
  padding: '0.95rem 0.6rem 0.95rem 0',
  fontSize: '0.88rem',
}

const ruleStyle: CSSProperties = {
  borderRadius: 16,
  border: '1px solid rgba(148,163,184,0.12)',
  background: 'rgba(15,23,42,0.78)',
  padding: '0.9rem 0.95rem',
  color: '#dbeafe',
  lineHeight: 1.75,
}

const miniStyle: CSSProperties = {
  borderRadius: 16,
  border: '1px solid rgba(148,163,184,0.12)',
  background: 'rgba(15,23,42,0.82)',
  padding: '0.85rem 0.9rem',
  display: 'grid',
  gap: 4,
}

const miniLabelStyle: CSSProperties = {
  fontSize: '0.68rem',
  color: '#7dd3fc',
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  fontWeight: 800,
}

const miniValueStyle: CSSProperties = {
  fontSize: '1rem',
  fontWeight: 900,
  color: '#f8fafc',
}
