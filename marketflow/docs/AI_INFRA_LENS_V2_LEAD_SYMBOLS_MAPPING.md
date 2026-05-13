# V2 Lead Symbols Mapping

> Date: 2026-05-13
> Phase: V2-1
> Status: COMPLETE

---

## Per-Bucket Lead Symbols (top 3 by ai_infra_relevance_score)

Source: `src/lib/ai-infra/aiInfraCompanyPurity.ts`

| Bucket | Primary | Secondary | Tertiary | Notes |
|--------|---------|-----------|----------|-------|
| AI_CHIP | NVDA | AVGO | AMD | High AI revenue visibility; NVDA dominant |
| HBM_MEMORY | MU | — | — | SK하이닉스·삼성전자 미상장. MU 단일 프록시 |
| PACKAGING | TSM | ASML | LRCX | TSM=foundry; ASML/LRCX=equipment mixed |
| TEST_EQUIPMENT | TER | ONTO | FORM | TER=HBM/AI 테스트 직접 수혜 |
| PCB_SUBSTRATE | TTMI | SANM | FLEX | 모두 Mixed Exposure |
| OPTICAL_NETWORK | ANET | COHR | LITE | ANET 가장 높은 AI 직접 노출 |
| COOLING | VRT | ETN | MOD | VRT 최고 relevance; ETN=전력·냉각 복합 |
| POWER_INFRA | PWR | HUBB | GEV | 모두 Mixed Exposure; AI 전력 수요 간접 |
| DATA_CENTER_INFRA | SMCI | EQIX | DLR | SMCI=서버; EQIX/DLR=코로케이션 |
| CLEANROOM_WATER | ECL | XYL | WTS | 모두 INDIRECT_EXPOSURE |
| SPECIALTY_GAS | ENTG | LIN | APD | ENTG=반도체 특화; LIN/APD=산업가스 대형 |
| RAW_MATERIAL | FCX | SCCO | TECK | 구리 프록시 (AI 전력·냉각 수요) |
| GLASS_SUBSTRATE | GLW | — | — | INDIRECT_EXPOSURE. PRE_COMMERCIAL 단계 |

---

## Buckets Missing Lead Symbols

| Bucket | Status | Reason |
|--------|--------|--------|
| HBM_MEMORY | ⚠ 1 symbol only | SK하이닉스·삼성전자 미국 미상장; MU만 US-listed |
| GLASS_SUBSTRATE | ⚠ 1 symbol only | 상용화 초기; GLW 간접 노출만 |

---

## Buckets with Indirect Exposure Only

| Bucket | Primary Symbol | Exposure Type |
|--------|---------------|---------------|
| CLEANROOM_WATER | ECL, XYL, WTS | INDIRECT_EXPOSURE — 반도체 팹 인프라 지원 |
| GLASS_SUBSTRATE | GLW | INDIRECT_EXPOSURE — AI 용 유리기판 PRE_COMMERCIAL |
| RAW_MATERIAL | FCX, SCCO, TECK | INDIRECT_EXPOSURE — 구리·금속 원자재 |
| POWER_INFRA | PWR, HUBB, GEV | MIXED_EXPOSURE — AI 전력 수요 간접 수혜 |

---

## Coverage Score by Bucket

| Bucket | Symbol Count | Top Relevance Score | Status |
|--------|-------------|---------------------|--------|
| AI_CHIP | 4 | 95 (NVDA) | ✅ Strong |
| HBM_MEMORY | 1 | 88 (MU) | ⚠ Thin |
| PACKAGING | 6 | 90 (TSM) | ✅ Strong |
| TEST_EQUIPMENT | 4 | 85 (TER) | ✅ Good |
| PCB_SUBSTRATE | 4 | 80 (TTMI) | ✅ Good |
| OPTICAL_NETWORK | 5 | 88 (ANET) | ✅ Strong |
| COOLING | 5 | 88 (VRT) | ✅ Strong |
| POWER_INFRA | 3 | 78 (PWR) | ✅ Adequate |
| DATA_CENTER_INFRA | 4 | 85 (SMCI) | ✅ Good |
| CLEANROOM_WATER | 3 | 68 (ECL) | ⚠ Indirect |
| SPECIALTY_GAS | 3 | 82 (ENTG) | ✅ Adequate |
| RAW_MATERIAL | 4 | 75 (FCX) | ⚠ Indirect |
| GLASS_SUBSTRATE | 1 | 55 (GLW) | ⚠ Thin/Indirect |

**All 13 buckets covered. 3 thin/indirect buckets noted.**

---

## Recommendation for V2-3 Display

1. **Primary display symbol**: use top-relevance symbol per bucket
2. **HBM_MEMORY**: display MU with note "US-listed proxy (SK하이닉스/삼성 미포함)"
3. **GLASS_SUBSTRATE**: display GLW with `DATA_LIMITED` state label (indirect)
4. **Indirect buckets**: show `Indirect` badge next to symbol name in Sector Pulse Card

---

## V2-3 Implementation Notes

```typescript
// Primary symbol per bucket for Flow Map node label
const BUCKET_LEAD_SYMBOL: Record<AIInfraBucketId, string> = {
  AI_CHIP:           'NVDA',
  HBM_MEMORY:        'MU',
  PACKAGING:         'TSM',
  TEST_EQUIPMENT:    'TER',
  PCB_SUBSTRATE:     'TTMI',
  OPTICAL_NETWORK:   'ANET',
  COOLING:           'VRT',
  POWER_INFRA:       'PWR',
  DATA_CENTER_INFRA: 'SMCI',
  CLEANROOM_WATER:   'ECL',
  SPECIALTY_GAS:     'ENTG',
  RAW_MATERIAL:      'FCX',
  GLASS_SUBSTRATE:   'GLW',
}
```

Price data available via existing `readTickerRows` infrastructure — no new API required.
