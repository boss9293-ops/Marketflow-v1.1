"""
Pipeline metrics computation — read-only analysis over pipeline_history.json.
No writes. No modifications to the pipeline runner.
"""
import json
import os
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
    """Return a dict with guaranteed keys and safe defaults."""
    return {
        'timestamp': str(run.get('timestamp') or run.get('last_run_at') or ''),
        'status': str(run.get('status') or 'unknown'),
        'duration_sec': float(run.get('duration_sec') or 0),
        'scripts_ok': int(run.get('scripts_ok') or 0),
        'scripts_failed': int(run.get('scripts_failed') or 0),
        'failed_scripts': list(run.get('failed_scripts') or []),
    }


def _is_failure(run: dict) -> bool:
    return run['status'] != 'success' or run['scripts_failed'] > 0


def compute_metrics() -> dict:
    """
    Returns {metrics, quality_checks}.
    Always returns a valid dict — never raises.
    """
    history_path = os.path.join(_OUTPUT_DIR, 'pipeline_history.json')
    raw = _load_json_safe(history_path)

    quality_checks = []

    empty_metrics = {
        'total_runs': 0,
        'success_runs': 0,
        'failure_runs': 0,
        'failure_rate_pct': 0.0,
        'last_failure_ts': None,
        'avg_duration_sec': 0.0,
        'latest_duration_sec': 0.0,
        'health_score': 0,
        'health_label': 'Unknown',
    }

    if raw is None or not isinstance(raw, list):
        quality_checks.append({
            'level': 'error',
            'message': 'pipeline_history.json missing or malformed',
        })
        return {'metrics': empty_metrics, 'quality_checks': quality_checks}

    if len(raw) == 0:
        quality_checks.append({
            'level': 'error',
            'message': 'pipeline_history.json is empty',
        })
        return {'metrics': empty_metrics, 'quality_checks': quality_checks}

    # Sort most-recent first, take up to 10
    runs = sorted(raw, key=lambda r: r.get('timestamp') or '', reverse=True)
    recent = [_normalize_run(r) for r in runs[:10]]

    total = len(recent)
    failures = [r for r in recent if _is_failure(r)]
    successes = [r for r in recent if not _is_failure(r)]

    failure_count = len(failures)
    success_count = len(successes)
    failure_rate = round(failure_count / total * 100, 1)
    last_failure_ts = failures[0]['timestamp'] if failures else None

    avg_dur = round(sum(r['duration_sec'] for r in recent) / total, 1)
    latest = recent[0]
    latest_dur = latest['duration_sec']

    # Health score: start at 100, deduct per issue
    score = 100
    score -= min(failure_count * 10, 50)  # up to -50 from failures

    if latest_dur > 900:
        score -= 15
        quality_checks.append({
            'level': 'warning',
            'message': f'Latest run took {latest_dur:.0f}s (threshold: 900s)',
        })

    if latest['scripts_ok'] == 0 and latest['duration_sec'] > 0:
        score -= 10
        quality_checks.append({
            'level': 'critical',
            'message': 'Latest run: scripts_ok == 0',
        })

    score = max(0, min(100, score))

    if score >= 90:
        label = 'Healthy'
    elif score >= 75:
        label = 'Degraded'
    elif score >= 50:
        label = 'At Risk'
    else:
        label = 'Critical'

    return {
        'metrics': {
            'total_runs': total,
            'success_runs': success_count,
            'failure_runs': failure_count,
            'failure_rate_pct': failure_rate,
            'last_failure_ts': last_failure_ts,
            'avg_duration_sec': avg_dur,
            'latest_duration_sec': latest_dur,
            'health_score': score,
            'health_label': label,
        },
        'quality_checks': quality_checks,
    }


def compute_failures() -> dict:
    """
    Returns top_failed_scripts (aggregated over recent 10 runs)
    and latest_report_failures (from pipeline_report.json).
    Always returns a valid dict — never raises.
    """
    history_path = os.path.join(_OUTPUT_DIR, 'pipeline_history.json')
    report_path = os.path.join(_OUTPUT_DIR, 'pipeline_report.json')

    script_counts: dict = {}
    raw_history = _load_json_safe(history_path)
    if isinstance(raw_history, list):
        runs = sorted(raw_history, key=lambda r: r.get('timestamp') or '', reverse=True)
        for run in runs[:10]:
            n = _normalize_run(run)
            for script in n['failed_scripts']:
                if script:
                    script_counts[script] = script_counts.get(script, 0) + 1

    top = sorted(script_counts.items(), key=lambda x: x[1], reverse=True)
    top_failed_scripts = [{'script': s, 'fail_count': c} for s, c in top]

    latest_report_failures = []
    report = _load_json_safe(report_path)
    if isinstance(report, dict):
        for item in (report.get('items') or []):
            if not item.get('ok', True):
                name = str(item.get('filename') or '')
                if name:
                    latest_report_failures.append({
                        'script': name,
                        'description': str(item.get('description') or ''),
                        'elapsed_sec': round(float(item.get('elapsed_sec') or 0), 1),
                    })

    return {
        'top_failed_scripts': top_failed_scripts,
        'latest_report_failures': latest_report_failures,
    }
