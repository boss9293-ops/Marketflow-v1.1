# VR Survival (SOXL) 1-Page Design Document
*Semiconductor Regime Monitor & Tactical Strategy Board*

## 1. Core Definition
이 화면은 반도체가 지금 강한가를 보여주는 단순한 대시보드가 아닙니다. 
**"왜 강한지, 얼마나 지속될지, SOXL을 지금 전술적으로 써도 되는지"**를 판정하는 행동 중심의 도구입니다.
- **SOXX (Anchor):** 반도체 산업의 기초 체력 및 현재 레짐(Regime) 확인용
- **SOXL (Tactical):** 진입/청산의 타이밍 및 비중 조절용 (Hold / Add / Wait / Trim)

## 2. Must-Answer Questions
시스템은 사용자가 화면을 보자마자 다음 질문들에 대한 답을 즉각적으로 얻을 수 있도록 설계됩니다.
1. 지금 반도체 사이클은 어디에 있는가? (확장 / 과열 / 조정 / 바닥)
2. AI 수요는 Training 중심인가, Inference 중심인가?
3. 공급망의 병목은 어디인가? (수요 부진 vs HBM/패키징/장비 공급 한계)
4. 리더십 구조: NVDA 중심의 상승이 넓어지고 있는가(분산), 좁아지고 있는가(집중)?
5. **결론:** SOXL을 지금 Hold / Add / Wait / Trim 중 무엇으로 대응해야 하는가?

## 3. UI Structure (Tactical Board)
불필요한 카드 나열, 중복 요약, 시차가 큰 지표의 실시간 혼용을 철저히 배제합니다.

### [Top] Current Regime & Action (한 줄 결론)
- **현재 국면:** 예) "AI CapEx 확장기이나 단기 공급 병목에 의한 조정 국면"
- **Action:** 
  - **SOXX:** [Hold]
  - **SOXL:** [Wait] (진입 대기)

### [Section 1] Cycle Drivers (사실 및 전망)
*반도체 산업의 거시적 사이클을 판단하는 핵심 지표*
- WSTS 글로벌 반도체 매출 추이
- SEMI 장비 Billings (출하액)
- FRED 반도체 생산지수
- 재고/출하 비율 (Inventory-to-Shipment Ratio)
- Hyperscaler 4사 CapEx 추이 및 가이던스

### [Section 2] Leadership Map (내부 신호)
*대형 리더 기업들의 패턴과 SOXX의 동조 여부 확인*
- **Anchor:** SOXX
- **Key Leaders:** NVDA, TSM, AVGO, MU, AMD, ASML
- *Focus:* 개별 리더의 실적/가이던스 방향성과 SOXX 지수의 괴리율(Divergence) 추적. 

### [Section 3] Risk & Catalyst (리스크 요인)
*사이클을 왜곡하거나 가속할 수 있는 외부 변수*
- 거시 경제: 금리(Rates), 달러(USD)
- 지정학 및 정책: Export Control (수출 통제), 관세 이슈
- 마이크로: 주요 기업 실적 시즌 일정 및 공급망 병목 현황 (CoWoS, HBM 리드타임)

## 4. Design Principles
1. **행동 지향:** 모든 데이터는 최종적으로 "SOXL을 어떻게 할 것인가"에 대한 결론(Hold/Add/Wait/Trim)으로 수렴해야 합니다.
2. **분리 및 명확성:** 지표를 [사실 / 전망 / 내부 신호 / 행동 결론]으로 명확히 분리합니다.
3. **중복 최소화:** 같은 메시지를 차트, 히트맵, 텍스트로 반복하지 않습니다. 과거 이벤트의 과도한 노출과 기술적 분석의 비중을 대폭 축소합니다.
4. **데이터 신뢰도 표시:** 데이터의 업데이트 주기(Monthly, Weekly, Daily)와 신뢰도를 명확히 표기하여 착시를 방지합니다.
