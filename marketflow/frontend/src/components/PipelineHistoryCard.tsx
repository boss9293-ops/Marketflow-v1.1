'use client';

import React, { useEffect, useState } from 'react';

type HistoryEntry = {
  timestamp: string;
  status: string;
  duration_sec: number;
  scripts_ok: number;
  scripts_failed: number;
};

export default function PipelineHistoryCard() {
  const [data, setData] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/pipeline-history')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then((json) => {
        if (Array.isArray(json)) {
          setData(json);
        } else {
          setData([]);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(true);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '0.875rem', background: '#11161C', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', color: '#8b949e', fontSize: '0.8rem' }}>
        Loading pipeline history...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '0.875rem', background: '#11161C', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', color: '#f87171', fontSize: '0.8rem' }}>
        Failed to load pipeline history
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div style={{ padding: '0.875rem', background: '#11161C', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', color: '#94a3b8', fontSize: '0.8rem' }}>
        No pipeline history available.
      </div>
    );
  }

  return (
    <div style={{ padding: '0.875rem', background: '#11161C', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontFamily: 'var(--font-ui-sans, sans-serif)' }}>
      <div style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.2rem' }}>Pipeline History (Last 10)</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {data.map((run, idx) => {
          const s = run.status?.toLowerCase() || 'unknown';
          let color = '#9ca3af';
          if (s === 'success' || s === 'completed') color = '#22c55e';
          if (s === 'failure' || s === 'error' || s === 'failed') color = '#ef4444';

          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.6rem', borderRadius: 6, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <span style={{ color: '#e2e8f0', fontSize: '0.75rem', fontWeight: 500 }}>{run.timestamp || 'Unknown Time'}</span>
                <span style={{ color: '#64748b', fontSize: '0.65rem' }}>{run.duration_sec != null ? `${run.duration_sec.toFixed(1)}s` : '--'} • {run.scripts_ok}/{run.scripts_ok + run.scripts_failed} OK</span>
              </div>
              <span style={{ padding: '0.125rem 0.375rem', borderRadius: 9999, fontSize: '0.6rem', fontWeight: 800, backgroundColor: `${color}15`, color, border: `1px solid ${color}30`, textTransform: 'uppercase' }}>
                {run.status || 'UNKNOWN'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
