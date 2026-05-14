'use client'
// PULSE 탭 — Cycle Score / 섹터 RS / AI-Legacy Decay 3카드 시계열 뷰
import { useState, useEffect } from 'react'
import type { SemiconductorOutput } from '@/lib/semiconductor/types'
import { buildPulseConclusion } from '@/lib/semiconductor/v2/buildPulseConclusion'
import PulseCycleCard  from './PulseCycleCard'
import PulseSectorCard from './PulseSectorCard'
import PulseSoxlCard   from './PulseSoxlCard'

const UI_FONT   = "'IBM Plex Sans', sans-serif"
const DATA_FONT = "'IBM Plex Mono', monospace"

export default function SemiconductorPulseTab() {
  const [data,    setData]    = useState<SemiconductorOutput | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    fetch('/api/semiconductor')
      .then(r => r.ok ? r.json() as Promise<SemiconductorOutput> : Promise.reject(r.status))
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#060608' }}>
        <div style={{ fontSize: 13, fontFamily: UI_FONT, color: '#475569', letterSpacing: '0.08em' }}>
          LOADING PULSE DATA…
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#060608' }}>
        <div style={{ fontSize: 13, fontFamily: UI_FONT, color: '#ef4444' }}>
          데이터 로드 실패 — /api/semiconductor 응답 없음
        </div>
      </div>
    )
  }

  const cycle  = data.cycle_score_time_series
  const layer  = data.layer_time_series
  const decay  = data.decay_time_series
  const conclusion = buildPulseConclusion(cycle, layer, decay)

  const hasCycle = cycle && cycle.series.length >= 3
  const hasLayer = layer && layer.series.length >= 3
  const hasDecay = decay && decay.series.length >= 3
  const hasSoxl  = hasLayer && hasDecay

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#060608', overflow: 'auto' }}>
      {/* Conclusion bar */}
      <div style={{
        borderBottom: '1px solid #1e293b',
        background: '#0a0a0f',
        padding: '14px 40px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 11, fontFamily: UI_FONT, color: '#cbd5e1', letterSpacing: '0.10em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          PULSE
        </div>
        <div style={{ width: 1, height: 16, background: '#1e293b' }} />
        <div style={{ fontSize: 14, fontFamily: DATA_FONT, color: '#f3f4f6', lineHeight: 1.4 }}>
          {conclusion}
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 11, fontFamily: DATA_FONT, color: '#94a3b8' }}>
          {data.as_of}
        </div>
      </div>

      {/* 3-card grid */}
      <div style={{ flex: 1, padding: '20px 40px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* Card 1: Cycle Score */}
        {hasCycle
          ? <PulseCycleCard data={cycle} />
          : <EmptyCard label="CYCLE SCORE — 90 DAYS" reason="cycle_score_history 데이터 없음" />
        }

        {/* Card 2: Sector RS multi-line */}
        {data.sector_rs_time_series && data.sector_rs_time_series.buckets.length >= 2
          ? <PulseSectorCard data={data.sector_rs_time_series} onBucketClick={() => {}} />
          : <EmptyCard label="SECTOR RS — 13-STOCK MULTI-LINE" reason="ohlcv_daily 데이터 없음" />
        }

        {/* Card 3: AI vs Legacy + Decay */}
        {hasSoxl
          ? <PulseSoxlCard layerData={layer!} decayData={decay!} />
          : <EmptyCard label="AI vs LEGACY / SOXL DECAY" reason="버킷 가격 캐시 없음" />
        }
      </div>
    </div>
  )
}

function EmptyCard({ label, reason }: { label: string; reason: string }) {
  return (
    <div style={{ background: '#0d0d12', border: '1px solid #1e293b', borderRadius: 8, padding: '16px 18px', minHeight: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 11, color: '#cbd5e1', fontFamily: UI_FONT, letterSpacing: '0.10em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <div style={{ fontSize: 13, fontFamily: UI_FONT, color: '#94a3b8' }}>{reason}</div>
      </div>
    </div>
  )
}
