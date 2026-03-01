'use client'

import { CSSProperties, useEffect, useMemo, useState } from 'react'
import {
  Brain,
  ChevronRight,
  CircleHelp,
  Flame,
  Home,
  RefreshCw,
  Search,
  TrendingUp,
} from 'lucide-react'

interface BriefingData {
  timestamp?: string
  summary?: string
  content?: string
}

interface MarketItem {
  name?: string
  price?: number
  change_pct?: number
}

interface MarketData {
  timestamp?: string
  indices?: Record<string, MarketItem>
  volatility?: Record<string, MarketItem>
  bonds?: Record<string, MarketItem>
  currencies?: Record<string, MarketItem>
  commodities?: Record<string, MarketItem>
}


const panelStyle: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(20,22,28,0.95) 0%, rgba(14,16,22,0.96) 100%)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 14,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
}

const tileStyle: CSSProperties = {
  ...panelStyle,
  padding: '0.95rem 1rem',
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function fmtSigned(value?: number, digits = 2) {
  if (value === undefined || value === null || Number.isNaN(value)) return '--'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(digits)}%`
}

function fmtPrice(value?: number, digits = 2, prefix = '$') {
  if (value === undefined || value === null || Number.isNaN(value)) return '--'
  return `${prefix}${value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`
}

function colorByChange(change?: number) {
  if (change === undefined || change === null || Number.isNaN(change)) return '#778199'
  if (change > 0) return '#26d395'
  if (change < 0) return '#ef5d73'
  return '#9ca3af'
}

function parseAnalysis(content?: string, summary?: string) {
  if (summary && summary.trim().length > 16) return [summary.trim()]
  const lines = (content || '')
    .replace(/```[\s\S]*?```/g, '')
    .split('\n')
    .map((line) => line.replace(/^#+\s*/, '').replace(/^\d+\.\s*/, '').replace(/^-\s*/, '').trim())
    .filter((line) => line && !line.startsWith('**'))
  return lines.slice(0, 5).length ? lines.slice(0, 5) : ['No AI analysis available right now.']
}

function sectionLabel(text: string) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#7d879d', fontSize: '0.73rem', letterSpacing: '0.16em', fontWeight: 700 }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: 'rgba(245,158,11,0.7)' }} />
      {text}
    </div>
  )
}

function liftOn(node: HTMLElement, borderColor = 'rgba(245,158,11,0.32)') {
  node.style.transform = 'translateY(-2px)'
  node.style.borderColor = borderColor
  node.style.boxShadow = '0 10px 22px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.03)'
}

function liftOff(node: HTMLElement, borderColor = 'rgba(255,255,255,0.06)') {
  node.style.transform = 'translateY(0)'
  node.style.borderColor = borderColor
  node.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.03)'
}

function rowOn(node: HTMLElement) {
  node.style.transform = 'translateX(2px)'
  node.style.borderColor = 'rgba(245,158,11,0.28)'
  node.style.background = 'rgba(255,255,255,0.03)'
}

function rowOff(node: HTMLElement) {
  node.style.transform = 'translateX(0)'
  node.style.borderColor = 'rgba(255,255,255,0.07)'
  node.style.background = 'rgba(255,255,255,0.01)'
}

interface BriefingViewProps {
  onOpenSectorRotation?: () => void
}

export default function BriefingView({ onOpenSectorRotation }: BriefingViewProps) {
  const [briefing, setBriefing] = useState<BriefingData | null>(null)
  const [market, setMarket] = useState<MarketData | null>(null)
  const [loading, setLoading] = useState(true)

  const loadAll = () => {
    setLoading(true)
    Promise.all([
      fetch('http://localhost:5001/api/briefing').then((r) => r.json()).catch(() => null),
      fetch('http://localhost:5001/api/market/indices').then((r) => r.json()).catch(() => null),
    ]).then(([briefingData, marketData]) => {
      setBriefing(briefingData)
      setMarket(marketData)
      setLoading(false)
    })
  }

  useEffect(() => {
    loadAll()
  }, [])

  const indices = market?.indices || {}
  const volatility = market?.volatility || {}
  const bonds = market?.bonds || {}
  const currencies = market?.currencies || {}
  const commodities = market?.commodities || {}

  const spyChange = indices.SPY?.change_pct ?? 0
  const qqqChange = indices.QQQ?.change_pct ?? 0
  const iwmChange = indices.IWM?.change_pct ?? 0
  const vixPrice = volatility['^VIX']?.price ?? 20

  const sentimentValue = useMemo(() => {
    const score = 52 + (spyChange + qqqChange + iwmChange) * 8 - Math.max(0, vixPrice - 18) * 1.6
    return Math.round(clamp(score, 10, 90))
  }, [spyChange, qqqChange, iwmChange, vixPrice])

  const sentimentLabel =
    sentimentValue >= 75 ? 'Greed' :
    sentimentValue >= 50 ? 'Neutral' :
    sentimentValue >= 25 ? 'Fear' : 'Extreme Fear'
  const sentimentColor =
    sentimentValue >= 75 ? '#22c55e' :
    sentimentValue >= 50 ? '#facc15' :
    sentimentValue >= 25 ? '#fb923c' : '#ef4444'
  const needleDeg = -90 + sentimentValue * 1.8

  const updatedAt = market?.timestamp || briefing?.timestamp
  const analysis = parseAnalysis(briefing?.content, briefing?.summary)
  const topCards = [
    { title: 'VOLATILITY (VIX)', ticker: 'VIX', item: volatility['^VIX'], accent: '#f3b43f' },
    { title: 'DOW JONES', ticker: 'DIA', item: indices.DIA, accent: '#2bd4a0' },
    { title: 'RUSSELL 2000', ticker: 'IWM', item: indices.IWM, accent: '#2bd4a0' },
    { title: 'NASDAQ 100', ticker: 'QQQ', item: indices.QQQ, accent: '#2bd4a0' },
  ]

  const bondRows = [
    { label: '5Y', symbol: '^FVX', price: bonds['^FVX']?.price, change_pct: bonds['^FVX']?.change_pct },
    { label: '3M T-Bill', symbol: '^IRX', price: bonds['^IRX']?.price, change_pct: bonds['^IRX']?.change_pct },
    { label: '10Y', symbol: '^TNX', price: bonds['^TNX']?.price, change_pct: bonds['^TNX']?.change_pct },
  ]

  const currencyRows = [
    { label: 'Dollar Index', symbol: 'DX-Y.NYB', price: currencies['DX-Y.NYB']?.price, change_pct: currencies['DX-Y.NYB']?.change_pct, prefix: '$' },
    { label: 'EUR/USD', symbol: 'EURUSD=X', price: currencies['EURUSD=X']?.price, change_pct: currencies['EURUSD=X']?.change_pct, prefix: '$' },
    { label: 'USD/JPY', symbol: 'USDJPY=X', price: currencies['USDJPY=X']?.price, change_pct: currencies['USDJPY=X']?.change_pct, prefix: '$' },
    {
      label: 'USD/KRW',
      symbol: currencies['KRW=X'] ? 'KRW=X' : 'USDKRW=X',
      price: currencies['KRW=X']?.price ?? currencies['USDKRW=X']?.price,
      change_pct: currencies['KRW=X']?.change_pct ?? currencies['USDKRW=X']?.change_pct,
      prefix: 'KRW ',
    },
  ]

  const commodityRows = [
    { label: 'Bitcoin', symbol: 'BTC-USD', price: commodities['BTC-USD']?.price, change_pct: commodities['BTC-USD']?.change_pct },
    { label: 'Crude Oil', symbol: 'CL=F', price: commodities['CL=F']?.price, change_pct: commodities['CL=F']?.change_pct },
    { label: 'Gold', symbol: 'GC=F', price: commodities['GC=F']?.price, change_pct: commodities['GC=F']?.change_pct },
  ]

  if (loading) {
    return <div style={{ textAlign: 'center', color: '#6b7280', padding: '3rem' }}>Loading briefing...</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr minmax(360px, 520px) auto', gap: '0.85rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#98a0b3', fontSize: '0.95rem' }}>
          <Home size={14} />
          <ChevronRight size={14} />
          <span>Dashboard</span>
        </div>
        <div style={{ ...panelStyle, height: 42, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 0.8rem', borderRadius: 999 }}>
          <Search size={15} color="#8a92a7" />
          <span style={{ color: '#7f879b', fontSize: '0.86rem' }}>Search markets, tickers, or commands...</span>
        </div>
        <div style={{ justifySelf: 'end', color: '#8088a0', fontSize: '0.82rem' }}> </div>
      </div>

      <section style={{ ...panelStyle, padding: '1.15rem', borderRadius: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.95rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)', color: '#f3b43f', borderRadius: 999, padding: '0.16rem 0.52rem', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em' }}>
              <Flame size={12} />
              Market Intelligence v2.0
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.6rem' }}>
              <h1 style={{ margin: 0, fontSize: '2.35rem', lineHeight: 1, fontWeight: 800, color: '#f4f6fb' }}>
                Market <span style={{ color: '#f59e0b' }}>Briefing</span>
              </h1>
              <CircleHelp size={18} color="#6f788f" />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.72rem' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#667089', fontSize: '0.65rem', letterSpacing: '0.14em' }}>UPDATED</div>
              <div style={{ color: '#aab1c2', fontSize: '0.82rem' }}>{updatedAt ? new Date(updatedAt).toLocaleString('ko-KR') : '--'}</div>
            </div>
            <button
              onClick={loadAll}
              style={{
                border: '1px solid rgba(255,255,255,0.14)',
                background: 'rgba(255,255,255,0.05)',
                color: '#edf2ff',
                borderRadius: 10,
                padding: '0.52rem 0.8rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.42rem',
                cursor: 'pointer',
                transition: 'all 140ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(245,158,11,0.32)'
                e.currentTarget.style.background = 'rgba(245,158,11,0.12)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
              }}
            >
              <RefreshCw size={15} />
              Refresh
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: '0.72rem' }}>
          <div style={{ ...tileStyle, gridColumn: 'span 2', minHeight: 186 }}>
            <div style={{ color: '#7b8398', fontSize: '0.72rem', letterSpacing: '0.12em', fontWeight: 700 }}>SENTIMENT</div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '0.5rem' }}>
              <div style={{ position: 'relative', width: 188, height: 108 }}>
                <svg
                  width="188"
                  height="108"
                  viewBox="0 0 188 108"
                  style={{ position: 'absolute', left: 0, top: 0 }}
                >
                  <path d="M 24 94 A 70 70 0 0 1 44.5 44.5" stroke="#ef4444" strokeWidth="18" fill="none" strokeLinecap="butt" />
                  <path d="M 44.5 44.5 A 70 70 0 0 1 94 24" stroke="#fb923c" strokeWidth="18" fill="none" strokeLinecap="butt" />
                  <path d="M 94 24 A 70 70 0 0 1 143.5 44.5" stroke="#facc15" strokeWidth="18" fill="none" strokeLinecap="butt" />
                  <path d="M 143.5 44.5 A 70 70 0 0 1 164 94" stroke="#22c55e" strokeWidth="18" fill="none" strokeLinecap="butt" />
                </svg>
                <div
                  style={{
                    position: 'absolute',
                    left: 94,
                    bottom: 10,
                    width: 3,
                    height: 66,
                    background: '#f4f5f8',
                    borderRadius: 999,
                    transformOrigin: 'bottom center',
                    transform: `translateX(-50%) rotate(${needleDeg}deg)`,
                  }}
                />
                <div style={{ position: 'absolute', left: 89, bottom: 6, width: 12, height: 12, borderRadius: 999, background: '#f4f5f8' }} />
              </div>
              <div style={{ textAlign: 'center', marginTop: '0.22rem' }}>
                <div style={{ color: sentimentColor, fontWeight: 800, fontSize: '2.2rem', lineHeight: 1 }}>{sentimentValue}</div>
                <div style={{ marginTop: '0.15rem', color: sentimentColor, fontWeight: 700 }}>{sentimentLabel}</div>
              </div>
            </div>
          </div>

          {topCards.map((card) => {
            const change = card.item?.change_pct
            return (
              <div
                key={card.title}
                style={{ ...tileStyle, minHeight: 146, transition: 'all 170ms ease', willChange: 'transform' }}
                onMouseEnter={(e) => liftOn(e.currentTarget)}
                onMouseLeave={(e) => liftOff(e.currentTarget)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ color: '#7b8398', fontSize: '0.7rem', letterSpacing: '0.08em', fontWeight: 700 }}>{card.title}</div>
                  <div style={{ color: colorByChange(change), background: 'rgba(255,255,255,0.05)', borderRadius: 6, fontSize: '0.72rem', padding: '0.12rem 0.34rem' }}>{fmtSigned(change)}</div>
                </div>
                <div style={{ marginTop: '0.46rem', color: '#8c94aa', fontSize: '0.75rem' }}>{card.ticker}</div>
                <div style={{ marginTop: '0.46rem', color: card.accent, fontSize: '2rem', lineHeight: 1.1, fontWeight: 800 }}>{card.item?.price?.toFixed(2) ?? '--'}</div>
                <div style={{ marginTop: '0.36rem', color: colorByChange(change), fontSize: '0.8rem' }}>{change !== undefined ? `High: ${fmtSigned(change)}` : '--'}</div>
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: '0.92rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          {sectionLabel('BONDS')}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.66rem' }}>
            {bondRows.map((bond) => (
              <div
                key={bond.symbol}
                style={{ ...tileStyle, minHeight: 76, padding: '0.68rem 0.86rem', transition: 'all 170ms ease', willChange: 'transform' }}
                onMouseEnter={(e) => liftOn(e.currentTarget, 'rgba(59,130,246,0.35)')}
                onMouseLeave={(e) => liftOff(e.currentTarget)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '0.4rem' }}>
                  <div>
                    <div style={{ color: '#b7bdcb', fontSize: '1.01rem', fontWeight: 600 }}>{bond.label}</div>
                    <div style={{ color: '#6e778f', fontSize: '0.73rem' }}>{bond.symbol}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#edf2ff', fontSize: '1.6rem', fontWeight: 800, lineHeight: 1 }}>{bond.price !== undefined ? `${bond.price.toFixed(2)}%` : '--'}</div>
                    <div style={{ color: colorByChange(bond.change_pct), fontSize: '0.78rem' }}>{fmtSigned(bond.change_pct)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {sectionLabel('CURRENCIES')}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.66rem' }}>
            {currencyRows.map((currency) => (
              <div
                key={currency.symbol}
                style={{ ...tileStyle, minHeight: 76, padding: '0.68rem 0.86rem', transition: 'all 170ms ease', willChange: 'transform' }}
                onMouseEnter={(e) => liftOn(e.currentTarget, 'rgba(34,197,94,0.35)')}
                onMouseLeave={(e) => liftOff(e.currentTarget)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '0.4rem' }}>
                  <div>
                    <div style={{ color: '#b7bdcb', fontSize: '0.96rem', fontWeight: 600 }}>{currency.label}</div>
                    <div style={{ color: '#6e778f', fontSize: '0.73rem' }}>{currency.symbol}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#edf2ff', fontSize: '1.34rem', fontWeight: 800, lineHeight: 1 }}>{fmtPrice(currency.price, 2, currency.prefix)}</div>
                    <div style={{ color: colorByChange(currency.change_pct), fontSize: '0.78rem' }}>{fmtSigned(currency.change_pct)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {sectionLabel('COMMODITIES')}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.66rem' }}>
            {commodityRows.map((item) => (
              <div
                key={item.symbol}
                style={{ ...tileStyle, minHeight: 76, padding: '0.68rem 0.86rem', transition: 'all 170ms ease', willChange: 'transform' }}
                onMouseEnter={(e) => liftOn(e.currentTarget, 'rgba(245,158,11,0.35)')}
                onMouseLeave={(e) => liftOff(e.currentTarget)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '0.4rem' }}>
                  <div>
                    <div style={{ color: '#b7bdcb', fontSize: '0.96rem', fontWeight: 600 }}>{item.label}</div>
                    <div style={{ color: '#6e778f', fontSize: '0.73rem' }}>{item.symbol}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#edf2ff', fontSize: '1.34rem', fontWeight: 800, lineHeight: 1 }}>{fmtPrice(item.price)}</div>
                    <div style={{ color: colorByChange(item.change_pct), fontSize: '0.78rem' }}>{fmtSigned(item.change_pct)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: '0.9rem', display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
          <button
            style={{ border: '1px solid rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.12)', color: '#f3be62', borderRadius: 10, padding: '0.42rem 0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.35rem', transition: 'all 140ms ease' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.background = 'rgba(245,158,11,0.18)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.background = 'rgba(245,158,11,0.12)'
            }}
          >
            <Brain size={15} />
            AI Analysis
          </button>
          <button
            style={{ border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)', color: '#d2d8e5', borderRadius: 10, padding: '0.42rem 0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.35rem', transition: 'all 140ms ease' }}
            onClick={onOpenSectorRotation}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.28)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'
            }}
          >
            <TrendingUp size={15} />
            Sector Rotation
          </button>
        </div>

        <div style={{ marginTop: '0.9rem', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.72rem' }}>
          <div
            style={{ ...panelStyle, padding: '0.95rem 1.02rem', transition: 'all 170ms ease', willChange: 'transform' }}
            onMouseEnter={(e) => liftOn(e.currentTarget, 'rgba(245,158,11,0.25)')}
            onMouseLeave={(e) => liftOff(e.currentTarget)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.42rem', marginBottom: '0.72rem' }}>
              <Brain size={15} color="#f3b43f" />
              <span style={{ color: '#f4f6fb', fontWeight: 700, fontSize: '1.02rem' }}>Market Analysis</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#636d85' }}>AI Generated</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {analysis.map((line, index) => (
                <p key={`${line}-${index}`} style={{ color: '#acb3c2', fontSize: '0.91rem', lineHeight: 1.65 }}>{line}</p>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: '0.82rem', border: '1px solid rgba(245,158,11,0.32)', background: 'rgba(245,158,11,0.1)', color: '#cb9a36', borderRadius: 9, padding: '0.48rem 0.68rem', fontSize: '0.78rem' }}>
          Not financial advice. Educational purposes only. Past performance does not guarantee future results.
        </div>
      </section>
    </div>
  )
}
