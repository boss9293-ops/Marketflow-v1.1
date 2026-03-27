"""
Pipeline auto-retry — transient failure recovery only.
Read-only analysis → controlled subprocess retry → artifact patching.

Rules:
  ALLOW  when: recovery_state=='retryable' AND category=='transient'
               AND fail_count<=2 AND consecutive==False AND not already retried
  BLOCK  when: degraded / manual_attention state, structural/critical scripts,
               scripts_ok==0, missing history, or file not found
  MAX    1 retry per script per run invocation
"""
import json
import os
import subprocess
import sys
import time
from typing import Any

_HERE        = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.normpath(os.path.join(_HERE, '..'))
_SCRIPTS_DIR = os.path.join(_BACKEND_DIR, 'scripts')
_OUTPUT_DIR  = os.path.join(_BACKEND_DIR, 'output')

_MAX_RETRY_PER_SCRIPT    = 1
_MAX_FAIL_COUNT_ELIGIBLE = 2   # fail_count_recent must be <= this
_RETRY_TIMEOUT           = 300  # 5 min per retry attempt (conservative cap)


def _load_json_safe(path: str) -> Any:
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return None


# ── eligibility ───────────────────────────────────────────────────────────────

def get_retry_plan() -> dict:
    """
    Analyzes current recovery state and returns a retry plan.

    Returns:
      eligible:         bool
      reason:           str
      recovery_state:   str
      scripts_to_retry: list[{script, fail_count, category}]
      blocked_scripts:  list[{script, skip_reason}]
    """
    # Lazy import to avoid circular dependency at module load time
    try:
        from services.pipeline_recovery import compute_recovery
        recovery = compute_recovery()
    except Exception as e:
        return {
            'eligible':         False,
            'reason':           f'Recovery analysis unavailable: {e}',
            'recovery_state':   'unknown',
            'scripts_to_retry': [],
            'blocked_scripts':  [],
        }

    state = recovery.get('recovery_state', 'unknown')

    # ── maintenance mode gate ─────────────────────────────────────────
    try:
        from services.pipeline_ops_mode import load_ops_mode as _lom
        _ops = _lom()
        if _ops.get('enabled'):
            return {
                'eligible':         False,
                'reason':           f'Pipeline in maintenance mode: {_ops.get("reason", "operator set")}',
                'recovery_state':   state,
                'scripts_to_retry': [],
                'blocked_scripts':  [],
            }
    except Exception:
        pass

    # Run-level block conditions
    if state in ('unknown', 'stable', 'watch'):
        return {
            'eligible':         False,
            'reason':           f'Recovery state is {state!r} — no retry needed.',
            'recovery_state':   state,
            'scripts_to_retry': [],
            'blocked_scripts':  [],
        }

    if state in ('degraded', 'manual_attention'):
        return {
            'eligible':         False,
            'reason':           f'Recovery state is {state!r} — retry blocked, manual investigation required.',
            'recovery_state':   state,
            'scripts_to_retry': [],
            'blocked_scripts':  [],
        }

    # ── policy check (run-level) ────────────────────────────────────
    _policy     = None
    _cause_map: dict = {}
    try:
        from services.pipeline_retry_policy import load_policy, check_script_allowed as _csa
        _policy = load_policy()
        if not _policy.get('enabled', True):
            return {
                'eligible':         False,
                'reason':           'Retry disabled by policy (enabled=false).',
                'recovery_state':   state,
                'scripts_to_retry': [],
                'blocked_scripts':  [],
            }
        if int(_policy.get('max_retry_per_script', 1)) == 0:
            return {
                'eligible':         False,
                'reason':           'Retry blocked by policy (max_retry_per_script=0).',
                'recovery_state':   state,
                'scripts_to_retry': [],
                'blocked_scripts':  [],
            }
        _cooldown = int(_policy.get('cooldown_sec', 0))
        if _cooldown > 0:
            import time as _time
            from datetime import datetime as _dt
            _rh = _load_json_safe(os.path.join(_OUTPUT_DIR, 'cache', 'pipeline_retry_history.json'))
            if isinstance(_rh, list) and _rh:
                try:
                    _last = _dt.fromisoformat(_rh[0].get('run_timestamp', ''))
                    _elapsed = _time.time() - _last.timestamp()
                    if _elapsed < _cooldown:
                        return {
                            'eligible':         False,
                            'reason':           f'Retry blocked by cooldown ({int(_cooldown - _elapsed)}s remaining).',
                            'recovery_state':   state,
                            'scripts_to_retry': [],
                            'blocked_scripts':  [],
                        }
                except Exception:
                    pass
        try:
            from services.pipeline_root_cause import compute_root_causes as _crc
            _rc = _crc()
            _cause_map = {row['script']: row['cause'] for row in _rc.get('script_cause_breakdown', [])}
        except Exception:
            _cause_map = {}
    except Exception:
        _policy = None

    # state == 'retryable' — evaluate per-script eligibility
    retry_candidates = set(recovery.get('retry_candidates', []))
    script_detail    = recovery.get('script_detail', [])

    scripts_to_retry: list = []
    blocked_scripts:  list = []
    queued:           set  = set()   # prevent duplicate within this invocation

    for detail in script_detail:
        script      = detail.get('script', '')
        category    = detail.get('category', '')
        fail_count  = detail.get('fail_count', 0)
        consecutive = detail.get('consecutive', False)

        # Only process scripts that are in the retry_candidates list
        if script not in retry_candidates:
            continue

        # Prevent duplicate retry within this run
        if script in queued:
            blocked_scripts.append({
                'script':      script,
                'skip_reason': 'already queued for retry in this invocation',
            })
            continue

        # Category check
        if category != 'transient':
            blocked_scripts.append({
                'script':      script,
                'skip_reason': f'category={category!r} — not transient',
            })
            continue

        # Fail count check
        if fail_count > _MAX_FAIL_COUNT_ELIGIBLE:
            blocked_scripts.append({
                'script':      script,
                'skip_reason': f'fail_count={fail_count} > max {_MAX_FAIL_COUNT_ELIGIBLE}',
            })
            continue

        # Consecutive check
        if consecutive:
            blocked_scripts.append({
                'script':      script,
                'skip_reason': 'consecutive failure detected — not transient',
            })
            continue

        # Script file must exist
        script_path = os.path.join(_SCRIPTS_DIR, script)
        if not os.path.isfile(script_path):
            blocked_scripts.append({
                'script':      script,
                'skip_reason': f'script file not found: {script}',
            })
            continue

        # Policy check (per-script)
        if _policy is not None:
            _cause = _cause_map.get(script, 'unknown')
            _ok, _reason = _csa(script, _cause, _policy)
            if not _ok:
                blocked_scripts.append({'script': script, 'skip_reason': f'policy: {_reason}'})
                continue

        scripts_to_retry.append({
            'script':     script,
            'fail_count': fail_count,
            'category':   category,
        })
        queued.add(script)

    if not scripts_to_retry:
        return {
            'eligible':         False,
            'reason':           'No scripts eligible for retry after per-script evaluation.',
            'recovery_state':   state,
            'scripts_to_retry': [],
            'blocked_scripts':  blocked_scripts,
        }

    # ── healing strategy filter ─────────────────────────────────────────
    try:
        from services.pipeline_healing import apply_healing_filter as _ahf
        scripts_to_retry, _hb = _ahf(scripts_to_retry, _cause_map or {}, _policy)
        blocked_scripts.extend(_hb)
    except Exception:
        pass

    if not scripts_to_retry:
        return {
            'eligible':         False,
            'reason':           'No scripts passed healing strategy filter.',
            'recovery_state':   state,
            'scripts_to_retry': [],
            'blocked_scripts':  blocked_scripts,
        }

    # ── ops per-script overrides ───────────────────────────────────
    try:
        from services.pipeline_ops_mode import load_ops_mode as _lom2, apply_ops_overrides as _aoo
        _ops2 = _lom2()
        scripts_to_retry, blocked_scripts = _aoo(scripts_to_retry, blocked_scripts, _ops2)
    except Exception:
        pass

    if not scripts_to_retry:
        return {
            'eligible':         False,
            'reason':           'No scripts queued after operator overrides.',
            'recovery_state':   state,
            'scripts_to_retry': [],
            'blocked_scripts':  blocked_scripts,
        }

    return {
        'eligible':          True,
        'reason':            f'{len(scripts_to_retry)} script(s) queued for retry after healing filter.',
        'recovery_state':    state,
        'scripts_to_retry':  scripts_to_retry,
        'blocked_scripts':   blocked_scripts,
    }


# ── execution ─────────────────────────────────────────────────────────────────

def _run_one_script(script: str) -> tuple:
    """Execute a single script. Returns (success: bool, elapsed_sec: float)."""
    script_path = os.path.join(_SCRIPTS_DIR, script)
    env = os.environ.copy()
    env['PYTHONIOENCODING'] = 'utf-8'
    env['PYTHONUTF8']       = '1'
    start = time.time()
    try:
        result = subprocess.run(
            [sys.executable, '-X', 'utf8', script_path],
            capture_output=True,
            timeout=_RETRY_TIMEOUT,
            encoding='utf-8',
            errors='replace',
            env=env,
        )
        elapsed = time.time() - start
        return result.returncode == 0, round(elapsed, 2)
    except subprocess.TimeoutExpired:
        return False, round(time.time() - start, 2)
    except Exception:
        return False, round(time.time() - start, 2)


def execute_retries(plan: dict) -> dict:
    """
    Execute retries for all eligible scripts in the plan.
    Returns retry_result dict suitable for apply_retry_to_artifacts().
    Never raises.
    """
    retry_summary:   list = []
    recovered_count: int  = 0
    failed_count:    int  = 0

    for item in plan['scripts_to_retry']:
        script  = item['script']
        success, elapsed = _run_one_script(script)
        if success:
            recovered_count += 1
        else:
            failed_count += 1
        retry_summary.append({
            'script':       script,
            'attempt':      1,
            'result':       'success' if success else 'failed',
            'duration_sec': elapsed,
            'recovered':    success,
            'skip_reason':  None,
        })

    # Append blocked scripts as skip entries for full audit trail
    for item in plan['blocked_scripts']:
        retry_summary.append({
            'script':       item['script'],
            'attempt':      0,
            'result':       'skipped',
            'duration_sec': 0.0,
            'recovered':    False,
            'skip_reason':  item['skip_reason'],
        })

    return {
        'retry_attempted':       True,
        'retried_scripts':       [r['script'] for r in retry_summary if r['attempt'] > 0],
        'retry_summary':         retry_summary,
        'retry_recovered_count': recovered_count,
        'retry_failed_count':    failed_count,
    }


# ── artifact patching ─────────────────────────────────────────────────────────

def apply_retry_to_artifacts(ts_iso: str, retry_result: dict) -> None:
    """
    Patches pipeline_status.json and pipeline_history.json with retry fields.
    Appends to output/cache/pipeline_retry_history.json.
    Each sub-operation is individually guarded — never raises.
    """
    try:
        _patch_pipeline_status(retry_result)
    except Exception:
        pass

    try:
        _patch_pipeline_history(retry_result)
    except Exception:
        pass

    try:
        _append_retry_history(ts_iso, retry_result)
    except Exception:
        pass

    try:
        _patch_pipeline_report(retry_result)
    except Exception:
        pass

    try:
        from services.pipeline_retry_audit import write_audit_entry as _wae
        _wae(ts_iso, retry_result)
    except Exception:
        pass


def _patch_pipeline_report(retry_result: dict) -> None:
    path = os.path.join(_OUTPUT_DIR, 'pipeline_report.json')
    if not os.path.exists(path):
        return
    with open(path, 'r', encoding='utf-8') as f:
        report = json.load(f)

    recovered = {r['script'] for r in retry_result['retry_summary'] if r['recovered']}
    if not recovered or not isinstance(report.get('items'), list):
        return

    for item in report['items']:
        if item.get('filename') in recovered:
            item['ok'] = True
            if 'error' in item:
                del item['error']

    report['failed'] = max(0, report.get('failed', 0) - len(recovered))
    report['success'] = report.get('success', 0) + len(recovered)

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2)


def _patch_pipeline_status(retry_result: dict) -> None:
    path = os.path.join(_OUTPUT_DIR, 'pipeline_status.json')
    if not os.path.exists(path):
        return
    with open(path, 'r', encoding='utf-8') as f:
        status = json.load(f)

    recovered = {r['script'] for r in retry_result['retry_summary'] if r['recovered']}
    status['failed_scripts'] = [
        s for s in status.get('failed_scripts', []) if s not in recovered
    ]
    status['scripts_failed'] = max(0, status.get('scripts_failed', 0) - len(recovered))
    status.update({
        'retry_attempted':       True,
        'retried_scripts':       retry_result['retried_scripts'],
        'retry_summary':         retry_result['retry_summary'],
        'retry_recovered_count': retry_result['retry_recovered_count'],
        'retry_failed_count':    retry_result['retry_failed_count'],
    })

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(status, f, indent=2)


def _patch_pipeline_history(retry_result: dict) -> None:
    path = os.path.join(_OUTPUT_DIR, 'pipeline_history.json')
    if not os.path.exists(path):
        return
    with open(path, 'r', encoding='utf-8') as f:
        history = json.load(f)
    if not isinstance(history, list) or len(history) == 0:
        return

    # Patch the most recent entry (index 0) written by _write_pipeline_status
    entry = history[0]
    recovered_count = retry_result['retry_recovered_count']
    entry['retry_attempted']       = True
    entry['retried_scripts']       = retry_result['retried_scripts']
    entry['retry_recovered_count'] = recovered_count
    entry['retry_failed_count']    = retry_result['retry_failed_count']
    entry['scripts_failed'] = max(0, entry.get('scripts_failed', 0) - recovered_count)

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(history, f, indent=2)


def _append_retry_history(ts_iso: str, retry_result: dict) -> None:
    cache_dir = os.path.join(_OUTPUT_DIR, 'cache')
    os.makedirs(cache_dir, exist_ok=True)
    path = os.path.join(cache_dir, 'pipeline_retry_history.json')

    history: list = []
    if os.path.exists(path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                history = json.load(f)
            if not isinstance(history, list):
                history = []
        except Exception:
            history = []

    history.insert(0, {'run_timestamp': ts_iso, **retry_result})
    history = history[:30]   # keep last 30 run entries

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(history, f, indent=2)
