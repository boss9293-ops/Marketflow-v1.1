import { runBacktest } from '@/lib/backtest/engine'
import {
  BacktestEngineHooks,
  BacktestResult,
  DailyBar,
  EngineStepContext,
  EngineStepResult,
  PortfolioState,
  StrategyInputs,
} from '@/lib/backtest/types'

export const VR_G_VALUE_DEFAULTS: StrategyInputs = {
  symbol: 'TQQQ',
  startDate: '2022-12-31',
  endDate: '',
  initialCapital: 10000,
  rebalanceDays: 14,
  growthRate: 0,
  fixedAdd: 0,
  upperMult: 1.15,
  lowerMult: 0.85,
  initialGValue: 10,
  gAnnualIncrement: 0,
  periodsPerYear: 26,
  minimumOrderCash: 1,
  initialBuyPercent: 80,
  targetCapMultiple: 5,
  allowFractionalShares: true,
  initialInvestAmount: 8000,
  cycleAllocationRate: 50,
  guardMode: 'off',
  enableDdSpeedFilter: false,
  enableMaFilter: false,
  disableBuy: false,
  disableSell: false,
}

// ── P/V → 상승률 테이블 ─────────────────────────────────────────────────────
// 출처: VR V4 원형 테이블
// [P/V, 평가금<V 상승률, 평가금>V 상승률]
// 보간 없음 — P/V가 테이블에 없으면 보수적으로 낮은 쪽(floor) 사용
// 예: P/V=0.04 → 0.01 행 사용 (0.05 미만이므로)
const PV_RATE_TABLE: ReadonlyArray<readonly [number, number, number]> = [
  [0.00, 1.000, 1.001],
  [0.01, 1.001, 1.005],
  [0.05, 1.005, 1.010],
  [0.10, 1.010, 1.015],
  [0.15, 1.015, 1.020],
  [0.20, 1.020, 1.025],
  [0.25, 1.025, 1.030],
  [0.30, 1.030, 1.035],
  [0.35, 1.035, 1.040],
  [0.40, 1.040, 1.045],
  [0.45, 1.045, 1.050],
  [0.50, 1.050, 1.055],
  [0.55, 1.055, 1.060],
  [0.60, 1.060, 1.065],
  [0.65, 1.065, 1.070],
  [0.70, 1.070, 1.075],
  [0.75, 1.075, 1.080],
  [0.80, 1.080, 1.085],
  [0.85, 1.085, 1.090],
  [0.90, 1.090, 1.095],
  [0.95, 1.095, 1.100],
  [1.00, 1.100, 1.105],
  [1.05, 1.105, 1.110],
  [1.10, 1.110, 1.115],
] as const

/**
 * P/V 테이블 조회
 *   pv          = pool / (G × currentVref)
 *   evalBelowV  = eval < currentVref  → 왼쪽 열(보수적), 아니면 오른쪽 열
 *
 *   보간 없음: pv가 테이블 키 사이에 있으면 floor (더 낮은 행) 사용
 *   예) pv=0.04 → 0.01 행, pv=0.07 → 0.05 행
 *
 * @returns 상승률 (예: 1.025)
 */
export function lookupPvRate(pv: number, evalBelowV: boolean): number {
  // 1.10이 최대값 — 그 이상은 모두 1.10 행으로 고정
  const clampedPv = Math.min(pv, 1.10)
  // 내림(floor): clampedPv ≤ 테이블 키인 행 중 가장 큰 것
  let row = PV_RATE_TABLE[0]
  for (const r of PV_RATE_TABLE) {
    if (r[0] <= clampedPv) row = r
    else break
  }
  return evalBelowV ? row[1] : row[2]
}

/**
 * VR Engine V4 — P/V 테이블 기반 Vref 상승
 *
 * ─── 핵심 개념 ───────────────────────────────────────────────────────────
 *   V (Vref)    = 기준 평가금 — cycle마다 갱신
 *   eval        = currentShares × currentPrice  ← V와 별개
 *   Vmin        = Vref × lowerMult
 *   Vmax        = Vref × upperMult
 *
 * ─── Vref 갱신 (cycle reset) ─────────────────────────────────────────────
 *   P/V ratio   = pool / (G × prevVref)    ← G ↑ → P/V ↓ → 보수적
 *   상승률      = PV_RATE_TABLE.lookup(P/V, eval < prevVref)  [보간 없음]
 *   newVref     = prevVref × 상승률
 *
 *   G 의미:
 *     G=1  → P/V = pool/Vref  (최공격적, pool 전체가 P/V 기여)
 *     G=10 → P/V = pool/(10×Vref)  (기본값, pool 기여 1/10)
 *
 * ─── 매수 (eval < Vmin) ───────────────────────────────────────────────────
 *   BuyRequest  = Vmin - eval
 *   ActualBuy   = min(BuyRequest, pool, cycleCap)
 *   Pool        -= ActualBuy
 *
 * ─── 매도 (eval > Vmax) ───────────────────────────────────────────────────
 *   SellRequest = eval - Vmax
 *   ActualSell  = min(SellRequest, shares×close)
 *   Pool        += ActualSell
 */

interface VrCycleState {
  currentCycleNo: number
  cycleVref: number              // 현재 cycle Vref (매수/매도 기준)
  cycleEvalBase: number          // cycle 시작 eval (display용)
  cyclePvRatio: number           // pool/(G×Vref) at reset (display용)
  cycleRate: number              // 적용된 상승률 (display용)
  cyclePoolUsed: number          // 이번 cycle 누적 매수금
  cycleStartPoolCash: number     // cycle 시작 pool (cap 계산 기준)
}

export function createVrGValueHooks(inputs: StrategyInputs): BacktestEngineHooks {
  const vr: VrCycleState = {
    currentCycleNo:    -1,
    cycleVref:          0,
    cycleEvalBase:      0,
    cyclePvRatio:       0,
    cycleRate:          1,
    cyclePoolUsed:      0,
    cycleStartPoolCash: 0,
  }

  // ── onStart (index = 0, Day 0) ────────────────────────────────────────────
  function onStart(ctx: EngineStepContext): EngineStepResult {
    const investedCash = inputs.initialInvestAmount > 0
      ? inputs.initialInvestAmount
      : inputs.initialCapital * (inputs.initialBuyPercent / 100)

    const poolCash   = inputs.initialCapital - investedCash
    const price0     = ctx.bar.close
    const initShares = inputs.allowFractionalShares
      ? investedCash / price0
      : Math.floor(investedCash / price0)

    // C0 Vref: eval 그대로 (cycle 0은 이전 Vref 없으므로 상승률 미적용)
    const evalBase0 = initShares * price0   // = investedCash
    const G         = Math.max(1, inputs.initialGValue)

    // C0에서도 P/V 조회 — eval = Vref이므로 "eval < V = false" → 오른쪽 열
    const pv0   = poolCash / (G * evalBase0)
    const rate0 = lookupPvRate(pv0, false)    // C0는 eval=Vref → above 열
    const vref0 = evalBase0 * rate0           // 최초 Vref에 소폭 상승률 반영

    const vmin0 = vref0 * inputs.lowerMult
    const vmax0 = vref0 * inputs.upperMult

    // Seed cycle 0
    vr.currentCycleNo    = 0
    vr.cycleVref         = vref0
    vr.cycleEvalBase     = evalBase0
    vr.cyclePvRatio      = pv0
    vr.cycleRate         = rate0
    vr.cyclePoolUsed     = 0
    vr.cycleStartPoolCash = poolCash

    return {
      statePatch: {
        totalDays:     0,
        currentPeriod: 0,
        currentGValue: G,
        targetValue:   vref0,
        upperBand:     vmax0,
        lowerBand:     vmin0,
        buyRequest:    0,
        sellRequest:   0,
        cycleBaseEval: evalBase0,
        poolContrib:   pv0,   // P/V ratio (display용)
      },
      trade: {
        action: 'INIT_BUY',
        amount: investedCash,
        reason: `Init: invest=${investedCash.toFixed(0)} pool=${poolCash.toFixed(0)} G=${G} ` +
                `P/V=${pv0.toFixed(4)} rate=${rate0.toFixed(4)} ` +
                `Vref=${vref0.toFixed(0)} Vmin=${vmin0.toFixed(0)} Vmax=${vmax0.toFixed(0)}`,
      },
    }
  }

  // ── onBar (index ≥ 1) ─────────────────────────────────────────────────────
  function onBar(ctx: EngineStepContext): EngineStepResult {
    const { bar, state: portfolio } = ctx
    const cycleNo = Math.floor(portfolio.totalDays / inputs.rebalanceDays)

    let pendingCashAdd = 0

    // ── Cycle reset ──────────────────────────────────────────────────────────
    if (cycleNo !== vr.currentCycleNo) {
      pendingCashAdd = inputs.fixedAdd ?? 0
      const effectivePool = portfolio.cash + pendingCashAdd

      const G            = Math.max(1, inputs.initialGValue)
      const evalAtReset  = portfolio.shares * bar.close   // shares × 종가 (사이클 시작)

      // ── VR V4 공식 (vr-survival build_execution_playback.ts와 동일) ─────────
      // P/V = pool / (G × prevVref) — pool이 클수록 Vref 더 빨리 상승
      const prevVref     = vr.cycleVref
      const pvRatio      = prevVref > 0 ? effectivePool / (G * prevVref) : 0
      const evalBelowV   = evalAtReset < prevVref   // 하락장 → 보수적 열
      const rate         = lookupPvRate(pvRatio, evalBelowV)

      // newVref = max(prevVref × rate, evalAtReset)
      //   → 시장이 상승해 평가금이 Vref를 초과하면 밴드도 따라 올라감 (ratchet)
      //   → 하락장에서는 P/V 상승률만 적용 (원본 공식 유지)
      // 최초 cycleVref == 0 이면 evalAtReset으로 시드
      const newVref = prevVref > 0
        ? Math.max(prevVref * rate, evalAtReset)
        : evalAtReset

      vr.currentCycleNo    = cycleNo
      vr.cycleVref         = newVref
      vr.cycleEvalBase     = evalAtReset
      vr.cyclePvRatio      = pvRatio
      vr.cycleRate         = prevVref > 0 ? newVref / prevVref : 1
      vr.cyclePoolUsed     = 0
      vr.cycleStartPoolCash = effectivePool
    }

    const effectiveCash = portfolio.cash + pendingCashAdd
    const G             = Math.max(1, inputs.initialGValue)

    // ── Vref / Vmin / Vmax (cycle 내 고정) ─────────────────────────────────
    const vref = vr.cycleVref
    const vmin = vref * inputs.lowerMult
    const vmax = vref * inputs.upperMult

    const statePatchBase: Partial<PortfolioState> = {
      currentPeriod:  cycleNo,
      currentGValue:  G,
      targetValue:    vref,
      upperBand:      vmax,
      lowerBand:      vmin,
      cycleBaseEval:  vr.cycleEvalBase,
      poolContrib:    vr.cyclePvRatio,  // P/V ratio (display용)
      ...(pendingCashAdd > 0 ? { cash: effectiveCash } : {}),
    }

    const evalVal = portfolio.shares * bar.close  // Evaluation = shares × price

    // ── Buy: eval < Vmin ─────────────────────────────────────────────────────
    if (evalVal < vmin && !inputs.disableBuy) {
      const buyRequest   = vmin - evalVal
      const cycleCap     = vr.cycleStartPoolCash * (inputs.cycleAllocationRate / 100)
      const remainingCap = Math.max(0, cycleCap - vr.cyclePoolUsed)
      const actualBuy    = Math.min(buyRequest, effectiveCash, remainingCap)

      if (actualBuy >= (inputs.minimumOrderCash ?? 1)) {
        vr.cyclePoolUsed += actualBuy
        return {
          statePatch: { ...statePatchBase, buyRequest, sellRequest: 0 },
          trade: {
            action: 'BUY',
            amount: actualBuy,
            reason: `BuyReq=${buyRequest.toFixed(0)} (Vmin${vmin.toFixed(0)}-eval${evalVal.toFixed(0)}) ` +
                    `actual=${actualBuy.toFixed(0)} [pool=${effectiveCash.toFixed(0)} cycleRem=${remainingCap.toFixed(0)}]`,
          },
        }
      }
    }

    // ── Sell: eval > Vmax ────────────────────────────────────────────────────
    if (evalVal > vmax && !inputs.disableSell) {
      const sellRequest  = evalVal - vmax
      const actualSell   = Math.min(sellRequest, portfolio.shares * bar.close)
      // minimumOrderCash 체크: 부동소수점 잔차($0.00 로그) 방지
      if (actualSell >= (inputs.minimumOrderCash ?? 1)) {
        return {
          statePatch: { ...statePatchBase, buyRequest: 0, sellRequest },
          trade: {
            action: 'SELL',
            amount: actualSell,
            reason: `SellReq=${sellRequest.toFixed(0)} (eval${evalVal.toFixed(0)}-Vmax${vmax.toFixed(0)}) ` +
                    `actual=${actualSell.toFixed(0)}`,
          },
        }
      }
    }

    // Gap 표시용: disableBuy/disableSell이어도 request 값은 계산해서 표시
    const buyReqDisplay  = evalVal < vmin ? vmin - evalVal : 0
    const sellReqDisplay = evalVal > vmax ? evalVal - vmax : 0
    return { statePatch: { ...statePatchBase, buyRequest: buyReqDisplay, sellRequest: sellReqDisplay } }
  }

  return { onStart, onBar }
}

export function runVrGValueBacktest(
  bars: DailyBar[],
  inputs: StrategyInputs = VR_G_VALUE_DEFAULTS,
): BacktestResult {
  return runBacktest(bars, inputs, createVrGValueHooks(inputs))
}
