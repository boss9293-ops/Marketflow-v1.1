'use client';

import React, { useEffect, useState } from 'react';

// ── types ─────────────────────────────────────────────────────────────────────

interface OpsMode {
  enabled:                        boolean;
  reason:                         string;
  set_by:                         string;
  set_at:                         string;
  force_skip_scripts:             string[];
  force_manual_attention_scripts: string[];
  force_allow_retry_scripts:      string[];
}

interface OpsResponse {
  ok:     boolean;
  config: OpsMode;
  error?: string;
}

// ── defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_OPS: OpsMode = {
  enabled:                        false,
  reason:                         '',
  set_by:                         '',
  set_at:                         '',
  force_skip_scripts:             [],
  force_manual_attention_scripts: [],
  force_allow_retry_scripts:      [],
};

// ── sub-components ────────────────────────────────────────────────────────────

function ScriptListEditor({
  label,
  color,
  values,
  onChange,
}: {
  label:    string;
  color:    string;
  values:   string[];
  onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState('');

  const add = () => {
    const s = input.trim();
    if (s && !values.includes(s)) { onChange([...values, s]); }
    setInput('');
  };

  return (
    <div style={{ marginBottom: '0.55rem' }}>
      <div style={{ color: '#64748b', fontSize: '0.67rem', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.3rem' }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.3rem' }}>
        {values.length === 0 && (
          <span style={{ color: '#334155', fontSize: '0.67rem', fontStyle: 'italic' }}>none</span>
        )}
        {values.map((s) => (
          <span key={s} style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
            background: `${color}14`, color, border: `1px solid ${color}30`,
            borderRadius: 4, fontSize: '0.65rem', padding: '0.05rem 0.35rem',
            fontFamily: 'monospace',
          }}>
            {s}
            <button
              onClick={() => onChange(values.filter((x) => x !== s))}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: `${color}99`, fontSize: '0.7rem', padding: 0, lineHeight: 1,
              }}
            >×</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.3rem' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="script_name.py"
          style={{
            flex: 1, background: '#0D1117', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 4, color: '#F8FAFC', fontSize: '0.68rem', padding: '0.2rem 0.45rem',
            outline: 'none', fontFamily: 'monospace',
          }}
        />
        <button
          onClick={add}
          style={{
            background: `${color}18`, border: `1px solid ${color}30`, borderRadius: 4,
            color, cursor: 'pointer', fontSize: '0.67rem', padding: '0.2rem 0.5rem',
          }}
        >+ Add</button>
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function PipelineOpsModeCard() {
  const [ops, setOps]         = useState<OpsMode>(DEFAULT_OPS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [saved, setSaved]     = useState(false);
  const [editing, setEditing] = useState(false);

  // Draft state while editing
  const [draft, setDraft] = useState<OpsMode>(DEFAULT_OPS);

  useEffect(() => {
    fetch('/api/pipeline-ops-mode')
      .then((r) => r.json())
      .then((j: OpsResponse) => {
        if (j.ok) { setOps(j.config); setDraft(j.config); }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const card: React.CSSProperties = {
    padding: '0.875rem',
    background: '#11161C',
    borderRadius: 12,
    border: ops.enabled
      ? '1px solid rgba(239,68,68,0.25)'
      : '1px solid rgba(255,255,255,0.07)',
    fontFamily: 'var(--font-ui-sans, sans-serif)',
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const r = await fetch('/api/pipeline-ops-mode', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(draft),
      });
      const j: OpsResponse = await r.json();
      if (j.ok) {
        setOps(j.config);
        setDraft(j.config);
        setEditing(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        setError(j.error ?? 'Save failed');
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setDraft(ops);
    setEditing(false);
    setError('');
  };

  if (loading) {
    return <div style={{ ...card, color: '#8b949e', fontSize: '0.8rem' }}>Loading operator mode...</div>;
  }

  return (
    <div style={card}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
        <span style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '0.85rem' }}>Operator Mode</span>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {saved && (
            <span style={{ color: '#22c55e', fontSize: '0.68rem' }}>✓ Saved</span>
          )}
          {!editing && (
            <button
              onClick={() => { setDraft(ops); setEditing(true); }}
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6, color: '#94a3b8', cursor: 'pointer', fontSize: '0.68rem',
                padding: '0.15rem 0.5rem',
              }}
            >Edit</button>
          )}
        </div>
      </div>

      {/* Maintenance mode toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: ops.enabled ? '#ef44441a' : '#0D1117',
        border: `1px solid ${ops.enabled ? '#ef444430' : 'rgba(255,255,255,0.05)'}`,
        borderRadius: 8, padding: '0.5rem 0.65rem', marginBottom: '0.65rem',
      }}>
        <div>
          <div style={{ color: ops.enabled ? '#ef4444' : '#94a3b8', fontSize: '0.72rem', fontWeight: 700 }}>
            {ops.enabled ? '⏸ MAINTENANCE MODE ACTIVE' : '● Auto-retry enabled'}
          </div>
          {ops.enabled && ops.reason && (
            <div style={{ color: '#fca5a5', fontSize: '0.67rem', marginTop: '0.15rem' }}>
              {ops.reason}
            </div>
          )}
          {ops.set_at && (
            <div style={{ color: '#475569', fontSize: '0.62rem', marginTop: '0.1rem' }}>
              {ops.set_by ? `by ${ops.set_by} · ` : ''}{ops.set_at}
            </div>
          )}
        </div>
        {editing && (
          <button
            onClick={() => setDraft((d) => ({ ...d, enabled: !d.enabled }))}
            style={{
              background: draft.enabled ? '#ef444420' : '#22c55e20',
              border:     `1px solid ${draft.enabled ? '#ef444440' : '#22c55e40'}`,
              borderRadius: 9999, color: draft.enabled ? '#ef4444' : '#22c55e',
              cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700,
              padding: '0.18rem 0.6rem', flexShrink: 0,
            }}
          >
            {draft.enabled ? 'Disable' : 'Enable'}
          </button>
        )}
      </div>

      {/* Override lists */}
      {!editing ? (
        /* Read-only summary */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {[
            { label: 'Force Skip',             color: '#ef4444', list: ops.force_skip_scripts },
            { label: 'Force Manual Attention', color: '#f59e0b', list: ops.force_manual_attention_scripts },
            { label: 'Force Allow Retry',      color: '#22c55e', list: ops.force_allow_retry_scripts },
          ].map(({ label, color, list }) => list.length > 0 && (
            <div key={label}>
              <div style={{ color: '#64748b', fontSize: '0.63rem', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.2rem' }}>
                {label} ({list.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem' }}>
                {list.map((s) => (
                  <span key={s} style={{
                    background: `${color}14`, color, border: `1px solid ${color}30`,
                    borderRadius: 4, fontSize: '0.63rem', padding: '0.03rem 0.3rem',
                    fontFamily: 'monospace',
                  }}>{s}</span>
                ))}
              </div>
            </div>
          ))}
          {!ops.force_skip_scripts.length && !ops.force_manual_attention_scripts.length && !ops.force_allow_retry_scripts.length && (
            <div style={{ color: '#334155', fontSize: '0.68rem' }}>No per-script overrides active.</div>
          )}
        </div>
      ) : (
        /* Edit form */
        <div>
          {/* Reason */}
          <div style={{ marginBottom: '0.55rem' }}>
            <div style={{ color: '#64748b', fontSize: '0.67rem', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
              Reason
            </div>
            <input
              value={draft.reason}
              onChange={(e) => setDraft((d) => ({ ...d, reason: e.target.value }))}
              placeholder="Maintenance window, scheduled outage…"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#0D1117', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 4, color: '#F8FAFC', fontSize: '0.7rem', padding: '0.25rem 0.45rem',
                outline: 'none',
              }}
            />
          </div>
          {/* set_by */}
          <div style={{ marginBottom: '0.55rem' }}>
            <div style={{ color: '#64748b', fontSize: '0.67rem', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
              Set By
            </div>
            <input
              value={draft.set_by}
              onChange={(e) => setDraft((d) => ({ ...d, set_by: e.target.value }))}
              placeholder="operator"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#0D1117', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 4, color: '#F8FAFC', fontSize: '0.7rem', padding: '0.25rem 0.45rem',
                outline: 'none',
              }}
            />
          </div>
          <ScriptListEditor
            label="Force Skip (never retry)"
            color="#ef4444"
            values={draft.force_skip_scripts}
            onChange={(v) => setDraft((d) => ({ ...d, force_skip_scripts: v }))}
          />
          <ScriptListEditor
            label="Force Manual Attention (pull from queue)"
            color="#f59e0b"
            values={draft.force_manual_attention_scripts}
            onChange={(v) => setDraft((d) => ({ ...d, force_manual_attention_scripts: v }))}
          />
          <ScriptListEditor
            label="Force Allow Retry (unblock policy/healing)"
            color="#22c55e"
            values={draft.force_allow_retry_scripts}
            onChange={(v) => setDraft((d) => ({ ...d, force_allow_retry_scripts: v }))}
          />

          {error && (
            <div style={{ color: '#f87171', fontSize: '0.68rem', marginBottom: '0.4rem' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.3rem' }}>
            <button
              onClick={save}
              disabled={saving}
              style={{
                background: '#22c55e20', border: '1px solid #22c55e40', borderRadius: 6,
                color: '#22c55e', cursor: saving ? 'default' : 'pointer',
                fontSize: '0.7rem', fontWeight: 600, padding: '0.22rem 0.7rem',
                opacity: saving ? 0.6 : 1,
              }}
            >{saving ? 'Saving…' : 'Save'}</button>
            <button
              onClick={cancel}
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6, color: '#64748b', cursor: 'pointer',
                fontSize: '0.7rem', padding: '0.22rem 0.7rem',
              }}
            >Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
