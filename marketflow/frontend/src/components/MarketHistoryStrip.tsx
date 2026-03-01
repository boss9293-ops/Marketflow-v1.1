import BilLabel from '@/components/BilLabel'

export type MarketHistoryRow = {
  date?: string | null
  gate_score?: number | null
  market_phase?: string | null
  risk_level?: string | null
}

const C = {
  bull: '#00C853',
  transition: '#FFB300',
  defensive: '#FF7043',
  neutral: '#5E6A75',
} as const

function phaseColor(phase?: string | null) {
  if (phase === 'BULL') return C.bull
  if (phase === 'BEAR') return C.defensive
  if (phase === 'NEUTRAL') return C.transition
  return C.neutral
}

function riskColor(level?: string | null) {
  if (level === 'LOW') return C.bull
  if (level === 'MEDIUM') return C.transition
  if (level === 'HIGH') return C.defensive
  return C.neutral
}

function gateColor(score?: number | null): string {
  if (score == null) return C.neutral
  if (score > 60) return C.bull
  if (score > 40) return C.transition
  return C.defensive
}

function card(extra?: object) {
  return {
    background: 'var(--bg-panel)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14,
    padding: '0.75rem 0.8rem',
    ...extra,
  } as const
}

export default function MarketHistoryStrip({
  rows,
  title = { ko: '시장 이력 (5일)', en: 'MARKET HISTORY (5d)' },
  emptyText = 'No snapshot data',
}: {
  rows: MarketHistoryRow[]
  title?: { ko: string; en: string }
  emptyText?: string
}) {
  return (
    <section style={card()}>
      <div style={{ color: '#6b7280', marginBottom: 6 }}>
        <BilLabel ko={title.ko} en={title.en} variant="micro" />
      </div>

      {rows.length === 0 ? (
        <div style={{ color: '#374151', fontSize: '0.8rem' }}>{emptyText}</div>
      ) : (
        <>
          <div className="sm:hidden" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '5.4rem 1fr auto',
                gap: '0 0.4rem',
                paddingBottom: 4,
                marginBottom: 2,
                borderBottom: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <span style={{ color: '#4b5563', opacity: 0.9 }}><BilLabel ko="날짜" en="DATE" variant="micro" /></span>
              <span style={{ color: '#4b5563', opacity: 0.9 }}><BilLabel ko="국면" en="PHASE" variant="micro" /></span>
              <span style={{ color: '#4b5563', opacity: 0.9 }}><BilLabel ko="게이트/리스크" en="GATE/RISK" variant="micro" /></span>
            </div>
            {rows.map((x, idx) => (
              <div
                key={`${x.date || 'na'}-${idx}-m`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '5.4rem 1fr auto',
                  gap: '0 0.4rem',
                  padding: '5px 6px',
                  borderRadius: 7,
                  alignItems: 'center',
                  background: idx % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
                }}
              >
                <span style={{ color: '#9ca3af', fontSize: '0.68rem' }}>{x.date ?? '-'}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 999,
                        background: phaseColor(x.market_phase),
                        flexShrink: 0,
                        display: 'inline-block',
                      }}
                    />
                    <span style={{ color: phaseColor(x.market_phase), fontSize: '0.71rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {x.market_phase ?? '-'}
                    </span>
                  </div>
                  <span style={{ color: riskColor(x.risk_level), fontSize: '0.6rem', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {(x.risk_level ?? '-')} risk
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                  <span style={{ color: gateColor(x.gate_score), fontWeight: 700, fontSize: '0.7rem', textAlign: 'right', lineHeight: 1.05 }}>
                    {typeof x.gate_score === 'number' ? x.gate_score.toFixed(0) : '-'}
                  </span>
                  <span style={{ color: riskColor(x.risk_level), fontSize: '0.57rem', lineHeight: 1.05 }}>
                    {x.risk_level ?? '-'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden sm:flex" style={{ flexDirection: 'column', gap: 2 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '6.7rem 1fr auto',
                gap: '0 0.5rem',
                paddingBottom: 4,
                marginBottom: 2,
                borderBottom: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <span style={{ color: '#4b5563', opacity: 0.9 }}><BilLabel ko="날짜" en="DATE" variant="micro" /></span>
              <span style={{ color: '#4b5563', opacity: 0.9 }}><BilLabel ko="국면" en="PHASE" variant="micro" /></span>
              <span style={{ color: '#4b5563', opacity: 0.9 }}><BilLabel ko="게이트/리스크" en="GATE/RISK" variant="micro" /></span>
            </div>

            {rows.map((x, idx) => (
              <div
                key={`${x.date || 'na'}-${idx}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '6.7rem 1fr auto',
                  gap: '0 0.5rem',
                  padding: '4px 5px',
                  borderRadius: 5,
                  alignItems: 'center',
                  background: idx % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
                }}
              >
                <span style={{ color: '#9ca3af', fontSize: '0.7rem' }}>{x.date ?? '-'}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 999,
                      background: phaseColor(x.market_phase),
                      flexShrink: 0,
                      display: 'inline-block',
                    }}
                  />
                  <span style={{ color: phaseColor(x.market_phase), fontSize: '0.72rem', fontWeight: 600 }}>
                    {x.market_phase ?? '-'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                  <span style={{ color: gateColor(x.gate_score), fontWeight: 700, fontSize: '0.74rem' }}>
                    {typeof x.gate_score === 'number' ? x.gate_score.toFixed(0) : '-'}
                  </span>
                  <span style={{ color: riskColor(x.risk_level), fontSize: '0.68rem' }}>
                    {x.risk_level ?? '-'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
