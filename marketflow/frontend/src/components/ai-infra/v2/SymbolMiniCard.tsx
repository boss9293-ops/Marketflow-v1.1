'use client'
// AI 인프라 V2 — 종목 미니카드 (클릭 → 모달, Yahoo Finance 링크 포함)

import { useEffect } from 'react'
import type { MarkerType } from '@/lib/ai-infra/v2/buildMoversMarker'
import { fmtReturn, returnColor } from '@/lib/ai-infra/v2/symbolPriceFetcher'
import { MoversMarker } from './MoversMarker'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SymbolMiniCardData {
  symbol:              string
  company_name:        string | null
  bucket_label:        string
  return_1w:           number | null
  marker_type:         MarkerType
  confirmation_level?: string
  evidence_note?:      string
  caution_note?:       string
  is_indirect:         boolean
  is_story_heavy:      boolean
}

interface Props {
  data:    SymbolMiniCardData
  onClose: () => void
}

// ── Constants ──────────────────────────────────────────────────────────────────

const CONF_DISPLAY: Record<string, { label: string; color: string }> = {
  CONFIRMED:     { label: '확인됨',      color: '#22c55e' },
  PARTIAL:       { label: '일부 확인',   color: '#5DCFB0' },
  WATCH:         { label: '미확인',      color: '#fbbf24' },
  NOT_CONFIRMED: { label: '미확인됨',    color: '#f97316' },
  DATA_LIMITED:  { label: '데이터 제한', color: '#8b9098' },
  UNKNOWN:       { label: '정보 없음',   color: '#8b9098' },
}

const V = {
  text: '#E8F0F8', text2: '#B8C8DC', text3: '#8b9098',
  bg: '#0F1117', bg2: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.10)',
  teal: '#3FB6A8',
  ui: "'IBM Plex Sans', sans-serif", mono: "'IBM Plex Mono', monospace",
} as const

// ── Component ──────────────────────────────────────────────────────────────────

export function SymbolMiniCard({ data, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const retStr  = fmtReturn(data.return_1w)
  const retCol  = returnColor(data.return_1w)
  const conf    = CONF_DISPLAY[data.confirmation_level ?? 'UNKNOWN'] ?? CONF_DISPLAY['UNKNOWN']
  const yahooUrl = `https://finance.yahoo.com/quote/${data.symbol}`

  return (
    /* Backdrop */
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.62)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      {/* Card */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 400,
          background: '#14181f',
          border: `1px solid ${V.border}`,
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          padding: '14px 16px 10px',
          borderBottom: `1px solid ${V.border}`,
          background: 'rgba(255,255,255,0.02)',
        }}>
          <div>
            <div style={{
              fontFamily: V.mono, fontSize: 18, fontWeight: 700, color: V.text,
              letterSpacing: '0.04em', marginBottom: 2,
            }}>
              {data.symbol}
            </div>
            {data.company_name && (
              <div style={{ fontFamily: V.ui, fontSize: 12, color: V.text3 }}>
                {data.company_name}
              </div>
            )}
            {/* Purity badges */}
            <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
              {data.is_story_heavy && (
                <span style={{
                  fontFamily: V.mono, fontSize: 10, color: '#fbbf24',
                  border: '1px solid rgba(251,191,36,0.35)', borderRadius: 3,
                  padding: '1px 6px', letterSpacing: '0.05em',
                }}>
                  Story Heavy
                </span>
              )}
              {data.is_indirect && (
                <span style={{
                  fontFamily: V.mono, fontSize: 10, color: V.text3,
                  border: `1px solid rgba(139,144,152,0.35)`, borderRadius: 3,
                  padding: '1px 6px', letterSpacing: '0.05em',
                }}>
                  Indirect
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: V.text3, fontSize: 18, lineHeight: 1, padding: '2px 4px',
            }}
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Bucket */}
          <Row label="섹터" value={data.bucket_label} valueColor={V.teal} />

          {/* 1W Return */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: V.mono, fontSize: 11, color: V.text3, letterSpacing: '0.08em' }}>
              주가
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: V.mono, fontSize: 14, fontWeight: 700, color: retCol }}>
                {retStr}
              </span>
              <span style={{ fontFamily: V.ui, fontSize: 10, color: V.text3 }}>1주</span>
              {data.marker_type === 'fire' && (
                <svg width={14} height={14} viewBox="0 0 14 14" style={{ overflow: 'visible' }}>
                  <MoversMarker marker_type={data.marker_type} x={0} y={12} />
                </svg>
              )}
            </div>
          </div>

          {/* Earnings */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: V.mono, fontSize: 11, color: V.text3, letterSpacing: '0.08em' }}>
              실적
            </span>
            <span style={{
              fontFamily: V.mono, fontSize: 12, fontWeight: 700, color: conf.color,
              letterSpacing: '0.04em',
            }}>
              {conf.label}
            </span>
          </div>

          {/* Evidence note */}
          {data.evidence_note && (
            <NoteRow label="근거" text={data.evidence_note} color={V.text2} />
          )}

          {/* Caution note */}
          {data.caution_note && (
            <NoteRow label="주의" text={data.caution_note} color={V.text3} />
          )}

        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', gap: 8,
          padding: '10px 16px 12px',
          borderTop: `1px solid ${V.border}`,
        }}>
          <a
            href={yahooUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1, display: 'block', textAlign: 'center',
              padding: '6px 12px', borderRadius: 3,
              background: `${V.teal}14`,
              border: `1px solid ${V.teal}55`,
              fontFamily: V.mono, fontSize: 12, color: V.teal,
              letterSpacing: '0.06em', textDecoration: 'none',
            }}
          >
            Yahoo Finance →
          </a>
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px', borderRadius: 3, cursor: 'pointer',
              background: V.bg2, border: `1px solid ${V.border}`,
              fontFamily: V.mono, fontSize: 12, color: V.text3,
              letterSpacing: '0.06em',
            }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#8b9098', letterSpacing: '0.08em' }}>
        {label}
      </span>
      <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: valueColor ?? '#B8C8DC' }}>
        {value}
      </span>
    </div>
  )
}

function NoteRow({ label, text, color }: { label: string; text: string; color: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <span style={{
        fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#8b9098',
        letterSpacing: '0.08em', flexShrink: 0, marginTop: 1,
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color, lineHeight: 1.45,
      }}>
        {text}
      </span>
    </div>
  )
}
