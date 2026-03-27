type Module = {
  name: string
  category: string
  status: string
  last_updated: string
  expected_interval: number
  delay: number
  impact: string[]
  reason: string
}

export default function StaleBoard({ modules }: { modules: Module[] }) {
  if (!modules) return null

  // Sort by staleness (RED first, then YELLOW, then GREEN)
  const sorted = [...modules].sort((a, b) => {
    if (a.status === 'RED' && b.status !== 'RED') return -1
    if (a.status !== 'RED' && b.status === 'RED') return 1
    if (a.status === 'YELLOW' && b.status !== 'YELLOW') return -1
    if (a.status !== 'YELLOW' && b.status === 'YELLOW') return 1
    return b.delay - a.delay
  })

  // We only really care about items with non-zero delays or status warnings
  return (
    <section className="bg-[#0E131A] border border-white/5 rounded-xl p-5 h-full flex flex-col">
      <div className="border-b border-white/5 pb-3 mb-4">
        <h2 className="text-sm font-bold tracking-widest text-[#D8E6F5]">STALE DATA BOARD</h2>
        <p className="text-[10px] text-slate-500 mt-1">Real-time freshness monitoring</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-2">
          {sorted.map(mod => {
            const isStale = mod.status === 'RED' || mod.status === 'YELLOW'
            return (
              <div 
                key={mod.name} 
                className={`flex flex-col gap-1 p-3 rounded-lg border ${
                  isStale 
                    ? mod.status === 'RED' ? 'bg-[#EA3943]/10 border-[#EA3943]/30' : 'bg-[#F5B700]/10 border-[#F5B700]/30'
                    : 'bg-white/5 border-white/5'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-bold ${isStale ? 'text-white' : 'text-slate-300'}`}>
                    {mod.name}
                  </span>
                  <span className={`text-xs font-black ${
                    mod.status === 'RED' ? 'text-[#EA3943]' : mod.status === 'YELLOW' ? 'text-[#F5B700]' : 'text-[#16C784]'
                  }`}>
                    {mod.status === 'GREEN' ? 'LIVE' : mod.status === 'RED' ? 'STALE' : 'DELAYED'}
                  </span>
                </div>
                
                <div className="flex justify-between items-end mt-1">
                  <div className="text-[10px] text-slate-400">
                    <div className="font-mono">{mod.delay}m delay</div>
                    <div className="opacity-70">expected {mod.expected_interval}m</div>
                  </div>
                  <div className="text-[10px] text-right">
                    <span className="text-slate-500">Affects: </span>
                    <span className="text-slate-300">{mod.impact?.join(', ') || 'none'}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
