'use client'

export default function ActionGuidanceBox({
  mode,
  phase,
  defensiveMode,
  confirmPoints = ['VIX', 'HY OAS'],
}: {
  mode: 'ko' | 'en'
  phase: string
  defensiveMode: string
  confirmPoints?: string[]
}) {
  const isDefense = phase === 'Shock' || defensiveMode === 'ON'
  const isCaution = phase === 'Contraction' || defensiveMode === 'WATCH' || phase === 'Slowdown'

  const blocks = isDefense
    ? {
        priority: mode === 'ko' ? '방어 비중 점검과 노출 축소 순서로 진행' : 'Prioritize defense, then reduce exposure',
        ok: mode === 'ko' ? '기존 포지션 관리 및 현금/헤지 비중 확대' : 'Manage existing positions and raise cash/hedge buffer',
        avoid: mode === 'ko' ? '공격적 신규 진입, 레버리지 확대' : 'Avoid aggressive new entries and leverage expansion',
        check: mode === 'ko' ? `${confirmPoints.slice(0, 2).join(', ')} 급등 지속 여부 확인` : `Check if ${confirmPoints.slice(0, 2).join(', ')} keep spiking`,
      }
    : isCaution
      ? {
          priority: mode === 'ko' ? '속도 조절과 포지션 점검을 먼저 수행' : 'Prioritize pace control and position review',
          ok: mode === 'ko' ? '기존 전략 유지 + 분할 대응' : 'Maintain current strategy with gradual sizing',
          avoid: mode === 'ko' ? '단기 추격 매수/과도한 비중 확대' : 'Avoid chasing and oversized additions',
          check: mode === 'ko' ? `${confirmPoints.slice(0, 2).join(', ')} 방향 전환 여부 확인` : `Check for trend turn in ${confirmPoints.slice(0, 2).join(', ')}`,
        }
      : {
          priority: mode === 'ko' ? '기존 계획 유지, 리듬 유지' : 'Keep plan and maintain rhythm',
          ok: mode === 'ko' ? '분할 진입/유지 중심의 정상 운영' : 'Normal operation with staged entries/holds',
          avoid: mode === 'ko' ? '급격한 레버리지 확대' : 'Avoid abrupt leverage expansion',
          check: mode === 'ko' ? `${confirmPoints.slice(0, 2).join(', ')} 일일 점검` : `Daily check on ${confirmPoints.slice(0, 2).join(', ')}`,
        }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#16181c] p-5 min-h-[200px]">
      <div className="text-xl md:text-2xl font-extrabold text-slate-100 mb-3 tracking-tight">{mode === 'ko' ? '행동 가이드' : 'Action Guide'}</div>
      <div className="space-y-2 text-sm md:text-base text-slate-300 leading-relaxed">
        <div><span className="text-slate-400">{mode === 'ko' ? '우선순위' : 'PRIORITY'}:</span> {blocks.priority}</div>
        <div><span className="text-emerald-300">{mode === 'ko' ? 'OK' : 'OK'}:</span> {blocks.ok}</div>
        <div><span className="text-amber-300">{mode === 'ko' ? 'AVOID' : 'AVOID'}:</span> {blocks.avoid}</div>
        <div><span className="text-cyan-300">{mode === 'ko' ? 'CHECK' : 'CHECK'}:</span> {blocks.check}</div>
      </div>
    </div>
  )
}
