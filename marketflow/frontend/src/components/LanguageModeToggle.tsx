'use client'

import type { UiLang } from '@/lib/uiLang'

type Props = {
  value: UiLang
  onChange: (next: UiLang) => void
}

export default function LanguageModeToggle({ value, onChange }: Props) {

  return (
    <div
      role="group"
      aria-label="UI language mode"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0,
        borderRadius: 4,
        border: '1px solid rgba(148,163,184,0.18)',
        background: 'rgba(255,255,255,0.03)',
        padding: 0,
        boxShadow: 'none',
      }}
    >
      {([
        { key: 'ko', label: 'KR' },
        { key: 'en', label: 'EN' },
      ] as const).map((x) => {
        const active = value === x.key
        return (
          <button
            key={x.key}
            type="button"
            onClick={() => onChange(x.key)}
            style={{
              border: '1px solid transparent',
              background: active ? '#D7FF37' : 'transparent',
              color: active ? '#0B0F14' : '#D7E1F0',
              borderRadius: 3,
              minWidth: 26,
              height: 18,
              padding: '0 4px',
              fontSize: '0.56rem',
              fontWeight: 800,
              letterSpacing: '0.05em',
              cursor: 'pointer',
              boxShadow: active ? '0 0 0 1px rgba(215,255,55,0.10)' : 'none',
            }}
            title={x.key === 'ko' ? 'Korean UI' : 'English UI'}
          >
            {x.label}
          </button>
        )
      })}
    </div>
  )
}
