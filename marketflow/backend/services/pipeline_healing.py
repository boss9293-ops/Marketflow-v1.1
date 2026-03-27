"""
Auto-healing strategy layer — deterministic rules only.

Classifies each failed script into one of four healing strategies:
  retry_now           — transient failure; safe to auto-retry immediately
  retry_upstream_first— dependency_failure; upstream must recover first
  skip_and_degrade    — data-format error; low retry value, graceful degradation
  manual_attention    — structural / critical / unclassifiable; do not auto-heal

Used in two modes:
  1. compute_healing_plan()    — standalone analysis (called by API route)
  2. apply_healing_filter()    — integration hook called from get_retry_plan()

Healing depth = 1.  No multi-hop retry chains.  No same-script multi-retry.
"""
import json
import os
from typing import Any

_HERE        = os.path.dirname(os.path.abspath(__file__))
_OUTPUT_DIR  = os.path.join(_HERE, '..', 'output')
_REPORT_PATH = os.path.join(_OUTPUT_DIR, 'pipeline_report.json')
_STATUS_PATH = os.path.join(_OUTPUT_DIR, 'pipeline_status.json')
_AUDIT_PATH  = os.path.join(_OUTPUT_DIR, 'cache', 'pipeline_retry_audit.json')

# Causes that may be immediately retried (transient)
_RETRY_NOW_CAUSES    = frozenset({'timeout', 'script_exception'})
# Causes with low retry value (data-format problems)
_SKIP_DEGRADE_CAUSES = frozenset({'missing_input', 'malformed_json'})
# Minimum audit-run count to declare a script "recurring unknown"
_RECURRING_THRESHOLD = 2


# ── helpers ───────────────────────────────────────────────────────────────────

def _load_json_safe(path: str) -> Any:
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return None


def _find_upstream(script: str, all_failed: list, script_to_idx: dict) -> str | None:
    """Return the nearest preceding failed script (by execution order) or None."""
    own_idx = script_to_idx.get(script, -1)
    if own_idx <= 0:
        return None
    candidates = sorted(
        (script_to_idx.get(s, 9999), s)
        for s in all_failed if s != script and script_to_idx.get(s, 9999) < own_idx
    )
    return candidates[-1][1] if candidates else None


def _is_recurring_unknown(script: str, root_cause: str, audit_entries: list) -> bool:
    """
    True when the script has failed with 'unknown' root_cause in at least
    _RECURRING_THRESHOLD of the last 10 audit runs.
    """
    if root_cause != 'unknown':
        return False
    count = 0
    for entry in audit_entries[:10]:
        for sd in entry.get('script_decisions', []):
            if (sd.get('script') == script
                    and sd.get('result') == 'failed'
                    and sd.get('root_cause', '') == 'unknown'):
                count += 1
    return count >= _RECURRING_THRESHOLD


# ── core classification ───────────────────────────────────────────────────────

def _classify_one(
    script:            str,
    root_cause:        str,
    policy:            Any,          # dict | None
    all_failed:        list,
    script_to_idx:     dict,
    all_scripts_failed: bool,
    audit_entries:     list,
) -> tuple:
    """
    Returns (strategy, upstream_script_or_None, reason_str).
    Precedence:  manual_attention > retry_upstream_first > skip_and_degrade > retry_now
    """
    # ── 1. Critical: whole-pipeline collapse ──────────────────────────────────
    if all_scripts_failed:
        return 'manual_attention', None, 'All scripts failed — pipeline critically unhealthy'

    # ── 2. Recurring unknown ──────────────────────────────────────────────────
    if _is_recurring_unknown(script, root_cause, audit_entries):
        return 'manual_attention', None, 'Repeated unknown cause — requires investigation'

    # ── 3. Dependency failure ─────────────────────────────────────────────────
    if root_cause == 'dependency_failure':
        upstream = _find_upstream(script, all_failed, script_to_idx)
        if upstream:
            return 'retry_upstream_first', upstream, f'Upstream {upstream!r} must recover first'
        return 'manual_attention', None, 'Dependency failure — upstream not identifiable'

    # ── 4. Data-format errors → graceful degradation ─────────────────────────
    if root_cause in _SKIP_DEGRADE_CAUSES:
        return 'skip_and_degrade', None, f'Data format issue ({root_cause}) — low retry value'

    # ── 5. Transient → retry_now (honour policy when available) ──────────────
    if root_cause in _RETRY_NOW_CAUSES:
        if policy is None:
            return 'retry_now', None, 'Transient failure — policy unavailable, defaulting to retry'
        try:
            from services.pipeline_retry_policy import check_script_allowed
            allowed, reason = check_script_allowed(script, root_cause, policy)
            if allowed:
                return 'retry_now', None, 'Transient failure — policy allows retry'
            return 'manual_attention', None, f'Policy blocks retry: {reason}'
        except Exception:
            return 'retry_now', None, 'Transient failure — policy check failed, defaulting to retry'

    # ── 6. Unknown / uncategorised ────────────────────────────────────────────
    return 'manual_attention', None, 'No automatic healing strategy available'


# ── public API: standalone plan (for API route) ───────────────────────────────

def compute_healing_plan() -> dict:
    """
    Read current pipeline state and return a full healing plan.

    Return schema::
        {
            ok:               bool,
            healing_state:    "healthy" | "degraded" | "critical",
            strategies: [
                {
                    script:     str,
                    root_cause: str,
                    strategy:   str,   # one of the four healing strategies
                    upstream:   str | None,
                    reason:     str,
                },
                ...
            ],
            retry_now_scripts:   [str],
            degraded:            [str],
            manual_attention:    [str],
        }
    """
    # ── load pipeline_report ──────────────────────────────────────────────────
    report = _load_json_safe(_REPORT_PATH)
    if not isinstance(report, dict):
        return _empty_plan('pipeline_report.json not available')

    items       = report.get('items', [])
    failed_items = [it for it in items if isinstance(it, dict) and not it.get('ok', True)]

    if not failed_items:
        return {
            'ok':                 True,
            'healing_state':      'healthy',
            'strategies':         [],
            'retry_now_scripts':  [],
            'degraded':           [],
            'manual_attention':   [],
        }

    # Execution-order index (position in pipeline_report items list)
    script_to_idx = {it['filename']: i for i, it in enumerate(items) if 'filename' in it}
    all_failed    = [it['filename'] for it in failed_items if 'filename' in it]

    # scripts_ok — prefer pipeline_status.json; fall back to report counters
    status     = _load_json_safe(_STATUS_PATH) or {}
    scripts_ok = status.get('scripts_ok', report.get('success', len(items) - len(failed_items)))
    all_scripts_failed = int(scripts_ok) == 0 and bool(failed_items)

    # Root-cause map (lazy import — never raises)
    cause_map: dict = {}
    try:
        from services.pipeline_root_cause import compute_root_causes
        rc = compute_root_causes()
        cause_map = {
            row['script']: row['cause']
            for row in rc.get('script_cause_breakdown', [])
            if isinstance(row, dict)
        }
    except Exception:
        pass

    # Policy (lazy import)
    policy = None
    try:
        from services.pipeline_retry_policy import load_policy
        policy = load_policy()
    except Exception:
        pass

    # Audit history for recurring-unknown check
    audit_entries = _load_json_safe(_AUDIT_PATH) or []
    if not isinstance(audit_entries, list):
        audit_entries = []

    # ── classify each failed script ───────────────────────────────────────────
    strategies:    list = []
    retry_now:     list = []
    degraded:      list = []
    manual_attn:   list = []

    for item in failed_items:
        script     = item.get('filename', '')
        root_cause = cause_map.get(script, 'unknown')

        strategy, upstream, reason = _classify_one(
            script=script,
            root_cause=root_cause,
            policy=policy,
            all_failed=all_failed,
            script_to_idx=script_to_idx,
            all_scripts_failed=all_scripts_failed,
            audit_entries=audit_entries,
        )
        strategies.append({
            'script':     script,
            'root_cause': root_cause,
            'strategy':   strategy,
            'upstream':   upstream,
            'reason':     reason,
        })

        if strategy == 'retry_now':
            retry_now.append(script)
        elif strategy == 'skip_and_degrade':
            degraded.append(script)
        elif strategy == 'manual_attention':
            manual_attn.append(script)
        # retry_upstream_first handled below

    # Promote upstreams of retry_upstream_first into retry_now
    for entry in strategies:
        if entry['strategy'] != 'retry_upstream_first':
            continue
        upstream = entry['upstream']
        if not upstream or upstream in retry_now:
            continue
        # Only promote if upstream itself isn't manual_attention
        upstream_entry = next((s for s in strategies if s['script'] == upstream), None)
        if upstream_entry and upstream_entry['strategy'] == 'manual_attention':
            continue
        retry_now.append(upstream)
        if upstream_entry:
            upstream_entry['strategy'] = 'retry_now'
            upstream_entry['reason']   = (
                f"Promoted: downstream {entry['script']!r} requires this first"
            )

    # ── healing_state ─────────────────────────────────────────────────────────
    if all_scripts_failed or manual_attn:
        healing_state = 'critical'
    elif failed_items:
        healing_state = 'degraded'
    else:
        healing_state = 'healthy'

    # Append ops mode context for UI consumers
    ops_mode: dict = {}
    try:
        from services.pipeline_ops_mode import load_ops_mode as _lom
        ops_mode = _lom()
    except Exception:
        pass

    return {
        'ok':                True,
        'healing_state':     healing_state,
        'strategies':        strategies,
        'retry_now_scripts': retry_now,
        'degraded':          degraded,
        'manual_attention':  manual_attn,
        'ops_mode':          ops_mode,
    }


def _empty_plan(error: str) -> dict:
    return {
        'ok':                False,
        'healing_state':     'critical',
        'strategies':        [],
        'retry_now_scripts': [],
        'degraded':          [],
        'manual_attention':  [],
        'error':             error,
    }


# ── public API: integration hook (for pipeline_retry.get_retry_plan) ──────────

def apply_healing_filter(
    scripts_to_retry: list,
    cause_map:        dict,
    policy:           Any,          # dict | None
) -> tuple:
    """
    Filter scripts_to_retry through healing-strategy rules.

    Returns (kept_scripts, new_blocked_entries).
    Only retry_now strategies are kept for actual execution.
    retry_upstream_first, skip_and_degrade, manual_attention → moved to blocked.

    For retry_upstream_first: promotes the upstream script into kept if present.
    """
    if not scripts_to_retry:
        return scripts_to_retry, []

    # Audit entries for recurring-unknown check
    audit_entries = _load_json_safe(_AUDIT_PATH) or []
    if not isinstance(audit_entries, list):
        audit_entries = []

    all_failed    = [s['script'] for s in scripts_to_retry if isinstance(s, dict)]
    script_to_idx = {s: i for i, s in enumerate(all_failed)}

    kept:        list = []
    new_blocked: list = []
    # Track which upstreams were already promoted to avoid duplicates
    promoted_upstreams: set = set()

    for entry in scripts_to_retry:
        if not isinstance(entry, dict):
            continue
        script     = entry.get('script', '')
        root_cause = cause_map.get(script, 'unknown') if isinstance(cause_map, dict) else 'unknown'

        strategy, upstream, reason = _classify_one(
            script=script,
            root_cause=root_cause,
            policy=policy,
            all_failed=all_failed,
            script_to_idx=script_to_idx,
            all_scripts_failed=False,   # conservative: caller's eligibility check handles this
            audit_entries=audit_entries,
        )

        if strategy == 'retry_now':
            kept.append(entry)

        elif strategy == 'retry_upstream_first':
            # Block the downstream; promote upstream if eligible and present
            new_blocked.append({
                'script':      script,
                'skip_reason': f'healing: upstream {upstream!r} must retry first',
            })
            if upstream and upstream in all_failed and upstream not in promoted_upstreams:
                upstream_entry = next(
                    (e for e in scripts_to_retry if isinstance(e, dict) and e.get('script') == upstream),
                    None,
                )
                if upstream_entry:
                    promoted_upstreams.add(upstream)
                    # Upstream will be processed in its own iteration;
                    # no action needed here — the upstream keeps its own slot.
                    # If upstream was already classified as retry_now it stays.

        else:  # skip_and_degrade or manual_attention
            new_blocked.append({
                'script':      script,
                'skip_reason': f'healing: {strategy} — {reason}',
            })

    # Ensure promoted upstreams aren't accidentally blocked if they appear later
    # (they are processed as their own entry in scripts_to_retry, so this is fine)

    return kept, new_blocked
