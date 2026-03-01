type Tone = 'neutral' | 'warn' | 'risk'

type Item = {
  title: string
  value: string
  subtitle: string
  tone?: Tone
}

function toneClass(tone: Tone) {
  if (tone === 'risk') return 'border-rose-500/30 bg-rose-500/10'
  if (tone === 'warn') return 'border-amber-500/30 bg-amber-500/10'
  return 'border-white/10 bg-[#121722]'
}

export default function LeverageShockPanel({ items }: { items: Item[] }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">L3.5 Fast Risk</h3>
      {items.map((item) => (
        <div key={item.title} className={'rounded-xl border p-4 ' + toneClass(item.tone || 'neutral')}>
          <div className="text-xs uppercase tracking-wide text-slate-400">{item.title}</div>
          <div className="mt-1 text-xl font-semibold text-white">{item.value}</div>
          <div className="mt-1 text-sm text-slate-300">{item.subtitle}</div>
        </div>
      ))}
    </section>
  )
}
