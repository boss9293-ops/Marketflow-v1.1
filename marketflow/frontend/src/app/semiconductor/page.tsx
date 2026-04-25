import type { SemiconductorOutput } from '@/lib/semiconductor/types'
import SemiconductorDashboard from '@/components/semiconductor/SemiconductorDashboard'

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

export default async function SemiconductorPage() {
  const data = await getdata()

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-red-400 font-mono text-sm p-10">
          Semiconductor data unavailable. Check /api/semiconductor.
        </div>
      </div>
    )
  }

  return <SemiconductorDashboard data={data} />
}
