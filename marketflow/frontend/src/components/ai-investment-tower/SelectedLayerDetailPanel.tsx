'use client'
// 선택된 AI Investment Tower 레이어 상세 패널 — 흐름·모멘텀·구성 종목 표시

const V = {
  text:   '#E8F0F8',
  text2:  '#B8C8DC',
  text3:  '#8b9098',
  teal:   '#3FB6A8',
  green:  '#22c55e',
  amber:  '#fbbf24',
  red:    '#ef4444',
  orange: '#f97316',
  bg2:    'rgba(255,255,255,0.03)',
  bg3:    'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.08)',
  ui:     "'IBM Plex Sans', sans-serif",
  mono:   "'IBM Plex Mono', monospace",
} as const

// ── Type ──────────────────────────────────────────────────────────────────────

export type SelectedLayerDetail = {
  layerId:        string
  label:          string
  koreanLabel:    string
  primaryEtf?:    string
  basketSymbols:  string[]
  statusLabel:    string
  momentum1w:     number | null
  momentum1m:     number | null
  momentum3m:     number | null
  trendLabel:     string
  breadthLabel:   string
  riskLabel:      string
  coveragePct:    number | null
  nextCheckpoint?: string
  narrative:      string
}

// ── Label maps ────────────────────────────────────────────────────────────────

const TREND_KR: Record<string, string> = {
  UPTREND:    '상승 추세',
  RECOVERING: '회복 중',
  SIDEWAYS:   '횡보',
  DOWNTREND:  '하락 추세',
  EXTENDED:   '과열 확장',
  UNKNOWN:    '—',
}

const BREADTH_KR: Record<string, string> = {
  BROAD:     '넓음',
  IMPROVING: '개선',
  NARROW:    '좁음',
  WEAK:      '약함',
  UNKNOWN:   '—',
}

const RISK_KR: Record<string, string> = {
  LOW:      '낮음',
  MODERATE: '주의',
  ELEVATED: '과열 주의',
  HIGH:     '높음',
  EXTREME:  '극단적',
  UNKNOWN:  '—',
}

const RISK_COLOR: Record<string, string> = {
  LOW:      V.green,
  MODERATE: V.teal,
  ELEVATED: V.amber,
  HIGH:     V.red,
  EXTREME:  '#c026d3',
  UNKNOWN:  V.text3,
}

const TREND_COLOR: Record<string, string> = {
  UPTREND:    V.green,
  RECOVERING: V.teal,
  SIDEWAYS:   V.text3,
  DOWNTREND:  V.red,
  EXTENDED:   V.orange,
  UNKNOWN:    V.text3,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPct(v: number | null): string {
  if (v === null) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
}

function pctColor(v: number | null): string {
  if (v === null) return V.text3
  return v >= 0 ? V.green : V.red
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontFamily:   V.mono,
      fontSize:     11,
      color,
      background:   `${color}18`,
      border:       `1px solid ${color}40`,
      borderRadius: 4,
      padding:      '1px 8px',
      whiteSpace:   'nowrap',
    }}>
      {label}
    </span>
  )
}

function MetricCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: 'center', flex: '1 1 0' }}>
      <div style={{ fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.10em', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontFamily: V.mono, fontSize: 16, color, fontWeight: 700 }}>
        {value}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function SelectedLayerDetailPanel({ detail }: { detail: SelectedLayerDetail | null }) {
  if (!detail) {
    return (
      <div style={{
        padding:    '14px 16px',
        background: V.bg2,
        border:     `1px solid ${V.border}`,
        borderRadius: 6,
        fontFamily: V.ui,
        fontSize:   12,
        color:      V.text3,
        marginBottom: 16,
      }}>
        레이어를 선택하면 상세 흐름을 볼 수 있습니다.
      </div>
    )
  }

  const riskColor  = RISK_COLOR[detail.riskLabel]  ?? V.text3
  const trendColor = TREND_COLOR[detail.trendLabel] ?? V.text3

  return (
    <div style={{
      background:   V.bg2,
      border:       `1px solid ${V.border}`,
      borderRadius: 6,
      marginBottom: 16,
      overflow:     'hidden',
    }}>
      {/* ── Header ── */}
      <div style={{
        padding:        '10px 16px 10px',
        borderBottom:   `1px solid ${V.border}`,
        display:        'flex',
        alignItems:     'center',
        flexWrap:       'wrap',
        gap:            8,
      }}>
        <span style={{ fontFamily: V.ui, fontSize: 14, color: V.text, fontWeight: 600, marginRight: 4 }}>
          {detail.koreanLabel}
        </span>
        <span style={{ fontFamily: V.mono, fontSize: 10, color: V.text3 }}>
          {detail.label}
        </span>
        <div style={{ flex: 1 }} />
        <Badge label={detail.statusLabel} color={V.teal} />
        <Badge label={RISK_KR[detail.riskLabel] ?? detail.riskLabel} color={riskColor} />
        {detail.primaryEtf && (
          <span style={{ fontFamily: V.mono, fontSize: 11, color: V.text3 }}>
            ETF: {detail.primaryEtf}
          </span>
        )}
      </div>

      {/* ── Momentum metrics ── */}
      <div style={{
        display:        'flex',
        gap:            1,
        borderBottom:   `1px solid ${V.border}`,
        background:     V.bg3,
      }}>
        <MetricCell label="1W" value={fmtPct(detail.momentum1w)} color={pctColor(detail.momentum1w)} />
        <div style={{ width: 1, background: V.border }} />
        <MetricCell label="1M" value={fmtPct(detail.momentum1m)} color={pctColor(detail.momentum1m)} />
        <div style={{ width: 1, background: V.border }} />
        <MetricCell label="3M" value={fmtPct(detail.momentum3m)} color={pctColor(detail.momentum3m)} />
        <div style={{ width: 1, background: V.border }} />
        {/* Trend + Breadth */}
        <div style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '8px 12px' }}>
          <div>
            <div style={{ fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.10em', marginBottom: 3 }}>TREND</div>
            <span style={{ fontFamily: V.mono, fontSize: 12, color: trendColor }}>
              {TREND_KR[detail.trendLabel] ?? detail.trendLabel}
            </span>
          </div>
          <div style={{ width: 1, height: 28, background: V.border }} />
          <div>
            <div style={{ fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.10em', marginBottom: 3 }}>BREADTH</div>
            <span style={{ fontFamily: V.mono, fontSize: 12, color: V.text2 }}>
              {BREADTH_KR[detail.breadthLabel] ?? detail.breadthLabel}
            </span>
          </div>
          {detail.coveragePct !== null && detail.coveragePct < 1 && (
            <>
              <div style={{ width: 1, height: 28, background: V.border }} />
              <div>
                <div style={{ fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.10em', marginBottom: 3 }}>COVERAGE</div>
                <span style={{ fontFamily: V.mono, fontSize: 12, color: detail.coveragePct < 0.80 ? V.amber : V.text2 }}>
                  {Math.round(detail.coveragePct * 100)}%
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Ticker strip ── */}
      {detail.basketSymbols.length > 0 && (
        <div style={{
          padding:      '8px 16px',
          borderBottom: `1px solid ${V.border}`,
          display:      'flex',
          alignItems:   'center',
          flexWrap:     'wrap',
          gap:          6,
        }}>
          <span style={{ fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.10em', marginRight: 4 }}>
            구성 종목
          </span>
          {detail.basketSymbols.map(ticker => (
            <span key={ticker} style={{
              fontFamily:   V.mono,
              fontSize:     11,
              color:        V.text2,
              background:   V.bg3,
              border:       `1px solid ${V.border}`,
              borderRadius: 3,
              padding:      '1px 7px',
              whiteSpace:   'nowrap',
            }}>
              {ticker}
            </span>
          ))}
        </div>
      )}

      {/* ── Narrative ── */}
      <div style={{ padding: '10px 16px' }}>
        <div style={{ fontFamily: V.mono, fontSize: 10, color: V.text3, letterSpacing: '0.10em', marginBottom: 5 }}>
          현재 흐름
        </div>
        <p style={{ fontFamily: V.ui, fontSize: 12, color: V.text2, lineHeight: 1.75, margin: 0 }}>
          {detail.narrative}
        </p>
      </div>

      {/* ── Next checkpoint ── */}
      {detail.nextCheckpoint && (
        <div style={{
          padding:    '8px 16px 12px',
          borderTop:  `1px solid ${V.border}`,
          display:    'flex',
          gap:        8,
          alignItems: 'flex-start',
        }}>
          <span style={{ fontFamily: V.mono, fontSize: 10, color: V.teal, letterSpacing: '0.10em', whiteSpace: 'nowrap', paddingTop: 2 }}>
            NEXT CHECKPOINT
          </span>
          <span style={{ fontFamily: V.ui, fontSize: 12, color: V.text, lineHeight: 1.6 }}>
            {detail.nextCheckpoint}
          </span>
        </div>
      )}
    </div>
  )
}
