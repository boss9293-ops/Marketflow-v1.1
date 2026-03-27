export type UiLang = 'ko' | 'en'

export type AiBriefingSource = {
  title?: string
  url?: string
  date?: string
}

export type AiBriefing = {
  layer: string
  title: { ko: string; en: string }
  summary: { ko: string; en: string }
  paragraphs: { ko: string[]; en: string[] }
  warnings: { ko: string[]; en: string[] }
  highlights: { ko: string[]; en: string[] }
  sources: AiBriefingSource[]
  provider: string
  model: string
  generated_at: string
  asof_day: string
  _meta?: Record<string, unknown>
}

const DEFAULT_TITLES: Record<string, { ko: string; en: string }> = {
  std_risk: { ko: '표준 리스크 브리프', en: 'Standard Risk Brief' },
  macro: { ko: '매크로 브리프', en: 'Macro Brief' },
  integrated: { ko: '통합 브리프', en: 'Integrated Brief' },
}

function textOf(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return textOf(obj.en ?? obj.ko ?? obj.text ?? obj.value ?? obj.label ?? obj.title ?? obj.summary)
  }
  return ''
}

function linesOf(value: unknown, lang: UiLang): string[] {
  if (value === null || value === undefined) return []
  if (typeof value === 'string') {
    return value
      .split(/\r?\n+/)
      .map((line) => line.replace(/^\s*[-*]\s*/, '').replace(/^\s*\d+\.\s*/, '').trim())
      .filter(Boolean)
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item.trim()
        if (item && typeof item === 'object') {
          const obj = item as Record<string, unknown>
          return textOf(obj[lang] ?? obj.en ?? obj.ko ?? obj.text ?? obj.value ?? obj.label)
        }
        return textOf(item)
      })
      .filter(Boolean)
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if (Array.isArray(obj[lang])) return linesOf(obj[lang], lang)
    if (Array.isArray(obj.en) || Array.isArray(obj.ko)) {
      return linesOf(obj[lang] ?? obj.en ?? obj.ko, lang)
    }
    return linesOf(textOf(obj[lang] ?? obj.en ?? obj.ko ?? obj.text ?? obj.value ?? obj.label ?? obj.title ?? obj.summary), lang)
  }
  return []
}

function sourceList(value: unknown): AiBriefingSource[] {
  if (!Array.isArray(value)) return []
  const sources: AiBriefingSource[] = []
  for (const item of value) {
    if (!item) continue
    if (typeof item === 'string') {
      const title = item.trim()
      if (title) {
        sources.push({ title, url: '' })
      }
      continue
    }
    if (typeof item === 'object') {
      const obj = item as Record<string, unknown>
      const title = textOf(obj.title ?? obj.name ?? obj.label ?? obj.text)
      const url = textOf(obj.url ?? obj.href)
      const date = textOf(obj.date ?? obj.as_of ?? obj.generated_at)
      if (!title && !url) continue
      sources.push({ title: title || url || 'Source', url, date: date || undefined })
    }
  }
  return sources
}

function splitContent(content: unknown, lang: UiLang): string[] {
  const raw = textOf(content)
  if (!raw) return []
  return linesOf(raw, lang)
}

function normalizeSection(raw: unknown, layerFallback: string): AiBriefing {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const layer = textOf(obj.layer) || layerFallback
  const titles = DEFAULT_TITLES[layer] || { ko: layer, en: layer }
  const titleRaw = obj.title ?? obj.headline ?? titles
  const summaryRaw = obj.summary ?? obj.headline ?? ''
  const paragraphsRaw = obj.paragraphs ?? obj.content ?? obj.body ?? ''
  const warningsRaw = obj.warnings ?? obj.notes ?? ''
  const highlightsRaw = obj.highlights ?? obj.bullets ?? ''
  const meta = obj._meta && typeof obj._meta === 'object' ? (obj._meta as Record<string, unknown>) : {}

  const paragraphsKo = linesOf(paragraphsRaw, 'ko')
  const paragraphsEn = linesOf(paragraphsRaw, 'en')
  const warningsKo = linesOf(warningsRaw, 'ko')
  const warningsEn = linesOf(warningsRaw, 'en')
  const highlightsKo = linesOf(highlightsRaw, 'ko')
  const highlightsEn = linesOf(highlightsRaw, 'en')

  return {
    layer,
    title: {
      ko: textOf((titleRaw as Record<string, unknown>)?.ko ?? titleRaw) || titles.ko,
      en: textOf((titleRaw as Record<string, unknown>)?.en ?? titleRaw) || titles.en,
    },
    summary: {
      ko: textOf((summaryRaw as Record<string, unknown>)?.ko ?? summaryRaw) || paragraphsKo[0] || '',
      en: textOf((summaryRaw as Record<string, unknown>)?.en ?? summaryRaw) || paragraphsEn[0] || '',
    },
    paragraphs: {
      ko: paragraphsKo.length ? paragraphsKo : splitContent(paragraphsRaw, 'ko'),
      en: paragraphsEn.length ? paragraphsEn : splitContent(paragraphsRaw, 'en'),
    },
    warnings: {
      ko: warningsKo,
      en: warningsEn,
    },
    highlights: {
      ko: highlightsKo,
      en: highlightsEn,
    },
    sources: sourceList(obj.sources),
    provider: textOf(obj.provider || meta.provider || 'cache') || 'cache',
    model: textOf(obj.model || meta.model || 'cached') || 'cached',
    generated_at: textOf(obj.generated_at || meta.generated_at || ''),
    asof_day: textOf(obj.asof_day || obj.asof_date || meta.asof_day || ''),
    _meta: meta,
  }
}

export function normalizeAiBriefing(raw: unknown): AiBriefing {
  return normalizeSection(raw, 'integrated')
}

export function selectBriefingTitle(briefing: AiBriefing | null | undefined, lang: UiLang): string {
  if (!briefing) return ''
  const value = briefing.title?.[lang] || briefing.title?.en || briefing.title?.ko || ''
  return value || DEFAULT_TITLES[briefing.layer]?.[lang] || ''
}

export function selectBriefingSummary(briefing: AiBriefing | null | undefined, lang: UiLang): string {
  if (!briefing) return ''
  return briefing.summary?.[lang] || briefing.summary?.en || briefing.summary?.ko || ''
}

export function selectBriefingParagraphs(briefing: AiBriefing | null | undefined, lang: UiLang): string[] {
  if (!briefing) return []
  const lines = briefing.paragraphs?.[lang] || []
  return lines.length ? lines : briefing.paragraphs?.[lang === 'ko' ? 'en' : 'ko'] || []
}

export function selectBriefingWarnings(briefing: AiBriefing | null | undefined, lang: UiLang): string[] {
  if (!briefing) return []
  const lines = briefing.warnings?.[lang] || []
  return lines.length ? lines : briefing.warnings?.[lang === 'ko' ? 'en' : 'ko'] || []
}

export function selectBriefingHighlights(briefing: AiBriefing | null | undefined, lang: UiLang): string[] {
  if (!briefing) return []
  const lines = briefing.highlights?.[lang] || []
  return lines.length ? lines : briefing.highlights?.[lang === 'ko' ? 'en' : 'ko'] || []
}
