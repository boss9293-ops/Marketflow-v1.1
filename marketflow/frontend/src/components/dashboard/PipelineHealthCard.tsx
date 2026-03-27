'use client';

import React, { useEffect, useState } from 'react';

type QualityCheck = {
  level: string;
  message: string;
};

type Metrics = {
  total_runs: number;
  success_runs: number;
  failure_runs: number;
  failure_rate_pct: number;
  last_failure_ts: string | null;
  avg_duration_sec: number;
  latest_duration_sec: number;
  health_score: number;
  health_label: string;
};

type ApiResponse = {
  metrics: Metrics;
  quality_checks: QualityCheck[];
};

function scoreColor(score: number): string {
  if (score >= 90) return '#22c55e';
  if (score >= 75) return '#f59e0b';
  if (score >= 50) return '#f97316';
  return '#ef4444';
}

function checkColor(level: string): string {
  if (level === 'critical') return '#ef4444';
  if (level === 'warning') return '#f59e0b';
  return '#9ca3af';
}

export default function PipelineHealthCard() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/pipeline-metrics')
      .then((res) => {
        if (!res.ok) throw new Error('failed');
        return res.json();
      })
      .then((json) => { setData(json); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const cardStyle: React.CSSProperties = {
    padding: '0.875rem',
    background: '#11161C',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.07)',
    fontFamily: 'var(--font-ui-sans, sans-serif)',
  };

  if (loading) {
    return <div style={{ ...cardStyle, color: '#8b949e', fontSize: '0.8rem' }}>Loading pipeline health...</div>;
  }

  if (error || !data) {
    return <div style={{ ...cardStyle, color: '#f87171', fontSize: '0.8rem' }}>Failed to load pipeline health</div>;
  }

  const m = data.metrics;
  const color = scoreColor(m.health_score);

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <span style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '0.85rem' }}>Pipeline Health</span>
        <span style={{
          padding: '0.125rem 0.5rem',
          borderRadius: 9999,
          fontSize: '0.65rem',
          fontWeight: 800,
          backgroundColor: `${color}20`,
          color,
          border: `1px solid ${color}40`,
          textTransform: 'uppercase',
        }}>
          {m.health_label}
        </span>
      </div>

      {/* Score bar */}
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
          <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>Health Score</span>
          <span style={{ color, fontWeight: 700, fontSize: '0.85rem' }}>{m.health_score}</span>
        </div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${m.health_score}%`, background: color, borderRadius: 4, transition: 'width 0.4s ease' }} />
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: data.quality_checks.length > 0 ? '0.75rem' : 0 }}>
        {[
          { label: 'Runs Analyzed', value: String(m.total_runs) },
          { label: 'Failure Rate', value: `${m.failure_rate_pct}%` },
          { label: 'Avg Duration', value: `${m.avg_duration_sec}s` },
          { label: 'Latest Duration', value: `${m.latest_duration_sec}s` },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '0.4rem 0.6rem' }}>
            <div style={{ color: '#64748b', fontSize: '0.65rem', marginBottom: '0.1rem' }}>{label}</div>
            <div style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '0.82rem' }}>{value}</div>
          </div>
        ))}
      </div>

      {m.last_failure_ts && (
        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: data.quality_checks.length > 0 ? '0.5rem' : 0 }}>
          Last failure: <span style={{ color: '#f87171' }}>{m.last_failure_ts}</span>
        </div>
      )}

      {/* Quality checks */}
      {data.quality_checks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {data.quality_checks.map((q, i) => (
            <div key={i} style={{ fontSize: '0.72rem', color: checkColor(q.level), display: 'flex', gap: '0.35rem', alignItems: 'flex-start' }}>
              <span style={{ marginTop: 1 }}>⚠</span>
              <span>{q.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
