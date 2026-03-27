"""
Pipeline recovery — self-healing & recovery classification.
Read-only. Reuses pipeline_metrics and pipeline_intelligence services.
"""
import os
import json
from typing import Any

_HERE = os.path.dirname(os.path.abspath(__file__))
_OUTPUT_DIR = os.path.join(_HERE, '..', 'output')


def _load_json_safe(path: str) -> Any:
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return None


def _normalize_run(run: dict) -> dict:
    return {
        'timestamp':      str(run.get('timestamp') or run.get('last_run_at') or ''),
        'status':         str(run.get('status') or 'unknown'),
        'duration_sec':   float(run.get('duration_sec') or 0),
        'scripts_ok':     int(run.get('scripts_ok') or 0),
        'scripts_failed': int(run.get('scripts_failed') or 0),
        'failed_scripts': list(run.get('failed_scripts') or []),
    }


def _is_failure(run: dict) -> bool:
    return run['status'] != 'success' or run['scripts_failed'] > 0


def _count_script_failures(runs: list) -> dict:
    """Count how many times each script failed across all runs."""
    counts: dict = {}
    for r in runs:
        for s in r['failed_scripts']:
            if s:
                counts[s] = counts.get(s, 0) + 1
    return counts


def _find_consecutive_failures(runs: list) -> set:
    """
    Return set of script names that failed in at least two consecutive runs.
    Runs are newest-first. Check adjacent pairs.
    """
    consecutive: set = set()
    for i in range(len(runs) - 1):
        curr = set(s for s in runs[i]['failed_scripts'] if s)
        nxt  = set(s for s in runs[i + 1]['failed_scripts'] if s)
        overlap = curr & nxt
        consecutive.update(overlap)
    return consecutive


# ── public entry point ────────────────────────────────────────────────────────

def compute_recovery() -> dict:
    """
    Returns {recovery_state, retry_candidates, manual_attention,
             suggested_actions, script_detail}.
    Never raises. Safe fallback on missing/malformed data.

    Recovery states:
      unknown          — insufficient history (<3 runs)
      stable           — no failures in recent runs
      watch            — single failure, low recurrence, not consecutive → monitor
      retryable        — transient failures eligible for retry
      degraded         — repeated/consecutive failures but below critical
      manual_attention — critical conditions requiring human intervention
    """
    history_path = os.path.join(_OUTPUT_DIR, 'pipeline_history.json')
    raw = _load_json_safe(history_path)

    unknown_result = {
        'recovery_state':   'unknown',
        'retry_candidates': [],
        'manual_attention': [],
        'suggested_actions': ['Wait for more pipeline runs before recovery analysis.'],
        'script_detail':    [],
        'reason':           'Insufficient history for recovery analysis.',
    }

    if not isinstance(raw, list) or len(raw) < 3:
        reason = (
            'pipeline_history.json missing or malformed'
            if not isinstance(raw, list)
            else f'Only {len(raw)} run(s) available (need 3)'
        )
        return {**unknown_result, 'reason': reason}

    # Normalize + sort newest-first
    runs = sorted(raw, key=lambda r: r.get('timestamp') or '', reverse=True)
    runs = [_normalize_run(r) for r in runs]
    recent10 = runs[:10]

    # ── basic stats
    latest = runs[0]
    latest_failed = set(s for s in latest['failed_scripts'] if s)
    failure_streak = 0
    for r in runs:
        if _is_failure(r):
            failure_streak += 1
        else:
            break

    # ── per-script analysis
    fail_counts       = _count_script_failures(recent10)
    consecutive_fails = _find_consecutive_failures(runs[:5])  # check last 5 pairs

    # Classify each script that failed in the latest run
    retry_candidates  = []
    manual_attention  = []
    script_detail     = []

    # Preserve original execution order from pipeline_report.json
    report_path = os.path.join(_OUTPUT_DIR, 'pipeline_report.json')
    report = _load_json_safe(report_path)
    ordered_scripts = []
    if isinstance(report, dict) and isinstance(report.get('items'), list):
        ordered_scripts = [item.get('filename') for item in report['items'] if item.get('filename')]
    
    latest_failed_ordered = sorted(latest_failed, key=lambda s: ordered_scripts.index(s) if s in ordered_scripts else 9999)

    for script in latest_failed_ordered:
        count       = fail_counts.get(script, 1)
        is_consec   = script in consecutive_fails
        is_high_rep = count >= 3

        if count >= 5:
            category = 'critical'
        elif is_consec or is_high_rep:
            category = 'structural'
        else:
            category = 'transient'

        script_detail.append({
            'script':        script,
            'fail_count':    count,
            'consecutive':   is_consec,
            'category':      category,
        })

        if category == 'transient':
            retry_candidates.append(script)
        else:
            manual_attention.append(script)

    # Also flag scripts NOT in latest run but critically repeated across recent history
    for script, count in fail_counts.items():
        if script not in latest_failed and count >= 5:
            manual_attention.append(script)
            script_detail.append({
                'script':      script,
                'fail_count':  count,
                'consecutive': script in consecutive_fails,
                'category':    'critical_historical',
            })

    # ── intelligence check
    intel_critical = False
    try:
        from services.pipeline_intelligence import compute_intelligence
        intel = compute_intelligence()
        intel_critical = intel.get('state') == 'critical'
    except Exception:
        pass  # intelligence unavailable — proceed without it

    # ── manual_attention triggers
    scripts_ok_zero = latest['scripts_ok'] == 0
    any_critical    = any(s['category'] in ('critical', 'critical_historical') for s in script_detail)

    force_manual = (
        scripts_ok_zero
        or any_critical
        or intel_critical
        or failure_streak >= 3
    )

    if force_manual:
        # Promote all retry candidates to manual
        for s in retry_candidates:
            if s not in manual_attention:
                manual_attention.append(s)
        retry_candidates.clear()

    # ── determine recovery state
    if not _is_failure(latest) and failure_streak == 0:
        recovery_state = 'stable'
    elif force_manual:
        recovery_state = 'manual_attention'
    elif retry_candidates and not manual_attention:
        recovery_state = 'retryable'
    elif manual_attention and not retry_candidates:
        recovery_state = 'degraded'
    elif retry_candidates or manual_attention:
        # mixed: some retryable, some manual
        recovery_state = 'degraded'
    else:
        # has failure but nothing classified → watch
        recovery_state = 'watch'

    # ── suggested actions
    suggested_actions = _build_suggested_actions(
        recovery_state, retry_candidates, manual_attention,
        scripts_ok_zero, intel_critical, failure_streak,
    )

    return {
        'recovery_state':    recovery_state,
        'retry_candidates':  retry_candidates,
        'manual_attention':  manual_attention,
        'suggested_actions': suggested_actions,
        'script_detail':     script_detail,
    }


def _build_suggested_actions(
    state: str,
    retry_candidates: list,
    manual_attention: list,
    scripts_ok_zero: bool,
    intel_critical: bool,
    failure_streak: int,
) -> list:
    actions = []

    if state == 'stable':
        actions.append('Pipeline is stable. No action required.')
        return actions

    if state == 'watch':
        actions.append('Single failure detected. Monitor next run before taking action.')
        actions.append('Check logs for the failed run to identify the root cause.')
        return actions

    if state == 'retryable':
        names = ', '.join(retry_candidates[:3])
        actions.append(f'Transient failure detected in: {names}.')
        actions.append('Re-run the pipeline — these scripts are eligible for automatic retry.')
        actions.append('If failure persists on next run, escalate to manual investigation.')
        return actions

    if state == 'degraded':
        if retry_candidates:
            names = ', '.join(retry_candidates[:3])
            actions.append(f'Retry candidates: {names} — re-run may resolve these.')
        if manual_attention:
            names = ', '.join(manual_attention[:3])
            actions.append(f'Scripts needing investigation: {names}.')
        actions.append('Review logs for repeated failures and check data dependencies.')
        return actions

    if state == 'manual_attention':
        if scripts_ok_zero:
            actions.append('CRITICAL: Latest run had 0 scripts succeed. Check pipeline configuration and environment.')
        if intel_critical:
            actions.append('CRITICAL: Pipeline intelligence reports critical state — systemic failure likely.')
        if failure_streak >= 3:
            actions.append(f'CRITICAL: Pipeline has failed {failure_streak} consecutive run(s). Immediate investigation required.')
        if manual_attention:
            names = ', '.join(manual_attention[:5])
            actions.append(f'Scripts requiring investigation: {names}.')
        actions.append('Do not rely on pipeline output until failures are resolved.')
        actions.append('Check script logs, data sources, and environment configuration.')
        return actions

    # unknown
    actions.append('Wait for more pipeline runs before recovery analysis.')
    return actions
