'use client';

import React, { useEffect, useState } from 'react';

// ── types ──────────────────────────────────────────────────────────────────────

type RiskLabel    = 'low' | 'watch' | 'elevated' | 'high';
type PredictedMode = 'stable' | 'fragile' | 'degrading' | 'at_risk';

interface RiskFactor {
  signal:      string;
  description: string;
  points:      number;
}

interface PredictiveResponse {
  ok:                  boolean;
  failure_risk_score:  number;
  failure_risk_label:  RiskLabel;
  predicted_mode:      PredictedMode;
  top_risk_factors:    RiskFactor[];
  inputs: {
    history_runs?:        number;
    audit_entries?:       number;
    episode_count?:       number;
    ops_mode_enabled?:    boolean;
    history_window?:      number;
    episode_window_days?: number;
  };
  error?: string;
}

// ── config ─────────────────────────────────────────────────────────────────────

const LABEL_COLOR: Record<RiskLabel, string> = {
  high:     '#ef4444',
  elevated: '#f59e0b',
  watch:    '#6366f1',
  low:      '#22c55e',
};

const LABEL_TEXT: Record<RiskLabel, string> = {
  high:     'HIGH',
  elevated: 'ELEVATED',
  watch:    'WATCH',
  low:      'LOW',
};

const MODE_ICON: Record<PredictedMode, string> = {
  at_risk:   '⚠',
  degrading: '↘',
  fragile:   '◎',
  stable:    '●',
};

const MODE_COLOR: Record<PredictedMode, string> = {
  at_risk:   '#ef4444',
  degrading: '#f59e0b',
  fragile:   '#6366f1',
  stable:    '#22c55e',
};

const MODE_LABEL: Record<PredictedMode, string> = {
  at_risk:   'At Risk',
  degrading: 'Degrading',
  fragile:   'Fragile',
  stable:    'Stable',
};

const SIGNAL_LABEL: Record<string, string> = {
  recent_failure_rate:  'Failure Rate',
  failure_streak:       'Failure Streak',
  active_episode:       'Active Incident',
  recent_episode:       'Recent Incident',
  recurring_root_cause: 'Recurring Pattern',
  retry_failure_rate:   'Retry Recovery',
  duration_anomaly:     'Duration Spike',
  manual_attention:     'Manual Attention',
  maintenance_mode:     'Maintenance Mode',
};

// ── sub-components ─────────────────────────────────────────────────────────────

function ScoreArc({ score, color }: { score: number; color: string }) {
  // Simple horizontal bar gauge
  const pct = Math.min(100, Math.max(0, score));
  return (
    <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: '0.3rem', marginBottom: '0.4rem',
      }}>
        <span style={{
          fontSize: '2rem', fontWeight: 800, lineHeight: 1,
          color, fontVariantNumeric: 'tabular-nums',
        }}>
          {score}
        </span>
        <span style={{ color: '#475569', fontSize: '0.75rem' }}>/100</span>
      </div>
      <div style={{
        height: 5, borderRadius: 9999, background: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          borderRadius: 9999,
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );
}

function FactorRow({ factor, maxPts }: { factor: RiskFactor; maxPts: number }) {
  const barWidth = maxPts > 0 ? (factor.points / maxPts) * 100 : 0;
  return (
    <div style={{ marginBottom: '0.45rem' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '0.15rem',
      }}>
        <span style={{ color: '#94a3b8', fontSize: '0.67rem', fontWeight: 600 }}>
          {SIGNAL_LABEL[factor.signal] ?? factor.signal}
        </span>
        <span style={{ color: '#475569', fontSize: '0.62rem' }}>+{factor.points}pts</span>
      </div>
      <div style={{
        height: 3, borderRadius: 9999, background: 'rgba(255,255,255,0.05)',
        marginBottom: '0.15rem',
      }}>
        <div style={{
          height: '100%', width: `${barWidth}%`,
          background: 'rgba(148,163,184,0.4)', borderRadius: 9999,
        }} />
      </div>
      <div style={{ color: '#475569', fontSize: '0.63rem', fontStyle: 'italic' }}>
        {factor.description}
      </div>
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────────

export default function PipelinePredictiveCard() {
  const [data, setData]       = useState<PredictiveResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/pipeline-predictive')
      .then((r) => r.json())
      .then((j: PredictiveResponse) => { setData(j); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const card: React.CSSProperties = {
    padding:      '0.875rem',
    background:   '#11161C',
    borderRadius: 12,
    border:       (() => {
      if (!data?.ok) return '1px solid rgba(255,255,255,0.07)';
      const c = LABEL_COLOR[data.failure_risk_label];
      if (data.failure_risk_label === 'low') return '1px solid rgba(255,255,255,0.07)';
      return `1px solid ${c}28`;
    })(),
    fontFamily: 'var(--font-ui-sans, sans-serif)',
  };

  if (loading) {
    return (
      <div style={{ ...card, color: '#8b949e', fontSize: '0.8rem' }}>
        Calculating risk score…
      </div>
    );
  }

  if (!data || !data.ok) {
    return (
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
          <span style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '0.85rem' }}>Predictive Risk</span>
        </div>
        <div style={{ color: '#475569', fontSize: '0.7rem' }}>{data?.error ?? 'No data available.'}</div>
      </div>
    );
  }

  const { failure_risk_score, failure_risk_label, predicted_mode, top_risk_factors } = data;
  const labelColor = LABEL_COLOR[failure_risk_label];
  const modeColor  = MODE_COLOR[predicted_mode];
  const maxPts     = top_risk_factors[0]?.points ?? 1;

  return (
    <div style={card}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '0.75rem',
      }}>
        <span style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '0.85rem' }}>
          Predictive Risk
        </span>
        {/* Risk label badge */}
        <span style={{
          display: 'inline-flex', alignItems: 'center',
          padding: '0.1rem 0.4rem', borderRadius: 9999,
          fontSize: '0.6rem', fontWeight: 700,
          background: `${labelColor}1a`, color: labelColor,
          border: `1px solid ${labelColor}35`,
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          {LABEL_TEXT[failure_risk_label]}
        </span>
      </div>

      {/* Score + mode row */}
      <div style={{ display: 'flex', gap: '1.2rem', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        {/* Score gauge */}
        <div style={{ flex: 1 }}>
          <ScoreArc score={failure_risk_score} color={labelColor} />
        </div>

        {/* Predicted mode */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
          justifyContent: 'flex-start', paddingTop: '0.1rem',
        }}>
          <div style={{ color: '#475569', fontSize: '0.6rem', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.2rem',
          }}>
            Mode
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
            color: modeColor, fontSize: '0.75rem', fontWeight: 700,
          }}>
            <span style={{ fontSize: '0.8rem' }}>{MODE_ICON[predicted_mode]}</span>
            {MODE_LABEL[predicted_mode]}
          </div>
        </div>
      </div>

      {/* Top risk factors */}
      {top_risk_factors.length > 0 ? (
        <div>
          <div style={{
            color: '#64748b', fontSize: '0.63rem', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.04em',
            marginBottom: '0.45rem',
          }}>
            Top Risk Factors
          </div>
          {top_risk_factors.map((f) => (
            <FactorRow key={f.signal} factor={f} maxPts={maxPts} />
          ))}
        </div>
      ) : (
        <div style={{ color: '#334155', fontSize: '0.68rem' }}>
          No risk signals detected.
        </div>
      )}

      {/* Data footer */}
      <div style={{
        marginTop: '0.65rem', paddingTop: '0.45rem',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        display: 'flex', gap: '0.75rem', flexWrap: 'wrap',
      }}>
        {[
          [`${data.inputs.history_runs ?? 0}`, 'runs'],
          [`${data.inputs.episode_count ?? 0}`, 'episodes'],
          [`${data.inputs.audit_entries ?? 0}`, 'audits'],
        ].map(([val, label]) => (
          <span key={label} style={{ color: '#334155', fontSize: '0.6rem' }}>
            <span style={{ color: '#475569', fontVariantNumeric: 'tabular-nums' }}>{val}</span>
            {' '}{label}
          </span>
        ))}
      </div>
    </div>
  );
}
