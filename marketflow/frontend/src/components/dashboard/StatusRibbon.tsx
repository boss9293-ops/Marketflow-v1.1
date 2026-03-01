type Tone = 'neutral' | 'good' | 'warn' | 'risk'

type RibbonItem = {
  label: string
  value: string
  tone?: Tone
  muted?: boolean
}

function toneClass(tone: Tone, muted?: boolean) {
  if (muted) return 'border-white/10 bg-white/[0.02] text-slate-400'
  if (tone === 'good') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
  if (tone === 'warn') return 'border-amber-500/30 bg-amber-500/10 text-amber-200'
  if (tone === 'risk') return 'border-rose-500/30 bg-rose-500/10 text-rose-200'
  return 'border-white/10 bg-white/[0.02] text-slate-200'
}

export default function StatusRibbon({ items }: { items: RibbonItem[] }) {
  return (
    <section className="rounded-xl border border-white/10 bg-[#11151c] px-3 py-2">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
        {items.map((it) => (
          <div
            key={it.label}
            className={'flex items-center justify-between rounded-lg border px-2.5 py-1.5 ' + toneClass(it.tone || 'neutral', it.muted)}
          >
            <span className="text-[11px] uppercase tracking-wide opacity-80">{it.label}</span>
            <span className="text-sm font-semibold">{it.value}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
