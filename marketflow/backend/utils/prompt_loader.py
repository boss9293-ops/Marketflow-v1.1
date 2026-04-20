from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict


_CACHE: Dict[str, str] = {}
_FILE_DIR = Path(__file__).resolve().parent
_MARKETFLOW_DIR = _FILE_DIR.parent.parent
_CANONICAL_PROMPT_ROOT = (_MARKETFLOW_DIR / "prompts").resolve()


def canonical_prompt_root() -> Path:
    return _CANONICAL_PROMPT_ROOT


def prompt_root_candidates() -> list[Path]:
    root = canonical_prompt_root()
    return [root] if root.exists() else []


def _candidate_paths(path: str) -> list[Path]:
    raw = Path(path)
    if raw.is_absolute():
        resolved = raw.resolve()
        for root in prompt_root_candidates():
            try:
                resolved.relative_to(root)
                return [resolved]
            except ValueError:
                continue
        return []

    text = str(raw).replace("\\", "/").strip("/")
    if ".." in Path(text).parts:
        return []
    variants = [raw]

    if text.startswith("marketflow/prompts/"):
        variants.append(Path(text.removeprefix("marketflow/prompts/")))
    if text.startswith("marketflow/"):
        variants.append(Path(text.removeprefix("marketflow/")))
    if text.startswith("prompts/"):
        variants.append(Path(text.removeprefix("prompts/")))

    roots = prompt_root_candidates()
    candidates: list[Path] = []
    seen: set[str] = set()
    for variant in variants:
        for root in roots:
            candidate = (root / variant).resolve()
            key = str(candidate)
            if key not in seen:
                seen.add(key)
                candidates.append(candidate)
    return candidates


def _resolve_prompt_path(path: str) -> Path:
    for candidate in _candidate_paths(path):
        if candidate.exists():
            return candidate.resolve()
    raise FileNotFoundError(f"Prompt file not found: {path}")


def resolve_prompt_path(path: str) -> Path:
    return _resolve_prompt_path(path)


def load_prompt(path: str) -> str:
    resolved = _resolve_prompt_path(path)
    cache_key = str(resolved)

    if cache_key in _CACHE:
        return _CACHE[cache_key]

    content = resolved.read_text(encoding="utf-8")
    _CACHE[cache_key] = content
    return content


def strip_frontmatter(text: str) -> str:
    clean = (text or "").strip()
    if clean.startswith("---"):
        parts = clean.split("---", 2)
        if len(parts) >= 3:
            return parts[2].strip()
    return clean


def load_prompt_text(path: str) -> str:
    try:
        return strip_frontmatter(load_prompt(path))
    except FileNotFoundError:
        return ""


def load_prompt_registry() -> Dict[str, Any]:
    seen: set[str] = set()
    for root in prompt_root_candidates():
        candidate = (root / "_registry.json").resolve()
        key = str(candidate)
        if key in seen:
            continue
        seen.add(key)
        if not candidate.exists():
            continue
        try:
            return json.loads(candidate.read_text(encoding="utf-8"))
        except Exception:
            continue
    return {}


def get_engine_knowledge() -> Dict[str, str]:
    return {
        "transmission_map": load_prompt("engine_knowledge/transmission/transmission_map.md"),
        "track_b_velocity": load_prompt("engine_knowledge/tracks/track_b_velocity.md"),
        "track_a_credit": load_prompt("engine_knowledge/tracks/track_a_credit.md"),
        "track_c_event": load_prompt("engine_knowledge/tracks/track_c_event.md"),
        "mss_engine": load_prompt("engine_knowledge/core/mss_engine.md"),
    }


def get_narrative_templates() -> Dict[str, str]:
    return {
        "briefing_v1": load_prompt("engine_narrative/briefing_v1.md"),
        "watchlist_v1": load_prompt("engine_narrative/watchlist_v1.md"),
        "portfolio_v1": load_prompt("engine_narrative/portfolio_v1.md"),
        "account_manager_v1": load_prompt("engine_narrative/account_manager_v1.md"),
    }
