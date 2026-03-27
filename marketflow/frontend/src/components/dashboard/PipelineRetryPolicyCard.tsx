'use client';

import React, { useEffect, useRef, useState } from 'react';

type RootCause =
  | 'timeout'
  | 'missing_input'
  | 'malformed_json'
  | 'dependency_failure'
  | 'script_exception'
  | 'unknown';

interface RetryPolicy {
  enabled:              boolean;
  max_retry_per_script: number;
  allow_root_causes:    RootCause[];
  deny_root_causes:     RootCause[];
  allow_scripts:        string[];
  deny_scripts:         string[];
  cooldown_sec:         number;
}

const ALL_CAUSES: RootCause[] = [
  'timeout', 'missing_input', 'malformed_json',
  'dependency_failure', 'script_exception', 'unknown',
];

const CAUSE_LABEL: Record<RootCause, string> = {
  timeout:            'Timeout',
  missing_input:      'Missing Input',
  malformed_json:     'Malformed JSON',
  dependency_failure: 'Dependency Failure',
  script_exception:   'Script Exception',
  unknown:            'Unknown',
};

const CAUSE_COLOR: Record<RootCause, string> = {
  timeout:            '#f59e0b',
  missing_input:      '#6366f1',
  malformed_json:     '#ec4899',
  dependency_failure: '#f97316',
  script_exception:   '#ef4444',
  unknown:            '#64748b',
};

// ── sub-components ────────────────────────────────────────────────────────────

function CausePill({ cause, dim }: { cause: RootCause; dim?: boolean }) {
  const c = CAUSE_COLOR[cause];
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '0.1rem 0.38rem',
      borderRadius: 9999,
      fontSize: '0.6rem',
      fontWeight: 700,
      background: dim ? `${c}0d` : `${c}1a`,
      color: dim ? '#475569' : c,
      border: `1px solid ${dim ? 'rgba(255,255,255,0.06)' : `${c}35`}`,
      textTransform: 'uppercase',
      letterSpacing: '0.03em',
      flexShrink: 0,
    }}>
      {CAUSE_LABEL[cause]}
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

function CauseToggleRow({
  cause, checked, onChange,
}: { cause: RootCause; checked: boolean; onChange: (v: boolean) => void }) {
  const c = CAUSE_COLOR[cause];
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', userSelect: 'none',
    }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: c, width: 13, height: 13, cursor: 'pointer' }} />
      <CausePill cause={cause} />
    </label>
  );
}

// ── main component ────────────────────────────────────────────────────────────

const DEFAULT_POLICY: RetryPolicy = {
  enabled: true, max_retry_per_script: 1,
  allow_root_causes: [], deny_root_causes: [],
  allow_scripts: [], deny_scripts: [], cooldown_sec: 0,
};

export default function PipelineRetryPolicyCard() {
  const [policy, setPolicy]   = useState<RetryPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState<RetryPolicy>(DEFAULT_POLICY);
  const [saving, setSaving]   = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch('/api/pipeline-retry-policy')
      .then((r) => { if (!r.ok) throw new Error('failed'); return r.json(); })
      .then((j) => { setPolicy(j.policy); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  function startEdit() {
    setDraft(policy ?? DEFAULT_POLICY);
    setEditing(true);
    setSaveMsg(null);
  }

  function cancelEdit() {
    setEditing(false);
    setSaveMsg(null);
  }

  async function save() {
    setSaving(true);
    setSaveMsg(null);
    try {
      const r = await fetch('/api/pipeline-retry-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const j = await r.json();
      if (j.ok) {
        setPolicy(j.policy);
        setEditing(false);
        showMsg(true, 'Policy saved.');
      } else {
        showMsg(false, (j.errors ?? ['Save failed.']).join(' '));
      }
    } catch {
      showMsg(false, 'Network error.');
    } finally {
      setSaving(false);
    }
  }

  function showMsg(ok: boolean, text: string) {
    setSaveMsg({ ok, text });
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setSaveMsg(null), 4000);
  }

  function toggleDenyCause(cause: RootCause, on: boolean) {
    setDraft((d) => ({
      ...d,
      deny_root_causes: on
        ? [...d.deny_root_causes, cause]
        : d.deny_root_causes.filter((c) => c !== cause),
    }));
  }

  const card: React.CSSProperties = {
    padding: '0.875rem',
    background: '#11161C',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.07)',
    fontFamily: 'var(--font-ui-sans, sans-serif)',
  };

  if (loading) return <div style={{ ...card, color: '#8b949e', fontSize: '0.8rem' }}>Loading retry policy...</div>;
  if (error || !policy) return <div style={{ ...card, color: '#f87171', fontSize: '0.8rem' }}>Failed to load retry policy</div>;

  // ── view mode ──────────────────────────────────────────────────────────────
  if (!editing) {
    return (
      <div style={card}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <span style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '0.85rem' }}>Retry Policy</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {saveMsg && (
              <span style={{ fontSize: '0.65rem', color: saveMsg.ok ? '#22c55e' : '#f87171' }}>
                {saveMsg.text}
              </span>
            )}
            <span style={{
              padding: '0.1rem 0.45rem',
              borderRadius: 9999,
              fontSize: '0.62rem',
              fontWeight: 700,
              backgroundColor: policy.enabled ? '#22c55e1a' : '#ef44441a',
              color:           policy.enabled ? '#22c55e'   : '#ef4444',
              border: `1px solid ${policy.enabled ? '#22c55e35' : '#ef444435'}`,
            }}>
              {policy.enabled ? '● ACTIVE' : '○ DISABLED'}
            </span>
            <button
              onClick={startEdit}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#cbd5e1', borderRadius: 6, padding: '0.2rem 0.6rem',
                fontSize: '0.68rem', cursor: 'pointer',
              }}
            >
              Edit
            </button>
          </div>
        </div>

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

          {/* max_retry + cooldown */}
          <div style={{ display: 'flex', gap: '1.2rem' }}>
            <div>
              <SectionLabel>Max Retries / Script</SectionLabel>
              <span style={{ color: '#F8FAFC', fontSize: '0.78rem', fontWeight: 600 }}>
                {policy.max_retry_per_script === 0 ? '0 (blocked)' : policy.max_retry_per_script}
              </span>
            </div>
            <div>
              <SectionLabel>Cooldown</SectionLabel>
              <span style={{ color: '#F8FAFC', fontSize: '0.78rem', fontWeight: 600 }}>
                {policy.cooldown_sec === 0 ? 'None' : `${policy.cooldown_sec}s`}
              </span>
            </div>
          </div>

          {/* Denied Causes */}
          <div>
            <SectionLabel>Denied Causes</SectionLabel>
            {policy.deny_root_causes.length === 0 ? (
              <span style={{ color: '#475569', fontSize: '0.7rem' }}>None (all causes allowed)</span>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                {policy.deny_root_causes.map((c) => <CausePill key={c} cause={c} />)}
              </div>
            )}
          </div>

          {/* Allowed Causes */}
          {policy.allow_root_causes.length > 0 && (
            <div>
              <SectionLabel>Allowed Causes (restricted)</SectionLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                {policy.allow_root_causes.map((c) => <CausePill key={c} cause={c} />)}
              </div>
            </div>
          )}

          {/* Denied Scripts */}
          {policy.deny_scripts.length > 0 && (
            <div>
              <SectionLabel>Denied Scripts</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.18rem' }}>
                {policy.deny_scripts.map((s) => (
                  <span key={s} style={{ color: '#ef4444', fontSize: '0.7rem' }}>✕ {s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Allow scripts summary */}
          {policy.allow_scripts.length > 0 && (
            <div>
              <SectionLabel>Allowed Scripts (restricted to {policy.allow_scripts.length})</SectionLabel>
              <span style={{ color: '#64748b', fontSize: '0.7rem' }}>
                {policy.allow_scripts.slice(0, 3).join(', ')}{policy.allow_scripts.length > 3 ? ` +${policy.allow_scripts.length - 3}` : ''}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── edit mode ──────────────────────────────────────────────────────────────
  return (
    <div style={card}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <span style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '0.85rem' }}>Retry Policy</span>
        <span style={{ color: '#f59e0b', fontSize: '0.65rem', fontWeight: 600 }}>EDITING</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>

        {/* enabled */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
            style={{ accentColor: '#22c55e', width: 14, height: 14, cursor: 'pointer' }}
          />
          <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>Enabled</span>
        </label>

        {/* max_retry_per_script */}
        <div>
          <SectionLabel>Max Retries Per Script (0–3)</SectionLabel>
          <input
            type="number"
            min={0} max={3}
            value={draft.max_retry_per_script}
            onChange={(e) => setDraft({ ...draft, max_retry_per_script: Math.max(0, Math.min(3, parseInt(e.target.value) || 0)) })}
            style={{
              background: '#0D1117', border: '1px solid rgba(255,255,255,0.12)',
              color: '#F8FAFC', borderRadius: 6, padding: '0.25rem 0.5rem',
              fontSize: '0.78rem', width: 60,
            }}
          />
        </div>

        {/* cooldown_sec */}
        <div>
          <SectionLabel>Cooldown (seconds, 0–3600)</SectionLabel>
          <input
            type="number"
            min={0} max={3600}
            value={draft.cooldown_sec}
            onChange={(e) => setDraft({ ...draft, cooldown_sec: Math.max(0, Math.min(3600, parseInt(e.target.value) || 0)) })}
            style={{
              background: '#0D1117', border: '1px solid rgba(255,255,255,0.12)',
              color: '#F8FAFC', borderRadius: 6, padding: '0.25rem 0.5rem',
              fontSize: '0.78rem', width: 80,
            }}
          />
        </div>

        {/* deny_root_causes */}
        <div>
          <SectionLabel>Deny These Causes</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {ALL_CAUSES.map((cause) => (
              <CauseToggleRow
                key={cause}
                cause={cause}
                checked={draft.deny_root_causes.includes(cause)}
                onChange={(v) => toggleDenyCause(cause, v)}
              />
            ))}
          </div>
        </div>

        {/* deny_scripts (textarea) */}
        <div>
          <SectionLabel>Deny Scripts (one per line)</SectionLabel>
          <textarea
            value={draft.deny_scripts.join('\n')}
            onChange={(e) => setDraft({
              ...draft,
              deny_scripts: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
            })}
            rows={3}
            placeholder="e.g. build_ml.py"
            style={{
              background: '#0D1117', border: '1px solid rgba(255,255,255,0.12)',
              color: '#F8FAFC', borderRadius: 6, padding: '0.35rem 0.5rem',
              fontSize: '0.72rem', width: '100%', resize: 'vertical',
              fontFamily: 'monospace', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Save / Cancel */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', paddingTop: '0.1rem' }}>
          <button
            onClick={save}
            disabled={saving}
            style={{
              background: '#2563eb', border: 'none', color: '#fff',
              borderRadius: 6, padding: '0.3rem 0.75rem',
              fontSize: '0.73rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={cancelEdit}
            disabled={saving}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#94a3b8', borderRadius: 6, padding: '0.3rem 0.75rem',
              fontSize: '0.73rem', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          {saveMsg && (
            <span style={{ fontSize: '0.68rem', color: saveMsg.ok ? '#22c55e' : '#f87171' }}>
              {saveMsg.text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
