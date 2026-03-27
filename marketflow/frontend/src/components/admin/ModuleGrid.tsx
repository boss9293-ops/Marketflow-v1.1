const C: Record<string, string> = {
  GREEN: '#16C784',
  YELLOW: '#F5B700',
  RED: '#EA3943',
  GRAY: '#6B7280'
}

const SEV_C: Record<string, string> = {
  CRITICAL: '#991B1B', // Darker/Stronger red
  HIGH: '#EA3943',
  MEDIUM: '#F5B700',
  LOW: '#64748B'
}

type Module = {
  name: string
  category: string
  status: string
  severity: string
  silent_failure: boolean
  last_updated: string
  expected_interval: number
  delay: number
  impact: string[]
  reason: string
}

function formatDelay(mins: number) {
  if (mins < 60) return `${mins}m`
  if (mins < 1440) return `${(mins/60).toFixed(1)} hours`
  return `${(mins/1440).toFixed(1)} days`
}

export default function ModuleGrid({ modules, onSelectModule, selectedModule }: { modules: Module[], onSelectModule: (name: string) => void, selectedModule: string | null }) {
  if (!modules) return null

  // Sort within categories: CRITICAL > HIGH > MEDIUM > LOW
  const sevPriority: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, GRAY: 0 }

  const grouped = modules.reduce((acc, m) => {
    acc[m.category] = acc[m.category] || []
    acc[m.category].push(m)
    return acc
  }, {} as Record<string, Module[]>)

  Object.values(grouped).forEach(group => {
    group.sort((a,b) => (sevPriority[b.severity] || 0) - (sevPriority[a.severity] || 0))
  })

  return (
    <section className="bg-[#0E131A] border border-white/5 rounded-xl p-5">
      <div className="border-b border-white/5 pb-3 mb-5">
        <h2 className="text-sm font-bold tracking-widest text-[#D8E6F5]">MODULE HEALTH GRID</h2>
        <p className="text-[10px] text-slate-500 mt-1">Aviation panel diagnostic view (Sorted by Severity)</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Object.entries(grouped).map(([category, mods]) => (
          <div key={category} className="flex flex-col gap-3">
            <h3 className="text-xs font-bold text-slate-400 pb-1 border-b border-white/5">{category}</h3>
            <div className="flex flex-col gap-2">
              {mods.map(mod => {
                const isSelected = selectedModule === mod.name
                const slaBreached = mod.delay > mod.expected_interval
                
                return (
                  <button
                    key={mod.name}
                    onClick={() => onSelectModule(mod.name)}
                    className={`text-left p-3 rounded-lg border transition-colors flex flex-col gap-1.5
                      ${isSelected ? 'bg-white/10 border-white/20' : 'bg-black/20 border-white/5 hover:border-white/10'}`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <div className="flex items-center gap-2 pr-2 overflow-hidden">
                        <span className="text-xs font-bold text-slate-200 truncate">{mod.name}</span>
                        {mod.status !== 'GREEN' && mod.status !== 'GRAY' && (
                          <span style={{ backgroundColor: SEV_C[mod.severity] }} className="px-1.5 py-0.5 rounded text-[8px] font-black text-white shrink-0">
                            {mod.severity}
                          </span>
                        )}
                        {mod.silent_failure && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-red-900 text-white shrink-0">SILENT FAIL</span>
                        )}
                      </div>
                      <span 
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-[0_0_8px_currentColor]" 
                        style={{ backgroundColor: C[mod.status] || C.GRAY, color: C[mod.status] || C.GRAY }}
                      ></span>
                    </div>

                    <div className="flex flex-col gap-0.5 text-[10px] bg-black/40 p-1.5 rounded mt-0.5">
                       <div className="flex justify-between">
                         <span className="text-slate-500">Delay:</span>
                         <span className={slaBreached ? 'text-[#F5B700] font-bold' : 'text-slate-300'}>{formatDelay(mod.delay)}</span>
                       </div>
                       <div className="flex justify-between">
                         <span className="text-slate-500">Expected:</span>
                         <span className="text-slate-300">{formatDelay(mod.expected_interval)}</span>
                       </div>
                       <div className="flex justify-between mt-0.5 pt-0.5 border-t border-white/10">
                         <span className="text-slate-500">SLA:</span>
                         <span className={slaBreached ? 'text-[#EA3943] font-bold' : 'text-[#16C784]'}>{slaBreached ? 'BREACHED' : 'OK'}</span>
                       </div>
                    </div>
                    
                    <div className="text-[10px] text-slate-500 truncate mt-1">
                      Affects: <span className="text-slate-400">{mod.impact?.length ? mod.impact.join(', ') : 'none'}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
