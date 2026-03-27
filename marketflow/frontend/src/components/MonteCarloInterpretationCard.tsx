import type { CSSProperties } from 'react'
import { pickLang, type UiLang } from '@/lib/uiLang'

type MonteCarloInterpretationCardProps = {
  summaryLine: string
  detailLines: string[]
  forwardNarrativeLine?: string
  interpretationState: string
  currentRegime: string
  agreementScore: number
  conflictScore: number
  trustScore: number
  subtext?: string
  uiLang: UiLang
}

function formatScore(value: number) {
  return Number.isFinite(value) ? Math.round(value).toString() : '--'
}

function badgeStyle(): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 9px',
    borderRadius: 999,
    border: '1px solid rgba(148, 163, 184, 0.26)',
    background: 'rgba(148, 163, 184, 0.08)',
    color: '#dbe4f0',
    fontSize: '0.74rem',
    fontWeight: 700,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
  }
}

function scoreCell(uiLang: UiLang, labelKo: string, labelEn: string, value: number) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: '0.55rem 0.7rem',
        borderRadius: 10,
        border: '1px solid rgba(148, 163, 184, 0.18)',
        background: 'rgba(15, 23, 42, 0.38)',
      }}
    >
      <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {pickLang(uiLang, labelKo, labelEn)}
      </span>
      <span style={{ fontSize: '1rem', color: '#e5e7eb', fontWeight: 800 }}>
        {formatScore(value)}
      </span>
    </div>
  )
}

export default function MonteCarloInterpretationCard({
  summaryLine,
  detailLines,
  forwardNarrativeLine,
  interpretationState,
  currentRegime,
  agreementScore,
  conflictScore,
  trustScore,
  subtext,
  uiLang,
}: MonteCarloInterpretationCardProps) {
  return (
    <div
      style={{
        background: 'linear-gradient(180deg, rgba(15,23,42,0.78) 0%, rgba(15,23,42,0.58) 100%)',
        border: '1px solid rgba(148, 163, 184, 0.18)',
        borderLeft: '4px solid rgba(148, 163, 184, 0.35)',
        borderRadius: 12,
        padding: '0.9rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {pickLang(uiLang, '해석 오버레이', 'Interpretive Overlay')}
        </span>
        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
          {pickLang(uiLang, '보조 서술 레이어', 'Secondary narrative layer')}
        </span>
      </div>

      <div style={{ fontSize: '1.02rem', fontWeight: 800, color: '#f8fafc', lineHeight: 1.4 }}>
        {summaryLine}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {detailLines.slice(0, 2).map((line) => (
          <div key={line} style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.5 }}>
            {line}
          </div>
        ))}

        {forwardNarrativeLine ? (
          <div style={{ fontSize: '0.79rem', color: '#b8c4d6', lineHeight: 1.5 }}>
            {forwardNarrativeLine}
          </div>
        ) : null}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span style={badgeStyle()}>{pickLang(uiLang, interpretationState.split('_').join(' '), interpretationState.split('_').join(' '))}</span>
        <span style={badgeStyle()}>{currentRegime}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 8 }}>
        {scoreCell(uiLang, '정렬', 'Agreement', agreementScore)}
        {scoreCell(uiLang, '충돌', 'Conflict', conflictScore)}
        {scoreCell(uiLang, '신뢰도', 'Trust', trustScore)}
      </div>

      {subtext ? (
        <div style={{ fontSize: '0.72rem', color: '#64748b', lineHeight: 1.45 }}>
          {subtext}
        </div>
      ) : null}
    </div>
  )
}
