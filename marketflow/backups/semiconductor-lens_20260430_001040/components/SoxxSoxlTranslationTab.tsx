'use client'
import React, { useEffect, useState } from 'react'

type InterpretationOutput = {
  summary:        string
  alignment:      string
  support:        string[]
  weakness:       string[]
  interpretation: string
  context?:       string
  confidence:     string
}

type AIRegimeLabel = 'AI_LED_BROAD' | 'AI_LED_NARROW' | 'ROTATING' | 'BROAD_RECOVERY' | 'CONTRACTION'

type TranslationData = {
  base:      InterpretationOutput
  summary:   string
  soxl_note: string
  delta: {
    amplification: 'low' | 'medium' | 'high'
    sensitivity:   string[]
    constraint:    string
    explanation:   string
  }
  watch:      string[]
  ai_regime?: { regime_label: AIRegimeLabel; regime_confidence: string; data_mode: string }
  _meta?: { as_of: string; state: string; conflict: string; engine_score: number }
}

// ?? Sub-component: compact interpretation card ????????????????????????????????

function InterpCard({
  label, sub, data, note,
}: {
  label: string
  sub:   string
  data:  InterpretationOutput | null
  note?: string
}) {
  return (
    <div className="bg-[#060a10] border border-slate-800 rounded-sm p-3 flex flex-col gap-2 min-w-0">
      <div className="flex items-baseline gap-2 border-b border-slate-800 pb-2">
        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">{label}</span>
        <span className="text-[11px] text-slate-400">{sub}</span>
      </div>

      {!data ? (
        <p className="text-[11px] text-slate-400 italic">Loading…</p>
      ) : (
        <div className="flex flex-col gap-2">

          {/* Summary */}
          <p className="text-[12px] text-slate-200 leading-snug font-medium">{data.summary}</p>

          {/* Alignment */}
          <p className="text-[11px] text-slate-400 leading-snug">{data.alignment}</p>

          {/* Support / Weakness */}
          <div className="grid grid-cols-2 gap-x-2">
            <div>
              <div className="text-[11px] text-emerald-400 uppercase tracking-widest mb-0.5">Supporting</div>
              {data.support.length > 0
                ? data.support.map((s, i) => (
                    <div key={i} className="text-[11px] text-emerald-400 leading-snug">쨌 {s}</div>
                  ))
                : <div className="text-[11px] text-slate-400 italic">None identified</div>
              }
            </div>
            <div>
              <div className="text-[11px] text-red-400 uppercase tracking-widest mb-0.5">Weakening</div>
              {data.weakness.length > 0
                ? data.weakness.map((w, i) => (
                    <div key={i} className="text-[11px] text-red-400 leading-snug">쨌 {w}</div>
                  ))
                : <div className="text-[11px] text-slate-500 italic">No major constraints detected</div>
              }
            </div>
          </div>

          {/* Interpretation */}
          <p className="text-[11px] text-slate-300 leading-snug border-t border-slate-800/60 pt-2">
            {data.interpretation}
          </p>

          {/* SOXL-specific note */}
          {note && (
            <p className="text-[11px] text-blue-400/70 italic leading-snug border-t border-slate-800/40 pt-1.5">
              {note}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ?? Main component ????????????????????????????????????????????????????????????

export default function SoxxSoxlTranslationTab() {
  const [data, setData] = useState<TranslationData | null>(null)
  const [err,  setErr]  = useState(false)

  useEffect(() => {
    fetch('/api/translation')
      .then(r => r.ok ? r.json() : null)
      .then(d => d ? setData(d) : setErr(true))
      .catch(() => setErr(true))
  }, [])

  const ampColor = (a: TranslationData['delta']['amplification'] | undefined) =>
    a === 'low'    ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' :
    a === 'medium' ? 'text-yellow-400  border-yellow-500/40  bg-yellow-500/10'  :
    a === 'high'   ? 'text-red-400     border-red-500/40     bg-red-500/10'      :
                     'text-slate-400   border-slate-600       bg-slate-800/30'

  return (
    <div className="flex flex-col gap-3 px-4 py-3 bg-[#020408] flex-1 overflow-y-auto pb-20">

      {err && (
        <div className="border border-red-500/30 bg-red-500/5 rounded-sm px-3 py-2 text-[11px] text-red-400">
          Translation data unavailable ??engine error or no data.
        </div>
      )}

      {/* ?? Block 1: Translation Summary ????????????????????????????????????? */}
      <div className="bg-[#060a10] border border-slate-800 rounded-sm px-4 py-3">
        <div className="text-[11px] text-slate-400 uppercase tracking-widest mb-1.5">
          ??Translation Summary
        </div>
        <p className="text-[13px] font-medium text-slate-200 leading-snug">
          {data?.summary ?? 'Loading translation summary…'}
        </p>
        {data?._meta && (
          <div className="mt-1.5 text-[11px] text-slate-400 font-mono">
            As of {data._meta.as_of} 쨌 Engine {data._meta.engine_score} 쨌 {data._meta.state} 쨌 {data._meta.conflict}
          </div>
        )}
      </div>

      {/* ?? Blocks 2 + 3: SOXX Base | SOXL Translation ??????????????????????? */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <InterpCard
          label="SOXX"
          sub="Base Semiconductor Structure"
          data={data?.base ?? null}
        />
        <InterpCard
          label="SOXL"
          sub="Leveraged Translation"
          data={data?.base ?? null}
          note={data?.soxl_note}
        />
      </div>

      {/* ?? Block 4: Structural Delta ????????????????????????????????????????? */}
      <div className="bg-[#060a10] border border-slate-800 rounded-sm px-4 py-3">
        <div className="text-[11px] text-slate-400 uppercase tracking-widest mb-2" title="How SOXX structural conditions translate into SOXL amplification sensitivity.">
          ??Structural Delta
        </div>
        {!data ? (
          <p className="text-[11px] text-slate-400 italic">Loading…</p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-start gap-0.5">
                <span className="text-[11px] text-slate-400 uppercase tracking-widest" title="Measures how strongly SOXL amplifies the base SOXX structural conditions.">Amplification</span>
                <span className={`text-[12px] font-bold px-2 py-0.5 border rounded-sm uppercase ${ampColor(data.delta.amplification)}`}>
                  {data.delta.amplification}
                </span>
              </div>
              {data.delta.sensitivity.length > 0 && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-slate-400 uppercase tracking-widest">Sensitivity Factors</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {data.delta.sensitivity.map((s, i) => (
                      <span key={i} className="text-[11px] text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded-sm bg-slate-800/30 uppercase">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-300 leading-snug border-t border-slate-800/60 pt-2">
              {data.delta.explanation}
            </p>
            <p className="text-[11px] text-slate-500 leading-snug">{data.delta.constraint}</p>
          </div>
        )}
      </div>

      {/* ?? Block 5: SOXL Sensitivity by AI Regime ??????????????????????????? */}
      {(() => {
        const SENS_MAP: Record<AIRegimeLabel, { level: string; reason: string }> = {
          AI_LED_BROAD:   { level: 'Low?밠edium', reason: 'AI leadership is broadly supported.' },
          AI_LED_NARROW:  { level: 'High',       reason: 'AI leadership is narrow.' },
          ROTATING:       { level: 'Medium',     reason: 'Capital rotation is uneven across semiconductor buckets.' },
          BROAD_RECOVERY: { level: 'Medium',     reason: 'Recovery structure is developing across segments.' },
          CONTRACTION:    { level: 'High',       reason: 'Broad structural weakness is confirmed across segments.' },
        }
        const fallback = { level: 'Medium', reason: 'Data is not sufficient for a precise sensitivity assessment.' }
        const label = data?.ai_regime?.regime_label
        const { level, reason } = (label ? SENS_MAP[label] : null) ?? fallback
        const levelColor =
          level === 'High'       ? 'text-red-400 border-red-500/40 bg-red-500/10'         :
          level === 'Low?밠edium' ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' :
                                   'text-yellow-400 border-yellow-500/40 bg-yellow-500/10'
        return (
          <div className="bg-[#060a10] border border-slate-800 rounded-sm px-4 py-3">
            <div className="text-[11px] text-slate-400 uppercase tracking-widest mb-2">
              ??SOXL Sensitivity
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-[12px] font-bold px-2 py-0.5 border rounded-sm uppercase ${levelColor}`}>
                {level}
              </span>
              <p className="text-[11px] text-slate-400 leading-snug">{reason}</p>
            </div>
          </div>
        )
      })()}

      {/* ?? Block 6: Watch Conditions ????????????????????????????????????????? */}
      <div className="bg-[#060a10] border border-slate-800 rounded-sm px-4 py-3">
        <div className="text-[11px] text-slate-400 uppercase tracking-widest mb-2">
          ??Structural Watch Conditions
        </div>
        {!data ? (
          <p className="text-[11px] text-slate-400 italic">Loading…</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {data.watch.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px] text-slate-400 leading-snug">
                <span className="text-slate-500 shrink-0 mt-0.5">→</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ?? Block 7: Data Source ?????????????????????????????????????????????? */}
      <div className="border border-slate-800/50 bg-slate-900/20 rounded-sm px-4 py-2.5 flex flex-wrap items-start gap-2">
        <span className="text-[11px] text-slate-400 uppercase tracking-widest shrink-0 pt-0.5">??Data Source</span>
        <p className="text-[11px] text-slate-500 leading-snug flex-1 min-w-0">
          Translation data uses the current engine snapshot. SOXL-specific translation is derived from SOXX structure when separate SOXL engine data is unavailable.
        </p>
      </div>

    </div>
  )
}
