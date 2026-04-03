import type { UiLang } from '@/lib/uiLang'

export type ContentLayer = 'ui' | 'engine' | 'ai' | 'source'

export type LocalizedText = {
  ko?: string
  en?: string
}

export type ContentBlock = {
  layer: ContentLayer
  kind: string
  text: LocalizedText
  meta?: Record<string, unknown>
}

const TEMPLATE_TOKEN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

export function renderTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(TEMPLATE_TOKEN, (_, key: string) => {
    const value = vars[key]
    if (value === null || value === undefined) return ''
    return String(value)
  })
}

export function renderEngineText(
  template: LocalizedText,
  vars: Record<string, string | number>
): LocalizedText {
  return {
    ko: template.ko ? renderTemplate(template.ko, vars) : undefined,
    en: template.en ? renderTemplate(template.en, vars) : undefined,
  }
}

export function selectLocalizedText(text: LocalizedText, lang: UiLang): string {
  if (lang === 'ko') return text.ko || text.en || ''
  return text.en || text.ko || ''
}

