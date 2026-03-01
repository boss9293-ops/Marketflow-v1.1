import BilLabel from '@/components/BilLabel'
import EmptyState from '@/components/EmptyState'
import type { MarketHistoryRow } from '@/components/MarketHistoryStrip'

const C = {
  bull: '#00C853',
  transition: '#FFB300',
  defensive: '#FF7043',
  neutral: '#5E6A75',
} as const

function riskLevelScore(level?: string | null): number | null {
  const v = (level || '').toUpperCase()
  if (v === 'LOW') return 25
  if (v === 'MEDIUM') return 60
  if (v === 'HIGH') return 85
  return null
}

function phaseColor(phase?: string | null) {
  const v = (phase || '').toUpperCase()
  if (v === 'BULL') return C.bull
  if (v === 'NEUTRAL') return C.transition
  if (v === 'BEAR') return C.defensive
  return C.neutral
}

function miniCard({
  title,
  value,
  note,
  color,
}: {
  title: { ko: string; en: string }
  value: string
  note: { ko: string; en: string }
  color?: string
}) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: '0.8rem 0.9rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.45rem',
      }}
    >
      <div style={{ color: 'var(--text-secondary)' }}>
        <BilLabel ko={title.ko} en={title.en} variant="micro" />
      </div>
      <div style={{ color: color || 'var(--text-primary)', fontWeight: 800, fontSize: '1rem', lineHeight: 1.15 }}>
        {value}
      </div>
      <div style={{ color: 'var(--text-muted)' }}>
        <BilLabel ko={note.ko} en={note.en} variant="micro" />
      </div>
    </div>
  )
}

export default function EpisodeSummary({ rows }: { rows: MarketHistoryRow[] }) {
  const safeRows = Array.isArray(rows) ? rows : []
  if (safeRows.length === 0) {
    return (
      <EmptyState
        title={{ ko: '구간 요약 없음', en: 'No episode summary' }}
        description={{ ko: '이력 데이터가 없어 구간 요약을 계산할 수 없습니다.', en: 'History data is unavailable, so episode summary cannot be computed.' }}
        icon="⏳"
      />
    )
  }

  const currentPhase = safeRows[0]?.market_phase || null
  let streak = 0
  for (const row of safeRows) {
    if (!currentPhase || row.market_phase !== currentPhase) break
    streak += 1
  }

  const riskScores = safeRows.map((r) => riskLevelScore(r.risk_level)).filter((v): v is number => typeof v === 'number')
  const maxRiskScore = riskScores.length ? Math.max(...riskScores) : null
  const minGateVals = safeRows.map((r) => r.gate_score).filter((v): v is number => typeof v === 'number')
  const minGateScore = minGateVals.length ? Math.min(...minGateVals) : null
  const hasMissing = safeRows.some((r) => !r.date || !r.market_phase || typeof r.gate_score !== 'number' || !r.risk_level)

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ color: 'var(--text-primary)' }}>
          <BilLabel ko="구간 요약" en="Episode Summary" variant="label" />
        </div>
        {hasMissing && (
          <div style={{ color: 'var(--text-muted)' }}>
            <BilLabel ko="확인 필요" en="Needs verification" variant="micro" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {miniCard({
          title: { ko: '현재 구간', en: 'Current Episode' },
          value: `${currentPhase || '—'} · ${streak}d`,
          note: { ko: '동일 국면 연속 일수', en: 'Consecutive days in same phase' },
          color: phaseColor(currentPhase),
        })}
        {miniCard({
          title: { ko: '최대 스트레스', en: 'Peak Stress' },
          value: maxRiskScore != null ? String(maxRiskScore) : '—',
          note: { ko: '최근 창에서 리스크 라벨 환산값', en: 'Risk-label-derived peak score in window' },
          color: maxRiskScore != null ? (maxRiskScore >= 80 ? C.defensive : maxRiskScore >= 50 ? C.transition : C.bull) : C.neutral,
        })}
        {miniCard({
          title: { ko: '최저 브레드스', en: 'Weakest Breadth' },
          value: minGateScore != null ? minGateScore.toFixed(0) : '—',
          note: { ko: '최근 창의 최소 게이트 점수', en: 'Minimum gate score in recent window' },
          color: minGateScore != null ? (minGateScore > 60 ? C.bull : minGateScore > 40 ? C.transition : C.defensive) : C.neutral,
        })}
      </div>
    </section>
  )
}
