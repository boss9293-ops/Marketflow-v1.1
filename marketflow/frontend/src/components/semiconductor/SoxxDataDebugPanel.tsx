'use client'

import type {
  SoxxDataDebugSummary,
  SoxxDebugStatus,
} from '@/lib/semiconductor/soxxDataDebug'

type SoxxDataDebugPanelProps = {
  summary: SoxxDataDebugSummary
}

function statusLabel(status: SoxxDebugStatus): string {
  if (status === 'pass') return 'PASS'
  if (status === 'partial') return 'PARTIAL'
  if (status === 'fail') return 'FAIL'
  return 'UNKNOWN'
}

function statusClass(status: SoxxDebugStatus): string {
  if (status === 'pass') return 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
  if (status === 'partial') return 'text-amber-300 border-amber-500/30 bg-amber-500/10'
  if (status === 'fail') return 'text-red-300 border-red-500/30 bg-red-500/10'
  return 'text-slate-400 border-slate-700 bg-slate-900/60'
}

export function SoxxDataDebugPanel({ summary }: SoxxDataDebugPanelProps) {
  return (
    <div className="border border-slate-800 bg-[#04070d] rounded-sm p-3">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            SOXX Data QA
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Internal debug panel (`?debug=1`)
          </div>
        </div>
        <div className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${statusClass(summary.overallStatus)}`}>
          {statusLabel(summary.overallStatus)}
        </div>
      </div>

      <div className="mt-2 space-y-2">
        {summary.sections.map((section) => (
          <div key={section.id} className="rounded-sm border border-slate-800/80 bg-slate-950/20 p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-semibold text-slate-200">{section.label}</div>
              <div className={`rounded-sm border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${statusClass(section.status)}`}>
                {statusLabel(section.status)}
              </div>
            </div>
            <p className="mt-1 text-[11px] text-slate-400 leading-[1.55]">{section.summary}</p>
            {section.details && section.details.length > 0 && (
              <ul className="mt-1.5 space-y-1 text-[10px] leading-[1.5] text-slate-500">
                {section.details.map((detail, index) => (
                  <li key={`${section.id}-${index}`}>- {detail}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <div className="mt-2 text-[10px] text-slate-500">
        Generated at {summary.generatedAt}
      </div>
    </div>
  )
}
