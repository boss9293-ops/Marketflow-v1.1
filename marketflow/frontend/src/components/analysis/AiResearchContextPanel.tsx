'use client'

import { type ReactNode, useEffect, useMemo, useState } from 'react'

import { clientApiUrl } from '@/lib/backendApi'
import { normalizeTicker } from '@/lib/stockAnalysis'

type AiContext = {
  one_line_context?: string
  key_questions?: string[]
  risk_flags?: string[]
  data_quality?: string
}

type StockAiContextPayload = {
  ticker?: string
  as_of?: string
  valuation_summary?: Record<string, unknown> | null
  financial_summary?: Record<string, unknown> | null
  technical_summary?: Record<string, unknown> | null
  options_summary?: {
    summary?: Record<string, unknown> | null
    llm_context?: string | null
  } | null
  peer_summary?: Record<string, unknown> | null
  missing_data_warnings?: string[]
  ai_research_context?: AiContext
}

type Props = {
  symbol?: string
  fetchKey?: number
}

const cardStyle = {
  background: 'rgba(15,23,42,0.78)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
} as const

const mono = 'var(--font-terminal), "Nanum Gothic Coding", "Noto Sans KR", monospace'

function formatScalar(value: unknown): string {
  if (value == null) return '--'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '--'
    return Math.abs(value) >= 1000 ? value.toLocaleString() : String(value)
  }
  if (typeof value === 'string') return value || '--'
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  return '--'
}

function PreviewRows({ data, limit = 8 }: { data?: Record<string, unknown> | null; limit?: number }) {
  const rows = useMemo(() => {
    if (!data) return []
    return Object.entries(data)
      .filter(([, value]) => value == null || ['string', 'number', 'boolean'].includes(typeof value))
      .slice(0, limit)
  }, [data, limit])

  if (!rows.length) {
    return <div style={{ color: '#64748b', fontSize: 12 }}>No structured data available.</div>
  }

  return (
    <div style={{ display: 'grid', gap: 7 }}>
      {rows.map(([key, value]) => (
        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ color: '#64748b', fontSize: 12, fontFamily: mono }}>{key}</span>
          <span style={{ color: '#e2e8f0', fontSize: 12, textAlign: 'right' }}>{formatScalar(value)}</span>
        </div>
      ))}
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section style={{ ...cardStyle, padding: 13, minHeight: 170 }}>
      <div style={{ color: '#f8fafc', fontSize: 14, fontWeight: 850, marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </section>
  )
}

export default function AiResearchContextPanel({ symbol = 'AAPL', fetchKey = 0 }: Props) {
  const [payload, setPayload] = useState<StockAiContextPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ticker = normalizeTicker(symbol) || 'AAPL'
    const controller = new AbortController()
    let alive = true

    setLoading(true)
    setError(null)
    fetch(`${clientApiUrl('/api/stock-ai-context')}?ticker=${encodeURIComponent(ticker)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load AI research context')
        }
        if (alive) setPayload(data as StockAiContextPayload)
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (alive) setError(err instanceof Error ? err.message : 'Failed to load AI research context')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
      controller.abort()
    }
  }, [symbol, fetchKey])

  if (loading) {
    return (
      <div style={{ ...cardStyle, padding: 20, margin: '0.5rem', minHeight: 210 }}>
        <div style={{ color: '#67e8f9', fontSize: 11, fontFamily: mono, fontWeight: 800 }}>AI_CONTEXT</div>
        <div style={{ color: '#f8fafc', fontSize: 16, fontWeight: 850, marginTop: 10 }}>
          Preparing research input preview...
        </div>
      </div>
    )
  }

  if (error && !payload) {
    return (
      <div style={{ ...cardStyle, padding: 20, margin: '0.5rem', minHeight: 210 }}>
        <div style={{ color: '#fb7185', fontSize: 11, fontFamily: mono, fontWeight: 800 }}>CONTEXT_ERROR</div>
        <div style={{ color: '#f8fafc', fontSize: 16, fontWeight: 850, marginTop: 10 }}>
          Unable to build AI research context.
        </div>
        <div style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>{error}</div>
      </div>
    )
  }

  const context = payload?.ai_research_context || {}
  const optionsSummary = payload?.options_summary?.summary || null
  const warnings = payload?.missing_data_warnings || []

  return (
    <div style={{ maxWidth: 1260, margin: '0 auto', padding: '4px 0 18px' }}>
      <div style={{ ...cardStyle, padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
          <div>
            <div style={{ color: '#f8fafc', fontSize: 16, fontWeight: 900 }}>
              AI Research Context Preview
            </div>
            <div style={{ color: '#64748b', fontSize: 11, fontFamily: mono, marginTop: 3 }}>
              {payload?.ticker || normalizeTicker(symbol)} | as of {payload?.as_of || '--'} | LLM generation not enabled
            </div>
          </div>
          <div style={{ color: '#67e8f9', fontSize: 12, fontFamily: mono }}>
            {context.data_quality || 'partial'}
          </div>
        </div>
        {context.one_line_context ? (
          <div style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.6, marginTop: 12 }}>
            {context.one_line_context}
          </div>
        ) : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        <Section title="Valuation Summary">
          <PreviewRows data={payload?.valuation_summary} />
        </Section>
        <Section title="Financial Summary">
          <PreviewRows data={payload?.financial_summary} />
        </Section>
        <Section title="Technical Summary">
          <PreviewRows data={payload?.technical_summary} />
        </Section>
        <Section title="Options Summary">
          <PreviewRows data={optionsSummary} />
        </Section>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginTop: 12 }}>
        <Section title="Key Questions">
          <div style={{ display: 'grid', gap: 8 }}>
            {(context.key_questions || []).map((item) => (
              <div key={item} style={{ color: '#cbd5e1', fontSize: 12, lineHeight: 1.5 }}>
                {item}
              </div>
            ))}
            {!context.key_questions?.length ? <div style={{ color: '#64748b', fontSize: 12 }}>No questions generated.</div> : null}
          </div>
        </Section>
        <Section title="Missing Data Warnings">
          <div style={{ display: 'grid', gap: 7 }}>
            {warnings.map((warning) => (
              <div key={warning} style={{ color: '#fbbf24', fontSize: 12, fontFamily: mono }}>
                {warning}
              </div>
            ))}
            {!warnings.length ? <div style={{ color: '#64748b', fontSize: 12 }}>No missing data warnings.</div> : null}
          </div>
        </Section>
      </div>
    </div>
  )
}
