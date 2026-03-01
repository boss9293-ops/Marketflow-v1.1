'use client'

import { useMemo, useState } from 'react'

type Position = {
  symbol?: string
  name?: string
  qty?: number
  avg_cost?: number
  current_price?: number
  market_value?: number
  pnl?: number
  pnl_pct?: number
}

type Props = {
  effectiveBetaProxy: number | null
  concentrationRisk: string
  stressLoss5d: number | null
  positions: Position[]
}

function fmtNum(v: number | null, suffix = '') {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${v.toFixed(2)}${suffix}`
}

export default function PortfolioImpactPanel({
  effectiveBetaProxy,
  concentrationRisk,
  stressLoss5d,
  positions,
}: Props) {
  const [open, setOpen] = useState(false)

  const summary = useMemo(
    () =>
      `Effective Beta(proxy) ${fmtNum(effectiveBetaProxy)} · Concentration ${concentrationRisk} · Stress Loss(-5%) ${fmtNum(stressLoss5d, '%')}`,
    [effectiveBetaProxy, concentrationRisk, stressLoss5d]
  )

  return (
    <section className="rounded-2xl border border-white/10 bg-[#111722] p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">L5 Portfolio Impact</h3>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-white/15 px-2.5 py-1 text-xs text-slate-200 hover:bg-white/5"
        >
          {open ? 'Collapse' : 'Expand'}
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200">{summary}</div>

      {open && (
        <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-sm">
            <thead className="bg-white/5 text-slate-300">
              <tr>
                <th className="px-3 py-2 text-left">Ticker</th>
                <th className="px-3 py-2 text-right">Weight/Value</th>
                <th className="px-3 py-2 text-right">P/L</th>
                <th className="px-3 py-2 text-right">P/L %</th>
              </tr>
            </thead>
            <tbody>
              {positions.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-center text-slate-400">
                    No positions data
                  </td>
                </tr>
              )}
              {positions.map((p, i) => {
                const pnl = typeof p.pnl === 'number' ? p.pnl : null
                const pnlPct = typeof p.pnl_pct === 'number' ? p.pnl_pct : null
                const mv = typeof p.market_value === 'number' ? p.market_value : null
                return (
                  <tr key={`${p.symbol || 'row'}-${i}`} className="border-t border-white/5 text-slate-200">
                    <td className="px-3 py-2">{p.symbol || p.name || '—'}</td>
                    <td className="px-3 py-2 text-right">{mv == null ? '—' : mv.toLocaleString()}</td>
                    <td className={'px-3 py-2 text-right ' + (pnl != null && pnl < 0 ? 'text-rose-300' : 'text-emerald-300')}>
                      {pnl == null ? '—' : pnl.toLocaleString()}
                    </td>
                    <td className={'px-3 py-2 text-right ' + (pnlPct != null && pnlPct < 0 ? 'text-rose-300' : 'text-emerald-300')}>
                      {pnlPct == null ? '—' : `${pnlPct.toFixed(2)}%`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
