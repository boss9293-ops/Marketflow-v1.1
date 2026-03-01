'use client'

import { pickLang } from '@/lib/useLangMode'

type Row = {
  key: string
  label: string
  source: string
  value: number
  change_30d: number
  direction: 'UP' | 'DOWN' | 'FLAT' | string
  status: 'Normal' | 'Watch' | 'Risk' | string
  percentile?: number
  unit?: string
}

function statusCls(status: string) {
  if (status === 'Risk') return 'text-rose-200 bg-rose-500/5 border-rose-500/20'
  if (status === 'Watch') return 'text-amber-200 bg-amber-500/5 border-amber-500/20'
  return 'text-emerald-200 bg-emerald-500/5 border-emerald-500/20'
}

function dirCls(direction: string) {
  if (direction === 'UP') return 'text-rose-300'
  if (direction === 'DOWN') return 'text-emerald-300'
  return 'text-slate-300'
}

function fmt(v: unknown, digits = 2) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—'
  return v.toFixed(digits)
}

function dirLabel(direction: string, mode: 'ko' | 'en') {
  if (mode === 'en') return direction
  if (direction === 'UP') return '상승'
  if (direction === 'DOWN') return '하락'
  if (direction === 'FLAT') return '보합'
  return direction
}

function statusLabel(status: string, mode: 'ko' | 'en') {
  if (mode === 'en') return status
  if (status === 'Normal') return '정상'
  if (status === 'Watch') return '주의'
  if (status === 'Risk') return '위험'
  return status
}

export default function PublicMacroContext({ rows, mode }: { rows: Row[]; mode: 'ko' | 'en' }) {
  if (!rows || rows.length === 0) return null

  return (
    <div className="bg-[#14171c] rounded-2xl p-5 border border-white/10">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-100">{pickLang(mode, '퍼블릭 매크로 컨텍스트', 'Public Macro Context')}</h3>
        <span className="text-xs md:text-sm text-slate-400">{pickLang(mode, '읽기 전용 컨텍스트 레이어', 'Read-only context layer')}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500 border-b border-white/10 text-[11px] uppercase tracking-wide">
              <th className="text-left py-2.5 pr-3">{pickLang(mode, '항목', 'Item')}</th>
              <th className="text-left py-2.5 pr-3">{pickLang(mode, '소스', 'Source')}</th>
              <th className="text-right py-2.5 pr-3">{pickLang(mode, '값', 'Value')}</th>
              <th className="text-right py-2.5 pr-3">30D Δ</th>
              <th className="text-center py-2.5 pr-3">{pickLang(mode, '추세', 'Trend')}</th>
              <th className="text-center py-2.5">{pickLang(mode, '상태', 'Status')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-white/5 text-slate-300">
                <td className="py-2.5 pr-3 text-slate-100 font-semibold">{r.label}</td>
                <td className="py-2.5 pr-3 text-slate-300">
                  <span className="px-2 py-0.5 rounded border border-white/10 bg-white/[0.03] text-xs">
                    {r.source}
                  </span>
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-sm text-slate-100">{fmt(r.value)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-sm text-slate-100">{fmt(r.change_30d)}</td>
                <td className={`py-2.5 pr-3 text-center font-semibold ${dirCls(r.direction)}`}>{dirLabel(r.direction, mode)}</td>
                <td className="py-2.5 text-center">
                  <span className={`px-2.5 py-0.5 rounded-full border text-xs ${statusCls(r.status)}`}>{statusLabel(r.status, mode)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
