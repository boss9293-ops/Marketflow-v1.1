import BilLabel from '@/components/BilLabel'
import { readCacheJson } from '@/lib/readCacheJson'

type HealthSnapshot = {
  trend?: { dist_pct?: number | null } | null
  risk?: { vol_ratio?: number | null } | null
}
type OverviewCache = {
  market_phase?: string | null
  risk_level?: string | null
}
type TapeCache = {
  items?: Array<{ symbol?: string | null; last?: number | null }> | null
}

const C = {
  green: '#00C853',
  amber: '#FFB300',
  orange: '#FF7043',
  red: '#D32F2F',
  neutral: '#5E6A75',
} as const

function badge(score: number) {
  if (score >= 80) return { label: 'RED', ko: '고위험', color: C.red }
  if (score >= 60) return { label: 'ORANGE', ko: '주의', color: C.orange }
  if (score >= 40) return { label: 'AMBER', ko: '중립', color: C.amber }
  return { label: 'GREEN', ko: '양호', color: C.green }
}

export default async function LeverageWeather() {
  const [health, overview, tape] = await Promise.all([
    readCacheJson<HealthSnapshot>('health_snapshot.json', {}),
    readCacheJson<OverviewCache>('overview.json', {}),
    readCacheJson<TapeCache>('market_tape.json', { items: [] }),
  ])

  const vix = Array.isArray(tape.items) ? tape.items.find((i) => i?.symbol === 'VIX')?.last ?? null : null
  const dist = typeof health.trend?.dist_pct === 'number' ? health.trend.dist_pct : null
  const volRatio = typeof health.risk?.vol_ratio === 'number' ? health.risk.vol_ratio : null
  const riskLevel = (overview.risk_level || '').toUpperCase()
  const phase = (overview.market_phase || '').toUpperCase()

  const baseScore =
    (typeof vix === 'number' ? Math.min(50, Math.max(0, (vix - 12) * 2.4)) : 20) +
    (typeof volRatio === 'number' ? Math.min(30, Math.max(0, (volRatio - 0.8) * 40)) : 10) +
    (riskLevel === 'HIGH' ? 25 : riskLevel === 'MEDIUM' ? 12 : 0) +
    (phase === 'BEAR' ? 15 : 0)

  const tqqqScore = Math.round(Math.min(100, Math.max(0, baseScore + (typeof dist === 'number' && dist < 0 ? 8 : 0))))
  const soxlScore = Math.round(Math.min(100, Math.max(0, baseScore + 8)))

  const tqqqBadge = badge(tqqqScore)
  const soxlBadge = badge(soxlScore)

  const tqqqLine =
    typeof vix === 'number' && vix >= 22
      ? { ko: '갭 리스크 확대 가능성. 시가 추격보다 눌림 확인이 유리합니다.', en: 'Gap risk is elevated. Favor pullback confirmation over open chasing.' }
      : typeof dist === 'number' && dist > 4
      ? { ko: '추세 우위지만 과열 추격 주의. 분할 접근이 적합합니다.', en: 'Trend is supportive, but avoid overbought chasing. Scale in gradually.' }
      : { ko: '변동성 체감이 중립 구간입니다. 손절 기준을 먼저 정하세요.', en: 'Leverage conditions are neutral; define stop levels first.' }

  const soxlLine =
    phase === 'BEAR' || riskLevel === 'HIGH'
      ? { ko: '반도체 레버리지는 급등·급락 폭이 커 신규 진입 속도를 낮추세요.', en: 'Semiconductor leverage can swing hard; reduce entry speed in this regime.' }
      : typeof vix === 'number' && vix < 18
      ? { ko: '변동성 완화 시 반등 탄력이 커질 수 있으나 비중 상한을 유지하세요.', en: 'Lower volatility can amplify rebounds, but keep hard size limits.' }
      : { ko: '이벤트/뉴스 민감도가 높아 장중 변동폭을 크게 가정해야 합니다.', en: 'Headline sensitivity is high; assume wider intraday swings.' }

  return (
    <section
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14,
        padding: '0.85rem 0.9rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.7rem',
      }}
    >
      <div style={{ color: 'var(--text-primary)' }}>
        <BilLabel ko="오늘의 레버리지 체감" en="Leverage Weather" variant="label" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          { symbol: 'TQQQ', score: tqqqScore, b: tqqqBadge, line: tqqqLine },
          { symbol: 'SOXL', score: soxlScore, b: soxlBadge, line: soxlLine },
        ].map((x) => (
          <div
            key={x.symbol}
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 12,
              padding: '0.75rem 0.8rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.45rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <div style={{ color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 800 }}>{x.symbol}</div>
              <span style={{ borderRadius: 999, border: `1px solid ${x.b.color}40`, background: `${x.b.color}16`, color: x.b.color, padding: '2px 8px' }}>
                <BilLabel ko={x.b.ko} en={x.b.label} variant="micro" />
              </span>
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>
              <BilLabel ko={x.line.ko} en={x.line.en} variant="micro" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

