"""
Pipeline intelligence — trend, anomaly, and early-warning analysis.
Read-only. Never writes files or modifies the pipeline runner.
"""
import json
import os
from typing import Any

_HERE = os.path.dirname(os.path.abspath(__file__))
_OUTPUT_DIR = os.path.join(_HERE, '..', 'output')

# ── thresholds ────────────────────────────────────────────────────────────────
_MIN_RUNS_FOR_ANALYSIS = 5   # need at least 5 runs to produce non-"unknown" state
_DURATION_SPIKE_RATIO  = 1.5 # latest > 1.5× avg(last-5) → spike
_FAILURE_SPIKE_WINDOW  = 3   # look at last N runs for failure spike
_FAILURE_SPIKE_MIN     = 2   # ≥N failures in window → spike
_REPEAT_FAIL_WINDOW    = 10  # look back N runs for repeated script failure
_REPEAT_FAIL_MIN       = 3   # script failed ≥N times → repeated


def _load_json_safe(path: str) -> Any:
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return None


def _normalize_run(run: dict) -> dict:
    return {
        'timestamp':     str(run.get('timestamp') or run.get('last_run_at') or ''),
        'status':        str(run.get('status') or 'unknown'),
        'duration_sec':  float(run.get('duration_sec') or 0),
        'scripts_ok':    int(run.get('scripts_ok') or 0),
        'scripts_failed':int(run.get('scripts_failed') or 0),
        'failed_scripts':list(run.get('failed_scripts') or []),
    }


def _is_failure(run: dict) -> bool:
    return run['status'] != 'success' or run['scripts_failed'] > 0


# ── trend helpers ─────────────────────────────────────────────────────────────

def _duration_trend(recent5: list) -> str:
    """
    Compare avg of newest 2 runs vs avg of older runs (3-5).
    Returns 'up' | 'down' | 'stable'.
    """
    if len(recent5) < 4:
        return 'stable'
    newer = [r['duration_sec'] for r in recent5[:2]]
    older = [r['duration_sec'] for r in recent5[2:]]
    avg_new = sum(newer) / len(newer)
    avg_old = sum(older) / len(older)
    if avg_old == 0:
        return 'stable'
    ratio = avg_new / avg_old
    if ratio > 1.15:
        return 'up'
    if ratio < 0.85:
        return 'down'
    return 'stable'


def _failure_trend(recent5: list) -> str:
    """
    Compare failure count in newest 2 vs older 3 (normalized to per-run rate).
    Returns 'worsening' | 'improving' | 'stable'.
    """
    if len(recent5) < 4:
        return 'stable'
    newer_failures = sum(1 for r in recent5[:2] if _is_failure(r))
    older_failures  = sum(1 for r in recent5[2:] if _is_failure(r))
    newer_rate = newer_failures / 2
    older_rate  = older_failures / max(len(recent5) - 2, 1)
    if newer_rate > older_rate + 0.2:
        return 'worsening'
    if newer_rate < older_rate - 0.2:
        return 'improving'
    return 'stable'


def _streaks(runs: list) -> tuple:
    """
    Return (success_streak, failure_streak) counting from most recent run.
    Streaks break on the first run of the opposite result.
    """
    success_streak = 0
    failure_streak = 0
    # success streak
    for r in runs:
        if not _is_failure(r):
            success_streak += 1
        else:
            break
    # failure streak
    for r in runs:
        if _is_failure(r):
            failure_streak += 1
        else:
            break
    return success_streak, failure_streak


# ── anomaly detection ─────────────────────────────────────────────────────────

def _detect_duration_spike(runs: list) -> dict | None:
    """latest run duration > 1.5× average of the window."""
    if len(runs) < 3:
        return None
    latest = runs[0]['duration_sec']
    avg = sum(r['duration_sec'] for r in runs) / len(runs)
    if avg == 0:
        return None
    if latest > avg * _DURATION_SPIKE_RATIO:
        return {
            'type':   'duration_spike',
            'detail': f'Latest run {latest:.0f}s is {latest/avg:.1f}× the {len(runs)}-run avg ({avg:.0f}s)',
        }
    return None


def _detect_failure_spike(runs: list) -> dict | None:
    """≥2 failures in last 3 runs."""
    window = runs[:_FAILURE_SPIKE_WINDOW]
    if len(window) < _FAILURE_SPIKE_WINDOW:
        return None
    count = sum(1 for r in window if _is_failure(r))
    if count >= _FAILURE_SPIKE_MIN:
        return {
            'type':   'failure_spike',
            'detail': f'{count}/{_FAILURE_SPIKE_WINDOW} of the most recent runs failed',
        }
    return None


def _detect_repeated_script_failures(runs: list) -> dict | None:
    """Any single script failed ≥3 times in last 10 runs."""
    window = runs[:_REPEAT_FAIL_WINDOW]
    counts: dict = {}
    for r in window:
        for s in r['failed_scripts']:
            if s:
                counts[s] = counts.get(s, 0) + 1
    repeated = sorted(
        [{'script': s, 'count': c} for s, c in counts.items() if c >= _REPEAT_FAIL_MIN],
        key=lambda x: x['count'], reverse=True,
    )
    if repeated:
        return {'type': 'repeated_script_failure', 'scripts': repeated}
    return None


# ── warnings ──────────────────────────────────────────────────────────────────

def _build_warnings(
    failure_streak: int,
    failure_spike: dict | None,
    dur_trend: str,
    dur_spike: dict | None,
    repeated: dict | None,
) -> list:
    warnings = []

    if failure_streak >= 2 or failure_spike:
        warnings.append({
            'code':    'unstable_pipeline',
            'message': (
                f'Pipeline has failed {failure_streak} run(s) in a row.'
                if failure_streak >= 2
                else (failure_spike or {}).get('detail', 'Failure spike detected.')
            ),
        })

    if dur_trend == 'up' and dur_spike:
        warnings.append({
            'code':    'slowdown_trend',
            'message': f'Duration is trending up. {dur_spike["detail"]}',
        })
    elif dur_trend == 'up':
        warnings.append({
            'code':    'slowdown_trend',
            'message': 'Duration trending upward over recent runs.',
        })

    if repeated:
        scripts = [s['script'] for s in repeated['scripts'][:3]]
        warnings.append({
            'code':    'recurring_failures',
            'message': f'Scripts failing repeatedly: {", ".join(scripts)}',
            'scripts': repeated['scripts'],
        })

    return warnings


# ── public entry point ────────────────────────────────────────────────────────

def compute_intelligence() -> dict:
    """
    Returns {state, trends, anomalies, warnings}.
    Never raises. Safe fallback on missing/malformed data.
    """
    history_path = os.path.join(_OUTPUT_DIR, 'pipeline_history.json')
    raw = _load_json_safe(history_path)

    unknown_result = {
        'state':     'unknown',
        'trends':    {
            'duration_trend':  'unknown',
            'failure_trend':   'unknown',
            'success_streak':  0,
            'failure_streak':  0,
        },
        'anomalies': [],
        'warnings':  [],
    }

    if not isinstance(raw, list) or len(raw) < _MIN_RUNS_FOR_ANALYSIS:
        reason = (
            'pipeline_history.json missing or malformed'
            if not isinstance(raw, list)
            else f'Only {len(raw)} run(s) available (need {_MIN_RUNS_FOR_ANALYSIS})'
        )
        return {**unknown_result, 'reason': reason}

    # Normalize, sort newest-first
    runs = sorted(raw, key=lambda r: r.get('timestamp') or '', reverse=True)
    runs = [_normalize_run(r) for r in runs]

    recent5  = runs[:5]
    recent10 = runs[:_REPEAT_FAIL_WINDOW]

    # ── trends
    dur_trend   = _duration_trend(recent5)
    fail_trend  = _failure_trend(recent5)
    suc_streak, fail_streak = _streaks(runs)

    # ── anomalies
    anomalies = []
    dur_spike  = _detect_duration_spike(recent5)
    fail_spike = _detect_failure_spike(runs)
    repeated   = _detect_repeated_script_failures(recent10)
    if dur_spike:
        anomalies.append(dur_spike)
    if fail_spike:
        anomalies.append(fail_spike)
    if repeated:
        anomalies.append(repeated)

    # ── warnings
    warnings = _build_warnings(fail_streak, fail_spike, dur_trend, dur_spike, repeated)

    # ── state
    is_critical = (
        fail_streak >= 3
        or (repeated and any(s['count'] >= 5 for s in repeated['scripts']))
    )
    if is_critical:
        state = 'critical'
    elif warnings:
        state = 'warning'
    else:
        state = 'stable'

    return {
        'state': state,
        'trends': {
            'duration_trend':  dur_trend,
            'failure_trend':   fail_trend,
            'success_streak':  suc_streak,
            'failure_streak':  fail_streak,
        },
        'anomalies': anomalies,
        'warnings':  warnings,
    }
