"""
Retry policy controls -- operator-configurable rules for the auto-retry system.

Policy schema:
  enabled:              bool   -- master switch; false blocks all retries
  max_retry_per_script: int    -- 0..3; 0 blocks all, >=1 allows up to N per invocation
  allow_root_causes:    str[]  -- if non-empty, only these cause types may retry
  deny_root_causes:     str[]  -- these cause types are always blocked (deny wins)
  allow_scripts:        str[]  -- if non-empty, only these scripts may retry
  deny_scripts:         str[]  -- these scripts are always blocked (deny wins)
  cooldown_sec:         int    -- 0..3600; min seconds between retry runs

Precedence (highest to lowest):
  1. enabled=false   -- blocks everything
  2. max_retry=0     -- blocks everything
  3. deny_scripts    -- blocks specific script
  4. deny_root_causes-- blocks specific cause class
  5. allow_scripts   -- restricts to list (if non-empty)
  6. allow_root_causes-- restricts to list (if non-empty)
"""
import json
import os
from typing import Any

_HERE       = os.path.dirname(os.path.abspath(__file__))
_OUTPUT_DIR = os.path.join(_HERE, '..', 'output')
_POLICY_PATH = os.path.join(_OUTPUT_DIR, 'cache', 'pipeline_retry_policy.json')

VALID_ROOT_CAUSES = frozenset({
    'timeout',
    'missing_input',
    'malformed_json',
    'dependency_failure',
    'script_exception',
    'unknown',
})

DEFAULT_POLICY: dict = {
    'enabled':              True,
    'max_retry_per_script': 1,
    'allow_root_causes':    [],
    'deny_root_causes':     [],
    'allow_scripts':        [],
    'deny_scripts':         [],
    'cooldown_sec':         0,
}


def _load_json_safe(path: str) -> Any:
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return None


def load_policy() -> dict:
    """
    Load policy from file. Falls back to DEFAULT_POLICY on missing/invalid file.
    Never raises.
    """
    raw = _load_json_safe(_POLICY_PATH)
    if not isinstance(raw, dict):
        return dict(DEFAULT_POLICY)

    cleaned, errors = validate_policy(raw)
    if errors or cleaned is None:
        return dict(DEFAULT_POLICY)

    return cleaned


def save_policy(data: dict) -> tuple:
    """
    Validate and persist policy. Returns (saved_policy | None, errors).
    """
    cleaned, errors = validate_policy(data)
    if errors or cleaned is None:
        return None, errors

    try:
        os.makedirs(os.path.dirname(_POLICY_PATH), exist_ok=True)
        with open(_POLICY_PATH, 'w', encoding='utf-8') as f:
            json.dump(cleaned, f, indent=2)
        return cleaned, []
    except Exception as e:
        return None, [f'Failed to write policy file: {e}']


def validate_policy(data: dict) -> tuple:
    """
    Validate and coerce a policy dict.
    Returns (cleaned_dict, errors_list).
    cleaned_dict is None when errors are present.
    """
    if not isinstance(data, dict):
        return None, ['Policy must be a JSON object.']

    errors: list = []
    cleaned: dict = {}

    # enabled
    v = data.get('enabled', DEFAULT_POLICY['enabled'])
    if not isinstance(v, bool):
        errors.append("'enabled' must be a boolean (true or false).")
    else:
        cleaned['enabled'] = v

    # max_retry_per_script
    v = data.get('max_retry_per_script', DEFAULT_POLICY['max_retry_per_script'])
    if isinstance(v, bool) or not isinstance(v, int) or not (0 <= v <= 3):
        errors.append("'max_retry_per_script' must be an integer 0..3.")
    else:
        cleaned['max_retry_per_script'] = v

    # allow_root_causes
    v = data.get('allow_root_causes', [])
    if not isinstance(v, list):
        errors.append("'allow_root_causes' must be an array of root cause strings.")
    else:
        bad = [x for x in v if x not in VALID_ROOT_CAUSES]
        if bad:
            errors.append(
                f"'allow_root_causes' contains unknown value(s): {bad}. "
                f"Valid values: {sorted(VALID_ROOT_CAUSES)}"
            )
        else:
            cleaned['allow_root_causes'] = [str(x) for x in v]

    # deny_root_causes
    v = data.get('deny_root_causes', [])
    if not isinstance(v, list):
        errors.append("'deny_root_causes' must be an array of root cause strings.")
    else:
        bad = [x for x in v if x not in VALID_ROOT_CAUSES]
        if bad:
            errors.append(
                f"'deny_root_causes' contains unknown value(s): {bad}. "
                f"Valid values: {sorted(VALID_ROOT_CAUSES)}"
            )
        else:
            cleaned['deny_root_causes'] = [str(x) for x in v]

    # allow_scripts
    v = data.get('allow_scripts', [])
    if not isinstance(v, list):
        errors.append("'allow_scripts' must be an array of script filenames.")
    else:
        cleaned['allow_scripts'] = [str(x) for x in v if x]

    # deny_scripts
    v = data.get('deny_scripts', [])
    if not isinstance(v, list):
        errors.append("'deny_scripts' must be an array of script filenames.")
    else:
        cleaned['deny_scripts'] = [str(x) for x in v if x]

    # cooldown_sec
    v = data.get('cooldown_sec', DEFAULT_POLICY['cooldown_sec'])
    if isinstance(v, bool) or not isinstance(v, int) or not (0 <= v <= 3600):
        errors.append("'cooldown_sec' must be an integer 0..3600.")
    else:
        cleaned['cooldown_sec'] = v

    if errors:
        return None, errors

    # Fill any keys missing from input (unknown keys are silently dropped)
    for k, dv in DEFAULT_POLICY.items():
        if k not in cleaned:
            cleaned[k] = dv

    return cleaned, []


def check_script_allowed(script: str, root_cause: str, policy: dict) -> tuple:
    """
    Check if a script is allowed to retry under the given policy.
    Deny rules always take precedence over allow rules.
    Returns (allowed: bool, reason: str).
    """
    # 1. Master switch
    if not policy.get('enabled', True):
        return False, 'retry disabled by policy'

    # 2. Max retry gate
    if int(policy.get('max_retry_per_script', 1)) == 0:
        return False, 'max_retry_per_script=0 blocks all retries'

    # 3. Script-level deny (highest specificity)
    if script in policy.get('deny_scripts', []):
        return False, f'script "{script}" is in deny list'

    # 4. Root cause deny
    if root_cause in policy.get('deny_root_causes', []):
        return False, f'root cause "{root_cause}" is in deny list'

    # 5. Script-level allow (restrict to list when non-empty)
    allow_scripts = policy.get('allow_scripts', [])
    if allow_scripts and script not in allow_scripts:
        return False, f'script "{script}" not in allow list'

    # 6. Root cause allow (restrict to list when non-empty)
    allow_causes = policy.get('allow_root_causes', [])
    if allow_causes and root_cause not in allow_causes:
        return False, f'root cause "{root_cause}" not in allow list'

    return True, 'allowed by policy'
