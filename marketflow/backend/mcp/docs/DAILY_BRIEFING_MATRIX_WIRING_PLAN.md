# Daily Briefing Matrix Wiring Plan (MCP v0.4)

## Objective
Prepare safe wiring for the 2x2 Daily Briefing matrix in MCP without changing production behavior.

## Safety Principles
- Default mode must stay offline: `source_mode=placeholder`.
- No live Claude/DeepSeek/OpenAI calls from MCP adapter by default.
- Use read-only cache access for `existing_engine_safe` mode.
- Do not call `/generate` endpoints or script `main()` from MCP adapter.
- Do not select production winner in this phase.

## Matrix Status
| Matrix Cell | Cache Artifact | Can Wire Now? | Wiring Mode | Live API Risk | Notes |
|---|---|---|---|---|---|
| V3 + Claude | `cache/daily_briefing_v3.json` | yes | `existing_engine_safe` (cache-read only) | low (if cache-read only) | Default remains placeholder; cache mode is explicit opt-in. |
| V3 + DeepSeek | `cache/daily_briefing_deepseek_v3.json` | yes | `existing_engine_safe` (cache-read only) | low (if cache-read only) | Never trigger deepseek generation from MCP adapter. |
| V6 + Claude | `cache/daily_briefing_v6.json` | yes | `existing_engine_safe` (cache-read only) | low (if cache-read only) | Avoid direct script invocation from MCP path. |
| V6 + DeepSeek | `cache/daily_briefing_deepseek_v6.json` | yes | `existing_engine_safe` (cache-read only) | low (if cache-read only) | Requires pre-generated cache to be present. |

## What Remains Placeholder
- All four cells in default operation (`source_mode=placeholder`).
- Any cell where cache is missing or malformed while in `existing_engine_safe`.
- Any path requiring script execution or network call remains blocked.

## What Requires More Information
- Stable, side-effect-free Python function entry points for V3/V6 builders that do not write files.
- Definitive contract for raw engine output schemas across releases.
- Production policy for when cache freshness is stale and regeneration is needed.

## Risk Register
| Risk | Trigger | Impact | Mitigation |
|---|---|---|---|
| Accidental live API call | Calling script builders or `/generate` routes from MCP | Cost, latency, key dependency, nondeterminism | Hard guard: `MARKETFLOW_MCP_ALLOW_LIVE_BRIEFING_CALLS=false` default and adapter never calls live APIs in v0.4 |
| Production behavior drift | Reusing engine internals directly with side effects | Cache overwrite or runtime coupling | Keep MCP adapter read-only and cache-only in safe mode |
| Hidden dependency failures | Missing keys/packages (`anthropic`, `requests`, `DEEPL`) | Runtime exceptions | Keep default placeholder mode; safe mode uses cache file reads only |
| Inconsistent output schema | Engine release differences | Comparator instability | Normalize adapter output to stable MCP schema |

## Current v0.4 Adapter Policy
- `source_mode=placeholder` (default): context-driven placeholder output only.
- `source_mode=existing_engine_safe`: read cached briefing JSON only; no script execution, no network call.
- `source_mode=disabled`: explicit disabled payload for matrix cells.
- `_meta.source_mode` and guard fields are emitted for every matrix output.

## Decision Policy
- v0.4 does not choose a final production version.
- Comparator ranking is for human review queue only.
- Production selection remains an explicit future decision gate.

## v0.6 Safe Wiring Result
| Engine | Renderer | Safe Wiring | Engine Path | Source | Live API Required | Notes |
|---|---|---|---|---|---|---|
| V3 | Claude | yes (cache present) | `cache/daily_briefing_v3.json` | `existing_engine_safe` | no | Offline cache-read bridge path confirmed. |
| V3 | DeepSeek | yes (cache present) | `cache/daily_briefing_deepseek_v3.json` | `existing_engine_safe` | no | Offline cache-read bridge path confirmed. |
| V6 | Claude | yes (cache present) | `cache/daily_briefing_v6.json` | `existing_engine_safe` | no | Offline cache-read bridge path confirmed. |
| V6 | DeepSeek | yes (cache present) | `cache/daily_briefing_deepseek_v6.json` | `existing_engine_safe` | no | Offline cache-read bridge path confirmed. |

Additional safety notes:
- If cache is missing or malformed, bridge returns `disabled` fallback payload.
- `live_api_call_attempted` remains `false` by default.
- No production selection is made in v0.6.
