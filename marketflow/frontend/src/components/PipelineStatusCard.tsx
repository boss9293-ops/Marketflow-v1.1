'use client';

import React, { useEffect, useState } from 'react';

type PipelineStatus = {
  status?: string;
  last_run_at?: string;
  duration_sec?: number;
  error?: string;
};

export default function PipelineStatusCard() {
  const [data, setData] = useState<PipelineStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/pipeline-status')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then((json) => {
        setData(json);
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
        Loading pipeline status...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: '0.875rem', background: '#11161C', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', color: '#f87171', fontSize: '0.8rem' }}>
        Failed to load pipeline status
      </div>
    );
  }

  const s = data.status?.toLowerCase() || 'unknown';
  let color = '#9ca3af'; // gray
  if (s === 'success' || s === 'completed' || s === 'ok') color = '#22c55e'; // green
  if (s === 'failure' || s === 'error' || s === 'failed') color = '#ef4444'; // red

  return (
    <div style={{ padding: '0.875rem', background: '#11161C', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontFamily: 'var(--font-ui-sans, sans-serif)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '0.85rem' }}>Pipeline Status</span>
        <span style={{ padding: '0.125rem 0.375rem', borderRadius: 9999, fontSize: '0.65rem', fontWeight: 800, backgroundColor: `${color}20`, color, border: `1px solid ${color}40`, textTransform: 'uppercase' }}>
          {data.status || 'UNKNOWN'}
        </span>
      </div>
      {(data.last_run_at || data.duration_sec != null || data.error) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.75rem', color: '#94a3b8' }}>
          {data.last_run_at && <div>Last Run: {data.last_run_at}</div>}
          {data.duration_sec != null && <div>Duration: {data.duration_sec.toFixed(1)}s</div>}
          {data.error && <div style={{ color: '#ef4444', marginTop: '0.25rem' }}>{data.error}</div>}
        </div>
      )}
    </div>
  );
}
