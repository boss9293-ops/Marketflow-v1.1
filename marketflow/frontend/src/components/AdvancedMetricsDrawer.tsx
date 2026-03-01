'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import BilLabel from '@/components/BilLabel'

type Props = {
  warnings?: string[]
  children: ReactNode
}

export default function AdvancedMetricsDrawer({ warnings = [], children }: Props) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          borderRadius: 10,
          border: '1px solid rgba(59,130,246,0.28)',
          background: 'rgba(37,99,235,0.10)',
          color: '#EAF2FF',
          padding: '0.45rem 0.8rem',
          cursor: 'pointer',
          minHeight: 40,
        }}
      >
        <BilLabel ko="고급 지표" en="Advanced" variant="micro" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2,6,23,0.56)',
            zIndex: 80,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(780px, 100vw)',
              height: '100%',
              background: '#070B10',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
              padding: '0.95rem',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.9rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div style={{ color: '#F8FAFC' }}>
                <BilLabel ko="고급 드릴다운" en="Advanced Metrics" variant="title" />
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close advanced drawer"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.10)',
                  background: 'rgba(255,255,255,0.02)',
                  color: '#E2E8F0',
                  cursor: 'pointer',
                  fontSize: '1.1rem',
                }}
              >
                ×
              </button>
            </div>

            {warnings.length > 0 && (
              <section
                style={{
                  background: '#0B0F14',
                  border: '1px solid rgba(245,158,11,0.18)',
                  borderRadius: 12,
                  padding: '0.8rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ color: '#FBBF24' }}>
                  <BilLabel ko="개발자 경고" en="Developer Warnings" variant="micro" />
                </div>
                {warnings.slice(0, 8).map((w, idx) => (
                  <div key={`${idx}-${w}`} style={{ color: '#D7E2EF', fontSize: '0.92rem', lineHeight: 1.35 }}>
                    {w}
                  </div>
                ))}
              </section>
            )}

            {children}
          </aside>
        </div>
      )}
    </>
  )
}
