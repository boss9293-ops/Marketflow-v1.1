'use client'
// A-5: Education Layer — Beginner / Advanced toggle
import { useState } from 'react'


interface Props {
  beginner: string
  advanced: string
}

const UI_FONT = "'Inter', 'Pretendard', sans-serif";
const DATA_FONT = "'JetBrains Mono', 'Roboto Mono', monospace";

export default function EducationLayer({ beginner, advanced }: Props) {
  const [mode, setMode] = useState<'BEGINNER' | 'ADVANCED'>('BEGINNER')

  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8,
                  padding: '14px 18px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: '#64748b', letterSpacing: 2 }}>WHAT THIS MEANS</div>
        <div style={{ display: 'flex', gap: 0 }}>
          {(['BEGINNER', 'ADVANCED'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              style={{ padding: '3px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                       border: '1px solid #334155', background: mode === m ? '#1e293b' : 'transparent',
                       color: mode === m ? '#e2e8f0' : '#64748b',
                       borderRadius: m === 'BEGINNER' ? '4px 0 0 4px' : '0 4px 4px 0' }}>
              {m}
            </button>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
        {mode === 'BEGINNER' ? beginner : advanced}
      </div>
    </div>
  )
}
