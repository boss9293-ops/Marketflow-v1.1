"""
Pipeline Runbook Service  (WO-W19)
===================================
Deterministic operator runbook: maps current pipeline state into prioritised
recommended actions — no auto-execution, no side effects.

Data sources (read-only):
  services.pipeline_predictive.compute_predictive()  — risk score + factors
  output/pipeline_history.json                       — run history, newest first
  output/cache/pipeline_episode_log.json             — computed episodes
  output/cache/pipeline_ops_mode.json                — operator mode config
  output/cache/pipeline_retry_audit.json             — per-run retry counts

Output schema:
  {
    ok:                  bool,
    runbook_state:       str,   # normal | observe | intervene | manual_required
    priority:            str,   # low | medium | high | critical
    recommended_actions: list,  # [{action_id, category, priority, title, description}]
    inputs:              dict,
  }

Runbook state machine:
  manual_required — any critical action present
  intervene       — any high action, no critical
  observe         — any medium action, no high/critical
  normal          — only low actions or none

Action categories:
  monitor             routine watch / health check
  retry_policy        tune retry settings or cooldown
  data_integrity      validate output files / schemas
  dependency_check    verify upstream data sources
  manual_investigation hands-on operator investigation required
  maintenance_control toggle operator maintenance gate

Priority ladder (used for both actions and overall runbook state):
  low → medium → high → critical
"""

import json
import os
from datetime import datetime, timezone

# ── paths ──────────────────────────────────────────────────────────────────────

_HERE         = os.path.dirname(os.path.abspath(__file__))
_OUTPUT_DIR   = os.path.join(_HERE, '..', 'output')
_HISTORY_PATH = os.path.join(_OUTPUT_DIR, 'pipeline_history.json')
_EPISODE_PATH = os.path.join(_OUTPUT_DIR, 'cache', 'pipeline_episode_log.json')
_OPS_PATH     = os.path.join(_OUTPUT_DIR, 'cache', 'pipeline_ops_mode.json')
_AUDIT_PATH   = os.path.join(_OUTPUT_DIR, 'cache', 'pipeline_retry_audit.json')

_PRIORITY_RANK = {'low': 0, 'medium': 1, 'high': 2, 'critical': 3}

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


def _is_failure(run: dict) -> bool:
    return (
        run.get('status', 'unknown') != 'success'
        or int(run.get('scripts_failed', 0) or 0) > 0
    )

# ── context builder ────────────────────────────────────────────────────────────

def _build_context() -> dict:
    """Collect all signals needed by the runbook rules."""
    from services.pipeline_predictive import compute_predictive

    pred     = compute_predictive()
    history  = _load_json_safe(_HISTORY_PATH)
    episodes = _load_json_safe(_EPISODE_PATH)
    ops      = _load_json_safe(_OPS_PATH)
    audit    = _load_json_safe(_AUDIT_PATH)

    history  = history  if isinstance(history,  list) else []
    episodes = episodes if isinstance(episodes, list) else []
    ops      = ops      if isinstance(ops,      dict) else {}
    audit    = audit    if isinstance(audit,    list) else []

    # Active episode
    active_ep = (
        episodes[0]
        if episodes and episodes[0].get('status') == 'active'
        else None
    )

    # Most recent resolved episode
    resolved_eps = [e for e in episodes if e.get('status') == 'resolved']
    recent_ep    = resolved_eps[0] if resolved_eps else None

    # Recurring root cause in last 30 days
    recent_all = [e for e in episodes if _days_ago(e.get('start_time', '')) <= 30]
    cause_freq: dict = {}
    for e in recent_all:
        c = e.get('root_cause', 'transient')
        cause_freq[c] = cause_freq.get(c, 0) + 1
    recurring_cause = None
    recurring_count = 0
    for cause, cnt in cause_freq.items():
        if cnt >= 2 and _PRIORITY_RANK.get(cause, 0) >= _PRIORITY_RANK.get(recurring_cause or 'transient', 0):
            # Prefer systemic > recurring > intermittent > transient
            if cause in ('systemic', 'recurring', 'intermittent'):
                recurring_cause = cause
                recurring_count = cnt

    # Retry audit summary
    retried    = [e for e in audit if int(e.get('total_attempts', 0) or 0) > 0]
    attempted  = sum(int(e.get('total_attempts', 0) or 0) for e in retried)
    recovered  = sum(int(e.get('recovered',       0) or 0) for e in retried)
    retry_rate = (recovered / attempted) if attempted > 0 else None

    # Last run detail
    last_run         = history[0] if history else {}
    last_failed_count = int(last_run.get('scripts_failed', 0) or 0)

    # Recent failure streak
    streak = 0
    for run in history:
        if _is_failure(run):
            streak += 1
        else:
            break

    # Duration anomaly (latest vs 10-run median)
    durations = [
        float(r['duration_sec'])
        for r in history[:10]
        if r.get('duration_sec') is not None
    ]
    duration_spike = None
    if len(durations) >= 3:
        import statistics
        median = statistics.median(durations[1:])
        if median > 0:
            duration_spike = (durations[0] - median) / median

    return {
        'pred':            pred,
        'score':           pred.get('failure_risk_score', 0),
        'label':           pred.get('failure_risk_label', 'low'),
        'mode':            pred.get('predicted_mode', 'stable'),
        'active_ep':       active_ep,
        'recent_ep':       recent_ep,
        'recent_ep_days':  _days_ago((recent_ep or {}).get('end_time') or (recent_ep or {}).get('start_time', '')),
        'recurring_cause': recurring_cause,
        'recurring_count': recurring_count,
        'retry_rate':      retry_rate,
        'retry_attempted': attempted,
        'ops':             ops,
        'maintenance_on':  bool(ops.get('enabled')),
        'manual_scripts':  list(ops.get('force_manual_attention_scripts', []) or []),
        'skip_scripts':    list(ops.get('force_skip_scripts', []) or []),
        'last_run':        last_run,
        'last_failed_count': last_failed_count,
        'streak':          streak,
        'duration_spike':  duration_spike,
        'history_len':     len(history),
        'episode_count':   len(episodes),
    }

# ── rule functions ─────────────────────────────────────────────────────────────
# Each rule receives ctx and returns an action dict or None.
# Evaluated in order; deduplication by action_id.

def _rule_active_incident_critical(ctx) -> dict | None:
    ep = ctx['active_ep']
    if not ep or ep.get('severity') not in ('critical', 'high'):
        return None
    sev = ep['severity']
    return {
        'action_id':   'investigate_active_incident',
        'category':    'manual_investigation',
        'priority':    'critical',
        'title':       f'Investigate active {sev} incident immediately',
        'description': (
            f'Episode {ep["episode_id"]} open since {ep.get("start_time", "?")[:16]}'
            f' — {ep.get("duration_runs", 0)} runs, {ep.get("failure_count", 0)} failures,'
            f' root cause: {ep.get("root_cause", "unknown")}.'
            ' Review run logs now and identify failing scripts.'
        ),
    }


def _rule_manual_attention_scripts(ctx) -> dict | None:
    scripts = ctx['manual_scripts']
    if not scripts:
        return None
    names = ', '.join(scripts[:4]) + (f' (+{len(scripts) - 4} more)' if len(scripts) > 4 else '')
    return {
        'action_id':   'review_manual_attention_scripts',
        'category':    'manual_investigation',
        'priority':    'critical',
        'title':       f'Review {len(scripts)} manually-flagged script{"s" if len(scripts) != 1 else ""}',
        'description': (
            f'Operator has flagged {names} for manual attention.'
            ' These scripts are excluded from auto-retry.'
            ' Investigate failure cause before re-queueing.'
        ),
    }


def _rule_suggest_maintenance_mode(ctx) -> dict | None:
    """Suggest enabling maintenance mode when risk is high and it's not already on."""
    if ctx['maintenance_on'] or ctx['score'] < 75:
        return None
    return {
        'action_id':   'enable_maintenance_mode',
        'category':    'maintenance_control',
        'priority':    'critical',
        'title':       'Enable maintenance mode to halt auto-retry',
        'description': (
            f'Risk score is {ctx["score"]}/100 ({ctx["label"]}). '
            'Auto-retry under sustained failures can amplify load.'
            ' Enable maintenance mode via the Operator Mode card while investigating.'
        ),
    }


def _rule_active_incident_moderate(ctx) -> dict | None:
    ep = ctx['active_ep']
    if not ep or ep.get('severity') not in ('low', 'medium'):
        return None
    sev = ep['severity']
    return {
        'action_id':   'monitor_active_incident',
        'category':    'manual_investigation',
        'priority':    'high',
        'title':       f'Monitor active {sev} incident',
        'description': (
            f'Episode {ep["episode_id"]} has been open for {ep.get("duration_runs", 0)} run(s)'
            f' with {ep.get("failure_count", 0)} failure(s).'
            f' Root cause: {ep.get("root_cause", "unknown")}.'
            ' Verify next scheduled run resolves the issue.'
        ),
    }


def _rule_recurring_root_cause(ctx) -> dict | None:
    cause = ctx['recurring_cause']
    count = ctx['recurring_count']
    if not cause:
        return None
    if cause in ('systemic', 'recurring'):
        pri  = 'high'
        note = 'This pattern is structural — check shared dependencies or config drift.'
    else:
        pri  = 'high'
        note = 'Intermittent failures at this frequency may indicate an unstable dependency.'
    return {
        'action_id':   'investigate_recurring_pattern',
        'category':    'manual_investigation',
        'priority':    pri,
        'title':       f'Investigate recurring "{cause}" root cause',
        'description': (
            f'Root cause "{cause}" has appeared in {count} episodes within the last 30 days.'
            f' {note}'
        ),
    }


def _rule_data_integrity(ctx) -> dict | None:
    ep    = ctx['active_ep'] or ctx['recent_ep']
    score = ctx['score']
    peak  = int((ep or {}).get('scripts_failed_peak', 0)) if ep else 0
    if score < 50 and peak < 5:
        return None
    trigger = (
        f'risk score {score}/100' if score >= 50
        else f'{peak} scripts affected at episode peak'
    )
    return {
        'action_id':   'verify_data_integrity',
        'category':    'data_integrity',
        'priority':    'high',
        'title':       'Verify output data integrity',
        'description': (
            f'Elevated failure level ({trigger}) may have left output files incomplete.'
            ' Run a spot-check on key JSON outputs (pipeline_history, risk_v1, market_health)'
            ' to confirm they have valid schemas and current timestamps.'
        ),
    }


def _rule_review_maintenance_mode_off(ctx) -> dict | None:
    """Suggest disabling maintenance mode when pipeline looks healthy."""
    if not ctx['maintenance_on'] or ctx['score'] >= 50:
        return None
    reason = ctx['ops'].get('reason') or 'no reason recorded'
    return {
        'action_id':   'disable_maintenance_mode',
        'category':    'maintenance_control',
        'priority':    'high',
        'title':       'Consider disabling maintenance mode',
        'description': (
            f'Maintenance mode is active ("{reason}") but risk score is {ctx["score"]}/100'
            f' ({ctx["label"]}) — pipeline looks relatively healthy.'
            ' Re-enable auto-retry once you have confirmed the issue is resolved.'
        ),
    }


def _rule_failed_scripts_last_run(ctx) -> dict | None:
    n   = ctx['last_failed_count']
    run = ctx['last_run']
    if n == 0:
        return None
    ts = run.get('timestamp', '?')[:16]
    return {
        'action_id':   'check_last_run_failures',
        'category':    'dependency_check',
        'priority':    'medium',
        'title':       f'Investigate {n} failed script{"s" if n != 1 else ""} in last run',
        'description': (
            f'Last run at {ts} had {n} failed script{"s" if n != 1 else ""}.'
            ' Check run log for error details.'
            ' Verify data source availability and authentication tokens are current.'
        ),
    }


def _rule_retry_recovery_poor(ctx) -> dict | None:
    rate = ctx['retry_rate']
    att  = ctx['retry_attempted']
    if rate is None or rate >= 0.80:
        return None
    rec = round(rate * att)
    return {
        'action_id':   'review_retry_policy',
        'category':    'retry_policy',
        'priority':    'medium',
        'title':       'Review retry policy — low recovery rate',
        'description': (
            f'Retry recovery rate is {rate:.0%} ({rec}/{att} attempts recovered).'
            ' Consider increasing cooldown between retries or reducing max_retry_per_script'
            ' for scripts with structural failures that retrying cannot fix.'
        ),
    }


def _rule_post_incident_monitor(ctx) -> dict | None:
    ep   = ctx['recent_ep']
    days = ctx['recent_ep_days']
    if not ep or days > 3 or ctx['active_ep']:
        return None
    sev = ep.get('severity', 'low')
    return {
        'action_id':   'monitor_post_incident',
        'category':    'monitor',
        'priority':    'medium',
        'title':       f'Monitor post-incident recovery ({sev} episode resolved {days:.1f}d ago)',
        'description': (
            f'Episode {ep["episode_id"]} resolved {days:.1f}d ago.'
            ' Confirm the next 2-3 pipeline runs complete cleanly before declaring full recovery.'
            ' Watch for recurrence of the same root cause.'
        ),
    }


def _rule_duration_spike(ctx) -> dict | None:
    spike = ctx['duration_spike']
    if spike is None or spike < 0.50:
        return None
    durations = [
        float(r['duration_sec'])
        for r in (_load_json_safe(_HISTORY_PATH) or [])[:10]
        if r.get('duration_sec') is not None
    ]
    latest = durations[0] if durations else 0
    return {
        'action_id':   'investigate_duration_spike',
        'category':    'dependency_check',
        'priority':    'medium',
        'title':       f'Investigate duration spike (+{spike:.0%} over median)',
        'description': (
            f'Last run took {latest:.0f}s — {spike:.0%} above the recent median.'
            ' This may indicate a slow upstream API, network congestion,'
            ' or a script entering a retry loop.'
            ' Check run logs for unusually long-running steps.'
        ),
    }


def _rule_skip_scripts_active(ctx) -> dict | None:
    scripts = ctx['skip_scripts']
    if not scripts:
        return None
    names = ', '.join(scripts[:3]) + (f' (+{len(scripts) - 3} more)' if len(scripts) > 3 else '')
    return {
        'action_id':   'review_skip_scripts',
        'category':    'retry_policy',
        'priority':    'medium',
        'title':       f'Review force-skipped script{"s" if len(scripts) != 1 else ""}',
        'description': (
            f'{len(scripts)} script{"s are" if len(scripts) != 1 else " is"} permanently'
            f' force-skipped: {names}.'
            ' Confirm these exclusions are still intentional and that downstream'
            ' consumers do not depend on their output.'
        ),
    }


def _rule_watch_failure_rate(ctx) -> dict | None:
    if ctx['score'] == 0 or ctx['score'] >= 50:
        return None  # covered by higher-priority rules above 50
    score = ctx['score']
    label = ctx['label']
    return {
        'action_id':   'watch_failure_rate',
        'category':    'monitor',
        'priority':    'low',
        'title':       f'Watch failure rate — risk score {score} ({label})',
        'description': (
            f'Risk score is {score}/100 ({label}) — below action threshold but above baseline.'
            ' Continue monitoring. If score rises above 50, escalate to dependency check'
            ' and data integrity verification.'
        ),
    }


def _rule_all_clear(ctx) -> dict | None:
    if ctx['score'] > 0 or ctx['active_ep'] or ctx['streak'] > 0:
        return None
    streak_clean = ctx['history_len']
    return {
        'action_id':   'routine_monitor',
        'category':    'monitor',
        'priority':    'low',
        'title':       'Routine monitoring — pipeline healthy',
        'description': (
            f'No risk signals detected across {ctx["history_len"]} recent run(s).'
            ' Pipeline is operating normally.'
            ' No operator action required.'
        ),
    }

# ── ordered rule registry ──────────────────────────────────────────────────────

_RULES = [
    _rule_active_incident_critical,
    _rule_manual_attention_scripts,
    _rule_suggest_maintenance_mode,
    _rule_active_incident_moderate,
    _rule_recurring_root_cause,
    _rule_data_integrity,
    _rule_review_maintenance_mode_off,
    _rule_failed_scripts_last_run,
    _rule_retry_recovery_poor,
    _rule_post_incident_monitor,
    _rule_duration_spike,
    _rule_skip_scripts_active,
    _rule_watch_failure_rate,
    _rule_all_clear,
]

# ── classification ─────────────────────────────────────────────────────────────

def _runbook_state(actions: list) -> str:
    if not actions:
        return 'normal'
    top = max(_PRIORITY_RANK.get(a['priority'], 0) for a in actions)
    return {3: 'manual_required', 2: 'intervene', 1: 'observe', 0: 'normal'}[top]


def _overall_priority(state: str) -> str:
    return {'manual_required': 'critical', 'intervene': 'high',
            'observe': 'medium', 'normal': 'low'}[state]

# ── public API ─────────────────────────────────────────────────────────────────

def compute_runbook() -> dict:
    """
    Apply deterministic runbook rules to current pipeline state.

    Returns a JSON-serialisable dict with runbook_state, priority,
    recommended_actions, and inputs summary.
    """
    try:
        ctx = _build_context()
    except Exception as exc:
        return {
            'ok':                  False,
            'runbook_state':       'normal',
            'priority':            'low',
            'recommended_actions': [],
            'inputs':              {},
            'error':               str(exc),
        }

    # Apply all rules; deduplicate by action_id (first wins)
    seen:    set    = set()
    actions: list   = []
    for rule in _RULES:
        try:
            act = rule(ctx)
        except Exception:
            continue
        if act is None or act['action_id'] in seen:
            continue
        seen.add(act['action_id'])
        actions.append(act)

    # Sort: critical → high → medium → low, stable within tier
    actions.sort(key=lambda a: -_PRIORITY_RANK.get(a['priority'], 0))

    state    = _runbook_state(actions)
    priority = _overall_priority(state)

    return {
        'ok':                  True,
        'runbook_state':       state,
        'priority':            priority,
        'recommended_actions': actions,
        'inputs': {
            'predictive_score': ctx['score'],
            'predictive_label': ctx['label'],
            'predicted_mode':   ctx['mode'],
            'active_episode':   ctx['active_ep']['episode_id'] if ctx['active_ep'] else None,
            'episode_count':    ctx['episode_count'],
            'ops_mode_enabled': ctx['maintenance_on'],
            'manual_attention_count': len(ctx['manual_scripts']),
            'history_runs':     ctx['history_len'],
        },
    }
