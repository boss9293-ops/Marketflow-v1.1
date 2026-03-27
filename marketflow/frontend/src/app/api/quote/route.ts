import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbolsRaw = searchParams.get('symbols')

  if (!symbolsRaw) {
    return NextResponse.json({ error: 'Missing symbols parameter' }, { status: 400 })
  }

  const symbolArray = symbolsRaw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
  const symbols = symbolArray.join(',')

  // 1. Try FINNHUB for FREE REAL-TIME (0 delay, 60 req/min free tier)
  const finnhubKey = process.env.FINNHUB_API_KEY || process.env.NEXT_PUBLIC_FINNHUB_API_KEY || ''
  if (finnhubKey) {
    try {
      const fetchQuotes = symbolArray.map(async (sym) => {
        const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${finnhubKey}`, { cache: 'no-store' })
        if (!res.ok) throw new Error('Finnhub fetch failed for ' + sym)
        const data = await res.json()
        return {
          symbol: sym,
          price: data.c,
          changePercent: data.dp,
          dayLow: data.l,
          dayHigh: data.h,
          name: sym,
          source: 'finnhub_realtime'
        }
      })
      const results = await Promise.allSettled(fetchQuotes)
      const valid = results
         .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
         .map(r => r.value)
         .filter(v => v.price > 0 || v.price != null)
         
      if (valid.length > 0) return NextResponse.json({ quotes: valid })
    } catch (err: any) {
      console.warn('[quote API - Finnhub] Failed to fetch live quotes via Finnhub...', err.message)
    }
  }

  // 2. Try FMP (If user upgrades to an active real-time subscription)
  const fmpKey = process.env.FMP_API_KEY || process.env.NEXT_PUBLIC_FMP_API_KEY || ''
  if (fmpKey) {
    try {
      const fmpUrl = `https://financialmodelingprep.com/api/v3/quote/${symbols}?apikey=${fmpKey}`
      const fmpRes = await fetch(fmpUrl, { cache: 'no-store' })
      if (fmpRes.ok) {
        const fmpData = await fmpRes.json()
        if (Array.isArray(fmpData) && fmpData.length > 0) {
          const normalized = fmpData.map((q: any) => ({
            symbol: q.symbol,
            price: q.price,
            changePercent: q.changesPercentage,
            dayLow: q.dayLow,
            dayHigh: q.dayHigh,
            name: q.name,
            source: 'fmp_realtime'
          }))
          return NextResponse.json({ quotes: normalized })
        }
      }
    } catch (err: any) {
      console.warn('[quote API - FMP] Failed to fetch live quotes via FMP...', err.message)
    }
  }

  // 3. Fallback to Yahoo Finance (Spark) - Free but up to 15m delayed for some exchanges
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(symbols)}&range=1d&interval=1d`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/json',
      },
      cache: 'no-store'
    })

    if (!res.ok) throw new Error(`Yahoo API error: ${res.status}`);

    const data = await res.json()
    const sparkResults = data.spark?.result || []
    
    const normalized = sparkResults.map((q: any) => {
      const meta = q.response?.[0]?.meta || q
      const price = meta.regularMarketPrice ?? 0
      const prevClose = meta.chartPreviousClose ?? price
      const changePct = prevClose > 0 && price > 0 ? ((price - prevClose) / prevClose) * 100 : 0
      
      return {
        symbol: meta.symbol || q.symbol,
        price,
        changePercent: changePct,
        dayLow: meta.regularMarketDayLow ?? null,
        dayHigh: meta.regularMarketDayHigh ?? null,
        name: meta.shortName || '',
        source: 'yahoo_delayed'
      }
    })

    return NextResponse.json({ quotes: normalized })
  } catch (err: any) {
    console.error('[quote API] Complete fetch failure:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
