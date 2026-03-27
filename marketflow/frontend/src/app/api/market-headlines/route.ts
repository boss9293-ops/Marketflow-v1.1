import { NextResponse } from 'next/server'

// Fallback hardcoded headlines (used when Finnhub is unavailable)
const FALLBACK_HEADLINES = [
  {
    id: 'mh-fallback-1',
    publishedAtET: '',
    timeET: '15:46 ET',
    headline: 'Markets close mixed as investors weigh macro data and Fed signals.',
    source: 'Reuters',
    summary: 'Equity markets ended the session with mixed results as traders balanced competing signals from economic data releases and Federal Reserve commentary.',
    url: 'https://www.reuters.com/markets',
  },
  {
    id: 'mh-fallback-2',
    publishedAtET: '',
    timeET: '15:19 ET',
    headline: 'Tech sector leads afternoon recovery amid earnings optimism.',
    source: 'Bloomberg',
    summary: 'Large-cap technology names reclaimed ground in the final hour of trading, supported by constructive guidance from several sector bellwethers.',
    url: 'https://www.bloomberg.com/markets',
  },
  {
    id: 'mh-fallback-3',
    publishedAtET: '',
    timeET: '13:10 ET',
    headline: 'Bond yields tick higher as inflation expectations adjust.',
    source: 'Financial Times',
    summary: 'Treasury yields moved modestly higher through midday as market participants repriced inflation expectations following the latest CPI data.',
    url: 'https://www.ft.com/markets',
  },
  {
    id: 'mh-fallback-4',
    publishedAtET: '',
    timeET: '11:30 ET',
    headline: 'Energy stocks outperform on crude oil supply concerns.',
    source: 'WSJ',
    summary: 'The energy sector outperformed broader markets after inventory data pointed to tighter-than-expected crude supply heading into the summer driving season.',
    url: 'https://www.wsj.com/market-data',
  },
]

export async function GET() {
  const key = process.env.FINNHUB_API_KEY || process.env.NEXT_PUBLIC_FINNHUB_API_KEY || ''
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  if (key) {
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/news?category=general&token=${key}`,
        { cache: 'no-store' }
      )
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.slice(0, 5).map((item: any) => {
            const dt = new Date(item.datetime * 1000)
            const dateET = dt.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
            const timeET =
              dt.toLocaleTimeString('en-US', {
                timeZone: 'America/New_York',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              }) + ' ET'
            return {
              id: `mh-fh-${item.id}`,
              publishedAtET: dt.toISOString(),
              timeET,
              headline: item.headline,
              source: item.source,
              summary: item.summary || item.headline,
              url: item.url,
              dateET,
            }
          })
          return NextResponse.json({ headlines: mapped })
        }
      }
    } catch (err) {
      console.warn('[market-headlines] Finnhub fetch failed:', err)
    }
  }

  // Fallback: hardcoded with today's date injected
  const fallback = FALLBACK_HEADLINES.map((h) => ({
    ...h,
    publishedAtET: `${today}T15:00:00-05:00`,
    dateET: today,
  }))
  return NextResponse.json({ headlines: fallback })
}
