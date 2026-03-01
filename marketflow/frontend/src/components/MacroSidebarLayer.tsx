'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { classifySeriesStale, resolveCrossAssetMvpState } from '@/lib/macroLayer'

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_API || 'http://localhost:5001'

type MacroSummaryResponse = {
  asof_date?: string | null
  indexes?: Record<string, {
    score?: number | null
    state?: string | null
    confidence?: number | null
    last_updated?: string | null
    stale?: boolean
  }>
  xapi?: { aligned?: boolean | null; defensive?: boolean | null } | null
  series_status?: Record<string, {
    last_value_date?: string | null
    last_updated_at?: string | null
    last_updated?: string | null
    stale?: boolean
    frequency?: string
  }>
}

type Props = {
  compact?: boolean
  open?: boolean
  onNavigate?: () => void
}

function chipCls(kind: 'ok' | 'watch' | 'risk' | 'neutral') {
  if (kind === 'ok') return 'border-emerald-400/30 text-emerald-300 bg-emerald-500/10'
  if (kind === 'watch') return 'border-amber-400/30 text-amber-300 bg-amber-400/10'
  if (kind === 'risk') return 'border-red-400/30 text-red-300 bg-red-500/10'
  return 'border-white/10 text-slate-200 bg-white/5'
}

function stateToTone(label: string): 'ok' | 'watch' | 'risk' | 'neutral' {
  const s = label.toLowerCase()
  if (s.includes('tight') || s.includes('restrictive') || s.includes('expanding') || s.includes('risk-off')) return 'watch'
  if (s.includes('easy') || s.includes('easing') || s.includes('compressed') || s.includes('risk-on')) return 'ok'
  return 'neutral'
}

function mapLiquidity(state?: string | null): string {
  if (!state) return 'Neutral'
  if (state === 'Loose') return 'Easy'
  return state
}

function mapRates(state?: string | null): string {
  if (!state) return 'Stable'
  if (state === 'Accommodative') return 'Easing'
  if (state === 'Neutral') return 'Stable'
  return state
}

function mapVol(state?: string | null): string {
  if (!state) return 'Normal'
  return state
}

function xAssetState(xapi?: { aligned?: boolean | null; defensive?: boolean | null } | null): string {
  const resolved = resolveCrossAssetMvpState(xapi)
  if (resolved.state === 'Defensive') return 'Risk-Off'
  if (resolved.state === 'Aligned') return 'Risk-On'
  return 'Mixed'
}

export default function MacroSidebarLayer({ compact = false, open = false, onNavigate }: Props) {
  const [data, setData] = useState<MacroSummaryResponse | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    fetch(`${API_BASE}/api/macro/summary`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json) => {
        if (!alive) return
        setData(json || {})
        setFailed(false)
      })
      .catch(() => {
        if (!alive) return
        setFailed(true)
        setData(null)
      })
    return () => {
      alive = false
    }
  }, [])

  const derived = useMemo(() => {
    const idx = data?.indexes || {}
    const liq = mapLiquidity(idx.LPI?.state)
    const rates = mapRates(idx.RPI?.state)
    const vol = mapVol(idx.VRI?.state)
    const x = xAssetState(data?.xapi || null)

    const s = data?.series_status || {}
    const staleFlags = [
      { key: 'WALCL', dt: s.WALCL?.last_value_date || s.WALCL?.last_updated || null },
      { key: 'RRP', dt: s.RRP?.last_value_date || s.RRP?.last_updated || null },
      { key: 'EFFR', dt: s.EFFR?.last_value_date || s.EFFR?.last_updated || null },
      { key: 'VIX', dt: s.VIX?.last_value_date || s.VIX?.last_updated || null },
    ].map((x) => classifySeriesStale({ series: x.key, lastUpdated: x.dt }))
    const staleAny = staleFlags.some((x) => x.stale)

    return {
      liq,
      rates,
      vol,
      x,
      staleAny,
      asof: data?.asof_date || null,
      rows: [
        {
          key: 'liq',
          title: 'Liquidity',
          value: liq,
          note: liq === 'Tight'
            ? 'Liquidity pressure is elevated. Reduce leverage speed.'
            : liq === 'Easy'
              ? 'Liquidity pressure is lighter. Use as context only.'
              : 'Liquidity conditions are mixed/neutral. Combine with volatility.',
        },
        {
          key: 'rates',
          title: 'Rates',
          value: rates,
          note: rates === 'Restrictive'
            ? 'Rate pressure is present. Growth sensitivity may increase.'
            : rates === 'Easing'
              ? 'Rate pressure is easing. Keep confirmation discipline.'
              : 'Rate pressure is stable. Avoid overreacting to one print.',
        },
        {
          key: 'vol',
          title: 'Volatility',
          value: vol,
          note: vol === 'Expanding'
            ? 'Volatility is expanding. Phase entries and size more carefully.'
            : vol === 'Compressed'
              ? 'Volatility is compressed. Treat calm as context, not guarantee.'
              : 'Volatility is normal. Position pacing can remain steady.',
        },
        {
          key: 'x',
          title: 'Cross-Asset',
          value: x,
          note: x === 'Mixed'
            ? 'Cross-asset signals are not aligned. Keep confirmation tone.'
            : x === 'Risk-Off'
              ? 'Cross-asset posture leans defensive. Prioritize risk control.'
              : 'Cross-asset posture supports risk appetite. Still require confirmation.',
        },
      ],
    }
  }, [data])

  if (compact) {
    return (
      <div style={{ padding: '0.3rem 0.5rem 0.1rem' }} title="Macro Layer">
        <Link
          href="/macro"
          onClick={onNavigate}
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '0.45rem 0.3rem',
            margin: '0 0.35rem',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.03)',
            color: '#cbd5e1',
            fontSize: '0.72rem',
            textDecoration: 'none',
          }}
        >
          M
        </Link>
      </div>
    )
  }

  return (
    <div style={{ padding: '0.15rem 0.5rem 0.25rem' }}>
      <div
        style={{
          margin: '0.2rem 0.5rem 0.35rem',
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.02)',
          padding: '0.48rem 0.62rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>Macro:</span>
          <span style={{ fontSize: '0.72rem', color: '#e5e7eb', fontWeight: 600 }}>
            {failed ? 'Unavailable' : `${derived.liq} • ${derived.rates} • ${derived.vol} • ${derived.x}`}
          </span>
          {derived.staleAny && !failed && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] border ${chipCls('watch')}`}>Stale</span>
          )}
        </div>
      </div>

      {open && (
        <div style={{ margin: '0 0.5rem 0.25rem', display: 'grid', gap: 8 }}>
          {derived.rows.map((row) => (
            <div
              key={row.key}
              style={{
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255,255,255,0.02)',
                padding: '0.55rem 0.62rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 700 }}>{row.title}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] border ${chipCls(stateToTone(row.value))}`}>
                  {row.value}
                </span>
              </div>
              <div style={{ marginTop: 4, fontSize: '0.66rem', color: '#9ca3af', lineHeight: 1.35 }}>
                {row.note}
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: '0.66rem', color: '#64748b' }}>
              {derived.asof ? `Updated ${derived.asof}` : 'Updated --'}
            </span>
            <Link
              href="/macro"
              onClick={onNavigate}
              style={{
                color: '#93c5fd',
                fontSize: '0.7rem',
                textDecoration: 'none',
                borderBottom: '1px dashed rgba(147,197,253,0.35)',
              }}
            >
              자세히 / Details
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

