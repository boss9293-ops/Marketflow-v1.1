// AI Bottleneck Radar 종목별 Theme Purity 수동 메타데이터 — Phase E-2
// 결정론적 정의: LLM/earnings extraction 불사용, 전문가 판단 기반

import type { AIInfraBucketId } from '@/lib/semiconductor/aiInfraBucketMap'
import { AI_INFRA_BUCKETS } from '@/lib/semiconductor/aiInfraBucketMap'

// ── Types ──────────────────────────────────────────────────────────────────────

export type AIInfraCompanyExposureLevel =
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'INDIRECT'

export type AIInfraCompanyPurity =
  | 'PURE_PLAY'
  | 'HIGH_EXPOSURE'
  | 'MIXED_EXPOSURE'
  | 'INDIRECT_EXPOSURE'
  | 'STORY_HEAVY'
  | 'DATA_INSUFFICIENT'

export type AIInfraCompanyCommercialStage =
  | 'COMMERCIAL'
  | 'EARLY_COMMERCIAL'
  | 'PILOT'
  | 'PRE_COMMERCIAL'
  | 'INFRASTRUCTURE_ENABLER'
  | 'MIXED'
  | 'UNKNOWN'

export type AIInfraCompanyRevenueVisibility =
  | 'VISIBLE'
  | 'PARTIAL'
  | 'UNCLEAR'
  | 'NOT_YET_VISIBLE'
  | 'UNKNOWN'

export type AIInfraCompanyPurityMetadata = {
  symbol:                   string
  company_name?:            string
  primary_bucket:           AIInfraBucketId
  secondary_buckets?:       AIInfraBucketId[]
  company_theme_purity:     AIInfraCompanyPurity
  ai_infra_exposure_level:  AIInfraCompanyExposureLevel
  commercial_stage:         AIInfraCompanyCommercialStage
  revenue_visibility:       AIInfraCompanyRevenueVisibility
  pure_play_score:          number  // 0–100
  ai_infra_relevance_score: number  // 0–100
  commercialization_risk:   boolean
  indirect_exposure:        boolean
  story_risk:               boolean
  notes:                    string[]
}

// ── Display helpers ────────────────────────────────────────────────────────────

export const COMPANY_PURITY_LABEL: Record<AIInfraCompanyPurity, string> = {
  PURE_PLAY:         'Pure Play',
  HIGH_EXPOSURE:     'High Exposure',
  MIXED_EXPOSURE:    'Mixed',
  INDIRECT_EXPOSURE: 'Indirect',
  STORY_HEAVY:       'Story Heavy',
  DATA_INSUFFICIENT: 'Data Insuff.',
}

export const COMPANY_EXPOSURE_LABEL: Record<AIInfraCompanyExposureLevel, string> = {
  HIGH:     'High',
  MEDIUM:   'Medium',
  LOW:      'Low',
  INDIRECT: 'Indirect',
}

// ── 43-Symbol Definitions ─────────────────────────────────────────────────────

export const AI_INFRA_COMPANY_PURITY: AIInfraCompanyPurityMetadata[] = [

  // ── AI_CHIP ────────────────────────────────────────────────────────────────
  {
    symbol: 'NVDA', company_name: 'NVIDIA Corp',
    primary_bucket: 'AI_CHIP',
    company_theme_purity: 'HIGH_EXPOSURE',
    ai_infra_exposure_level: 'HIGH',
    commercial_stage: 'COMMERCIAL',
    revenue_visibility: 'VISIBLE',
    pure_play_score: 90, ai_infra_relevance_score: 98,
    commercialization_risk: false, indirect_exposure: false, story_risk: false,
    notes: ['GPU/CUDA 플랫폼이 AI 인프라 수요의 핵심. 데이터센터 부문 매출 비중 >80%.'],
  },
  {
    symbol: 'AMD', company_name: 'Advanced Micro Devices',
    primary_bucket: 'AI_CHIP',
    company_theme_purity: 'HIGH_EXPOSURE',
    ai_infra_exposure_level: 'HIGH',
    commercial_stage: 'COMMERCIAL',
    revenue_visibility: 'VISIBLE',
    pure_play_score: 75, ai_infra_relevance_score: 88,
    commercialization_risk: false, indirect_exposure: false, story_risk: false,
    notes: ['MI300 AI 가속기 시장 점유 확대 중. PC/콘솔 부문과 혼재.'],
  },
  {
    symbol: 'AVGO', company_name: 'Broadcom Inc',
    primary_bucket: 'AI_CHIP',
    secondary_buckets: ['OPTICAL_NETWORK', 'PACKAGING'],
    company_theme_purity: 'HIGH_EXPOSURE',
    ai_infra_exposure_level: 'HIGH',
    commercial_stage: 'COMMERCIAL',
    revenue_visibility: 'VISIBLE',
    pure_play_score: 70, ai_infra_relevance_score: 88,
    commercialization_risk: false, indirect_exposure: false, story_risk: false,
    notes: ['AI ASIC(TPU/XPU)과 네트워킹 반도체로 AI 인프라 이중 노출. VMware 인수로 기업 SW 혼재.'],
  },
  {
    symbol: 'MRVL', company_name: 'Marvell Technology',
    primary_bucket: 'AI_CHIP',
    secondary_buckets: ['OPTICAL_NETWORK'],
    company_theme_purity: 'HIGH_EXPOSURE',
    ai_infra_exposure_level: 'HIGH',
    commercial_stage: 'COMMERCIAL',
    revenue_visibility: 'PARTIAL',
    pure_play_score: 65, ai_infra_relevance_score: 82,
    commercialization_risk: false, indirect_exposure: false, story_risk: false,
    notes: ['커스텀 AI ASIC + 광통신 DSP 이중 노출. 클라우드 파트너 집중도 높음.'],
  },

  // ── HBM_MEMORY ─────────────────────────────────────────────────────────────
  {
    symbol: 'MU', company_name: 'Micron Technology',
    primary_bucket: 'HBM_MEMORY',
    company_theme_purity: 'HIGH_EXPOSURE',
    ai_infra_exposure_level: 'HIGH',
    commercial_stage: 'COMMERCIAL',
    revenue_visibility: 'PARTIAL',
    pure_play_score: 70, ai_infra_relevance_score: 88,
    commercialization_risk: false, indirect_exposure: false, story_risk: false,
    notes: ['US 상장 HBM/메모리 대표 프록시. 삼성·SK하이닉스 미포함으로 HBM 시장 전체 대표성 제한.'],
  },

  // ── PACKAGING ──────────────────────────────────────────────────────────────
  {
    symbol: 'AMAT', company_name: 'Applied Materials',
    primary_bucket: 'PACKAGING',
    secondary_buckets: ['GLASS_SUBSTRATE'],
    company_theme_purity: 'MIXED_EXPOSURE',
    ai_infra_exposure_level: 'MEDIUM',
    commercial_stage: 'COMMERCIAL',
    revenue_visibility: 'PARTIAL',
    pure_play_score: 55, ai_infra_relevance_score: 75,
    commercialization_risk: false, indirect_exposure: false, story_risk: false,
    notes: ['팹 장비 전반 공급 — AI 수요 수혜지만 비AI(모바일·자동차) 노출 혼재.'],
  },
  {
    symbol: 'KLAC', company_name: 'KLA Corp',
    primary_bucket: 'PACKAGING',
    secondary_buckets: ['TEST_EQUIPMENT'],
    company_theme_purity: 'MIXED_EXPOSURE',
    ai_infra_exposure_level: 'MEDIUM',
    commercial_stage: 'COMMERCIAL',
    revenue_visibility: 'VISIBLE',
    pure_play_score: 60, ai_infra_relevance_score: 78,
    commercialization_risk: false, indirect_exposure: false, story_risk: false,
    notes: ['프로세스 제어 및 검사 장비 — 첨단 패키징·테스트 양쪽 수혜.'],
  },
  {
    symbol: 'ACMR', company_name: 'ACM Research',
    primary_bucket: 'PACKAGING',
    secondary_buckets: ['CLEANROOM_WATER'],
    company_theme_purity: 'MIXED_EXPOSURE',
    ai_infra_exposure_level: 'MEDIUM',
    commercial_stage: 'COMMERCIAL',
    revenue_visibility: 'PARTIAL',
    pure_play_score: 55, ai_infra_relevance_score: 68,
    commercialization_risk: false, indirect_exposure: false, story_risk: false,
    notes: ['반도체 세정·도금 장비 전문. 중국 노출도 높아 지정학 리스크 혼재.'],
  },
  {
    symbol: 'TSM', company_name: 'Taiwan Semiconductor (ADR)',
    primary_bucket: 'PACKAGING',
    company_theme_purity: 'HIGH_EXPOSURE',
    ai_infra_exposure_level: 'HIGH',
    commercial_stage: 'COMMERCIAL',
    revenue_visibility: 'VISIBLE',
    pure_play_score: 82, ai_infra_relevance_score: 95,
    commercialization_risk: false, indirect_exposure: false, story_risk: false,
    notes: ['CoWoS/SoIC 고급 패키징 주도. AI 가속기 제조의 핵심 파운드리. ADR 형태로 US 거래.'],
  },

  // ── COOLING ────────────────────────────────────────────────────────────────
  {
    symbol: 'VRT', company_name: 'Vertiv Holdings',
    primary_bucket: 'COOLING',
    secondary_buckets: ['POWER_INFRA', 'DATA_CENTER_INFRA'],
    company_theme_purity: 'HIGH_EXPOSURE',
    ai_infra_exposure_level: 'HIGH',
    commercial_stage: 'COMMERCIAL',
    revenue_visibility: 'VISIBLE',
    pure_play_score: 80, ai_infra_relevance_score: 92,
    commercialization_risk: false, indirect_exposure: false, story_risk: false,
    notes: ['데이터센터 전력·냉각 인프라 전문. AI 클러스터 밀도 증가 직접 수혜.'],
  },
  {
    symbol: 'ETN', company_name: 'Eaton Corp',
    primary_bucket: 'COOLING',
    secondary_buckets: ['POWER_INFRA'],
    company_theme_purity: 'MIXED_EXPOSURE',
    ai_infra_exposure_level: 'MEDIUM',
    commercial_stage: 'COMMERCIAL',
    revenue_visibility: 'VISIBLE',
    pure_play_score: 50, ai_infra_relevance_score: 75,
    commercialization_risk: false, indirect_exposure: false, story_risk: false,
    notes: ['광범위 전기화 기업. AI 데이터센터 노출 중요하나 산업·항공·자동차 매출 혼재.'],
  },
  {
    symbol: 'TT', company_name: 'Trane Technologies',
    primary_bucket: 'COOLING',
    company_theme_purity: 'MIXED_EXPOSURE',
    ai_infra_exposure_level: 'MEDIUM',
    commercial_stage: 'COMMERCIAL',
    revenue_visibility: 'PARTIAL',
    pure_play_score: 50, ai_infra_relevance_score: 70,
    commercialization_risk: false, indirect_exposure: false, story_risk: false,
    notes: ['HVAC 전문기업. AI 서버 냉각 수혜 있으나 상업용 빌딩 냉난방이 주력.'],
  },
  {
    symbol: 'MOD', company_name: 'Modine Manufacturing',
    primary_bucket: 'COOLING',
    company_theme_purity: 'HIGH_EXPOSURE',
    ai_infra_exposure_level: 'MEDIUM',
    commercial_stage: 'COMMERCIAL',
    revenue_visibility: 'PARTIAL',
    pure_play_score: 65, ai_infra_relevance_score: 72,
    commercialization_risk: false, indirect_exposure: false, story_risk: false,
    notes: ['데이터센터 냉각 솔루션 비중 빠르게 증가 중. 자동차 열관리 사업과 혼재.'],
  },
  {
    symbol: 'NVT', company_name: 'nVent Electric',
    primary_bucket: 'COOLING',
    secondary_buckets: ['POWER_INFRA'],
    company_theme_purity: 'MIXED_EXPOSURE',
    ai_infra_exposure_level: 'MEDIUM',
    commercial_stage: 'COMMERCIAL',
    revenue_visibility: 'PARTIAL',
    pure_play_score: 50, ai_infra_relevance_score: 68,
    commercialization_risk: false, indirect_exposure: false, story_risk: false,
    notes: ['인클로저·열관리 전문. 데이터센터 비중 확대 중이나 산업 인프라 혼재.'],
  },

  // ── PCB_SUBSTRATE ──────────────────────────────────────────────────────────
  {
    symbol: 'TTMI', company_name: 'TTM Technologies',
    primary_bucket: 'PCB_SUBSTRATE',
    company_theme_purity: 'MIXED_EXPOSURE',
    ai_infra_exposure_level: 'MEDIUM',
    commercial_stage: 'COMMERCIAL',
    revenue_visibility: 'PARTIAL',
    pure_play_score: 55, ai_infra_relevance_score: 70,
    commercialization_risk: false, indirect_exposure: false, story_risk: false,
    notes: ['AI 서버 PCB 수혜 있으나 방산·자동차·통신 PCB와 혼재.'],
  },
  {
    symbol: 'SANM', company_name: 'Sanmina Corp',
    primary_bucket: 'PCB_SUBSTRATE',
    company_theme_purity: 'MIXED_EXPOSURE',
    ai_infra_exposure_level: 'MEDIUM',
    commercial_stage: 'COMMERCIAL',
    revenue_visibility: 'PARTIAL',
    pure_play_score: 45, ai_infra_relevance_score: 65,
    commercialization_risk: false, indirect_exposure: false, story_risk: false,
    notes: ['EMS/하드웨어 제조 — AI 인프라 연결 유의미하나 광범위 산업 혼재.'],
  },
  {
    symbol: 'CLS', company_name: 'Celestica Inc',
    primary_bucket: 'PCB_SUBSTRATE',
    company_theme_purity: 'MIXED_EXPOSURE',
    ai_infra_exposure_level: 'MEDIUM',
    commercial_stage: 'COMMERCIAL',
    revenue_visibility: 'PARTIAL',
    pure_play_score: 45, ai_infra_relevance_score: 65,
    commercialization_risk: false, indirect_exposure: false, story_risk: false,
    notes: ['EMS 기업 — AI 서버·네트워크 장비 제조 비중 증가 중.'],
  },
  {
    symbol: 'FLEX', company_name: 'Flex Ltd',
    primary_bucket: 'PCB_SUBSTRATE',
    company_theme_purity: 'MIXED_EXPOSURE',
    ai_infra_exposure_level: 'MEDIUM',
    commercial_stage: 'COMMERCIAL',
    revenue_visibility: 'PARTIAL',
    pure_play_score: 45, ai_infra_relevance_score: 65,
    commercialization_risk: false, indirect_exposure: false, story_risk: false,
    notes: ['대형 EMS 기업 — AI 데이터센터 노출 있으나 자동차·헬스케어 혼재.'],
  },

  // ── TEST_EQUIPMENT ─────────────────────────────────────────────────────────
  {
    symbol: 'TER', company_name: 'Teradyne Inc',
    primary_bucket: 'TEST_EQUIPMENT',
    company_theme_purity: 'HIGH_EXPOSURE',
    ai_infra_exposure_level: 'HIGH',
    commercial_stage: 'COMMERCIAL',
    revenue_visibility: 'VISIBLE',
    pure_play_score: 75, ai_infra_relevance_score: 85,
    commercialization_risk: false, indirect_exposure: false, story_risk: false,
    notes: ['AI 칩·HBM 테스트 수요 직접 수혜. 산업용 자동화 부문 혼재.'],
  },
  {
    symbol: 'COHU', company_name: 'Cohu Inc',
    primary_bucket: 'TEST_EQUIPMENT',
    company_theme_purity: 'HIGH_EXPOSURE',
    ai_infra_exposure_level: 'MEDIUM',
    commercial_stage: 'COMMERCIAL',
    revenue_visibility: 'PARTIAL',
    pure_play_score: 70, ai_infra_relevance_score: 75,
    commercialization_risk: false, indirect_exposure: false, story_risk: false,
    notes: ['반도체 테스트 핸들러·소켓 전문. 소형주로 데이터 희소성 있음.'],
  },
  {
    symbol: 'FORM', company_name: 'FormFactor Inc',
    primary_bucket: 'TEST_EQUIPMENT',
    company_theme_purity: 'HIGH_EXPOSURE',
    ai_infra_exposure_level: 'HIGH',
    commercial_stage: 'COMMERCIAL',
    revenue_visibility: 'PARTIAL',
    pure_play_score: 75, ai_infra_relevance_score: 82,
    commercialization_risk: false, indirect_exposure: false, story_risk: false,
    notes: ['프로브카드 전문 — AI 칩·HBM 웨이퍼 테스트 직접 수혜.'],
  },
  {
    symbol: 'ONTO', company_name: 'Onto Innovation',
    primary_bucket: 'TEST_EQUIPMENT',
    company_theme_purity: 'HIGH_EXPOSURE',
    ai_infra_exposure_level: 'HIGH',
    commercial_stage: 'COMMERCIAL',
    revenue_visibility: 'PARTIAL',
    pure_play_score: 75, ai_infra_relevance_score: 82,
    commercialization_risk: false, indirect_exposure: false, story_risk: false,
    notes: ['고급 패키징·3D IC 검사 전문 — AI 칩 패키징 수요 직접 수혜.'],
  },

  // ── GLASS_SUBSTRATE ────────────────────────────────────────────────────────
  {
    symbol: 'GLW', company_name: 'Corning Inc',
    primary_bucket: 'GLASS_SUBSTRATE',
    company_theme_purity: 'STORY_HEAVY',
    ai_infra_exposure_level: 'MEDIUM',
    commercial_stage: 'PRE_COMMERCIAL',
    revenue_visibility: 'NOT_YET_VISIBLE',
    pure_play_score: 35, ai_infra_relevance_score: 58,
    commercialization_risk: true, indirect_exposure: false, story_risk: true,
    notes: [
      '유리기판 개념 중요하나 회사 수준 AI 매출 가시성 제한적.',
      '광섬유·디스플레이·생명과학 등 다각화 사업이 주력.',
      'Intel 유리기판 이니셔티브 연결 있으나 양산 타임라인 불확실.',
    ],
  },

  // ── OPTICAL_NETWORK ────────────────────────────────────────────────────────
  {
    symbol: 'ANET', company_name: 'Arista Networks',
    primary_bucket: 'OPTICAL_NETWORK',
    company_theme_purity: 'HIGH_EXPOSURE',
    ai_infra_exposure_level: 'HIGH',
    commercial_stage: 'COMMERCIAL',
    revenue_visibility: 'VISIBLE',
    pure_play_score: 80, ai_infra_relevance_score: 92,
    commercialization_risk: false, indirect_exposure: false, story_risk: false,
    notes: ['AI 클러스터 내부 이더넷 스위칭 선도. 하이퍼스케일러 집중도 높음.'],
  },
  {
    symbol: 'CIEN', company_name: 'Ciena Corp',
    primary_bucket: 'OPTICAL_NETWORK',
    company_theme_purity: 'HIGH_EXPOSURE',
    ai_infra_exposure_level: 'MEDIUM',
    commercial_stage: 'COMMERCIAL',
    revenue_visibility: 'PARTIAL',
    pure_play_score: 65, ai_infra_relevance_score: 75,
    commercialization_risk: false, indirect_exposure: false, story_risk: false,
    notes: ['광전송 장비 — AI 데이터센터 인터커넥트 수혜. 통신사 사이클 의존도 혼재.'],
  },
  {
    symbol: 'LITE', company_name: 'lumentum Holdings',
    primary_bucket: 'OPTICAL_NETWORK',
    company_theme_purity: 'HIGH_EXPOSURE',
    ai_infra_exposure_level: 'MEDIUM',
    commercial_stage: 'COMMERCIAL',
    revenue_visibility: 'PARTIAL',
    pure_play_score: 65, ai_infra_relevance_score: 75,
    commercialization_risk: false, indirect_exposure: false, story_risk: false,
    notes: ['광통신 부품·레이저 — AI 데이터센터 광 트랜시버 수요 수혜.'],
  },
  {
    symbol: 'COHR', company_name: 'Coherent Corp',
    primary_bucket: 'OPTICAL_NETWORK',
    company_theme_purity: 'HIGH_EXPOSURE',
    ai_infra_exposure_level: 'MEDIUM',
    commercial_stage: 'COMMERCIAL',
    revenue_visibility: 'PARTIAL',
    pure_play_score: 65, ai_infra_relevance_score: 78,
    commercialization_risk: false, indirect_exposure: false, story_risk: false,
    notes: ['광부품·트랜시버 — AI 데이터센터 고속 연결 수혜. II-VI 합병 후 복잡도 증가.'],
  },

  // ── POWER_INFRA ────────────────────────────────────────────────────────────
  {
    symbol: 'PWR', company_name: 'Quanta Services',
    primary_bucket: 'POWER_INFRA',
    company_theme_purity: 'MIXED_EXPOSURE',
    ai_infra_exposure_level: 'MEDIUM',
    commercial_stage: 'COMMERCIAL',
    revenue_visibility: 'VISIBLE',
    pure_play_score: 55, ai_infra_relevance_score: 78,
    commercialization_risk: false, indirect_exposure: false, story_risk: false,
    notes: ['전력망 EPC 서비스 — AI 데이터센터 전력 인프라 구축 수혜.'],
  },
  {
    symbol: 'HUBB', company_name: 'Hubbell Inc',
    primary_bucket: 'POWER_INFRA',
    company_theme_purity: 'MIXED_EXPOSURE',
    ai_infra_exposure_level: 'MEDIUM',
    commercial_stage: 'COMMERCIAL',
    revenue_visibility: 'VISIBLE',
    pure_play_score: 55, ai_infra_relevance_score: 75,
    commercialization_risk: false, indirect_exposure: false, story_risk: false,
    notes: ['전력 인프라 기기 — AI 데이터센터 전력 수요 간접 수혜.'],
  },
  {
    symbol: 'GEV', company_name: 'GE Vernova',
    primary_bucket: 'POWER_INFRA',
    company_theme_purity: 'MIXED_EXPOSURE',
    ai_infra_exposure_level: 'MEDIUM',
    commercial_stage: 'COMMERCIAL',
    revenue_visibility: 'PARTIAL',
    pure_play_score: 50, ai_infra_relevance_score: 72,
    commercialization_risk: false, indirect_exposure: false, story_risk: false,
    notes: ['GE 분사 전력 사업부 — 터빈·그리드·풍력 복합. AI 전력 서사와 일치하나 IPO 2024.'],
  },

  // ── CLEANROOM_WATER ────────────────────────────────────────────────────────
  {
    symbol: 'XYL', company_name: 'Xylem Inc',
    primary_bucket: 'CLEANROOM_WATER',
    company_theme_purity: 'INDIRECT_EXPOSURE',
    ai_infra_exposure_level: 'MEDIUM',
    commercial_stage: 'INFRASTRUCTURE_ENABLER',
    revenue_visibility: 'PARTIAL',
    pure_play_score: 40, ai_infra_relevance_score: 65,
    commercialization_risk: false, indirect_exposure: true, story_risk: false,
    notes: ['수처리 인프라 — 반도체 팹 초순수 공급 수혜. AI 전용 매출 구분 불가.'],
  },
  {
    symbol: 'ECL', company_name: 'Ecolab Inc',
    primary_bucket: 'CLEANROOM_WATER',
    company_theme_purity: 'MIXED_EXPOSURE',
    ai_infra_exposure_level: 'MEDIUM',
    commercial_stage: 'INFRASTRUCTURE_ENABLER',
    revenue_visibility: 'PARTIAL',
    pure_play_score: 45, ai_infra_relevance_score: 68,
    commercialization_risk: false, indirect_exposure: true, story_risk: false,
    notes: ['산업 위생·수처리 — 반도체 팹 케미컬 서비스 제공. 식음료·헬스케어 혼재.'],
  },
  {
    symbol: 'WTS', company_name: 'Watts Water Technologies',
    primary_bucket: 'CLEANROOM_WATER',
    company_theme_purity: 'INDIRECT_EXPOSURE',
    ai_infra_exposure_level: 'LOW',
    commercial_stage: 'INFRASTRUCTURE_ENABLER',
    revenue_visibility: 'UNCLEAR',
    pure_play_score: 35, ai_infra_relevance_score: 55,
    commercialization_risk: false, indirect_exposure: true, story_risk: false,
    notes: ['배관·유체 제어 기기 — 반도체 팹 간접 인프라. AI 노출도 낮음.'],
  },

  // ── SPECIALTY_GAS ──────────────────────────────────────────────────────────
  {
    symbol: 'LIN', company_name: 'Linde plc',
    primary_bucket: 'SPECIALTY_GAS',
    company_theme_purity: 'MIXED_EXPOSURE',
    ai_infra_exposure_level: 'MEDIUM',
    commercial_stage: 'COMMERCIAL',
    revenue_visibility: 'PARTIAL',
    pure_play_score: 45, ai_infra_relevance_score: 68,
    commercialization_risk: false, indirect_exposure: false, story_risk: false,
    notes: ['산업가스 글로벌 1위 — 반도체 특수가스 공급. 석유화학·의료 혼재.'],
  },
  {
    symbol: 'APD', company_name: 'Air Products & Chemicals',
    primary_bucket: 'SPECIALTY_GAS',
    company_theme_purity: 'MIXED_EXPOSURE',
    ai_infra_exposure_level: 'MEDIUM',
    commercial_stage: 'COMMERCIAL',
    revenue_visibility: 'PARTIAL',
    pure_play_score: 45, ai_infra_relevance_score: 65,
    commercialization_risk: false, indirect_exposure: false, story_risk: false,
    notes: ['산업가스 — 반도체 팹 공급 수혜. 수소·에너지 전환 투자와 혼재.'],
  },
  {
    symbol: 'ENTG', company_name: 'Entegris Inc',
    primary_bucket: 'SPECIALTY_GAS',
    company_theme_purity: 'HIGH_EXPOSURE',
    ai_infra_exposure_level: 'HIGH',
    commercial_stage: 'COMMERCIAL',
    revenue_visibility: 'VISIBLE',
    pure_play_score: 75, ai_infra_relevance_score: 85,
    commercialization_risk: false, indirect_exposure: false, story_risk: false,
    notes: ['반도체 공정 재료·가스 전문 — 첨단 노드 수요와 AI 팹 확장 직접 수혜.'],
  },

  // ── DATA_CENTER_INFRA ──────────────────────────────────────────────────────
  {
    symbol: 'EQIX', company_name: 'Equinix Inc',
    primary_bucket: 'DATA_CENTER_INFRA',
    company_theme_purity: 'MIXED_EXPOSURE',
    ai_infra_exposure_level: 'MEDIUM',
    commercial_stage: 'COMMERCIAL',
    revenue_visibility: 'VISIBLE',
    pure_play_score: 55, ai_infra_relevance_score: 80,
    commercialization_risk: false, indirect_exposure: false, story_risk: false,
    notes: ['글로벌 코로케이션 REIT — AI 인프라 확장 수혜. 금리 민감 구조.'],
  },
  {
    symbol: 'DLR', company_name: 'Digital Realty Trust',
    primary_bucket: 'DATA_CENTER_INFRA',
    company_theme_purity: 'MIXED_EXPOSURE',
    ai_infra_exposure_level: 'MEDIUM',
    commercial_stage: 'COMMERCIAL',
    revenue_visibility: 'VISIBLE',
    pure_play_score: 55, ai_infra_relevance_score: 78,
    commercialization_risk: false, indirect_exposure: false, story_risk: false,
    notes: ['데이터센터 REIT — AI 클러스터 임대 수혜. 금리·공급 확대 리스크.'],
  },
  {
    symbol: 'IRM', company_name: 'Iron Mountain Inc',
    primary_bucket: 'DATA_CENTER_INFRA',
    company_theme_purity: 'MIXED_EXPOSURE',
    ai_infra_exposure_level: 'MEDIUM',
    commercial_stage: 'COMMERCIAL',
    revenue_visibility: 'PARTIAL',
    pure_play_score: 50, ai_infra_relevance_score: 70,
    commercialization_risk: false, indirect_exposure: false, story_risk: false,
    notes: ['기록 관리·데이터센터 REIT — AI 인프라 서사 부합. 기존 문서 보관 사업 혼재.'],
  },

  // ── RAW_MATERIAL ───────────────────────────────────────────────────────────
  {
    symbol: 'FCX', company_name: 'Freeport-McMoRan',
    primary_bucket: 'RAW_MATERIAL',
    company_theme_purity: 'INDIRECT_EXPOSURE',
    ai_infra_exposure_level: 'INDIRECT',
    commercial_stage: 'MIXED',
    revenue_visibility: 'UNCLEAR',
    pure_play_score: 30, ai_infra_relevance_score: 55,
    commercialization_risk: false, indirect_exposure: true, story_risk: false,
    notes: ['구리 생산 — AI 인프라 전력망 구리 수요 서사 존재. 가격은 글로벌 산업 사이클 의존.'],
  },
  {
    symbol: 'SCCO', company_name: 'Southern Copper Corp',
    primary_bucket: 'RAW_MATERIAL',
    company_theme_purity: 'INDIRECT_EXPOSURE',
    ai_infra_exposure_level: 'INDIRECT',
    commercial_stage: 'MIXED',
    revenue_visibility: 'UNCLEAR',
    pure_play_score: 30, ai_infra_relevance_score: 52,
    commercialization_risk: false, indirect_exposure: true, story_risk: false,
    notes: ['구리 생산 — FCX와 유사한 간접 AI 인프라 노출. 남미 정치 리스크 혼재.'],
  },
  {
    symbol: 'TECK', company_name: 'Teck Resources',
    primary_bucket: 'RAW_MATERIAL',
    company_theme_purity: 'INDIRECT_EXPOSURE',
    ai_infra_exposure_level: 'INDIRECT',
    commercial_stage: 'MIXED',
    revenue_visibility: 'UNCLEAR',
    pure_play_score: 30, ai_infra_relevance_score: 50,
    commercialization_risk: false, indirect_exposure: true, story_risk: false,
    notes: ['구리·아연·석탄 복합 광업 — AI 수요 간접 노출. 석탄 사업 다각화 혼재.'],
  },
  {
    symbol: 'COPX', company_name: 'Global X Copper Miners ETF',
    primary_bucket: 'RAW_MATERIAL',
    company_theme_purity: 'INDIRECT_EXPOSURE',
    ai_infra_exposure_level: 'INDIRECT',
    commercial_stage: 'MIXED',
    revenue_visibility: 'UNCLEAR',
    pure_play_score: 25, ai_infra_relevance_score: 50,
    commercialization_risk: false, indirect_exposure: true, story_risk: false,
    notes: ['구리 광업 ETF — 단일 종목이 아닌 바스켓. 간접 AI 인프라 구리 수요 노출.'],
  },
]

// ── Derived lookup map ─────────────────────────────────────────────────────────

const COMPANY_PURITY_BY_SYMBOL = new Map<string, AIInfraCompanyPurityMetadata>(
  AI_INFRA_COMPANY_PURITY.map(m => [m.symbol, m]),
)

// ── Lookup helpers ─────────────────────────────────────────────────────────────

export function getAIInfraCompanyPurity(symbol: string): AIInfraCompanyPurityMetadata | undefined {
  return COMPANY_PURITY_BY_SYMBOL.get(symbol)
}

export function getAIInfraCompaniesByBucket(bucketId: AIInfraBucketId): AIInfraCompanyPurityMetadata[] {
  return AI_INFRA_COMPANY_PURITY.filter(
    m => m.primary_bucket === bucketId || m.secondary_buckets?.includes(bucketId),
  )
}

// ── Bucket-level summary ───────────────────────────────────────────────────────

export type AIInfraBucketCompanyPuritySummary = {
  bucket_id:                  AIInfraBucketId
  average_pure_play_score:    number | null
  average_ai_relevance_score: number | null
  high_exposure_count:        number
  indirect_exposure_count:    number
  story_risk_count:           number
}

export function buildBucketCompanyPuritySummary(
  bucketId: AIInfraBucketId,
): AIInfraBucketCompanyPuritySummary {
  const companies = getAIInfraCompaniesByBucket(bucketId)
  if (companies.length === 0) {
    return {
      bucket_id: bucketId,
      average_pure_play_score: null,
      average_ai_relevance_score: null,
      high_exposure_count: 0,
      indirect_exposure_count: 0,
      story_risk_count: 0,
    }
  }
  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null
  return {
    bucket_id:                  bucketId,
    average_pure_play_score:    avg(companies.map(c => c.pure_play_score)),
    average_ai_relevance_score: avg(companies.map(c => c.ai_infra_relevance_score)),
    high_exposure_count:        companies.filter(c => c.ai_infra_exposure_level === 'HIGH').length,
    indirect_exposure_count:    companies.filter(c => c.indirect_exposure).length,
    story_risk_count:           companies.filter(c => c.story_risk).length,
  }
}

// ── Validation ─────────────────────────────────────────────────────────────────

export type AIInfraCompanyPurityValidationResult = {
  valid:    boolean
  warnings: string[]
  errors:   string[]
}

export function validateAIInfraCompanyPurity(): AIInfraCompanyPurityValidationResult {
  const warnings: string[] = []
  const errors:   string[] = []

  // Duplicate symbol check
  const seen = new Set<string>()
  for (const m of AI_INFRA_COMPANY_PURITY) {
    if (seen.has(m.symbol)) errors.push(`Duplicate symbol: ${m.symbol}`)
    seen.add(m.symbol)
  }

  // Score range check
  for (const m of AI_INFRA_COMPANY_PURITY) {
    if (m.pure_play_score < 0 || m.pure_play_score > 100)
      errors.push(`${m.symbol}: pure_play_score out of range (${m.pure_play_score})`)
    if (m.ai_infra_relevance_score < 0 || m.ai_infra_relevance_score > 100)
      errors.push(`${m.symbol}: ai_infra_relevance_score out of range (${m.ai_infra_relevance_score})`)
  }

  // Story/commercialization risk consistency
  for (const m of AI_INFRA_COMPANY_PURITY) {
    if (m.company_theme_purity === 'STORY_HEAVY' && !m.story_risk && !m.commercialization_risk)
      warnings.push(`${m.symbol}: STORY_HEAVY purity but neither story_risk nor commercialization_risk is set`)
    if (m.company_theme_purity === 'INDIRECT_EXPOSURE' && !m.indirect_exposure)
      warnings.push(`${m.symbol}: INDIRECT_EXPOSURE purity but indirect_exposure is false`)
  }

  // Coverage check: every live bucket symbol should have a record
  const allBucketSymbols = new Set<string>()
  for (const bucket of AI_INFRA_BUCKETS) {
    for (const sym of bucket.symbols) allBucketSymbols.add(sym)
  }
  for (const sym of allBucketSymbols) {
    if (!COMPANY_PURITY_BY_SYMBOL.has(sym))
      warnings.push(`${sym}: in bucket map but no company purity record`)
  }

  return { valid: errors.length === 0, warnings, errors }
}
