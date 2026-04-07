# Language Split Architecture (UI vs Engine vs AI)

## Goal
- UI 언어(`ui_lang`)와 콘텐츠 언어(`content_lang`)를 분리한다.
- 엔진 기반 문구와 AI 내러티브를 서로 다른 생성/검증 경로로 운영한다.
- 한글 품질 저하(직번역, 나열형 문장)를 구조적으로 줄인다.

## Layer Policy
1. `ui`
- 메뉴/버튼/라벨/고정 안내문.
- 번역 리소스 키 기반만 허용. 하드코딩 금지.

2. `engine`
- 수치/상태/룰에서 렌더되는 문장.
- 템플릿(`{{value}}`) + 변수 주입 방식.
- 숫자 포맷/단위/라벨 규칙은 엔진 공통 함수에서 처리.

3. `ai`
- 내러티브/요약/맥락 해석.
- 언어별 직접 생성 원칙(ko/en 분리).
- 품질 게이트(필수 이슈 포함 여부, 금지 패턴) 적용.

4. `source`
- 원문 기사/원문 인용.
- 원문은 보존하고, 요약/해석은 별도 필드로 분리.

## Data Contract
- 공통 블록 포맷:
  - `layer: 'ui' | 'engine' | 'ai' | 'source'`
  - `kind: string`
  - `text: { ko?: string, en?: string }`
  - `meta?: Record<string, unknown>`

- AI API는 `?lang=ko|en`을 받아 언어별 projection 응답을 반환한다.

## Runtime State
- `ui_lang`
  - UI 렌더용 언어.
- `content_lang`
  - 브리핑/AI 본문/엔진 설명 렌더용 언어.

초기 정책:
- 기본은 `content_lang = ui_lang`.
- 필요 시 이후 별도 토글 추가.

## Caching Strategy
- 캐시 키에 언어 포함:
  - `date + layer + content_lang + prompt_version + facts_hash`
- 언어가 다르면 캐시 분리.

## Quality Gate (AI)
- 필수 포함 체크:
  - 당일 핵심 뉴스/핵심 종목/지정학 이벤트.
- 금지 패턴 체크:
  - 단순 지수 나열/원인 없는 수치 열거/기계 번역투.
- 실패 시 재생성 또는 fallback 템플릿.

## Migration Plan
1. Phase 1 (Done in this patch)
- `ui_lang` / `content_lang` 상태 분리.
- 문서 attribute 분리: `data-lang-mode`, `data-content-lang`.
- AI 라우트 `?lang=` projection 지원.

2. Phase 2
- 대시보드/브리핑/차트 페이지에서 엔진 문구를 템플릿화.
- 하드코딩 문자열을 `UI_TEXT` 또는 engine template로 이동.

3. Phase 3
- 백엔드 AI 생성을 언어별 파이프라인으로 분리.
- 품질 게이트 결과를 저장하고 재시도 정책 도입.

