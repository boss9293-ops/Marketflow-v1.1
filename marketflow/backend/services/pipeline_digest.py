"""
Pipeline Digest Service  (WO-W20)
==================================
Top-level operator digest: deterministic 1–3 sentence summary of the entire
pipeline state, combining predictive risk, runbook, episode, and ops signals.

No AI/ML.  All text produced by fixed template rules.

Output schema:
  {
    ok:         bool,
    state:      str,   # mirrors runbook_state: normal | observe | intervene | manual_required
    priority:   str,   # low | medium | high | critical
    summary:    str,   # 1–3 deterministic sentences
    highlights: list,  # 2–3 short bullet strings
    inputs:     dict,
  }
"""

import json
import os
from datetime import datetime, timezone

# ── paths ──────────────────────────────────────────────────────────────────────

_HERE       = os.path.dirname(os.path.abspath(__file__))
_OUTPUT_DIR = os.path.join(_HERE, '..', 'output')

# ── helpers ────────────────────────────────────────────────────────────────────

def _load_json_safe(path: str):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return None


def _days_ago(ts: str) -> float:
    if not ts:
        return 9999.0
    try:
        dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - dt).total_seconds() / 86_400.0
    except Exception:
        return 9999.0

# ── sentence builders ──────────────────────────────────────────────────────────

_STATE_OPENING = {
    'normal':          'Pipeline is operating normally',
    'observe':         'Pipeline is in a {label} state (risk score {score}/100, {mode})',
    'intervene':       'Pipeline requires attention (risk score {score}/100, {mode})',
    'manual_required': 'Pipeline requires immediate operator intervention (risk score {score}/100)',
}

_POSTURE = {
    'normal':          'No action required — continue routine monitoring.',
    'observe':         'Monitor the next 2–3 runs and escalate if the failure rate increases.',
    'intervene':       'Investigate {top_action} before the next scheduled run.',
    'manual_required': 'Immediate operator action required: {top_action}.',
}

_MODE_LABEL = {
    'stable':    'stable mode',
    'fragile':   'fragile mode',
    'degrading': 'degrading mode',
    'at_risk':   'at-risk mode',
}

_SEV_ORDER = {'critical': 4, 'high': 3, 'medium': 2, 'low': 1}


def _build_sentence1(state: str, score: int, label: str, mode: str) -> str:
    tmpl = _STATE_OPENING.get(state, _STATE_OPENING['observe'])
    mode_str = _MODE_LABEL.get(mode, f'{mode} mode')
    return tmpl.format(score=score, label=label, mode=mode_str)


def _build_sentence2(active_ep: dict | None, recent_ep: dict | None, recent_days: float) -> str | None:
    if active_ep:
        sev  = active_ep.get('severity', 'unknown')
        runs = active_ep.get('duration_runs', 0)
        fail = active_ep.get('failure_count', 0)
        return (
            f'An active {sev} incident has been running for {runs} run(s)'
            f' with {fail} failure(s).'
        )
    if recent_ep and recent_days <= 3.0:
        sev  = recent_ep.get('severity', 'unknown')
        d    = round(recent_days, 1)
        return f'A {sev} incident resolved {d}d ago — monitor for recurrence.'
    return None


def _build_sentence3(state: str, top_action: dict | None) -> str:
    tmpl = _POSTURE.get(state, _POSTURE['observe'])
    if top_action:
        # Lower-case first letter of the action title for mid-sentence embedding
        title = top_action.get('title', 'top action')
        title_lc = title[0].lower() + title[1:] if title else 'top action'
        return tmpl.format(top_action=title_lc)
    return tmpl.format(top_action='the highest-priority issue')


def _build_highlights(
    score: int, label: str, streak: int,
    active_ep: dict | None, recent_ep: dict | None, recent_days: float,
    top_action: dict | None,
    history_len: int,
) -> list:
    items = []

    # Highlight 1: risk score
    items.append(f'Risk score {score}/100 — {label}')

    # Highlight 2: incident / streak
    if active_ep:
        sev  = active_ep.get('severity', '?')
        runs = active_ep.get('duration_runs', 0)
        items.append(f'Active {sev} incident ({runs} run(s) open)')
    elif recent_ep and recent_days <= 3.0:
        sev = recent_ep.get('severity', '?')
        items.append(f'{sev.capitalize()} incident resolved {round(recent_days, 1)}d ago')
    elif streak > 0:
        items.append(f'Current failure streak: {streak} run(s)')
    else:
        clean = min(history_len, 20)
        items.append(f'{clean} recent run(s) clean — no active incident')

    # Highlight 3: top recommended action (if not redundant with incident)
    if top_action:
        pri   = top_action.get('priority', 'low')
        title = top_action.get('title', '—')
        items.append(f'{pri.capitalize()}: {title}')

    return items[:3]

# ── public API ─────────────────────────────────────────────────────────────────

def compute_digest() -> dict:
    """
    Build a deterministic operator digest combining predictive + runbook signals.

    Returns a JSON-serialisable dict with state, priority, summary, and highlights.
    """
    try:
        from services.pipeline_predictive import compute_predictive
        from services.pipeline_runbook    import compute_runbook

        pred    = compute_predictive()
        runbook = compute_runbook()
    except Exception as exc:
        return {
            'ok':         False,
            'state':      'normal',
            'priority':   'low',
            'summary':    'Digest unavailable — unable to load pipeline signals.',
            'highlights': [],
            'inputs':     {},
            'error':      str(exc),
        }

    # Unpack predictive
    score  = int(pred.get('failure_risk_score', 0)  or 0)
    label  = pred.get('failure_risk_label', 'low')  or 'low'
    mode   = pred.get('predicted_mode',    'stable') or 'stable'

    # Unpack runbook
    state    = runbook.get('runbook_state', 'normal') or 'normal'
    priority = runbook.get('priority',      'low')    or 'low'
    actions  = runbook.get('recommended_actions', []) or []
    top_act  = actions[0] if actions else None

    # Load episodes to build sentence 2
    ep_path  = os.path.join(_OUTPUT_DIR, 'cache', 'pipeline_episode_log.json')
    episodes = _load_json_safe(ep_path)
    episodes = episodes if isinstance(episodes, list) else []

    active_ep  = episodes[0] if episodes and episodes[0].get('status') == 'active' else None
    resolved   = [e for e in episodes if e.get('status') == 'resolved']
    recent_ep  = resolved[0] if resolved else None
    recent_days = _days_ago(
        (recent_ep or {}).get('end_time') or (recent_ep or {}).get('start_time', '')
    ) if recent_ep else 9999.0

    # Load history for streak / highlights
    hist_path = os.path.join(_OUTPUT_DIR, 'pipeline_history.json')
    history   = _load_json_safe(hist_path)
    history   = history if isinstance(history, list) else []

    streak = 0
    for run in history:
        if run.get('status', 'unknown') != 'success' or int(run.get('scripts_failed', 0) or 0) > 0:
            streak += 1
        else:
            break

    # Build sentences
    s1 = _build_sentence1(state, score, label, mode) + '.'
    s2 = _build_sentence2(active_ep, recent_ep, recent_days)
    s3 = _build_sentence3(state, top_act)

    sentences = [s1]
    if s2:
        sentences.append(s2)
    sentences.append(s3)

    summary = ' '.join(sentences)

    highlights = _build_highlights(
        score, label, streak, active_ep, recent_ep, recent_days,
        top_act, len(history),
    )

    return {
        'ok':         True,
        'state':      state,
        'priority':   priority,
        'summary':    summary,
        'highlights': highlights,
        'inputs': {
            'predictive_score': score,
            'predictive_label': label,
            'predicted_mode':   mode,
            'runbook_state':    state,
            'active_episode':   active_ep['episode_id'] if active_ep else None,
            'recent_ep_days':   round(recent_days, 2) if recent_ep else None,
            'history_runs':     len(history),
            'action_count':     len(actions),
        },
    }
