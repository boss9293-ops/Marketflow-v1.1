type Props = {
  currentExposure: number | null
  allowedExposure: number | null
  drivers: string[]
}

function tone(buffer: number | null) {
  if (buffer == null) return 'text-slate-200 border-white/10 bg-white/[0.02]'
  if (buffer < 0) return 'text-rose-200 border-rose-500/30 bg-rose-500/10'
  if (buffer < 10) return 'text-amber-200 border-amber-500/30 bg-amber-500/10'
  return 'text-emerald-200 border-emerald-500/30 bg-emerald-500/10'
}

export default function RiskEngineCard({ currentExposure, allowedExposure, drivers }: Props) {
  const current = typeof currentExposure === 'number' ? Math.max(0, currentExposure) : null
  const allowed = typeof allowedExposure === 'number' ? Math.max(0, allowedExposure) : null
  const buffer = current != null && allowed != null ? +(allowed - current).toFixed(1) : null
  const pct = current != null && allowed != null && allowed > 0 ? Math.min(100, (current / allowed) * 100) : 0

  return (
    <section className="rounded-2xl border border-white/10 bg-[#121722] p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">L4 Risk Engine</h2>
        <span className={'rounded-full border px-2 py-1 text-xs font-semibold ' + tone(buffer)}>
          {buffer == null ? 'Buffer: N/A' : `Buffer ${buffer > 0 ? '+' : ''}${buffer}%`}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-slate-400">Current Exposure</div>
          <div className="mt-1 text-4xl font-bold text-white">
            {current == null ? '—' : `${current.toFixed(1)}%`}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-slate-400">Allowed Exposure</div>
          <div className="mt-1 text-4xl font-bold text-white">
            {allowed == null ? '—' : `${allowed.toFixed(1)}%`}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-slate-400">Over Cap?</div>
          <div className="mt-2 text-lg font-semibold text-slate-100">
            {buffer == null ? 'N/A' : buffer < 0 ? 'YES' : 'NO'}
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={buffer != null && buffer < 0 ? 'h-full bg-rose-400' : 'h-full bg-emerald-400'}
              style={{ width: `${Math.max(6, pct)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 text-sm text-slate-300">
        <span className="text-slate-500">Drivers:</span>{' '}
        {drivers.length ? drivers.slice(0, 3).join(' / ') : '—'}
      </div>
    </section>
  )
}
