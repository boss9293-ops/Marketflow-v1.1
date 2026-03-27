'use client'

import type { UiLang } from '@/lib/uiLang'
import { pickLang } from '@/lib/uiLang'
import { useState } from 'react'

export default function RiskV1RefreshButton({ uiLang }: { uiLang: UiLang }) {
  const [status, setStatus] = useState<'idle' | 'running' | 'error'>('idle')

  const onRefresh = async () => {
    if (status === 'running') return
    setStatus('running')
    try {
      const res = await fetch('/api/risk-v1/refresh', { method: 'POST' })
      if (!res.ok) throw new Error(`refresh failed: ${res.status}`)
      window.location.reload()
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 2500)
    }
  }

  return (
    <button
      onClick={onRefresh}
      style={{
        fontSize: '0.85rem',
        color: status === 'error' ? '#fca5a5' : '#9ca3af',
        textDecoration: 'none',
        padding: '0.39rem 0.91rem',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        background: status === 'running' ? 'rgba(99,102,241,0.12)' : 'transparent',
        cursor: status === 'running' ? 'not-allowed' : 'pointer',
      }}
      title={pickLang(uiLang, 'risk_v1 새로고침 실행', 'Run risk_v1 refresh')}
    >
      {status === 'running' ? pickLang(uiLang, '새로고침 중...', 'Refreshing...') : pickLang(uiLang, '새로고침', 'Refresh')}
    </button>
  )
}
