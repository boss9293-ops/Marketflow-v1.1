'use client';

import React, { useEffect, useState } from 'react';

type ScriptDetail = {
  script: string;
  fail_count: number;
  consecutive: boolean;
  category: 'transient' | 'structural' | 'critical' | 'critical_historical';
};

type ApiResponse = {
  recovery_state: string;
  retry_candidates: string[];
  manual_attention: string[];
  suggested_actions: string[];
  script_detail: ScriptDetail[];
  reason?: string;
};

type RetryData = {
  retry_attempted: boolean;
  retry_recovered_count: number;
  retry_failed_count: number;
  retried_scripts: string[];
};

const STATE_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
  stable:           { color: '#22c55e', label: 'Stable',           icon: '✓' },
  watch:            { color: '#64748b', label: 'Watch',            icon: '◎' },
  retryable:        { color: '#3b82f6', label: 'Retryable',        icon: '↺' },
  degraded:         { color: '#f59e0b', label: 'Degraded',         icon: '⚠' },
  manual_attention: { color: '#ef4444', label: 'Manual Attention', icon: '✕' },
  unknown:          { color: '#64748b', label: 'Unknown',          icon: '—' },
};

const CATEGORY_COLOR: Record<string, string> = {
  transient:          '#3b82f6',
  structural:         '#f59e0b',
  critical:           '#ef4444',
  critical_historical:'#ef4444',
};

const CATEGORY_LABEL: Record<string, string> = {
  transient:          'Transient',
  structural:         'Structural',
  critical:           'Critical',
  critical_historical:'Critical (hist.)',
};

function ScriptRow({ detail }: { detail: ScriptDetail }) {
  const color = CATEGORY_COLOR[detail.category] ?? '#64748b';
  const label = CATEGORY_LABEL[detail.category] ?? detail.category;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0' }}>
      <span style={{
        background: `${color}18`,
        border: `1px solid ${color}40`,
        borderRadius: 5,
        color,
        fontSize: '0.62rem',
        fontWeight: 700,
        padding: '0.1rem 0.35rem',
        flexShrink: 0,
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
      }}>{label}</span>
      <span style={{ color: '#cbd5e1', fontSize: '0.73rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {detail.script}
      </span>
      <span style={{ color: '#64748b', fontSize: '0.68rem', flexShrink: 0 }}>
        ×{detail.fail_count}{detail.consecutive ? ' · consec' : ''}
      </span>
    </div>
  );
}

export default function PipelineRecoveryCard() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState<RetryData | null>(null);

  useEffect(() => {
    fetch('/api/pipeline-recovery')
      .then((r) => { if (!r.ok) throw new Error('failed'); return r.json(); })
      .then((j) => { setData(j); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  useEffect(() => {
    fetch('/api/pipeline-retry-summary')
      .then((r) => r.ok ? r.json() : null)
      .then((j: RetryData | null) => { if (j?.retry_attempted) setRetry(j); })
      .catch(() => {});
  }, []);

  const cardStyle: React.CSSProperties = {
    padding: '0.875rem',
    background: '#11161C',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.07)',
    fontFamily: 'var(--font-ui-sans, sans-serif)',
  };

  if (loading) return <div style={{ ...cardStyle, color: '#8b949e', fontSize: '0.8rem' }}>Loading recovery analysis...</div>;
  if (error || !data) return <div style={{ ...cardStyle, color: '#f87171', fontSize: '0.8rem' }}>Failed to load recovery analysis</div>;

  const cfg       = STATE_CONFIG[data.recovery_state] ?? STATE_CONFIG.unknown;
  const isUnknown = data.recovery_state === 'unknown';
  const isStable  = data.recovery_state === 'stable';

  const actionColor = (a: string) =>
    a.startsWith('CRITICAL') ? '#ef4444'
    : a.startsWith('Transient') || a.startsWith('Retry') ? '#3b82f6'
    : '#94a3b8';

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <span style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '0.85rem' }}>Self-Healing Recovery</span>
        <span style={{
          padding: '0.125rem 0.5rem',
          borderRadius: 9999,
          fontSize: '0.65rem',
          fontWeight: 800,
          backgroundColor: `${cfg.color}20`,
          color: cfg.color,
          border: `1px solid ${cfg.color}40`,
          textTransform: 'uppercase',
        }}>
          {cfg.icon} {cfg.label}
        </span>
        {retry && (
          <span style={{
            padding: '0.125rem 0.4rem',
            borderRadius: 9999,
            fontSize: '0.62rem',
            fontWeight: 700,
            backgroundColor: retry.retry_recovered_count > 0 ? '#22c55e20' : '#f59e0b20',
            color: retry.retry_recovered_count > 0 ? '#22c55e' : '#f59e0b',
            border: `1px solid ${retry.retry_recovered_count > 0 ? '#22c55e40' : '#f59e0b40'}`,
          }}>
            {retry.retry_recovered_count > 0
              ? `↺ +${retry.retry_recovered_count} recovered`
              : `↺ ${retry.retry_failed_count} retry failed`}
          </span>
        )}
      </div>

      {/* Unknown */}
      {isUnknown && (
        <div style={{ color: '#64748b', fontSize: '0.78rem', fontStyle: 'italic' }}>
          {data.reason ?? 'Insufficient history for recovery analysis.'}
        </div>
      )}

      {/* Stable */}
      {isStable && !isUnknown && (
        <div style={{ color: '#22c55e', fontSize: '0.78rem' }}>✓ Pipeline is stable. No recovery action needed.</div>
      )}

      {/* Active state content */}
      {!isUnknown && !isStable && (
        <>
          {/* Script detail list */}
          {data.script_detail.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>
                Script Analysis
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {data.script_detail.slice(0, 8).map((d) => (
                  <ScriptRow key={d.script} detail={d} />
                ))}
              </div>
            </div>
          )}

          {/* Suggested Actions */}
          {data.suggested_actions.length > 0 && (
            <div>
              <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>
                Suggested Actions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {data.suggested_actions.map((action, i) => {
                  const isCritical = action.startsWith('CRITICAL');
                  const acolor = actionColor(action);
                  return (
                    <div key={i} style={{
                      background: `${acolor}0d`,
                      border: `1px solid ${acolor}28`,
                      borderRadius: 6,
                      padding: '0.3rem 0.5rem',
                      display: 'flex',
                      gap: '0.35rem',
                      alignItems: 'flex-start',
                    }}>
                      {isCritical && <span style={{ color: acolor, flexShrink: 0, marginTop: 1 }}>!</span>}
                      <span style={{ color: '#cbd5e1', fontSize: '0.73rem' }}>{action}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
