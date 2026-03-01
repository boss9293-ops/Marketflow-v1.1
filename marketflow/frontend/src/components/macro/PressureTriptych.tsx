'use client'

import { HalfGauge } from '@/components/macro/PressureBar'

type LevelKey = 'safe' | 'neutral' | 'watch' | 'risk'

function levelFrom(value: number): LevelKey {
  if (value >= 85) return 'risk'
  if (value >= 66) return 'watch'
  if (value >= 33) return 'neutral'
  return 'safe'
}

function badgeClass(level: LevelKey) {
  if (level === 'risk') return 'border-rose-500/30 text-rose-200 bg-rose-500/10'
  if (level === 'watch') return 'border-amber-500/30 text-amber-200 bg-amber-500/10'
  if (level === 'neutral') return 'border-yellow-500/30 text-yellow-200 bg-yellow-500/10'
  return 'border-emerald-500/30 text-emerald-200 bg-emerald-500/10'
}

function levelLabel(level: LevelKey, mode: 'ko' | 'en') {
  if (mode === 'en') {
    if (level === 'risk') return 'Risk'
    if (level === 'watch') return 'Watch'
    if (level === 'neutral') return 'Neutral'
    return 'Stable'
  }
  if (level === 'risk') return '위험'
  if (level === 'watch') return '경계'
  if (level === 'neutral') return '중립'
  return '안정'
}

function ItemCard({
  label,
  leftText,
  rightText,
  value,
  mode,
}: {
  label: string
  leftText: string
  rightText: string
  value: number
  mode: 'ko' | 'en'
}) {
  const level = levelFrom(value)
  return (
    <div className="rounded-xl border border-white/10 bg-[#16181c] px-4 py-3 min-h-[132px]">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xl font-bold text-slate-100 leading-tight">{label}</div>
        <span className={`px-2.5 py-0.5 rounded-full text-xs border ${badgeClass(level)}`}>{levelLabel(level, mode)}</span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-3xl font-extrabold text-white leading-none">{Math.round(Math.max(0, Math.min(100, value)))}</div>
          <div className="mt-1 text-xs text-slate-400 font-medium">/ 100</div>
        </div>
        <HalfGauge value={value} size={86} />
      </div>
      <div className="mt-1 flex items-center justify-between text-sm text-slate-400">
        <span>{leftText}</span>
        <span>{rightText}</span>
      </div>
    </div>
  )
}

export default function PressureTriptych({
  mode,
  lpi,
  rpi,
  risk,
}: {
  mode: 'ko' | 'en'
  lpi: number
  rpi: number
  risk: number
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#15171b] p-4 space-y-3">
      <div className="text-2xl font-extrabold text-slate-100 tracking-tight">{mode === 'ko' ? '압박계' : 'Pressure'}</div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <ItemCard label={mode === 'ko' ? '🧊 유동성' : '🧊 Liquidity'} leftText={mode === 'ko' ? '완화' : 'Ease'} rightText={mode === 'ko' ? '압박' : 'Pressure'} value={lpi} mode={mode} />
        <ItemCard label={mode === 'ko' ? '🏦 금리 압박' : '🏦 Rates'} leftText={mode === 'ko' ? '완화' : 'Ease'} rightText={mode === 'ko' ? '압박' : 'Pressure'} value={rpi} mode={mode} />
        <ItemCard label={mode === 'ko' ? '🌪 리스크(변동성/신용)' : '🌪 Risk (Vol/Credit)'} leftText={mode === 'ko' ? '안정' : 'Stable'} rightText={mode === 'ko' ? '스트레스' : 'Stress'} value={risk} mode={mode} />
      </div>
    </div>
  )
}
