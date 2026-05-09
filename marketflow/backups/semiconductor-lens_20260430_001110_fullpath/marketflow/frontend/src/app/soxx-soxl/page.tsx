import type { SemiconductorOutput } from '@/lib/semiconductor/types'
import SoxxSoxlDashboard      from '@/components/semiconductor/SoxxSoxlDashboard'
import BucketAttributionChart from '@/components/semiconductor/BucketAttributionChart'

async function getdata(): Promise<SemiconductorOutput | null> {
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3010')
    const res  = await fetch(`${base}/api/semiconductor`, { cache: 'no-store' })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export default async function SoxxSoxlPage() {
  const data = await getdata()

  if (!data) {
    return (
      <div style={{ background: '#03060e', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#ff3d5a', fontFamily: 'monospace', fontSize: '12.6px', padding: 40 }}>
          Semiconductor data unavailable. Check /api/semiconductor.
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#03060e', minHeight: '100vh' }}>
      {/* Cycle Engine — Panel 1 & 2 */}
      <SoxxSoxlDashboard data={data} />

      {/* Bucket Attribution — 4-Panel */}
      <div style={{
        maxWidth: 1320, margin: '0 auto', padding: '0 64px 48px',
        background: '#03060e',
      }}>
        <BucketAttributionChart
          tickers={data.market_data.tickers}
          subBucketPerf={data.signals.sub_bucket_perf}
          stage={data.stage.stage}
        />
      </div>
    </div>
  )
}
