'use client'

import { useEffect, useMemo, useState } from 'react'
import BilLabel from '@/components/BilLabel'
import EmptyState from '@/components/EmptyState'
import {
  type HealthBucket,
  type HealthMode,
  type MetricRow,
  type RegimeMatrixState,
  type ScoringMode,
  type StructuralComponent,
  type WeightsPreset,
  formatMetricRow,
  getModeCopy,
  mapSHSToAction,
} from '@/lib/marketHealth'

type ScorePack = {
  score: number
  raw?: number
  smoothed?: number
  confidence?: number
  delta1d?: number | null
  delta5d?: number | null
  bucketKey?: 'Strong' | 'Stable' | 'Transition' | 'Fragile' | 'Risk'
  bucket: HealthBucket
  components: StructuralComponent[]
  summary: { ko: string; en: string }
  explain?: {
    topDrivers: {
      weakest: Array<{ key: 'trend' | 'vol' | 'breadth' | 'liquidity'; score: number }>
      strongest: Array<{ key: 'trend' | 'vol' | 'breadth' | 'liquidity'; score: number }>
    }
    whyText: { ko: string; en: string }
  }
  moduleConfidences?: Partial<Record<'trend' | 'vol' | 'breadth' | 'liquidity', number>>
}

type RawMetricInputs = {
  expected_move_95?: number | null
  tail_prob_30d?: number | null
  drawdown_risk_30d?: string | null
  credit_condition?: string | null
  max_dd_12m?: number | null
  ulcer_index?: number | null
  cvar95?: number | null
  cvar99?: number | null
  dd_prob_12m?: number | null
}

export type MarketHealthV2Model = {
  asOfDate: string | null
  hasData: boolean
  staleData?: boolean
  scoringMeta?: {
    scoringMode: ScoringMode
    weightsPreset: WeightsPreset
    alpha: number
    maxStep: number
  }
  feedStatus?: Array<{ key: string; ok: boolean; label: string; date?: string | null; missing?: string[] }>
  standard: ScorePack
  retirement: ScorePack
  regimeMatrix: RegimeMatrixState
  rawMetrics: RawMetricInputs
}

function chip(text: string) {
  return (
    <span
      style={{
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.02)',
        color: '#D8E4F2',
        padding: '0.28rem 0.55rem',
        fontSize: '0.86rem',
        fontWeight: 700,
      }}
    >
      {text}
    </span>
  )
}

function componentTone(v: number) {
  if (v >= 18) return 'var(--risk-1)'
  if (v >= 13) return 'var(--risk-0)'
  if (v >= 8) return 'var(--risk-2)'
  if (v >= 4) return 'var(--risk-3)'
  return 'var(--risk-4)'
}

export default function MarketHealthV2Client({ model }: { model: MarketHealthV2Model }) {
  const [mode, setMode] = useState<HealthMode>('standard')
  const [scoringMode, setScoringMode] = useState<ScoringMode>(model.scoringMeta?.scoringMode ?? 'threshold')
  const [weightsPreset, setWeightsPreset] = useState<WeightsPreset>(model.scoringMeta?.weightsPreset ?? 'fixed')
  useEffect(() => {
    try {
      const savedMode = window.localStorage.getItem('mf_health_mode')
      const savedScoring = window.localStorage.getItem('mf_health_scoring_mode')
      const savedWeights = window.localStorage.getItem('mf_health_weights_preset')
      if (savedMode === 'standard' || savedMode === 'retirement') setMode(savedMode)
      if (savedScoring === 'threshold' || savedScoring === 'percentile') setScoringMode(savedScoring)
      if (savedWeights === 'fixed' || savedWeights === 'regimeAdaptive') setWeightsPreset(savedWeights)
    } catch {}
  }, [])
  useEffect(() => {
    try {
      window.localStorage.setItem('mf_health_mode', mode)
      window.localStorage.setItem('mf_health_scoring_mode', scoringMode)
      window.localStorage.setItem('mf_health_weights_preset', weightsPreset)
    } catch {}
  }, [mode, scoringMode, weightsPreset])
  const active = mode === 'retirement' ? model.retirement : model.standard
  const modeCopy = useMemo(() => getModeCopy(mode, { bucketKey: active.bucket.key, stale: model.staleData, confidence: active.confidence }), [mode, active.bucket.key, active.confidence, model.staleData])
  const actionGuide = useMemo(() => {
    const bucketKey =
      active.bucketKey ??
      (active.bucket.labelEn === 'Structurally Strong'
        ? 'Strong'
        : active.bucket.labelEn === 'Stable'
        ? 'Stable'
        : active.bucket.labelEn === 'Transition'
        ? 'Transition'
        : active.bucket.labelEn === 'Fragile'
        ? 'Fragile'
        : 'Risk')
    const [trend, vol, breadth, liquidity] = active.components
    return mapSHSToAction(
      bucketKey,
      {
        trend: { score: trend?.value ?? 12.5, confidence: 1, details: [] },
        vol: { score: vol?.value ?? 12.5, confidence: 1, details: [] },
        breadth: { score: breadth?.value ?? 12.5, confidence: 1, details: [] },
        liquidity: { score: liquidity?.value ?? 12.5, confidence: 1, details: [] },
      },
      mode,
    )
  }, [active, mode])

  const diagnostics: MetricRow[] = useMemo(() => {
    if (mode === 'retirement') {
      return [
        formatMetricRow('max_dd_12m', model.rawMetrics.max_dd_12m ?? null, mode),
        formatMetricRow('ulcer_index', model.rawMetrics.ulcer_index ?? null, mode),
        formatMetricRow('cvar95', model.rawMetrics.cvar95 ?? null, mode),
        formatMetricRow('cvar99', model.rawMetrics.cvar99 ?? null, mode),
        formatMetricRow('dd_prob_12m', model.rawMetrics.dd_prob_12m ?? null, mode),
      ]
    }
    return [
      formatMetricRow('expected_move_95', model.rawMetrics.expected_move_95 ?? null, mode),
      formatMetricRow('tail_prob_30d', model.rawMetrics.tail_prob_30d ?? null, mode),
      formatMetricRow('drawdown_risk_30d', model.rawMetrics.drawdown_risk_30d ?? null, mode),
      formatMetricRow('credit_condition', model.rawMetrics.credit_condition ?? null, mode),
      formatMetricRow('cvar95', model.rawMetrics.cvar95 ?? null, mode),
    ]
  }, [mode, model.rawMetrics])

  const markerLeft = `${((model.regimeMatrix.x + 1) / 2) * 100}%`
  const markerTop = `${(1 - (model.regimeMatrix.y + 1) / 2) * 100}%`
  const lowConfidence = (active.confidence ?? 1) < 0.5
  const statusTone = (s: MetricRow['status']) =>
    s === 'GOOD'
      ? { bg: 'rgba(34,197,94,0.10)', border: 'rgba(34,197,94,0.24)', color: '#4ade80', label: { ko: '양호', en: 'GOOD' } }
      : s === 'WATCH'
      ? { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.24)', color: '#fbbf24', label: { ko: '관찰', en: 'WATCH' } }
      : s === 'RISK'
      ? { bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.24)', color: '#f87171', label: { ko: '주의', en: 'RISK' } }
      : { bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.20)', color: '#C5D5E8', label: { ko: '없음', en: 'NA' } }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <header
        style={{
          background: '#070B10',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 14,
          padding: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ color: '#F8FAFC', fontSize: 'clamp(1.7rem,3vw,2.2rem)', fontWeight: 800, lineHeight: 1 }}>
            Market Health
          </div>
          <div style={{ color: '#D8E4F2', marginTop: 6 }}>
            <BilLabel ko="시장 구조 안정성 진단 레이어" en="Structural Stability Diagnostic Layer" variant="micro" />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'inline-flex',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.02)',
              padding: 4,
              gap: 4,
            }}
          >
            {([
              { key: 'standard', ko: '표준 모드', en: 'Standard Mode' },
              { key: 'retirement', ko: '은퇴 모드', en: 'Retirement Mode' },
            ] as const).map((t) => {
              const isActive = mode === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setMode(t.key)}
                  style={{
                    borderRadius: 10,
                    border: '1px solid transparent',
                    background: isActive ? '#D7FF37' : 'transparent',
                    color: isActive ? '#0B0F14' : '#DEE7F3',
                    padding: '0.35rem 0.7rem',
                    cursor: 'pointer',
                  }}
                >
                  <BilLabel ko={t.ko} en={t.en} variant="micro" />
                </button>
              )
            })}
          </div>
          <span style={{ color: '#D8E4F2' }}>
            <BilLabel ko={`최종 업데이트 ${model.asOfDate || '—'}`} en={`Last updated: ${model.asOfDate || '—'}`} variant="micro" />
          </span>
          {model.staleData && chip('Stale data')}
          <details style={{ position: 'relative' }}>
            <summary
              style={{
                listStyle: 'none',
                cursor: 'pointer',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.02)',
                padding: '0.35rem 0.6rem',
                color: '#E6EEF8',
                fontWeight: 700,
                fontSize: '0.86rem',
              }}
            >
              <BilLabel ko="진단" en="Diagnostics" variant="micro" />
            </summary>
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 8px)',
                zIndex: 20,
                width: 'min(560px, 92vw)',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.08)',
                background: '#0B1016',
                boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
                padding: '0.8rem',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ color: '#F8FAFC', fontWeight: 800 }}>
                  <BilLabel ko="피드 상태 / 디버그" en="Feed Status / Debug" variant="micro" />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      navigator.clipboard.writeText(JSON.stringify({ feedStatus: model.feedStatus, scoringMode, weightsPreset, asOfDate: model.asOfDate }, null, 2))
                    } catch {}
                  }}
                  style={{ borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', color: '#DEE7F3', padding: '0.25rem 0.45rem', fontSize: '0.82rem', fontWeight: 700 }}
                >
                  Copy
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }} className="max-sm:grid-cols-1">
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ color: '#DEE8F4', fontSize: '0.82rem' }}>scoringMode</span>
                  <select value={scoringMode} onChange={(e) => setScoringMode(e.target.value as ScoringMode)} style={{ background: '#0F1722', color: '#E5EDF7', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '0.35rem 0.45rem' }}>
                    <option value="threshold">threshold</option>
                    <option value="percentile">percentile (stub)</option>
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ color: '#DEE8F4', fontSize: '0.82rem' }}>weightsPreset</span>
                  <select value={weightsPreset} onChange={(e) => setWeightsPreset(e.target.value as WeightsPreset)} style={{ background: '#0F1722', color: '#E5EDF7', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '0.35rem 0.45rem' }}>
                    <option value="fixed">fixed</option>
                    <option value="regimeAdaptive">regimeAdaptive (stub)</option>
                  </select>
                </label>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflow: 'auto' }}>
                {(model.feedStatus ?? []).map((f) => (
                  <div key={f.key} style={{ borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.015)', padding: '0.5rem 0.6rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                      <div style={{ color: '#E6EEF8', fontWeight: 700 }}>{f.ok ? '✅' : '⚠️'} {f.label}</div>
                      <div style={{ color: '#C8D7EA', fontSize: '0.82rem' }}>{f.date || '—'}</div>
                    </div>
                    {!!f.missing?.length && <div style={{ color: '#DEE8F4', marginTop: 4, fontSize: '0.82rem' }}>missing: {f.missing.join(', ')}</div>}
                  </div>
                ))}
              </div>
            </div>
          </details>
        </div>
      </header>

      {!model.hasData ? (
        <EmptyState
          title={{ ko: '시장 건강 데이터 없음', en: 'Market health data unavailable' }}
          description={{ ko: '캐시 생성 후 다시 확인하세요.', en: 'Run the pipeline and reload this page.' }}
          action={<a href="/dashboard" style={{ color: '#D7FF37', textDecoration: 'none', fontWeight: 700 }}>Dashboard →</a>}
        />
      ) : (
        <>
          {/* Layer A */}
          <section
            style={{
              background: '#070B10',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 16,
              padding: '1.25rem',
              display: 'grid',
              gridTemplateColumns: '1.25fr 0.75fr',
              gap: '1rem',
            }}
            className="max-lg:grid-cols-1"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ width: 6, height: 28, borderRadius: 999, background: active.bucket.color }} />
                <div style={{ color: '#F8FAFC', fontSize: '1.35rem', fontWeight: 800 }}>
                  {mode === 'retirement' ? 'Capital Stability Index' : 'Structural Health Score'}
                </div>
                {chip(mode === 'retirement' ? 'CSI' : 'Standard')}
                {active.confidence != null && active.confidence < 0.7 && chip('Data limited')}
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ color: '#F8FAFC', fontSize: 'clamp(2.8rem,5vw,3.4rem)', fontWeight: 900, lineHeight: 0.95 }}>
                  {Math.round(active.score)}
                </div>
                <div style={{ color: '#D7E3F1', fontSize: '1.15rem', fontWeight: 700, marginBottom: 4 }}>/100</div>
                <span style={{ borderRadius: 999, border: `1px solid ${active.bucket.color}55`, background: `${active.bucket.color}18`, color: active.bucket.color, padding: '0.35rem 0.7rem', fontWeight: 800, fontSize: '0.9rem' }}>
                  <BilLabel ko={active.bucket.labelKo} en={active.bucket.labelEn} variant="micro" />
                </span>
                {(active.delta1d != null || active.delta5d != null) && (
                  <span style={{ color: '#DEE8F4', fontSize: '0.86rem', fontWeight: 700 }}>
                    {active.delta1d != null ? `1D ${active.delta1d >= 0 ? '+' : ''}${active.delta1d.toFixed(1)}` : ''}{' '}
                    {active.delta5d != null ? `· 5D ${active.delta5d >= 0 ? '+' : ''}${active.delta5d.toFixed(1)}` : ''}
                  </span>
                )}
                {typeof active.raw === 'number' && typeof active.smoothed === 'number' && (
                  <span style={{ color: '#D7E3F1', fontSize: '0.82rem', fontWeight: 700 }}>
                    raw {Math.round(active.raw)} · ema {Math.round(active.smoothed)}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {active.components.map((c) => {
                  const tone = componentTone(c.value)
                  const conf = active.moduleConfidences?.[c.key]
                  return (
                    <div key={c.key} style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', background: '#0D1219', padding: '0.75rem 0.8rem' }}>
                      <div style={{ color: '#E5EDF7' }}>
                        <BilLabel ko={c.labelKo} en={c.labelEn} variant="micro" />
                      </div>
                      <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ color: '#F8FAFC', fontSize: '1.15rem', fontWeight: 800 }}>{c.value}/25</div>
                        <div style={{ color: tone, fontWeight: 700, fontSize: '0.9rem' }}>
                          <BilLabel ko={c.stateKo} en={c.stateEn} variant="micro" />
                        </div>
                      </div>
                      <div style={{ marginTop: 8, height: 5, borderRadius: 999, background: 'rgba(148,163,184,0.12)', overflow: 'hidden' }}>
                        <div style={{ width: `${(c.value / 25) * 100}%`, height: '100%', background: tone }} />
                      </div>
                      {typeof conf === 'number' && (
                        <div style={{ marginTop: 6, color: '#D7E3F1', fontSize: '0.82rem', fontWeight: 700 }}>
                          conf {Math.round(conf * 100)}%
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', background: '#0D1219', padding: '0.85rem 0.9rem', color: '#E6EEF8', lineHeight: 1.5 }}>
                <div className="mf-bil-ko" style={{ fontSize: '1rem' }}>{active.summary.ko}</div>
                <div className="mf-bil-en" style={{ fontSize: '0.9rem', color: '#DEE8F4', marginTop: 4 }}>{active.summary.en}</div>
              </div>
              {active.explain && (
                <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', background: '#0D1219', padding: '0.8rem 0.9rem', color: '#E6EEF8' }}>
                  <div style={{ color: '#F8FAFC', fontWeight: 800 }}>
                    <BilLabel ko="핵심 드라이버" en="Top Drivers" variant="micro" />
                  </div>
                  <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {active.explain.topDrivers.weakest.map((d) => chip(`↓ ${d.key} ${Math.round(d.score)}`))}
                    {active.explain.topDrivers.strongest.map((d) => chip(`↑ ${d.key} ${Math.round(d.score)}`))}
                  </div>
                  <div className="mf-bil-ko" style={{ marginTop: 8, fontSize: '0.94rem', color: '#C9D7E7' }}>{active.explain.whyText.ko}</div>
                  <div className="mf-bil-en" style={{ marginTop: 4, fontSize: '0.86rem', color: '#C8D7EA' }}>{active.explain.whyText.en}</div>
                </div>
              )}
              {lowConfidence && (
                <div style={{ borderRadius: 12, border: '1px solid rgba(245,158,11,0.28)', background: 'rgba(245,158,11,0.08)', padding: '0.7rem 0.85rem', color: '#FDE68A' }}>
                  <BilLabel ko="일부 피드가 누락되어 부분 지표로 계산 중입니다." en="Some feeds missing; using partial indicators." variant="micro" />
                </div>
              )}
            </div>

            <aside style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)', background: '#0B1016', padding: '0.95rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              <div style={{ color: '#F8FAFC', fontSize: '1.2rem', fontWeight: 800 }}>
                <BilLabel ko="포지셔닝 가이드" en="Positioning Guide" variant="label" />
              </div>
              {[
                { ko: '주식 비중 기울기', en: 'Equity Tilt', valueKo: actionGuide.equityTilt.ko, valueEn: actionGuide.equityTilt.en },
                { ko: '리스크 자세', en: 'Risk Posture', valueKo: actionGuide.riskPosture.ko, valueEn: actionGuide.riskPosture.en },
                { ko: '가이드 노출 구간', en: 'Exposure Band', valueKo: `${actionGuide.exposureBand}%`, valueEn: `${actionGuide.exposureBand}%` },
                { ko: '리밸런스 바이어스', en: 'Rebalance Bias', valueKo: actionGuide.rebalanceBias.ko, valueEn: actionGuide.rebalanceBias.en },
              ].map((row) => (
                <div key={row.en} style={{ borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.015)', padding: '0.65rem 0.75rem' }}>
                  <div style={{ color: '#DEE8F4' }}>
                    <BilLabel ko={row.ko} en={row.en} variant="micro" />
                  </div>
                  <div style={{ color: '#F8FAFC', marginTop: 4, fontSize: '1.05rem', fontWeight: 800 }}>
                    <BilLabel ko={row.valueKo} en={row.valueEn} variant="label" />
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 4, color: '#E5EDF7' }}>
                <BilLabel ko={actionGuide.reason.ko} en={actionGuide.reason.en} variant="micro" />
              </div>
              <div style={{ borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.015)', padding: '0.65rem 0.75rem' }}>
                <div style={{ color: '#F8FAFC', fontWeight: 800 }}>
                  <BilLabel ko="가드레일" en="Guardrails" variant="micro" />
                </div>
                <ul style={{ margin: '0.45rem 0 0 0', paddingLeft: '1rem', color: '#DFE8F4', lineHeight: 1.45 }}>
                  {actionGuide.guardrails.slice(0, 2).map((g, i) => (
                    <li key={i}>
                      <span className="mf-bil-ko" style={{ fontSize: '0.9rem' }}>{g.ko}</span>
                      <span className="mf-bil-en" style={{ fontSize: '0.82rem', color: '#C8D7EA' }}>{g.en}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div style={{ marginTop: 2, color: '#DEE8F4' }}>
                <BilLabel ko={modeCopy.summary.ko} en={modeCopy.summary.en} variant="micro" />
              </div>
              <div style={{ marginTop: 'auto', color: '#D8E4F2', fontSize: '0.85rem', lineHeight: 1.4 }}>
                <span className="mf-bil-ko">투자 자문이 아닙니다. 구조 진단 기반 해석입니다.</span>
                <span className="mf-bil-en">Not financial advice. This is a structural diagnostic interpretation.</span>
              </div>
            </aside>
          </section>

          {/* Layer B */}
          <section style={{ background: '#070B10', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ color: '#F8FAFC', fontSize: '1.35rem', fontWeight: 800 }}>
                <BilLabel ko="레짐 매트릭스" en="Regime Matrix" variant="label" />
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {chip(`Trend: ${model.regimeMatrix.trendState}`)}
                {chip(`Vol: ${model.regimeMatrix.volState}`)}
                {chip(`Zone: ${model.regimeMatrix.zoneLabelEn}`)}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-4" style={{ minWidth: 0 }}>
              <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', background: '#0D1219', padding: '0.8rem', minHeight: 300 }}>
                <div style={{ position: 'relative', height: 260, borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}>
                  <div style={{ position: 'absolute', inset: 0, background:
                    'linear-gradient(to right, rgba(239,68,68,0.05), rgba(255,255,255,0) 50%, rgba(34,197,94,0.05)), linear-gradient(to top, rgba(239,68,68,0.05), rgba(255,255,255,0) 50%, rgba(56,189,248,0.05))' }} />
                  <div style={{ position: 'absolute', left: '50%', top: 8, bottom: 8, borderLeft: '1px dashed rgba(148,163,184,0.25)' }} />
                  <div style={{ position: 'absolute', top: '50%', left: 8, right: 8, borderTop: '1px dashed rgba(148,163,184,0.25)' }} />
                  <div style={{ position: 'absolute', left: 10, right: 10, top: 10, display: 'flex', justifyContent: 'space-between', color: '#DEE8F4', fontSize: '0.8rem' }}>
                    <span>Tight</span><span>Loose</span>
                  </div>
                  <div style={{ position: 'absolute', left: 10, right: 10, bottom: 10, display: 'flex', justifyContent: 'space-between', color: '#DEE8F4', fontSize: '0.8rem' }}>
                    <span>Narrow</span><span>Broad</span>
                  </div>
                  <div style={{ position: 'absolute', left: 12, top: 34, color: '#DEE8F4', fontSize: '0.74rem' }}>Late-cycle risk</div>
                  <div style={{ position: 'absolute', right: 12, top: 34, color: '#DEE8F4', fontSize: '0.74rem', textAlign: 'right' }}>Supportive</div>
                  <div style={{ position: 'absolute', left: 12, bottom: 28, color: '#DEE8F4', fontSize: '0.74rem' }}>Fragile</div>
                  <div style={{ position: 'absolute', right: 12, bottom: 28, color: '#DEE8F4', fontSize: '0.74rem', textAlign: 'right' }}>Selective</div>

                  <div style={{ position: 'absolute', left: markerLeft, top: markerTop, transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 18, height: 18, borderRadius: 999, background: active.bucket.color, boxShadow: `0 0 0 6px ${active.bucket.color}22, 0 0 0 1px rgba(255,255,255,0.12)` }} />
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                      {chip(`Trend: ${model.regimeMatrix.trendState}`)}
                      {chip(`Vol: ${model.regimeMatrix.volState}`)}
                      {chip(`Breadth: ${model.regimeMatrix.breadthState}`)}
                      {chip(`Liquidity: ${model.regimeMatrix.liquidityState}`)}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', background: '#0D1219', padding: '0.85rem' }}>
                  <div style={{ color: '#F8FAFC', fontWeight: 800, fontSize: '1rem' }}>
                    <BilLabel ko="현재 존" en="Current Zone" variant="micro" />
                  </div>
                  <div style={{ marginTop: 6, color: active.bucket.color, fontWeight: 800, fontSize: '1.1rem' }}>
                    <BilLabel ko={model.regimeMatrix.zoneLabelKo} en={model.regimeMatrix.zoneLabelEn} variant="label" />
                  </div>
                  {(model.regimeMatrix.quadrantLabelKo || model.regimeMatrix.quadrantLabelEn) && (
                    <div style={{ marginTop: 4, color: '#D8E4F2' }}>
                      <BilLabel ko={model.regimeMatrix.quadrantLabelKo || ''} en={model.regimeMatrix.quadrantLabelEn || ''} variant="micro" />
                    </div>
                  )}
                </div>
                <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', background: '#0D1219', padding: '0.85rem', color: '#E6EEF8', lineHeight: 1.45 }}>
                  <div style={{ color: '#F8FAFC', marginBottom: 6, fontWeight: 800 }}>
                    <BilLabel ko="해석 가이드" en="Legend / Interpretation" variant="micro" />
                  </div>
                  <div className="mf-bil-ko" style={{ fontSize: '0.94rem' }}>
                    `Narrow + Tight` 조합은 구조적으로 취약해질 수 있는 구간을 의미하고, `Broad + Loose`는 구조 지지력 우위를 시사합니다.
                  </div>
                  <div className="mf-bil-en" style={{ fontSize: '0.86rem', color: '#DEE8F4', marginTop: 4 }}>
                    `Narrow + Tight` usually signals weaker market support, while `Broad + Loose` suggests stronger structural backing.
                  </div>
                  <div style={{ marginTop: 8, color: '#DEE8F4' }}>
                    <BilLabel ko="Breadth = 참여도 / Liquidity = 자금조달 스트레스" en="Breadth = participation / Liquidity = funding stress" variant="micro" />
                  </div>
                  {(model.regimeMatrix.zoneNarrativeKo || model.regimeMatrix.zoneNarrativeEn) && (
                    <div style={{ marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
                      <BilLabel ko={model.regimeMatrix.zoneNarrativeKo || ''} en={model.regimeMatrix.zoneNarrativeEn || ''} variant="micro" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Layer C */}
          <section style={{ background: '#070B10', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <div style={{ color: '#F8FAFC', fontSize: '1.35rem', fontWeight: 800, textAlign: 'center', width: '100%' }}>
              <BilLabel ko="진단 상세" en="Diagnostic Detail" variant="label" />
            </div>
            <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', background: '#0D1219', overflow: 'hidden' }}>
              <div
                className="hidden md:grid"
                style={{
                  gridTemplateColumns: 'minmax(200px, 280px) minmax(90px, 130px) minmax(92px, 120px) minmax(220px, 320px) minmax(300px, 520px)',
                  justifyContent: 'start',
                  gap: 0,
                  padding: '0.8rem 1rem',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  color: '#DEE8F4',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                }}
              >
                <div style={{ textAlign: 'center' }}><BilLabel ko="지표" en="Metric" variant="micro" /></div>
                <div style={{ textAlign: 'center' }}><BilLabel ko="값" en="Value" variant="micro" /></div>
                <div style={{ textAlign: 'center' }}><BilLabel ko="상태" en="Status" variant="micro" /></div>
                <div style={{ textAlign: 'center' }}><BilLabel ko="참고 범위" en="Reference" variant="micro" /></div>
                <div style={{ textAlign: 'center' }}><BilLabel ko="해석" en="Interpretation" variant="micro" /></div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {diagnostics.map((m, idx) => (
                  <div
                    key={m.key}
                    style={{
                      borderTop: idx ? '1px solid rgba(255,255,255,0.05)' : 'none',
                      padding: '0.85rem 1rem',
                      display: 'grid',
                      gridTemplateColumns: 'minmax(200px, 280px) minmax(90px, 130px) minmax(92px, 120px) minmax(220px, 320px) minmax(300px, 520px)',
                      justifyContent: 'start',
                      gap: 12,
                    }}
                    className="max-md:grid-cols-1"
                  >
                    <div style={{ color: '#E6EEF8' }}>
                      <div className="mf-bil-ko" style={{ fontSize: '0.92rem' }}>{m.labelKo}</div>
                      <div className="mf-bil-en" style={{ fontSize: '0.88rem', color: '#DAE5F2' }}>{m.labelEn}</div>
                    </div>
                    <div style={{ color: '#F8FAFC', fontWeight: 800, textAlign: 'center', fontSize: '0.95rem' }} className="max-md:text-left">{m.valueText}</div>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }} className="max-md:justify-start">
                      {(() => {
                        const t = statusTone(m.status)
                        return (
                          <span style={{ borderRadius: 999, border: `1px solid ${t.border}`, background: t.bg, color: t.color, padding: '0.22rem 0.5rem', fontWeight: 800, fontSize: '0.78rem' }}>
                            <BilLabel ko={t.label.ko} en={t.label.en} variant="micro" />
                          </span>
                        )
                      })()}
                    </div>
                    <div style={{ color: '#DCE6F3', lineHeight: 1.35, maxWidth: 320 }}>
                      <div className="mf-bil-ko" style={{ fontSize: '0.9rem' }}>{m.referenceKo}</div>
                      <div className="mf-bil-en" style={{ fontSize: '0.86rem', color: '#DAE5F2', marginTop: 2 }}>{m.referenceEn}</div>
                    </div>
                    <div style={{ color: '#DCE6F3', lineHeight: 1.35, maxWidth: 560 }}>
                      <div className="mf-bil-ko" style={{ fontSize: '0.92rem' }}>{m.meaningKo}</div>
                      <div className="mf-bil-en" style={{ fontSize: '0.88rem', color: '#DAE5F2', marginTop: 2 }}>{m.meaningEn}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ color: '#8FA3BD', fontSize: '0.88rem', lineHeight: 1.4 }}>
              <BilLabel ko="참고 범위는 사전 정의 임계값 또는 과거 분포 기준으로 표시됩니다." en="Reference ranges use predefined thresholds or historical distribution bands." variant="micro" />
            </div>
          </section>
        </>
      )}
    </div>
  )
}
