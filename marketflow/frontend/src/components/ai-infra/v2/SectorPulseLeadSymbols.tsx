// AI 인프라 V2 — Sector Pulse Card Section D: 대장 종목 리스트 (3-5개, 클릭 → MiniCard)

import type { LeadSymbolsForBucket } from '@/lib/ai-infra/v2/resolveLeadSymbolsForBucket'
import type { SymbolReturnsMap } from '@/lib/ai-infra/v2/symbolPriceFetcher'
import { getSymbolReturn, fmtReturn, returnColor } from '@/lib/ai-infra/v2/symbolPriceFetcher'
import { buildMoversMarker } from '@/lib/ai-infra/v2/buildMoversMarker'

const V = {
  text: '#E8F0F8', text2: '#B8C8DC', text3: '#8b9098',
  border: 'rgba(255,255,255,0.10)',
  ui: "'IBM Plex Sans', sans-serif", mono: "'IBM Plex Mono', monospace",
} as const

// Earnings 확인도 마커 (텍스트 기호로 통일, 이모지 다양성 회피)
const CONF_MARK: Record<string, { mark: string; color: string; label: string }> = {
  CONFIRMED:     { mark: '●', color: '#22c55e', label: '확인' },
  PARTIAL:       { mark: '◐', color: '#5DCFB0', label: '부분' },
  WATCH:         { mark: '◯', color: '#fbbf24', label: '관찰' },
  NOT_CONFIRMED: { mark: '✕', color: '#f97316', label: '미확인' },
  DATA_LIMITED:  { mark: '—', color: '#8b9098', label: '제한' },
  UNKNOWN:       { mark: '—', color: '#8b9098', label: '정보 없음' },
}

interface Props {
  data:          LeadSymbolsForBucket
  symbolReturns: SymbolReturnsMap
  onSymbolClick: (symbol: string) => void
}

export function SectorPulseLeadSymbols({ data, symbolReturns, onSymbolClick }: Props) {
  return (
    <div style={{
      padding: 12, border: `1px solid ${V.border}`, borderRadius: 4,
      background: 'rgba(255,255,255,0.02)',
    }}>
      <div style={{
        fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.10em',
        marginBottom: 8,
      }}>
        LEAD SYMBOLS
      </div>

      {data.symbols.length === 0 ? (
        <div style={{ fontFamily: V.ui, fontSize: 12, color: V.text3 }}>
          관련 종목 매핑 준비 중.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {data.symbols.map((sym, idx) => {
            const ret      = getSymbolReturn(sym.symbol, symbolReturns)
            const marker   = buildMoversMarker(ret.five_day)
            const retCol   = returnColor(ret.five_day)
            const conf     = CONF_MARK[sym.confirmation_level ?? 'UNKNOWN'] ?? CONF_MARK['UNKNOWN']
            const tickerCol = sym.is_story_heavy ? '#fbbf24' : sym.is_indirect ? V.text3 : V.text

            return (
              <button
                key={sym.symbol}
                onClick={() => onSymbolClick(sym.symbol)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '8px 10px', borderRadius: 3,
                  background: 'transparent',
                  border: 'none',
                  borderBottom: idx < data.symbols.length - 1 ? `1px solid ${V.border}` : 'none',
                  cursor: 'pointer',
                  textAlign: 'left', width: '100%',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
              >
                {/* Ticker + name */}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontFamily: V.mono, fontSize: 14, fontWeight: 700, color: tickerCol,
                    letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {sym.symbol}
                    {sym.is_story_heavy && (
                      <span style={{
                        fontFamily: V.mono, fontSize: 10, color: '#fbbf24',
                        border: '1px solid rgba(251,191,36,0.35)', borderRadius: 2,
                        padding: '0 4px', letterSpacing: '0.04em',
                      }}>STORY</span>
                    )}
                    {sym.is_indirect && (
                      <span style={{
                        fontFamily: V.mono, fontSize: 10, color: V.text3,
                        border: '1px solid rgba(139,144,152,0.35)', borderRadius: 2,
                        padding: '0 4px', letterSpacing: '0.04em',
                      }}>INDIRECT</span>
                    )}
                  </div>
                  <div style={{
                    fontFamily: V.ui, fontSize: 12, color: V.text3,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {sym.company_name}
                  </div>
                </div>

                {/* Return */}
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, minWidth: 76, justifyContent: 'flex-end' }}>
                  <span style={{
                    fontFamily: V.mono, fontSize: 13, fontWeight: 700, color: retCol,
                  }}>
                    {fmtReturn(ret.five_day)}
                  </span>
                  {marker.marker_type === 'fire' && <span style={{ fontSize: 11 }}>🔥</span>}
                </div>

                {/* Earnings marker */}
                <div style={{
                  flexShrink: 0, minWidth: 56, textAlign: 'right',
                  fontFamily: V.mono, fontSize: 12,
                }}>
                  <span style={{ color: conf.color, marginRight: 4 }}>{conf.mark}</span>
                  <span style={{ color: V.text3, fontSize: 11 }}>{conf.label}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {data.not_listed_note && (
        <div style={{
          marginTop: 8, paddingTop: 8,
          borderTop: `1px solid ${V.border}`,
          fontFamily: V.ui, fontSize: 11, color: V.text3, fontStyle: 'italic',
        }}>
          ({data.not_listed_note})
        </div>
      )}
    </div>
  )
}
