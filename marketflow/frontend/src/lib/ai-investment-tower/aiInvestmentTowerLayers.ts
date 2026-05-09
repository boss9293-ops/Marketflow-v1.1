// AI Investment Tower 10개 레이어 정의 및 13-버킷 집계 어댑터

import type { AIInfraBucketMomentum } from '@/lib/semiconductor/aiInfraBucketRS'
import type { AIInfraBucketState } from '@/lib/ai-infra/aiInfraStateLabels'
import type { AIInfraBucketId } from '@/lib/semiconductor/aiInfraBucketMap'
import type { LayerReportInput, RRGStateLabel, TrendLabel, RiskLabel } from './reportTypes'
import { adaptToBucketReport } from './reportTypes'

// ── Layer definition ──────────────────────────────────────────────────────────

export type AIInvestmentLayer = {
  id:              string
  label:           string
  koreanLabel:     string
  description:     string
  primaryEtf?:     string
  secondaryEtfs?:  string[]
  benchmark:       'SPY' | 'QQQ' | 'SOXX' | 'SMH'
  sourceBuckets?:  string[]
  basketSymbols:   string[]
  userMeaning:     string
}

export const AI_INVESTMENT_TOWER_LAYERS: AIInvestmentLayer[] = [
  {
    id:             'AI_COMPUTE',
    label:          'AI Compute',
    koreanLabel:    'AI 연산 반도체',
    description:    'AI 모델 훈련·추론을 담당하는 핵심 반도체 계층',
    primaryEtf:     'SMH',
    secondaryEtfs:  ['SOXX'],
    benchmark:      'SMH',
    sourceBuckets:  ['AI_CHIP', 'PACKAGING', 'TEST_EQUIPMENT'],
    basketSymbols:  ['NVDA', 'AMD', 'AVGO', 'TSM', 'ASML', 'AMAT', 'KLAC', 'LRCX'],
    userMeaning:    'AI 사이클의 핵심 엔진. 이 계층이 강하면 AI 투자 사이클이 살아있는 신호입니다.',
  },
  {
    id:             'MEMORY_HBM',
    label:          'Memory / HBM',
    koreanLabel:    '메모리 / HBM',
    description:    'AI 가속기에 연결되는 고대역폭 메모리 계층',
    primaryEtf:     'MU',
    benchmark:      'SOXX',
    sourceBuckets:  ['HBM_MEMORY'],
    basketSymbols:  ['MU', 'WDC', 'STX', 'SNDK'],
    userMeaning:    'AI GPU에 붙는 메모리. HBM 수요가 늘수록 이 계층이 혜택을 받습니다.',
  },
  {
    id:             'STORAGE_DATA',
    label:          'Storage & Data',
    koreanLabel:    '스토리지 / 데이터',
    description:    'AI 학습 데이터셋과 모델 저장을 담당하는 스토리지 계층',
    primaryEtf:     'PSTG',
    benchmark:      'QQQ',
    sourceBuckets:  ['STORAGE_DATA'],
    basketSymbols:  ['PSTG', 'NTAP', 'WDC', 'STX', 'MU'],
    userMeaning:    'AI 데이터 저장·관리 인프라. 데이터센터 확장과 함께 성장합니다.',
  },
  {
    id:             'NETWORKING_OPTICAL',
    label:          'Networking / Optical',
    koreanLabel:    '네트워크 / 광통신',
    description:    'AI 클러스터 내 고속 데이터 이동을 담당하는 네트워킹 계층',
    primaryEtf:     'IGN',
    secondaryEtfs:  ['ANET', 'MRVL'],
    benchmark:      'QQQ',
    sourceBuckets:  ['OPTICAL_NETWORK'],
    basketSymbols:  ['ANET', 'AVGO', 'MRVL', 'COHR', 'LITE', 'CIEN', 'CSCO'],
    userMeaning:    'GPU 클러스터 간 데이터 파이프. AI 모델 규모가 커질수록 수요가 증가합니다.',
  },
  {
    id:             'POWER_COOLING',
    label:          'Power & Cooling',
    koreanLabel:    '전력 / 냉각',
    description:    'AI 데이터센터의 전력 공급 및 열관리 인프라 계층',
    primaryEtf:     'XLI',
    secondaryEtfs:  ['GRID', 'VRT'],
    benchmark:      'SPY',
    sourceBuckets:  ['COOLING', 'POWER_INFRA', 'DATA_CENTER_INFRA'],
    basketSymbols:  ['VRT', 'ETN', 'PWR', 'MOD', 'GEV', 'TT', 'HUBB'],
    userMeaning:    '데이터센터가 많아질수록 전력·냉각 수요도 늘어납니다. AI 사이클의 물리 인프라입니다.',
  },
  {
    id:             'RAW_MATERIALS',
    label:          'Raw Materials',
    koreanLabel:    '원자재 / 에너지',
    description:    'AI 인프라 구축에 필요한 핵심 원자재 및 에너지 계층',
    primaryEtf:     'COPX',
    secondaryEtfs:  ['URA'],
    benchmark:      'SPY',
    sourceBuckets:  ['RAW_MATERIAL', 'SPECIALTY_GAS', 'CLEANROOM_WATER'],
    basketSymbols:  ['FCX', 'SCCO', 'CCJ', 'BWXT'],
    userMeaning:    '구리·우라늄 등 AI 인프라 건설의 업스트림 소재. AI 투자 확산의 가장 넓은 수혜 계층입니다.',
  },
  {
    id:             'CLOUD_HYPERSCALERS',
    label:          'Cloud / Hyperscalers',
    koreanLabel:    '클라우드 / 하이퍼스케일러',
    description:    'AI 인프라를 직접 구축·운영하는 빅테크 클라우드 계층',
    primaryEtf:     'QQQ',
    benchmark:      'QQQ',
    sourceBuckets:  ['CLOUD_HYPERSCALERS'],
    basketSymbols:  ['MSFT', 'GOOGL', 'AMZN', 'META', 'ORCL'],
    userMeaning:    'AI GPU를 가장 많이 사는 고객들. 클라우드 자본지출이 늘면 반도체 전체 사이클에 긍정적입니다.',
  },
  {
    id:             'AI_SOFTWARE',
    label:          'AI Software',
    koreanLabel:    'AI 소프트웨어',
    description:    'AI 모델·플랫폼·데이터 인프라 소프트웨어 계층',
    primaryEtf:     'AIQ',
    benchmark:      'QQQ',
    sourceBuckets:  ['AI_SOFTWARE'],
    basketSymbols:  ['PLTR', 'SNOW', 'CRM', 'MDB', 'DDOG', 'NOW'],
    userMeaning:    'AI를 제품으로 만드는 소프트웨어 계층. 하드웨어 사이클보다 늦게 혜택이 나타날 수 있습니다.',
  },
  {
    id:             'ROBOTICS_PHYSICAL_AI',
    label:          'Robotics / Physical AI',
    koreanLabel:    '로보틱스 / 피지컬 AI',
    description:    'AI가 물리 세계에 적용되는 로봇·자동화 계층',
    primaryEtf:     'BOTZ',
    secondaryEtfs:  ['ARKQ'],
    benchmark:      'SPY',
    sourceBuckets:  ['ROBOTICS_PHYSICAL_AI'],
    basketSymbols:  ['TSLA', 'ISRG', 'ABB', 'ROK', 'TER'],
    userMeaning:    'AI가 현실 세계에 들어오는 계층. 아직 초기 단계로, 사이클 확산 시 큰 성장이 예상됩니다.',
  },
  {
    id:             'CYBERSECURITY',
    label:          'Cybersecurity',
    koreanLabel:    '사이버보안',
    description:    'AI 인프라 및 기업 네트워크 보안 계층',
    primaryEtf:     'CIBR',
    secondaryEtfs:  ['HACK'],
    benchmark:      'QQQ',
    sourceBuckets:  ['CYBERSECURITY'],
    basketSymbols:  ['CRWD', 'PANW', 'ZS', 'FTNT', 'NET'],
    userMeaning:    'AI 확산과 함께 보안 위협도 늘어납니다. 방어적 성격이 강해 시장 하락기에도 상대적으로 견고합니다.',
  },
]

// ── RRG / Risk aggregation helpers ───────────────────────────────────────────

const RRG_RANK: Record<RRGStateLabel, number> = {
  LEADING: 5, MIXED: 4, IMPROVING: 3, UNKNOWN: 2, WEAKENING: 1, LAGGING: 0,
}

const RISK_RANK: Record<RiskLabel, number> = {
  UNKNOWN: 0, LOW: 1, MODERATE: 2, ELEVATED: 3, HIGH: 4, EXTREME: 5,
}

function avgOrNull(vals: (number | null | undefined)[]): number | null {
  const valid = vals.filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v))
  return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null
}

function dominantRRG(states: RRGStateLabel[]): RRGStateLabel {
  if (states.length === 0) return 'UNKNOWN'
  return states.reduce((best, s) => RRG_RANK[s] > RRG_RANK[best] ? s : best, states[0])
}

function maxRisk(risks: RiskLabel[]): RiskLabel {
  if (risks.length === 0) return 'UNKNOWN'
  return risks.reduce((max, r) => RISK_RANK[r] > RISK_RANK[max] ? r : max, risks[0])
}

// ── Adapter: 10-layer map + 13-bucket data → LayerReportInput[] ──────────────

export function adaptTowerLayers(
  buckets:       AIInfraBucketMomentum[],
  bucketStates:  AIInfraBucketState[],
  towerBuckets?: AIInfraBucketMomentum[],
  towerStates?:  AIInfraBucketState[],
): LayerReportInput[] {
  // Merge 13-bucket + 5 tower virtual buckets into unified lookup maps
  const allBuckets = [...buckets, ...(towerBuckets ?? [])]
  const allStates  = [...bucketStates, ...(towerStates ?? [])]
  const bucketMap  = new Map(allBuckets.map(b => [b.bucket_id as string, b]))
  const stateMap   = new Map(allStates.map(s => [s.bucket_id as string, s]))

  return AI_INVESTMENT_TOWER_LAYERS.map((layer): LayerReportInput => {
    const sourceIds = layer.sourceBuckets ?? []

    // Collect matched bucket reports
    const matched: LayerReportInput[] = []
    for (const sid of sourceIds) {
      const b = bucketMap.get(sid)
      const s = stateMap.get(sid)
      if (b && s) matched.push(adaptToBucketReport(b, s))
    }

    if (matched.length === 0) {
      // No source bucket data — return placeholder
      return {
        id:           layer.id,
        label:        layer.label,
        koreanLabel:  layer.koreanLabel,
        primaryEtf:   layer.primaryEtf,
        rrgState:     'UNKNOWN',
        momentum1w:   null,
        momentum1m:   null,
        momentum3m:   null,
        trendLabel:   'UNKNOWN',
        breadthLabel: 'UNKNOWN',
        riskLabel:    'UNKNOWN',
        towerSignal:  '확인 필요',
      }
    }

    if (matched.length === 1) {
      // Single source — return as-is with tower layer identity
      const m = matched[0]
      return { ...m, id: layer.id, label: layer.label, koreanLabel: layer.koreanLabel, primaryEtf: layer.primaryEtf }
    }

    // Multiple sources — aggregate
    const rrgState    = dominantRRG(matched.map(m => m.rrgState))
    const riskLabel   = maxRisk(matched.map(m => m.riskLabel))
    const momentum1w  = avgOrNull(matched.map(m => m.momentum1w))
    const momentum1m  = avgOrNull(matched.map(m => m.momentum1m))
    const momentum3m  = avgOrNull(matched.map(m => m.momentum3m))

    // Breadth: prefer BROAD if any source is BROAD, else aggregate
    const breadthLabels = matched.map(m => m.breadthLabel)
    const breadthLabel = breadthLabels.includes('BROAD')     ? 'BROAD'
                       : breadthLabels.includes('IMPROVING') ? 'IMPROVING'
                       : breadthLabels.includes('NARROW')    ? 'NARROW'
                       : breadthLabels.includes('WEAK')      ? 'WEAK'
                       : 'UNKNOWN'

    // Trend: from risk + momentum aggregate (reuse derivation from first match or compute)
    const trendLabel = matched[0].trendLabel

    // Tower signal: from dominant RRG state
    const towerSignalMap: Record<RRGStateLabel, string> = {
      LEADING:   '주도권 유지',
      IMPROVING: '비중 확대 후보',
      MIXED:     '관심권 진입',
      WEAKENING: '비중 조절 주의',
      LAGGING:   '관망 우선',
      UNKNOWN:   '확인 필요',
    }

    return {
      id:           layer.id,
      label:        layer.label,
      koreanLabel:  layer.koreanLabel,
      primaryEtf:   layer.primaryEtf,
      rrgState,
      momentum1w,
      momentum1m,
      momentum3m,
      trendLabel,
      breadthLabel,
      riskLabel,
      towerSignal:  towerSignalMap[rrgState],
    }
  })
}
