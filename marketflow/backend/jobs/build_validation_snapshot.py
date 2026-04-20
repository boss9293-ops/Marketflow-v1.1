from __future__ import annotations

import os
import subprocess
import sys
from typing import Optional


def _backend_dir() -> str:
    return os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def _script_env(extra: dict[str, str] | None = None) -> dict[str, str]:
    backend_dir = _backend_dir()
    scripts_dir = os.path.join(backend_dir, "scripts")
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"
    pythonpath_parts = [backend_dir, scripts_dir]
    existing_pythonpath = env.get("PYTHONPATH", "").strip()
    if existing_pythonpath:
        pythonpath_parts.append(existing_pythonpath)
    env["PYTHONPATH"] = os.pathsep.join(part for part in pythonpath_parts if part)
    if extra:
        env.update(extra)
    return env


def build_validation_snapshot(market_proxy: str = "QQQ") -> bool:
    """
    APScheduler job wrapper for backend/scripts/build_validation_snapshot.py.
    Returns True on success.
    """
    backend_dir = _backend_dir()
    script = os.path.join(backend_dir, "scripts", "build_validation_snapshot.py")
    env = _script_env()
    market_proxy = (market_proxy or "QQQ").upper()
    if market_proxy not in ("QQQ", "SPY"):
        market_proxy = "QQQ"

    proc = subprocess.run(
        [sys.executable, "-X", "utf8", script, "--market-proxy", market_proxy],
        cwd=backend_dir,
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        timeout=600,
        env=env,
    )
    if proc.returncode != 0:
        msg = (proc.stderr or proc.stdout or "").strip()
        print(f"[ValidationGuardScheduler] build_validation_snapshot failed rc={proc.returncode}: {msg}")
        return False
    out = (proc.stdout or "").strip()
    if out:
        print(f"[ValidationGuardScheduler] {out}")
    return True
