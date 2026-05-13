# AI Infra Lens V2-2 Live Flow Map

> Date: 2026-05-13
> Phase: V2-2
> Status: COMPLETE

---

## Purpose

Add `OneLineConclusion` + `LiveFlowMap` + `ExpertModeToggle` to the AI Infrastructure Radar
screen. The 7 expert tabs are now collapsed behind a toggle by default. Default view = one-line
sector summary + 5-stage flow visualization.

---

## V2 Master Plan Reference

`docs/AI_INFRA_LENS_V2_MASTER_PLAN.md`

---

## Files Created

| File | Role |
|------|------|
| `src/lib/ai-infra/v2/buildOneLineConclusion.ts` | Pure function: `AIInfraBucketState[]` → Korean 1-sentence conclusion |
| `src/lib/ai-infra/v2/flowMapLayout.ts` | Layout engine: node positions + connector coords for 5-stage SVG |
| `src/components/ai-infra/v2/FlowMapNode.tsx` | SVG `<g>` node: rect + state dot + label + score |
| `src/components/ai-infra/v2/FlowMapConnector.tsx` | SVG cubic bezier connector with arrowhead defs |
| `src/components/ai-infra/v2/LiveFlowMap.tsx` | Main SVG component: ResizeObserver + stage columns + nodes + connectors |
| `src/components/ai-infra/v2/OneLineConclusion.tsx` | Colored banner rendering buildOneLineConclusion output |
| `src/components/ai-infra/v2/ExpertModeToggle.tsx` | `▸ 전문가 탭 열기 / ▾ 전문가 탭 닫기` toggle |

---

## Files Modified

| File | Changes |
|------|---------|
| `AIInfrastructureRadar.tsx` | +3 imports, +2 states (`selectedFlowId`, `isExpertOpen`), insert V2 components, wrap expert section |

---

## Render Order (post V2-2)

```
InfraBridgeCompactSummary            ← always
Header (AI Bottleneck Radar title)   ← always
Loading / Error state                ← conditional

[data loaded]:
  OneLineConclusion                  ← always (V2 NEW)
  LiveFlowMap                        ← always (V2 NEW)
  ExpertModeToggle                   ← always (V2 NEW)

  [isExpertOpen = true]:
    ControlBar
    SummaryStrip
    DataQualityBadges
    dataNotes
    TabBar + 7 tabs
```

---

## OneLineConclusion Logic

| Condition | Sentence |
|-----------|----------|
| leading ≥ 3 | AI 인프라 섹터 전반에 강한 순환 흐름이 형성 중입니다. |
| leading ≥ 1 AND emerging ≥ 2 | {top} 주도, {emerging} 추종 흐름이 확인됩니다. |
| leading = 1 AND emerging = 0 | {top} 단독 주도권 유지 중. 인접 버킷 추종 여부 주시. |
| crowded ≥ 2 | 과열 구간 진입 버킷 증가 — 로테이션 탐색 유효. |
| dist ≥ 2 | 분배 국면 버킷 증가 — 섹터 로테이션 압력 높아짐. |
| lagging ≥ 6 | AI 인프라 전반 부진 — 주도 버킷 부재. |
| confirming ≥ 4 AND leading = 0 | 뚜렷한 주도 없이 Confirming 흐름 — 초기 징후 탐색 중. |
| else | 혼재 구간 — {positive}개 긍정, {lagging}개 부진. |

---

## LiveFlowMap Layout

- 5 horizontal stage columns (left → right)
- `containerWidth` via ResizeObserver; minimum 600px (horizontal scroll on mobile)
- Node size: 148 × 42px (adapts to container)
- Node colors from `STATE_COLORS[state_label]`
- Dashed border for `DATA_INSUFFICIENT` buckets
- Click node → `selectedFlowId` state (deselect on second click)
- Stage header labels: `S1 · AI CORE` through `S5 · POWER / DC`
- Cubic bezier connectors with arrowheads between stages

---

## State: selectedFlowId

Stored in `AIInfrastructureRadar` as `string | null`. Selected node highlighted in LiveFlowMap.
Tab-level filtering by selectedFlowId is deferred to V2-3/V2-5.

---

## Non-Goals (V2-2)

- Tab auto-scroll to selected bucket → V2-3
- Sector Pulse Card (90-day sparkline) → V2-4
- Symbol mini-card → V2-3/V2-5
- Mobile vertical layout → V2-6
- V2 version badge update → deferred

---

## Validation

| Check | Status |
|-------|--------|
| OneLineConclusion renders with states | ✅ |
| LiveFlowMap 5 stage columns visible | ✅ |
| Node click toggles selectedFlowId | ✅ |
| Expert tabs hidden by default | ✅ |
| Expert tabs visible after toggle | ✅ |
| TypeScript exit 0 | ✅ |
| Forbidden language absent | ✅ |
| CLAUDE.md font/color rules respected | ✅ |

---

## V2-3 Next Step Gate

- [x] OneLineConclusion renders rule-based Korean sentence
- [x] LiveFlowMap shows all 13 buckets in 5 stage columns
- [x] Expert tabs collapsed by default
- [x] TypeScript exit 0

**READY_FOR_V2_3_SECTOR_PULSE_CARD**
