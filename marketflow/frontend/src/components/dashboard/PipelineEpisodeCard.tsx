'use client';

import React, { useEffect, useState } from 'react';

// ── types ─────────────────────────────────────────────────────────────────────

type EpisodeSeverity  = 'low' | 'medium' | 'high' | 'critical';
type EpisodeRootCause = 'transient' | 'intermittent' | 'recurring' | 'systemic';

interface Episode {
  episode_id:          string;
  status:              'active' | 'resolved';
  start_time:          string;
  end_time:            string | null;
  duration_runs:       number;
  failure_count:       number;
  retry_count:         number;
  scripts_failed_peak: number;
  root_cause:          EpisodeRootCause;
  severity:            EpisodeSeverity;
}

interface EpisodesResponse {
  ok:             boolean;
  active_episode: Episode | null;
  episodes:       Episode[];
  total_episodes: number;
  current_streak: number;
  error?:         string;
}

// ── config ────────────────────────────────────────────────────────────────────

const SEV_COLOR: Record<EpisodeSeverity, string> = {
  critical: '#ef4444',
  high:     '#f59e0b',
  medium:   '#6366f1',
  low:      '#22c55e',
};

const SEV_LABEL: Record<EpisodeSeverity, string> = {
  critical: 'CRITICAL',
  high:     'HIGH',
  medium:   'MEDIUM',
  low:      'LOW',
};

const CAUSE_LABEL: Record<EpisodeRootCause, string> = {
  systemic:     'systemic',
  recurring:    'recurring',
  intermittent: 'intermittent',
  transient:    'transient',
};

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch { return iso.slice(0, 16); }
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  return iso.slice(0, 10);
}

// ── sub-components ────────────────────────────────────────────────────────────

function SevBadge({ severity }: { severity: EpisodeSeverity }) {
  const c = SEV_COLOR[severity];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '0.1rem 0.38rem', borderRadius: 9999,
      fontSize: '0.6rem', fontWeight: 700,
      background: `${c}1a`, color: c, border: `1px solid ${c}35`,
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {SEV_LABEL[severity]}
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

function EpisodeRow({ ep }: { ep: Episode }) {
  const c = SEV_COLOR[ep.severity];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.45rem',
      padding: '0.3rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: c, flexShrink: 0,
      }} />
      <span style={{ color: '#94a3b8', fontSize: '0.67rem', minWidth: 66 }}>
        {fmtDate(ep.start_time)}
      </span>
      <span style={{ flex: 1, color: '#475569', fontSize: '0.65rem' }}>
        {ep.duration_runs}r · {ep.failure_count}f
        {ep.retry_count > 0 ? ` · ${ep.retry_count}↺` : ''}
      </span>
      <span style={{ color: '#334155', fontSize: '0.62rem', fontStyle: 'italic' }}>
        {CAUSE_LABEL[ep.root_cause]}
      </span>
      {ep.status === 'resolved' ? (
        <span style={{
          color: '#22c55e', fontSize: '0.6rem', fontWeight: 600,
          background: '#22c55e14', border: '1px solid #22c55e25',
          borderRadius: 4, padding: '0.02rem 0.3rem',
        }}>resolved</span>
      ) : (
        <span style={{
          color: c, fontSize: '0.6rem', fontWeight: 700,
          background: `${c}14`, border: `1px solid ${c}25`,
          borderRadius: 4, padding: '0.02rem 0.3rem',
        }}>active</span>
      )}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function PipelineEpisodeCard() {
  const [data, setData]       = useState<EpisodesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/pipeline-episodes')
      .then((r) => r.json())
      .then((j: EpisodesResponse) => { setData(j); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const card: React.CSSProperties = {
    padding:      '0.875rem',
    background:   '#11161C',
    borderRadius: 12,
    border:       data?.active_episode
      ? `1px solid ${SEV_COLOR[data.active_episode.severity]}30`
      : '1px solid rgba(255,255,255,0.07)',
    fontFamily: 'var(--font-ui-sans, sans-serif)',
  };

  if (loading) {
    return <div style={{ ...card, color: '#8b949e', fontSize: '0.8rem' }}>Loading episodes...</div>;
  }

  if (!data || !data.ok) {
    return (
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
          <span style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '0.85rem' }}>Incident Episodes</span>
        </div>
        <div style={{ color: '#475569', fontSize: '0.7rem' }}>
          {data?.error ?? 'No history available.'}
        </div>
      </div>
    );
  }

  const { active_episode, episodes, current_streak } = data;

  // Show only the last 5 resolved episodes + active if present
  const historyRows = episodes.filter((e) => e.status === 'resolved').slice(0, 5);

  return (
    <div style={card}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '0.7rem',
      }}>
        <span style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '0.85rem' }}>
          Incident Episodes
        </span>
        {!active_episode && current_streak > 0 && (
          <span style={{
            color: '#22c55e', fontSize: '0.68rem',
            background: '#22c55e14', border: '1px solid #22c55e25',
            borderRadius: 9999, padding: '0.1rem 0.45rem',
          }}>
            ✓ {current_streak} run{current_streak !== 1 ? 's' : ''} clean
          </span>
        )}
        {active_episode && (
          <SevBadge severity={active_episode.severity} />
        )}
      </div>

      {/* Active episode alert */}
      {active_episode && (() => {
        const c = SEV_COLOR[active_episode.severity];
        return (
          <div style={{
            background: `${c}12`, border: `1px solid ${c}30`,
            borderRadius: 8, padding: '0.55rem 0.65rem', marginBottom: '0.65rem',
          }}>
            <div style={{ color: c, fontSize: '0.7rem', fontWeight: 700, marginBottom: '0.25rem' }}>
              ⚡ INCIDENT IN PROGRESS
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', fontSize: '0.67rem' }}>
              <span style={{ color: '#F8FAFC' }}>
                Since <span style={{ fontFamily: 'monospace' }}>{fmtTime(active_episode.start_time)}</span>
              </span>
              <span style={{ color: '#94a3b8' }}>
                {active_episode.duration_runs} run{active_episode.duration_runs !== 1 ? 's' : ''}
              </span>
              <span style={{ color: '#94a3b8' }}>
                {active_episode.failure_count} failure{active_episode.failure_count !== 1 ? 's' : ''}
              </span>
              {active_episode.retry_count > 0 && (
                <span style={{ color: '#94a3b8' }}>
                  {active_episode.retry_count} retry attempt{active_episode.retry_count !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div style={{ color: '#475569', fontSize: '0.63rem', marginTop: '0.2rem', fontStyle: 'italic' }}>
              {CAUSE_LABEL[active_episode.root_cause]} · {active_episode.scripts_failed_peak} scripts affected at peak
            </div>
          </div>
        );
      })()}

      {/* No active episode — clean state */}
      {!active_episode && episodes.length === 0 && (
        <div style={{ color: '#334155', fontSize: '0.72rem' }}>No incidents recorded.</div>
      )}

      {/* Episode history */}
      {historyRows.length > 0 && (
        <div>
          <SectionLabel>Recent Incidents ({historyRows.length})</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {historyRows.map((ep) => (
              <EpisodeRow key={ep.episode_id} ep={ep} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
