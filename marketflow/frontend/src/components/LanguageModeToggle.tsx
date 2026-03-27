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
        gap: 4,
        borderRadius: 10,
        border: '1px solid rgba(148,163,184,0.18)',
        background: 'rgba(255,255,255,0.03)',
        padding: 4,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
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
              borderRadius: 8,
              minWidth: 48,
              height: 32,
              padding: '0 12px',
              fontSize: '0.8rem',
              fontWeight: 800,
              letterSpacing: '0.08em',
              cursor: 'pointer',
              boxShadow: active ? '0 0 0 1px rgba(215,255,55,0.12), 0 0 0 3px rgba(215,255,55,0.08)' : 'none',
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
