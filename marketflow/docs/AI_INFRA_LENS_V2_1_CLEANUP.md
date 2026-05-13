# AI Infra Lens V2-1 Cleanup

> Date: 2026-05-13
> Phase: V2-1
> Status: COMPLETE

---

## Purpose

Preparation step for V2. Remove "쉽게 보기 / 자세히 보기" mode toggle and the
AI Investment Tower report section from `AIInfrastructureRadar.tsx`. Establish
data source and lead symbol mapping for V2-3/V2-4/V2-5.

---

## V2 Master Plan Reference

`docs/AI_INFRA_LENS_V2_MASTER_PLAN.md`

---

## "쉽게 보기" Removal Path

### Removed from `AIInfrastructureRadar.tsx`

1. **13 imports** from `ai-investment-tower` (BeginnerReport, ProReport, AITowerSummaryCards, SelectedLayerDetailPanel, SelectedLayerTrendChart, AIInvestmentLayerRRGBoard, adaptTowerLayers, generateBeginnerReport, generateBeginnerOverall, generateProReport, buildTowerSummary, SelectedLayerDetail type, LayerRRGBoardItem type)
2. **`reportMode` state** — `useState<'beginner' | 'pro'>('beginner')`
3. **`selectedLayerId` state** — `useState<string | null>(null)`
4. **`towerBuckets` / `towerStates` variables**
5. **Toggle button UI** — `[ 쉽게 보기 | 자세히 보기 ]` button bar
6. **Report IIFE block** — entire `{(() => { ... })()}` block including AITowerSummaryCards, BeginnerReport/ProReport conditional, SelectedLayerDetailPanel, SelectedLayerTrendChart, AIInvestmentLayerRRGBoard

### Quarantine status

Original files in `src/components/ai-investment-tower/` and `src/lib/ai-investment-tower/` are **not deleted** — they remain in place but are no longer imported. Effectively quarantined by removal of all imports.

Physical `_legacy/` folder not created (files are in `ai-investment-tower/` namespace, not `ai-infra/`). Their removal from the import tree constitutes sufficient isolation for V2 development.

---

## "자세히 보기" Label Removal

- Toggle button UI removed entirely
- No `"자세히 보기"` string remains in `AIInfrastructureRadar.tsx`
- 7 existing tabs (VALUE CHAIN, THEME MAP, HEATMAP, EARNINGS, STATE LABELS, RS, RRG) are now the primary and only view

---

## Data Source Investigation Result

See: `docs/AI_INFRA_LENS_V2_DATA_SOURCE_DECISION.md`

**Conclusion:** Existing `ohlcv_daily` + `readTickerRows` infrastructure covers all 13 lead symbols. No new data provider needed for V2-3 MVP.

---

## Lead Symbols Mapping Result

See: `docs/AI_INFRA_LENS_V2_LEAD_SYMBOLS_MAPPING.md`

- All 13 buckets covered
- 3 thin/indirect buckets: HBM_MEMORY (1 symbol), GLASS_SUBSTRATE (1 symbol, indirect), RAW_MATERIAL (indirect)
- `BUCKET_LEAD_SYMBOL` map defined for V2-3 node display

---

## UI Changes Applied

| Change | Status |
|--------|--------|
| "쉽게 보기" button removed from UI | ✅ |
| "자세히 보기" button removed from UI | ✅ |
| Mode toggle div removed | ✅ |
| reportMode state removed | ✅ |
| BeginnerReport removed from render | ✅ |
| ProReport removed from render | ✅ |
| AITowerSummaryCards removed from render | ✅ |
| SelectedLayerDetailPanel removed from render | ✅ |
| 7 existing tabs preserved | ✅ |
| InfraBridgeCompactSummary preserved | ✅ |
| ControlBar preserved | ✅ |
| SummaryStrip preserved | ✅ |
| DataQualityBadges preserved | ✅ |
| All API responses unchanged | ✅ |

---

## Files Preserved (unchanged)

- `src/components/ai-infra/ThemeMapPanel.tsx`
- `src/components/ai-infra/ThemeFlowLadder.tsx`
- `src/components/ai-infra/ValueChainLadder.tsx`
- `src/components/ai-infra/BottleneckHeatmap.tsx`
- `src/components/ai-infra/EarningsConfirmationPanel.tsx`
- `src/components/ai-infra/InfraBridgeCompactSummary.tsx`
- `src/components/semiconductor/BucketRRGPanel.tsx`
- `src/app/api/ai-infra/theme-momentum/route.ts`
- All `src/lib/ai-infra/*` files

---

## Non-Goals (V2-1)

- Live Flow Map visualization → V2-2
- Sector Pulse Card → V2-4
- Symbol mini-card → V2-3/V2-5
- New API routes → not created
- Expert Mode toggle (link to 7 tabs) → V2-2
- Physical _legacy folder → deferred
- BeginnerReport/ProReport permanent deletion → after v2 complete

---

## Validation

| Check | Status |
|-------|--------|
| "쉽게 보기" 탭이 UI에서 제거됨 | ✅ |
| "자세히 보기" 라벨이 제거됨 | ✅ |
| 두 모드 전환 UI가 제거됨 | ✅ |
| 기존 7개 탭이 모두 정상 작동 | ✅ |
| Compact Bridge Summary 그대로 | ✅ |
| 모든 API 응답 변경 없음 | ✅ |
| AI_INFRA_COMPANY_PURITY 매핑 검증 완료 | ✅ 13/13 buckets covered |
| Data Source Decision 문서 생성됨 | ✅ |
| Lead Symbols Mapping 문서 생성됨 | ✅ |
| TypeScript 통과 | ✅ exit 0 |
| 금지 언어 미사용 | ✅ |

---

## V2-2 Next Step Gate (all met)

- [x] "쉽게 보기" 완전 제거 확인
- [x] 기존 7개 탭 정상 작동
- [x] Data Source Decision 문서 확정
- [x] Lead Symbols Mapping 완료 (13/13 buckets)
- [x] TypeScript 통과

**READY_FOR_V2_2_LIVE_FLOW_MAP**
