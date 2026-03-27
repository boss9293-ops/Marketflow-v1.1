# 대시보드 구조 분석 및 노출 순서 제안 (Dashboard Layout Analysis)

현재 `/dashboard` 페이지에는 매우 다양하고 전문적인 인사이트 패널들이 배치되어 있습니다. 사용자(투자자)가 **‘가장 먼저 알아야 할 핵심 정보’**부터 시작하여 **‘그 원인(구조 분석)’**, 그리고 **‘실행 및 향후 전망’**으로 물 흐르듯 이어지도록 재배치하는 것을 제안합니다.

---

## 1. 현재 대시보드 컴포넌트 리스트 (구성 요소 파악)

현재 코드를 분석한 결과, 아래와 같은 순서로 주요 컴포넌트들이 배치되어 있습니다.
1. **Top Portal & Executive Summary:** 네비게이션, 계정 정보, Market State 요약 헤더, 최신 알림(Recent Alerts), Market History Strip
2. **PORTAL BLOCKS (1~4):**
   - 구조 상태 뱃지 스트립 (Macro Chips 등)
   - Cross Asset Strip (주요 자산 실시간 테이프)
   - Today Changes (오늘의 주요 변화 요약)
   - AI Market Brief & 포지셔닝 결정 패널 (Decision Panel: Risk Mode, Exposure)
3. **Smart Analyzer 영역:** SmartAnalyzerSection, AlertBanner, SmartAnalyzerHero
4. **일간 요약 및 알림:** DailyStatusStrip, AlertList
5. **액션 및 가이던스:** InvestorActionConsole, StatusLegend, DailyChangeCard
6. **고급 전망 및 분석:** AnalogList (과거 비유), ForwardOutlookCard, TransitionProbabilityCard
7. **브리핑 뷰:** NarrativeBriefCard, LatestBriefCard, BriefHistoryCard
8. **관리 및 점검 툴:** Priority Strip, 파이프라인(Pipeline) 상태 카드들
9. **상세 디테일 (접기/펴기 영역):**
   - Market Structure (시장 구조: 유동성, 브레드스, 모멘텀, 섹터 로테이션)
   - Macro Pressure (매크로 압력)
   - Risk Engine (리스크 엔진 요약)
10. **나의 컨텍스트 (My Context):** 레버리지(TQQQ/SOXL), 은퇴 계좌 자산 배분 현황
11. **인텔 / 발굴:** HotPanel, MonitoredTopicsWidget
12. **면책 조항 (Disclaimer)**

---

## 2. 노출 순서 개편안 (Optimal Hierarchy)

정보를 습득하는 투자자의 사고 흐름(**"현재 상태는? → 무엇을 해야 하나? → 이유는 무엇인가? → 내 계좌에 미치는 영향은?"**)에 맞춰 5가지 티어로 순서를 제안합니다.

### 🔴 Tier 1: 최상위 요약 및 긴급 알림 (The "What" & "Emergency")
가장 먼저 눈에 들어와야 하는 부분입니다. 시장의 온도와 즉각적인 액션 밴드를 확인합니다.
1. **Alert Banner & Alert List (긴급)** - 시장에 심각한 충격이나 시그널이 발생했을 때 최우선 배치
2. **Top Portal & Decision Panel** (현재 렌더링 중인 PORTAL BLOCK 3+4의 결론)
   - AI Market Brief (오늘의 시장 요약)
   - Risk Mode (SHOCK/RED/YELLOW/GREEN) & Exposure (노출 범위)
3. **Today Changes & DailyStatusStrip** - 오늘 바뀐 중요한 변화와 지표 한눈에 보기

### 🟠 Tier 2: 투자자 액션 및 대응 가이던스 (The "Action")
현 상태를 바탕으로 '그래서 어떻게 해야 하는가'를 명확히 제시합니다.
4. **InvestorActionConsole** - 투자자 행동 지침 (디테일한 가이드)
5. **My Context (나의 컨텍스트)** - 내 주요 포지션(레버리지, 은퇴 계좌)에 대한 맞춤형 가이드라인 (현재 하단에 있으나, 투자자 개인에겐 Tier 1만큼 중요합니다.)

### 🟡 Tier 3: 시장 구조 및 원인 분석 (The "Why")
결론을 뒷받침하는 깊이 있는 매크로/구조적 데이터입니다.
6. **SmartAnalyzerHero / SmartAnalyzerSection** - 전체 구조 종합판
7. **Market Structure (섹터 로테이션, 유동성, 모멘텀)** - 접기/펴기 패널 (현상 유지하되, 우선순위 상향)
8. **Macro Pressure & Risk Engine** - 현상 유지 (디테일 뷰)
9. **Cross Asset Strip** - 주요 자산군 흐름

### 🟢 Tier 4: 향후 전망 및 시나리오 (The "Future")
앞으로 어떻게 전개될 수 있는지에 대한 확률적 전망입니다.
10. **ForwardOutlookCard & TransitionProbabilityCard** - 넥스트 시나리오/국면 전환 확률
11. **AnalogList** - 과거 유사 패턴 분석

### 🔵 Tier 5: 인텔, 브리핑 히스토리 및 시스템 관리 (Research & Admin)
필요할 때 찾아보는 연구 자료 및 시스템 상태입니다.
12. **Brief History / LatestBriefCard / NarrativeBriefCard** (과거 리포트 모음)
13. **Intel / Discovery (HotPanel), Monitored Topics**
14. **Pipeline Status Cards** (관리자/시스템 점검용)
15. **Status Legend & Disclaimer**

---

### 요약 및 적용 여부
현재 코드는 위에서부터 순서대로 나열되어 있어, **"나의 컨텍스트"**가 하단에 치우쳐 있고, **"InvestorActionConsole(행동 지침)"**이 중간에 혼재되어 있습니다. 
위 제안드린 **1 ~ 5 티어** 순서대로 UI 코드를 재배치해 드릴까요? (혹은 특별히 가장 상단으로 올리고 싶은 다른 컴포넌트가 있다면 말씀해 주세요.)
