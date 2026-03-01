type Item = {
  title: string
  value: string
  subtitle: string
}

function MiniCard({ item }: { item: Item }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#121722] p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{item.title}</div>
      <div className="mt-1 text-xl font-semibold text-white">{item.value}</div>
      <div className="mt-1 text-sm text-slate-400">{item.subtitle}</div>
    </div>
  )
}

export default function MarketStructurePanel({ items }: { items: Item[] }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">L1-L3 Market Structure</h3>
      {items.map((item) => (
        <MiniCard key={item.title} item={item} />
      ))}
    </section>
  )
}
