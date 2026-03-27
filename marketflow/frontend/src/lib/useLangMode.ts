'use client'

import { useEffect, useState } from 'react'
import { normalizeUiLang, pickLang, type UiLang } from '@/lib/uiLang'

export type LangMode = UiLang

export function useUiLang(initialUiLang: UiLang = 'ko'): UiLang {
  const [mode, setMode] = useState<UiLang>(() => {
    if (typeof document === 'undefined') return initialUiLang
    return normalizeUiLang(document.documentElement.getAttribute('data-lang-mode'))
  })

  useEffect(() => {
    const sync = () => {
      setMode(normalizeUiLang(document.documentElement.getAttribute('data-lang-mode')))
    }

    sync()

    const mo = new MutationObserver(sync)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang-mode'] })
    return () => mo.disconnect()
  }, [])

  return mode
}

export function useLangMode(): UiLang {
  return useUiLang()
}

export { pickLang }
