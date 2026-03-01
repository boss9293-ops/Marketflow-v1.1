'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CSSProperties, useEffect, useState, ReactNode } from 'react'
import { ChevronDown, ScanSearch } from 'lucide-react'
import BilLabel from '@/components/BilLabel'

// ── Zone 1: Market OS ────────────────────────────────────────────────────────
const osItems = [
  { href: '/context',  label: { ko: '시장 컨텍스트', en: 'Market Context' }, subLabel: { ko: '환경·구조·상태 해석', en: 'Environment/Structure/State' }, dot: '#93c5fd' },
  { href: '/state', label: { ko: '시장 상태', en: 'Market State' }, subLabel: { ko: '오늘의 상태', en: 'Current State' }, dot: '#c4ff0d' },
  { href: '/health',   label: { ko: '시장 건강', en: 'Market Health' }, subLabel: { ko: '구조 진단', en: 'Structural Diagnostic' }, dot: '#00D9FF' },
  { href: '/macro',    label: { ko: '매크로', en: 'Macro Layer' }, subLabel: { ko: '환경 압력', en: 'Environment Pressure' }, dot: '#38bdf8' },
  { href: '/opportunity-signals', label: { ko: '기회 신호', en: 'Opportunity Signals' }, subLabel: { ko: 'VCP', en: 'Pattern Scanner' }, dot: '#22c55e', icon: 'scan' as const },
  { href: '/sectors',     label: { ko: '섹터', en: 'Sectors' }, dot: '#14b8a6' },
  { href: '/briefing',    label: { ko: '데일리 브리핑', en: 'Briefing' }, dot: '#a855f7' },
  { href: '/dashboard', label: { ko: '커맨드 센터', en: 'Command Center' }, dot: '#22c55e' },
]

// ── Zone 2: Crash Override ───────────────────────────────────────────────────
const crashItems = [
  { href: '/crash', label: { ko: '크래시 엔진', en: 'Crash Engine' }, dot: '#ef4444' },
]

// ── Zone 3: Tools ────────────────────────────────────────────────────────────
const toolItems = [
  { href: '/portfolio', label: { ko: '포트폴리오', en: 'Portfolio' }, dot: '#38bdf8' },
  { href: '/retirement', label: { ko: '은퇴', en: 'Retirement' }, dot: '#86efac' },
  { href: '/calendar',  label: { ko: '캘린더', en: 'Calendar' }, dot: '#84cc16' },
  { href: '/chart',     label: { ko: '차트', en: 'Chart' }, dot: '#22d3ee' },
]

// ── KR Market (collapsed by default) ────────────────────────────────────────
const krItems = [
  { href: '/kr-market',             label: { ko: '개요', en: 'Overview' }, dot: '#f43f5e' },
  { href: '/kr-market/signals',     label: { ko: '시그널', en: 'Signals' }, dot: '#f59e0b' },
  { href: '/kr-market/ai-history',  label: { ko: 'AI 히스토리', en: 'AI History' }, dot: '#a855f7' },
  { href: '/kr-market/performance', label: { ko: '성과', en: 'Performance' }, dot: '#22c55e' },
]

const baseLinkStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.62rem',
  padding: '0.52rem 0.78rem 0.52rem 1.56rem',
  textDecoration: 'none',
  color: '#8f97ab',
  fontSize: '0.84rem',
  borderRadius: 10,
  margin: '0.1rem 0.5rem',
  transition: 'all 140ms ease',
}

function NavLinks({
  items,
  pathname,
  vrStyle,
  compact,
  onNavigate,
}: {
  items: Array<{ href: string; label: { ko: string; en: string }; subLabel?: { ko: string; en: string }; dot: string; icon?: 'scan' }>
  pathname: string
  vrStyle?: boolean
  compact?: boolean
  onNavigate?: () => void
}) {
  return (
    <nav style={{ marginTop: '0.06rem' }}>
      {items.map((item) => {
        const isActive =
          item.href === '/'
            ? pathname === '/'
            : pathname === item.href || pathname.startsWith(item.href + '/')
        const activeBg = vrStyle
          ? 'linear-gradient(90deg, rgba(239,68,68,0.2), rgba(239,68,68,0.06))'
          : 'linear-gradient(90deg, rgba(245,158,11,0.2), rgba(245,158,11,0.06))'
        const activeBorder = vrStyle ? 'rgba(239,68,68,0.28)' : 'rgba(245,158,11,0.28)'
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              ...baseLinkStyle,
              color: isActive ? '#f4f7ff' : '#8f97ab',
              background: isActive ? activeBg : 'transparent',
              border: isActive ? `1px solid ${activeBorder}` : '1px solid transparent',
              padding: compact ? '0.52rem 0.62rem 0.52rem 0.9rem' : baseLinkStyle.padding,
              justifyContent: compact ? 'center' : 'flex-start',
            }}
            onClick={onNavigate}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.035)'
                e.currentTarget.style.color = '#dde3f3'
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = '#8f97ab'
              }
            }}
          >
            {'icon' in item && item.icon === 'scan' && !compact && (
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 6,
                  background: 'rgba(34,197,94,0.10)',
                  border: '1px solid rgba(34,197,94,0.22)',
                  color: '#86efac',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginLeft: -2,
                }}
              >
                <ScanSearch size={11} />
              </span>
            )}
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background: item.dot,
                boxShadow: `0 0 ${vrStyle ? '10px' : '7px'} ${item.dot}${vrStyle ? 'cc' : '66'}`,
                flexShrink: 0,
              }}
            />
            <span style={{ lineHeight: 1, color: 'inherit', minWidth: 0, display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <BilLabel ko={item.label.ko} en={item.label.en} variant="micro" showEn={!compact} />
              {!compact && 'subLabel' in item && item.subLabel && (
                <span style={{ color: '#6b7892', marginTop: 2, lineHeight: 1 }}>
                  <BilLabel ko={item.subLabel.ko} en={item.subLabel.en} variant="micro" showEn={false} />
                </span>
              )}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}

function ZoneHeader({
  icon,
  label,
  badge,
  badgeColor,
  onClick,
  isOpen,
  compact,
}: {
  icon: ReactNode
  label: string
  badge?: string
  badgeColor?: string
  onClick: () => void
  isOpen: boolean
  compact?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(255,255,255,0.04)',
        borderRadius: 10,
        color: '#e8edf9',
        fontWeight: 700,
        padding: '0.55rem 0.7rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        cursor: 'pointer',
        justifyContent: compact ? 'center' : 'flex-start',
      }}
    >
      {icon}
      {!compact && <span style={{ fontSize: '0.82rem', letterSpacing: '0.04em' }}>{label}</span>}
      {badge && (
        <span
          style={{
            marginLeft: compact ? 0 : 'auto',
            fontSize: '0.62rem',
            color: badgeColor || '#9ca3af',
            border: `1px solid ${badgeColor || '#9ca3af'}44`,
            borderRadius: 999,
            padding: '1px 6px',
            fontWeight: 700,
          }}
        >
          {badge}
        </span>
      )}
      <ChevronDown
        size={13}
        style={{
          marginLeft: compact ? 0 : badge ? 4 : 'auto',
          color: '#8e97ac',
          transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
          transition: 'transform 130ms ease',
          flexShrink: 0,
        }}
      />
    </button>
  )
}

export default function Sidebar({
  compact = false,
  overlay = false,
  open = true,
  onClose,
}: {
  compact?: boolean
  overlay?: boolean
  open?: boolean
  onClose?: () => void
}) {
  const pathname = usePathname()
  const [osOpen, setOsOpen]       = useState(true)
  const [crashOpen, setCrashOpen] = useState(true)
  const [toolsOpen, setToolsOpen] = useState(true)
  const [krOpen, setKrOpen]       = useState(false)

  useEffect(() => {
    if (!overlay || !open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [overlay, open, onClose])

  useEffect(() => {
    if (!overlay || !open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [overlay, open])

  const aside = (
    <aside
      style={{
        width: compact ? 96 : 232,
        minWidth: compact ? 96 : 232,
        height: '100vh',
        overflowY: 'auto',
        background: 'linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg-main) 100%)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        boxShadow: 'inset -1px 0 0 rgba(255,255,255,0.02)',
        padding: compact ? '0.7rem 0' : '0.92rem 0',
      }}
    >
      {/* Logo */}
      <div style={{ padding: compact ? '0 0.5rem 0.8rem' : '0 0.82rem 0.92rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: compact ? '0.35rem' : '0.62rem', justifyContent: compact ? 'center' : 'flex-start' }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: 'linear-gradient(140deg, #3b82f6, #0ea5e9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#e8f1ff',
              fontWeight: 800,
              fontSize: '0.92rem',
              flexShrink: 0,
            }}
          >
            M
          </div>
          {!compact && (
            <div style={{ color: '#f2f5ff', fontWeight: 800, lineHeight: 1 }}>
              <span style={{ fontSize: '1.25rem' }}>Market</span>
              <span style={{ color: '#3b82f6', fontSize: '1.25rem' }}>Flow</span>
            </div>
          )}
        </div>
      </div>

      {/* Zone 1: MARKET OS */}
      <div style={{ padding: compact ? '0.65rem 0.4rem 0.15rem' : '0.78rem 0.5rem 0.2rem' }}>
        <ZoneHeader
          icon={<span style={{ fontSize: '0.82rem' }}>📊</span>}
          label={compact ? 'OS' : 'MARKET OS'}
          onClick={() => setOsOpen((p) => !p)}
          isOpen={osOpen}
          compact={compact}
        />
      </div>
      {osOpen && <NavLinks items={osItems} pathname={pathname} compact={compact} onNavigate={overlay ? onClose : undefined} />}

      {/* Zone 2: CRASH OVERRIDE */}
      <div
        style={{
          marginTop: '0.72rem',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: '0.58rem',
          paddingLeft: compact ? '0.4rem' : '0.5rem',
          paddingRight: compact ? '0.4rem' : '0.5rem',
        }}
      >
        <ZoneHeader
          icon={<span style={{ fontSize: '0.86rem' }}>⚡</span>}
          label={compact ? 'CRASH' : 'CRASH OVERRIDE'}
          badge="VR"
          badgeColor="#ef4444"
          onClick={() => setCrashOpen((p) => !p)}
          isOpen={crashOpen}
          compact={compact}
        />
      </div>
      {crashOpen && <NavLinks items={crashItems} pathname={pathname} vrStyle compact={compact} onNavigate={overlay ? onClose : undefined} />}

      {/* Zone 3: TOOLS */}
      <div
        style={{
          marginTop: '0.72rem',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: '0.58rem',
          paddingLeft: compact ? '0.4rem' : '0.5rem',
          paddingRight: compact ? '0.4rem' : '0.5rem',
        }}
      >
        <ZoneHeader
          icon={<span style={{ fontSize: '0.82rem', color: '#9ca3af' }}>🛠</span>}
          label="TOOLS"
          onClick={() => setToolsOpen((p) => !p)}
          isOpen={toolsOpen}
          compact={compact}
        />
      </div>
      {toolsOpen && <NavLinks items={toolItems} pathname={pathname} compact={compact} onNavigate={overlay ? onClose : undefined} />}

      {/* KR Market (collapsed) */}
      <div
        style={{
          marginTop: '0.72rem',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: '0.58rem',
          paddingLeft: compact ? '0.4rem' : '0.5rem',
          paddingRight: compact ? '0.4rem' : '0.5rem',
        }}
      >
        <ZoneHeader
          icon={<span style={{ fontSize: '0.82rem' }}>🇰🇷</span>}
          label={compact ? 'KR' : 'KR MARKET'}
          onClick={() => setKrOpen((p) => !p)}
          isOpen={krOpen}
          compact={compact}
        />
      </div>
      {krOpen && <NavLinks items={krItems} pathname={pathname} compact={compact} onNavigate={overlay ? onClose : undefined} />}
    </aside>
  )

  if (!overlay) return aside
  if (!open) return null

  return (
    <>
      <button
        type="button"
        aria-label="Close sidebar backdrop"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.52)',
          zIndex: 89,
          border: 'none',
          cursor: 'pointer',
        }}
      />
      <div style={{ position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 90 }}>
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 10,
            right: -46,
            width: 40,
            height: 40,
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(17,22,28,0.92)',
            color: '#e5e7eb',
            cursor: 'pointer',
            zIndex: 91,
          }}
        >
          ✕
        </button>
        {aside}
      </div>
    </>
  )
}
