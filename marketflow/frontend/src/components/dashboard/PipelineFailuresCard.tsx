'use client';

import React, { useEffect, useState } from 'react';

type TopScript = {
  script: string;
  fail_count: number;
};

type ReportFailure = {
  script: string;
  description: string;
  elapsed_sec: number;
};

type ApiResponse = {
  top_failed_scripts: TopScript[];
  latest_report_failures: ReportFailure[];
};

export default function PipelineFailuresCard() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/pipeline-failures')
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
    return <div style={{ ...cardStyle, color: '#8b949e', fontSize: '0.8rem' }}>Loading failure analysis...</div>;
  }

  if (error || !data) {
    return <div style={{ ...cardStyle, color: '#f87171', fontSize: '0.8rem' }}>Failed to load failure analysis</div>;
  }

  const top = data.top_failed_scripts.slice(0, 8);
  const reportFailed = data.latest_report_failures;
  const hasData = top.length > 0 || reportFailed.length > 0;

  return (
    <div style={cardStyle}>
      <div style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.75rem' }}>
        Failure Breakdown
      </div>

      {!hasData ? (
        <div style={{ color: '#64748b', fontSize: '0.78rem' }}>No failures in recent runs</div>
      ) : (
        <>
          {/* Top failed scripts (aggregated) */}
          {top.length > 0 && (
            <div style={{ marginBottom: reportFailed.length > 0 ? '0.75rem' : 0 }}>
              <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>
                Top Failed Scripts (last 10 runs)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {top.map(({ script, fail_count }) => {
                  const maxCount = top[0]?.fail_count ?? 1;
                  const pct = Math.round((fail_count / maxCount) * 100);
                  return (
                    <div key={script} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.15rem' }}>
                          <span style={{ color: '#cbd5e1', fontSize: '0.73rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {script}
                          </span>
                          <span style={{ color: '#f87171', fontSize: '0.7rem', fontWeight: 700, marginLeft: '0.5rem', flexShrink: 0 }}>
                            ×{fail_count}
                          </span>
                        </div>
                        <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: '#ef444488', borderRadius: 2 }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Latest report failures */}
          {reportFailed.length > 0 && (
            <div>
              <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>
                Latest Run Failures
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {reportFailed.slice(0, 10).map(({ script, description, elapsed_sec }) => (
                  <div key={script} style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 7, padding: '0.3rem 0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#fca5a5', fontSize: '0.73rem', fontWeight: 600 }}>{script}</span>
                      <span style={{ color: '#64748b', fontSize: '0.68rem' }}>{elapsed_sec}s</span>
                    </div>
                    {description && (
                      <div style={{ color: '#64748b', fontSize: '0.68rem', marginTop: '0.1rem' }}>{description}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
