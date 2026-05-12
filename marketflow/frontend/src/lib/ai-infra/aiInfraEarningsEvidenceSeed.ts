// AI 인프라 수익 확인 수동 시드 데이터 — E-4 MVP (14개 심볼)
import type { AIInfraEarningsEvidence } from './aiInfraEarningsConfirmation'

export const EARNINGS_EVIDENCE_SEED: AIInfraEarningsEvidence[] = [
  // ── AI_CHIP ─────────────────────────────────────────────────────────────────
  {
    symbol: 'NVDA', company_name: 'NVIDIA Corp',
    primary_bucket: 'AI_CHIP',
    evidence_types: ['AI_REVENUE', 'BACKLOG', 'GUIDANCE', 'SEGMENT_GROWTH', 'MARGIN', 'MANAGEMENT_COMMENTARY'],
    ai_revenue_visibility: 'VISIBLE', revenue_trend: 'ACCELERATING',
    guidance_tone: 'RAISED', backlog_or_orders: 'STRONG', margin_quality: 'EXPANDING',
    commercialization_status: 'REVENUE_VISIBLE',
    evidence_notes: [
      'Data center segment >85% of total revenue as of Q3 FY2025.',
      'Blackwell ramp driving accelerating revenue growth.',
      'Record backlog for H100/H200/Blackwell products.',
    ],
    caution_notes: [],
    source: { quarter: 'Q3 FY2025', source_type: 'MANUAL', as_of: '2025-Q4' },
  },
  {
    symbol: 'AMD', company_name: 'Advanced Micro Devices',
    primary_bucket: 'AI_CHIP',
    evidence_types: ['AI_REVENUE', 'SEGMENT_GROWTH', 'GUIDANCE', 'MANAGEMENT_COMMENTARY'],
    ai_revenue_visibility: 'VISIBLE', revenue_trend: 'GROWING',
    guidance_tone: 'POSITIVE', backlog_or_orders: 'IMPROVING', margin_quality: 'STABLE',
    commercialization_status: 'REVENUE_VISIBLE',
    evidence_notes: [
      'MI300 AI accelerator contributing visible segment revenue.',
      'Data center GPU revenue growing sequentially.',
    ],
    caution_notes: [
      'CPU and gaming segments dilute AI concentration.',
      'MI300 ramp pace vs NVIDIA gap remains a concern.',
    ],
    source: { quarter: 'Q3 2024', source_type: 'MANUAL', as_of: '2025-Q4' },
  },
  {
    symbol: 'AVGO', company_name: 'Broadcom Inc',
    primary_bucket: 'AI_CHIP',
    secondary_buckets: ['OPTICAL_NETWORK'],
    evidence_types: ['AI_REVENUE', 'BACKLOG', 'GUIDANCE', 'SEGMENT_GROWTH', 'MANAGEMENT_COMMENTARY'],
    ai_revenue_visibility: 'VISIBLE', revenue_trend: 'GROWING',
    guidance_tone: 'RAISED', backlog_or_orders: 'STRONG', margin_quality: 'STABLE',
    commercialization_status: 'REVENUE_VISIBLE',
    evidence_notes: [
      'AI revenue segment disclosed: custom ASIC and networking.',
      'AI revenue expected $12B+ in FY2024.',
    ],
    caution_notes: ['VMware infrastructure revenue creates dilution.'],
    source: { quarter: 'FY2024', source_type: 'MANUAL', as_of: '2025-Q4' },
  },

  // ── HBM_MEMORY ──────────────────────────────────────────────────────────────
  {
    symbol: 'MU', company_name: 'Micron Technology',
    primary_bucket: 'HBM_MEMORY',
    evidence_types: ['AI_REVENUE', 'SEGMENT_GROWTH', 'GUIDANCE', 'MANAGEMENT_COMMENTARY'],
    ai_revenue_visibility: 'PARTIAL', revenue_trend: 'GROWING',
    guidance_tone: 'POSITIVE', backlog_or_orders: 'IMPROVING', margin_quality: 'EXPANDING',
    commercialization_status: 'EARLY_REVENUE',
    evidence_notes: [
      'HBM3E in production and contributing to data center revenue.',
      'HBM revenue guidance raised several times through 2024.',
    ],
    caution_notes: [
      'US-listed proxy only — SK Hynix/Samsung not included.',
      'Overall DRAM/NAND oversupply risk dilutes AI signal.',
    ],
    source: { quarter: 'Q4 FY2024', source_type: 'MANUAL', as_of: '2025-Q4' },
  },

  // ── PACKAGING ───────────────────────────────────────────────────────────────
  {
    symbol: 'TSM', company_name: 'Taiwan Semiconductor (ADR)',
    primary_bucket: 'PACKAGING',
    evidence_types: ['AI_REVENUE', 'BACKLOG', 'GUIDANCE', 'SEGMENT_GROWTH', 'MANAGEMENT_COMMENTARY'],
    ai_revenue_visibility: 'VISIBLE', revenue_trend: 'ACCELERATING',
    guidance_tone: 'RAISED', backlog_or_orders: 'STRONG', margin_quality: 'STABLE',
    commercialization_status: 'REVENUE_VISIBLE',
    evidence_notes: [
      'CoWoS advanced packaging capacity fully sold out.',
      'AI-related revenue growing faster than overall semiconductor market.',
    ],
    caution_notes: [
      'Geopolitical risk (Taiwan) not captured in earnings metrics.',
    ],
    source: { quarter: 'Q3 2024', source_type: 'MANUAL', as_of: '2025-Q4' },
  },
  {
    symbol: 'AMAT', company_name: 'Applied Materials',
    primary_bucket: 'PACKAGING',
    secondary_buckets: ['GLASS_SUBSTRATE'],
    evidence_types: ['AI_REVENUE', 'SEGMENT_GROWTH', 'GUIDANCE', 'MARGIN'],
    ai_revenue_visibility: 'PARTIAL', revenue_trend: 'GROWING',
    guidance_tone: 'POSITIVE', backlog_or_orders: 'STABLE', margin_quality: 'STABLE',
    commercialization_status: 'REVENUE_VISIBLE',
    evidence_notes: [
      'Gate-all-around and advanced packaging equipment demand AI-driven.',
      'Fab equipment backlog supported by AI chip capacity investment.',
    ],
    caution_notes: [
      'Non-AI (mobile, auto) semiconductor exposure dilutes signal.',
      'China export restriction headwinds.',
    ],
    source: { quarter: 'Q3 FY2024', source_type: 'MANUAL', as_of: '2025-Q4' },
  },
  {
    symbol: 'LRCX', company_name: 'Lam Research',
    primary_bucket: 'PACKAGING',
    evidence_types: ['SEGMENT_GROWTH', 'GUIDANCE', 'BACKLOG', 'MANAGEMENT_COMMENTARY'],
    ai_revenue_visibility: 'PARTIAL', revenue_trend: 'GROWING',
    guidance_tone: 'POSITIVE', backlog_or_orders: 'IMPROVING', margin_quality: 'STABLE',
    commercialization_status: 'REVENUE_VISIBLE',
    evidence_notes: [
      'Etch/deposition demand driven by advanced packaging ramp.',
      'HBM memory manufacturing capacity expansion supports orders.',
    ],
    caution_notes: [
      'Broad WFE exposure — not purely AI-driven.',
      'China revenue restriction risk.',
    ],
    source: { quarter: 'Q1 FY2025', source_type: 'MANUAL', as_of: '2025-Q4' },
  },
  {
    symbol: 'KLAC', company_name: 'KLA Corp',
    primary_bucket: 'PACKAGING',
    secondary_buckets: ['TEST_EQUIPMENT'],
    evidence_types: ['AI_REVENUE', 'SEGMENT_GROWTH', 'GUIDANCE', 'MANAGEMENT_COMMENTARY'],
    ai_revenue_visibility: 'PARTIAL', revenue_trend: 'GROWING',
    guidance_tone: 'POSITIVE', backlog_or_orders: 'STABLE', margin_quality: 'STABLE',
    commercialization_status: 'REVENUE_VISIBLE',
    evidence_notes: [
      'Process control/inspection demand growing with advanced node AI chip production.',
      'KLA consistently cites AI as growth driver in earnings commentary.',
    ],
    caution_notes: ['Mixed WFE exposure beyond AI.'],
    source: { quarter: 'Q1 FY2025', source_type: 'MANUAL', as_of: '2025-Q4' },
  },

  // ── COOLING ─────────────────────────────────────────────────────────────────
  {
    symbol: 'VRT', company_name: 'Vertiv Holdings',
    primary_bucket: 'COOLING',
    secondary_buckets: ['POWER_INFRA', 'DATA_CENTER_INFRA'],
    evidence_types: ['AI_REVENUE', 'BACKLOG', 'GUIDANCE', 'SEGMENT_GROWTH', 'MARGIN', 'MANAGEMENT_COMMENTARY'],
    ai_revenue_visibility: 'VISIBLE', revenue_trend: 'ACCELERATING',
    guidance_tone: 'RAISED', backlog_or_orders: 'STRONG', margin_quality: 'EXPANDING',
    commercialization_status: 'REVENUE_VISIBLE',
    evidence_notes: [
      'Liquid cooling and power management for AI data centers driving revenue.',
      'Backlog >2x revenue, majority AI data center.',
      'Guidance raised multiple times in 2024.',
    ],
    caution_notes: [],
    source: { quarter: 'Q3 2024', source_type: 'MANUAL', as_of: '2025-Q4' },
  },
  {
    symbol: 'ETN', company_name: 'Eaton Corp',
    primary_bucket: 'COOLING',
    secondary_buckets: ['POWER_INFRA'],
    evidence_types: ['AI_REVENUE', 'SEGMENT_GROWTH', 'GUIDANCE', 'MANAGEMENT_COMMENTARY'],
    ai_revenue_visibility: 'PARTIAL', revenue_trend: 'GROWING',
    guidance_tone: 'POSITIVE', backlog_or_orders: 'IMPROVING', margin_quality: 'STABLE',
    commercialization_status: 'REVENUE_VISIBLE',
    evidence_notes: [
      'Electrical segment data center bookings growing significantly.',
      'AI data center named as key growth driver in earnings commentary.',
    ],
    caution_notes: [
      'Aerospace, industrial, and automotive segments dilute AI signal.',
      'AI revenue not separately disclosed in segment reporting.',
    ],
    source: { quarter: 'Q3 2024', source_type: 'MANUAL', as_of: '2025-Q4' },
  },

  // ── POWER_INFRA ─────────────────────────────────────────────────────────────
  {
    symbol: 'PWR', company_name: 'Quanta Services',
    primary_bucket: 'POWER_INFRA',
    evidence_types: ['AI_REVENUE', 'BACKLOG', 'GUIDANCE', 'MANAGEMENT_COMMENTARY'],
    ai_revenue_visibility: 'PARTIAL', revenue_trend: 'GROWING',
    guidance_tone: 'POSITIVE', backlog_or_orders: 'STRONG', margin_quality: 'STABLE',
    commercialization_status: 'REVENUE_VISIBLE',
    evidence_notes: [
      'Electric power infrastructure contracts for data centers increasing.',
      'Backlog at record levels with data center as key driver.',
    ],
    caution_notes: [
      'AI revenue not separately disclosed — inferred from project mix.',
      'Utility and industrial EPC dilutes signal.',
    ],
    source: { quarter: 'Q3 2024', source_type: 'MANUAL', as_of: '2025-Q4' },
  },

  // ── GLASS_SUBSTRATE ─────────────────────────────────────────────────────────
  {
    symbol: 'GLW', company_name: 'Corning Inc',
    primary_bucket: 'GLASS_SUBSTRATE',
    evidence_types: ['MANAGEMENT_COMMENTARY', 'COMMERCIALIZATION_PROGRESS'],
    ai_revenue_visibility: 'NOT_DISCLOSED', revenue_trend: 'UNKNOWN',
    guidance_tone: 'NEUTRAL', backlog_or_orders: 'NOT_DISCLOSED', margin_quality: 'UNKNOWN',
    commercialization_status: 'PRE_COMMERCIAL',
    evidence_notes: [
      'Glass substrate technology partnership with Intel announced.',
      'Optical fiber demand growing from AI data center interconnects.',
    ],
    caution_notes: [
      'Glass substrate for semiconductors is pre-commercial — no AI substrate revenue.',
      'Fiber optic revenue does not confirm glass substrate investment thesis.',
      'Display, life sciences, and specialty materials dominate revenue.',
    ],
    source: { quarter: 'Q3 2024', source_type: 'MANUAL', as_of: '2025-Q4' },
  },

  // ── OPTICAL_NETWORK ─────────────────────────────────────────────────────────
  {
    symbol: 'ANET', company_name: 'Arista Networks',
    primary_bucket: 'OPTICAL_NETWORK',
    evidence_types: ['AI_REVENUE', 'BACKLOG', 'GUIDANCE', 'SEGMENT_GROWTH', 'MARGIN', 'MANAGEMENT_COMMENTARY'],
    ai_revenue_visibility: 'VISIBLE', revenue_trend: 'ACCELERATING',
    guidance_tone: 'RAISED', backlog_or_orders: 'STRONG', margin_quality: 'EXPANDING',
    commercialization_status: 'REVENUE_VISIBLE',
    evidence_notes: [
      'AI data center network switching is core growth driver.',
      'Hyperscaler concentration (>40% revenue) directly tied to AI buildout.',
      'Backend AI cluster networking as growth segment explicitly cited.',
    ],
    caution_notes: ['Hyperscaler concentration creates customer dependency risk.'],
    source: { quarter: 'Q3 2024', source_type: 'MANUAL', as_of: '2025-Q4' },
  },

  // ── DATA_CENTER_INFRA ───────────────────────────────────────────────────────
  {
    symbol: 'EQIX', company_name: 'Equinix Inc',
    primary_bucket: 'DATA_CENTER_INFRA',
    evidence_types: ['AI_REVENUE', 'BACKLOG', 'GUIDANCE', 'SEGMENT_GROWTH', 'MANAGEMENT_COMMENTARY'],
    ai_revenue_visibility: 'PARTIAL', revenue_trend: 'GROWING',
    guidance_tone: 'RAISED', backlog_or_orders: 'IMPROVING', margin_quality: 'STABLE',
    commercialization_status: 'REVENUE_VISIBLE',
    evidence_notes: [
      'Data center colocation demand from hyperscaler AI infrastructure expansion is primary growth driver.',
      'xScale hyperscale leasing backlog growing with AI cluster customers cited in earnings.',
    ],
    caution_notes: [
      'Colocation revenue — not direct AI compute revenue. Rate-sensitive REIT structure.',
      'Data center supply expansion creates competitive leasing pressure.',
    ],
    source: { quarter: 'Q3 2024', source_type: 'MANUAL', as_of: '2025-Q4' },
  },
  {
    symbol: 'SMCI', company_name: 'Super Micro Computer',
    primary_bucket: 'DATA_CENTER_INFRA',
    evidence_types: ['AI_REVENUE', 'SEGMENT_GROWTH', 'MANAGEMENT_COMMENTARY'],
    ai_revenue_visibility: 'VISIBLE', revenue_trend: 'GROWING',
    guidance_tone: 'POSITIVE', backlog_or_orders: 'IMPROVING', margin_quality: 'PRESSURED',
    commercialization_status: 'REVENUE_VISIBLE',
    evidence_notes: [
      'AI server integration (NVIDIA GPU-based) drives majority of revenue.',
      'Strong datacenter demand for liquid-cooled GPU servers.',
    ],
    caution_notes: [
      'Audit and financial reporting concerns limit evidence confidence.',
      'Gross margin compression due to competitive pricing.',
      'Accounting restatement history adds verification risk.',
    ],
    source: { quarter: 'Q1 FY2025', source_type: 'MANUAL', as_of: '2025-Q4' },
  },

  // ── PACKAGING (E-5 추가) ────────────────────────────────────────────────────
  {
    symbol: 'ASML', company_name: 'ASML Holding NV (ADR)',
    primary_bucket: 'PACKAGING',
    evidence_types: ['AI_REVENUE', 'BACKLOG', 'GUIDANCE', 'SEGMENT_GROWTH', 'MARGIN', 'MANAGEMENT_COMMENTARY'],
    ai_revenue_visibility: 'PARTIAL', revenue_trend: 'GROWING',
    guidance_tone: 'RAISED', backlog_or_orders: 'STRONG', margin_quality: 'STABLE',
    commercialization_status: 'REVENUE_VISIBLE',
    evidence_notes: [
      'EUV/DUV lithography demand driven by advanced node AI chip capacity expansion.',
      'Multi-year backlog with hyperscaler fab investments as stated driver in earnings.',
    ],
    caution_notes: [
      'Revenue is semiconductor capex driven — not direct AI inference or training revenue.',
      'Export restriction risk (China) creates demand uncertainty.',
    ],
    source: { quarter: 'Q3 2024', source_type: 'MANUAL', as_of: '2025-Q4' },
  },

  // ── OPTICAL_NETWORK (E-5 추가) ─────────────────────────────────────────────
  {
    symbol: 'APH', company_name: 'Amphenol Corp',
    primary_bucket: 'OPTICAL_NETWORK',
    evidence_types: ['SEGMENT_GROWTH', 'ORDER_GROWTH', 'GUIDANCE', 'MANAGEMENT_COMMENTARY'],
    ai_revenue_visibility: 'PARTIAL', revenue_trend: 'GROWING',
    guidance_tone: 'POSITIVE', backlog_or_orders: 'IMPROVING', margin_quality: 'STABLE',
    commercialization_status: 'EARLY_REVENUE',
    evidence_notes: [
      'High-speed connector and cable assembly demand from AI server and data center infrastructure.',
      'IT datacom segment growing sequentially with AI cluster build-out cited in commentary.',
    ],
    caution_notes: [
      'AI data center connector revenue not separately disclosed — mixed with industrial, automotive.',
      'Commercialization scope limited to connectivity components, not AI compute infrastructure.',
    ],
    source: { quarter: 'Q3 2024', source_type: 'MANUAL', as_of: '2025-Q4' },
  },

  // ── TEST_EQUIPMENT (E-5 추가) ──────────────────────────────────────────────
  {
    symbol: 'TER', company_name: 'Teradyne Inc',
    primary_bucket: 'TEST_EQUIPMENT',
    evidence_types: ['SEGMENT_GROWTH', 'GUIDANCE', 'MANAGEMENT_COMMENTARY'],
    ai_revenue_visibility: 'PARTIAL', revenue_trend: 'GROWING',
    guidance_tone: 'POSITIVE', backlog_or_orders: 'IMPROVING', margin_quality: 'STABLE',
    commercialization_status: 'REVENUE_VISIBLE',
    evidence_notes: [
      'AI chip and HBM test demand driving semiconductor test system orders.',
      'Systems test segment benefiting from complex AI processor validation requirements.',
    ],
    caution_notes: [
      'Test revenue is cyclical and lags chip production ramp.',
      'Industrial automation segment dilutes AI-specific signal.',
    ],
    source: { quarter: 'Q4 2024', source_type: 'MANUAL', as_of: '2025-Q4' },
  },

  // ── SPECIALTY_GAS (E-5 추가) ───────────────────────────────────────────────
  {
    symbol: 'ENTG', company_name: 'Entegris Inc',
    primary_bucket: 'SPECIALTY_GAS',
    evidence_types: ['AI_REVENUE', 'SEGMENT_GROWTH', 'GUIDANCE', 'MANAGEMENT_COMMENTARY'],
    ai_revenue_visibility: 'PARTIAL', revenue_trend: 'GROWING',
    guidance_tone: 'POSITIVE', backlog_or_orders: 'IMPROVING', margin_quality: 'STABLE',
    commercialization_status: 'REVENUE_VISIBLE',
    evidence_notes: [
      'Advanced semiconductor process materials and specialty gases for AI chip node production.',
      'Revenue tied to leading-edge fab capacity expansion with AI demand cited as growth driver.',
    ],
    caution_notes: [
      'Revenue driven by semiconductor capex — not direct AI inference revenue.',
      'China export restriction exposure from semiconductor process materials.',
    ],
    source: { quarter: 'Q3 2024', source_type: 'MANUAL', as_of: '2025-Q4' },
  },

  // ── PCB_SUBSTRATE (E-5 추가) ───────────────────────────────────────────────
  {
    symbol: 'TTMI', company_name: 'TTM Technologies',
    primary_bucket: 'PCB_SUBSTRATE',
    evidence_types: ['SEGMENT_GROWTH', 'MANAGEMENT_COMMENTARY'],
    ai_revenue_visibility: 'PARTIAL', revenue_trend: 'GROWING',
    guidance_tone: 'NEUTRAL', backlog_or_orders: 'STABLE', margin_quality: 'STABLE',
    commercialization_status: 'REVENUE_VISIBLE',
    evidence_notes: [
      'High-density interconnect PCB demand growing from AI server and networking hardware.',
      'Data center PCB orders cited as growth area in management commentary.',
    ],
    caution_notes: [
      'AI-specific PCB revenue not separately disclosed — mixed with aerospace, automotive, telecom.',
      'Evidence is general datacenter PCB demand, not AI-specific. Low pure-play signal.',
    ],
    source: { quarter: 'Q3 2024', source_type: 'MANUAL', as_of: '2025-Q4' },
  },

  // ── RAW_MATERIAL (E-5 추가) ────────────────────────────────────────────────
  {
    symbol: 'FCX', company_name: 'Freeport-McMoRan',
    primary_bucket: 'RAW_MATERIAL',
    evidence_types: ['MANAGEMENT_COMMENTARY'],
    ai_revenue_visibility: 'INDIRECT', revenue_trend: 'STABLE',
    guidance_tone: 'NEUTRAL', backlog_or_orders: 'STABLE', margin_quality: 'STABLE',
    commercialization_status: 'REVENUE_VISIBLE',
    evidence_notes: [
      'Copper demand supported by AI infrastructure build-out narrative per management commentary.',
    ],
    caution_notes: [
      'AI revenue is indirect — copper price is driven by global industrial demand cycle.',
      'No direct AI revenue visibility. Evidence limited to commentary on copper demand narrative.',
      'Commodity price cycle dominates earnings, not AI deployment activity.',
    ],
    source: { quarter: 'Q3 2024', source_type: 'MANUAL', as_of: '2025-Q4' },
  },
]
