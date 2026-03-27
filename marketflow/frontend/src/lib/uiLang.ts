export type UiLang = 'ko' | 'en'

export const UI_LANG_COOKIE = 'mf_ui_lang'
export const UI_LANG_STORAGE_KEY = 'mf_ui_lang'
export const LEGACY_UI_LANG_STORAGE_KEY = 'mf_lang_mode'

export function normalizeUiLang(value: unknown): UiLang {
  return value === 'en' ? 'en' : 'ko'
}

export function pickLang<T>(uiLang: UiLang, ko: T, en: T): T {
  return uiLang === 'ko' ? ko : en
}

export function readStoredUiLang(fallback: UiLang = 'ko'): UiLang {
  if (typeof window === 'undefined') return fallback

  try {
    const stored =
      window.localStorage.getItem(UI_LANG_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_UI_LANG_STORAGE_KEY)
    return normalizeUiLang(stored)
  } catch {
    return fallback
  }
}

export function persistUiLang(uiLang: UiLang) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(UI_LANG_STORAGE_KEY, uiLang)
    window.localStorage.setItem(LEGACY_UI_LANG_STORAGE_KEY, uiLang)
    document.cookie = `${UI_LANG_COOKIE}=${uiLang}; path=/; max-age=31536000; samesite=lax`
  } catch {
    // ignore persistence failures
  }
}

export function applyUiLangToDocument(uiLang: UiLang) {
  if (typeof document === 'undefined') return

  document.documentElement.setAttribute('data-lang-mode', uiLang)
  document.documentElement.setAttribute('lang', uiLang)
}
