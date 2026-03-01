'use client'

export default function MacroClimateBanner({
  mode,
  tone,
  headline,
  reason1,
  reason2,
  quality,
}: {
  mode: 'ko' | 'en'
  tone: 'safe' | 'caution' | 'risk'
  headline: string
  reason1: string
  reason2: string
  quality?: string
}) {
  const cls =
    tone === 'risk'
      ? 'border-rose-500/30 bg-rose-500/10 text-rose-100'
      : tone === 'caution'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'

  return (
    <div className={`rounded-2xl border p-5 ${cls}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-2xl md:text-3xl font-extrabold tracking-tight leading-tight">{headline}</div>
        {quality ? <span className="px-2 py-0.5 text-xs rounded-full border border-white/20 bg-white/10">{quality}</span> : null}
      </div>
      <div className="mt-3 text-sm md:text-base opacity-95 leading-relaxed">• {mode === 'ko' ? reason1 : reason1}</div>
      <div className="mt-1 text-sm md:text-base opacity-95 leading-relaxed">• {mode === 'ko' ? reason2 : reason2}</div>
    </div>
  )
}
