/**
 * briefGenerator.ts — Stage 2
 * Combines filtered MarketEvent[] + price data → 5-part MarketBrief.
 * Template-based (no LLM required). LLM prompt string also exported for optional use.
 */

import type { MarketEvent, EventSentiment } from './eventExtractor'

// ─── TYPES ─────────────────────────────────────────────────────────────────

export type PriceSnap = {
  symbol: string
  price: number
  change1d: number    // % e.g. -2.3
  change1w?: number   // % optional
  name?: string
}

export type BriefPart = {
  label: string   // "SIGNAL" | "EVENT" | "CONTEXT" | "WATCH" | "RISK"
  body: string
}

export type MarketBrief = {
  generatedAt: string
  sentiment: EventSentiment
  signalStrength: number   // 0–10 (avg directness of top events)
  parts: [BriefPart, BriefPart, BriefPart, BriefPart, BriefPart]
  leadEvent: MarketEvent | null
  promptText: string       // ready-to-send LLM prompt for stage 2 upgrade
}

// ─── SENTIMENT CONFIG ──────────────────────────────────────────────────────

const SENTIMENT_EMOJI: Record<EventSentiment, string> = {
  bullish: '🟢',
  bearish: '🔴',
  neutral: '🟡',
}

const SENTIMENT_LABEL: Record<EventSentiment, string> = {
  bullish: 'BULL',
  bearish: 'BEAR',
  neutral: 'NEUTRAL',
}

// ─── RISK LEVEL ────────────────────────────────────────────────────────────

type RiskLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4'

function inferRiskLevel(events: MarketEvent[], priceData: PriceSnap[]): RiskLevel {
  const bearCount = events.filter((e) => e.sentiment === 'bearish').length
  const totalCount = events.length || 1
  const bearRatio = bearCount / totalCount

  // Check price weakness
  const qqq = priceData.find((p) => p.symbol === 'QQQ')
  const spy = priceData.find((p) => p.symbol === 'SPY')
  const avgChange = [qqq?.change1d, spy?.change1d].filter((v): v is number => v !== undefined)
  const mktChange = avgChange.length ? avgChange.reduce((a, b) => a + b, 0) / avgChange.length : 0

  if (mktChange < -3 || bearRatio > 0.8) return 'L4'
  if (mktChange < -2 || bearRatio > 0.65) return 'L3'
  if (mktChange < -1 || bearRatio > 0.5) return 'L2'
  if (mktChange < 0 || bearRatio > 0.35) return 'L1'
  return 'L0'
}

const RISK_LABEL: Record<RiskLevel, string> = {
  L0: 'L0 NORMAL — No elevated risk signals',
  L1: 'L1 CAUTION — Minor stress detected',
  L2: 'L2 WARNING — Risk elevated, reduce size',
  L3: 'L3 HIGH RISK — Defensive posture',
  L4: 'L4 CRISIS — Capital preservation mode',
}

// ─── PART BUILDERS ─────────────────────────────────────────────────────────

function buildSignalPart(events: MarketEvent[], priceData: PriceSnap[]): BriefPart {
  // Aggregate sentiment — weighted by directness (high-signal events count more)
  const bullWeight = events.filter((e) => e.sentiment === 'bullish').reduce((sum, e) => sum + e.directness, 0)
  const bearWeight = events.filter((e) => e.sentiment === 'bearish').reduce((sum, e) => sum + e.directness, 0)
  const overall: EventSentiment = bullWeight > bearWeight ? 'bullish' : bearWeight > bullWeight ? 'bearish' : 'neutral'

  const qqq = priceData.find((p) => p.symbol === 'QQQ')
  const qqqStr = qqq
    ? ` | QQQ ${qqq.change1d >= 0 ? '+' : ''}${qqq.change1d.toFixed(2)}%`
    : ''

  const topEvent = events[0]
  const summary = topEvent
    ? `${topEvent.subject || topEvent.source}: ${topEvent.headline.slice(0, 80)}`
    : 'No high-directness events'

  return {
    label: 'SIGNAL',
    body: `${SENTIMENT_EMOJI[overall]} ${SENTIMENT_LABEL[overall]}${qqqStr} — ${summary}`,
  }
}

function buildEventPart(leadEvent: MarketEvent | null, allEvents: MarketEvent[]): BriefPart {
  if (!leadEvent) {
    return { label: 'EVENT', body: 'No direct market-moving events extracted.' }
  }

  const verb = leadEvent.actionVerb ? ` ${leadEvent.actionVerb}` : ''
  const mag = leadEvent.magnitude ? ` (${leadEvent.magnitude})` : ''
  const assets = leadEvent.assets.length ? ` → ${leadEvent.assets.slice(0, 3).join(', ')}` : ''
  const body = `${leadEvent.subject}${verb}${mag}${assets} · ${leadEvent.cluster.toUpperCase()} · directness ${leadEvent.directness}/10`

  const secondary = allEvents.slice(1, 3)
  const secondaryLines = secondary
    .map((e) => `• ${e.headline.slice(0, 70)}`)
    .join('\n')

  return {
    label: 'EVENT',
    body: secondary.length ? `${body}\n${secondaryLines}` : body,
  }
}

function buildContextPart(events: MarketEvent[], priceData: PriceSnap[]): BriefPart {
  const clusterMap = new Map<string, number>()
  for (const e of events) {
    clusterMap.set(e.cluster, (clusterMap.get(e.cluster) ?? 0) + 1)
  }
  const topClusters = [...clusterMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([k]) => k.toUpperCase())

  const priceLines = priceData
    .filter((p) => ['QQQ', 'SPY', 'IWM', 'VIX'].includes(p.symbol))
    .map((p) => `${p.symbol} ${p.change1d >= 0 ? '+' : ''}${p.change1d.toFixed(2)}%`)
    .join(' | ')

  const body = [
    `Focus areas: ${topClusters.join(', ')}`,
    priceLines ? `Key levels: ${priceLines}` : null,
    `${events.length} events screened, ${events.filter((e) => e.directness >= 6).length} high-signal.`,
  ]
    .filter(Boolean)
    .join('\n')

  return { label: 'CONTEXT', body }
}

function buildWatchPart(events: MarketEvent[], priceData: PriceSnap[]): BriefPart {
  const leadEvent = events[0] ?? null
  const leadId = leadEvent?.id

  // Line 1: top weighted asset + price
  const assetCounts = new Map<string, number>()
  for (const e of events) {
    for (const a of e.assets) {
      assetCounts.set(a, (assetCounts.get(a) ?? 0) + e.directness)
    }
  }
  const topAsset = [...assetCounts.entries()].sort((a, b) => b[1] - a[1])[0]
  const price = topAsset ? priceData.find((p) => p.symbol === topAsset[0]) : null
  const priceStr = price
    ? ` $${price.price.toFixed(2)} (${price.change1d >= 0 ? '+' : ''}${price.change1d.toFixed(2)}%)`
    : ''

  const lines: string[] = []
  if (topAsset) lines.push(`${topAsset[0]}${priceStr}`)

  // Line 2: DIFFERENT event from lead — prefer bearish risk or different cluster
  const secondary = events.find(
    (e) =>
      e.id !== leadId &&
      (e.sentiment === 'bearish' || e.cluster !== leadEvent?.cluster),
  )
  if (secondary) {
    const prefix = secondary.sentiment === 'bearish' ? 'Risk' : secondary.cluster.toUpperCase()
    lines.push(`${prefix}: ${secondary.headline.slice(0, 65)}`)
  }

  return {
    label: 'WATCH',
    body: lines.length ? lines.join('\n') : 'No specific watch items identified.',
  }
}

function buildRiskPart(events: MarketEvent[], priceData: PriceSnap[]): BriefPart {
  const level = inferRiskLevel(events, priceData)
  const bearishEvents = events.filter((e) => e.sentiment === 'bearish').slice(0, 2)
  const flags = bearishEvents.map((e) => `⚠ ${e.headline.slice(0, 60)}`).join('\n')

  return {
    label: 'RISK',
    body: `${RISK_LABEL[level]}${flags ? `\n${flags}` : ''}`,
  }
}

// ─── LLM PROMPT ────────────────────────────────────────────────────────────

function buildPromptText(events: MarketEvent[], priceData: PriceSnap[]): string {
  const eventLines = events
    .slice(0, 6)
    .map(
      (e, i) =>
        `[${i + 1}] directness=${e.directness} cluster=${e.cluster} sentiment=${e.sentiment}\n` +
        `    headline: ${e.headline}\n` +
        `    assets: ${e.assets.join(', ') || 'none'}`,
    )
    .join('\n')

  const priceLines = priceData
    .map((p) => `${p.symbol}: ${p.price} (${p.change1d >= 0 ? '+' : ''}${p.change1d.toFixed(2)}% 1d)`)
    .join(', ')

  return `You are a market analyst writing a terminal brief in X (Twitter) style.
Be direct, concise, and actionable. No fluff. Use numbers.

## Market Events (rule-extracted, sorted by directness)
${eventLines}

## Price Snapshot
${priceLines}

## Output Format (5 parts, strict)
SIGNAL: [🟢/🔴/🟡] [BULL/BEAR/NEUTRAL] — [one punchy sentence with market context]
EVENT: [subject] [action] ([magnitude]) → [asset] · [cluster]
CONTEXT: [2 sentences: why this matters + what's driving]
WATCH: [specific ticker or level to monitor]
RISK: [L0–L4] — [one sentence assessment]`
}

// ─── MAIN EXPORT ───────────────────────────────────────────────────────────

export function generateBrief(
  events: MarketEvent[],
  priceData: PriceSnap[],
): MarketBrief {
  const leadEvent = events[0] ?? null

  const signalStrength =
    events.length === 0
      ? 0
      : Math.round(events.slice(0, 5).reduce((sum, e) => sum + e.directness, 0) / Math.min(5, events.length))

  // Aggregate sentiment — weighted by directness
  const bullWeight = events.filter((e) => e.sentiment === 'bullish').reduce((sum, e) => sum + e.directness, 0)
  const bearWeight = events.filter((e) => e.sentiment === 'bearish').reduce((sum, e) => sum + e.directness, 0)
  const sentiment: EventSentiment = bullWeight > bearWeight ? 'bullish' : bearWeight > bullWeight ? 'bearish' : 'neutral'

  return {
    generatedAt: new Date().toISOString(),
    sentiment,
    signalStrength,
    parts: [
      buildSignalPart(events, priceData),
      buildEventPart(leadEvent, events),
      buildContextPart(events, priceData),
      buildWatchPart(events, priceData),
      buildRiskPart(events, priceData),
    ],
    leadEvent,
    promptText: buildPromptText(events, priceData),
  }
}
