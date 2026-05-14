'use client'
// 섹터 RS 13-종목 멀티라인 차트 카드 — Card 2 (PULSE 탭)
import { useState, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { SectorRSTimeSeries, BucketRSSeries, SectorTrend } from '@/lib/semiconductor/types'

const UI_FONT   = "'IBM Plex Sans', sans-serif"
const DATA_FONT = "'IBM Plex Mono', monospace"

const TREND_LABEL: Record<SectorTrend, string> = {
  acceleration: '🔥 가속',
  emerging:     '⬆️ 부상',
  neutral:      '◦ 박스권',
  fading:       '↩️ 꺾임',
  weakening:    '📉 약세',
}

const TREND_ORDER: SectorTrend[] = ['acceleration', 'emerging', 'neutral', 'fading', 'weakening']

// ── 라인 스타일 시스템 ──────────────────────────────────────
interface LineStyle {
  stroke: string
  strokeWidth: number
  strokeDasharray?: string
  strokeOpacity: number
}

// Top 3: 초록(solid) → 시안(dashed) → 바이올렛(dotted)
const TOP_STYLES: LineStyle[] = [
  { stroke: '#22c55e', strokeWidth: 2.5, strokeOpacity: 1 },
  { stroke: '#22d3ee', strokeWidth: 2.0, strokeDasharray: '6 3', strokeOpacity: 1 },
  { stroke: '#a78bfa', strokeWidth: 2.0, strokeDasharray: '3 3', strokeOpacity: 1 },
]
// Bottom 3: 빨강(solid) → 연빨강(dashed) → 핑크(dotted)
const BOT_STYLES: LineStyle[] = [
  { stroke: '#ef4444', strokeWidth: 2.5, strokeOpacity: 1 },
  { stroke: '#f87171', strokeWidth: 2.0, strokeDasharray: '6 3', strokeOpacity: 1 },
  { stroke: '#fca5a5', strokeWidth: 1.5, strokeDasharray: '3 3', strokeOpacity: 1 },
]
// Middle: dim 회색
const MID_STYLE: LineStyle = { stroke: '#334155', strokeWidth: 1, strokeOpacity: 0.35 }

function getLineStyle(rank: number, total: number): LineStyle {
  if (rank < 3)              return TOP_STYLES[rank]
  if (rank >= total - 3)     return BOT_STYLES[total - 1 - rank]
  return MID_STYLE
}

// ── 차트 데이터 빌더 ───────────────────────────────────────
function buildChartData(buckets: BucketRSSeries[]) {
  if (!buckets.length) return []
  const dateMap = new Map<string, Record<string, number>>()
  for (const b of buckets) {
    for (const pt of b.series) {
      if (!dateMap.has(pt.date)) dateMap.set(pt.date, {})
      dateMap.get(pt.date)![b.bucket_id] = pt.rs_vs_soxx
    }
  }
  return [...dateMap.keys()].sort().map(date => ({ date, ...dateMap.get(date)! }))
}

function fmtDate(d: string) { return d.slice(5).replace('-', '/') }
function fmtPP(v: number)   { return `${v >= 0 ? '+' : ''}${v.toFixed(1)}pp` }

// ── SVG 라인 범례 아이콘 ───────────────────────────────────
function LineIcon({ stroke, strokeDasharray }: { stroke: string; strokeDasharray?: string }) {
  return (
    <svg width={22} height={8} viewBox="0 0 22 8" style={{ flexShrink: 0 }}>
      <line x1={0} y1={4} x2={22} y2={4} stroke={stroke} strokeWidth={2} strokeDasharray={strokeDasharray} />
    </svg>
  )
}

// ── Props ─────────────────────────────────────────────────
interface Props {
  data: SectorRSTimeSeries
  onBucketClick?: (bucketId: string) => void
}

export default function PulseSectorCard({ data, onBucketClick }: Props) {
  const [hovered, setHovered] = useState<string | null>(null)
  const handleLineEnter = useCallback((id: string) => setHovered(id), [])
  const handleLineLeave = useCallback(() => setHovered(null), [])

  const { buckets, missing_buckets } = data

  // RS 기준 내림차순 정렬 → 랭크 맵
  const sortedBuckets = [...buckets].sort((a, b) => b.rs_90d - a.rs_90d)
  const rankMap  = new Map(sortedBuckets.map((b, i) => [b.bucket_id, i]))
  const labelMap = new Map(buckets.map(b => [b.bucket_id, b.bucket_label]))
  const total    = sortedBuckets.length

  const chartData = buildChartData(buckets)
  const allDates  = chartData.map(d => d.date)
  const tickDates = allDates.filter((_, i) => i % Math.max(1, Math.floor(allDates.length / 5)) === 0)

  const allValues = buckets.flatMap(b => b.series.map(p => p.rs_vs_soxx))
  const yMin = Math.floor(Math.min(...allValues, 0) / 10) * 10 - 5
  const yMax = Math.ceil(Math.max(...allValues, 0)  / 10) * 10 + 5

  const groups: Partial<Record<SectorTrend, BucketRSSeries[]>> = {}
  for (const b of buckets) {
    if (!groups[b.trend]) groups[b.trend] = []
    groups[b.trend]!.push(b)
  }

  return (
    <div style={{ background: '#0d0d12', border: '1px solid #1e293b', borderRadius: 8, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── 헤더 ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, color: '#cbd5e1', fontFamily: UI_FONT, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 6 }}>
            SECTOR RS — 13-STOCK MULTI-LINE
          </div>
          <div style={{ fontSize: 13, fontFamily: UI_FONT, color: '#f3f4f6' }}>
            SOXX 대비 90일 상대강도
          </div>
        </div>
        <div style={{ fontSize: 11, fontFamily: DATA_FONT, color: '#94a3b8', textAlign: 'right' }}>
          {buckets.length}/13 종목
          {missing_buckets.length > 0 && (
            <div style={{ marginTop: 2 }}>{missing_buckets.length}개 제외</div>
          )}
        </div>
      </div>

      {/* ── Top 3 / Bottom 3 인라인 범례 ── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {sortedBuckets.slice(0, Math.min(3, total)).map((b, i) => {
          const s = TOP_STYLES[i]
          return (
            <div key={b.bucket_id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <LineIcon stroke={s.stroke} strokeDasharray={s.strokeDasharray} />
              <span style={{ fontSize: 12, fontFamily: UI_FONT, color: '#f3f4f6' }}>{b.bucket_label}</span>
              <span style={{ fontSize: 12, fontFamily: DATA_FONT, color: s.stroke }}>{fmtPP(b.rs_90d)}</span>
            </div>
          )
        })}
        <div style={{ width: 1, height: 14, background: '#1e293b', margin: '0 4px' }} />
        {[...sortedBuckets].slice(-Math.min(3, total)).reverse().map((b, i) => {
          const s = BOT_STYLES[i]
          return (
            <div key={b.bucket_id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <LineIcon stroke={s.stroke} strokeDasharray={s.strokeDasharray} />
              <span style={{ fontSize: 12, fontFamily: UI_FONT, color: '#f3f4f6' }}>{b.bucket_label}</span>
              <span style={{ fontSize: 12, fontFamily: DATA_FONT, color: s.stroke }}>{fmtPP(b.rs_90d)}</span>
            </div>
          )
        })}
      </div>

      {/* ── 멀티라인 차트 ── */}
      <div style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" strokeWidth={0.5} vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: DATA_FONT }}
              tickLine={false}
              axisLine={{ stroke: '#1e293b' }}
              tickFormatter={fmtDate}
              ticks={tickDates}
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: DATA_FONT }}
              tickLine={false}
              axisLine={false}
              width={38}
              tickFormatter={v => `${v > 0 ? '+' : ''}${v}pp`}
            />
            <Tooltip content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              type P = { dataKey?: string | number; value?: unknown; color?: string }
              const valid = (payload as P[]).filter(
                (p): p is { dataKey: string; value: number; color: string } =>
                  typeof p.dataKey === 'string' && typeof p.value === 'number'
              )
              const ranked = valid.slice().sort((a, b) => b.value - a.value)
              const shown = hovered
                ? valid.filter(p => p.dataKey === hovered)
                : [
                    ...ranked.slice(0, Math.min(3, ranked.length)),
                    ...ranked.slice(-Math.min(3, ranked.length)),
                  ].filter((p, idx, arr) => arr.findIndex(x => x.dataKey === p.dataKey) === idx)
              if (!shown.length) return null
              return (
                <div style={{ background: '#0f1117', border: '1px solid #1e293b', borderRadius: 6, padding: '8px 12px', minWidth: 200 }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: DATA_FONT, marginBottom: 6 }}>
                    {fmtDate(String(label ?? ''))}
                  </div>
                  {shown.map(p => {
                    const rank = rankMap.get(p.dataKey) ?? 5
                    const style = getLineStyle(rank, total)
                    return (
                      <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginBottom: 3 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <LineIcon stroke={style.stroke} strokeDasharray={style.strokeDasharray} />
                          <span style={{ fontSize: 12, fontFamily: UI_FONT, color: '#cbd5e1' }}>
                            {labelMap.get(p.dataKey) ?? p.dataKey}
                          </span>
                        </div>
                        <span style={{ fontSize: 13, fontFamily: DATA_FONT, color: style.stroke }}>
                          {fmtPP(p.value)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )
            }} />
            <ReferenceLine y={0} stroke="#334155" strokeWidth={1.5} />
            {buckets.map(b => {
              const rank  = rankMap.get(b.bucket_id) ?? 5
              const style = getLineStyle(rank, total)
              const isHov   = hovered === b.bucket_id
              const isOther = hovered !== null && !isHov
              const isKey   = rank < 3 || rank >= total - 3
              return (
                <Line
                  key={b.bucket_id}
                  type="monotone"
                  dataKey={b.bucket_id}
                  stroke={style.stroke}
                  strokeWidth={isHov ? style.strokeWidth + 1 : style.strokeWidth}
                  strokeOpacity={isOther ? style.strokeOpacity * 0.12 : style.strokeOpacity}
                  strokeDasharray={style.strokeDasharray}
                  dot={false}
                  activeDot={{ r: isHov ? 5 : (isKey ? 3 : 0) }}
                  onMouseEnter={() => handleLineEnter(b.bucket_id)}
                  onMouseLeave={handleLineLeave}
                />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── 트렌드 분류 그룹 ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {TREND_ORDER.map(trend => {
          const group = groups[trend]
          if (!group?.length) return null
          return (
            <div key={trend} style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontFamily: UI_FONT, color: '#cbd5e1', whiteSpace: 'nowrap', minWidth: 72 }}>
                {TREND_LABEL[trend]}
              </span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {group.map(b => {
                  const rank  = rankMap.get(b.bucket_id) ?? 5
                  const style = getLineStyle(rank, total)
                  return (
                    <button
                      key={b.bucket_id}
                      onClick={() => onBucketClick?.(b.bucket_id)}
                      onMouseEnter={() => handleLineEnter(b.bucket_id)}
                      onMouseLeave={handleLineLeave}
                      style={{
                        background: 'transparent',
                        border: `1px solid ${style.stroke}35`,
                        borderRadius: 4,
                        padding: '2px 8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <LineIcon stroke={style.stroke} strokeDasharray={style.strokeDasharray} />
                      <span style={{ fontSize: 13, fontFamily: UI_FONT, color: '#f3f4f6' }}>
                        {b.bucket_label}
                      </span>
                      <span style={{ fontSize: 13, fontFamily: DATA_FONT, color: style.stroke }}>
                        {fmtPP(b.rs_90d)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── 맥락 메모 ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 8, borderTop: '1px solid #1e293b20' }}>
        <div style={{ fontSize: 12, fontFamily: UI_FONT, color: '#94a3b8' }}>
          RS = SOXX 대비 상대 강도. 절대 수익률과 다름. (예: NVDA 약세 = SOXX보다 덜 올랐다는 의미)
        </div>
        {missing_buckets.length > 0 && (
          <div style={{ fontSize: 12, fontFamily: UI_FONT, color: '#94a3b8' }}>
            데이터 준비 중: {['Cooling', 'PCB Substrate', 'Cleanroom Water'].filter((_, i) =>
              missing_buckets.some(id => ['COOLING', 'PCB_SUBSTRATE', 'CLEANROOM_WATER'][i] === id)
            ).join(' / ')}
          </div>
        )}
      </div>
    </div>
  )
}
