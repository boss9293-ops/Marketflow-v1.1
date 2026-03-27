"""
Pipeline Episode Service  (WO-W17)
==================================
Groups consecutive pipeline runs into higher-level "incidents" (episodes).

Data sources (read-only):
  output/pipeline_history.json          — run history (newest first)
  output/cache/pipeline_retry_audit.json — per-run retry counts

Written by this service:
  output/cache/pipeline_episode_log.json — computed episodes (newest first, cap 20)

Episode lifecycle:
  OPEN  — first failure OR run that had retries
  CLOSE — 2 consecutive clean (ok) runs → "resolved"
         end of history with no close → "active"
"""

import json
import os

# ── paths ─────────────────────────────────────────────────────────────────────

_HERE         = os.path.dirname(os.path.abspath(__file__))
_OUTPUT_DIR   = os.path.join(_HERE, '..', 'output')
_HISTORY_PATH = os.path.join(_OUTPUT_DIR, 'pipeline_history.json')
_AUDIT_PATH   = os.path.join(_OUTPUT_DIR, 'cache', 'pipeline_retry_audit.json')
_EPISODE_PATH = os.path.join(_OUTPUT_DIR, 'cache', 'pipeline_episode_log.json')

_MAX_EPISODES = 20
_CLOSE_STREAK = 2   # consecutive clean runs needed to resolve an episode

# Severity thresholds
_SEV_CRITICAL_SCRIPTS  = 10
_SEV_CRITICAL_FAILURES = 5
_SEV_HIGH_SCRIPTS      = 5
_SEV_HIGH_FAILURES     = 4
_SEV_MED_SCRIPTS       = 2
_SEV_MED_FAILURES      = 2

# ── helpers ───────────────────────────────────────────────────────────────────

def _load_json_safe(path: str):
    """Return parsed JSON or None. Never raises."""
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return None


def _write_safe(path: str, data) -> None:
    """Write JSON to path, creating dirs as needed. Never raises."""
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
    except Exception:
        pass

# ── classification ─────────────────────────────────────────────────────────────

def _classify_episode(ep: dict) -> None:
    """Mutate ep in-place: add severity and root_cause fields."""
    scripts_failed_peak = ep.get('scripts_failed_peak', 0)
    failure_count       = ep.get('failure_count', 0)
    retry_count         = ep.get('retry_count', 0)

    # Severity
    if scripts_failed_peak >= _SEV_CRITICAL_SCRIPTS or failure_count >= _SEV_CRITICAL_FAILURES:
        severity = 'critical'
    elif scripts_failed_peak >= _SEV_HIGH_SCRIPTS or failure_count >= _SEV_HIGH_FAILURES:
        severity = 'high'
    elif scripts_failed_peak >= _SEV_MED_SCRIPTS or failure_count >= _SEV_MED_FAILURES or retry_count > 0:
        severity = 'medium'
    else:
        severity = 'low'

    # Root cause
    if severity == 'critical':
        root_cause = 'systemic'
    elif severity == 'high':
        root_cause = 'recurring'
    elif severity == 'medium' and failure_count >= 2 and retry_count == 0:
        root_cause = 'intermittent'
    else:
        root_cause = 'transient'

    ep['severity']   = severity
    ep['root_cause'] = root_cause

# ── core state machine ─────────────────────────────────────────────────────────

def _build_episodes(history: list, audit_idx: dict) -> tuple:
    """
    Run the episode state machine over chronological history.

    Returns (episodes_newest_first: list, final_consecutive_ok: int).
    """
    episodes: list = []
    current_ep     = None
    consecutive_ok = 0

    # history is newest-first → reverse for chronological processing
    for run in reversed(history):
        if not isinstance(run, dict):
            continue

        ts             = run.get('timestamp', '')
        status         = run.get('status', 'unknown')
        scripts_failed = int(run.get('scripts_failed', 0) or 0)

        audit_entry = audit_idx.get(ts, {})
        retry_count = int(audit_entry.get('total_attempts', 0) or 0)

        is_failure = (status != 'success') or (scripts_failed > 0)
        had_retry  = retry_count > 0

        if is_failure or had_retry:
            consecutive_ok = 0

            if current_ep is None:
                # Open a new episode
                ep_date = ts[:10].replace('-', '')
                ep_time = ts[11:19].replace(':', '') if len(ts) >= 19 else '000000'
                current_ep = {
                    'episode_id':          f'ep-{ep_date}-{ep_time}',
                    'status':              'active',
                    'start_time':          ts,
                    'end_time':            None,
                    'duration_runs':       1,
                    'failure_count':       1 if is_failure else 0,
                    'retry_count':         retry_count,
                    'scripts_failed_peak': scripts_failed,
                }
            else:
                # Extend current episode
                current_ep['duration_runs'] += 1
                if is_failure:
                    current_ep['failure_count'] += 1
                    current_ep['scripts_failed_peak'] = max(
                        current_ep['scripts_failed_peak'], scripts_failed
                    )
                current_ep['retry_count'] += retry_count

        else:
            # Successful run
            consecutive_ok += 1

            if current_ep is not None:
                current_ep['duration_runs'] += 1

                if consecutive_ok >= _CLOSE_STREAK:
                    # Close the episode
                    current_ep['status']   = 'resolved'
                    current_ep['end_time'] = ts
                    _classify_episode(current_ep)
                    episodes.append(dict(current_ep))
                    current_ep     = None
                    consecutive_ok = 0

    # If still open at end of history → active episode
    if current_ep is not None:
        _classify_episode(current_ep)
        episodes.append(dict(current_ep))

    # Return newest first
    episodes.reverse()
    return episodes, consecutive_ok

# ── public API ─────────────────────────────────────────────────────────────────

def compute_episodes() -> dict:
    """
    Derive incident episodes from pipeline history and retry audit.

    Returns::

        {
            ok:               bool,
            active_episode:   dict | None,
            episodes:         list,   # newest first, cap 20
            total_episodes:   int,
            current_streak:   int,    # consecutive clean runs since last episode
        }
    """
    history = _load_json_safe(_HISTORY_PATH)
    if not isinstance(history, list):
        return {
            'ok':             False,
            'active_episode': None,
            'episodes':       [],
            'total_episodes': 0,
            'current_streak': 0,
            'error':          'pipeline_history.json not available',
        }

    if not history:
        return {
            'ok':             True,
            'active_episode': None,
            'episodes':       [],
            'total_episodes': 0,
            'current_streak': 0,
        }

    # Build audit index: run_timestamp -> audit entry
    audit_raw = _load_json_safe(_AUDIT_PATH)
    audit_idx: dict = {}
    if isinstance(audit_raw, list):
        for entry in audit_raw:
            if isinstance(entry, dict) and 'run_timestamp' in entry:
                audit_idx[entry['run_timestamp']] = entry

    episodes, final_streak = _build_episodes(history, audit_idx)

    # Cap to _MAX_EPISODES
    episodes_out = episodes[:_MAX_EPISODES]

    # Persist to cache
    _write_safe(_EPISODE_PATH, episodes_out)

    active_ep = episodes_out[0] if episodes_out and episodes_out[0].get('status') == 'active' else None

    return {
        'ok':             True,
        'active_episode': active_ep,
        'episodes':       episodes_out,
        'total_episodes': len(episodes_out),
        'current_streak': final_streak if active_ep is None else 0,
    }
