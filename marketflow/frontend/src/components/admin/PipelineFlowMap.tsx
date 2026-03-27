import React from 'react'

const C = {
  GREEN: '#16C784',
  YELLOW: '#F5B700',
  RED: '#EA3943',
  GRAY: '#6B7280'
}

type NodeGroup = {
  id: string
  label: string
  nodes: { name: string, label: string }[]
}

const FLOW: NodeGroup[] = [
  { id: 'data', label: 'DATA', nodes: [{ name: 'price_feed', label: 'Price' }, { name: 'fred_macro', label: 'Macro' }, { name: 'volatility_feed', label: 'Vol' }] },
  { id: 'build', label: 'BUILD', nodes: [{ name: 'snapshot_build', label: 'Snapshot' }, { name: 'macro_build', label: 'Macro Build' }] },
  { id: 'engine', label: 'ENGINE', nodes: [{ name: 'risk_build', label: 'Risk v1' }] },
  { id: 'vr', label: 'VR', nodes: [{ name: 'vr_build', label: 'VR Survive' }] },
  { id: 'ai', label: 'AI', nodes: [{ name: 'brief_build', label: 'Brief' }, { name: 'claude', label: 'Claude/GPT' }] },
  { id: 'front', label: 'FRONTEND', nodes: [{ name: 'overview.json', label: 'Dashboard' }] }
]

export default function PipelineFlowMap({ pipeline }: { pipeline: any[] }) {
  // Simplified flow map based on requested nodes
  return (
    <section className="bg-[#0E131A] border border-white/5 rounded-xl p-5">
      <div className="flex justify-between items-center border-b border-white/5 pb-3 mb-5">
        <h2 className="text-sm font-bold tracking-widest text-[#D8E6F5]">PIPELINE FLOW MAP</h2>
        <div className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded">Main Pipeline: {pipeline?.[0]?.status || 'GRAY'}</div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch justify-between gap-4 sm:gap-2">
        {FLOW.map((group, idx) => (
          <React.Fragment key={group.id}>
            {/* Group Box */}
            <div className="flex-1 flex flex-col items-center p-3 bg-white/5 border border-white/5 rounded-lg min-w-0">
              <div className="text-[10px] font-black text-slate-500 mb-3">{group.label}</div>
              <div className="flex flex-col gap-2 w-full">
                {group.nodes.map(node => (
                  <div key={node.name} className="flex justify-between items-center bg-[#070B10] px-2 py-1.5 rounded border border-white/5 text-xs truncate">
                    <span className="text-slate-300 truncate" title={node.label}>{node.label}</span>
                    <span className="w-2 h-2 rounded-full min-w-[8px]" style={{ backgroundColor: C.GREEN }}></span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Arrow */}
            {idx < FLOW.length - 1 && (
              <div className="hidden sm:flex flex-col justify-center text-slate-500">
                <svg width="16" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </section>
  )
}
