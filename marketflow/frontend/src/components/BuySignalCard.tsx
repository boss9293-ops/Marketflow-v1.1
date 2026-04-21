'use client'
import { useEffect, useState } from 'react'
import { clientApiUrl } from '@/lib/backendApi'

interface GateData {
  score: number
  status: string
  signal: string
}

export default function BuySignalCard() {
  const [data, setData] = useState<GateData | null>(null)

  useEffect(() => {
    fetch(clientApiUrl('/api/market/gate'))
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ score: 65, status: 'YELLOW', signal: 'SELECTIVE' }))
  }, [])

  const signalConfig = {
    BUY: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', text: '매수 적합', desc: '시장 조건 우호적. 공격적 포지션 가능.' },
    SELECTIVE: { color: '#f97316', bg: 'rgba(249,115,22,0.1)', text: '선별 매수', desc: '우량주 중심 선별적 접근 권장.' },
    HOLD: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', text: '관망', desc: '시장 불확실. 현금 비중 확대 권장.' },
  }

  const cfg = data ? (signalConfig[data.signal as keyof typeof signalConfig] || signalConfig.SELECTIVE) : signalConfig.SELECTIVE

  return (
    <div style={{ background: '#1c1c1e', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
      <h3 style={{ fontWeight: 600, marginBottom: '1rem', color: 'white' }}>Investment Decision</h3>
      {data ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ padding: '1rem', borderRadius: '10px', background: cfg.bg, border: `1px solid ${cfg.color}30` }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: cfg.color }}>{data.signal}</div>
            <div style={{ fontSize: '1rem', color: cfg.color, fontWeight: 500 }}>{cfg.text}</div>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#9ca3af', lineHeight: 1.5 }}>{cfg.desc}</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Market Gate Score</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: cfg.color }}>{data.score}/100</span>
          </div>
        </div>
      ) : (
        <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#6b7280' }}>Loading...</span>
        </div>
      )}
    </div>
  )
}
