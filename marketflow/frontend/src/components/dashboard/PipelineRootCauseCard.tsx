'use client';

import React, { useEffect, useState } from 'react';

type RootCause =
  | 'timeout'
  | 'missing_input'
  | 'malformed_json'
  | 'dependency_failure'
  | 'script_exception'
  | 'unknown';

type TopCause = { cause: RootCause; count: number };
type BreakdownRow = { script: string; cause: RootCause; count: number };

type ApiResponse = {
  ok: boolean;
  total_failures_analyzed: number;
  latest_root_cause: RootCause | null;
  top_root_causes: TopCause[];
  script_cause_breakdown: BreakdownRow[];
  recurring_cause: RootCause | null;
  retry_events_supplemental: number;
};

// ── display config ────────────────────────────────────────────────────────────

const CAUSE_CONFIG: Record<RootCause, { label: string; color: string; icon: string; desc: string }> = {
  timeout:            { label: 'Timeout',            color: '#f59e0b', icon: '⏱', desc: 'Script exceeded time limit' },
  missing_input:      { label: 'Missing Input',      color: '#6366f1', icon: '⬜', desc: 'Input file or data absent at start' },
  malformed_json:     { label: 'Malformed JSON',     color: '#ec4899', icon: '{}', desc: 'JSON parse or write error' },
  dependency_failure: { label: 'Dependency Failure', color: '#f97316', icon: '⛓', desc: 'Earlier script in run failed' },
  script_exception:   { label: 'Script Exception',   color: '#ef4444', icon: '✕', desc: 'Unhandled exception in script' },
  unknown:            { label: 'Unknown',             color: '#64748b', icon: '—', desc: 'No per-script detail available' },
};

function CauseBadge({ cause, size = 'md' }: { cause: RootCause; size?: 'sm' | 'md' }) {
  const cfg = CAUSE_CONFIG[cause] ?? CAUSE_CONFIG.unknown;
  const fs = size === 'sm' ? '0.58rem' : '0.62rem';
  const px = size === 'sm' ? '0.2rem 0.35rem' : '0.15rem 0.45rem';
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.22rem',
      padding: px,
      borderRadius: 9999,
      fontSize: fs,
      fontWeight: 700,
      backgroundColor: `${cfg.color}1a`,
      color: cfg.color,
      border: `1px solid ${cfg.color}35`,
      textTransform: 'uppercase',
      letterSpacing: '0.03em',
      flexShrink: 0,
    }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
    </div>
  );
}

export default function PipelineRootCauseCard() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/pipeline-root-causes')
      .then((r) => { if (!r.ok) throw new Error('failed'); return r.json(); })
      .then((j) => { setData(j); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const card: React.CSSProperties = {
    padding: '0.875rem',
    background: '#11161C',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.07)',
    fontFamily: 'var(--font-ui-sans, sans-serif)',
  };

  if (loading) return <div style={{ ...card, color: '#8b949e', fontSize: '0.8rem' }}>Loading root cause analysis...</div>;
  if (error || !data) return <div style={{ ...card, color: '#f87171', fontSize: '0.8rem' }}>Failed to load root cause analysis</div>;

  const topMax = data.top_root_causes[0]?.count ?? 1;

  return (
    <div style={card}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <span style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '0.85rem' }}>Root Cause Analysis</span>
        {data.total_failures_analyzed > 0 && (
          <span style={{ color: '#64748b', fontSize: '0.65rem' }}>
            {data.total_failures_analyzed} failure{data.total_failures_analyzed !== 1 ? 's' : ''} analyzed
          </span>
        )}
      </div>

      {/* No failures */}
      {data.total_failures_analyzed === 0 && (
        <div style={{ color: '#22c55e', fontSize: '0.78rem' }}>
          ✓ No failures detected in recent history.
        </div>
      )}

      {data.total_failures_analyzed > 0 && (
        <>
          {/* Latest Root Cause */}
          {data.latest_root_cause && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.3rem' }}>
                Latest Root Cause
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CauseBadge cause={data.latest_root_cause} />
                <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>
                  {CAUSE_CONFIG[data.latest_root_cause]?.desc}
                </span>
              </div>
            </div>
          )}

          {/* Top Failure Causes */}
          {data.top_root_causes.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>
                Top Failure Causes
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {data.top_root_causes.slice(0, 5).map((row) => {
                  const cfg = CAUSE_CONFIG[row.cause] ?? CAUSE_CONFIG.unknown;
                  return (
                    <div key={row.cause} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CauseBadge cause={row.cause} size="sm" />
                      <Bar pct={(row.count / topMax) * 100} color={cfg.color} />
                      <span style={{ color: '#64748b', fontSize: '0.65rem', flexShrink: 0, minWidth: 18, textAlign: 'right' }}>
                        {row.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Script-Cause Breakdown */}
          {data.script_cause_breakdown.length > 0 && (
            <div style={{ marginBottom: data.recurring_cause ? '0.75rem' : 0 }}>
              <div style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>
                Script Breakdown
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.22rem' }}>
                {data.script_cause_breakdown.slice(0, 6).map((row) => (
                  <div key={row.script} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.18rem 0' }}>
                    <CauseBadge cause={row.cause} size="sm" />
                    <span style={{ color: '#cbd5e1', fontSize: '0.72rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.script}
                    </span>
                    <span style={{ color: '#475569', fontSize: '0.65rem', flexShrink: 0 }}>
                      ×{row.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recurring Pattern */}
          {data.recurring_cause && (
            <div style={{
              marginTop: '0.1rem',
              background: `${CAUSE_CONFIG[data.recurring_cause]?.color ?? '#64748b'}12`,
              border: `1px solid ${CAUSE_CONFIG[data.recurring_cause]?.color ?? '#64748b'}28`,
              borderRadius: 6,
              padding: '0.35rem 0.55rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}>
              <span style={{ fontSize: '0.7rem' }}>↻</span>
              <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>
                Recurring pattern:{' '}
                <strong style={{ color: CAUSE_CONFIG[data.recurring_cause]?.color ?? '#64748b' }}>
                  {CAUSE_CONFIG[data.recurring_cause]?.label}
                </strong>
                {' '}detected across consecutive failure runs.
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
