from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend" / "src"
PROMPT_FILE = FRONTEND / "lib" / "terminal-mvp" / "newsSynthesizePrompts.ts"
RENDERER_FILE = FRONTEND / "lib" / "terminal-mvp" / "narrativeRenderer.ts"
ROUTE_FILE = FRONTEND / "app" / "api" / "terminal" / "news-synthesize" / "route.ts"


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def section_between(text: str, start: str, end: str) -> str:
    start_index = text.index(start)
    end_index = text.index(end, start_index)
    return text[start_index:end_index]


def test_digest_helpers_removed_from_prompt_module():
    text = read_text(PROMPT_FILE)
    assert "buildDigestSystemPrompt" not in text
    assert "buildDigestPrompt" not in text
    assert "buildDigestRetryPrompt" not in text
    assert "buildDigestFallbackText" not in text
    assert "TerminalNewsDigestSpine" not in text


def test_brief_prompt_stays_stock_specific():
    text = read_text(PROMPT_FILE)
    section = section_between(
        text,
        "export const buildBriefSystemPromptEN =",
        "export const buildBriefUserPromptEN =",
    )

    assert "company-specific catalysts" in section
    assert "broad index comparisons" in section
    assert "technical-analysis language" in section

    user_section = text[text.index("export const buildBriefUserPromptEN ="):]
    assert "Output language: English" not in user_section


def test_renderer_does_not_surface_relative_view():
    text = read_text(RENDERER_FILE)
    assert "spine.CONFIDENCE" in text
    assert "spine.RELATIVE_VIEW" not in text


def test_terminal_news_route_uses_only_current_synthesis_path():
    text = read_text(ROUTE_FILE)

    assert "runTerminalProviderSequence" in text
    assert "provider_used" in text
    assert "synthesizeDigest" not in text
    assert "buildDigestSystemPrompt" not in text
    assert "parseDigestResponse" not in text
