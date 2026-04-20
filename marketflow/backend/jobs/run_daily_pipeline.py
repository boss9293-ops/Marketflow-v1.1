from __future__ import annotations

import os
import subprocess
import sys


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


def _run_backend_script(script_name: str, timeout: int = 14400) -> subprocess.CompletedProcess[str]:
    backend_dir = _backend_dir()
    script = os.path.join(backend_dir, script_name)
    env = _script_env()
    return subprocess.run(
        [sys.executable, "-X", "utf8", script],
        cwd=backend_dir,
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
        env=env,
    )


def run_daily_pipeline() -> bool:
    proc = _run_backend_script("run_pipeline_scheduled.py")
    if proc.returncode != 0:
        msg = (proc.stderr or proc.stdout or "").strip()
        print(f"[DailyPipelineScheduler] run_pipeline_scheduled.py failed rc={proc.returncode}: {msg}")
        return False

    out = (proc.stdout or "").strip()
    if out:
        print(f"[DailyPipelineScheduler] {out}")
    return True
