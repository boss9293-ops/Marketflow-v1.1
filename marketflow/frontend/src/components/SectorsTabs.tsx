'use client'

import { useState } from 'react'
import RotationPicks from '@/components/RotationPicks'
import SectorHeatmap from '@/components/SectorHeatmap'
import RRGChart from '@/components/RRGChart'
import SectorRotation from '@/components/SectorRotation'

type TabKey = 'overview' | 'groups'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'groups', label: 'Groups' },
]

function tabButtonStyle(active: boolean) {
  return {
    padding: '0.45rem 0.9rem',
    borderRadius: 8,
    border: active ? '1px solid rgba(0,217,255,0.45)' : '1px solid rgba(255,255,255,0.12)',
    background: active ? 'rgba(0,217,255,0.14)' : 'rgba(255,255,255,0.04)',
    color: active ? '#67e8f9' : '#9ca3af',
    fontSize: '0.76rem',
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
  } as const
}

function panelStyle() {
  return {
    background: '#1c1c1e',
    borderRadius: '12px',
    padding: '1.5rem',
    border: '1px solid rgba(255,255,255,0.05)',
  } as const
}

export default function SectorsTabs() {
  const [tab, setTab] = useState<TabKey>('overview')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={tabButtonStyle(tab === t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={panelStyle()}>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '1.22rem', fontWeight: 800, color: '#F5FAFF' }}>
                Sector Rotation <span style={{ color: '#00D9FF' }}>Picks</span>
              </div>
              <div style={{ fontSize: '0.92rem', color: '#B9C9DD', marginTop: 4, fontWeight: 500 }}>
                경기 국면별 순환매 강세 종목 발굴
              </div>
            </div>
            <RotationPicks />
          </div>

          <div style={panelStyle()}>
            <SectorHeatmap />
          </div>
          <div style={panelStyle()}>
            <RRGChart />
          </div>
        </div>
      )}

      {tab === 'groups' && (
        <div style={panelStyle()}>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'white' }}>
              Sector <span style={{ color: '#00D9FF' }}>Groups</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 2 }}>
              1일 · 1주 · 1개월 섹터별 수익률 비교
            </div>
          </div>
          <SectorRotation />
        </div>
      )}
    </div>
  )
}
