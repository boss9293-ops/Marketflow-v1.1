export default function AIMarketBriefCard() {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#121722] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">AI Market Brief (Placeholder)</h2>
        <span className="rounded-full border border-white/15 bg-white/[0.03] px-2 py-1 text-[11px] text-slate-300">Phase 1 Positioning</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">GPT Brief</div>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            오늘 시장은 혼조 흐름 속 금리 상승 압력이 일부 성장주에 부담으로 작용.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">Gemini Brief</div>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            주요 빅테크 실적 기대감이 지수 하방을 방어하는 모습.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-200">
        <span className="text-slate-400">공통 요약:</span> 구조적 붕괴 신호는 없으나 단기 변동성 확대 구간.
      </div>
    </section>
  )
}
