// Options Wall 탭 — Weekly Options Positioning Briefing 컴포넌트
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { clientApiUrl } from '@/lib/backendApi'
import { normalizeTicker } from '@/lib/stockAnalysis'

// ── Types ─────────────────────────────────────────────────────────────────────

type ExpectedMove = {
  amount?: number | null
  lower?: number | null
  upper?: number | null
  atm_iv?: number | null
}

type OptionMode = 'near' | 'full'

type FilterRange = {
  lower?: number | null
  upper?: number | null
}

type OptionStrike = {
  strike: number
  call_oi?: number | null
  put_oi?: number | null
  call_volume?: number | null
  put_volume?: number | null
  call_iv?: number | null
  put_iv?: number | null
}

type OptionExpiry = {
  expiry: string
  mode?: OptionMode | string
  filter_range?: FilterRange | null
  dte?: number | null
  put_call_ratio_oi?: number | null
  put_call_ratio_oi_near?: number | null
  put_call_ratio_oi_full?: number | null
  max_pain?: number | null
  max_pain_near?: number | null
  max_pain_full?: number | null
  call_wall?: number | null
  call_wall_near?: number | null
  call_wall_full?: number | null
  put_wall?: number | null
  put_wall_near?: number | null
  put_wall_full?: number | null
  expected_move?: ExpectedMove | null
  expected_move_near?: ExpectedMove | null
  expected_move_full?: ExpectedMove | null
  strikes_all_count?: number | null
  strikes_filtered_count?: number | null
  strikes?: OptionStrike[]
}

type OptionsSummaryDetails = {
  positioning_bias?: string | null
  market_tone?: string | null
  current_price?: number | null
  call_wall?: number | null
  put_wall?: number | null
  max_pain?: number | null
  put_call_ratio?: number | null
  expected_move_percent?: number | null
  expected_range?: FilterRange | null
  spot_vs_max_pain?: string | null
  largest_call_cluster?: number | null
  largest_put_cluster?: number | null
  risk_comment?: string | null
  interpretation?: string | null
}

type OptionsResearchSummary = {
  ticker?: string | null
  expiry?: string | null
  as_of?: string | null
  mode?: string | null
  source?: string | null
  summary?: OptionsSummaryDetails | null
  llm_context?: string | null
}

type OptionsPayload = {
  ticker?: string
  as_of?: string
  source?: string
  mode?: OptionMode | string
  filter_range?: FilterRange | null
  current_price?: number | null
  available_expiries?: string[]
  expiries?: OptionExpiry[]
  message?: string
  error?: string
  warnings?: string[]
  stale?: boolean
  options_summary?: OptionsResearchSummary | null
}

type OptionsPanelProps = {
  symbol?: string
  fetchKey?: number
}

type StrikeRow = {
  strike: string
  strikeValue: number
  call_oi: number
  put_oi: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function formatPrice(value?: number | null, digits = 2): string {
  if (!finiteNumber(value)) return '--'
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`
}

function formatStrike(value?: number | null): string {
  if (!finiteNumber(value)) return '--'
  return value % 1 === 0 ? `$${value.toFixed(0)}` : `$${value.toFixed(2)}`
}

function formatRatio(value?: number | null): string {
  if (!finiteNumber(value)) return '--'
  return value.toFixed(2)
}

function formatInt(value?: number | null): string {
  if (!finiteNumber(value)) return '0'
  return Math.round(value).toLocaleString()
}

function formatExpectedMove(em: ExpectedMove | null | undefined): string {
  if (!em) return '--'
  if (finiteNumber(em.amount)) return `±${formatPrice(em.amount, 0).replace('$', '')}`
  if (finiteNumber(em.lower) && finiteNumber(em.upper)) {
    return `±${(((em.upper! - em.lower!) / 2)).toFixed(0)}`
  }
  return '--'
}

const mono = 'var(--font-terminal), "Nanum Gothic Coding", "Noto Sans KR", monospace'

const card: React.CSSProperties = {
  background: 'rgba(15,23,42,0.78)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  accent = '#c9cdd4',
  border = false,
}: {
  label: string
  value: string
  accent?: string
  border?: boolean
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 72,
        padding: '12px 10px',
        textAlign: 'center',
        borderRight: border ? '1px solid rgba(255,255,255,0.07)' : 'none',
      }}
    >
      <div
        style={{
          color: '#7f8aa3',
          fontSize: 10,
          fontFamily: mono,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ color: accent, fontSize: 20, fontWeight: 800, lineHeight: 1 }}>
        {value}
      </div>
    </div>
  )
}

function CoreBandViz({
  putWall,
  callWall,
  currentPrice,
}: {
  putWall?: number | null
  callWall?: number | null
  currentPrice?: number | null
}) {
  if (!finiteNumber(putWall) || !finiteNumber(callWall) || !finiteNumber(currentPrice)) {
    return (
      <div style={{ padding: '20px 0', color: '#4a5568', fontSize: 13, textAlign: 'center' }}>
        Core band data unavailable
      </div>
    )
  }

  const span = callWall! - putWall!
  const spotRaw = span > 0 ? ((currentPrice! - putWall!) / span) * 100 : 50
  const spotPct = Math.min(96, Math.max(4, spotRaw))
  const aboveCenter = spotPct > 50

  return (
    <div style={{ padding: '24px 0 28px' }}>
      {/* Price labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ textAlign: 'left' }}>
          <div style={{ color: '#7f8aa3', fontSize: 10, fontFamily: mono, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Put Wall</div>
          <div style={{ color: '#fb7185', fontSize: 18, fontWeight: 800, fontFamily: mono }}>{formatStrike(putWall)}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#7f8aa3', fontSize: 10, fontFamily: mono, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Current</div>
          <div style={{ color: '#ffffff', fontSize: 18, fontWeight: 800, fontFamily: mono }}>{formatStrike(currentPrice)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#7f8aa3', fontSize: 10, fontFamily: mono, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Call Wall</div>
          <div style={{ color: '#4ade80', fontSize: 18, fontWeight: 800, fontFamily: mono }}>{formatStrike(callWall)}</div>
        </div>
      </div>

      {/* Band track */}
      <div style={{ position: 'relative', height: 20, margin: '0 0 18px' }}>
        {/* Track background */}
        <div
          style={{
            position: 'absolute',
            inset: '4px 0',
            borderRadius: 99,
            background: 'rgba(71,85,105,0.30)',
          }}
        />
        {/* Put side tint */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 4,
            bottom: 4,
            width: `${spotPct}%`,
            borderRadius: '99px 0 0 99px',
            background: 'rgba(251,113,133,0.18)',
          }}
        />
        {/* Call side tint */}
        <div
          style={{
            position: 'absolute',
            left: `${spotPct}%`,
            top: 4,
            bottom: 4,
            right: 0,
            borderRadius: '0 99px 99px 0',
            background: 'rgba(74,222,128,0.15)',
          }}
        />
        {/* Current price dot */}
        <div
          style={{
            position: 'absolute',
            left: `${spotPct}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#ffffff',
            boxShadow: '0 0 0 3px rgba(255,255,255,0.20), 0 0 12px rgba(255,255,255,0.40)',
            zIndex: 2,
          }}
        />
        {/* Put wall tick */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderRadius: 2, background: '#fb7185' }} />
        {/* Call wall tick */}
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 3, borderRadius: 2, background: '#4ade80' }} />
      </div>

      {/* Spot label below track */}
      <div style={{ position: 'relative', height: 18 }}>
        <div
          style={{
            position: 'absolute',
            left: `${spotPct}%`,
            transform: 'translateX(-50%)',
            color: aboveCenter ? '#f8fafc' : '#f8fafc',
            fontSize: 11,
            fontFamily: mono,
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          ↑ {formatStrike(currentPrice)}
        </div>
      </div>
    </div>
  )
}

function TopStrikeBars({
  rows,
  label,
  accent,
}: {
  rows: StrikeRow[]
  label: string
  accent: string
}) {
  const vals = rows.map((r) => (label.startsWith('Call') ? r.call_oi : r.put_oi))
  const max = Math.max(...vals, 1)

  return (
    <div>
      <div
        style={{
          color: accent,
          fontSize: 10,
          fontFamily: mono,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      {rows.map((row, i) => {
        const val = label.startsWith('Call') ? row.call_oi : row.put_oi
        const pct = (val / max) * 100
        return (
          <div key={row.strike} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ color: '#94a3b8', fontSize: 12, fontFamily: mono, minWidth: 48, textAlign: 'right' }}>
              {i + 1}. ${row.strike}
            </span>
            <div
              style={{
                flex: 1,
                height: 8,
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  borderRadius: 4,
                  background: accent,
                  opacity: 0.75,
                }}
              />
            </div>
            <span style={{ color: '#64748b', fontSize: 11, fontFamily: mono, minWidth: 56, textAlign: 'right' }}>
              {formatInt(val)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function BriefingLine({
  num,
  label,
  text,
  accent = '#94a3b8',
}: {
  num: number
  label: string
  text: string
  accent?: string
}) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
      <div
        style={{
          flexShrink: 0,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: `${accent}20`,
          border: `1px solid ${accent}40`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: accent,
          fontSize: 10,
          fontWeight: 800,
          fontFamily: mono,
          marginTop: 1,
        }}
      >
        {num}
      </div>
      <div>
        <div
          style={{
            color: accent,
            fontSize: 10,
            fontFamily: mono,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 3,
          }}
        >
          {label}
        </div>
        <div style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.65 }}>{text}</div>
      </div>
    </div>
  )
}

// ── WallTooltip ───────────────────────────────────────────────────────────────

function WallTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string }>
  label?: string | number
}) {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        background: 'rgba(2,6,23,0.96)',
        border: '1px solid rgba(148,163,184,0.22)',
        borderRadius: 8,
        padding: '9px 12px',
        boxShadow: '0 12px 30px rgba(0,0,0,0.36)',
        minWidth: 140,
      }}
    >
      <div style={{ color: '#f8fafc', fontSize: 12, fontWeight: 800, marginBottom: 6, fontFamily: mono }}>
        Strike ${label}
      </div>
      {payload.map((item) => (
        <div key={item.name} style={{ color: item.color || '#cbd5e1', fontSize: 12, marginTop: 3 }}>
          {item.name}: {typeof item.value === 'number' ? Math.round(item.value).toLocaleString() : '--'}
        </div>
      ))}
    </div>
  )
}

// ── OptionsWallChart ──────────────────────────────────────────────────────────

function OptionsWallChart({
  rows,
  callWall,
  putWall,
  currentPrice,
  loading,
}: {
  rows: StrikeRow[]
  callWall?: number | null
  putWall?: number | null
  currentPrice?: number | null
  loading?: boolean
}) {
  const nearestStrike = useMemo(() => {
    if (!finiteNumber(currentPrice) || !rows.length) return null
    return rows.reduce((prev, curr) =>
      Math.abs(curr.strikeValue - currentPrice!) < Math.abs(prev.strikeValue - currentPrice!)
        ? curr
        : prev,
    ).strike
  }, [rows, currentPrice])

  const callWallStrike = useMemo(() => {
    if (!finiteNumber(callWall) || !rows.length) return null
    const exact = rows.find((r) => Math.abs(r.strikeValue - callWall!) < 0.01)
    if (exact) return exact.strike
    return callWall! % 1 === 0 ? callWall!.toFixed(0) : callWall!.toFixed(2)
  }, [rows, callWall])

  const putWallStrike = useMemo(() => {
    if (!finiteNumber(putWall) || !rows.length) return null
    const exact = rows.find((r) => Math.abs(r.strikeValue - putWall!) < 0.01)
    if (exact) return exact.strike
    return putWall! % 1 === 0 ? putWall!.toFixed(0) : putWall!.toFixed(2)
  }, [rows, putWall])

  if (!rows.length) {
    return (
      <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a5568', fontSize: 13 }}>
        No strike data available
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ color: '#f8fafc', fontSize: 14, fontWeight: 800 }}>
          Open Interest by Strike
        </div>
        {loading && <span style={{ color: '#4a5568', fontSize: 11, fontFamily: mono }}>updating...</span>}
      </div>
      <div style={{ width: '100%', height: 340, overflowX: 'auto' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 32, right: 20, left: 0, bottom: 8 }} barCategoryGap="20%">
            <CartesianGrid stroke="rgba(148,163,184,0.10)" vertical={false} />
            <XAxis
              dataKey="strike"
              tick={{ fill: '#6b7280', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: '#6b7280', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
            />
            <Tooltip content={<WallTooltip />} cursor={{ fill: 'rgba(148,163,184,0.06)' }} />

            {/* Core Band shade */}
            {putWallStrike && callWallStrike && (
              <ReferenceArea
                x1={putWallStrike}
                x2={callWallStrike}
                fill="rgba(71,85,105,0.18)"
                stroke="rgba(148,163,184,0.16)"
              />
            )}

            {/* Put Wall */}
            {putWallStrike && (
              <ReferenceLine
                x={putWallStrike}
                stroke="#fb7185"
                strokeWidth={2}
                strokeDasharray="3 3"
                label={{ value: 'Put Wall', position: 'top', fill: '#fb7185', fontSize: 11 }}
              />
            )}

            {/* Call Wall */}
            {callWallStrike && (
              <ReferenceLine
                x={callWallStrike}
                stroke="#4ade80"
                strokeWidth={2}
                strokeDasharray="3 3"
                label={{ value: 'Call Wall', position: 'top', fill: '#4ade80', fontSize: 11 }}
              />
            )}

            {/* Current Price */}
            {nearestStrike && (
              <ReferenceLine
                x={nearestStrike}
                stroke="#ffffff"
                strokeWidth={2}
                label={{ value: 'Current', position: 'top', fill: '#ffffff', fontSize: 11 }}
              />
            )}

            <Bar dataKey="put_oi"  name="Put OI"  fill="#fb7185" radius={[3, 3, 0, 0]} maxBarSize={18} />
            <Bar dataKey="call_oi" name="Call OI" fill="#34d399" radius={[3, 3, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div style={{ ...card, padding: 24, minHeight: 240 }}>
      <div style={{ color: '#67e8f9', fontSize: 11, fontFamily: mono, fontWeight: 700, marginBottom: 10 }}>
        OPTIONS_POSITIONING
      </div>
      <div style={{ color: '#f8fafc', fontSize: 16, fontWeight: 800, marginBottom: 20 }}>
        Loading options data...
      </div>
      {[88, 72, 54].map((w) => (
        <div
          key={w}
          style={{
            width: `${w}%`,
            height: 6,
            borderRadius: 999,
            background: 'linear-gradient(90deg, rgba(0,217,255,0.18), rgba(34,197,94,0.07))',
            marginBottom: 8,
          }}
        />
      ))}
    </div>
  )
}

function EmptyState({ detail }: { detail?: string | null }) {
  return (
    <div style={{ ...card, padding: 24, minHeight: 180 }}>
      <div style={{ color: '#f8fafc', fontSize: 15, fontWeight: 800, marginBottom: 8 }}>
        Limited options data available for this expiration.
      </div>
      <div style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.6 }}>
        This may happen for indexes, unsupported tickers, or temporary source limits.
      </div>
      {detail ? (
        <div style={{ color: '#64748b', fontSize: 11, fontFamily: mono, marginTop: 10 }}>
          {detail}
        </div>
      ) : null}
    </div>
  )
}

// ── buildStrikeRows (lightweight, OI only) ────────────────────────────────────

function buildStrikeRows(
  expiry: OptionExpiry | null,
  currentPrice?: number | null,
  limit = 80,
): StrikeRow[] {
  const strikes = Array.isArray(expiry?.strikes) ? expiry!.strikes : []
  const normalized = strikes
    .filter((s) => finiteNumber(s.strike))
    .map((s) => ({
      strike: s.strike % 1 === 0 ? s.strike.toFixed(0) : s.strike.toFixed(2),
      strikeValue: s.strike,
      call_oi: finiteNumber(s.call_oi) ? s.call_oi! : 0,
      put_oi: finiteNumber(s.put_oi) ? s.put_oi! : 0,
    }))

  if (normalized.length <= limit) return normalized

  const anchors = new Set(
    [expiry?.call_wall, expiry?.put_wall, expiry?.max_pain]
      .filter(finiteNumber)
      .map((v) => Number(v!.toFixed(4))),
  )

  return [...normalized]
    .sort((a, b) => {
      const aA = anchors.has(Number(a.strikeValue.toFixed(4))) ? -1_000_000 : 0
      const bA = anchors.has(Number(b.strikeValue.toFixed(4))) ? -1_000_000 : 0
      if (finiteNumber(currentPrice)) {
        return aA + Math.abs(a.strikeValue - currentPrice!) - (bA + Math.abs(b.strikeValue - currentPrice!))
      }
      return aA + (b.call_oi + b.put_oi) - (bA + (a.call_oi + a.put_oi))
    })
    .slice(0, limit)
    .sort((a, b) => a.strikeValue - b.strikeValue)
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function OptionsPanel({ symbol = 'AAPL', fetchKey = 0 }: OptionsPanelProps) {
  const [payload, setPayload] = useState<OptionsPayload | null>(null)
  const [selectedExpiry, setSelectedExpiry] = useState('')
  const [mode, setMode] = useState<OptionMode>('near')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadOptions = useCallback(
    async (expiry?: string, requestMode: OptionMode = mode, signal?: AbortSignal) => {
      const ticker = normalizeTicker(symbol) || 'AAPL'
      const params = new URLSearchParams({ ticker })
      params.set('mode', requestMode)
      if (expiry) params.set('expiry', expiry)

      setLoading(true)
      setError(null)
      const res = await fetch(`${clientApiUrl('/api/options')}?${params.toString()}`, {
        cache: 'no-store',
        signal,
      })
      const data = (await res.json().catch(() => ({}))) as OptionsPayload
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load options data')
      }

      setPayload(data)
      const loadedExpiries = Array.isArray(data.expiries) ? data.expiries.map((e) => e.expiry) : []
      const firstExpiry = expiry || loadedExpiries[0] || data.available_expiries?.[0] || ''
      setSelectedExpiry((prev) => {
        if (expiry) return expiry
        return prev && loadedExpiries.includes(prev) ? prev : firstExpiry
      })
    },
    [mode, symbol],
  )

  useEffect(() => {
    const controller = new AbortController()
    loadOptions(undefined, mode, controller.signal)
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setPayload(null)
        setError(err instanceof Error ? err.message : 'Failed to load options data')
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [loadOptions, fetchKey, mode])

  const expiryChoices = useMemo(() => {
    const choices = payload?.available_expiries?.length
      ? payload.available_expiries
      : (payload?.expiries || []).map((e) => e.expiry)
    return Array.from(new Set(choices.filter(Boolean)))
  }, [payload])

  const selected = useMemo(() => {
    const expiries = Array.isArray(payload?.expiries) ? payload!.expiries! : []
    return expiries.find((e) => e.expiry === selectedExpiry) || expiries[0] || null
  }, [payload, selectedExpiry])

  const strikeRows = useMemo(
    () => buildStrikeRows(selected, payload?.current_price),
    [selected, payload?.current_price],
  )

  const top3Calls = useMemo(
    () => [...strikeRows].sort((a, b) => b.call_oi - a.call_oi).slice(0, 3),
    [strikeRows],
  )

  const top3Puts = useMemo(
    () => [...strikeRows].sort((a, b) => b.put_oi - a.put_oi).slice(0, 3),
    [strikeRows],
  )

  const handleExpiryChange = (next: string) => {
    setSelectedExpiry(next)
    const alreadyLoaded = payload?.expiries?.some((e) => e.expiry === next)
    if (!alreadyLoaded) {
      loadOptions(next, mode)
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load expiry'))
        .finally(() => setLoading(false))
    }
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const researchSummary = payload?.options_summary?.summary || null
  const expected = selected?.expected_move || null
  const callWall = selected?.call_wall ?? researchSummary?.call_wall ?? null
  const putWall  = selected?.put_wall  ?? researchSummary?.put_wall  ?? null
  const maxPain  = selected?.max_pain  ?? null
  const spotPrice = payload?.current_price ?? null
  const pcRatio = selected?.put_call_ratio_oi ?? null
  const expMove = formatExpectedMove(expected)

  const coreBandText =
    finiteNumber(putWall) && finiteNumber(callWall)
      ? `${formatStrike(putWall)} – ${formatStrike(callWall)}`
      : '--'

  // ── Briefing blocks ────────────────────────────────────────────────────────
  const briefingLines = useMemo(() => {
    const lines: Array<{ num: number; label: string; text: string; accent: string }> = []

    // 1. Core Band
    lines.push({
      num: 1,
      label: 'Core Band',
      accent: '#94a3b8',
      text:
        finiteNumber(putWall) && finiteNumber(callWall)
          ? `Options positioning this week is concentrated between ${formatStrike(putWall)} and ${formatStrike(callWall)} into the upcoming expiration.`
          : researchSummary?.interpretation || 'Options positioning data is available for this expiration.',
    })

    // 2. Current position
    lines.push({
      num: 2,
      label: 'Current Position',
      accent: '#67e8f9',
      text:
        finiteNumber(spotPrice) && finiteNumber(callWall) && finiteNumber(putWall)
          ? spotPrice! > (callWall! + putWall!) / 2
            ? `Current price ${formatStrike(spotPrice)} is positioned in the upper half of the core band, closer to the call wall.`
            : `Current price ${formatStrike(spotPrice)} is positioned in the lower half of the core band, closer to the put wall.`
          : `Current price is ${formatStrike(spotPrice)}.`,
    })

    // 3. Resistance candidate
    lines.push({
      num: 3,
      label: 'Resistance Candidate',
      accent: '#4ade80',
      text: finiteNumber(callWall)
        ? `${formatStrike(callWall)} carries the largest call positioning concentration and may act as a short-term resistance candidate into expiration.`
        : 'No clear call wall concentration identified for this expiration.',
    })

    // 4. Support candidate
    lines.push({
      num: 4,
      label: 'Support Candidate',
      accent: '#fb7185',
      text: finiteNumber(putWall)
        ? `Put positioning is strongest near ${formatStrike(putWall)}, which may represent potential downside support interest.`
        : 'No clear put wall concentration identified for this expiration.',
    })

    // 5. Expected range
    const emLower = expected?.lower
    const emUpper = expected?.upper
    lines.push({
      num: 5,
      label: 'Expected Range',
      accent: '#fbbf24',
      text:
        finiteNumber(emLower) && finiteNumber(emUpper)
          ? `The current implied move suggests the market is pricing a trading range broadly between ${formatPrice(emLower)} and ${formatPrice(emUpper)} into this cycle.`
          : `Expected move data is ${expMove !== '--' ? expMove : 'not available'} for this expiration.`,
    })

    return lines
  }, [putWall, callWall, spotPrice, expected, researchSummary, expMove])

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading && !payload) return <LoadingState />
  if (error && !payload) return <EmptyState detail={error} />
  if (!payload || !selected) return <EmptyState detail={payload?.error || payload?.message || error} />

  const ticker = payload.ticker || normalizeTicker(symbol)

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '4px 0 24px' }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div
        style={{
          ...card,
          padding: '14px 16px',
          marginBottom: 12,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              color: '#67e8f9',
              fontSize: 10,
              fontFamily: mono,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginBottom: 2,
            }}
          >
            OPTIONS POSITIONING
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ color: '#f8fafc', fontSize: 18, fontWeight: 800 }}>{ticker}</span>
            <span style={{ color: '#4a5568', fontSize: 12 }}>•</span>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>{selected.expiry}</span>
            {finiteNumber(selected.dte) ? (
              <span style={{ color: '#64748b', fontSize: 12, fontFamily: mono }}>DTE {selected.dte}</span>
            ) : null}
          </div>
          <div style={{ color: '#4a5568', fontSize: 11, fontFamily: mono, marginTop: 3 }}>
            {payload.source || 'yfinance'} | {payload.as_of || '--'} | {mode === 'near' ? 'Near Spot' : 'Full Chain'}
            {payload.stale ? ' | stale cache' : ''}
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {(['near', 'full'] as OptionMode[]).map((item) => {
            const active = mode === item
            return (
              <button
                key={item}
                onClick={() => {
                  if (item !== mode) setMode(item)
                }}
                aria-pressed={active}
                style={{
                  border: `1px solid ${active ? 'rgba(0,217,255,0.40)' : 'rgba(255,255,255,0.10)'}`,
                  background: active ? 'rgba(0,217,255,0.10)' : 'rgba(255,255,255,0.03)',
                  color: active ? '#67e8f9' : '#64748b',
                  borderRadius: 7,
                  padding: '6px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: mono,
                }}
              >
                {item === 'near' ? 'Near Spot' : 'Full Chain'}
              </button>
            )
          })}

          <label style={{ color: '#94a3b8', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#64748b', fontSize: 11 }}>Expiry</span>
            <select
              value={selectedExpiry}
              onChange={(e) => handleExpiryChange(e.target.value)}
              style={{
                border: '1px solid rgba(255,255,255,0.12)',
                background: '#0f172a',
                color: '#f8fafc',
                borderRadius: 7,
                padding: '6px 8px',
                fontSize: 11,
                outline: 'none',
                fontFamily: mono,
              }}
            >
              {expiryChoices.map((exp) => (
                <option key={exp} value={exp}>
                  {exp}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* ── KPI Strip ─────────────────────────────────────────────────────── */}
      <div
        style={{
          ...card,
          display: 'flex',
          flexWrap: 'wrap',
          marginBottom: 12,
          overflow: 'hidden',
        }}
      >
        <KpiCard label="Current"       value={formatStrike(spotPrice)}              accent="#ffffff"  border />
        <KpiCard label="Call Wall"     value={formatStrike(callWall)}               accent="#4ade80"  border />
        <KpiCard label="Put Wall"      value={formatStrike(putWall)}                accent="#fb7185"  border />
        <KpiCard label="Core Band"     value={coreBandText}                         accent="#94a3b8"  border />
        <KpiCard label="Expected Move" value={expMove}                              accent="#fbbf24"  border={false} />
      </div>

      {/* ── Main Chart ────────────────────────────────────────────────────── */}
      <div style={{ ...card, padding: '14px 16px', marginBottom: 12 }}>
        <OptionsWallChart
          rows={strikeRows}
          callWall={callWall}
          putWall={putWall}
          currentPrice={spotPrice}
          loading={loading}
        />
      </div>

      {/* ── Core Band Summary (secondary) ─────────────────────────────────── */}
      <div style={{ ...card, padding: '4px 20px 12px', marginBottom: 12 }}>
        <div style={{ color: '#4a5568', fontSize: 10, fontFamily: mono, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', padding: '10px 0 0' }}>
          Position Summary
        </div>
        <CoreBandViz putWall={putWall} callWall={callWall} currentPrice={spotPrice} />
        {(finiteNumber(maxPain) || finiteNumber(pcRatio)) && (
          <div style={{ display: 'flex', gap: 24, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10, marginTop: 2 }}>
            {finiteNumber(maxPain) && (
              <div>
                <span style={{ color: '#64748b', fontSize: 11, fontFamily: mono, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Max Pain </span>
                <span style={{ color: '#c4b5fd', fontSize: 13, fontWeight: 700, fontFamily: mono }}>{formatStrike(maxPain)}</span>
              </div>
            )}
            {finiteNumber(pcRatio) && (
              <div>
                <span style={{ color: '#64748b', fontSize: 11, fontFamily: mono, textTransform: 'uppercase', letterSpacing: '0.06em' }}>P/C Ratio </span>
                <span style={{ color: '#fbbf24', fontSize: 13, fontWeight: 700, fontFamily: mono }}>{formatRatio(pcRatio)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Briefing ──────────────────────────────────────────────────────── */}
      <div style={{ ...card, padding: '16px 18px', marginBottom: 12 }}>
        <div
          style={{
            color: '#67e8f9',
            fontSize: 10,
            fontFamily: mono,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: 16,
          }}
        >
          OPTIONS MARKET STRUCTURE
        </div>
        {briefingLines.map((line) => (
          <BriefingLine key={line.num} {...line} />
        ))}

        {payload.warnings?.slice(0, 2).map((w) => (
          <div key={w} style={{ color: '#4a5568', fontSize: 11, fontFamily: mono, lineHeight: 1.5, marginTop: 4 }}>
            {w}
          </div>
        ))}
      </div>

      {/* ── Top Strikes (small support charts) ───────────────────────────── */}
      {strikeRows.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 12,
          }}
        >
          <div style={{ ...card, padding: '14px 16px' }}>
            <TopStrikeBars rows={top3Calls} label="Call Concentration" accent="#4ade80" />
          </div>
          <div style={{ ...card, padding: '14px 16px' }}>
            <TopStrikeBars rows={top3Puts} label="Put Concentration" accent="#fb7185" />
          </div>
        </div>
      )}
    </div>
  )
}
