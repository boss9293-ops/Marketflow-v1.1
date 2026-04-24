// Screen B — SOXX / SOXL Tactical
import type { SemiconductorOutput } from '@/lib/semiconductor/types'
import ReferenceBar           from '@/components/semiconductor/ReferenceBar'
import SoxxAnchor             from '@/components/semiconductor/SoxxAnchor'
import SoxlTactical           from '@/components/semiconductor/SoxlTactical'
import SemiconductorRiskPanel from '@/components/semiconductor/SemiconductorRiskPanel'
import ActionLayer            from '@/components/semiconductor/ActionLayer'

async function getdata(): Promise<SemiconductorOutput | null> {
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3010'
    const res  = await fetch(`${base}/api/semiconductor`, { cache: 'no-store' })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

const PAGE_STYLE = {
  background: '#030712',
  minHeight: '100vh',
  padding: '24px 20px',
  color: '#e2e8f0',
  fontFamily: 'monospace',
}

export default async function SoxxSoxlPage() {
  const data = await getdata()

  if (!data) {
    return (
      <div style={PAGE_STYLE}>
        <div style={{ color: '#ef4444', padding: 40 }}>
          Semiconductor data unavailable. Check /api/semiconductor.
        </div>
      </div>
    )
  }

  const { stage, signals, translation } = data

  return (
    <div style={PAGE_STYLE}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Page header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.01em' }}>
            Semiconductor Cycle Monitor
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            AI Infrastructure / Semiconductor cycle radar
          </div>
        </div>

        {/* Screen nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <a href="/semiconductor" style={{ fontSize: 12, color: '#38bdf8', textDecoration: 'none' }}>
            ← Screen A: Semiconductor condition
          </a>
          <div style={{ fontSize: 12, color: '#6366f1', fontWeight: 600 }}>Screen B — SOXX / SOXL tactical translation</div>
        </div>

        {/* B-0: Persistent reference bar */}
        <ReferenceBar stage={stage} signals={signals} />

        {/* B-1: Industry summary */}
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8,
                      padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#64748b', letterSpacing: 2, marginBottom: 10 }}>
            INDUSTRY SUMMARY
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7 }}>
            {translation.education_advanced}
          </div>
        </div>

        {/* B-2: SOXX Anchor */}
        <SoxxAnchor soxx={translation.soxx} signals={signals} />

        {/* B-3: SOXL Tactical */}
        <SoxlTactical soxl={translation.soxl} />

        {/* B-4: Risk Panel */}
        <SemiconductorRiskPanel translation={translation} signals={signals} />

        {/* B-5: Action Layer */}
        <ActionLayer translation={translation} />

        <div style={{ fontSize: 11, color: '#334155', textAlign: 'right', marginTop: 16 }}>
          Updated: {data.as_of}
        </div>
      </div>
    </div>
  )
}
