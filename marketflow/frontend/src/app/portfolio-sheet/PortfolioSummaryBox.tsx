import type { CSSProperties } from 'react'

import type { PortfolioAccountSummary } from '@/lib/portfolio-sheet/types'

type MetricTone = 'neutral' | 'positive' | 'negative' | 'primary'

type SummaryMetric = {
  label: string
  value: string
  tone: MetricTone
  emphasis?: boolean
}

type PortfolioSummaryBoxProps = {
  summary: PortfolioAccountSummary
  cashDraft: string
  cashDirty?: boolean
  cashSaving?: boolean
  usdKrwRate: string
  usdKrwRateSource?: string
  onCashDraftChange: (value: string) => void
  onSaveCash: () => void
  onUsdKrwRateChange: (value: string) => void
}

function toneColor(tone: MetricTone): string {
  if (tone === 'positive') return '#22c55e'
  if (tone === 'negative') return '#ef4444'
  if (tone === 'primary') return '#67e8f9'
  return '#e5e7eb'
}

function signedTone(value: number): MetricTone {
  if (value > 0) return 'positive'
  if (value < 0) return 'negative'
  return 'neutral'
}

function formatMoney(value: number): string {
  const abs = Math.abs(value)
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(abs)
  if (value < 0) return `-$${formatted}`
  return `$${formatted}`
}

function formatSignedMoney(value: number): string {
  if (value === 0) return '$0'
  return value > 0 ? `+${formatMoney(value)}` : formatMoney(value)
}

function formatKrw(value: number): string {
  if (!Number.isFinite(value)) return '-'
  const abs = Math.abs(value)
  const formatted = new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: 0,
  }).format(abs)
  if (value < 0) return `-₩${formatted}`
  return `₩${formatted}`
}

function formatSignedKrw(value: number): string {
  if (value === 0) return '₩0'
  return value > 0 ? `+${formatKrw(value)}` : formatKrw(value)
}

function formatPercent(value: number): string {
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(Math.abs(value) * 100)
  if (value < 0) return `-${formatted}%`
  return `${formatted}%`
}

function parseRate(value: string): number {
  const parsed = Number(String(value || '').replace(/,/g, ''))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function buildMetrics(summary: PortfolioAccountSummary): SummaryMetric[] {
  return [
    {
      label: '계좌총액',
      value: formatMoney(summary.accountTotal),
      tone: 'primary',
      emphasis: true,
    },
    {
      label: '달러총수익',
      value: formatSignedMoney(summary.dollarTotalPnl),
      tone: signedTone(summary.dollarTotalPnl),
      emphasis: true,
    },
    {
      label: '금일수익',
      value: formatSignedMoney(summary.todayPnl),
      tone: signedTone(summary.todayPnl),
    },
    {
      label: '매수액',
      value: formatMoney(summary.costBasis),
      tone: 'neutral',
    },
    {
      label: '평가액',
      value: formatMoney(summary.marketValue),
      tone: 'neutral',
    },
    {
      label: '총투자금',
      value: formatMoney(summary.totalInvested),
      tone: 'neutral',
    },
    {
      label: '수익률',
      value: formatPercent(summary.returnPct),
      tone: signedTone(summary.returnPct),
    },
  ]
}

function metricStyle(metric: SummaryMetric): CSSProperties {
  return {
    border: metric.emphasis ? '1px solid rgba(103,232,249,0.24)' : '1px solid rgba(255,255,255,0.07)',
    background: metric.emphasis ? 'rgba(8,47,73,0.22)' : 'rgba(255,255,255,0.025)',
    borderRadius: 7,
    padding: metric.emphasis ? '0.7rem 0.78rem' : '0.52rem 0.58rem',
    minWidth: 0,
    boxShadow: metric.emphasis ? 'inset 3px 0 0 rgba(103,232,249,0.72)' : 'none',
  }
}

function inputStyle(dirty?: boolean): CSSProperties {
  return {
    width: '100%',
    height: 28,
    border: dirty ? '1px solid rgba(251,191,36,0.64)' : '1px solid rgba(103,232,249,0.28)',
    background: 'rgba(2,6,23,0.48)',
    color: '#e5f7ff',
    borderRadius: 5,
    padding: '0 0.4rem',
    fontSize: '0.82rem',
    fontWeight: 900,
    textAlign: 'right',
    outline: 'none',
    fontVariantNumeric: 'tabular-nums',
  }
}

export function PortfolioSummaryBox({
  summary,
  cashDraft,
  cashDirty = false,
  cashSaving = false,
  usdKrwRate,
  usdKrwRateSource,
  onCashDraftChange,
  onSaveCash,
  onUsdKrwRateChange,
}: PortfolioSummaryBoxProps) {
  const metrics = buildMetrics(summary)
  const primaryMetrics = metrics.filter((metric) => metric.emphasis)
  const compactMetrics = metrics.filter((metric) => !metric.emphasis)
  const usdKrw = parseRate(usdKrwRate)
  const krwTotalPnl = summary.dollarTotalPnl * usdKrw

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 8 }}>
        {primaryMetrics.map((metric) => (
          <div key={metric.label} style={metricStyle(metric)}>
            <div style={{ color: '#9ca3af', fontSize: '0.68rem', fontWeight: 800, lineHeight: 1.25 }}>{metric.label}</div>
            <div
              style={{
                color: toneColor(metric.tone),
                fontSize: '1.34rem',
                fontWeight: 950,
                lineHeight: 1.1,
                marginTop: 6,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {metric.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 6 }}>
        {compactMetrics.map((metric) => (
          <div key={metric.label} style={metricStyle(metric)}>
            <div style={{ color: '#8b93a8', fontSize: '0.66rem', fontWeight: 800, lineHeight: 1.2 }}>{metric.label}</div>
            <div
              style={{
                color: toneColor(metric.tone),
                fontSize: '0.94rem',
                fontWeight: 900,
                lineHeight: 1.1,
                marginTop: 5,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {metric.value}
            </div>
          </div>
        ))}

        <div style={metricStyle({ label: '현금잔고', value: cashDraft, tone: 'neutral' })}>
          <div style={{ color: '#67e8f9', fontSize: '0.66rem', fontWeight: 900, lineHeight: 1.2 }}>현금잔고</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 5 }}>
            <input
              aria-label="현금잔고"
              type="number"
              min={0}
              step="any"
              value={cashDraft}
              onChange={(event) => onCashDraftChange(event.target.value)}
              style={inputStyle(cashDirty)}
            />
            <button
              type="button"
              onClick={onSaveCash}
              disabled={!cashDirty || cashSaving}
              style={{
                border: cashDirty ? '1px solid rgba(34,197,94,0.36)' : '1px solid rgba(255,255,255,0.10)',
                background: cashDirty ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)',
                color: cashDirty ? '#86efac' : '#8b93a8',
                borderRadius: 5,
                height: 28,
                padding: '0 0.44rem',
                fontSize: '0.66rem',
                fontWeight: 900,
                cursor: cashDirty && !cashSaving ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap',
              }}
            >
              {cashSaving ? '...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.3fr) minmax(150px, 0.7fr)',
          gap: 8,
          border: '1px solid rgba(34,197,94,0.18)',
          background: 'rgba(34,197,94,0.06)',
          borderRadius: 7,
          padding: '0.62rem 0.7rem',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ color: '#9ca3af', fontSize: '0.68rem', fontWeight: 900 }}>원화 총수익</div>
          <div
            style={{
              color: signedTone(krwTotalPnl) === 'positive' ? '#22c55e' : signedTone(krwTotalPnl) === 'negative' ? '#ef4444' : '#e5e7eb',
              fontSize: '1.16rem',
              fontWeight: 950,
              marginTop: 4,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {usdKrw > 0 ? formatSignedKrw(krwTotalPnl) : '-'}
          </div>
        </div>
        <div>
          <div style={{ color: '#8b93a8', fontSize: '0.64rem', fontWeight: 800, marginBottom: 4 }}>
            당일 기준원화{usdKrwRateSource ? ` | ${usdKrwRateSource}` : ''}
          </div>
          <input
            aria-label="당일 기준원화"
            type="number"
            min={0}
            step="any"
            value={usdKrwRate}
            onChange={(event) => onUsdKrwRateChange(event.target.value)}
            style={inputStyle(false)}
          />
        </div>
      </div>
    </div>
  )
}
