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

// ?? P/V ???곸듅瑜??뚯씠釉??????????????????????????????????????????????????????
// 異쒖쿂: VR V4 ?먰삎 ?뚯씠釉?
// [P/V, ?됯?湲?V ?곸듅瑜? ?됯?湲?V ?곸듅瑜?
// 蹂닿컙 ?놁쓬 ??P/V媛 ?뚯씠釉붿뿉 ?놁쑝硫?蹂댁닔?곸쑝濡???? 履?floor) ?ъ슜
// ?? P/V=0.04 ??0.01 ???ъ슜 (0.05 誘몃쭔?대?濡?
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
 * P/V ?뚯씠釉?議고쉶
 *   pv          = pool / (G 횞 currentVref)
 *   evalBelowV  = eval < currentVref  ???쇱そ ??蹂댁닔??, ?꾨땲硫??ㅻⅨ履???
 *
 *   蹂닿컙 ?놁쓬: pv媛 ?뚯씠釉????ъ씠???덉쑝硫?floor (????? ?? ?ъ슜
 *   ?? pv=0.04 ??0.01 ?? pv=0.07 ??0.05 ??
 *
 * @returns ?곸듅瑜?(?? 1.025)
 */
export function lookupPvRate(pv: number, evalBelowV: boolean): number {
  // 1.10??理쒕?媛???洹??댁긽? 紐⑤몢 1.10 ?됱쑝濡?怨좎젙
  const clampedPv = Math.min(pv, 1.10)
  // ?대┝(floor): clampedPv ???뚯씠釉??ㅼ씤 ??以?媛????寃?
  let row = PV_RATE_TABLE[0]
  for (const r of PV_RATE_TABLE) {
    if (r[0] <= clampedPv) row = r
    else break
  }
  return evalBelowV ? row[1] : row[2]
}

const VREF_EXTRA_RISE = 0.005

function computeNextVref(
  currentVref: number,
  poolCash: number,
  evalAtReset: number,
  gValue: number,
  depositCash = 0,
) {
  if (currentVref <= 0) {
    return {
      nextVref: evalAtReset,
      poolRatio: 0,
      baseRise: 0,
      extraRise: 0,
      poolContribution: 0,
    }
  }

  const poolRatio = poolCash > 0 ? poolCash / currentVref : 0
  const baseRise = poolRatio / gValue
  const extraRise = evalAtReset >= currentVref ? VREF_EXTRA_RISE : 0
  const poolContribution = currentVref * baseRise
  const extraContribution = currentVref * extraRise

  return {
    nextVref: currentVref + poolContribution + extraContribution + depositCash,
    poolRatio,
    baseRise,
    extraRise,
    poolContribution,
  }
}

/**
 * VR Engine V4 ??P/V ?뚯씠釉?湲곕컲 Vref ?곸듅
 *
 * ??? ?듭떖 媛쒕뀗 ???????????????????????????????????????????????????????????
 *   V (Vref)    = 湲곗? ?됯?湲???cycle留덈떎 媛깆떊
 *   eval        = currentShares 횞 currentPrice  ??V? 蹂꾧컻
 *   Vmin        = Vref 횞 lowerMult
 *   Vmax        = Vref 횞 upperMult
 *
 * ??? Vref 媛깆떊 (cycle reset) ?????????????????????????????????????????????
 *   P/V ratio   = pool / (G 횞 prevVref)    ??G ????P/V ????蹂댁닔??
 *   ?곸듅瑜?     = PV_RATE_TABLE.lookup(P/V, eval < prevVref)  [蹂닿컙 ?놁쓬]
 *   newVref     = prevVref 횞 ?곸듅瑜?
 *
 *   G ?섎?:
 *     G=1  ??P/V = pool/Vref  (理쒓났寃⑹쟻, pool ?꾩껜媛 P/V 湲곗뿬)
 *     G=10 ??P/V = pool/(10횞Vref)  (湲곕낯媛? pool 湲곗뿬 1/10)
 *
 * ??? 留ㅼ닔 (eval < Vmin) ???????????????????????????????????????????????????
 *   BuyRequest  = Vmin - eval
 *   ActualBuy   = min(BuyRequest, pool, cycleCap)
 *   Pool        -= ActualBuy
 *
 * ??? 留ㅻ룄 (eval > Vmax) ???????????????????????????????????????????????????
 *   SellRequest = eval - Vmax
 *   ActualSell  = min(SellRequest, shares횞close)
 *   Pool        += ActualSell
 */

interface VrCycleState {
  currentCycleNo: number
  cycleVref: number              // ?꾩옱 cycle Vref (留ㅼ닔/留ㅻ룄 湲곗?)
  cycleEvalBase: number          // cycle ?쒖옉 eval (display??
  cyclePvRatio: number           // pool/(G횞Vref) at reset (display??
  cycleRate: number              // ?곸슜???곸듅瑜?(display??
  cyclePoolUsed: number          // ?대쾲 cycle ?꾩쟻 留ㅼ닔湲?
  cycleStartPoolCash: number     // cycle ?쒖옉 pool (cap 怨꾩궛 湲곗?)
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

  // ?? onStart (index = 0, Day 0) ????????????????????????????????????????????
  function onStart(ctx: EngineStepContext): EngineStepResult {
    const investedCash = inputs.initialInvestAmount > 0
      ? inputs.initialInvestAmount
      : inputs.initialCapital * (inputs.initialBuyPercent / 100)

    const poolCash   = inputs.initialCapital - investedCash
    const price0     = ctx.bar.close
    const initShares = inputs.allowFractionalShares
      ? investedCash / price0
      : Math.floor(investedCash / price0)

    // C0 Vref: eval 洹몃?濡?(cycle 0? ?댁쟾 Vref ?놁쑝誘濡??곸듅瑜?誘몄쟻??
    const evalBase0 = initShares * price0   // = investedCash
    const G         = Math.max(1, inputs.initialGValue)

    // C0?먯꽌??P/V 議고쉶 ??eval = Vref?대?濡?"eval < V = false" ???ㅻⅨ履???
    const pv0 = poolCash > 0 && evalBase0 > 0 ? poolCash / evalBase0 : 0
    const rate0 = 1    // C0??eval=Vref ??above ??
    const vref0 = evalBase0           // 理쒖큹 Vref???뚰룺 ?곸듅瑜?諛섏쁺

    const vmin0 = vref0 * inputs.lowerMult
    const vmax0 = vref0 * inputs.upperMult

    // Seed cycle 0
    vr.currentCycleNo    = 0
    vr.cycleVref         = vref0
    vr.cycleEvalBase     = evalBase0
    vr.cyclePvRatio      = vref0 > 0 ? poolCash / vref0 : 0
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
        poolContrib:   0,   // P/V ratio (display??
      },
      trade: {
        action: 'INIT_BUY',
        amount: investedCash,
        reason: `Init: invest=${investedCash.toFixed(0)} pool=${poolCash.toFixed(0)} G=${G} ` +
                `Vref=${vref0.toFixed(0)} Vmin=${vmin0.toFixed(0)} Vmax=${vmax0.toFixed(0)}`,
      },
    }
  }

  // ?? onBar (index ??1) ?????????????????????????????????????????????????????
  function onBar(ctx: EngineStepContext): EngineStepResult {
    const { bar, state: portfolio } = ctx
    const cycleNo = Math.floor(portfolio.totalDays / inputs.rebalanceDays)

    let pendingCashAdd = 0

    // ?? Cycle reset ??????????????????????????????????????????????????????????
    if (cycleNo !== vr.currentCycleNo) {
      pendingCashAdd = inputs.fixedAdd ?? 0
      const cyclePoolCash = portfolio.cash
      const effectivePool = cyclePoolCash + pendingCashAdd

      const G           = Math.max(1, inputs.initialGValue)
      const evalAtReset = portfolio.shares * bar.close   // shares x price at cycle start
      const prevVref    = vr.cycleVref
      const next        = computeNextVref(prevVref, cyclePoolCash, evalAtReset, G, pendingCashAdd)

      vr.currentCycleNo     = cycleNo
      vr.cycleVref          = next.nextVref
      vr.cycleEvalBase      = evalAtReset
      vr.cyclePvRatio       = next.poolRatio
      vr.cycleRate          = prevVref > 0 ? next.nextVref / prevVref : 1
      vr.cyclePoolUsed      = 0
      vr.cycleStartPoolCash = effectivePool
    }

    const effectiveCash = portfolio.cash + pendingCashAdd
    const G             = Math.max(1, inputs.initialGValue)

    // ?? Vref / Vmin / Vmax (cycle ??怨좎젙) ?????????????????????????????????
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
      poolContrib:    0,  // cycle 0 seed has no pool contribution yet
      ...(pendingCashAdd > 0 ? { cash: effectiveCash } : {}),
    }

    const evalVal = portfolio.shares * bar.close  // Evaluation = shares 횞 price

    // ?? Buy: eval < Vmin ?????????????????????????????????????????????????????
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

    // ?? Sell: eval > Vmax ????????????????????????????????????????????????????
    if (evalVal > vmax && !inputs.disableSell) {
      const sellRequest  = evalVal - vmax
      const actualSell   = Math.min(sellRequest, portfolio.shares * bar.close)
      // minimumOrderCash 泥댄겕: 遺?숈냼?섏젏 ?붿감($0.00 濡쒓렇) 諛⑹?
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

    // Gap ?쒖떆?? disableBuy/disableSell?댁뼱??request 媛믪? 怨꾩궛?댁꽌 ?쒖떆
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

