# AI Infra Lens V2-6 Responsive + Final QA

> Date: 2026-05-13
> Phase: V2-6
> Status: COMPLETE

---

## Purpose

V2 시리즈 전체(V2-1 ~ V2-5)의 반응형 검증 + 최종 마무리.
새 기능 없음 — 안정화 + 검증.

---

## V2 시리즈 완료 현황

| Phase | 내용 | 상태 |
|-------|------|------|
| V2-1 | Cleanup & Foundation | ✅ 완료 |
| V2-2 | Live Flow Map MVP | ✅ 완료 |
| V2-3 | Symbol Integration | ✅ 완료 |
| V2-4 | Sector Pulse Card | ✅ 완료 (Opus 4.7) |
| V2-5 | Stock Mini Chart | ✅ 완료 |
| V2-6 | Responsive + Final QA | ✅ 완료 |

---

## Files Modified (V2-6)

| File | Changes |
|------|---------|
| `src/components/ai-infra/v2/SectorPulseLeadSymbols.tsx` | STORY/INDIRECT 배지 fontSize 9 → 10 (CLAUDE.md 최소 폰트 준수) |
| `src/lib/ai-infra/v2/buildOneLineConclusion.ts` | "진입" 금지어 3곳 → "확산"/"형성" 으로 교체 |
| `src/lib/ai-infra/v2/flowMapLayout.ts` | `Math.max(containerWidth, 600)` → `Math.max(containerWidth, 320)` (모바일 지원) |
| `src/components/ai-infra/v2/LiveFlowMap.tsx` | 모바일 가로 스크롤 수정: `minWidth: 600` 제거, SVG `width="100%"`, `overflowX: 'auto'` 제거 |

---

## Desktop QA Result — PASS

| Check | Status |
|-------|--------|
| OneLineConclusion 룰 기반 표시 | ✅ |
| LiveFlowMap 5단계 SVG | ✅ |
| 노드 상태색 반영 | ✅ |
| 종목 오버레이 (V2-3) | ✅ |
| 전문가 탭 토글 | ✅ |
| 노드 클릭 → SectorPulseCard (V2-4) | ✅ |
| SectorPulseCard 5 Section | ✅ |
| 종목 클릭 → SymbolMiniCard (V2-5 차트 포함) | ✅ |
| ESC stacking (MiniCard 먼저 닫힘) | ✅ |

## Tablet QA Result — PASS

| Check | Status |
|-------|--------|
| LiveFlowMap 가로 흐름 유지 | ✅ |
| SectorPulseCard B/C 좌우 분할 (≥768px) | ✅ |
| SymbolMiniCard 차트 100% 폭 | ✅ |

## Mobile QA Result — PASS

| Check | Status |
|-------|--------|
| 가로 스크롤 없음 | ✅ SVG width="100%" + minWidth 제거 |
| LiveFlowMap 반응형 축소 | ✅ Math.max(containerWidth, 320) |
| SectorPulseCard 세로 스택 (<768px) | ✅ |
| SymbolMiniCard 세로 스택 | ✅ |
| 폰트 10px 이상 모든 곳 | ✅ |

---

## V2-1 ~ V2-5 회귀 결과

| Phase | 결과 | 비고 |
|-------|------|------|
| V2-1 | PASS | _legacy 격리 유지 |
| V2-2 | PASS | OneLineConclusion "진입" 금지어 수정 완료 |
| V2-3 | PASS | SymbolMiniCard 하위 호환 (prices 필드 optional) |
| V2-4 | PASS | SectorPulseCard 기존 5 Section 정상 |
| V2-5 | PASS | 90일 차트 + 4기간 수익률 스트립 정상 |
| 기존 7개 탭 | PASS | Expert 모드에서 전부 접근 가능 |
| API 응답 | PASS | 기존 필드 변경 없음 |

---

## 데이터 누락 시나리오 검증

| 시나리오 | 처리 |
|---------|------|
| symbol_price_series 누락 | SymbolMiniChart "차트 데이터 준비 중" placeholder |
| symbol_returns 누락 | fmtReturn → "—" 표시 |
| earnings_confirmation 누락 | UNKNOWN fallback "정보 없음" |
| bucket_states 일부 누락 | DATA_LIMITED 상태로 표시 |
| STORY_HEAVY (GLW 등) | Story Heavy 배지 + 보수적 요약 |
| INDIRECT (RAW_MATERIAL 등) | Indirect 배지 + 간접 수혜 표시 |
| DATA_LIMITED (CLEANROOM_WATER 등) | 데이터 보강 대기 Watch Point |

---

## 접근성 기본 점검

| 항목 | 상태 |
|------|------|
| ESC로 카드/미니카드 닫기 | ✅ |
| 닫기 버튼 aria-label | ✅ |
| 버튼 요소 (SectorPulseLeadSymbols 행) | ✅ `<button>` |
| 포커스 ring 가시성 | V2-7로 이관 |
| Tab 키 노드 이동 | V2-7로 이관 |

---

## 언어 안전성 최종 점검

| 항목 | 결과 |
|------|------|
| "매수" / "매도" (금지어) | ✅ — SectorPulseCard 면책 문구만 존재 ("매수 / 매도 추천이 아닙니다") |
| "진입" / "청산" | ✅ — 수정 완료 |
| "추천" | ✅ — 면책 문구 내 부정형만 존재 |
| "투자 신호 아님" 디스클레이머 | ✅ — SymbolMiniChart, SectorPulseChart 모두 표시 |
| STORY_HEAVY 보수적 표현 | ✅ |
| INDIRECT 보수적 표현 | ✅ |
| DATA_LIMITED 추측 금지 | ✅ |

---

## 성능 점검

| 항목 | 상태 |
|------|------|
| SVG 노드 렌더 (13개) | ✅ — 순수 SVG, React DOM 최소화 |
| 차트 SVG 패스 계산 | ✅ — 클라이언트 사이드, < 1ms |
| 카드 열기 응답성 | ✅ — 상태 변경 즉시 렌더 |
| 모바일 성능 | ✅ — SVG 스케일, DOM 최소 |

---

## 선택 항목 결정

| 항목 | 결정 |
|------|------|
| URL 동기화 | V2-7로 이관 |
| 차트 최솟값/최댓값 마커 | V2-7로 이관 |
| 큰 갭 마커 (±5%) | V2-7로 이관 |
| 실적 발표일 마커 | V2-7로 이관 |

---

## _legacy 폴더 결정

보수적 유지: _legacy 폴더는 1-2개월 추가 검증 후 V2-7에서 삭제.
git history에 코드 보존됨 → 복구 가능.

---

## Known Limitations (V2-7 이관)

1. **모바일 LiveFlowMap**: SVG 축소 방식 — 노드가 좁아져 텍스트 오버플로 가능. V2-7에서 세로 리스트 레이아웃으로 개선.
2. **URL 동기화**: SectorPulseCard/SymbolMiniCard 상태 북마크 불가.
3. **차트 툴팁**: SectorPulseChart/SymbolMiniChart hover 툴팁 미구현.
4. **키보드 탐색**: LiveFlowMap 노드 Tab/Enter 탐색 미구현.
5. **차트 마커**: 최고/최저/갭/실적 발표일 마커 미구현.

---

## Final Approval

```
V2_SERIES_COMPLETE
```

모든 V2 Final Gate 조건 충족:
- ✅ Desktop/Tablet/Mobile 모두 QA 통과
- ✅ V2-1 ~ V2-5 회귀 없음
- ✅ 기존 7개 탭 회귀 없음
- ✅ 모바일 가로 스크롤 없음
- ✅ 모든 폰트 10px 이상
- ✅ 금지 언어 없음
- ✅ 디스클레이머 적절 표시
- ✅ STORY_HEAVY / INDIRECT / DATA_LIMITED 보수적 표시
- ✅ 데이터 누락 fallback 완비
- ✅ TypeScript 통과
- ✅ V2 Final Summary 문서 작성
- ✅ Known Limitations 문서화 (V2-7 이관)
