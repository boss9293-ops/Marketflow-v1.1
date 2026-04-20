from __future__ import annotations

from pathlib import Path

try:
    from backend.utils.prompt_loader import load_prompt_registry, load_prompt_text
except Exception:
    from utils.prompt_loader import load_prompt_registry, load_prompt_text  # type: ignore


class PromptManager:
    @staticmethod
    def _get_registry() -> dict:
        return load_prompt_registry()

    @classmethod
    def _active_prompt_path(cls, page_name: str) -> str:
        registry = cls._get_registry()
        try:
            active_rel_path = registry["pages"][page_name]["auto"]["active"]
        except Exception:
            return ""
        return str(active_rel_path or "").strip()

    @classmethod
    def get_auto_prompt(cls, page_name: str) -> str:
        """Return the active auto prompt text for the requested page."""
        active_rel_path = cls._active_prompt_path(page_name)
        if not active_rel_path:
            return ""
        try:
            return load_prompt_text(active_rel_path)
        except Exception:
            return ""

    @classmethod
    def get_user_reqs(cls, page_name: str) -> list[str]:
        """Return the active user request prompts for the requested page."""
        registry = cls._get_registry()
        try:
            active_paths = registry["pages"][page_name]["user_req"].get("active", [])
        except Exception:
            return []

        req_texts: list[str] = []
        for rel_path in active_paths:
            try:
                text = load_prompt_text(str(rel_path))
            except Exception:
                text = ""
            if text:
                req_texts.append(text)
        return req_texts

    @classmethod
    def get_auto_prompt_meta(cls, page_name: str) -> dict:
        """Return metadata for the active auto prompt."""
        active_rel_path = cls._active_prompt_path(page_name)
        if not active_rel_path:
            return {
                "version": "default_fallback",
                "key": "fallback",
                "source": "fallback",
                "fallback_used": True,
            }

        filename = Path(active_rel_path).name
        version = "unknown"
        key = page_name
        if "_" in filename:
            version, remainder = filename.split("_", 1)
            key = remainder.rsplit(".md", 1)[0]

        return {
            "version": version,
            "key": key,
            "source": "registry",
            "fallback_used": False,
        }

    @classmethod
    def assemble_full_prompt(cls, page_name: str) -> str:
        """Combine the auto prompt and user-request prompts into a single prompt."""
        auto_text = cls.get_auto_prompt(page_name)
        user_reqs = cls.get_user_reqs(page_name)

        parts = [auto_text]
        if user_reqs:
            parts.append("\n\n===[ Included User Requests ]===")
            for i, req in enumerate(user_reqs, 1):
                parts.append(f"\nRequest {i}:\n{req}")

        return "".join(parts).strip()
