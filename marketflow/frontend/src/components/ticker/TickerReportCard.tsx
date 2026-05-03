import Link from 'next/link'
import BilLabel from '@/components/BilLabel'
import type { TickerReportModel } from '@/lib/tickerReport'
import { uiColor, uiSpace, uiType } from '@/lib/uiTokens'

function segmentedGauge(pct?: number | null, color?: string) {
  const clamped = typeof pct === 'number' ? Math.max(0, Math.min(100, pct)) : null
  const width = clamped != null ? Math.max(4, clamped) : 0
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 2, height: 8 }}>
        {Array.from({ length: 10 }).map((_, i) => {
          const segPct = (i + 1) * 10
          const active = clamped != null && clamped >= segPct - 5
          return (
            <div
              key={i}
              style={{
                borderRadius: 999,
                background: active ? (color || 'var(--state-neutral)') : 'rgba(255,255,255,0.07)',
                opacity: active ? 0.95 : 1,
              }}
            />
          )
        })}
      </div>
      {clamped != null && (
        <div
          style={{
            position: 'absolute',
            left: `${Math.min(99, Math.max(1, width))}%`,
            top: -3,
            transform: 'translateX(-50%)',
            width: 2,
            height: 14,
            borderRadius: 2,
            background: '#e6edf3',
            boxShadow: '0 0 4px rgba(0,0,0,0.10)',
          }}
        />
      )}
    </div>
  )
}

function GaugeCard({ gauge }: { gauge: TickerReportModel['gauges'][number] }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: '0.8rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.45rem',
        minWidth: 0,
      }}
    >
      <div style={{ color: uiColor.textSecondary }}>
        <BilLabel ko={gauge.title.ko} en={gauge.title.en} variant="micro" />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ color: gauge.color || uiColor.textPrimary, fontSize: uiType.numberMd, fontWeight: 800, lineHeight: 1 }}>
          {gauge.valueText}
        </div>
        {gauge.levelText && (
          <div style={{ color: gauge.color || uiColor.textSecondary }}>
            <BilLabel ko={gauge.levelText.ko} en={gauge.levelText.en} variant="micro" />
          </div>
        )}
      </div>
      {segmentedGauge(gauge.pct, gauge.color)}
    </div>
  )
}

function ScenarioCard({ scenario, tone }: { scenario: NonNullable<TickerReportModel['bullCase']>; tone: string }) {
  if (!scenario || scenario.conditions.length === 0) return null
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${tone}28`,
        borderRadius: 12,
        padding: '0.85rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.55rem',
        minWidth: 0,
      }}
    >
      <div style={{ color: tone }}>
        <BilLabel ko={scenario.title.ko} en={scenario.title.en} variant="label" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        {scenario.conditions.slice(0, 3).map((c, idx) => (
          <div key={`${scenario.title.en}-${idx}`} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ width: 5, height: 5, borderRadius: 999, background: tone, marginTop: 5, flexShrink: 0 }} />
            <div style={{ color: uiColor.textSecondary }}>
              <BilLabel ko={c.ko} en={c.en} variant="micro" />
            </div>
          </div>
        ))}
      </div>
      {scenario.reactionRange && (
        <div style={{ color: uiColor.textPrimary, fontSize: uiType.base, fontWeight: 700 }}>
          <span style={{ color: uiColor.textSecondary, fontSize: uiType.label, marginRight: 6 }}>Range</span>
          {scenario.reactionRange}
        </div>
      )}
    </div>
  )
}

export default function TickerReportCard({
  report,
  symbolHref,
  compact = false,
}: {
  report: TickerReportModel
  symbolHref?: string
  compact?: boolean
}) {
  const hdr = report.header || { symbol: report.symbol, name: report.name || report.symbol, price: report.price ?? null, changePct: report.changePct ?? null }
  const eventD = report.event?.nextEarningsDday ?? report.eventD ?? null
  const changeColor = (hdr.changePct ?? 0) >= 0 ? 'var(--state-bull)' : 'var(--state-defensive)'

  return (
    <section
      style={{
        background: uiColor.panelBg,
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14,
        padding: compact ? '0.85rem' : '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: uiSpace.sectionGap,
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ color: uiColor.textPrimary, fontSize: compact ? '1.75rem' : uiType.numberLg, fontWeight: 800, lineHeight: 1 }}>
              {hdr.symbol}
            </div>
            {hdr.name && (
              <div style={{ color: uiColor.textSecondary, fontSize: uiType.base, fontWeight: 500 }}>
                {hdr.name}
              </div>
            )}
          </div>
          <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {typeof hdr.price === 'number' && (
              <span style={{ color: uiColor.textPrimary, fontSize: compact ? uiType.numberMd : uiType.numberLg, fontWeight: 800, lineHeight: 1 }}>
                {hdr.price.toFixed(2)}
              </span>
            )}
            {typeof hdr.changePct === 'number' && (
              <span style={{ color: changeColor, fontSize: compact ? '1rem' : '1.1rem', fontWeight: 800 }}>
                {hdr.changePct >= 0 ? '+' : ''}{hdr.changePct.toFixed(2)}%
              </span>
            )}
            {report.asOf && (
              <span style={{ color: uiColor.textMuted, fontSize: uiType.micro }}>{report.asOf}</span>
            )}
            {eventD != null && (
              <span
                style={{
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.09)',
                  background: 'rgba(255,255,255,0.04)',
                  padding: '2px 8px',
                  color: uiColor.textSecondary,
                }}
              >
                <BilLabel ko={`이벤트 D${eventD >= 0 ? `-${eventD}` : `+${Math.abs(eventD)}`}`} en={`Event D-${Math.max(0, eventD)}`} variant="micro" />
              </span>
            )}
          </div>
        </div>
        {symbolHref && (
          <Link
            href={symbolHref}
            style={{
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.03)',
              color: uiColor.textPrimary,
              textDecoration: 'none',
              borderRadius: 8,
              padding: '0.45rem 0.7rem',
              fontSize: uiType.label,
              minHeight: 40,
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <BilLabel ko="전체 페이지" en="Open full page" variant="micro" />
          </Link>
        )}
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {report.gauges.map((g) => (
          <GaugeCard key={g.key} gauge={g} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {report.bullCase ? <ScenarioCard scenario={report.bullCase} tone="var(--state-bull)" /> : null}
        {report.bearCase ? <ScenarioCard scenario={report.bearCase} tone="var(--state-defensive)" /> : null}
      </div>

      {report.actionLine && (
        <div
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10,
            padding: '0.75rem 0.8rem',
            color: uiColor.textSecondary,
          }}
        >
          <div style={{ color: uiColor.textPrimary, marginBottom: 4 }}>
            <BilLabel ko="액션 라인" en="Action Line" variant="micro" />
          </div>
          <BilLabel ko={report.actionLine.ko} en={report.actionLine.en} variant="micro" />
        </div>
      )}

      {Array.isArray(report.valuation) && report.valuation.length > 0 && (
        <div
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10,
            padding: '0.75rem 0.8rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.55rem',
          }}
        >
          <div style={{ color: uiColor.textPrimary }}>
            <BilLabel ko="밸류에이션 스냅샷" en="Valuation Snapshot" variant="label" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {report.valuation.map((v) => (
              <div key={v.label.en} style={{ background: 'rgba(255,255,255,0.015)', borderRadius: 8, padding: '0.5rem 0.55rem' }}>
                <div style={{ color: uiColor.textSecondary }}>
                  <BilLabel ko={v.label.ko} en={v.label.en} variant="micro" />
                </div>
                <div style={{ color: uiColor.textPrimary, fontSize: uiType.base, fontWeight: 700, marginTop: 3 }}>{v.value}</div>
              </div>
            ))}
          </div>
          <div style={{ color: uiColor.textMuted }}>
            <BilLabel ko="데이터 기반 요약(지연 가능)" en="Data-based summary (may be delayed)" variant="micro" />
          </div>
        </div>
      )}
    </section>
  )
}
