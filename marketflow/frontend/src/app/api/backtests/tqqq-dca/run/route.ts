import { NextRequest, NextResponse } from 'next/server'
import { getTursoClient } from '@/lib/tursoClient'

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcSma(closes: number[], len: number): (number | null)[] {
  const out: (number | null)[] = Array(closes.length).fill(null)
  for (let i = len - 1; i < closes.length; i++) {
    let sum = 0
    for (let j = i - len + 1; j <= i; j++) sum += closes[j]
    out[i] = sum / len
  }
  return out
}

function calcEma(values: (number | null)[], len: number): (number | null)[] {
  const k = 2 / (len + 1)
  const out: (number | null)[] = Array(values.length).fill(null)
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (v === null) continue
    out[i] = out[i - 1] === null ? v : v * k + (out[i - 1] as number) * (1 - k)
  }
  return out
}

function calcRsi(closes: number[], len: number): (number | null)[] {
  const out: (number | null)[] = Array(closes.length).fill(null)
  if (closes.length < len + 1) return out
  let avgGain = 0, avgLoss = 0
  for (let i = 1; i <= len; i++) {
    const d = closes[i] - closes[i - 1]
    if (d > 0) avgGain += d; else avgLoss += -d
  }
  avgGain /= len; avgLoss /= len
  out[len] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  for (let i = len + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    const g = d > 0 ? d : 0, l = d < 0 ? -d : 0
    avgGain = (avgGain * (len - 1) + g) / len
    avgLoss = (avgLoss * (len - 1) + l) / len
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }
  return out
}

function calcMacd(closes: number[], fast: number, slow: number, sig: number) {
  const ef = calcEma(closes as (number | null)[], fast)
  const es = calcEma(closes as (number | null)[], slow)
  const ml = ef.map((f, i) => (f !== null && es[i] !== null ? f - (es[i] as number) : null))
  const nonNull = ml.filter((v): v is number => v !== null)
  const sigEma = calcEma(nonNull as (number | null)[], sig)
  const sl: (number | null)[] = Array(closes.length).fill(null)
  let j = 0
  for (let i = 0; i < ml.length; i++) {
    if (ml[i] !== null) { sl[i] = sigEma[j]; j++ }
  }
  return { ml, sl }
}

function xover(a: number | null, b: number | null, ap: number | null, bp: number | null) {
  return a !== null && b !== null && ap !== null && bp !== null && ap <= bp && a > b
}
function xunder(a: number | null, b: number | null, ap: number | null, bp: number | null) {
  return a !== null && b !== null && ap !== null && bp !== null && ap >= bp && a < b
}

const DAY_MAP: Record<string, number> = {
  Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5,
}

// ── Data loading ──────────────────────────────────────────────────────────────

interface OhlcvRow { date: string; close: number; high: number; low: number }

async function loadPrices(symbol: string): Promise<OhlcvRow[]> {
  const client = getTursoClient()
  if (!client) throw new Error('Turso not configured (TURSO_AUTH_TOKEN missing)')

  const res = await client.execute({
    sql: 'SELECT date, close, high, low FROM ohlcv_daily WHERE symbol=? ORDER BY date',
    args: [symbol.toUpperCase()],
  })

  return res.rows.map(r => ({
    date: String(r[0] ?? r.date),
    close: Number(r[1] ?? r.close),
    high: Number(r[2] ?? r.high ?? r[1] ?? r.close),
    low: Number(r[3] ?? r.low ?? r[1] ?? r.close),
  })).filter(r => r.close > 0)
}

// ── DCA Backtest ──────────────────────────────────────────────────────────────

const DEFAULTS = {
  ticker: 'TQQQ', buy_frequency: 'Weekly', buy_day: 'Wednesday',
  buy_type: 'amount', buy_amount: 100, buy_quantity: 1,
  initial_capital: 10000, start_date: '2023-01-01', end_date: null,
  use_take_profit: true, take_profit_pct: 20,
  use_stop_loss: true, stop_loss_pct: -10,
  use_partial_sell: true, sell_ratio_pct: 10,
  use_rsi_buy: false, rsi_length: 14, rsi_buy_level: 30,
  use_rsi_sell: false, rsi_sell_level: 70,
  use_macd_buy: false, use_macd_sell: false, macd_fast: 12, macd_slow: 26, macd_signal: 9,
  use_ma_buy: false, ma_buy_len: 50, ma_buy_pct: 10,
  use_ma_sell: false, ma_sell_len: 200, ma_sell_pct: 10,
  use_ma_dip_buy: false, ma_dip_steps: [{ len: 50, pct: 10 }, { len: 20, pct: 15 }, { len: 10, pct: 20 }],
  use_v_buy: false, v_buy_ma_len: 10, v_buy_drop_pct: -5, v_buy_pct: 10,
}

async function runBacktest(rawParams: Record<string, unknown>) {
  const p = { ...DEFAULTS, ...rawParams }
  const ticker = String(p.ticker).toUpperCase()
  const startDt = String(p.start_date)
  const endDt = p.end_date ? String(p.end_date) : new Date().toISOString().slice(0, 10)
  const buyDayN = DAY_MAP[String(p.buy_day)] ?? 3
  const initCap = Math.max(Number(p.initial_capital) || 0, 0)

  const rows = await loadPrices(ticker)
  if (!rows.length) return { error: `No price data found for ${ticker}` }

  const closes = rows.map(r => r.close)
  const rsiA = calcRsi(closes, Number(p.rsi_length))
  const { ml, sl } = calcMacd(closes, Number(p.macd_fast), Number(p.macd_slow), Number(p.macd_signal))
  const mab = calcSma(closes, Number(p.ma_buy_len))
  const mas = calcSma(closes, Number(p.ma_sell_len))
  const mav = calcSma(closes, Number(p.v_buy_ma_len))
  const ma50 = calcSma(closes, 50)
  const ma200 = calcSma(closes, 200)
  const dipLens = p.use_ma_dip_buy
    ? [...new Set((p.ma_dip_steps as { len: number; pct: number }[]).map(s => s.len))]
    : []
  const dipSmas: Record<number, (number | null)[]> = {}
  for (const ln of dipLens) dipSmas[ln] = calcSma(closes, ln)

  let totalCost = 0, investedCost = 0, cashRealized = 0, totalShares = 0
  let bhShares = 0, bhCost = 0, realizedPnl = 0
  let poolBalance = initCap, bhPoolBalance = initCap
  let buyCount = 0, sellCount = 0, otb = false
  const equityCurve: object[] = []
  const signals: object[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const d = row.date, c = row.close
    if (d < startDt || d > endDt) continue

    const prevC = i > 0 ? rows[i - 1].close : c
    const dow = new Date(d).getDay()

    const applyBuy = (spendTarget: number, reason: string) => {
      if (spendTarget <= 0 || c <= 0 || poolBalance <= 0) return 0
      const spend = Math.min(spendTarget, poolBalance)
      const sh = spend / c
      totalCost += spend; investedCost += spend; totalShares += sh; poolBalance -= spend; buyCount++
      bhShares += sh; bhCost += spend; bhPoolBalance -= spend
      signals.push({
        d, type: 'buy', price: +c.toFixed(4), shares: +sh.toFixed(4),
        amount: +spend.toFixed(2), current_value: +(totalShares * c).toFixed(2),
        invested_cost: +investedCost.toFixed(2), total_cost: +totalCost.toFixed(2), reason,
      })
      return spend
    }

    const isDaily = p.buy_frequency === 'Daily'
    const isWeekly = p.buy_frequency === 'Weekly' && dow === buyDayN
    const isOnetime = p.buy_frequency === 'One Time' && !otb

    if (isDaily || isWeekly || isOnetime) {
      const rsiOk = !p.use_rsi_buy || (rsiA[i] !== null && (rsiA[i] as number) < Number(p.rsi_buy_level))
      const macdOk = !p.use_macd_buy || (i > 0 && xover(ml[i], sl[i], ml[i - 1], sl[i - 1]))
      const maOk = !p.use_ma_buy || (mab[i] !== null && c > (mab[i] as number))
      if (rsiOk && macdOk && maOk) {
        const spend = p.buy_type === 'quantity' ? Number(p.buy_quantity) * c : Number(p.buy_amount)
        const exec = applyBuy(spend, 'DCA')
        if (p.buy_frequency === 'One Time' && exec > 0) otb = true
      }
    }

    // MA dip buy
    if (p.use_ma_dip_buy && i > 0) {
      const belowMaSell = !p.use_ma_sell || (mas[i] !== null && c < (mas[i] as number))
      if (belowMaSell) {
        for (const step of (p.ma_dip_steps as { len: number; pct: number }[])) {
          const sm = dipSmas[step.len]
          if (!sm || sm[i] === null || sm[i - 1] === null) continue
          if (xunder(c, sm[i], prevC, sm[i - 1])) {
            const sh = totalShares > 0 ? totalShares * step.pct / 100 : Number(p.buy_amount) / c
            applyBuy(sh * c, `DIP${step.len}`)
          }
        }
      }
    }

    // Sell logic
    if (totalShares > 0 && investedCost > 0) {
      const curVal = totalShares * c
      const profitPct = (curVal - investedCost) / investedCost * 100
      const rs = !p.use_rsi_sell || (rsiA[i] !== null && (rsiA[i] as number) > Number(p.rsi_sell_level))
      const ms2 = !p.use_macd_sell || (i > 0 && xunder(ml[i], sl[i], ml[i - 1], sl[i - 1]))
      const anyRsiMacd = p.use_rsi_sell || p.use_macd_sell
      const sig = anyRsiMacd && rs && ms2
      const tp = p.use_take_profit && profitPct >= Number(p.take_profit_pct)
      const sl2 = p.use_stop_loss && profitPct <= Number(p.stop_loss_pct)
      const maCrossDn = p.use_ma_sell && i > 0 && xunder(c, mas[i], prevC, mas[i - 1])

      const reason = tp ? 'TP' : sl2 ? 'SL' : maCrossDn ? 'MA_SELL' : sig ? 'SIGNAL' : null
      if (reason) {
        const ratio = reason === 'MA_SELL'
          ? Number(p.ma_sell_pct) / 100
          : p.use_partial_sell ? Number(p.sell_ratio_pct) / 100 : 1
        const ssCnt = totalShares * ratio
        const avg = investedCost / totalShares
        const rpnl = (c - avg) * ssCnt
        const sellAmt = ssCnt * c
        const preInvestedCost = investedCost
        realizedPnl += rpnl; investedCost -= avg * ssCnt
        totalShares -= ssCnt; poolBalance += sellAmt; cashRealized += sellAmt; sellCount++
        signals.push({
          d, type: 'sell', price: +c.toFixed(4), shares: +ssCnt.toFixed(4),
          amount: +sellAmt.toFixed(2), current_value: +(totalShares * c + ssCnt * c).toFixed(2),
          invested_cost: +preInvestedCost.toFixed(2), remaining_cost: +investedCost.toFixed(2),
          total_cost: +totalCost.toFixed(2), reason, pnl: +rpnl.toFixed(2),
        })
      }
    }

    const curVal = totalShares * c
    const profitPct = investedCost > 0 ? (curVal - investedCost) / investedCost * 100 : 0
    equityCurve.push({
      d, close: +c.toFixed(4),
      current_value: +curVal.toFixed(2),
      pool_balance: +poolBalance.toFixed(2),
      cash_realized: +cashRealized.toFixed(2),
      total_value: +(curVal + poolBalance).toFixed(2),
      invested_cost: +investedCost.toFixed(2),
      total_shares: +totalShares.toFixed(4),
      profit_pct: +profitPct.toFixed(2),
      total_cost: +totalCost.toFixed(2),
      bh_value: +(bhPoolBalance + bhShares * c).toFixed(2),
      ma50: ma50[i] !== null ? +(ma50[i] as number).toFixed(4) : null,
      ma200: ma200[i] !== null ? +(ma200[i] as number).toFixed(4) : null,
    })
  }

  if (!equityCurve.length) return { error: 'No data in range' }

  const curve = equityCurve as { d: string; total_value: number; bh_value: number }[]
  const first = curve[0], last = curve[curve.length - 1]
  const days = (new Date(last.d).getTime() - new Date(first.d).getTime()) / 86400000
  const yrs = days / 365.25
  const final = last.total_value, bhFinal = last.bh_value
  const capBase = initCap > 0 ? initCap : totalCost
  const bhCapBase = initCap > 0 ? initCap : bhCost
  const cagr = yrs > 0 && capBase > 0 ? ((final / capBase) ** (1 / yrs) - 1) * 100 : 0
  const bhCagr = yrs > 0 && bhCapBase > 0 ? ((bhFinal / bhCapBase) ** (1 / yrs) - 1) * 100 : 0

  let peak = 0, bhPeak = 0, mdd = 0, bhMdd = 0
  const ddCurve = curve.map(pt => {
    peak = Math.max(peak, pt.total_value)
    bhPeak = Math.max(bhPeak, pt.bh_value)
    const dd = peak > 0 ? (pt.total_value - peak) / peak * 100 : 0
    const bhDd = bhPeak > 0 ? (pt.bh_value - bhPeak) / bhPeak * 100 : 0
    mdd = Math.min(mdd, dd); bhMdd = Math.min(bhMdd, bhDd)
    return { d: pt.d, dd: +dd.toFixed(2), bh_dd: +bhDd.toFixed(2) }
  })

  const totalReturn = capBase > 0 ? (final / capBase - 1) * 100 : 0
  const bhReturn = bhCapBase > 0 ? (bhFinal / bhCapBase - 1) * 100 : 0

  return {
    summary: {
      ticker,
      period: { start: first.d, end: last.d, days: Math.round(days) },
      final_value: +final.toFixed(2),
      total_return_pct: +totalReturn.toFixed(2),
      cagr_pct: +cagr.toFixed(2),
      mdd_pct: +mdd.toFixed(2),
      buy_count: buyCount, sell_count: sellCount,
      realized_pnl: +realizedPnl.toFixed(2),
      pool_balance: +poolBalance.toFixed(2),
      bh: {
        final_value: +bhFinal.toFixed(2),
        total_return_pct: +bhReturn.toFixed(2),
        cagr_pct: +bhCagr.toFixed(2),
        mdd_pct: +bhMdd.toFixed(2),
        pool_balance: +bhPoolBalance.toFixed(2),
      },
      generated: new Date().toISOString().slice(0, 16).replace('T', ' '),
    },
    equity_curve: equityCurve,
    dd_curve: ddCurve,
    signals,
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const params = await req.json().catch(() => ({}))
    const result = await runBacktest(params)
    if ('error' in result) return NextResponse.json(result, { status: 400 })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
