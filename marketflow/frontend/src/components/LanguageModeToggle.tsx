'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'mf_lang_mode'
type LangMode = 'en' | 'ko'

function applyMode(mode: LangMode) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-lang-mode', mode)
}

export default function LanguageModeToggle() {
  const [mode, setMode] = useState<LangMode>('ko')

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      const next = saved === 'en' ? 'en' : 'ko'
      setMode(next)
      applyMode(next)
    } catch {
      applyMode('ko')
    }
  }, [])

  function onChange(next: LangMode) {
    setMode(next)
    applyMode(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore
    }
  }

  return (
    <div
      role="group"
      aria-label="Language mode"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.02)',
        padding: 4,
      }}
    >
      {([
        { key: 'en', label: 'EN' },
        { key: 'ko', label: 'KR' },
      ] as const).map((x) => {
        const active = mode === x.key
        return (
          <button
            key={x.key}
            type="button"
            onClick={() => onChange(x.key)}
            style={{
              border: '1px solid transparent',
              background: active ? '#D7FF37' : 'transparent',
              color: active ? '#0B0F14' : '#CBD5E1',
              borderRadius: 8,
              minWidth: 46,
              height: 32,
              padding: '0 10px',
              fontSize: '0.86rem',
              fontWeight: 800,
              letterSpacing: '0.03em',
              cursor: 'pointer',
            }}
          >
            {x.label}
          </button>
        )
      })}
    </div>
  )
}

