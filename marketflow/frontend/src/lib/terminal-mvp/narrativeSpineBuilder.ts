import type { DensityCluster } from '@/lib/terminal-mvp/clusterEngine'
import type { ConfidenceResult } from '@/lib/terminal-mvp/confidenceEngine'
import type { RelativeViewResult } from '@/lib/terminal-mvp/multiSymbolEngine'
import type { TimelineFlowResult } from '@/lib/terminal-mvp/timelineEngine'
import { buildPriceAnchorLayer, type PriceAnchorResult } from '@/lib/terminal-mvp/priceAnchorLayer'

export type NarrativeSpine = {
  PRICE: string
  TIMELINE: string
  CATALYST: string
  INSTITUTION: string
  NUMBERS: string
  RELATIVE_VIEW: string
  CONFIDENCE: string
  RISK: string
}

export type NarrativeSpineInput = {
  symbol: string
  price: number | null
  changePct: number | null
  thesis: string
  clusters: DensityCluster[]
  session?: 'morning' | 'afternoon' | 'auto'
  timeline?: TimelineFlowResult | null
  confidence?: ConfidenceResult | null
  relativeView?: RelativeViewResult | null
  priceAnchor?: PriceAnchorResult | null
}

const uniqueSnippets = (texts: string[]): string[] => {
  const seen = new Set<string>()
  const snippets: string[] = []
  for (const text of texts) {
    const matches = text.match(/\$?\d{1,3}(?:,\d{3})*(?:\.\d+)?(?:%|[BbMmKk])?|\d+(?:\.\d+)?\s?(?:million|billion|trillion|units|shares|points?)/gi) ?? []
    for (const match of matches) {
      const cleaned = match.trim()
      if (!cleaned || seen.has(cleaned)) continue
      seen.add(cleaned)
      snippets.push(cleaned)
      if (snippets.length >= 3) return snippets
    }
  }
  return snippets
}

const firstClusterByType = (clusters: DensityCluster[], type: DensityCluster['type']): DensityCluster | null =>
  clusters.find((cluster) => cluster.type === type) ?? null

const firstNonPrimaryCluster = (clusters: DensityCluster[], primaryId?: string): DensityCluster | null =>
  clusters.find((cluster) => cluster.clusterId !== primaryId) ?? null

const buildTimelinePhrase = (timeline?: TimelineFlowResult | null): string => {
  if (!timeline) {
    return 'Intraday flow stayed event-driven with the tape reacting to the same core catalysts.'
  }

  const entries = timeline.phaseEntries
  if (!entries.length) {
    return timeline.line || 'Intraday flow stayed event-driven with the tape reacting to the same core catalysts.'
  }

  const phaseSummary = entries
    .slice(0, 3)
    .map((entry) => `${entry.phase}: ${entry.event.replace(/^[A-Z][a-z]+:\s*/u, '')}`)
    .join(' -> ')

  return phaseSummary || timeline.line
}

export function buildNarrativeSpine(input: NarrativeSpineInput): NarrativeSpine {
  const {
    symbol,
    price,
    changePct,
    thesis,
    clusters,
    session = 'auto',
    timeline,
    confidence,
    relativeView,
    priceAnchor,
  } = input

  const primary = clusters[0] ?? null
  const secondary = firstNonPrimaryCluster(clusters, primary?.clusterId)
  const analystCluster = firstClusterByType(clusters, 'analyst')
  const macroCluster = firstClusterByType(clusters, 'macro')
  const companyCluster = firstClusterByType(clusters, 'company_event')
  const earningsCluster = firstClusterByType(clusters, 'earnings')
  const sectorCluster = firstClusterByType(clusters, 'sector')
  const priceActionCluster = firstClusterByType(clusters, 'price_action')

  const anchor = priceAnchor ?? buildPriceAnchorLayer({
    symbol,
    price,
    changePct,
    timeline,
    session,
  })
  const pricePhrase = anchor.line

  const timelinePhrase = timeline?.line
    ? timeline.line
    : buildTimelinePhrase(timeline)

  const numberSnippets = uniqueSnippets([
    thesis,
    timelinePhrase,
    primary?.summary ?? '',
    secondary?.summary ?? '',
    ...clusters.map((cluster) => `${cluster.summary} ${cluster.eventTags.join(' ')}`),
  ])
  const numbersPhrase = numberSnippets.length
    ? `Numbers in view: ${numberSnippets.join(', ')}.`
    : ''

  const catalystPhrase = thesis || `${symbol} is trading on clustered catalysts and tape-sensitive positioning.`

  const institutionPhrase = analystCluster
    ? `Analysts flagged ${analystCluster.count} linked updates.`
    : macroCluster
      ? `Macro catalysts in play.`
      : ''

  const relativePhrase = relativeView?.line
    || ''

  const confidencePhrase = confidence?.line
    || ''

  const riskSource = firstNonPrimaryCluster(clusters, primary?.clusterId)
    ?? priceActionCluster
    ?? secondary
    ?? macroCluster
    ?? companyCluster
    ?? earningsCluster

  const riskPhrase = (() => {
    const base = riskSource?.summary?.trim() || ''
    if ((changePct ?? 0) < 0) {
      return base
        ? `Risk: further pressure from ${base.toLowerCase()} could extend downside.`
        : ''
    }
    return base
      ? `Risk: any fade in ${base.toLowerCase()} could cap follow-through.`
      : ''
  })()

  return {
    PRICE: pricePhrase,
    TIMELINE: timelinePhrase,
    CATALYST: catalystPhrase,
    INSTITUTION: institutionPhrase,
    NUMBERS: numbersPhrase,
    RELATIVE_VIEW: relativePhrase,
    CONFIDENCE: confidencePhrase,
    RISK: riskPhrase,
  }
}
