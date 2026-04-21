from __future__ import annotations

import os
from typing import Mapping

from .data_contract import backend_dir


def build_script_env(
    base_env: Mapping[str, str] | None = None,
    *,
    include_google_sa: bool = False,
    google_sa_json: str | None = None,
) -> dict[str, str]:
    env = dict(os.environ if base_env is None else base_env)
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"

    backend_path = str(backend_dir())
    pythonpath = env.get("PYTHONPATH", "").strip()
    env["PYTHONPATH"] = backend_path if not pythonpath else backend_path + os.pathsep + pythonpath

    if include_google_sa and google_sa_json:
        # Always inject the resolved SA JSON (from DB/file/env) so that
        # subprocess scripts receive a fully-validated value even if the
        # raw env var is malformed or escaped incorrectly (Railway quirk).
        env["GOOGLE_SERVICE_ACCOUNT_JSON"] = google_sa_json

    return env
