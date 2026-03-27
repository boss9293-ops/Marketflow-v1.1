"""
Pipeline Predictive Risk Service  (WO-W18)
==========================================
Deterministic scoring of near-term pipeline failure risk.

Data sources (read-only):
  output/pipeline_history.json              — run history, newest first
  output/cache/pipeline_retry_audit.json    — per-run retry counts
  output/cache/pipeline_episode_log.json    — computed episodes, newest first
  output/cache/pipeline_ops_mode.json       — operator mode config

Output schema:
  {
    ok:                  bool,
    failure_risk_score:  int,          # 0..100
    failure_risk_label:  str,          # low | watch | elevated | high
    predicted_mode:      str,          # stable | fragile | degrading | at_risk
    top_risk_factors:    list,         # [{signal, description, points}]  top 3
    inputs:              dict,
  }

Signal budget (raw sum capped at 100):
  recent_failure_rate   0-30   failure % over last 10 runs
  failure_streak        0-25   consecutive failures at head of history
  active_episode        0-20   severity of open episode
  recent_episode        0-15   severity × recency of latest resolved episode
  recurring_root_cause  0-15   same root_cause across ≥2 recent episodes
  retry_failure_rate    0-10   fraction of retried runs that failed to recover
  duration_anomaly      0-10   latest run duration vs 10-run median
  manual_attention      0-10   scripts flagged for manual attention in ops mode
  maintenance_mode      0-10   operator maintenance gate active
"""

import json
import os
import statistics
from collections import Counter
from datetime import datetime, timezone

# ── paths ──────────────────────────────────────────────────────────────────────

_HERE         = os.path.dirname(os.path.abspath(__file__))
_OUTPUT_DIR   = os.path.join(_HERE, '..', 'output')
_HISTORY_PATH = os.path.join(_OUTPUT_DIR, 'pipeline_history.json')
_AUDIT_PATH   = os.path.join(_OUTPUT_DIR, 'cache', 'pipeline_retry_audit.json')
_EPISODE_PATH = os.path.join(_OUTPUT_DIR, 'cache', 'pipeline_episode_log.json')
_OPS_PATH     = os.path.join(_OUTPUT_DIR, 'cache', 'pipeline_ops_mode.json')

_HISTORY_WINDOW  = 10   # runs examined for rate / streak / duration
_EPISODE_WINDOW  = 14   # days to look back for recent-episode signal

# ── helpers ────────────────────────────────────────────────────────────────────

def _load_json_safe(path: str):
    """Return parsed JSON or None. Never raises."""
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return None


def _is_failure(run: dict) -> bool:
    return (
        run.get('status', 'unknown') != 'success'
        or int(run.get('scripts_failed', 0) or 0) > 0
    )


def _days_ago(ts: str) -> float:
    """Elapsed days since ISO timestamp; returns 9999.0 on any error."""
    if not ts:
        return 9999.0
    try:
        dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        return (now - dt).total_seconds() / 86400.0
    except Exception:
        return 9999.0

# ── signal functions ───────────────────────────────────────────────────────────
# Each returns (points: int, signal_name: str, description: str)

def _sig_recent_failure_rate(history: list) -> tuple:
    recent = history[:_HISTORY_WINDOW]
    if not recent:
        return 0, 'recent_failure_rate', 'No run history available'
    n_fail = sum(1 for r in recent if _is_failure(r))
    pct = n_fail / len(recent)
    if pct == 0:
        pts = 0
    elif pct <= 0.20:
        pts = 8
    elif pct <= 0.40:
        pts = 15
    elif pct <= 0.60:
        pts = 22
    else:
        pts = 30
    desc = f'{n_fail}/{len(recent)} recent runs failed ({pct:.0%})'
    return pts, 'recent_failure_rate', desc


def _sig_failure_streak(history: list) -> tuple:
    streak = 0
    for run in history:
        if _is_failure(run):
            streak += 1
        else:
            break
    if streak == 0:
        pts = 0
    elif streak == 1:
        pts = 10
    elif streak == 2:
        pts = 18
    else:
        pts = 25
    desc = (
        f'{streak} consecutive failure{"s" if streak != 1 else ""}'
        ' at head of history' if streak else 'No current failure streak'
    )
    return pts, 'failure_streak', desc


def _sig_active_episode(episodes: list) -> tuple:
    if not episodes or episodes[0].get('status') != 'active':
        return 0, 'active_episode', 'No active episode'
    ep  = episodes[0]
    sev = ep.get('severity', 'low')
    pts = {'low': 8, 'medium': 14, 'high': 18, 'critical': 20}.get(sev, 8)
    desc = (
        f'Active {sev} episode open since {ep.get("start_time", "?")[:16]}'
        f' ({ep.get("duration_runs", 0)}r, {ep.get("failure_count", 0)}f)'
    )
    return pts, 'active_episode', desc


def _sig_recent_episode(episodes: list) -> tuple:
    resolved = [e for e in episodes if e.get('status') == 'resolved']
    if not resolved:
        return 0, 'recent_episode', 'No resolved episodes'
    ep   = resolved[0]
    days = _days_ago(ep.get('end_time') or ep.get('start_time', ''))
    sev  = ep.get('severity', 'low')
    if days > _EPISODE_WINDOW:
        return 0, 'recent_episode', f'Last resolved episode >{_EPISODE_WINDOW}d ago'
    if sev == 'critical':
        pts = 15 if days <= 7 else 10
    elif sev == 'high':
        pts = 12 if days <= 7 else 8
    elif sev == 'medium':
        pts = 8 if days <= 7 else 5
    else:
        pts = 4
    desc = f'{sev} episode resolved {days:.1f}d ago ({ep["episode_id"]})'
    return pts, 'recent_episode', desc


def _sig_recurring_root_cause(episodes: list) -> tuple:
    recent = [e for e in episodes if _days_ago(e.get('start_time', '')) <= 30]
    if len(recent) < 2:
        return 0, 'recurring_root_cause', 'Fewer than 2 episodes in last 30d'
    counts    = Counter(e.get('root_cause', 'transient') for e in recent)
    top_cause, top_n = counts.most_common(1)[0]
    if top_n < 2:
        return 0, 'recurring_root_cause', 'No recurring root cause'
    if top_cause in ('systemic', 'recurring'):
        pts = 15 if top_n >= 3 else 10
    elif top_cause == 'intermittent':
        pts = 5
    else:
        pts = 0
    desc = (
        f'Root cause "{top_cause}" in {top_n}/{len(recent)} recent episode'
        f'{"s" if len(recent) != 1 else ""}'
    )
    return pts, 'recurring_root_cause', desc


def _sig_retry_failure_rate(audit: list) -> tuple:
    if not audit:
        return 0, 'retry_failure_rate', 'No retry audit data'
    retried = [e for e in audit if int(e.get('total_attempts', 0) or 0) > 0]
    if not retried:
        return 0, 'retry_failure_rate', 'No retried runs recorded'
    attempted = sum(int(e.get('total_attempts', 0) or 0) for e in retried)
    recovered = sum(int(e.get('recovered', 0)       or 0) for e in retried)
    if attempted == 0:
        return 0, 'retry_failure_rate', 'No retry attempts'
    rate = recovered / attempted
    if rate >= 0.80:
        pts = 2
    elif rate >= 0.50:
        pts = 5
    else:
        pts = 10
    desc = f'Retry recovery rate {rate:.0%} ({recovered}/{attempted} attempts)'
    return pts, 'retry_failure_rate', desc


def _sig_duration_anomaly(history: list) -> tuple:
    durations = [
        float(r['duration_sec'])
        for r in history[:_HISTORY_WINDOW]
        if r.get('duration_sec') is not None
    ]
    if len(durations) < 3:
        return 0, 'duration_anomaly', 'Not enough duration data'
    latest = durations[0]
    median = statistics.median(durations[1:])
    if median <= 0:
        return 0, 'duration_anomaly', 'Median duration is zero'
    spike = (latest - median) / median
    if spike < 0.20:
        pts = 0
    elif spike < 0.50:
        pts = 4
    elif spike < 1.00:
        pts = 7
    else:
        pts = 10
    sign = '+' if spike >= 0 else ''
    desc = f'Last run {latest:.0f}s vs median {median:.0f}s ({sign}{spike:.0%})'
    return pts, 'duration_anomaly', desc


def _sig_manual_attention(ops: dict) -> tuple:
    if not ops:
        return 0, 'manual_attention', 'No ops mode config'
    scripts = ops.get('force_manual_attention_scripts', [])
    n = len(scripts) if isinstance(scripts, list) else 0
    pts = 0 if n == 0 else (5 if n == 1 else 10)
    noun = 'script' if n == 1 else 'scripts'
    desc = f'{n} {noun} flagged for manual attention' if n else 'No manual attention flags'
    return pts, 'manual_attention', desc


def _sig_maintenance_mode(ops: dict) -> tuple:
    if not ops or not ops.get('enabled'):
        return 0, 'maintenance_mode', 'Maintenance mode not active'
    reason = ops.get('reason') or 'operator set'
    desc   = f'Maintenance mode active: "{reason}"'
    return 10, 'maintenance_mode', desc

# ── classification ─────────────────────────────────────────────────────────────

_LABEL_THRESHOLDS = ((75, 'high'), (50, 'elevated'), (25, 'watch'), (0, 'low'))


def _label(score: int) -> str:
    for threshold, lbl in _LABEL_THRESHOLDS:
        if score >= threshold:
            return lbl
    return 'low'


def _predicted_mode(
    score: int, active_ep_pts: int, recent_ep_pts: int, recurring_pts: int
) -> str:
    if score >= 75 or active_ep_pts > 0:
        return 'at_risk'
    if score >= 50 or recurring_pts > 0:
        return 'degrading'
    if score >= 25 or recent_ep_pts > 0:
        return 'fragile'
    return 'stable'

# ── public API ─────────────────────────────────────────────────────────────────

def compute_predictive() -> dict:
    """
    Derive deterministic pipeline failure risk score from recent history data.

    Returns a JSON-serialisable dict with failure_risk_score, failure_risk_label,
    predicted_mode, top_risk_factors, and inputs summary.
    """
    history  = _load_json_safe(_HISTORY_PATH)
    audit    = _load_json_safe(_AUDIT_PATH)
    episodes = _load_json_safe(_EPISODE_PATH)
    ops      = _load_json_safe(_OPS_PATH)

    history  = history  if isinstance(history,  list) else []
    audit    = audit    if isinstance(audit,     list) else []
    episodes = episodes if isinstance(episodes,  list) else []
    ops      = ops      if isinstance(ops,       dict) else {}

    if not history:
        return {
            'ok':                 False,
            'failure_risk_score': 0,
            'failure_risk_label': 'low',
            'predicted_mode':     'stable',
            'top_risk_factors':   [],
            'inputs': {
                'history': False, 'audit': bool(audit),
                'episodes': bool(episodes), 'ops': bool(ops),
            },
            'error': 'pipeline_history.json not available',
        }

    signals = [
        _sig_recent_failure_rate(history),
        _sig_failure_streak(history),
        _sig_active_episode(episodes),
        _sig_recent_episode(episodes),
        _sig_recurring_root_cause(episodes),
        _sig_retry_failure_rate(audit),
        _sig_duration_anomaly(history),
        _sig_manual_attention(ops),
        _sig_maintenance_mode(ops),
    ]
    # signals → (pts, name, desc)

    raw_score = sum(s[0] for s in signals)
    score     = min(100, raw_score)

    active_ep_pts  = signals[2][0]
    recent_ep_pts  = signals[3][0]
    recurring_pts  = signals[4][0]

    factors = sorted(
        [{'signal': s[1], 'description': s[2], 'points': s[0]} for s in signals if s[0] > 0],
        key=lambda x: -x['points'],
    )[:3]

    return {
        'ok':                 True,
        'failure_risk_score': score,
        'failure_risk_label': _label(score),
        'predicted_mode':     _predicted_mode(score, active_ep_pts, recent_ep_pts, recurring_pts),
        'top_risk_factors':   factors,
        'inputs': {
            'history_runs':        len(history),
            'audit_entries':       len(audit),
            'episode_count':       len(episodes),
            'ops_mode_enabled':    bool(ops.get('enabled')),
            'history_window':      _HISTORY_WINDOW,
            'episode_window_days': _EPISODE_WINDOW,
        },
    }
