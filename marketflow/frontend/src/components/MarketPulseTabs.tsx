'use client'

import React, { useState } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type TapeItem = {
  symbol:   string
  name:     string
  last:     number
  chg:      number
  chg_pct:  number
  spark_1d: number[]
}

type Props = { items: TapeItem[] }

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const rng = max - min || 1
  const W = 60, H = 28
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / rng) * H}`)
    .join(' ')
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      <polyline
        points={pts}
        fill="none"
        stroke={positive ? '#22c55e' : '#ef4444'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ── Categories ────────────────────────────────────────────────────────────────

const TABS = ['Indices', 'Bonds & FX', 'Alts'] as const
type Tab = typeof TABS[number]

const CATEGORY_SYMBOLS: Record<Tab, string[]> = {
  'Indices':    ['SPY', 'QQQ', 'DIA', 'IWM'],
  'Bonds & FX': ['US10Y', 'US5Y', 'DXY'],
  'Alts':       ['VIX', 'GOLD', 'BTCUSD'],
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MarketPulseTabs({ items }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('Indices')

  const visibleSymbols = CATEGORY_SYMBOLS[activeTab]
  const visibleItems = visibleSymbols
    .map(sym => items.find(i => i.symbol === sym))
    .filter((i): i is TapeItem => !!i)

  // If a category is empty, show all items
  const displayItems = visibleItems.length > 0 ? visibleItems : items.filter(i => i.symbol !== 'VIX')

  return (
    <section className="mt-8">
      {/* Section header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Market Pulse</h2>

        {/* Tab buttons */}
        <div className="flex gap-2">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                activeTab === tab
                  ? 'bg-white text-black'
                  : 'bg-[#1a1a1a] text-gray-400 hover:text-white border border-[#2a2a2a]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {displayItems.map(item => {
          const up = item.chg_pct >= 0
          const isVix = item.symbol === 'VIX'
          // VIX is inverted — going up is bad (red)
          const bullish = isVix ? !up : up

          return (
            <div
              key={item.symbol}
              className="bg-[#1a1a1a] rounded-xl p-5 border border-[#2a2a2a] hover:border-[#c4ff0d] transition-colors duration-300"
            >
              {/* Symbol row */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-gray-400">{item.symbol}</span>
                {up ? (
                  <TrendingUp className={`w-4 h-4 ${bullish ? 'text-green-500' : 'text-red-500'}`} />
                ) : (
                  <TrendingDown className={`w-4 h-4 ${bullish ? 'text-green-500' : 'text-red-500'}`} />
                )}
              </div>

              {/* Price */}
              <div className="text-xl font-bold mb-0.5">
                {item.last.toLocaleString('en-US', {
                  minimumFractionDigits: item.last < 10 ? 2 : 0,
                  maximumFractionDigits: item.last < 10 ? 2 : 2,
                })}
              </div>

              {/* Change */}
              <div className={`text-sm font-medium mb-3 ${bullish ? 'text-green-500' : 'text-red-500'}`}>
                {up ? '+' : ''}{item.chg_pct.toFixed(2)}%
              </div>

              {/* Sparkline */}
              <Sparkline data={item.spark_1d} positive={bullish} />

              {/* Name */}
              <div className="text-xs text-gray-600 mt-2 truncate">{item.name}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
