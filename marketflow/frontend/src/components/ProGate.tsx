'use client'

/**
 * ProGate.tsx - Blur-gate for PRO-only features.
 * When plan=free (default), renders children blurred with a PRO upgrade CTA overlay.
 * When plan=pro, renders children normally.
 */
import { isFree } from '@/lib/plan'

interface ProGateProps {
  children: React.ReactNode
  /** Label shown in the gate overlay (default: 'PRO') */
  label?: string
  /** Short description shown under the PRO badge */
  description?: string
  /** Number of items visible before the gate (default: 3) */
  previewCount?: number
}

export default function ProGate({
  children,
  label = 'PRO',
  description = 'Upgrade to see all signals',
  previewCount: _previewCount = 3,
}: ProGateProps) {
  if (!isFree) return <>{children}</>

  return (
    <div style={{ position: 'relative' }}>
      {/* Blurred content */}
      <div
        style={{
          filter: 'blur(4px)',
          pointerEvents: 'none',
          userSelect: 'none',
          opacity: 0.55,
        }}
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.6rem',
          background: 'linear-gradient(to bottom, rgba(10,10,10,0) 0%, rgba(10,10,10,0.92) 60%)',
          borderRadius: 12,
          zIndex: 10,
        }}
      >
        <span
          style={{
            background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
            color: '#0a0a0a',
            fontWeight: 900,
            fontSize: '0.78rem',
            letterSpacing: '0.1em',
            padding: '3px 12px',
            borderRadius: 999,
          }}
        >
          {label}
        </span>
        <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>{description}</span>
        <span
          style={{
            color: '#4b5563',
            fontSize: '0.68rem',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6,
            padding: '2px 10px',
            marginTop: 2,
          }}
        >
          Set NEXT_PUBLIC_PLAN=pro to unlock
        </span>
      </div>
    </div>
  )
}
