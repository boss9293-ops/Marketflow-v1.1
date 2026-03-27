const C = {
  GREEN: '#16C784',
  YELLOW: '#F5B700',
  RED: '#EA3943',
  GRAY: '#6B7280'
}

export default function MasterStatusPanel({ system }: { system: any }) {
  if (!system) return null

  const color = C[system.status as keyof typeof C] || C.GRAY

  return (
    <section style={{ borderColor: `${color}44`, backgroundColor: `${color}11` }} className="border rounded-xl p-4 sm:p-6 mb-2">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        
        <div className="flex items-center gap-4 shrink-0">
          <div style={{ backgroundColor: color }} className="w-4 h-4 rounded-full shadow-[0_0_12px_currentColor]"></div>
          <div>
            <div className="text-xs font-bold tracking-widest text-slate-400 mb-1">MASTER STATUS</div>
            <div style={{ color }} className="text-2xl font-black">{system.status}</div>
            <div className="text-sm font-bold text-slate-200 mt-0.5">{system.summary}</div>
          </div>
        </div>

        {/* Master Reasons */}
        {(system.status === 'RED' || system.status === 'YELLOW') && (
          <div className="flex-1 bg-black/40 rounded-lg border border-red-500/10 p-3 pr-6 text-xs flex flex-col gap-1.5 w-full xl:w-auto overflow-hidden">
             {system.top_causes?.length > 0 && (
               <div className="flex gap-2 items-start">
                 <span className="text-[#EA3943] font-bold min-w-[80px]">Top Causes:</span>
                 <span className="text-slate-300 font-mono truncate">{system.top_causes.join(', ')}</span>
               </div>
             )}
             {system.critical_blockers?.length > 0 && (
               <div className="flex gap-2 items-start">
                 <span className="text-[#EA3943] font-bold min-w-[80px]">Blockers:</span>
                 <span className="text-slate-300 font-mono truncate">{system.critical_blockers.join(', ')}</span>
               </div>
             )}
             {system.impacted_areas?.length > 0 && (
               <div className="flex gap-2 items-start">
                 <span className="text-[#F5B700] font-bold min-w-[80px]">Impacted:</span>
                 <span className="text-slate-300 font-mono truncate">{system.impacted_areas.join(', ')}</span>
               </div>
             )}
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full xl:w-auto shrink-0 border-t xl:border-t-0 xl:border-l border-white/10 pt-4 xl:pt-0 xl:pl-6">
          <div className="flex flex-col">
            <span className="text-xs text-slate-500 font-medium">Failed Modules</span>
            <span className={`text-xl font-bold mt-1 ${system.failed_modules > 0 ? 'text-[#EA3943]' : 'text-slate-200'}`}>
              {system.failed_modules}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-slate-500 font-medium">Stale Data</span>
            <span className={`text-xl font-bold mt-1 ${system.stale_modules > 0 ? 'text-[#F5B700]' : 'text-slate-200'}`}>
              {system.stale_modules}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-slate-500 font-medium">Active Alerts</span>
            <span className={`text-xl font-bold mt-1 ${system.alerts > 0 ? 'text-[#EA3943]' : 'text-slate-200'}`}>
              {system.alerts}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-slate-500 font-medium">Last Full Run</span>
            <span className="text-sm font-bold text-slate-200 mt-1">
              {new Date(system.last_full_pipeline_run).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

      </div>
    </section>
  )
}
