type TapeItem = {
  symbol?: string | null
  last?: number | null
  chg_pct?: number | null
}

function fmt(v: number | null | undefined, d = 2) {
  return typeof v === 'number' && Number.isFinite(v) ? v.toFixed(d) : '—'
}

function tone(pct: number | null | undefined) {
  if (typeof pct !== 'number' || !Number.isFinite(pct)) return 'text-slate-300'
  if (pct > 0) return 'text-emerald-300'
  if (pct < 0) return 'text-rose-300'
  return 'text-slate-300'
}

function Cell({ label, item }: { label: string; item?: TapeItem }) {
  const pct = item?.chg_pct
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-100">{fmt(item?.last ?? null)}</span>
        <span className={'text-xs font-semibold ' + tone(pct)}>{typeof pct === 'number' ? `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%` : '—'}</span>
      </div>
    </div>
  )
}

export default function MarketPulseStrip({ items }: { items: TapeItem[] }) {
  const map = new Map((items || []).map((it) => [String(it.symbol || '').toUpperCase(), it]))

  return (
    <section className="rounded-xl border border-white/10 bg-[#11151c] p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">Market Pulse (Cross-Asset)</div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {['SPY', 'QQQ', 'IWM', 'DIA', 'VIX'].map((s) => <Cell key={s} label={s} item={map.get(s)} />)}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-5">
        {[['US10Y','US10Y'], ['US2Y','US2Y'], ['DXY','DXY'], ['GOLD','GOLD'], ['BTC','BTCUSD']].map(([label,key]) => (
          <Cell key={label} label={label} item={map.get(key)} />
        ))}
      </div>
    </section>
  )
}
