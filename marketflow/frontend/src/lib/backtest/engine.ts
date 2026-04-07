import {
  BacktestEngineHooks,
  BacktestResult,
  BacktestRow,
  DailyBar,
  EngineTradeRequest,
  PortfolioState,
  StrategyInputs,
  TradeEvent,
  ValidationIssue,
} from '@/lib/backtest/types'

function roundTo(value: number, digits = 6) {
  return Number(value.toFixed(digits))
}

export function buildValidationIssues(inputs: StrategyInputs): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!inputs.startDate) {
    issues.push({ field: 'startDate', message: 'Start date is required.' })
  }
  if (inputs.initialCapital <= 0) {
    issues.push({ field: 'initialCapital', message: 'Initial capital must be greater than 0.' })
  }
  if (inputs.rebalanceDays < 1) {
    issues.push({ field: 'rebalanceDays', message: 'Rebalance days must be at least 1.' })
  }
  if (inputs.growthRate < 0) {
    issues.push({ field: 'growthRate', message: 'Growth rate cannot be negative.' })
  }
  if (inputs.fixedAdd < 0) {
    issues.push({ field: 'fixedAdd', message: 'Fixed add cannot be negative.' })
  }
  if (inputs.upperMult <= 1) {
    issues.push({ field: 'upperMult', message: 'Upper multiplier must be greater than 1.' })
  }
  if (inputs.lowerMult <= 0 || inputs.lowerMult >= 1) {
    issues.push({ field: 'lowerMult', message: 'Lower multiplier must be between 0 and 1.' })
  }
  if (inputs.periodsPerYear < 1) {
    issues.push({ field: 'periodsPerYear', message: 'Periods per year must be at least 1.' })
  }
  if (inputs.minimumOrderCash < 0) {
    issues.push({ field: 'minimumOrderCash', message: 'Minimum order cash cannot be negative.' })
  }
  if (inputs.initialBuyPercent <= 0 || inputs.initialBuyPercent > 100) {
    issues.push({ field: 'initialBuyPercent', message: 'Initial buy percent must be between 0 and 100.' })
  }
  if (inputs.targetCapMultiple <= 0) {
    issues.push({ field: 'targetCapMultiple', message: 'Target cap multiple must be greater than 0.' })
  }
  if ((inputs.initialInvestAmount ?? 0) > 0 && inputs.initialInvestAmount >= inputs.initialCapital) {
    issues.push({ field: 'initialInvestAmount', message: 'Initial invest must be less than total capital.' })
  }
  if ((inputs.cycleAllocationRate ?? 50) <= 0 || (inputs.cycleAllocationRate ?? 50) > 100) {
    issues.push({ field: 'cycleAllocationRate', message: 'Cycle allocation rate must be between 1 and 100.' })
  }

  return issues
}

export function filterEligibleBars(bars: DailyBar[], startDate: string, endDate?: string) {
  const startTime = new Date(startDate).getTime()
  const endTime = endDate ? new Date(endDate).getTime() : Infinity
  return bars.filter((bar) => {
    const t = new Date(bar.date).getTime()
    return t >= startTime && t <= endTime
  })
}

export function createInitialPortfolioState(bar: DailyBar, inputs: StrategyInputs): PortfolioState {
  const targetValue = inputs.initialCapital
  const upperBand = targetValue * inputs.upperMult
  const lowerBand = targetValue * inputs.lowerMult

  return {
    date: bar.date,
    close: bar.close,
    cash: inputs.initialCapital,
    shares: 0,
    marketValue: 0,
    portfolioValue: inputs.initialCapital,
    avgCost: 0,
    totalDays: 0,
    currentPeriod: 0,
    currentGValue: inputs.initialGValue,
    targetValue,
    upperBand,
    lowerBand,
    pvRatio: targetValue > 0 ? inputs.initialCapital / targetValue : 0,
    realizedPnl: 0,
    unrealizedPnl: 0,
    totalReturnPct: 0,
    buyRequest: 0,
    sellRequest: 0,
    cycleBaseEval: 0,
    poolContrib: 0,
  }
}

export function markPortfolioState(
  state: PortfolioState,
  bar: DailyBar,
  inputs: StrategyInputs,
  totalDays: number,
): PortfolioState {
  const marketValue = state.shares * bar.close
  const portfolioValue = state.cash + marketValue
  const unrealizedPnl = state.shares > 0 ? (bar.close - state.avgCost) * state.shares : 0
  const pvRatio = state.targetValue > 0 ? portfolioValue / state.targetValue : 0

  return {
    ...state,
    date: bar.date,
    close: bar.close,
    marketValue: roundTo(marketValue),
    portfolioValue: roundTo(portfolioValue),
    unrealizedPnl: roundTo(unrealizedPnl),
    pvRatio: roundTo(pvRatio),
    totalDays,
    totalReturnPct:
      inputs.initialCapital > 0
        ? roundTo(((portfolioValue - inputs.initialCapital) / inputs.initialCapital) * 100)
        : 0,
  }
}

function applyStatePatch(
  state: PortfolioState,
  patch: Partial<PortfolioState> | undefined,
  bar: DailyBar,
  inputs: StrategyInputs,
  totalDays: number,
) {
  return markPortfolioState(
    {
      ...state,
      ...patch,
    },
    bar,
    inputs,
    totalDays,
  )
}

export function applyTradeRequest(
  state: PortfolioState,
  bar: DailyBar,
  request: EngineTradeRequest,
  inputs: StrategyInputs,
): { nextState: PortfolioState; trade: TradeEvent | null } {
  const requestedQuantity =
    request.quantity ??
    (request.amount !== undefined
      ? request.amount / bar.close
      : 0)

  const quantity = inputs.allowFractionalShares ? requestedQuantity : Math.floor(requestedQuantity)

  if (quantity <= 0) {
    return { nextState: state, trade: null }
  }

  if (request.action === 'INIT_BUY' || request.action === 'BUY') {
    const requestedAmount = quantity * bar.close
    const actualAmount = Math.min(requestedAmount, state.cash)
    const actualQuantity = inputs.allowFractionalShares
      ? actualAmount / bar.close
      : Math.floor(actualAmount / bar.close)
    const normalizedAmount = actualQuantity * bar.close

    if (normalizedAmount <= 0 || actualQuantity <= 0) {
      return { nextState: state, trade: null }
    }

    const nextShares = state.shares + actualQuantity
    const nextCash = state.cash - normalizedAmount
    const nextAvgCost =
      nextShares > 0
        ? ((state.shares * state.avgCost) + normalizedAmount) / nextShares
        : 0

    const nextState = markPortfolioState(
      {
        ...state,
        cash: roundTo(nextCash),
        shares: roundTo(nextShares),
        avgCost: roundTo(nextAvgCost),
      },
      bar,
      inputs,
      state.totalDays,
    )

    return {
      nextState,
      trade: {
        id: `${request.action}-${bar.date}-${state.totalDays}`,
        date: bar.date,
        action: request.action,
        price: roundTo(bar.close),
        orderAmount: roundTo(normalizedAmount),
        quantity: roundTo(actualQuantity),
        cashAfterTrade: nextState.cash,
        sharesAfterTrade: nextState.shares,
        avgCostAfterTrade: nextState.avgCost,
        portfolioValueAfterTrade: nextState.portfolioValue,
        targetValue: nextState.targetValue,
        upperBand: nextState.upperBand,
        lowerBand: nextState.lowerBand,
        pvRatio: nextState.pvRatio,
        realizedPnl: 0,
        reason: request.reason,
      },
    }
  }

  const maxSellQuantity = Math.min(quantity, state.shares)
  const orderAmount = maxSellQuantity * bar.close
  const realizedPnl = maxSellQuantity * (bar.close - state.avgCost)
  const nextShares = Math.max(state.shares - maxSellQuantity, 0)
  const nextCash = state.cash + orderAmount
  const nextAvgCost = nextShares > 0 ? state.avgCost : 0

  const nextState = markPortfolioState(
    {
      ...state,
      cash: roundTo(nextCash),
      shares: roundTo(nextShares),
      avgCost: roundTo(nextAvgCost),
      realizedPnl: roundTo(state.realizedPnl + realizedPnl),
    },
    bar,
    inputs,
    state.totalDays,
  )

  return {
    nextState,
    trade: {
      id: `SELL-${bar.date}-${state.totalDays}`,
      date: bar.date,
      action: 'SELL',
      price: roundTo(bar.close),
      orderAmount: roundTo(orderAmount),
      quantity: roundTo(maxSellQuantity),
      cashAfterTrade: nextState.cash,
      sharesAfterTrade: nextState.shares,
      avgCostAfterTrade: nextState.avgCost,
      portfolioValueAfterTrade: nextState.portfolioValue,
      targetValue: nextState.targetValue,
      upperBand: nextState.upperBand,
      lowerBand: nextState.lowerBand,
      pvRatio: nextState.pvRatio,
      realizedPnl: roundTo(realizedPnl),
      reason: request.reason,
    },
  }
}

// ── MA200 pre-computation from full bars dataset ─────────────────────────────
function buildMa200Map(bars: DailyBar[], period = 200): Map<string, number | null> {
  const map = new Map<string, number | null>()
  for (let i = 0; i < bars.length; i++) {
    if (i < period - 1) {
      map.set(bars[i].date, null)
    } else {
      let sum = 0
      for (let j = i - period + 1; j <= i; j++) sum += bars[j].close
      map.set(bars[i].date, sum / period)
    }
  }
  return map
}

function toBacktestRow(state: PortfolioState, trade: TradeEvent | null, ma200: number | null): BacktestRow {
  const isBuy = trade?.action === 'INIT_BUY' || trade?.action === 'BUY'
  const isSell = trade?.action === 'SELL'

  return {
    ...state,
    action: trade?.action ?? null,
    reason: trade?.reason ?? null,
    orderAmount: trade?.orderAmount ?? 0,
    buyAmount: isBuy ? trade?.orderAmount ?? 0 : 0,
    sellAmount: isSell ? trade?.orderAmount ?? 0 : 0,
    tradeQty: trade?.quantity ?? 0,
    buySignal: isBuy,
    sellSignal: isSell,
    ma200,
  }
}

export function runBacktest(
  bars: DailyBar[],
  inputs: StrategyInputs,
  hooks: BacktestEngineHooks = {},
): BacktestResult {
  const validationIssues = buildValidationIssues(inputs)
  const eligibleBars = filterEligibleBars(bars, inputs.startDate, inputs.endDate || undefined)

  if (eligibleBars.length === 0) {
    return {
      symbol: inputs.symbol,
      inputs,
      rows: [],
      trades: [],
      summary: {
        symbol: inputs.symbol,
        startDate: null,
        endDate: null,
        totalBars: bars.length,
        eligibleBars: 0,
        tradeCount: 0,
        initialized: false,
      },
      validationIssues: [
        ...validationIssues,
        { field: 'bars', message: 'No bars available on or after the selected start date.' },
      ],
    }
  }

  if (validationIssues.length > 0) {
    return {
      symbol: inputs.symbol,
      inputs,
      rows: [],
      trades: [],
      summary: {
        symbol: inputs.symbol,
        startDate: eligibleBars[0].date,
        endDate: eligibleBars[eligibleBars.length - 1].date,
        totalBars: bars.length,
        eligibleBars: eligibleBars.length,
        tradeCount: 0,
        initialized: false,
      },
      validationIssues,
    }
  }

  const rows: BacktestRow[] = []
  const trades: TradeEvent[] = []
  let state = createInitialPortfolioState(eligibleBars[0], inputs)

  // MA200: build from full bars (includes history before startDate)
  const ma200Map = buildMa200Map(bars)

  eligibleBars.forEach((bar, index) => {
    state = markPortfolioState(state, bar, inputs, index)

    if (index === 0) {
      // Day 0: onStart — single call, no repeat
      const step = hooks.onStart?.({ bar, index, inputs, state, previousRow: null })
      state = applyStatePatch(state, step?.statePatch, bar, inputs, index)
      let trade: TradeEvent | null = null
      if (step?.trade) {
        const execution = applyTradeRequest(state, bar, step.trade, inputs)
        state = execution.nextState
        trade = execution.trade
        if (trade) trades.push(trade)
      }
      rows.push(toBacktestRow(state, trade, ma200Map.get(bar.date) ?? null))
      return
    }

    // Day 1+: onBar — repeat on same bar while strategy fires trades
    // Allows multiple buys/sells on the same day (e.g. price drops through
    // multiple ladder levels within one session close).
    const MAX_TRADES_PER_BAR = 20   // safety cap against infinite loops
    let barTrades: TradeEvent[] = []
    let lastTrade: TradeEvent | null = null

    for (let t = 0; t < MAX_TRADES_PER_BAR; t++) {
      const step = hooks.onBar?.({
        bar,
        index,
        inputs,
        state,
        previousRow: rows[rows.length - 1] ?? null,
      })

      if (!step) break
      state = applyStatePatch(state, step.statePatch, bar, inputs, index)

      if (!step.trade) break   // no trade this iteration → ladder exhausted

      const execution = applyTradeRequest(state, bar, step.trade, inputs)
      state = execution.nextState
      if (!execution.trade) break
      trades.push(execution.trade)
      barTrades.push(execution.trade)
      lastTrade = execution.trade
    }

    // For row: accumulate all buys/sells into a single summary row
    if (barTrades.length > 1) {
      const totalBuy  = barTrades.filter(t => t.action === 'BUY' || t.action === 'INIT_BUY').reduce((s, t) => s + t.orderAmount, 0)
      const totalSell = barTrades.filter(t => t.action === 'SELL').reduce((s, t) => s + t.orderAmount, 0)
      const buyQty    = barTrades.filter(t => t.action === 'BUY' || t.action === 'INIT_BUY').reduce((s, t) => s + t.quantity, 0)
      const sellQty   = barTrades.filter(t => t.action === 'SELL').reduce((s, t) => s + t.quantity, 0)
      const isBuy     = totalBuy > 0
      const isSell    = totalSell > 0
      const row: BacktestRow = {
        ...state,
        action:     lastTrade?.action ?? null,
        reason:     `×${barTrades.length} trades: ` + (lastTrade?.reason ?? ''),
        orderAmount: totalBuy + totalSell,
        buyAmount:  totalBuy,
        sellAmount: totalSell,
        tradeQty:   buyQty + sellQty,
        buySignal:  isBuy,
        sellSignal: isSell,
        ma200: ma200Map.get(bar.date) ?? null,
      }
      rows.push(row)
    } else {
      rows.push(toBacktestRow(state, lastTrade, ma200Map.get(bar.date) ?? null))
    }
  })

  return {
    symbol: inputs.symbol,
    inputs,
    rows,
    trades,
    summary: {
      symbol: inputs.symbol,
      startDate: rows[0]?.date ?? null,
      endDate: rows[rows.length - 1]?.date ?? null,
      totalBars: bars.length,
      eligibleBars: eligibleBars.length,
      tradeCount: trades.length,
      initialized: true,
    },
    validationIssues: [],
  }
}
