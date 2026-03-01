import BilLabel from '@/components/BilLabel'

type Chip = {
  ko: string
  en: string
  tone?: 'green' | 'amber' | 'red' | 'blue' | 'neutral'
}

type ExplainRow = {
  keyLabel: string
  value: string
}

interface NarrativeStripProps {
  briefKo: string[]
  briefEn: string[]
  actionKo: string
  actionEn: string
  chips: Chip[]
  explainRows: ExplainRow[]
}

function toneStyle(tone: Chip['tone']) {
  if (tone === 'green') return { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.24)', dot: '#22C55E' }
  if (tone === 'amber') return { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.24)', dot: '#F59E0B' }
  if (tone === 'red') return { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.24)', dot: '#EF4444' }
  if (tone === 'blue') return { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.24)', dot: '#3B82F6' }
  return { bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.18)', dot: '#94A3B8' }
}

export default function NarrativeStrip({ briefKo, briefEn, actionKo, actionEn, chips, explainRows }: NarrativeStripProps) {
  return (
    <section
      style={{
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))',
        padding: '0.9rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.7rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <BilLabel ko="오늘의 브리프" en="Today's Brief" variant="label" />
        <details style={{ position: 'relative' }}>
          <summary
            style={{
              listStyle: 'none',
              cursor: 'pointer',
              color: '#AFC2DA',
              fontSize: '0.86rem',
              fontWeight: 700,
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            <span className="mf-bil-ko">설명 보기</span>
            <span className="mf-bil-en" style={{ color: '#7E90A8' }}>Explain</span>
          </summary>
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 'calc(100% + 8px)',
              width: 'min(92vw, 420px)',
              zIndex: 20,
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.09)',
              background: '#0B0F14',
              boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
              padding: '0.8rem',
            }}
          >
            <div style={{ marginBottom: 10 }}>
              <BilLabel ko="근거 변수" en="Underlying Variables" variant="micro" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px 10px' }}>
              {explainRows.map((row) => (
                <div key={row.keyLabel} style={{ display: 'contents' }}>
                  <div style={{ color: '#8EA1BA', fontSize: '0.82rem' }}>{row.keyLabel}</div>
                  <div style={{ color: '#F8FAFC', fontSize: '0.86rem', fontWeight: 700, textAlign: 'right' }}>{row.value}</div>
                </div>
              ))}
            </div>
          </div>
        </details>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {briefKo.map((line, idx) => (
          <p key={`ko-${idx}`} className="mf-bil-ko" style={{ color: '#DCE7F6', fontSize: '0.96rem', lineHeight: 1.42 }}>
            {line}
          </p>
        ))}
        {briefEn.map((line, idx) => (
          <p key={`en-${idx}`} className="mf-bil-en" style={{ color: '#9FB0C6', fontSize: '0.90rem', lineHeight: 1.42 }}>
            {line}
          </p>
        ))}
      </div>

      <div
        style={{
          borderRadius: 10,
          border: '1px solid rgba(215,255,55,0.16)',
          background: 'rgba(215,255,55,0.04)',
          padding: '0.55rem 0.7rem',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <div className="mf-bil-ko" style={{ color: '#EAFD9F', fontWeight: 700, fontSize: '0.92rem' }}>{actionKo}</div>
        <div className="mf-bil-en" style={{ color: '#AFC2DA', fontWeight: 600, fontSize: '0.82rem' }}>{actionEn}</div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {chips.map((chip, i) => {
          const tone = toneStyle(chip.tone)
          return (
            <span
              key={`${chip.en}-${i}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                borderRadius: 999,
                border: `1px solid ${tone.border}`,
                background: tone.bg,
                padding: '5px 10px',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: 999, background: tone.dot }} />
              <BilLabel ko={chip.ko} en={chip.en} variant="micro" />
            </span>
          )
        })}
      </div>
    </section>
  )
}
