"""
Retry observability & audit layer.

Appends a structured audit entry for every retry execution to
output/cache/pipeline_retry_audit.json.

Audit entry schema:
    {
        "run_timestamp":    str,        # ISO-8601
        "total_attempts":   int,        # scripts where retry was attempted
        "recovered":        int,        # scripts that came back OK
        "failed":           int,        # scripts that stayed failed
        "skipped":          int,        # scripts blocked before attempt
        "recovery_rate":    float,      # recovered / total_attempts (0 when 0)
        "script_decisions": [
            {
                "script":       str,
                "root_cause":   str,    # from _cause_map if available, else "unknown"
                "allowed":      bool,
                "skip_reason":  str | None,     # raw reason when not allowed
                "skip_category":str | None,     # normalized category
                "attempted":    bool,
                "result":       str,    # "recovered" | "failed" | "skipped"
            },
            ...
        ],
        "skip_breakdown": {             # count per skip_category
            "policy_blocked":     int,
            "deny_script":        int,
            "max_retry_exceeded": int,
            "cooldown_active":    int,
            "structural_failure": int,
        },
    }

The audit file holds a list of the 50 most-recent entries (newest first).
"""
import json
import os
from typing import Any

_HERE        = os.path.dirname(os.path.abspath(__file__))
_OUTPUT_DIR  = os.path.join(_HERE, '..', 'output')
_AUDIT_PATH  = os.path.join(_OUTPUT_DIR, 'cache', 'pipeline_retry_audit.json')
_MAX_ENTRIES = 50

# ── skip-reason normalisation ─────────────────────────────────────────────────

_SKIP_CATEGORIES = (
    'policy_blocked',
    'deny_script',
    'max_retry_exceeded',
    'cooldown_active',
    'structural_failure',
)


def _normalize_skip_category(raw: str) -> str:
    """Map a raw skip_reason string to one of 5 normalised category keys."""
    r = raw.lower()
    if 'cooldown' in r:
        return 'cooldown_active'
    if 'deny' in r and 'script' in r:
        return 'deny_script'
    if 'policy' in r:
        return 'policy_blocked'
    if 'fail_count' in r or 'already queued' in r or 'max_retry' in r:
        return 'max_retry_exceeded'
    # structural: consecutive failures, non-transient, category=structural, etc.
    if any(k in r for k in ('consecutive', 'category=', 'not transient', 'file not found',
                             'structural', 'non-transient')):
        return 'structural_failure'
    # default for anything else that looks policy-shaped
    return 'policy_blocked'


# ── helpers ───────────────────────────────────────────────────────────────────

def _load_json_safe(path: str) -> Any:
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return None


# ── public API ────────────────────────────────────────────────────────────────

def write_audit_entry(ts_iso: str, retry_result: dict) -> None:
    """
    Append one audit entry derived from retry_result to the audit file.
    Never raises — all exceptions are silently swallowed.
    """
    try:
        summary = retry_result.get('retry_summary', [])
        if not isinstance(summary, list):
            return

        skip_breakdown: dict = {k: 0 for k in _SKIP_CATEGORIES}
        script_decisions = []
        total_attempts = 0
        recovered_count = 0
        failed_count = 0
        skipped_count = 0

        for entry in summary:
            if not isinstance(entry, dict):
                continue

            script   = str(entry.get('script', ''))
            result   = str(entry.get('result', ''))
            allowed  = entry.get('allowed', True)

            # Normalise the 3-state result field
            if result == 'recovered':
                attempted = True
                total_attempts += 1
                recovered_count += 1
                skip_cat = None
                skip_raw = None
            elif result == 'failed':
                attempted = True
                total_attempts += 1
                failed_count += 1
                skip_cat = None
                skip_raw = None
            elif result == 'skipped':
                attempted = False
                skipped_count += 1
                skip_raw = str(entry.get('skip_reason', ''))
                skip_cat = _normalize_skip_category(skip_raw) if skip_raw else 'policy_blocked'
                skip_breakdown[skip_cat] = skip_breakdown.get(skip_cat, 0) + 1
            else:
                # Unknown — treat as skipped/blocked
                attempted = False
                skipped_count += 1
                skip_raw = str(entry.get('skip_reason', ''))
                skip_cat = _normalize_skip_category(skip_raw) if skip_raw else 'policy_blocked'
                skip_breakdown[skip_cat] = skip_breakdown.get(skip_cat, 0) + 1

            script_decisions.append({
                'script':        script,
                'root_cause':    str(entry.get('root_cause', 'unknown')),
                'allowed':       bool(allowed),
                'skip_reason':   skip_raw,
                'skip_category': skip_cat,
                'attempted':     attempted,
                'result':        result or ('skipped' if not attempted else 'failed'),
            })

        recovery_rate = round(recovered_count / total_attempts, 3) if total_attempts else 0.0

        new_entry = {
            'run_timestamp':   ts_iso,
            'total_attempts':  total_attempts,
            'recovered':       recovered_count,
            'failed':          failed_count,
            'skipped':         skipped_count,
            'recovery_rate':   recovery_rate,
            'script_decisions': script_decisions,
            'skip_breakdown':  skip_breakdown,
        }

        # Load, prepend, trim, write
        existing = _load_json_safe(_AUDIT_PATH)
        if not isinstance(existing, list):
            existing = []
        existing.insert(0, new_entry)
        existing = existing[:_MAX_ENTRIES]

        os.makedirs(os.path.dirname(_AUDIT_PATH), exist_ok=True)
        with open(_AUDIT_PATH, 'w', encoding='utf-8') as f:
            json.dump(existing, f, indent=2)

    except Exception:
        pass  # Never raise — audit must never break the retry pipeline


def get_audit_summary() -> dict:
    """
    Read audit file and return aggregated statistics.
    Returns a safe fallback dict on any error.
    """
    fallback = {
        'ok':                False,
        'total_runs':        0,
        'total_attempts':    0,
        'total_recovered':   0,
        'total_failed':      0,
        'total_skipped':     0,
        'overall_recovery_rate': 0.0,
        'skip_breakdown':    {k: 0 for k in _SKIP_CATEGORIES},
        'recent_entries':    [],
        'error':             'No audit data available',
    }
    try:
        entries = _load_json_safe(_AUDIT_PATH)
        if not isinstance(entries, list) or not entries:
            return {**fallback, 'error': 'Audit file empty or missing'}

        total_runs       = len(entries)
        total_attempts   = sum(int(e.get('total_attempts', 0)) for e in entries)
        total_recovered  = sum(int(e.get('recovered', 0)) for e in entries)
        total_failed     = sum(int(e.get('failed', 0)) for e in entries)
        total_skipped    = sum(int(e.get('skipped', 0)) for e in entries)
        overall_rate     = round(total_recovered / total_attempts, 3) if total_attempts else 0.0

        agg_skip: dict = {k: 0 for k in _SKIP_CATEGORIES}
        for e in entries:
            sb = e.get('skip_breakdown', {})
            if isinstance(sb, dict):
                for k in _SKIP_CATEGORIES:
                    agg_skip[k] += int(sb.get(k, 0))

        # 5 most recent entries (lightweight — omit script_decisions)
        recent = []
        for e in entries[:5]:
            recent.append({
                'run_timestamp':  e.get('run_timestamp', ''),
                'total_attempts': e.get('total_attempts', 0),
                'recovered':      e.get('recovered', 0),
                'failed':         e.get('failed', 0),
                'skipped':        e.get('skipped', 0),
                'recovery_rate':  e.get('recovery_rate', 0.0),
            })

        return {
            'ok':                    True,
            'total_runs':            total_runs,
            'total_attempts':        total_attempts,
            'total_recovered':       total_recovered,
            'total_failed':          total_failed,
            'total_skipped':         total_skipped,
            'overall_recovery_rate': overall_rate,
            'skip_breakdown':        agg_skip,
            'recent_entries':        recent,
        }
    except Exception as exc:
        return {**fallback, 'error': str(exc)}
