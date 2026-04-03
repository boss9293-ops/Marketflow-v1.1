'use client'

import { useEffect, useState } from 'react'
import { SessionProvider } from 'next-auth/react'
import Sidebar from '@/components/Sidebar'
import WatchlistSidebar from '@/components/WatchlistSidebar'
import { WatchlistProvider } from '@/contexts/WatchlistContext'
import { AuthProvider } from '@/contexts/AuthContext'
import UserPlanBadge from '@/components/subscription/UserPlanBadge'
import LanguageModeToggle from '@/components/LanguageModeToggle'
import {
  applyContentLangToDocument,
  applyUiLangToDocument,
  persistContentLang,
  persistUiLang,
  readStoredContentLang,
  readStoredUiLang,
  type ContentLang,
  type UiLang,
} from '@/lib/uiLang'
import { pickLang } from '@/lib/useLangMode'
import { UI_TEXT } from '@/lib/uiText'

export default function ClientLayout({
  children,
  initialUiLang,
  initialContentLang,
}: {
  children: React.ReactNode
  initialUiLang: UiLang
  initialContentLang: ContentLang
}) {
  const [watchlistOpen, setWatchlistOpen] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [uiLang, setUiLang] = useState<UiLang>(initialUiLang)
  const [contentLang, setContentLang] = useState<ContentLang>(initialContentLang)

  useEffect(() => {
    const saved = readStoredUiLang(initialUiLang)
    if (saved !== uiLang) {
      setUiLang(saved)
    }
    const savedContent = readStoredContentLang(initialContentLang)
    if (savedContent !== contentLang) {
      setContentLang(savedContent)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUiLang, initialContentLang])

  useEffect(() => {
    applyUiLangToDocument(uiLang)
    persistUiLang(uiLang)
  }, [uiLang])

  useEffect(() => {
    applyContentLangToDocument(contentLang)
    persistContentLang(contentLang)
  }, [contentLang])

  return (
    <SessionProvider>
      <AuthProvider>
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
                &#x2630;
              </button>
              {children}
            </main>
            {/* Top-right controls */}
            <div style={{ position: 'fixed', top: 12, right: 14, zIndex: 70, display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserPlanBadge />
              <LanguageModeToggle
                value={uiLang}
                onChange={(next) => {
                  // Keep legacy behavior for now: UI and content language move together.
                  setUiLang(next)
                  setContentLang(next)
                }}
              />
              <button
                onClick={() => setWatchlistOpen(true)}
                style={{
                  border: '1px solid rgba(0,217,255,0.38)',
                  background: 'rgba(0,217,255,0.16)',
                  color: '#67e8f9',
                  borderRadius: 10,
                  padding: '0.42rem 0.7rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title={pickLang(uiLang, UI_TEXT.common.openWatchlist.ko, UI_TEXT.common.openWatchlist.en)}
              >
                {pickLang(uiLang, UI_TEXT.nav.watchlist.ko, UI_TEXT.nav.watchlist.en)}
              </button>
            </div>
            <WatchlistSidebar open={watchlistOpen} onClose={() => setWatchlistOpen(false)} />
          </div>
        </WatchlistProvider>
      </AuthProvider>
    </SessionProvider>
  )
}
