"""
Pipeline root cause analysis -- deterministic failure classification.
Read-only. Never writes files or modifies pipeline state.

Root cause classes:
  timeout            -- elapsed_sec > TIMEOUT_THRESHOLD for a failed script
  missing_input      -- script failed almost instantly (< FAST_FAIL_SEC)
  malformed_json     -- build_* script failed quickly (JSON parse/write error pattern)
  dependency_failure -- script failed after an earlier script in same run also failed
  script_exception   -- general exception (moderate elapsed time, no other signal)
  unknown            -- no per-script detail available (history-only fallback)
"""
import json
import os
from typing import Any

_HERE       = os.path.dirname(os.path.abspath(__file__))
_OUTPUT_DIR = os.path.join(_HERE, '..', 'output')

# Classification thresholds (seconds)
_TIMEOUT_SEC    = 180   # > 3 min elapsed for a single failed script -> timeout
_FAST_FAIL_SEC  = 1.0   # < 1.0 s elapsed -> missing_input / dependency
_JSON_BUILD_SEC = 15.0  # build_* failed in < 15 s -> likely malformed_json

# Recurring pattern: a cause must appear in >= this many consecutive failure batches
_RECURRING_MIN_RUNS = 2

# Cap on script_cause_breakdown entries returned
_BREAKDOWN_CAP = 10


def _load_json_safe(path: str) -> Any:
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return None


def _classify_cause(filename: str, elapsed: float, item_idx: int, all_items: list) -> str:
    """
    Deterministic root cause classification from per-script metadata.

    Priority order (highest to lowest):
      1. dependency_failure -- an earlier script in this run already failed
      2. timeout            -- ran for > TIMEOUT_SEC before failing
      3. missing_input      -- crashed almost immediately (< FAST_FAIL_SEC)
      4. malformed_json     -- build_* script failed quickly
      5. script_exception   -- catch-all for moderate elapsed time
    """
    # 1. dependency_failure: any earlier script in this run also failed
    if item_idx > 0:
        earlier_failed = any(not x.get('ok', True) for x in all_items[:item_idx])
        if earlier_failed:
            return 'dependency_failure'

    # 2. timeout: ran for a long time before failing
    if elapsed > _TIMEOUT_SEC:
        return 'timeout'

    # 3. missing_input: crashed almost immediately
    if elapsed < _FAST_FAIL_SEC:
        return 'missing_input'

    # 4. malformed_json: build_* script that failed quickly likely hit a JSON error
    if filename.startswith('build_') and elapsed < _JSON_BUILD_SEC:
        return 'malformed_json'

    # 5. script_exception: default for moderate elapsed time failures
    return 'script_exception'


def _causes_from_report(report: dict) -> list:
    """
    Extract per-failure causes from pipeline_report.json.
    Returns list of {script, cause, elapsed_sec}.
    """
    items = report.get('items') or []
    if not isinstance(items, list):
        return []

    results = []
    for idx, item in enumerate(items):
        if item.get('ok', True):
            continue  # skip successes
        filename = str(item.get('filename') or '')
        elapsed  = float(item.get('elapsed_sec') or 0.0)
        cause    = _classify_cause(filename, elapsed, idx, items)
        results.append({'script': filename, 'cause': cause, 'elapsed_sec': elapsed})

    return results


def _causes_from_history_run(run: dict) -> list:
    """
    Extract causes from a pipeline_history entry.
    No per-script elapsed data available -- all classified as 'unknown'.
    """
    failed = run.get('failed_scripts') or []
    return [
        {'script': str(s), 'cause': 'unknown', 'elapsed_sec': 0.0}
        for s in failed if s
    ]


def _dominant_cause(cause_counts: dict) -> str:
    """Return the cause with the highest count."""
    return max(cause_counts, key=lambda c: cause_counts[c]) if cause_counts else 'unknown'


def compute_root_causes() -> dict:
    """
    Returns root cause analysis. Never raises.
    Safe fallback on missing or malformed data.

    Return schema:
      ok                     bool
      total_failures_analyzed int
      latest_root_cause      str | null
      top_root_causes        [{cause, count}]  sorted by count desc
      script_cause_breakdown [{script, cause, count}]  sorted by count desc
      recurring_cause        str | null
    """
    empty = {
        'ok': True,
        'total_failures_analyzed': 0,
        'latest_root_cause': None,
        'top_root_causes': [],
        'script_cause_breakdown': [],
        'recurring_cause': None,
    }

    # ── 1. Primary source: pipeline_report.json ───────────────────────────
    report_path = os.path.join(_OUTPUT_DIR, 'pipeline_report.json')
    report = _load_json_safe(report_path)

    latest_causes: list = []
    if isinstance(report, dict):
        latest_causes = _causes_from_report(report)

    # ── 2. History source: pipeline_history.json ──────────────────────────
    history_path = os.path.join(_OUTPUT_DIR, 'pipeline_history.json')
    history = _load_json_safe(history_path)

    # historical_batches: list of [causes_list] per failure run, newest-first
    historical_batches: list = []
    if isinstance(history, list):
        sorted_hist = sorted(
            history,
            key=lambda r: r.get('timestamp') or '',
            reverse=True,
        )
        for run in sorted_hist:
            if run.get('status') == 'failure' or int(run.get('scripts_failed') or 0) > 0:
                batch = _causes_from_history_run(run)
                if batch:
                    historical_batches.append(batch)

    # If report shows all-success but history has failure entries, use most recent
    # history batch as the latest_causes fallback (history-only mode)
    if not latest_causes and historical_batches:
        latest_causes = historical_batches[0]

    if not latest_causes:
        return empty

    # ── 3. latest_root_cause ──────────────────────────────────────────────
    lc_counts: dict = {}
    for item in latest_causes:
        c = item['cause']
        lc_counts[c] = lc_counts.get(c, 0) + 1
    latest_root_cause = _dominant_cause(lc_counts) if lc_counts else None

    # ── 4. top_root_causes (across all failures: report + history) ────────
    all_failures = list(latest_causes)
    for batch in historical_batches:
        all_failures.extend(batch)

    all_counts: dict = {}
    for item in all_failures:
        c = item['cause']
        all_counts[c] = all_counts.get(c, 0) + 1

    top_root_causes = sorted(
        [{'cause': c, 'count': n} for c, n in all_counts.items()],
        key=lambda x: x['count'],
        reverse=True,
    )

    # ── 5. script_cause_breakdown ─────────────────────────────────────────
    script_map: dict = {}  # script -> {cause -> count}
    for item in all_failures:
        s = item['script']
        c = item['cause']
        if s not in script_map:
            script_map[s] = {}
        script_map[s][c] = script_map[s].get(c, 0) + 1

    script_cause_breakdown = []
    for script, counts in script_map.items():
        dominant = _dominant_cause(counts)
        total    = sum(counts.values())
        script_cause_breakdown.append({'script': script, 'cause': dominant, 'count': total})

    script_cause_breakdown.sort(key=lambda x: x['count'], reverse=True)
    script_cause_breakdown = script_cause_breakdown[:_BREAKDOWN_CAP]

    # ── 6. recurring_cause ────────────────────────────────────────────────
    # A cause seen in >= _RECURRING_MIN_RUNS consecutive failure batches
    recurring_cause = None
    if len(historical_batches) >= _RECURRING_MIN_RUNS:
        streak: dict = {}
        for batch in historical_batches[:_RECURRING_MIN_RUNS]:
            for cause in {item['cause'] for item in batch}:
                streak[cause] = streak.get(cause, 0) + 1
        candidates = {c: n for c, n in streak.items() if n >= _RECURRING_MIN_RUNS}
        if candidates:
            recurring_cause = _dominant_cause(candidates)

    # ── 7. Optional: supplement with retry history (count only) ──────────
    retry_path = os.path.join(_OUTPUT_DIR, 'cache', 'pipeline_retry_history.json')
    retry_data = _load_json_safe(retry_path)
    retry_count = 0
    if isinstance(retry_data, list):
        retry_count = len(retry_data)

    return {
        'ok': True,
        'total_failures_analyzed': len(all_failures),
        'latest_root_cause': latest_root_cause,
        'top_root_causes': top_root_causes,
        'script_cause_breakdown': script_cause_breakdown,
        'recurring_cause': recurring_cause,
        'retry_events_supplemental': retry_count,
    }
