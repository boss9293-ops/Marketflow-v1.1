'use client';

import React, { useEffect, useState } from 'react';

// ── types ──────────────────────────────────────────────────────────────────────

type DigestState = 'normal' | 'observe' | 'intervene' | 'manual_required';
type Priority    = 'low' | 'medium' | 'high' | 'critical';

interface DigestResponse {
  ok:         boolean;
  state:      DigestState;
  priority:   Priority;
  summary:    string;
  highlights: string[];
  inputs: {
    predictive_score?: number;
    predictive_label?: string;
    predicted_mode?:   string;
    runbook_state?:    string;
    active_episode?:   string | null;
    recent_ep_days?:   number | null;
    history_runs?:     number;
  };
  error?: string;
}

// ── config ─────────────────────────────────────────────────────────────────────

const STATE_COLOR: Record<DigestState, string> = {
  manual_required: '#ef4444',
  intervene:       '#f59e0b',
  observe:         '#6366f1',
  normal:          '#22c55e',
};

const STATE_LABEL: Record<DigestState, string> = {
  manual_required: 'MANUAL REQUIRED',
  intervene:       'INTERVENE',
  observe:         'OBSERVE',
  normal:          'NORMAL',
};

const STATE_ICON: Record<DigestState, string> = {
  manual_required: '⚠',
  intervene:       '⚡',
  observe:         '◎',
  normal:          '●',
};

const PRIORITY_COLOR: Record<Priority, string> = {
  critical: '#ef4444',
  high:     '#f59e0b',
  medium:   '#6366f1',
  low:      '#22c55e',
};

// ── main component ─────────────────────────────────────────────────────────────

export default function PipelineDigestCard() {
  const [data, setData]       = useState<DigestResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/pipeline-digest')
      .then((r) => r.json())
      .then((j: DigestResponse) => { setData(j); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const state = (data?.state ?? 'normal') as DigestState;
  const sc    = STATE_COLOR[state] ?? '#22c55e';

  const card: React.CSSProperties = {
    padding:      '0.875rem',
    background:   '#11161C',
    borderRadius: 12,
    border:       state === 'normal'
      ? '1px solid rgba(255,255,255,0.07)'
      : `1px solid ${sc}28`,
    fontFamily:   'var(--font-ui-sans, sans-serif)',
  };

  if (loading) {
    return (
      <div style={{ ...card, color: '#8b949e', fontSize: '0.8rem' }}>
        Loading digest…
      </div>
    );
  }

  if (!data || !data.ok) {
    return (
      <div style={card}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.4rem' }}>
          <span style={{ color:'#F8FAFC', fontWeight:600, fontSize:'0.85rem' }}>Operator Digest</span>
        </div>
        <div style={{ color:'#475569', fontSize:'0.7rem' }}>{data?.error ?? 'No data available.'}</div>
      </div>
    );
  }

  const { state: st, priority, summary, highlights } = data;
  const stateColor = STATE_COLOR[st as DigestState] ?? '#22c55e';
  const prColor    = PRIORITY_COLOR[priority as Priority] ?? '#22c55e';

  return (
    <div style={card}>
      {/* Header */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        marginBottom:'0.65rem',
      }}>
        <span style={{ color:'#F8FAFC', fontWeight:600, fontSize:'0.85rem' }}>
          Operator Digest
        </span>

        {/* State badge */}
        <span style={{
          display:'inline-flex', alignItems:'center', gap:'0.2rem',
          padding:'0.1rem 0.45rem', borderRadius:9999,
          fontSize:'0.6rem', fontWeight:700,
          background:`${stateColor}1a`, color:stateColor,
          border:`1px solid ${stateColor}35`,
          textTransform:'uppercase', letterSpacing:'0.04em',
        }}>
          {STATE_ICON[st as DigestState]} {STATE_LABEL[st as DigestState]}
        </span>
      </div>

      {/* Summary text */}
      <div style={{
        color:'#94a3b8', fontSize:'0.72rem', lineHeight:1.6,
        marginBottom:'0.65rem',
        paddingBottom:'0.45rem',
        borderBottom:'1px solid rgba(255,255,255,0.04)',
      }}>
        {summary}
      </div>

      {/* Highlights */}
      {highlights.length > 0 && (
        <div>
          <div style={{
            color:'#64748b', fontSize:'0.63rem', fontWeight:600,
            textTransform:'uppercase', letterSpacing:'0.04em',
            marginBottom:'0.35rem',
          }}>
            Highlights
          </div>
          {highlights.map((h, i) => (
            <div key={i} style={{
              display:'flex', alignItems:'flex-start', gap:'0.4rem',
              marginBottom:'0.2rem',
            }}>
              {/* Bullet dot — colored for first highlight (score), neutral for rest */}
              <span style={{
                width:5, height:5, borderRadius:'50%', flexShrink:0, marginTop:'0.3rem',
                background: i === 0 ? prColor : 'rgba(100,116,139,0.5)',
              }} />
              <span style={{ color:'#64748b', fontSize:'0.67rem', lineHeight:1.4 }}>
                {h}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
