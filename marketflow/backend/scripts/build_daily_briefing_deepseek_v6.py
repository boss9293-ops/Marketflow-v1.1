"""
Wrapper for DeepSeek daily briefing build (source=v6).
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def main() -> None:
    script = Path(__file__).resolve().parent / "build_daily_briefing_deepseek.py"
    forwarded = [arg for arg in sys.argv[1:] if not arg.startswith("--source")]
    cmd = [sys.executable, "-X", "utf8", str(script), "--source=v6", *forwarded]
    raise SystemExit(subprocess.call(cmd))


if __name__ == "__main__":
    main()
