'use client'

import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import WatchlistSidebar from '@/components/WatchlistSidebar'
import { WatchlistProvider } from '@/contexts/WatchlistContext'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [watchlistOpen, setWatchlistOpen] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('mf_lang_mode')
      if (saved === 'en' || saved === 'ko') {
        document.documentElement.setAttribute('data-lang-mode', saved)
      }
    } catch {
      // ignore
    }
  }, [])

  return (
    <WatchlistProvider>
      <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-main)', color: 'var(--text-primary)' }}>
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        <div className="hidden md:block lg:hidden">
          <Sidebar compact />
        </div>
        <div className="md:hidden">
          <Sidebar overlay open={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />
        </div>
        <main
          className="flex-1 overflow-y-auto"
          style={{
            minWidth: 0,
            width: '100%',
          }}
        >
          <button
            type="button"
            aria-label="Open sidebar"
            onClick={() => setMobileSidebarOpen(true)}
            className="md:hidden"
            style={{
              position: 'fixed',
              top: 12,
              left: 12,
              zIndex: 70,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--text-primary)',
              borderRadius: 10,
              width: 40,
              height: 40,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem',
            }}
          >
            ☰
          </button>
          {children}
        </main>
        <button
          onClick={() => setWatchlistOpen(true)}
          style={{
            position: 'fixed',
            top: 12,
            right: 14,
            zIndex: 70,
            border: '1px solid rgba(0,217,255,0.38)',
            background: 'rgba(0,217,255,0.16)',
            color: '#67e8f9',
            borderRadius: 10,
            padding: '0.42rem 0.7rem',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Watchlist
        </button>
        <WatchlistSidebar open={watchlistOpen} onClose={() => setWatchlistOpen(false)} />
      </div>
    </WatchlistProvider>
  )
}
