'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useWatchlist } from '@/contexts/WatchlistContext'

type Props = {
  open: boolean
  onClose: () => void
}

export default function WatchlistSidebar({ open, onClose }: Props) {
  const router = useRouter()
  const { items, selectedSymbol, setSelectedSymbol, addSymbol, removeSymbol, loading } = useWatchlist()
  const [symbolInput, setSymbolInput] = useState('')
  const [errorText, setErrorText] = useState('')

  async function onAdd(e: FormEvent) {
    e.preventDefault()
    setErrorText('')
    const result = await addSymbol(symbolInput)
    if (!result.ok) {
      setErrorText(result.message || 'Failed to add symbol.')
      return
    }
    if (result.message) setErrorText(result.message)
    setSymbolInput('')
  }

  async function onRemove(symbol: string) {
    setErrorText('')
    const result = await removeSymbol(symbol)
    if (!result.ok) setErrorText(result.message || 'Failed to remove symbol.')
  }

  function onSelect(symbol: string) {
    setSelectedSymbol(symbol)
    router.push(`/chart/${encodeURIComponent(symbol)}`)
    onClose()
  }

  return (
    <>
      {open && (
        <button
          aria-label="close-watchlist-overlay"
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            border: 0,
            zIndex: 79,
          }}
        />
      )}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          left: 'auto',
          height: '100dvh',
          width: 'clamp(240px, 22vw, 300px)',
          maxWidth: 'calc(100vw - 12px)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 180ms ease',
          zIndex: 80,
          background: 'linear-gradient(180deg, #101319 0%, #0d1016 100%)',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '-10px 0 24px rgba(0,0,0,0.45)',
          borderRadius: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '0.95rem 0.95rem 0.7rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: '#f4f6fb', fontWeight: 800, fontSize: '0.96rem' }}>Watchlist</div>
            <div style={{ color: '#6b7280', fontSize: '0.72rem' }}>{loading ? 'loading...' : `${items.length} symbols`}</div>
          </div>
          <button onClick={onClose} style={{ border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.05)', color: '#d1d5db', borderRadius: 8, padding: '0.3rem 0.55rem', cursor: 'pointer' }}>
            Close
          </button>
        </div>

        <form onSubmit={onAdd} style={{ padding: '0.82rem 0.95rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 6 }}>
          <input
            value={symbolInput}
            onChange={(e) => setSymbolInput(e.target.value)}
            placeholder="Add symbol (e.g., AAPL)"
            style={{
              flex: 1,
              border: '1px solid rgba(255,255,255,0.16)',
              background: 'rgba(255,255,255,0.04)',
              color: '#f4f6fb',
              borderRadius: 8,
              padding: '0.44rem 0.55rem',
              fontSize: '0.8rem',
            }}
          />
          <button type="submit" style={{ border: '1px solid rgba(0,217,255,0.35)', background: 'rgba(0,217,255,0.14)', color: '#67e8f9', borderRadius: 8, padding: '0.44rem 0.65rem', cursor: 'pointer', fontWeight: 700 }}>
            Add
          </button>
        </form>

        {errorText ? (
          <div style={{ color: '#fca5a5', fontSize: '0.75rem', padding: '0.5rem 0.95rem 0.2rem' }}>{errorText}</div>
        ) : null}

        <div style={{ overflowY: 'auto', padding: '0.65rem 0.65rem 1rem' }}>
          {items.length === 0 ? (
            <div style={{ color: '#6b7280', fontSize: '0.82rem', padding: '0.35rem 0.3rem' }}>
              No symbols yet. Add one to open chart.
            </div>
          ) : (
            items.map((item) => {
              const active = item.symbol === selectedSymbol
              return (
                <div
                  key={item.symbol}
                  style={{
                    margin: '0.3rem 0',
                    border: active ? '1px solid rgba(0,217,255,0.35)' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10,
                    background: active ? 'rgba(0,217,255,0.1)' : 'rgba(255,255,255,0.03)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '0.45rem 0.55rem',
                  }}
                >
                  <button
                    onClick={() => onSelect(item.symbol)}
                    style={{ background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', flex: 1, color: '#f4f6fb' }}
                  >
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{item.symbol}</span>
                      {item.known === false ? (
                        <span style={{ fontSize: '0.62rem', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.35)', background: 'rgba(251,191,36,0.1)', borderRadius: 999, padding: '0.04rem 0.3rem' }}>
                          unknown
                        </span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#8b93a8' }}>{item.name || item.label || 'No label'}</div>
                  </button>
                  <button
                    onClick={() => onRemove(item.symbol)}
                    title={`Remove ${item.symbol}`}
                    style={{ border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.12)', color: '#fca5a5', borderRadius: 7, padding: '0.2rem 0.45rem', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 800, lineHeight: 1 }}
                  >
                    x
                  </button>
                </div>
              )
            })
          )}
        </div>
      </aside>
    </>
  )
}
