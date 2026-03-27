'use client'

import { useEffect, useState } from 'react'
import MasterStatusPanel from '@/components/admin/MasterStatusPanel'
import ModuleGrid from '@/components/admin/ModuleGrid'
import PipelineFlowMap from '@/components/admin/PipelineFlowMap'
import StaleBoard from '@/components/admin/StaleBoard'
import ErrorMaintenancePanel from '@/components/admin/ErrorMaintenancePanel'

export default function AdminServicePage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const [selectedModule, setSelectedModule] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      const res = await fetch('/api/admin/system-status')
      const json = await res.json()
      setData(json)
      setLastFetch(new Date())
    } catch (err) {
      console.error('Failed to fetch system status', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000) // Poll every 30s
    return () => clearInterval(interval)
  }, [])

  const runPipeline = async (step: string) => {
    if (!confirm(`Are you sure you want to run pipeline step: ${step.toUpperCase()}?`)) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/admin/pipeline/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step })
      })
      const result = await res.json()
      setTimeout(() => {
        fetchData()
        setActionLoading(false)
      }, 2500)
    } catch (err) {
      alert('Failed to trigger pipeline')
      setActionLoading(false)
    }
  }

  const retryFailed = async () => {
    if (!data?.modules) return
    const failed = data.modules.filter((m: any) => m.status === 'RED' || m.status === 'YELLOW').map((m: any) => m.name)
    if (failed.length === 0) {
      alert('No failed modules to retry.')
      return
    }
    if (!confirm(`Retry ${failed.length} modules?`)) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/admin/pipeline/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ failed_modules: failed })
      })
      const result = await res.json()
      setTimeout(() => {
        fetchData()
        setActionLoading(false)
      }, 2500)
    } catch (err) {
      alert('Failed to trigger retry.')
      setActionLoading(false)
    }
  }

  if (loading && !data) {
    return <div className="p-8 text-slate-300">Loading Configuration...</div>
  }

  if (!data || data.error) {
    return <div className="p-8 text-[#EA3943]">Failed to load system data. {data?.error}</div>
  }

  const { system, pipeline, modules, errors } = data

  const handleModuleSelect = (name: string) => {
    setSelectedModule(name)
  }

  return (
    <div className="min-h-screen bg-[#0B0F14] text-slate-200 p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-[1600px] mx-auto flex flex-col gap-6">
        
        {/* TOP: Header & Exec Controls */}
        <header className="flex justify-between items-end mb-2">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Service Mode</h1>
            <p className="text-slate-400 text-sm mt-1">Pipeline & Module Administration (Operations Console)</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-[10px] text-slate-500 font-mono">Last Sync: {lastFetch?.toLocaleTimeString()}</div>
            <div className="flex gap-2">
              <button 
                onClick={() => retryFailed()}
                disabled={actionLoading}
                className="px-4 py-1.5 bg-[#F5B700]/10 hover:bg-[#F5B700]/20 text-[#F5B700] border border-[#F5B700]/30 text-xs font-bold rounded shadow disabled:opacity-50 transition"
              >
                {actionLoading ? 'Triggering...' : 'Retry Failed'}
              </button>
              <button 
                onClick={() => runPipeline('risk')}
                disabled={actionLoading}
                className="px-4 py-1.5 bg-[#EA3943]/10 hover:bg-[#EA3943]/20 text-[#FCA5A5] border border-[#EA3943]/30 text-xs font-bold rounded shadow disabled:opacity-50 transition"
              >
                Run Risk
              </button>
              <button 
                onClick={() => runPipeline('vr')}
                disabled={actionLoading}
                className="px-4 py-1.5 bg-[#60A5FA]/10 hover:bg-[#60A5FA]/20 text-[#60A5FA] border border-[#60A5FA]/30 text-xs font-bold rounded shadow disabled:opacity-50 transition"
              >
                Run VR
              </button>
              <button 
                onClick={() => runPipeline('full')}
                disabled={actionLoading}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 border border-white/10 text-xs font-bold rounded shadow disabled:opacity-50 transition"
              >
                Run Full
              </button>
              <button 
                onClick={fetchData}
                disabled={actionLoading}
                title="Force UI Refresh"
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded transition"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
              </button>
            </div>
          </div>
        </header>

        <MasterStatusPanel system={system} />

        {/* MID: Pipeline Flow & Module Grid */}
        <section className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6">
          <div className="flex flex-col gap-6">
            <PipelineFlowMap pipeline={pipeline} />
            <ModuleGrid modules={modules} onSelectModule={handleModuleSelect} selectedModule={selectedModule} />
          </div>
          
          {/* BOTTOM-RIGHT: Stale Data Board */}
          <div>
            <StaleBoard modules={modules} />
          </div>
        </section>

        {/* BOTTOM: Error & Maintenance Panel */}
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <ErrorMaintenancePanel errors={errors} modules={modules} selectedModule={selectedModule} />
        </section>

      </div>
    </div>
  )
}
