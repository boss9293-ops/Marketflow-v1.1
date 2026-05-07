// 반도체 펀더멘털 payload의 유효성 검증 및 정규화 — 누락 필드 보완 및 상태 카운트 계산

import type {
  SemiconductorFundamentalsPayload,
  FundamentalMetric,
  DataStatus,
  DataStatusSummary,
} from './fundamentalDataContract'
import { PENDING_METRIC } from './fundamentalDataContract'

function safeMetric(raw: unknown, id: string, label: string): FundamentalMetric {
  if (!raw || typeof raw !== 'object') return PENDING_METRIC(id, label)
  const m = raw as Partial<FundamentalMetric>
  return {
    id:           m.id           ?? id,
    label:        m.label        ?? label,
    value:        m.value        ?? null,
    unit:         m.unit,
    displayValue: m.displayValue ?? (m.value != null ? String(m.value) : '—'),
    status:       (m.status as DataStatus) ?? 'PENDING',
    source:       m.source       ?? 'Unknown',
    sourceUrl:    m.sourceUrl,
    asOf:         m.asOf,
    updatedAt:    m.updatedAt,
    frequency:    m.frequency    ?? 'unknown',
    note:         m.note,
  }
}

function countStatuses(metrics: FundamentalMetric[]): DataStatusSummary {
  const counts: DataStatusSummary = { live: 0, cache: 0, static: 0, manual: 0, pending: 0, unavailable: 0 }
  for (const m of metrics) {
    const key = m.status.toLowerCase() as keyof DataStatusSummary
    if (key in counts) counts[key]++
  }
  return counts
}

function collectAllMetrics(payload: SemiconductorFundamentalsPayload): FundamentalMetric[] {
  return [
    ...Object.values(payload.l1Fundamentals),
    ...Object.values(payload.l2CapitalFlow).filter(Boolean) as FundamentalMetric[],
    ...Object.values(payload.l3MarketConfirmation),
  ]
}

export function normalizeFundamentalsPayload(raw: unknown): SemiconductorFundamentalsPayload {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const l1Raw = (input.l1Fundamentals ?? {}) as Record<string, unknown>
  const l2Raw = (input.l2CapitalFlow   ?? {}) as Record<string, unknown>
  const l3Raw = (input.l3MarketConfirmation ?? {}) as Record<string, unknown>

  const payload: SemiconductorFundamentalsPayload = {
    generatedAt: typeof input.generatedAt === 'string' ? input.generatedAt : new Date().toISOString(),
    dataStatusSummary: { live: 0, cache: 0, static: 0, manual: 0, pending: 0, unavailable: 0 },
    l1Fundamentals: {
      tsmcRevenueYoY:       safeMetric(l1Raw.tsmcRevenueYoY,       'tsmc_revenue_yoy',   'TSMC Monthly Revenue YoY'),
      bookToBill:           safeMetric(l1Raw.bookToBill,           'book_to_bill',       'Book-to-Bill Ratio'),
      siaSemiSales:         safeMetric(l1Raw.siaSemiSales,         'sia_semi_sales',     'SIA Global Semi Sales'),
      nvdaDataCenterRevenue:safeMetric(l1Raw.nvdaDataCenterRevenue,'nvda_dc_revenue',    'NVDA Data Center Revenue'),
    },
    l2CapitalFlow: {
      hyperscalerCapex:      safeMetric(l2Raw.hyperscalerCapex,     'hyperscaler_capex',  'Hyperscaler CapEx Aggregate'),
      microsoftCapex:        l2Raw.microsoftCapex    ? safeMetric(l2Raw.microsoftCapex,    'msft_capex',  'Microsoft CapEx')        : undefined,
      amazonCapex:           l2Raw.amazonCapex       ? safeMetric(l2Raw.amazonCapex,       'amzn_capex',  'Amazon CapEx')           : undefined,
      googleCapex:           l2Raw.googleCapex       ? safeMetric(l2Raw.googleCapex,       'goog_capex',  'Google/Alphabet CapEx')  : undefined,
      metaCapex:             l2Raw.metaCapex         ? safeMetric(l2Raw.metaCapex,         'meta_capex',  'Meta CapEx')             : undefined,
      hbmSupply:             safeMetric(l2Raw.hbmSupply            ?? null, 'hbm_supply',          'HBM Supply Signal'),
      asmlOrders:            safeMetric(l2Raw.asmlOrders           ?? null, 'asml_orders',         'ASML Order Backlog'),
      dataCenterPowerDemand: safeMetric(l2Raw.dataCenterPowerDemand ?? null,'dc_power_demand',     'Data Center Power Demand'),
    },
    l3MarketConfirmation: {
      soxxReflection: safeMetric(l3Raw.soxxReflection, 'soxx_reflection', 'SOXX Reflection Score'),
      soxlDecay:      safeMetric(l3Raw.soxlDecay,      'soxl_decay',      'SOXL Cumulative Decay'),
    },
  }

  payload.dataStatusSummary = countStatuses(collectAllMetrics(payload))
  return payload
}
