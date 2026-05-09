/**
 * FILE: normalizeMetrics.ts
 * RESPONSIBILITY: Engine Layer 1-3 — raw market data → normalized → directional signal
 *
 * INPUT:  MarketDataInput  — ticker price/return data (from existing API cache)
 *         MacroSnapshot    — VIX, yield, DXY, RSI, MACD (external or DEFAULT_MACRO)
 * OUTPUT: NormalizedMetric[] — 23 MVP metrics, each with:
 *           raw_value        (original measurement)
 *           normalized_value (0~100, display-safe)
 *           signal_value     (-100~+100, engine calculation units)
 *
 * NORMALIZATION METHODS USED:
 *   returnToSignal     — price returns via threshold approximation of 3Y percentile
 *   breadthToSignal    — breadth % direct (0~100, centered at 50)
 *   concentrationRisk  — inverse (high concentration = negative signal)
 *   spreadToSignal     — EW vs CW spread (negative spread = AI Distortion risk)
 *   rsiToSignal        — threshold band (over/under-bought = risk in both directions)
 *   macdToSignal       — binary + histogram magnitude
 *   vixToSignal        — inverse threshold (high VIX = negative)
 *   yieldChangeToSig   — macro context modifier
 *   dxyToSignal        — macro context modifier
 *
 * DO NOT: import React, use JSX, reference window/document, read files
 */

import type { MarketDataInput, MacroSnapshot, NormalizedMetric } from './types'

// ── Bucket composition (mirrors route.ts — kept in sync) ──────────────────
const BUCKET_TICKERS = {
  ai_infra:  ['NVDA', 'AMD', 'AVGO'],
  memory:    ['MU'],
  foundry:   ['TSM'],
  equipment: ['ASML', 'AMAT', 'LRCX', 'KLAC'],
  power:     ['ADI', 'MPWR'],
  osat:      ['AMKR', 'ASX'],
  logic:     ['TXN', 'MCHP', 'ON'],
} as const

// ── Math helpers ─────────────────────────────────────────────────────────────

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
}

function clamp(v: number, min = -100, max = 100): number {
  return Math.max(min, Math.min(max, v))
}

function signalToDisplay(signal: number): number {
  return Math.round((signal + 100) / 2)
}

// ── Normalization functions ───────────────────────────────────────────────────

// Price return → signal. Thresholds approximate 3Y semiconductor percentile.
// positive direction: higher return = more positive signal.
function returnToSignal(ret: number): { normalized: number; signal: number } {
  if (ret >= 0.50) return { normalized: 95, signal: 90 }
  if (ret >= 0.30) return { normalized: 82, signal: 64 }
  if (ret >= 0.15) return { normalized: 68, signal: 36 }
  if (ret >= 0.05) return { normalized: 57, signal: 14 }
  if (ret >= -0.05) return { normalized: 47, signal: -6 }
  if (ret >= -0.15) return { normalized: 35, signal: -30 }
  if (ret >= -0.30) return { normalized: 20, signal: -60 }
  return { normalized: 6, signal: -88 }
}

// Breadth % (0~100 direct, centered at 50, scaled to ±100 signal)
// positive direction
function breadthToSignal(pct: number): { normalized: number; signal: number } {
  const signal = clamp((pct - 50) * 2.2)
  return { normalized: Math.round(pct), signal: Math.round(signal) }
}

// Leader concentration (inverse: high % = negative signal)
// top5pct: % of total SOXX return attributable to top 5 names (0~100)
function concentrationToSignal(top5pct: number): { normalized: number; signal: number } {
  const signal = clamp(-(top5pct - 45) * 2.2)
  return { normalized: Math.round(top5pct), signal: Math.round(signal) }
}

// EW vs CW spread (negative spread = more concentration = negative signal)
// spreadPct: equal-weight return minus cap-weight return, as decimal
function spreadToSignal(spreadPct: number): { normalized: number; signal: number } {
  const abs = Math.abs(spreadPct * 100)
  const normalized = Math.min(100, Math.round(abs * 2.5))
  // positive spread (EW outperforms CW) = breadth healthy = positive
  const signal = clamp(spreadPct * 400)
  return { normalized, signal: Math.round(signal) }
}

// RSI threshold band (risk type: overextension in either direction is negative)
function rsiToSignal(rsi: number): { normalized: number; signal: number } {
  let normalized: number
  let signal: number
  if (rsi > 78)      { normalized = 90; signal = -60 }  // severely overbought
  else if (rsi > 70) { normalized = 75; signal = -20 }  // overbought caution
  else if (rsi > 60) { normalized = 62; signal = 30 }
  else if (rsi > 50) { normalized = 55; signal = 20 }
  else if (rsi > 40) { normalized = 48, signal = -10 }
  else if (rsi > 30) { normalized = 35; signal = -30 }
  else               { normalized = 15; signal = 15 }   // oversold: potential recovery
  return { normalized, signal }
}

// MACD histogram (positive = bullish cross, negative = bearish)
function macdToSignal(hist: number): { normalized: number; signal: number } {
  const abs = Math.abs(hist)
  const normalized = Math.min(100, Math.round(40 + abs * 20))
  const signal = clamp(hist * 40)
  return { normalized, signal: Math.round(signal) }
}

// VIX inverse threshold (high VIX = negative signal)
function vixToSignal(vix: number): { normalized: number; signal: number } {
  if (vix < 14)      return { normalized: 92, signal: 74 }
  if (vix < 18)      return { normalized: 76, signal: 52 }
  if (vix < 22)      return { normalized: 60, signal: 20 }
  if (vix < 26)      return { normalized: 42, signal: -16 }
  if (vix < 30)      return { normalized: 28, signal: -44 }
  if (vix < 35)      return { normalized: 14, signal: -72 }
  return             { normalized: 5,  signal: -92 }
}

// VIX change (context: spike = negative)
function vixChangeTosignal(changePct: number): { normalized: number; signal: number } {
  const signal = clamp(-changePct * 200)
  const normalized = signalToDisplay(Math.round(signal))
  return { normalized, signal: Math.round(signal) }
}

// 10Y yield change (context modifier — sharp rise = macro headwind)
function yieldChangeToSignal(bps: number): { normalized: number; signal: number } {
  const signal = clamp(-bps * 0.8)
  const normalized = signalToDisplay(Math.round(signal))
  return { normalized, signal: Math.round(signal) }
}

// DXY trend (context: strong dollar = headwind for semis)
function dxyToSignal(changePct: number): { normalized: number; signal: number } {
  const signal = clamp(-changePct * 300)
  const normalized = signalToDisplay(Math.round(signal))
  return { normalized, signal: Math.round(signal) }
}

// SOXX vs 200MA (binary with gradient)
function maToSignal(pctAbove: number): { normalized: number; signal: number } {
  const normalized = pctAbove >= 0
    ? Math.min(100, Math.round(50 + pctAbove * 250))
    : Math.max(0, Math.round(50 + pctAbove * 250))
  const signal = clamp(pctAbove * 500)
  return { normalized, signal: Math.round(signal) }
}

// ── Bucket return helper ──────────────────────────────────────────────────────

function bucketReturn60d(tickers: readonly string[], data: MarketDataInput): number {
  const rets = tickers.map(tk => data.tickers[tk]?.return_60d ?? 0)
  return avg(rets)
}

function bucketAbove20ma(tickers: readonly string[], data: MarketDataInput): number {
  const total = tickers.length
  if (!total) return 0
  const above = tickers.filter(tk => data.tickers[tk]?.above_20dma).length
  return (above / total) * 100
}

// ── Main export ───────────────────────────────────────────────────────────────

export function normalizeMetrics(
  data:  MarketDataInput,
  macro: MacroSnapshot,
): NormalizedMetric[] {
  const t = data.tickers
  const soxx60d = t.SOXX?.return_60d ?? 0
  const soxx20d = t.SOXX?.return_20d ?? 0
  const qqq60d  = t.QQQ?.return_60d  ?? 0

  // Bucket 60d returns
  const aiRet   = bucketReturn60d(BUCKET_TICKERS.ai_infra,  data)
  const memRet  = bucketReturn60d(BUCKET_TICKERS.memory,    data)
  const fndRet  = bucketReturn60d(BUCKET_TICKERS.foundry,   data)
  const eqpRet  = bucketReturn60d(BUCKET_TICKERS.equipment, data)
  const pwrRet  = bucketReturn60d(BUCKET_TICKERS.power,     data)
  const osatRet = bucketReturn60d(BUCKET_TICKERS.osat,      data)
  const lgcRet  = bucketReturn60d(BUCKET_TICKERS.logic,     data)

  // Breadth: % of all tickers above 20DMA
  const allTickers = Object.values(t)
  const aboveCount = allTickers.filter(tk => tk.above_20dma).length
  const breadthPct = allTickers.length ? (aboveCount / allTickers.length) * 100 : 50

  // Leader concentration: AI infra average return vs SOXX (proxy for top-5 dominance)
  const aiVsSoxx = aiRet - soxx60d  // positive = AI outperforming = more concentrated
  // Translate to top5pct proxy: 50% baseline + contribution delta
  const top5proxy = clamp(50 + aiVsSoxx * 200, 0, 100)

  // EW vs CW spread: average of all bucket returns vs SOXX (cap-weighted)
  const ewReturn = avg([aiRet, memRet, fndRet, eqpRet, pwrRet, osatRet, lgcRet])
  const ewVsCwSpread = ewReturn - soxx60d

  const metrics: NormalizedMetric[] = []

  // ── 1. SOXX 20d return ──
  const r20 = returnToSignal(soxx20d)
  metrics.push({
    id: 'soxx_return_20d', name: 'SOXX 20D Return',
    raw_value: `${(soxx20d * 100).toFixed(1)}%`,
    normalized_value: r20.normalized, signal_value: r20.signal,
    direction: 'positive', confidence_impact: 'raises',
    data_quality: 'high',
    explanation_short: `SOXX returned ${(soxx20d * 100).toFixed(1)}% over 20 days`,
  })

  // ── 2. SOXX 60d return ──
  const r60 = returnToSignal(soxx60d)
  metrics.push({
    id: 'soxx_return_60d', name: 'SOXX 60D Return',
    raw_value: `${(soxx60d * 100).toFixed(1)}%`,
    normalized_value: r60.normalized, signal_value: r60.signal,
    direction: 'positive', confidence_impact: 'raises',
    data_quality: 'high',
    explanation_short: `SOXX returned ${(soxx60d * 100).toFixed(1)}% over 60 days`,
  })

  // ── 3. SOXX vs QQQ relative strength ──
  const rsRel = soxx60d - qqq60d
  const rsv = returnToSignal(rsRel)
  metrics.push({
    id: 'soxx_vs_qqq_ratio', name: 'SOXX vs QQQ RS',
    raw_value: `${rsRel >= 0 ? '+' : ''}${(rsRel * 100).toFixed(1)}%`,
    normalized_value: rsv.normalized, signal_value: rsv.signal,
    direction: 'positive', confidence_impact: 'raises',
    data_quality: 'high',
    explanation_short: `Semiconductors ${rsRel >= 0 ? 'outperform' : 'underperform'} NASDAQ by ${Math.abs(rsRel * 100).toFixed(1)}%`,
  })

  // ── 4. SOXX vs 200MA ──
  const mav = maToSignal(macro.soxx_vs_200ma_pct)
  metrics.push({
    id: 'soxx_vs_200ma', name: 'SOXX vs 200MA',
    raw_value: `${macro.soxx_vs_200ma_pct >= 0 ? '+' : ''}${(macro.soxx_vs_200ma_pct * 100).toFixed(1)}%`,
    normalized_value: mav.normalized, signal_value: mav.signal,
    direction: 'positive', confidence_impact: 'raises',
    data_quality: 'high',
    explanation_short: `SOXX trades ${Math.abs(macro.soxx_vs_200ma_pct * 100).toFixed(1)}% ${macro.soxx_vs_200ma_pct >= 0 ? 'above' : 'below'} 200-day MA`,
  })

  // ── 5–11. Bucket 60d returns ──
  const bucketDefs: Array<{ id: string; name: string; ret: number }> = [
    { id: 'ai_infra_return_60d',   name: 'AI Infrastructure 60D',  ret: aiRet   },
    { id: 'memory_return_60d',     name: 'Memory 60D',              ret: memRet  },
    { id: 'foundry_return_60d',    name: 'Foundry 60D',             ret: fndRet  },
    { id: 'equipment_return_60d',  name: 'Equipment 60D',           ret: eqpRet  },
    { id: 'power_return_60d',      name: 'Power/Analog 60D',        ret: pwrRet  },
    { id: 'osat_return_60d',       name: 'Packaging/OSAT 60D',      ret: osatRet },
    { id: 'logic_return_60d',      name: 'Logic/MCU 60D',           ret: lgcRet  },
  ]
  for (const b of bucketDefs) {
    const bv = returnToSignal(b.ret)
    metrics.push({
      id: b.id, name: b.name,
      raw_value: `${(b.ret * 100).toFixed(1)}%`,
      normalized_value: bv.normalized, signal_value: bv.signal,
      direction: 'positive', confidence_impact: 'neutral',
      data_quality: 'high',
      explanation_short: `${b.name.replace(' 60D', '')} bucket returned ${(b.ret * 100).toFixed(1)}% over 60 days`,
    })
  }

  // ── 12. Breadth: % above 20MA ──
  const bv = breadthToSignal(breadthPct)
  metrics.push({
    id: 'breadth_pct_above_20ma', name: 'Breadth (above 20MA)',
    raw_value: `${breadthPct.toFixed(0)}%`,
    normalized_value: bv.normalized, signal_value: bv.signal,
    direction: 'positive', confidence_impact: bv.signal > 0 ? 'raises' : 'lowers',
    data_quality: 'high',
    explanation_short: `${breadthPct.toFixed(0)}% of semiconductor stocks trade above their 20-day average`,
  })

  // ── 13. Breadth: % near 52W high (proxy: slope_30d > 0) ──
  const nearHighCount = allTickers.filter(tk => (tk.slope_30d ?? 0) > 0.002).length
  const nearHighPct   = allTickers.length ? (nearHighCount / allTickers.length) * 100 : 50
  const nhv = breadthToSignal(nearHighPct)
  metrics.push({
    id: 'breadth_near_52w_high', name: 'Breadth (52W High proxy)',
    raw_value: `${nearHighPct.toFixed(0)}%`,
    normalized_value: nhv.normalized, signal_value: nhv.signal,
    direction: 'positive', confidence_impact: 'neutral',
    data_quality: 'medium',
    explanation_short: `${nearHighPct.toFixed(0)}% of stocks in upward trend (52W high proxy via slope)`,
  })

  // ── 14. Leader concentration ──
  const cv = concentrationToSignal(top5proxy)
  metrics.push({
    id: 'leader_concentration_top5', name: 'AI Infra Concentration',
    raw_value: `${top5proxy.toFixed(0)}%`,
    normalized_value: cv.normalized, signal_value: cv.signal,
    direction: 'negative', confidence_impact: cv.signal < -30 ? 'lowers' : 'neutral',
    data_quality: 'high',
    explanation_short: `AI Infrastructure bucket dominance proxy at ${top5proxy.toFixed(0)}%`,
  })

  // ── 15. Equal-weight vs cap-weight spread ──
  const sv = spreadToSignal(ewVsCwSpread)
  metrics.push({
    id: 'equal_weight_vs_cap_spread', name: 'EW vs CW Spread',
    raw_value: `${ewVsCwSpread >= 0 ? '+' : ''}${(ewVsCwSpread * 100).toFixed(1)}%`,
    normalized_value: sv.normalized, signal_value: sv.signal,
    direction: ewVsCwSpread >= 0 ? 'positive' : 'negative',
    confidence_impact: ewVsCwSpread < -0.05 ? 'lowers' : 'neutral',
    data_quality: 'high',
    explanation_short: `Equal-weight portfolio ${ewVsCwSpread >= 0 ? 'beats' : 'trails'} SOXX by ${Math.abs(ewVsCwSpread * 100).toFixed(1)}%`,
  })

  // ── 16. RSI ──
  const rv = rsiToSignal(macro.soxx_rsi_14)
  metrics.push({
    id: 'soxx_rsi_14', name: 'SOXX RSI(14)',
    raw_value: macro.soxx_rsi_14,
    normalized_value: rv.normalized, signal_value: rv.signal,
    direction: 'risk', confidence_impact: macro.soxx_rsi_14 > 70 ? 'lowers' : 'neutral',
    data_quality: 'high',
    explanation_short: macro.soxx_rsi_14 > 70
      ? `RSI ${macro.soxx_rsi_14} — overbought zone`
      : macro.soxx_rsi_14 < 30
        ? `RSI ${macro.soxx_rsi_14} — oversold zone`
        : `RSI ${macro.soxx_rsi_14} — neutral range`,
  })

  // ── 17. MACD ──
  const mv = macdToSignal(macro.soxx_macd_hist)
  metrics.push({
    id: 'soxx_macd_signal', name: 'SOXX MACD',
    raw_value: macro.soxx_macd_hist.toFixed(2),
    normalized_value: mv.normalized, signal_value: mv.signal,
    direction: macro.soxx_macd_hist > 0 ? 'positive' : 'negative',
    confidence_impact: 'neutral',
    data_quality: 'high',
    explanation_short: `MACD histogram ${macro.soxx_macd_hist > 0 ? 'positive' : 'negative'} (${macro.soxx_macd_hist.toFixed(2)})`,
  })

  // ── 18. ROC 60d (reuse soxx_return_60d) ──
  const rocv = returnToSignal(soxx60d)
  metrics.push({
    id: 'soxx_roc_60d', name: 'SOXX ROC 60D',
    raw_value: `${(soxx60d * 100).toFixed(1)}%`,
    normalized_value: rocv.normalized, signal_value: rocv.signal,
    direction: 'positive', confidence_impact: 'neutral',
    data_quality: 'high',
    explanation_short: `60-day rate of change: ${(soxx60d * 100).toFixed(1)}%`,
  })

  // ── 19. VIX level ──
  const vv = vixToSignal(macro.vix_level)
  metrics.push({
    id: 'vix_level', name: 'VIX Level',
    raw_value: macro.vix_level.toFixed(1),
    normalized_value: vv.normalized, signal_value: vv.signal,
    direction: 'negative', confidence_impact: macro.vix_level > 25 ? 'lowers' : 'neutral',
    data_quality: 'high',
    explanation_short: `VIX at ${macro.vix_level.toFixed(1)} — ${macro.vix_level < 20 ? 'low volatility' : macro.vix_level < 28 ? 'moderate' : 'elevated fear'}`,
  })

  // ── 20. VIX 5d change ──
  const vcv = vixChangeTosignal(macro.vix_change_5d_pct)
  metrics.push({
    id: 'vix_change_5d', name: 'VIX 5D Change',
    raw_value: `${macro.vix_change_5d_pct >= 0 ? '+' : ''}${(macro.vix_change_5d_pct * 100).toFixed(1)}%`,
    normalized_value: vcv.normalized, signal_value: vcv.signal,
    direction: 'context', confidence_impact: macro.vix_change_5d_pct > 0.3 ? 'lowers' : 'neutral',
    data_quality: 'high',
    explanation_short: `VIX ${macro.vix_change_5d_pct >= 0 ? 'rose' : 'fell'} ${Math.abs(macro.vix_change_5d_pct * 100).toFixed(1)}% over 5 days`,
  })

  // ── 21. 10Y yield change ──
  const yv = yieldChangeToSignal(macro.yield_10y_change_30d)
  metrics.push({
    id: 'yield_10y_change_30d', name: '10Y Yield Δ30D',
    raw_value: `${macro.yield_10y_change_30d >= 0 ? '+' : ''}${macro.yield_10y_change_30d}bps`,
    normalized_value: yv.normalized, signal_value: yv.signal,
    direction: 'context', confidence_impact: macro.yield_10y_change_30d > 75 ? 'lowers' : 'neutral',
    data_quality: 'medium',
    explanation_short: `10Y yield ${macro.yield_10y_change_30d >= 0 ? 'rose' : 'fell'} ${Math.abs(macro.yield_10y_change_30d)}bps over 30 days`,
  })

  // ── 22. DXY trend ──
  const dv = dxyToSignal(macro.dxy_trend_30d_pct)
  metrics.push({
    id: 'dxy_trend_30d', name: 'Dollar Index 30D',
    raw_value: `${macro.dxy_trend_30d_pct >= 0 ? '+' : ''}${(macro.dxy_trend_30d_pct * 100).toFixed(1)}%`,
    normalized_value: dv.normalized, signal_value: dv.signal,
    direction: 'context', confidence_impact: 'neutral',
    data_quality: 'medium',
    explanation_short: `Dollar index ${macro.dxy_trend_30d_pct >= 0 ? 'strengthened' : 'weakened'} ${Math.abs(macro.dxy_trend_30d_pct * 100).toFixed(1)}% over 30 days`,
  })

  // ── 23. AI Infra strength composite ──
  const aiStrength = avg([
    returnToSignal(aiRet).signal,
    bucketAbove20ma(BUCKET_TICKERS.ai_infra, data) > 66 ? 30 : -20,
  ])
  const aiNorm = signalToDisplay(Math.round(aiStrength))
  metrics.push({
    id: 'ai_infra_strength', name: 'AI Infra Composite',
    raw_value: `${(aiRet * 100).toFixed(1)}%`,
    normalized_value: aiNorm,
    signal_value: Math.round(aiStrength),
    direction: 'positive', confidence_impact: 'neutral',
    data_quality: 'high',
    explanation_short: `AI Infrastructure (NVDA/AMD/AVGO) composite strength signal`,
  })

  return metrics
}
