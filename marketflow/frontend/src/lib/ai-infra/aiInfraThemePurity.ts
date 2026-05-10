// AI Bottleneck Radar 버킷별 Theme Purity 수동 메타데이터 — Phase E-1
// 결정론적 정의: LLM/earnings extraction 불사용, 전문가 판단 기반

import type { AIInfraBucketId } from '@/lib/semiconductor/aiInfraBucketMap'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ThemePurity             = 'PURE_PLAY' | 'PARTIAL' | 'STORY_HEAVY'
export type CommercializationStage  = 'COMMERCIAL' | 'SCALING' | 'EARLY' | 'PRE_COMMERCIAL'
export type AIExposureLevel         = 'DIRECT' | 'INDIRECT' | 'EMERGING'
export type StoryConfidence         = 'HIGH' | 'MEDIUM' | 'LOW'
export type RevenueVisibility       = 'VISIBLE' | 'PARTIAL' | 'NOT_YET_VISIBLE'

export type BucketThemePurity = {
  theme_purity:            ThemePurity
  commercialization_stage: CommercializationStage
  ai_exposure_level:       AIExposureLevel
  story_confidence:        StoryConfidence
  revenue_visibility:      RevenueVisibility
  commercialization_risk:  boolean
  rationale:               string
}

// ── 13-Bucket Definitions ─────────────────────────────────────────────────────

export const BUCKET_THEME_PURITY: Record<AIInfraBucketId, BucketThemePurity> = {

  AI_CHIP: {
    theme_purity:            'PURE_PLAY',
    commercialization_stage: 'COMMERCIAL',
    ai_exposure_level:       'DIRECT',
    story_confidence:        'HIGH',
    revenue_visibility:      'VISIBLE',
    commercialization_risk:  false,
    rationale:               'GPU/AI ASIC 수요가 직접 매출에 반영. NVDA/AMD/AVGO AI 비중 >70%.',
  },

  HBM_MEMORY: {
    theme_purity:            'PURE_PLAY',
    commercialization_stage: 'COMMERCIAL',
    ai_exposure_level:       'DIRECT',
    story_confidence:        'HIGH',
    revenue_visibility:      'VISIBLE',
    commercialization_risk:  false,
    rationale:               'HBM 수요가 AI 가속기에 직결. MU/SKH AI 관련 매출 비중 급증.',
  },

  PACKAGING: {
    theme_purity:            'PARTIAL',
    commercialization_stage: 'COMMERCIAL',
    ai_exposure_level:       'INDIRECT',
    story_confidence:        'HIGH',
    revenue_visibility:      'VISIBLE',
    commercialization_risk:  false,
    rationale:               'CoWoS/SoIC 패키징은 AI칩 직결. 단, 비AI 패키징과 혼재.',
  },

  TEST_EQUIPMENT: {
    theme_purity:            'PARTIAL',
    commercialization_stage: 'COMMERCIAL',
    ai_exposure_level:       'INDIRECT',
    story_confidence:        'HIGH',
    revenue_visibility:      'PARTIAL',
    commercialization_risk:  false,
    rationale:               '반도체 테스트는 AI 사이클 수혜지만 모바일/자동차 등 비AI 수요 혼재.',
  },

  DATA_CENTER_INFRA: {
    theme_purity:            'PARTIAL',
    commercialization_stage: 'SCALING',
    ai_exposure_level:       'INDIRECT',
    story_confidence:        'MEDIUM',
    revenue_visibility:      'PARTIAL',
    commercialization_risk:  false,
    rationale:               'AI 데이터센터 확장 수혜. 단, 기업 IT 수요와 AI 수요 구분 불명확.',
  },

  POWER_INFRA: {
    theme_purity:            'PARTIAL',
    commercialization_stage: 'SCALING',
    ai_exposure_level:       'INDIRECT',
    story_confidence:        'MEDIUM',
    revenue_visibility:      'PARTIAL',
    commercialization_risk:  false,
    rationale:               'AI 데이터센터 전력 수요 급증. 산업용 전력 수요와 병행.',
  },

  COOLING: {
    theme_purity:            'PARTIAL',
    commercialization_stage: 'SCALING',
    ai_exposure_level:       'INDIRECT',
    story_confidence:        'MEDIUM',
    revenue_visibility:      'PARTIAL',
    commercialization_risk:  false,
    rationale:               '액체냉각 수요는 AI GPU 밀도와 직결. 기존 HVAC 사업과 혼재.',
  },

  OPTICAL_NETWORK: {
    theme_purity:            'PARTIAL',
    commercialization_stage: 'SCALING',
    ai_exposure_level:       'INDIRECT',
    story_confidence:        'MEDIUM',
    revenue_visibility:      'PARTIAL',
    commercialization_risk:  false,
    rationale:               'AI 클러스터 내부 고속 연결 수요 확대. 기업 네트워크 수요 병행.',
  },

  RAW_MATERIAL: {
    theme_purity:            'STORY_HEAVY',
    commercialization_stage: 'EARLY',
    ai_exposure_level:       'EMERGING',
    story_confidence:        'LOW',
    revenue_visibility:      'NOT_YET_VISIBLE',
    commercialization_risk:  true,
    rationale:               '구리/우라늄 AI 수요 서사는 존재하나 현재 AI 비중 매출 연결이 불명확. 가격은 글로벌 산업 사이클에 더 의존.',
  },

  SPECIALTY_GAS: {
    theme_purity:            'PARTIAL',
    commercialization_stage: 'COMMERCIAL',
    ai_exposure_level:       'INDIRECT',
    story_confidence:        'MEDIUM',
    revenue_visibility:      'VISIBLE',
    commercialization_risk:  false,
    rationale:               '반도체 팹 공정에 직접 공급. AI 수요 확대 수혜지만 전체 팹 가동률 의존.',
  },

  CLEANROOM_WATER: {
    theme_purity:            'PARTIAL',
    commercialization_stage: 'COMMERCIAL',
    ai_exposure_level:       'INDIRECT',
    story_confidence:        'MEDIUM',
    revenue_visibility:      'VISIBLE',
    commercialization_risk:  false,
    rationale:               '팹 클린룸 초순수 공급. 반도체 생산 직결 수혜. AI 전용 구분 불가.',
  },

  GLASS_SUBSTRATE: {
    theme_purity:            'STORY_HEAVY',
    commercialization_stage: 'PRE_COMMERCIAL',
    ai_exposure_level:       'EMERGING',
    story_confidence:        'LOW',
    revenue_visibility:      'NOT_YET_VISIBLE',
    commercialization_risk:  true,
    rationale:               '인텔 주도의 유리기판은 양산 미개시. 상용화 타임라인 불확실. 현재 매출 기여 없음.',
  },

  PCB_SUBSTRATE: {
    theme_purity:            'PARTIAL',
    commercialization_stage: 'SCALING',
    ai_exposure_level:       'INDIRECT',
    story_confidence:        'MEDIUM',
    revenue_visibility:      'PARTIAL',
    commercialization_risk:  false,
    rationale:               'ABF 기판은 AI 칩 패키징에 직결 확장. Ajinomoto/Ibiden 실적 개선 확인.',
  },
}

// ── Lookup helper (safe for tower virtual IDs) ────────────────────────────────

export function getThemePurity(bucketId: string): BucketThemePurity | undefined {
  return (BUCKET_THEME_PURITY as Record<string, BucketThemePurity | undefined>)[bucketId]
}

// ── Display helpers ───────────────────────────────────────────────────────────

export const THEME_PURITY_LABEL: Record<ThemePurity, string> = {
  PURE_PLAY:   'Pure Play',
  PARTIAL:     'Partial',
  STORY_HEAVY: 'Story Heavy',
}

export const COMM_STAGE_LABEL: Record<CommercializationStage, string> = {
  COMMERCIAL:     '상용화',
  SCALING:        '확장 중',
  EARLY:          '초기',
  PRE_COMMERCIAL: '양산 전',
}

export const REVENUE_VIS_LABEL: Record<RevenueVisibility, string> = {
  VISIBLE:         '매출 확인',
  PARTIAL:         '부분 확인',
  NOT_YET_VISIBLE: '미확인',
}
