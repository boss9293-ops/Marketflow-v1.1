// Screen A+B — Semiconductor Cycle Monitor (unified entry)
import type { SemiconductorOutput } from '@/lib/semiconductor/types'
import CycleHeader         from '@/components/semiconductor/CycleHeader'
import LeadersBreadthPanel from '@/components/semiconductor/LeadersBreadthPanel'
import CoreDriverPanel     from '@/components/semiconductor/CoreDriverPanel'
import EducationLayer      from '@/components/semiconductor/EducationLayer'
import SoxxAnchor          from '@/components/semiconductor/SoxxAnchor'
import SoxlTactical        from '@/components/semiconductor/SoxlTactical'
import ActionLayer         from '@/components/semiconductor/ActionLayer'
import BucketPerfChart    from '@/components/semiconductor/BucketPerfChart'
import BucketRSChart      from '@/components/semiconductor/BucketRSChart'
import CyclePlayback      from '@/components/semiconductor/CyclePlayback'

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

const PAGE_STYLE = {
  background: '#030712',
  minHeight: '100vh',
  padding: '24px 20px',
  color: '#e2e8f0',
  fontFamily: 'monospace',
}

const SECTION_LABEL = (color: string): React.CSSProperties => ({
  fontSize: 11,
  color,
  letterSpacing: 2,
  fontWeight: 700,
  marginBottom: 14,
  paddingBottom: 6,
  borderBottom: `1px solid ${color}22`,
})

export default async function SemiconductorPage() {
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
  const summary = translation.education_advanced.split('.')[0] + '.'

  return (
    <div style={PAGE_STYLE}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Page header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.01em' }}>
            Semiconductor Cycle Monitor
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            AI Infrastructure / Semiconductor cycle radar
          </div>
        </div>

        {/* ── Screen A ─────────────────────────────────────────── */}
        <div style={SECTION_LABEL('#00D9FF')}>SCREEN A — INDUSTRY VIEW</div>

        {/* A-1: Cycle header */}
        <CycleHeader
          stage={stage}
          breadth={signals.breadth_state}
          momentum={signals.momentum}
          summary={summary}
        />

        {/* A-2: Sector Radar — snapshot bar charts */}
        <BucketPerfChart signals={signals} />

        {/* A-3: Bucket RS — rebased 100 time series */}
        <BucketRSChart currentPerf={signals.sub_bucket_perf} stage={stage.stage} />

        {/* A-4: Leaders / Breadth */}
        <LeadersBreadthPanel signals={signals} />

        {/* A-5: Core Drivers */}
        <CoreDriverPanel signals={signals} />

        {/* A-5: Historical Cycle Playback */}
        <CyclePlayback currentStage={stage.stage} />

        {/* A-6: Education */}
        <EducationLayer
          beginner={translation.education_beginner}
          advanced={translation.education_advanced}
        />

        {/* ── Screen B ─────────────────────────────────────────── */}
        <div style={{ borderTop: '1px solid #1e293b', marginTop: 32, paddingTop: 24 }}>
          <div style={SECTION_LABEL('#6366f1')}>SCREEN B — ETF TRANSLATION · SOXX / SOXL</div>
        </div>

        {/* B-1: SOXX Anchor */}
        <SoxxAnchor soxx={translation.soxx} signals={signals} />

        {/* B-2: SOXL Tactical */}
        <SoxlTactical soxl={translation.soxl} />

        {/* B-3: Action Layer */}
        <ActionLayer translation={translation} />

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      marginTop: 16, fontSize: 11, color: '#334155' }}>
          <span>Updated: {data.as_of} · Tier 2: {signals.tier2_available ? 'Available (delayed)' : 'Tier 1 only'}</span>
          <a href="/soxx-soxl" style={{ color: '#38bdf8', textDecoration: 'none' }}>
            Screen B standalone →
          </a>
        </div>

      </div>
    </div>
  )
}
