from __future__ import annotations

import os
import subprocess
import sys


def _backend_dir() -> str:
    return os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def build_ai_briefings(run_label: str = "manual") -> bool:
    backend_dir = _backend_dir()
    script = os.path.join(backend_dir, "scripts", "build_ai_briefings.py")
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"
    proc = subprocess.run(
        [sys.executable, "-X", "utf8", script, "--slot", run_label],
        cwd=backend_dir,
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        timeout=900,
        env=env,
    )
    if proc.returncode != 0:
        msg = (proc.stderr or proc.stdout or "").strip()
        print(f"[AIBriefingsScheduler] build_ai_briefings failed rc={proc.returncode}: {msg}")
        return False
    out = (proc.stdout or "").strip()
    if out:
        print(f"[AIBriefingsScheduler] {out}")
    return True
