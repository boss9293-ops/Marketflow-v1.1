# Backtest Cost Probe

## 측정 환경
- 대상 코드: `vr/arena/buildStrategyArena`
- 입력 파일: `marketflow/backend/output/risk_v1_playback.json`, `marketflow/backend/output/vr_survival_playback.json`
- 측정 구조: `1개 종목(TQQQ)`, `7개 역사 이벤트 윈도`, `20회 측정 + 1회 워밍업`
- 측정 방식: `cold`와 `warm`을 각각 별도 실행으로 측정
- 실행 방식: `scripts/backtest_cost_probe.ts`
- Node: `v22.17.1`
- OS: `Windows NT 10.0.19045.0`, `win32`, `x64`
- CPU: `Intel(R) Core(TM) i7-3960X CPU @ 3.30GHz`
- Logical cores: `12`
- Total memory: `31.95 GiB`

## 실행 시간 요약

### Cold / cache OFF
- 입력 로딩 포함: `yes`
- Warmup: `1`
- Measured runs: `20`
- Single run avg time: `0.2231 s`
- p95 time: `0.2708 s`
- Min / max: `0.1843 s / 0.3075 s`
- Load avg: `0.0757 s`
- Build avg: `0.1473 s`
- CPU avg: `0.2469 s`
- CPU / wall ratio: `1.11x`

### Warm / cache ON
- 입력 로딩 포함: `no`
- One-time preload: `0.0998 s`
- Warmup: `1`
- Measured runs: `20`
- Single run avg time: `0.1328 s`
- p95 time: `0.1507 s`
- Min / max: `0.1093 s / 0.1721 s`
- Load avg: `0.0000 s`
- Build avg: `0.1328 s`
- CPU avg: `0.1446 s`
- CPU / wall ratio: `1.09x`

## 메모리 요약
- Cold peak RSS: `165.8 MiB`
- Warm peak RSS: `110.2 MiB`
- Cold peak heap used: `90.8 MiB`
- Warm peak heap used: `46.3 MiB`

## Cloud Run 권장 CPU / Memory
- 권장 CPU: `1 vCPU`
- 권장 Memory: `512 MiB`
- 근거:
  - 현재 구현은 동기식 단일 요청형 계산이다.
  - 피크 메모리는 512 MiB를 충분히 밑돈다.
  - 1 vCPU 이상으로 올려도, 현재 구조에서는 체감 이득이 크지 않다.

## Cloud Run 비용 추정

가격 기준:
- Active CPU: `0.000024 USD / vCPU-second`
- Active Memory: `0.0000025 USD / GiB-second`
- Request fee: `0.40 USD / 1,000,000 requests`
- Free tier: `180,000 vCPU-seconds / 360,000 GiB-seconds / 2,000,000 requests`

### Current code path cost - Cold / cache OFF

| Runs | Avg wall | Gross cost | Net cost after free tier | CPU sec | GiB-sec |
| --- | --- | --- | --- | --- | --- |
| 100 | 0.2231 s | $0.000603 | $0.000000 | 22.3 | 11.2 |
| 1,000 | 0.2231 s | $0.006034 | $0.000000 | 223.1 | 111.6 |
| 10,000 | 0.2231 s | $0.060338 | $0.000000 | 2,231.2 | 1,115.6 |

### Warm cache cost - Warm / cache ON

| Runs | Avg wall | Gross cost | Net cost after free tier | CPU sec | GiB-sec |
| --- | --- | --- | --- | --- | --- |
| 100 | 0.1328 s | $0.000375 | $0.000000 | 13.3 | 6.6 |
| 1,000 | 0.1328 s | $0.003753 | $0.000000 | 132.8 | 66.4 |
| 10,000 | 0.1328 s | $0.037530 | $0.000000 | 1,327.9 | 663.9 |

## 병목 구간
- Cold path에서는 JSON 파일 읽기 + 파싱이 평균 `0.0757 s`로 꽤 큰 고정비다.
- Build 단계는 cold 기준 평균 `0.1473 s`, warm 기준 평균 `0.1328 s`로 전체 시간의 대부분을 차지한다.
- CPU / wall ratio가 `1.1x` 근처라서, 현재는 거의 동기식 CPU 바운드 계산이다.

## 최적화 제안
- 백테스트 아카이브를 요청마다 다시 읽지 말고, 프로세스 시작 시 1회 preload 하자.
- Cloud Run concurrency는 낮게 두는 편이 낫다. 이 엔진은 병렬 I/O형이 아니라 동기 계산형이다.
- 7개 이벤트 윈도는 독립성이 높으므로, 더 빠른 응답이 필요하면 worker thread 또는 병렬 job으로 쪼갤 수 있다.
- 입력이 바뀌지 않는 동안은 arena 결과 자체를 캐시하는 것이 가장 효과적이다.

## 메모
- Cold / cache OFF는 애플리케이션 캐시를 끈 상태를 뜻한다.
- OS page cache는 완전히 제거하지 못한다. 따라서 cold 측정도 실제 디스크 cold-start보다 약간 유리할 수 있다.
- 비용은 Google Cloud Run 공개 가격표의 active billing 기준으로 계산했다.

## Source
- Google Cloud Run pricing: https://cloud.google.com/run/pricing
- Cloud Run memory limits: https://docs.cloud.google.com/run/docs/configuring/services/memory-limits
