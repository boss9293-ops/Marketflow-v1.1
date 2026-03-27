'use client';

import React, { useEffect, useState } from 'react';

type Warning = {
  code: string;
  message: string;
  scripts?: { script: string; count: number }[];
};

type Trends = {
  duration_trend: string;
  failure_trend: string;
  success_streak: number;
  failure_streak: number;
};

type Anomaly = {
  type: string;
  detail?: string;
  scripts?: { script: string; count: number }[];
};

type ApiResponse = {
  state: string;
  trends: Trends;
  anomalies: Anomaly[];
  warnings: Warning[];
  reason?: string;
};

const STATE_COLORS: Record<string, string> = {
  stable:   '#22c55e',
  warning:  '#f59e0b',
  critical: '#ef4444',
  unknown:  '#64748b',
};

const TREND_ICON: Record<string, string> = {
  up:        '↑',
  down:      '↓',
  stable:    '→',
  improving: '↑',
  worsening: '↓',
  unknown:   '—',
};

const TREND_COLOR: Record<string, string> = {
  up:        '#f59e0b',
  down:      '#22c55e',
  stable:    '#64748b',
  improving: '#22c55e',
  worsening: '#ef4444',
  unknown:   '#64748b',
};

function TrendPill({ label, value }: { label: string; value: string }) {
  const icon  = TREND_ICON[value]  ?? '—';
  const color = TREND_COLOR[value] ?? '#64748b';
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '0.35rem 0.55rem', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ color: '#64748b', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      <span style={{ color, fontSize: '0.78rem', fontWeight: 700 }}>{icon} {value}</span>
    </div>
  );
}

export default function PipelineIntelligenceCard() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/pipeline-intelligence')
      .then((r) => { if (!r.ok) throw new Error('failed'); return r.json(); })
      .then((j) => { setData(j); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const cardStyle: React.CSSProperties = {
    padding: '0.875rem',
    background: '#11161C',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.07)',
    fontFamily: 'var(--font-ui-sans, sans-serif)',
  };

  if (loading) return <div style={{ ...cardStyle, color: '#8b949e', fontSize: '0.8rem' }}>Loading pipeline intelligence...</div>;
  if (error || !data) return <div style={{ ...cardStyle, color: '#f87171', fontSize: '0.8rem' }}>Failed to load pipeline intelligence</div>;

  const stateColor = STATE_COLORS[data.state] ?? '#64748b';
  const isUnknown  = data.state === 'unknown';

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <span style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '0.85rem' }}>Pipeline Intelligence</span>
        <span style={{
          padding: '0.125rem 0.5rem',
          borderRadius: 9999,
          fontSize: '0.65rem',
          fontWeight: 800,
          backgroundColor: `${stateColor}20`,
          color: stateColor,
          border: `1px solid ${stateColor}40`,
          textTransform: 'uppercase',
        }}>
          {data.state}
        </span>
      </div>

      {/* Unknown / insufficient data */}
      {isUnknown && (
        <div style={{ color: '#64748b', fontSize: '0.78rem', fontStyle: 'italic' }}>
          {data.reason ?? 'Insufficient history for analysis.'}
        </div>
      )}

      {!isUnknown && (
        <>
          {/* Trend pills */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem', marginBottom: '0.75rem' }}>
            <TrendPill label="Duration"  value={data.trends.duration_trend} />
            <TrendPill label="Failures"  value={data.trends.failure_trend} />
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '0.35rem 0.55rem' }}>
              <div style={{ color: '#64748b', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Success Streak</div>
              <div style={{ color: data.trends.success_streak > 0 ? '#22c55e' : '#64748b', fontWeight: 700, fontSize: '0.78rem' }}>
                {data.trends.success_streak > 0 ? `${data.trends.success_streak} run${data.trends.success_streak > 1 ? 's' : ''}` : '—'}
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '0.35rem 0.55rem' }}>
              <div style={{ color: '#64748b', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Failure Streak</div>
              <div style={{ color: data.trends.failure_streak > 0 ? '#ef4444' : '#64748b', fontWeight: 700, fontSize: '0.78rem' }}>
                {data.trends.failure_streak > 0 ? `${data.trends.failure_streak} run${data.trends.failure_streak > 1 ? 's' : ''}` : '—'}
              </div>
            </div>
          </div>

          {/* Warnings */}
          {data.warnings.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {data.warnings.map((w, i) => {
                const wcolor = w.code === 'recurring_failures' ? '#f97316'
                             : w.code === 'slowdown_trend'     ? '#f59e0b'
                             : '#ef4444';
                return (
                  <div key={i} style={{
                    background: `${wcolor}0d`,
                    border: `1px solid ${wcolor}30`,
                    borderRadius: 7,
                    padding: '0.35rem 0.5rem',
                    display: 'flex',
                    gap: '0.4rem',
                    alignItems: 'flex-start',
                  }}>
                    <span style={{ color: wcolor, flexShrink: 0, marginTop: 1 }}>⚠</span>
                    <span style={{ color: '#cbd5e1', fontSize: '0.73rem' }}>{w.message}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Stable with no warnings */}
          {data.state === 'stable' && data.warnings.length === 0 && (
            <div style={{ color: '#22c55e', fontSize: '0.78rem' }}>✓ No anomalies detected in recent runs.</div>
          )}
        </>
      )}
    </div>
  );
}
