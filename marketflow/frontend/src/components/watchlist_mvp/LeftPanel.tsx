'use client'

import { useState } from 'react'
import styles from '@/components/watchlist_mvp/watchlistMvp.module.css'
import type { Watchlist, WatchlistItem } from '@/lib/terminal-mvp/types'

type LeftPanelProps = {
  items: WatchlistItem[]
  watchlists: Watchlist[]
  selectedWatchlistId: string | null
  selectedSymbol: string
  onSelectSymbol: (symbol: string) => void
  isLoading: boolean
  errorMessage: string | null
  isEmpty: boolean
  isLoggedIn: boolean
  onAddTicker: (symbol: string, companyName: string) => Promise<void>
  onRemoveTicker: (symbol: string) => Promise<void>
}

export default function LeftPanel({
  items,
  watchlists,
  selectedWatchlistId,
  selectedSymbol,
  onSelectSymbol,
  isLoading,
  errorMessage,
  isEmpty,
  isLoggedIn,
  onAddTicker,
  onRemoveTicker,
}: LeftPanelProps) {
  const [inputValue, setInputValue] = useState('')
  const [addPending, setAddPending] = useState(false)
  const [removePending, setRemovePending] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)

  const selectedWatchlist =
    watchlists.find((w) => w.id === selectedWatchlistId) ?? watchlists[0] ?? null
  const groupLabel = (selectedWatchlist?.name ?? 'Default Watchlist').toUpperCase()

  const handleAdd = async () => {
    const sym = inputValue.trim().toUpperCase()
    if (!sym || addPending) return
    setAddPending(true)
    await onAddTicker(sym, '')
    setInputValue('')
    setAddPending(false)
  }

  const handleRemove = async (symbol: string) => {
    if (removePending) return
    setRemovePending(symbol)
    await onRemoveTicker(symbol)
    setRemovePending(null)
  }

  return (
    <aside className={`${styles.panel} ${styles.leftPanel}`}>
      <header className={styles.leftHeader}>
        <p className={styles.panelLabel}>My Watchlist</p>
        <div className={styles.leftHeaderRow}>
          <h2 className={styles.panelTitle}>Watchlist</h2>
          <div className={styles.leftHeaderActions}>
            {isLoggedIn && (
              <button
                type="button"
                className={styles.ghostButton}
                onClick={() => setEditMode((v) => !v)}
              >
                {editMode ? 'Done' : 'Edit'}
              </button>
            )}
          </div>
        </div>
      </header>

      <section className={styles.watchlistGroup}>
        <header className={styles.watchlistGroupHeader}>
          <span>{`${groupLabel} (${items.length})`}</span>
        </header>

        {isLoading && <div className={styles.panelStateBox}>Loading watchlist...</div>}

        {!isLoading && errorMessage && <div className={styles.panelStateBoxError}>{errorMessage}</div>}

        {!isLoading && !errorMessage && isEmpty && (
          <div className={styles.panelStateBox}>
            {isLoggedIn ? 'Add a ticker below to get started.' : 'Sign in to see your watchlist.'}
          </div>
        )}

        {!isLoading &&
          !errorMessage &&
          !isEmpty &&
          items.map((item) => {
            const isSelected = item.symbol === selectedSymbol
            const isDown = item.changePercent.trim().startsWith('-')

            return (
              <div key={item.symbol} className={styles.watchItemWrapper}>
                <button
                  type="button"
                  className={`${styles.watchItemRow} ${isSelected ? styles.watchItemRowSelected : ''}`}
                  aria-selected={isSelected}
                  onClick={() => onSelectSymbol(item.symbol)}
                >
                  <div className={styles.watchItemMain}>
                    <div className={styles.watchItemTopRow}>
                      <p className={styles.watchSymbol}>{item.symbol}</p>
                      <span className={isDown ? styles.watchMoveDown : styles.watchMoveUp}>
                        {item.changePercent}
                      </span>
                    </div>
                    <p className={styles.watchName}>{item.companyName}</p>
                  </div>
                </button>
                {editMode && isLoggedIn && (
                  <button
                    type="button"
                    className={styles.removeTickerButton}
                    disabled={removePending === item.symbol}
                    onClick={() => handleRemove(item.symbol)}
                    aria-label={`Remove ${item.symbol}`}
                  >
                    {removePending === item.symbol ? '…' : '×'}
                  </button>
                )}
              </div>
            )
          })}
      </section>

      {isLoggedIn && (
        <footer className={styles.addTickerArea}>
          <p className={styles.addTickerLabel}>Add Ticker</p>
          <div className={styles.addTickerRow}>
            <input
              className={styles.addTickerInput}
              placeholder="Enter symbol (e.g., MSFT)"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd() }}
              disabled={addPending}
              maxLength={10}
            />
            <button
              type="button"
              className={styles.addTickerButton}
              onClick={() => void handleAdd()}
              disabled={addPending || !inputValue.trim()}
            >
              {addPending ? '…' : 'Add'}
            </button>
          </div>
        </footer>
      )}

      {!isLoggedIn && (
        <footer className={styles.addTickerArea}>
          <p className={styles.addTickerLabel} style={{ color: 'var(--text-muted)' }}>
            Sign in to manage your watchlist
          </p>
        </footer>
      )}
    </aside>
  )
}
