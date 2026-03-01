import BilLabel from '@/components/BilLabel'
import { readCacheJson } from '@/lib/readCacheJson'

type HealthSnapshot = {
  data_date?: string | null
  trend?: { dist_pct?: number | null } | null
  risk?: { var95_1d?: number | null; vol_ratio?: number | null } | null
}

type ActionSnapshot = {
  data_date?: string | null
  exposure_guidance?: { action_label?: string | null; exposure_band?: string | null } | null
}

type OverviewCache = {
  market_phase?: string | null
  risk_level?: string | null
  risk_trend?: string | null
  gate_score?: number | null
}

type TapeCache = {
  items?: Array<{ symbol?: string | null; last?: number | null }> | null
}

const C = {
  bull: '#00C853',
  transition: '#FFB300',
  defensive: '#FF7043',
  neutral: '#5E6A75',
} as const

function chipColor(label?: string | null) {
  const v = (label || '').toUpperCase()
  if (v.includes('HIGH') || v.includes('STRESS') || v.includes('DEFENSIVE')) return C.defensive
  if (v.includes('LOW') || v.includes('STABLE') || v.includes('RISK-ON')) return C.bull
  if (v) return C.transition
  return C.neutral
}

export default async function ActionSummaryBar() {
  const [health, action, overview, tape] = await Promise.all([
    readCacheJson<HealthSnapshot>('health_snapshot.json', {}),
    readCacheJson<ActionSnapshot>('action_snapshot.json', {}),
    readCacheJson<OverviewCache>('overview.json', {}),
    readCacheJson<TapeCache>('market_tape.json', { items: [] }),
  ])

  const vix = Array.isArray(tape.items) ? tape.items.find((i) => i?.symbol === 'VIX')?.last ?? null : null
  const tailRisk = typeof health.risk?.var95_1d === 'number' ? Math.abs(health.risk.var95_1d) * 10 : null
  const volRatio = typeof health.risk?.vol_ratio === 'number' ? health.risk.vol_ratio : null
  const phase = overview.market_phase || null
  const riskLevel = overview.risk_level || null
  const exposureBand = action.exposure_guidance?.exposure_band || null
  const actionLabel = action.exposure_guidance?.action_label || null
  const distPct = typeof health.trend?.dist_pct === 'number' ? health.trend.dist_pct : null
  const gateScore = typeof overview.gate_score === 'number' ? overview.gate_score : null

  const stress = (tailRisk != null && tailRisk >= 80) || (riskLevel || '').toUpperCase() === 'HIGH' || (typeof vix === 'number' && vix >= 28)

  const actionSentence = stress
    ? {
        ko: '현금(Pool) 확보를 우선하고 신규 레버리지 진입은 보류하세요.',
        en: 'Prioritize cash pool preservation and defer new leveraged entries.',
      }
    : actionLabel === 'Increase' && exposureBand
    ? {
        ko: `노출을 ${exposureBand} 구간으로 단계적으로 확대하세요.`,
        en: `Scale exposure gradually into the ${exposureBand} range.`,
      }
    : {
        ko: '지금은 관망/리밸런싱 중심으로 대응하고 급등 추격은 피하세요.',
        en: 'Focus on waiting/rebalancing and avoid chasing sharp upside moves.',
      }

  const evidenceBullets = [
    distPct != null
      ? {
          ko: `QQQ 추세 거리 ${distPct >= 0 ? '+' : ''}${distPct.toFixed(2)}%`,
          en: `QQQ trend distance ${distPct >= 0 ? '+' : ''}${distPct.toFixed(2)}%`,
        }
      : null,
    gateScore != null
      ? {
          ko: `게이트 점수 ${gateScore.toFixed(0)}로 시장 폭 확인`,
          en: `Breadth gate score ${gateScore.toFixed(0)} confirms participation`,
        }
      : null,
    typeof vix === 'number'
      ? {
          ko: `VIX ${vix.toFixed(2)}로 변동성 체감 확인`,
          en: `VIX ${vix.toFixed(2)} reflects current volatility tone`,
        }
      : volRatio != null
      ? {
          ko: `변동성 비율 ${volRatio.toFixed(2)}x 점검`,
          en: `Volatility ratio ${volRatio.toFixed(2)}x supports the risk read`,
        }
      : null,
  ].filter(Boolean) as Array<{ ko: string; en: string }>

  const chips = [
    riskLevel ? { key: 'Risk', ko: '리스크', en: riskLevel, val: riskLevel } : null,
    exposureBand ? { key: 'Exposure', ko: '노출', en: 'Exposure', val: exposureBand } : null,
    (typeof vix === 'number' || volRatio != null)
      ? { key: 'Vol', ko: '변동성', en: 'Vol', val: typeof vix === 'number' ? `VIX ${vix.toFixed(1)}` : `VR ${volRatio!.toFixed(2)}` }
      : null,
  ].filter(Boolean) as Array<{ key: string; ko: string; en: string; val: string }>

  return (
    <section
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14,
        padding: '0.8rem 0.9rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
      }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[12rem_1fr_auto] gap-3 items-start" style={{ minWidth: 0 }}>
        <div style={{ color: 'var(--text-primary)' }}>
          <BilLabel ko="오늘의 결론" en="Today's Action" variant="label" />
        </div>
        <div style={{ color: 'var(--text-secondary)', minWidth: 0 }}>
          <BilLabel ko={actionSentence.ko} en={actionSentence.en} variant="micro" />
        </div>
        {chips.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {chips.map((c) => {
              const color = chipColor(c.val)
              return (
                <span
                  key={c.key}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    borderRadius: 999,
                    border: `1px solid ${color}30`,
                    background: `${color}12`,
                    padding: '2px 8px',
                    color: color,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: color, flexShrink: 0 }} />
                  <span style={{ color: 'inherit' }}>
                    <BilLabel ko={`${c.ko} ${c.val}`} en={`${c.en} ${c.val}`} variant="micro" />
                  </span>
                </span>
              )
            })}
          </div>
        )}
      </div>
      {evidenceBullets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {evidenceBullets.slice(0, 3).map((b, idx) => (
            <div
              key={idx}
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 10,
                padding: '0.5rem 0.6rem',
                color: 'var(--text-secondary)',
              }}
            >
              <BilLabel ko={b.ko} en={b.en} variant="micro" />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
