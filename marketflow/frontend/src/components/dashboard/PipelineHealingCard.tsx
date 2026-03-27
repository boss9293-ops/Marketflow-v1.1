'use client';

import React, { useEffect, useRef, useState } from 'react';

// ── types ─────────────────────────────────────────────────────────────────────

type HealingStrategy = 'retry_now' | 'retry_upstream_first' | 'skip_and_degrade' | 'manual_attention';
type HealingState    = 'healthy' | 'degraded' | 'critical';

interface StrategyEntry {
  script:     string;
  root_cause: string;
  strategy:   HealingStrategy;
  upstream:   string | null;
  reason:     string;
}

interface HealingPlan {
  ok:                boolean;
  healing_state:     HealingState;
  strategies:        StrategyEntry[];
  retry_now_scripts: string[];
  degraded:          string[];
  manual_attention:  string[];
  error?:            string;
}

// ── config ────────────────────────────────────────────────────────────────────

const STRATEGY_CONFIG: Record<HealingStrategy, { label: string; color: string; icon: string; desc: string }> = {
  retry_now:            { label: 'Auto-Retry',        color: '#22c55e', icon: '↺', desc: 'Transient — queued for immediate retry' },
  retry_upstream_first: { label: 'Upstream First',    color: '#f59e0b', icon: '↑', desc: 'Dependency failure — upstream recovers first' },
  skip_and_degrade:     { label: 'Skip & Degrade',    color: '#6366f1', icon: '⊘', desc: 'Data format issue — graceful degradation' },
  manual_attention:     { label: 'Manual Attention',  color: '#ef4444', icon: '!', desc: 'Structural or critical — requires investigation' },
};

const STATE_CONFIG: Record<HealingState, { label: string; color: string; bg: string }> = {
  healthy:  { label: '● HEALTHY',  color: '#22c55e', bg: '#22c55e1a' },
  degraded: { label: '◐ DEGRADED', color: '#f59e0b', bg: '#f59e0b1a' },
  critical: { label: '● CRITICAL', color: '#ef4444', bg: '#ef44441a' },
};

// ── sub-components ────────────────────────────────────────────────────────────

function StateBadge({ state }: { state: HealingState }) {
  const cfg = STATE_CONFIG[state];
  return (
    <span style={{
      padding: '0.1rem 0.45rem', borderRadius: 9999,
      fontSize: '0.62rem', fontWeight: 700,
      backgroundColor: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.color}35`,
    }}>
      {cfg.label}
    </span>
  );
}

function StrategyBadge({ strategy }: { strategy: HealingStrategy }) {
  const cfg = STRATEGY_CONFIG[strategy];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
      padding: '0.1rem 0.38rem', borderRadius: 9999,
      fontSize: '0.6rem', fontWeight: 700,
      background: `${cfg.color}1a`, color: cfg.color,
      border: `1px solid ${cfg.color}35`,
      textTransform: 'uppercase', letterSpacing: '0.03em', flexShrink: 0,
    }}>
      <span>{cfg.icon}</span> {cfg.label}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      color: '#64748b', fontSize: '0.67rem', fontWeight: 600,
      textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.3rem',
    }}>
      {children}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

const ORDER: HealingStrategy[] = [
  'manual_attention', 'retry_now', 'retry_upstream_first', 'skip_and_degrade',
];

export default function PipelineHealingCard() {
  const [plan, setPlan]       = useState<HealingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [expanded, setExpanded] = useState<HealingStrategy | null>(null);

  useEffect(() => {
    fetch('/api/pipeline-healing')
      .then((r) => { if (!r.ok) throw new Error('failed'); return r.json(); })
      .then((j: HealingPlan) => { setPlan(j); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const card: React.CSSProperties = {
    padding: '0.875rem',
    background: '#11161C',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.07)',
    fontFamily: 'var(--font-ui-sans, sans-serif)',
  };

  if (loading) return <div style={{ ...card, color: '#8b949e', fontSize: '0.8rem' }}>Loading healing plan...</div>;
  if (error || !plan) return <div style={{ ...card, color: '#f87171', fontSize: '0.8rem' }}>Failed to load healing plan</div>;

  if (plan.healing_state === 'healthy' || plan.strategies.length === 0) {
    return (
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '0.85rem' }}>Healing Plan</span>
          <StateBadge state="healthy" />
        </div>
        <div style={{ color: '#475569', fontSize: '0.72rem', marginTop: '0.5rem' }}>
          No failed scripts — pipeline healthy.
        </div>
      </div>
    );
  }

  // Group strategies
  const grouped: Partial<Record<HealingStrategy, StrategyEntry[]>> = {};
  for (const entry of plan.strategies) {
    (grouped[entry.strategy] ??= []).push(entry);
  }

  // Strategy counts row
  const counts = ORDER.map((s) => ({ s, n: grouped[s]?.length ?? 0 })).filter((x) => x.n > 0);

  return (
    <div style={card}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <span style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '0.85rem' }}>Healing Plan</span>
        <StateBadge state={plan.healing_state} />
      </div>

      {/* Strategy count chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.7rem' }}>
        {counts.map(({ s, n }) => {
          const cfg = STRATEGY_CONFIG[s];
          const isOpen = expanded === s;
          return (
            <button
              key={s}
              onClick={() => setExpanded(isOpen ? null : s)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.25rem',
                padding: '0.18rem 0.5rem', borderRadius: 9999,
                fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer',
                background: isOpen ? `${cfg.color}28` : `${cfg.color}14`,
                color: cfg.color,
                border: `1px solid ${cfg.color}${isOpen ? '50' : '30'}`,
              }}
            >
              <span>{cfg.icon}</span>
              <span>{n} {cfg.label}</span>
            </button>
          );
        })}
      </div>

      {/* Manual attention alert */}
      {plan.manual_attention.length > 0 && (
        <div style={{
          background: '#ef44441a', border: '1px solid #ef444430',
          borderRadius: 8, padding: '0.5rem 0.65rem', marginBottom: '0.65rem',
        }}>
          <div style={{ color: '#ef4444', fontSize: '0.7rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            ⚠ Manual Attention Required ({plan.manual_attention.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            {plan.manual_attention.map((s) => (
              <span key={s} style={{ color: '#fca5a5', fontSize: '0.68rem', fontFamily: 'monospace' }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Auto-retry queued */}
      {plan.retry_now_scripts.length > 0 && (
        <div style={{
          background: '#22c55e14', border: '1px solid #22c55e25',
          borderRadius: 8, padding: '0.5rem 0.65rem', marginBottom: '0.65rem',
        }}>
          <div style={{ color: '#22c55e', fontSize: '0.7rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            ↺ Queued for Auto-Retry ({plan.retry_now_scripts.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
            {plan.retry_now_scripts.map((s) => (
              <span key={s} style={{
                background: '#22c55e1a', color: '#22c55e',
                border: '1px solid #22c55e30', borderRadius: 4,
                fontSize: '0.66rem', padding: '0.05rem 0.35rem', fontFamily: 'monospace',
              }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Expanded strategy detail */}
      {expanded && grouped[expanded] && (
        <div style={{ marginTop: '0.25rem' }}>
          <SectionLabel>{STRATEGY_CONFIG[expanded].label} — Details</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {grouped[expanded]!.map((entry) => (
              <div key={entry.script} style={{
                background: '#0D1117', borderRadius: 6, padding: '0.45rem 0.55rem',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                  <span style={{ color: '#F8FAFC', fontSize: '0.72rem', fontFamily: 'monospace' }}>
                    {entry.script}
                  </span>
                  <StrategyBadge strategy={entry.strategy} />
                  {entry.root_cause && (
                    <span style={{ color: '#64748b', fontSize: '0.62rem' }}>
                      [{entry.root_cause}]
                    </span>
                  )}
                </div>
                <div style={{ color: '#94a3b8', fontSize: '0.65rem' }}>{entry.reason}</div>
                {entry.upstream && (
                  <div style={{ color: '#f59e0b', fontSize: '0.63rem', marginTop: '0.15rem' }}>
                    Upstream: <span style={{ fontFamily: 'monospace' }}>{entry.upstream}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Degraded list */}
      {plan.degraded.length > 0 && expanded !== 'skip_and_degrade' && (
        <div style={{ marginTop: '0.5rem' }}>
          <SectionLabel>Degraded ({plan.degraded.length})</SectionLabel>
          <div style={{ color: '#64748b', fontSize: '0.68rem' }}>
            {plan.degraded.slice(0, 3).join(', ')}
            {plan.degraded.length > 3 ? ` +${plan.degraded.length - 3} more` : ''}
          </div>
        </div>
      )}
    </div>
  );
}
