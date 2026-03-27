"""
Pipeline Operator Mode Service  (WO-W16)
=======================================
Stores/retrieves operator overrides for pipeline retry behaviour.

Config file: output/cache/pipeline_ops_mode.json
Schema:
  enabled                       bool  – maintenance mode (kills all auto-retry)
  reason                        str   – human note for the maintenance window
  set_by                        str   – who toggled it
  set_at                        str   – ISO timestamp of last write
  force_skip_scripts            list  – always skip, never retry
  force_manual_attention_scripts list – pull from retry queue, flag for humans
  force_allow_retry_scripts     list  – unblock policy/healing blocks (not structural)
"""

import datetime
import json
import os
from typing import Any

# ── path resolution ────────────────────────────────────────────────────────────

_HERE = os.path.dirname(os.path.abspath(__file__))

def _output_dir() -> str:
    # services/ is inside backend/; output/cache/ is backend/output/cache/
    candidate = os.path.join(_HERE, '..', 'output', 'cache')
    os.makedirs(candidate, exist_ok=True)
    return candidate

def _ops_path() -> str:
    return os.path.join(_output_dir(), 'pipeline_ops_mode.json')

# ── defaults ───────────────────────────────────────────────────────────────────

_DEFAULT_OPS: dict = {
    'enabled':                        False,
    'reason':                         '',
    'set_by':                         '',
    'set_at':                         '',
    'force_skip_scripts':             [],
    'force_manual_attention_scripts': [],
    'force_allow_retry_scripts':      [],
}

# Strategies / causes that can never be overridden by force_allow_retry
_HARD_BLOCK_REASONS = frozenset({
    'all script',       # all_scripts_failed sentinel phrase
    'structural',
    'critical',
    'manual investigation',
})

# ── public: load ───────────────────────────────────────────────────────────────

def load_ops_mode() -> dict:
    """
    Load operator mode config.  Returns defaults if file is missing/invalid.
    Never raises.
    """
    try:
        p = _ops_path()
        if not os.path.exists(p):
            return dict(_DEFAULT_OPS)
        with open(p, encoding='utf-8') as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return dict(_DEFAULT_OPS)
        result = dict(_DEFAULT_OPS)
        result.update(data)
        return result
    except Exception:
        return dict(_DEFAULT_OPS)

# ── public: save ───────────────────────────────────────────────────────────────

def save_ops_mode(config: dict) -> dict:
    """
    Validate, normalise, and persist operator mode config.
    Returns ``{'ok': True, 'config': ...}`` on success,
    ``{'ok': False, 'error': str}`` on failure.
    """
    err = validate_ops_mode(config)
    if err:
        return {'ok': False, 'error': err}
    normalised = _normalise_ops(config)
    normalised['set_at'] = datetime.datetime.now().isoformat(timespec='seconds')
    try:
        p = _ops_path()
        with open(p, 'w', encoding='utf-8') as f:
            json.dump(normalised, f, indent=2)
        return {'ok': True, 'config': normalised}
    except Exception as exc:
        return {'ok': False, 'error': str(exc)}

# ── public: validate ───────────────────────────────────────────────────────────

def validate_ops_mode(config: Any) -> str:
    """Return error string if invalid, empty string if valid."""
    if not isinstance(config, dict):
        return 'config must be an object'
    if 'enabled' in config and not isinstance(config['enabled'], bool):
        return '"enabled" must be a boolean'
    for key in (
        'force_skip_scripts',
        'force_manual_attention_scripts',
        'force_allow_retry_scripts',
    ):
        if key in config:
            if not isinstance(config[key], list):
                return f'"{key}" must be an array'
            if not all(isinstance(s, str) for s in config[key]):
                return f'"{key}" must contain only strings'
    if 'reason' in config and not isinstance(config['reason'], str):
        return '"reason" must be a string'
    if 'set_by' in config and not isinstance(config['set_by'], str):
        return '"set_by" must be a string'
    return ''

# ── internal: normalise ────────────────────────────────────────────────────────

def _normalise_ops(config: dict) -> dict:
    result = dict(_DEFAULT_OPS)
    result.update(config)
    result['enabled'] = bool(result.get('enabled', False))
    result['reason']  = str(result.get('reason', ''))[:200]
    result['set_by']  = str(result.get('set_by', 'operator'))[:100]
    for key in (
        'force_skip_scripts',
        'force_manual_attention_scripts',
        'force_allow_retry_scripts',
    ):
        result[key] = [str(s) for s in result.get(key, [])]
    return result

# ── public: apply overrides ────────────────────────────────────────────────────

def _is_overrideable_block(blocked_entry: dict) -> bool:
    """
    True if a blocked script entry can be unblocked by ``force_allow_retry``.
    Structural / all-scripts-failed / critical blocks are permanent.
    """
    reason   = blocked_entry.get('reason', '') or blocked_entry.get('skip_reason', '')
    strategy = blocked_entry.get('strategy', '')
    lower    = reason.lower()
    if strategy == 'manual_attention':
        for phrase in _HARD_BLOCK_REASONS:
            if phrase in lower:
                return False
    # Ops-placed manual_attention (force_manual_attention_scripts) can be
    # re-overridden only if the operator explicitly adds it to force_allow_retry
    # AND the entry wasn't placed here by a structural reason.
    if 'ops_override' in lower and 'force_manual' in lower:
        return True
    if 'healing: manual_attention' in lower:
        for phrase in _HARD_BLOCK_REASONS:
            if phrase in lower:
                return False
    return True


def apply_ops_overrides(
    scripts_to_retry: list,
    blocked_scripts:  list,
    ops_config:       dict,
) -> tuple:
    """
    Apply operator overrides as a final filter pass after healing.

    Precedence (highest to lowest):
        force_skip                  > force_manual_attention > force_allow_retry

    force_allow_retry cannot unblock structural / critical / all-failed entries.

    Returns (new_scripts_to_retry, new_blocked_scripts).
    """
    force_skip   = set(ops_config.get('force_skip_scripts', []))
    force_manual = set(ops_config.get('force_manual_attention_scripts', []))
    force_allow  = set(ops_config.get('force_allow_retry_scripts', []))

    # Fast-path: nothing to do
    if not (force_skip or force_manual or force_allow):
        return scripts_to_retry, blocked_scripts

    new_retry:   list = []
    new_blocked: list = list(blocked_scripts)

    for entry in scripts_to_retry:
        script = entry.get('script', '') if isinstance(entry, dict) else str(entry)
        if script in force_skip:
            new_blocked.append({
                'script':      script,
                'skip_reason': 'ops_override: force_skip_scripts',
                'strategy':    'skip_and_degrade',
            })
        elif script in force_manual:
            new_blocked.append({
                'script':      script,
                'skip_reason': 'ops_override: force_manual_attention_scripts',
                'strategy':    'manual_attention',
            })
        else:
            new_retry.append(entry)

    # force_allow_retry: attempt to unblock previously-blocked scripts
    if force_allow:
        still_blocked: list = []
        for entry in new_blocked:
            script = entry.get('script', '')
            if script in force_allow and _is_overrideable_block(entry):
                # Re-introduce as a minimal retry dict if original entry lacks fields
                if isinstance(entry, dict) and 'fail_count' in entry:
                    new_retry.append(entry)
                else:
                    new_retry.append({'script': script, 'fail_count': 1, 'category': 'transient'})
            else:
                still_blocked.append(entry)
        new_blocked = still_blocked

    return new_retry, new_blocked
