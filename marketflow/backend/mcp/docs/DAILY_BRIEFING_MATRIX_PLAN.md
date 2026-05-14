# Daily Briefing Matrix Plan (MCP v0.4)

## Goal
Design Daily Briefing MCP integration around the current 2x2 structure:
- V3 + Claude
- V3 + DeepSeek
- V6 + Claude
- V6 + DeepSeek

This phase does not select a final production version.

## Correct Model
Two independent dimensions:
1. Engine version:
   - `v3`
   - `v6`
2. Renderer/style:
   - `claude`
   - `deepseek`

Matrix:
- `v3 + claude`
- `v3 + deepseek`
- `v6 + claude`
- `v6 + deepseek`

## Core Principle
- MCP provides one shared briefing context.
- V3/V6 are engine variants consuming the same context.
- Claude/DeepSeek are renderer/style variants layered on top of engine version.

## Target Architecture
`mcp.daily_briefing_context`
-> `briefing_engine_adapter`
-> `v3_engine`
-> `claude_renderer`
-> `deepseek_renderer`
-> `v6_engine`
-> `claude_renderer`
-> `deepseek_renderer`
-> `briefing_output_comparator`

## 2x2 Matrix Status
| Engine | Renderer | Status | Path | Input | Output | Notes |
|---|---|---|---|---|---|---|
| V3 | Claude | testing | `cache/daily_briefing_v3.json` | shared MCP context + `engine_version=v3`, `renderer=claude` | normalized adapter envelope (`title`, `sections`, `script`, `_meta`) | Default mode remains placeholder; safe mode reads cache only |
| V3 | DeepSeek | testing | `cache/daily_briefing_deepseek_v3.json` | shared MCP context + `engine_version=v3`, `renderer=deepseek` | normalized adapter envelope (`title`, `sections`, `script`, `_meta`) | No generate call from MCP adapter |
| V6 | Claude | testing | `cache/daily_briefing_v6.json` | shared MCP context + `engine_version=v6`, `renderer=claude` | normalized adapter envelope (`title`, `sections`, `script`, `_meta`) | Cache-read only in safe mode |
| V6 | DeepSeek | testing | `cache/daily_briefing_deepseek_v6.json` | shared MCP context + `engine_version=v6`, `renderer=deepseek` | normalized adapter envelope (`title`, `sections`, `script`, `_meta`) | Cache may be absent; placeholder fallback required |

## Shared MCP Context Contract
Target common input contract for all matrix cells:

```json
{
  "date": "2026-05-14",
  "market_snapshot": {},
  "top_market_story": "string",
  "top_events": [],
  "watchlist_rank": [],
  "sector_context": [],
  "risk_context": {},
  "briefing_outline": [],
  "_meta": {}
}
```

Notes:
- Current implementation already provides `date`, `top_market_story`, `top_events`, `watchlist_rank`, `sector_context`, `risk_context`, `briefing_outline`, `_meta`.
- `market_snapshot` is treated as part of the target contract for engine-facing integration planning.

## Adapter Interface
Primary interface:

```python
build_briefing_from_context(
  context: dict,
  engine_version: str,
  renderer: str,
  mode: str = "midform"
) -> dict
```

Allowed `engine_version`:
- `"v3"`
- `"v6"`

Allowed `renderer`:
- `"claude"`
- `"deepseek"`

Current v0.4 extension (safety):
- optional `source_mode` exists in implementation (`placeholder`, `existing_engine_safe`, `disabled`)
- default stays `placeholder` (offline-safe)

## Comparator Interface

```python
compare_briefing_outputs(
  outputs: list[dict]
) -> dict
```

Comparison dimensions:
- news relevance
- market reaction clarity
- risk explanation
- subscriber readability
- overcomplexity
- hallucination risk
- production readiness

Important:
- Comparator output is for human review queue only.
- No automatic production selection is allowed in this phase.

## Guardrails
- Do not modify frontend UI.
- Do not delete or rewrite existing V3/V6/Claude/DeepSeek production scripts.
- Do not call live model APIs by default from MCP adapter.
- Keep production behavior unchanged.

## Decision Status
- Engine/renderer matrix design: accepted for testing workflow.
- Final production version choice: deferred.

