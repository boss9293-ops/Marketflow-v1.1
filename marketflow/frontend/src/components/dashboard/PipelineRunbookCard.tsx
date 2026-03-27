'use client';

import React, { useEffect, useState } from 'react';

// ── types ──────────────────────────────────────────────────────────────────────

type RunbookState = 'normal' | 'observe' | 'intervene' | 'manual_required';
type Priority     = 'low' | 'medium' | 'high' | 'critical';
type Category     = 'monitor' | 'retry_policy' | 'data_integrity' | 'dependency_check' | 'manual_investigation' | 'maintenance_control';

interface Action {
  action_id:   string;
  category:    Category;
  priority:    Priority;
  title:       string;
  description: string;
}

interface RunbookResponse {
  ok:                  boolean;
  runbook_state:       RunbookState;
  priority:            Priority;
  recommended_actions: Action[];
  inputs: {
    predictive_score?:       number;
    predictive_label?:       string;
    predicted_mode?:         string;
    active_episode?:         string | null;
    episode_count?:          number;
    ops_mode_enabled?:       boolean;
    manual_attention_count?: number;
    history_runs?:           number;
  };
  error?: string;
}

// ── config ─────────────────────────────────────────────────────────────────────

const STATE_COLOR: Record<RunbookState, string> = {
  manual_required: '#ef4444',
  intervene:       '#f59e0b',
  observe:         '#6366f1',
  normal:          '#22c55e',
};

const STATE_LABEL: Record<RunbookState, string> = {
  manual_required: 'MANUAL REQUIRED',
  intervene:       'INTERVENE',
  observe:         'OBSERVE',
  normal:          'NORMAL',
};

const STATE_ICON: Record<RunbookState, string> = {
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

const CATEGORY_ICON: Record<Category, string> = {
  monitor:             '○',
  retry_policy:        '↻',
  data_integrity:      '✓',
  dependency_check:    '⚡',
  manual_investigation:'⊙',
  maintenance_control: '⏸',
};

const CATEGORY_LABEL: Record<Category, string> = {
  monitor:             'Monitor',
  retry_policy:        'Retry Policy',
  data_integrity:      'Data Integrity',
  dependency_check:    'Dependency',
  manual_investigation:'Investigate',
  maintenance_control: 'Ops Control',
};

// ── sub-components ─────────────────────────────────────────────────────────────

function ActionCard({ action, expanded, onToggle }: {
  action:    Action;
  expanded:  boolean;
  onToggle:  () => void;
}) {
  const pc = PRIORITY_COLOR[action.priority];
  const cc = action.category as Category;

  return (
    <div
      onClick={onToggle}
      style={{
        borderRadius: 6,
        border:       `1px solid ${pc}20`,
        background:   `${pc}08`,
        marginBottom: '0.35rem',
        cursor:       'pointer',
        overflow:     'hidden',
      }}
    >
      {/* Action header row */}
      <div style={{
        display:     'flex',
        alignItems:  'center',
        gap:         '0.45rem',
        padding:     '0.35rem 0.5rem',
      }}>
        {/* Priority dot */}
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: pc, flexShrink: 0,
        }} />

        {/* Category tag */}
        <span style={{
          fontSize:        '0.58rem',
          fontWeight:      600,
          color:           '#475569',
          textTransform:   'uppercase',
          letterSpacing:   '0.04em',
          flexShrink:      0,
          minWidth:        '3.5rem',
        }}>
          {CATEGORY_ICON[cc]} {CATEGORY_LABEL[cc]}
        </span>

        {/* Title */}
        <span style={{
          flex:     1,
          color:    '#94a3b8',
          fontSize: '0.7rem',
          fontWeight: 500,
          lineHeight: 1.3,
        }}>
          {action.title}
        </span>

        {/* Priority label */}
        <span style={{
          fontSize:    '0.58rem',
          fontWeight:  700,
          color:       pc,
          textTransform: 'uppercase',
          flexShrink:  0,
        }}>
          {action.priority}
        </span>

        {/* Expand chevron */}
        <span style={{ color: '#334155', fontSize: '0.6rem', flexShrink: 0 }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {/* Expanded description */}
      {expanded && (
        <div style={{
          padding:     '0 0.5rem 0.4rem 1.2rem',
          color:       '#64748b',
          fontSize:    '0.65rem',
          lineHeight:  1.5,
        }}>
          {action.description}
        </div>
      )}
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────────

export default function PipelineRunbookCard() {
  const [data, setData]           = useState<RunbookResponse | null>(null);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch('/api/pipeline-runbook')
      .then((r) => r.json())
      .then((j: RunbookResponse) => {
        setData(j);
        setLoading(false);
        // Auto-expand the first critical/high action
        if (j.recommended_actions?.length) {
          const first = j.recommended_actions[0];
          if (['critical', 'high'].includes(first.priority)) {
            setExpanded({ [first.action_id]: true });
          }
        }
      })
      .catch(() => setLoading(false));
  }, []);

  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const state = data?.runbook_state ?? 'normal';
  const sc    = STATE_COLOR[state as RunbookState] ?? '#22c55e';

  const card: React.CSSProperties = {
    padding:      '0.875rem',
    background:   '#11161C',
    borderRadius: 12,
    border:       state === 'normal' ? '1px solid rgba(255,255,255,0.07)' : `1px solid ${sc}28`,
    fontFamily:   'var(--font-ui-sans, sans-serif)',
  };

  if (loading) {
    return (
      <div style={{ ...card, color: '#8b949e', fontSize: '0.8rem' }}>
        Loading runbook…
      </div>
    );
  }

  if (!data || !data.ok) {
    return (
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
          <span style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '0.85rem' }}>Runbook</span>
        </div>
        <div style={{ color: '#475569', fontSize: '0.7rem' }}>{data?.error ?? 'No data available.'}</div>
      </div>
    );
  }

  const { runbook_state, priority, recommended_actions, inputs } = data;
  const stateColor = STATE_COLOR[runbook_state];

  // Show top 5 actions
  const actions = recommended_actions.slice(0, 5);

  return (
    <div style={card}>
      {/* Header */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        marginBottom:   '0.7rem',
      }}>
        <span style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '0.85rem' }}>
          Runbook
        </span>

        {/* State badge */}
        <span style={{
          display:       'inline-flex',
          alignItems:    'center',
          gap:           '0.2rem',
          padding:       '0.1rem 0.45rem',
          borderRadius:  9999,
          fontSize:      '0.6rem',
          fontWeight:    700,
          background:    `${stateColor}1a`,
          color:         stateColor,
          border:        `1px solid ${stateColor}35`,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}>
          {STATE_ICON[runbook_state]} {STATE_LABEL[runbook_state]}
        </span>
      </div>

      {/* Context strip */}
      <div style={{
        display:      'flex',
        gap:          '0.65rem',
        flexWrap:     'wrap',
        marginBottom: '0.65rem',
        paddingBottom: '0.45rem',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        {[
          ['Score', `${inputs.predictive_score ?? '—'}/100`],
          ['Mode',  inputs.predicted_mode ?? '—'],
          ['Actions', `${recommended_actions.length}`],
        ].map(([lbl, val]) => (
          <span key={lbl} style={{ fontSize: '0.62rem', color: '#334155' }}>
            <span style={{ color: '#475569' }}>{lbl}</span>
            {' '}
            <span style={{ color: '#64748b', fontWeight: 600 }}>{val}</span>
          </span>
        ))}
      </div>

      {/* Action list */}
      {actions.length > 0 ? (
        <div>
          <div style={{
            color:         '#64748b',
            fontSize:      '0.63rem',
            fontWeight:    600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom:  '0.4rem',
          }}>
            Recommended Actions ({actions.length}{recommended_actions.length > 5 ? `/${recommended_actions.length}` : ''})
          </div>
          {actions.map((action) => (
            <ActionCard
              key={action.action_id}
              action={action}
              expanded={!!expanded[action.action_id]}
              onToggle={() => toggle(action.action_id)}
            />
          ))}
        </div>
      ) : (
        <div style={{ color: '#334155', fontSize: '0.68rem' }}>
          No actions required.
        </div>
      )}
    </div>
  );
}
