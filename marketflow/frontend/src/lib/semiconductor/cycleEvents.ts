export interface CycleEvent {
  id: string
  label: string
  period: string
  stage: 'BOTTOM' | 'BUILD' | 'EXPAND' | 'PEAK' | 'RESET'
  duration_days: number
  soxx_drawdown: number
  soxx_recovery: number
  recovery_days: number
  trigger: string
  description: string
  analog_score: number
  analog_reason: string
  chartData: Array<{ day: number; soxx: number; soxl: number; stage: string }>
}

function generateEventChart(
  maxReturn: number,
  days: number,
  stageSequence: string[],
): CycleEvent['chartData'] {
  const points: CycleEvent['chartData'] = []
  const cap = Math.min(days, 360)
  const stageLen = Math.floor(cap / stageSequence.length)

  for (let i = 0; i <= cap; i++) {
    const stageIdx = Math.min(Math.floor(i / stageLen), stageSequence.length - 1)
    const t = i / cap
    const noise = (Math.random() - 0.5) * 2

    let soxxVal: number
    if (maxReturn < 0) {
      const peak = cap * 0.4
      soxxVal = i < peak
        ? 100 + (i / peak) * 10 + noise
        : 110 + ((i - peak) / (cap - peak)) * maxReturn + noise
    } else {
      soxxVal = 100 + t * maxReturn * 0.8 + noise
    }

    const s = Math.max(20, parseFloat(soxxVal.toFixed(1)))
    points.push({
      day:   i,
      soxx:  s,
      soxl:  Math.max(1, parseFloat((100 + (s - 100) * 2.8 + noise * 2).toFixed(1))),
      stage: stageSequence[stageIdx] ?? 'PEAK',
    })
  }
  return points
}

export const CYCLE_EVENTS: CycleEvent[] = [
  {
    id: '2000-dotcom',
    label: '2000-03 Dot-com',
    period: '2000-03 ~ 2002-10',
    stage: 'RESET',
    duration_days: 940,
    soxx_drawdown: -82,
    soxx_recovery: 120,
    recovery_days: 730,
    trigger: '인터넷 버블 붕괴 + 수요 급락',
    description:
      'DRAM 가격 80% 폭락. 출하량 40% 감소. 장비 투자 전면 중단. P1 Equipment이 6개월 선행 붕괴 후 전체 섹터 하락.',
    analog_score: 35,
    analog_reason:
      '유사: 고점 집중도 HIGH, P1 선행 약화. 차이: 당시는 실수요 기반 없었으나 현재 AI 수요는 실재.',
    chartData: generateEventChart(-82, 940, ['PEAK', 'RESET', 'RESET', 'BUILD', 'EXPAND']),
  },
  {
    id: '2008-gfc',
    label: '2008-09 GFC',
    period: '2008-09 ~ 2009-03',
    stage: 'RESET',
    duration_days: 180,
    soxx_drawdown: -60,
    soxx_recovery: 85,
    recovery_days: 365,
    trigger: '글로벌 신용위기 (외부 충격)',
    description:
      '거시 충격으로 전 산업 동시 붕괴. 반도체는 후기사이클 특성상 특히 취약. 단, 회복도 빨라 2009 하반기 반등.',
    analog_score: 42,
    analog_reason:
      '유사: PEAK 구간 외부충격 취약. P1 Equipment이 먼저 꺾임. 차이: 금융시스템 위기 vs 현재는 무역/관세 충격.',
    chartData: generateEventChart(-60, 180, ['PEAK', 'RESET', 'BUILD', 'EXPAND']),
  },
  {
    id: '2016-memory-super',
    label: '2016-18 메모리 슈퍼사이클',
    period: '2016-01 ~ 2018-09',
    stage: 'PEAK',
    duration_days: 970,
    soxx_drawdown: -42,
    soxx_recovery: 130,
    recovery_days: 480,
    trigger: 'DRAM/NAND 수요 폭증 (데이터센터 + 스마트폰)',
    description:
      'DRAM 가격 3배 상승. 하지만 2018년 하반기 공급과잉으로 급전환. P1 Equipment이 PEAK보다 4개월 먼저 꺾임.',
    analog_score: 78,
    analog_reason:
      '유사도 높음: 집중도 HIGH, P1 선행 약화, PEAK Confidence LOW. 핵심 차이: 당시 메모리 주도 vs 현재 AI compute 주도.',
    chartData: generateEventChart(-42, 970, ['BUILD', 'EXPAND', 'PEAK', 'PEAK', 'RESET', 'BUILD']),
  },
  {
    id: '2020-shortage',
    label: '2020-22 공급부족→재고역전',
    period: '2020-05 ~ 2022-10',
    stage: 'PEAK',
    duration_days: 880,
    soxx_drawdown: -50,
    soxx_recovery: 95,
    recovery_days: 540,
    trigger: '팬데믹 과주문 → 수요 급랭',
    description:
      '팬데믹 수요 폭증으로 과주문. 공급망 병목. 2022년 수요 급랭으로 재고 역전. P1 Equipment이 12개월 선행 고점 후 하락.',
    analog_score: 71,
    analog_reason:
      '유사: P1 선행 약화 패턴 동일. Breadth 붕괴 선행. 차이: 현재 AI 수요가 완충 역할 중.',
    chartData: generateEventChart(-50, 880, ['BUILD', 'EXPAND', 'PEAK', 'PEAK', 'RESET', 'BUILD', 'EXPAND']),
  },
  {
    id: '2023-recovery',
    label: '2023-24 재고 정상화',
    period: '2023-01 ~ 2024-06',
    stage: 'BUILD',
    duration_days: 540,
    soxx_drawdown: 0,
    soxx_recovery: 80,
    recovery_days: 540,
    trigger: '재고 소진 + AI 서버 HBM 수요',
    description:
      '과잉 재고 소진. AI 가속기 수요 부상. 메모리 가격 반등. P2 Memory 선행 회복. Breadth 점진적 확산.',
    analog_score: 55,
    analog_reason: '현재의 직전 국면. P2 Memory 강세 유산이 현재 신호에 남아있음.',
    chartData: generateEventChart(80, 540, ['BOTTOM', 'BUILD', 'EXPAND', 'PEAK']),
  },
  {
    id: '2024-ai-wave',
    label: '2024-현재 AI 1st Wave',
    period: '2024-07 ~ 현재',
    stage: 'PEAK',
    duration_days: 300,
    soxx_drawdown: -15,
    soxx_recovery: 0,
    recovery_days: 0,
    trigger: 'AI Capex + 집중 수요 (NVDA 주도)',
    description:
      'AI 가속기(NVDA) + HBM(MU) 중심 수요 급증. Equipment P1은 후행. Breadth NARROW. Concentration HIGH. Conflict Mode ON.',
    analog_score: 100,
    analog_reason: '현재 진행 중. 2018 메모리 사이클 PEAK 후반부와 가장 유사.',
    chartData: generateEventChart(-15, 300, ['BUILD', 'EXPAND', 'PEAK', 'PEAK']),
  },
]
