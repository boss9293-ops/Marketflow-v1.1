import { readFileSync } from 'fs'
import { join } from 'path'
import type { CSSProperties } from 'react'
import VRSurvival, {
  type ETFRoomData,
  type Tab,
  VRSurvivalData,
} from '@/components/crash/vr/VRSurvival'
import IntegratedResearchPanel   from '@/components/ai/IntegratedResearchPanel'
import ResearchScenarioMapPanel  from '@/components/scenario/ResearchScenarioMapPanel'
import VRTrustStrip              from '@/components/vr/VRTrustStrip'
import VRRiskTracksCard           from '@/components/vr/VRRiskTracksCard'
import VRHistoricalContextCard   from '@/components/vr/VRHistoricalContextCard'
import VRActionGuideCard         from '@/components/vr/VRActionGuideCard'

type RiskV1CurrentSnapshot = {
  score: number | null
  level: number | null
  date: string | null
}

function readRiskV1Current(): RiskV1CurrentSnapshot {
  try {
    const base = join(process.cwd(), '..', 'backend', 'output')
    const raw = readFileSync(join(base, 'risk_v1.json'), 'utf-8')
    const data = JSON.parse(raw)
    return {
      score: data?.current?.score ?? null,
      level: data?.current?.level ?? null,
      date:  data?.current?.date  ?? null,
    }
  } catch {
    return { score: null, level: null, date: null }
  }
}

function readOutputJson<T>(filename: string): T | null {
  try {
    const base = join(process.cwd(), '..', 'backend', 'output')
    const raw = readFileSync(join(base, filename), 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}


function toSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function VRSurvivalPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined }
}) {
  const raw = readOutputJson<VRSurvivalData>('vr_survival.json')
  const riskV1 = readRiskV1Current()
  const heatmapData = readOutputJson<ETFRoomData>('etf_room.json')
  const requestedTab = toSingleValue(searchParams?.tab)
  const requestedEvent = toSingleValue(searchParams?.event)
  const VALID_TABS: Tab[] = ['Overview', 'Strategy Lab', 'Crash Analysis', 'Backtest', 'Playback', 'Pool Logic', 'Options Overlay', 'Philosophy']
  const initialTab: Tab = (requestedTab && VALID_TABS.includes(requestedTab as Tab)) ? (requestedTab as Tab) : 'Overview'
  const initialPlaybackEventId =
    requestedEvent && /^\d{4}-\d{2}$/.test(requestedEvent) ? requestedEvent : undefined
  const simEventId = toSingleValue(searchParams?.sim_event)
  const simStart = toSingleValue(searchParams?.sim_start)
  const simCapital = toSingleValue(searchParams?.sim_capital)
  const simStockPct = toSingleValue(searchParams?.sim_stock_pct)
  const simParams =
    simEventId && /^\d{4}-\d{2}$/.test(simEventId)
      ? {
          event_id: simEventId,
          sim_start: simStart,
          sim_capital: simCapital,
          sim_stock_pct: simStockPct,
        }
      : undefined

  if (!raw) {
    return (
      <main style={{ padding: '2.6rem', color: '#94a3b8', fontFamily: 'monospace' }}>
        <h2 style={{ color: '#ef4444' }}>vr_survival.json not found</h2>
        <p>
          Run:{' '}
          <code style={{ background: '#111827', padding: '0.26rem 0.65rem', borderRadius: 6 }}>
            py C:/Temp/build_vr_survival.py
          </code>
        </p>
        <a href="/risk-v1" style={{ color: '#818cf8' }}>
          Risk System v1
        </a>
      </main>
    )
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0c0e13',
        color: '#e5e7eb',
        fontFamily: "'Inter','Segoe UI',sans-serif",
        padding: '1.35rem 1.5rem',
      }}
    >
      <div style={{ maxWidth: 1460, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              MarketFlow - Leverage Exposure Control
            </div>
            <h1 style={{ fontSize: '2.3rem', fontWeight: 900, color: '#f8fafc', margin: '0.35rem 0 0' }}>
              VR Survival System v1
            </h1>
            <div style={{ fontSize: '0.92rem', color: '#94a3b8', marginTop: 8, lineHeight: 1.6, maxWidth: 760 }}>
              AI-centered interpretation of current market regime, VR state, and historical analogs.
              Engine data and strategy results follow below as supporting context.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href="/risk-v1" style={navLinkStyle}>
              Standard (QQQ)
            </a>
            <a href="/backtest" style={navLinkStyle}>
              Backtests
            </a>
            <a href="/crash" style={navLinkStyle}>
              Crash Hub
            </a>
            <a href="/dashboard" style={navLinkStyle}>
              Dashboard
            </a>
          </div>
        </div>

        <VRTrustStrip />

        <VRRiskTracksCard
          rawEventState={raw?.current?.state ?? null}
          structuralState={raw?.current?.structural_state ?? null}
          mssScore={riskV1.score}
          mssLevel={riskV1.level}
          updatedAt={riskV1.date}
        />

        <IntegratedResearchPanel />

        <ResearchScenarioMapPanel vrState={raw.current.state} />

        <VRHistoricalContextCard />

        <VRActionGuideCard vrState={raw.current.state} />

        <FlowDivider
          step="Step 2 of 4"
          label="Engine Data & Strategy"
          desc="Use Strategy Lab to test AI scenarios against historical event data. Use Crash Analysis to validate the risk assessment. Use Playback to review execution step by step."
        />

        <VRSurvival
          data={raw}
          heatmapData={heatmapData}
          initialTab={initialTab}
          initialPlaybackEventId={initialPlaybackEventId}
          simParams={simParams}
        />

        <div style={{ fontSize: '0.75rem', color: '#475569', textAlign: 'center', paddingTop: '0.4rem' }}>
          Generated: {raw.run_id} - VR Survival System v1
        </div>
      </div>
    </main>
  )
}

function FlowDivider({ step, label, desc }: { step: string; label: string; desc: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '0.35rem 0' }}>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 0 }}>
        <div style={{ fontSize: '0.62rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700, whiteSpace: 'nowrap' }}>
          {step} · {label}
        </div>
        <div style={{ fontSize: '0.71rem', color: '#475569', fontStyle: 'italic', textAlign: 'center', maxWidth: 480 }}>
          {desc}
        </div>
      </div>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
    </div>
  )
}

const navLinkStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: '#94a3b8',
  textDecoration: 'none',
  padding: '0.45rem 0.95rem',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  background: 'rgba(255,255,255,0.02)',
}
