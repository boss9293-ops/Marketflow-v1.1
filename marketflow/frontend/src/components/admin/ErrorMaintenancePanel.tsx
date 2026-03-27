import React, { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'

type Module = {
  name: string
  category: string
  status: string
  last_updated: string
  expected_interval: number
  delay: number
  impact: string[]
  reason: string
  maintenance?: {
    issue_summary: string
    possible_causes: string[]
    check_steps: string[]
    related_files: string[]
    impact: string[]
  }
}

type ErrorInfo = {
  module: string
  severity: string
  type: string
  time: string
  message?: string
  pipeline_stage?: string
  blocks?: string[]
}

export default function ErrorMaintenancePanel({ 
  errors, 
  modules, 
  selectedModule 
}: { 
  errors: ErrorInfo[]
  modules: Module[]
  selectedModule: string | null 
}) {
  const activeModule = modules?.find(m => m.name === selectedModule)

  const [activeTab, setActiveTab] = useState<'GUIDE' | 'AI_REPAIR'>('GUIDE')
  
  // AI State
  const [aiMarkdown, setAiMarkdown] = useState<string>('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiHistory, setAiHistory] = useState<string[]>([])
  const [reportTime, setReportTime] = useState<string | null>(null)

  useEffect(() => {
    if (activeTab === 'AI_REPAIR' && !aiMarkdown) {
      loadLatestAi()
      loadHistory()
    }
  }, [activeTab])

  const loadLatestAi = async () => {
    try {
      setAiLoading(true)
      const res = await fetch('/api/admin/ai-repair/latest')
      const json = await res.json()
      setAiMarkdown(json.markdown || '')
      setReportTime(json.time || null)
    } finally {
      setAiLoading(false)
    }
  }

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/admin/ai-repair/history')
      const json = await res.json()
      setAiHistory(json.files || [])
    } catch {}
  }

  const runAiDiagnosis = async (mode = 'fast') => {
    try {
      setAiLoading(true)
      setAiMarkdown('AI Diagnosis: RUNNING...')
      const res = await fetch('/api/admin/ai-repair/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      })
      const json = await res.json()
      if (json.error) {
         setAiMarkdown(`Error: ${json.error}`)
      } else {
         setAiMarkdown(json.markdown)
         setReportTime(new Date().toISOString())
         loadHistory()
      }
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <>
      <div className="bg-[#0E131A] border border-[#EA3943]/20 rounded-xl p-5 h-full flex flex-col">
        <div className="border-b border-[#EA3943]/20 pb-3 mb-4 shrink-0">
          <h2 className="text-sm font-bold tracking-widest text-[#EA3943]">ERROR / ANOMALY PANEL</h2>
          <p className="text-[10px] text-[#EA3943]/70 mt-1">Silent failures, schema mismatches & pipeline blockers</p>
        </div>
        
        <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
          {(!errors || errors.length === 0) ? (
            <div className="text-sm text-slate-500 italic p-4 text-center border border-white/5 rounded bg-white/5">
              No recent errors detected
            </div>
          ) : (
            errors.slice(0, 5).map((err, i) => (
              <div key={i} className="flex flex-col gap-1.5 p-3 bg-[#EA3943]/10 border border-[#EA3943]/20 rounded text-sm relative overflow-hidden">
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${err.severity === 'CRITICAL' ? 'bg-[#991B1B]' : 'bg-[#EA3943]'}`} />
                <div className="flex justify-between font-bold pl-2" style={{ color: err.severity === 'CRITICAL' ? '#FCA5A5' : '#EA3943' }}>
                  <div className="flex items-center gap-2">
                    {err.module}
                    {err.severity === 'CRITICAL' && <span className="bg-[#991B1B] text-white text-[8px] px-1.5 py-0.5 rounded">CRIT</span>}
                  </div>
                  <span className="text-xs opacity-75 text-slate-400">{new Date(err.time).toLocaleTimeString()}</span>
                </div>
                
                <div className="text-slate-300 text-xs mt-0.5 pl-2">Type: <span className="font-mono text-slate-400">{err.type}</span></div>
                {err.message && <div className="text-[#EA3943]/80 text-[10px] pl-2">{err.message}</div>}
                
                {err.pipeline_stage && err.blocks && err.blocks.length > 0 && (
                  <div className="mt-1 pl-2 bg-black/40 p-1.5 rounded flex items-center gap-2 overflow-x-auto">
                     <span className="text-[9px] font-bold text-slate-500 bg-white/5 px-1 py-0.5 rounded">[{err.pipeline_stage}]</span>
                     <span className="text-[10px] text-[#F5B700] whitespace-nowrap">
                       Blocks: <span className="font-mono text-slate-300 ml-1">{err.module} &rarr; {err.blocks.join(' \u2192 ')}</span>
                     </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-[#0E131A] border border-[#60A5FA]/20 rounded-xl p-5 h-full flex flex-col">
        <div className="border-b border-[#60A5FA]/20 pb-2 mb-4 shrink-0">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h2 className="text-sm font-bold tracking-widest text-[#60A5FA]">DIAGNOSTICS & REPAIR</h2>
            </div>
            {activeModule && activeTab === 'GUIDE' && (
              <span className={`px-2 py-1 text-[10px] font-bold rounded ${
                activeModule.status === 'RED' ? 'bg-[#EA3943]/20 text-[#EA3943]' :
                activeModule.status === 'YELLOW' ? 'bg-[#F5B700]/20 text-[#F5B700]' :
                'bg-[#16C784]/20 text-[#16C784]'
              }`}>
                {activeModule.name}
              </span>
            )}
          </div>
          
          <div className="flex gap-4">
            <button 
               onClick={() => setActiveTab('GUIDE')}
               className={`text-xs font-bold pb-2 border-b-2 transition ${activeTab === 'GUIDE' ? 'border-[#60A5FA] text-[#60A5FA]' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
            >
              Module Guide
            </button>
            <button 
               onClick={() => setActiveTab('AI_REPAIR')}
               className={`text-xs font-bold pb-2 border-b-2 transition flex items-center gap-1.5 ${activeTab === 'AI_REPAIR' ? 'border-[#C084FC] text-[#C084FC]' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
            >
              🤖 AI Repair
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto w-full">
          {activeTab === 'GUIDE' ? (
            !activeModule ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-sm text-slate-500 border border-white/5 border-dashed rounded bg-white/5">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-2 opacity-50"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                Select a module from the Health Grid to view diagnostic steps
              </div>
            ) : activeModule.status === 'GREEN' ? (
              <div className="p-4 border border-[#16C784]/20 rounded bg-[#16C784]/5 text-[#16C784] text-sm">
                Module <strong>{activeModule.name}</strong> is operating normally. No maintenance required at this point.
              </div>
            ) : (
              <div className="flex flex-col gap-5 bg-black/40 p-4 border border-white/5 rounded-lg w-full">
                {(() => {
                  const guide = activeModule.maintenance
                  if (!guide) return <div className="text-slate-500">No guide available</div>
                  
                  return (
                    <>
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold mb-1 uppercase tracking-wider">Issue Summary</div>
                        <div className="text-sm font-medium" style={{ color: activeModule.status === 'RED' ? '#FCA5A5' : '#FDE047' }}>
                          {guide.issue_summary}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold mb-1 uppercase tracking-wider">Likely Causes</div>
                        <ul className="list-disc pl-4 text-xs text-slate-300 space-y-1">
                          {guide.possible_causes?.map((c, i) => <li key={i}>{c}</li>)}
                        </ul>
                      </div>
                      <div className="bg-[#60A5FA]/10 border border-[#60A5FA]/20 p-3 rounded">
                        <div className="text-[10px] text-[#60A5FA] font-bold mb-2 uppercase tracking-wider">Inspection Steps</div>
                        <ul className="list-decimal pl-4 text-xs text-[#93C5FD] space-y-2 font-mono">
                          {guide.check_steps?.map((c, i) => <li key={i}>{c}</li>)}
                        </ul>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/10">
                        <div>
                          <div className="text-[10px] text-slate-500 font-bold mb-1 uppercase tracking-wider">Related Files</div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {guide.related_files?.map(f => <div key={f} className="truncate" title={f}>{f}</div>)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500 font-bold mb-1 uppercase tracking-wider">Downstream Impact</div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {guide.impact?.map(imp => (
                               <span key={imp} className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono border border-slate-700">
                                 {imp}
                               </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  )
                })()}
              </div>
            )
          ) : (
            // AI REPAIR TAB
            <div className="flex flex-col h-full">
               <div className="flex justify-between items-center mb-4 shrink-0">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => runAiDiagnosis('fast')}
                      disabled={aiLoading}
                      className="px-3 py-1 bg-[#C084FC]/10 hover:bg-[#C084FC]/20 text-[#C084FC] border border-[#C084FC]/30 text-xs font-bold rounded shadow disabled:opacity-50"
                    >
                      Run AI Diagnosis
                    </button>
                    <button 
                      onClick={loadLatestAi}
                      disabled={aiLoading}
                      className="px-3 py-1 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-bold rounded shadow disabled:opacity-50"
                    >
                      Load Latest
                    </button>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-slate-400">STATUS: {aiLoading ? 'RUNNING...' : 'READY'}</div>
                    {reportTime && <div className="text-[10px] text-slate-500 mt-0.5" title={reportTime}>Updated: {new Date(reportTime).toLocaleTimeString()}</div>}
                  </div>
               </div>

               <div className="flex-1 bg-[#070B10] p-4 rounded-lg border border-white/5 overflow-y-auto">
                 {aiMarkdown ? (
                   <div className="text-slate-300 text-sm">
                     <ReactMarkdown
                       components={{
                         h1: ({node, ...props}) => <h1 className="text-xl font-bold text-white mt-4 mb-2" {...props} />,
                         h2: ({node, ...props}) => <h2 className="text-lg font-bold text-[#60A5FA] mt-4 mb-2 pb-1 border-b border-white/10" {...props} />,
                         h3: ({node, ...props}) => <h3 className="text-base font-bold text-slate-200 mt-3 mb-1" {...props} />,
                         p: ({node, ...props}) => <p className="mb-3 leading-relaxed" {...props} />,
                         ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-3 space-y-1 text-slate-300" {...props} />,
                         ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-3 space-y-1 text-slate-300" {...props} />,
                         li: ({node, ...props}) => <li {...props} />,
                         strong: ({node, ...props}) => <strong className="font-bold text-white" {...props} />,
                         code: ({node, ...props}) => <code className="bg-black/40 text-[#FCA5A5] px-1.5 py-0.5 rounded text-xs font-mono" {...props} />,
                       }}
                     >
                       {aiMarkdown}
                     </ReactMarkdown>
                   </div>
                 ) : (
                   <div className="text-slate-500 italic text-sm text-center py-10">
                     No AI diagnosis available. Click "Run AI Diagnosis" to analyze system payload.
                   </div>
                 )}
               </div>

               {aiHistory?.length > 0 && (
                 <div className="mt-4 shrink-0">
                   <div className="text-[10px] font-bold text-slate-500 mb-1">HISTORY (Max 5 shown)</div>
                   <div className="flex gap-2 text-xs font-mono">
                     {aiHistory.slice(0, 5).map(f => (
                       <span key={f} className="bg-black/40 px-2 py-1 border border-white/5 rounded text-slate-400 truncate">
                         {f.replace('ai_repair_','').replace('.md','')}
                       </span>
                     ))}
                   </div>
                 </div>
               )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
