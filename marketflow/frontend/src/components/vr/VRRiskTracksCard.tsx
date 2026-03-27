import type { CSSProperties } from 'react'

type RiskSummarySnapshot = {
  score: number | null
  scoreName: string | null
  scoreZone: string | null
  level: number | null
  levelLabel: string | null
  eventType: string | null
  finalRisk: string | null
  finalExposure: number | null
  brief: string | null
  date: string | null
}

export type VRRiskTracksInput = {
  snapshot: RiskSummarySnapshot
}

type Tone = {
  accent: string
  border: string
  soft: string
  text: string
  glow: string
}

function toneForLevel(levelLabel: string): Tone {
  const upper = levelLabel.toUpperCase()
  if (upper === 'CRISIS') {
    return {
      accent: '#fb7185',
      border: 'rgba(251,113,133,0.34)',
      soft: 'rgba(251,113,133,0.10)',
      text: '#ffe4e6',
      glow: 'rgba(251,113,133,0.18)',
    }
  }
  if (upper === 'WARNING') {
    return {
      accent: '#f59e0b',
      border: 'rgba(245,158,11,0.32)',
      soft: 'rgba(245,158,11,0.10)',
      text: '#fef3c7',
      glow: 'rgba(245,158,11,0.16)',
    }
  }
  return {
    accent: '#22c55e',
    border: 'rgba(34,197,94,0.30)',
    soft: 'rgba(34,197,94,0.10)',
    text: '#dcfce7',
    glow: 'rgba(34,197,94,0.14)',
  }
}

function titleCase(value: string | null): string {
  if (!value) return 'n/a'
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b[a-z]/g, (match) => match.toUpperCase())
}

function Chip({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        borderRadius: 999,
        padding: '0.28rem 0.58rem',
        border: `1px solid ${tone.border}`,
        background: tone.soft,
        color: tone.text,
        fontSize: '0.76rem',
        fontWeight: 800,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: tone.accent, boxShadow: `0 0 0 4px ${tone.glow}` }} />
      {label}
    </span>
  )
}

function Metric({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
      <div style={{ fontSize: '0.7rem', color: accent, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 800 }}>
        {label}
      </div>
      <div style={{ fontSize: '1rem', color: '#f8fafc', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value}
      </div>
    </div>
  )
}

export default function VRRiskTracksCard({ snapshot }: VRRiskTracksInput) {
  const score = snapshot.score != null ? Math.round(snapshot.score) : null
  const levelLabel = snapshot.levelLabel ?? 'Unknown'
  const tone = toneForLevel(levelLabel)
  const scoreZone = snapshot.scoreZone ?? 'n/a'
  const finalRisk = titleCase(snapshot.finalRisk)
  const targetExposure = snapshot.finalExposure != null ? `${snapshot.finalExposure}%` : 'n/a'
  const updatedAt = snapshot.date ?? 'n/a'
  const summary = snapshot.brief?.trim() || 'Standard risk summary is not available.'

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, rgba(10,15,24,0.98), rgba(7,10,16,0.99))',
        border: `1px solid ${tone.border}`,
        borderRadius: 12,
        padding: '0.95rem 1.05rem',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minWidth: 0,
        boxShadow: `0 0 0 1px ${tone.soft} inset, 0 12px 30px rgba(0,0,0,0.16)`,
      }}
    >
      <div style={{ height: 4, borderRadius: 999, background: `linear-gradient(90deg, ${tone.accent}, rgba(255,255,255,0.06))` }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
          <div style={{ fontSize: '0.68rem', color: tone.accent, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 800 }}>
            Standard Risk Summary
          </div>
          <div style={{ fontSize: '1.06rem', fontWeight: 800, color: '#f8fafc' }}>
            {snapshot.scoreName ?? 'Market Structure Score (MSS)'}
          </div>
        </div>

        <Chip label={levelLabel} tone={tone} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: '1.7rem', fontWeight: 900, color: tone.accent, lineHeight: 1 }}>
          MSS {score ?? 'n/a'}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Chip label={scoreZone} tone={tone} />
          <Chip label={finalRisk} tone={tone} />
          <Chip label={`${targetExposure} target`} tone={tone} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        <Metric label="Level" value={levelLabel} accent={tone.accent} />
        <Metric label="Event" value={snapshot.eventType ?? 'n/a'} accent="#7dd3fc" />
        <Metric label="Updated" value={updatedAt} accent="#a78bfa" />
        <Metric label="Source" value="Standard" accent="#22c55e" />
      </div>

      <div
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${tone.border}`,
          borderRadius: 12,
          padding: '0.85rem 0.95rem',
        }}
      >
        <div style={{ fontSize: '0.68rem', color: tone.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 800 }}>
          Summary
        </div>
        <div style={{ fontSize: '0.92rem', color: '#e2e8f0', lineHeight: 1.65 }}>
          {summary}
        </div>
      </div>

      <div style={{ fontSize: '0.76rem', color: '#94a3b8', lineHeight: 1.45 }}>
        Standard는 현재 시장 위험의 라이브 소스입니다. VR은 이 컨텍스트를 바탕으로 대응 전략과 실행 시나리오를 해석합니다.
      </div>
    </div>
  )
}
