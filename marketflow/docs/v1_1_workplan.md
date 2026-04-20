# v1.1 Workplan

This document defines the isolated `v1.1` workspace.
`v1.0` is the archived test line. `v1.1` is the active line for cleanup and expansion.

## Baseline Lock

- Workspace: this cloned repo copy
- Archived baseline: `v1.0`
- Current head at setup time: `729b94a`
- Freeze rule: do not retcon the archived line; if we need a tag, create it only after the baseline is approved
- Artifact rule: generated JSON and logs are outputs, not source of truth

## Working Rules

- Treat `v1.1` as the separate operating line
- Prefer one writer per artifact root
- Prefer partial fallback over wholesale overwrite
- Keep version fields explicit:
  - `release = v1.1`
  - `cache_namespace = v1.1`
  - `prompt_version = v1.1`

## Inventory Snapshot

| Area | Primary files | Why it matters |
| --- | --- | --- |
| News pipeline | `marketflow/backend/news/context_news.py`, `marketflow/backend/news/context_narrative.py`, `marketflow/backend/scripts/build_context_news.py`, `marketflow/backend/startup.py`, `marketflow/backend/start.sh`, `marketflow/frontend/src/lib/newsHistoryPaths.ts`, `marketflow/frontend/src/app/context/page.tsx`, `marketflow/frontend/src/components/MarketContextCard.tsx` | Candidate roots are currently broader than we want; this is where we unify news intake, cache output, and fallback order. |
| Prompt loading | `marketflow/backend/utils/prompt_loader.py`, `marketflow/backend/services/prompt_manager.py`, `marketflow/backend/prompts/_registry.json`, `marketflow/backend/prompts/md/inventory.md`, `marketflow/backend/prompts/md/runtime-map.md`, `marketflow/backend/prompts/md/versioning.md` | Two loaders exist today. `v1.1` should make the rule set explicit and keep one source of truth per prompt family. |
| Narrative / LLM | `marketflow/backend/api/narrative.py`, `marketflow/backend/services/narrative_generator.py`, `marketflow/backend/scripts/build_account_ticker_briefs.py`, `marketflow/frontend/src/lib/briefScheduler.ts` | Provider order, structured output parsing, and narrative cache namespaces need one consistent path. |
| Fallbacks | `marketflow/backend/services/narrative_generator.py`, `marketflow/frontend/src/components/MarketContextCard.tsx` | Fallbacks should fill missing fields only. They should not replace a valid partial payload with a wholesale rebuild. |
| Validation | `marketflow/backend/app.py`, `marketflow/backend/startup.py`, `marketflow/frontend/package.json` | We need a repeatable backend syntax check, frontend build, and live narrative response check. |

## Cleanup Order

1. News cleanup
2. Prompt and LLM cleanup
3. Fallback cleanup
4. Version namespace lock
5. Validation
6. Release / promotion

## Detailed Tasks

### Baseline Lock

- Confirm the `v1.0` freeze point
- Record the baseline commit and tag
- Keep `main` untouched after the freeze

### News Cleanup

- Map every news-related writer and reader
- Make `context_news`, `context_narrative`, and `build_account_ticker_briefs` share one artifact root and one generation order
- Remove duplicate fallback paths in the frontend news cache lookup

### Prompt / LLM Cleanup

- Decide whether `PromptManager` or `prompt_loader` owns each prompt family
- Make Claude / GPT provider order explicit per route
- Keep structured output parsing deterministic

### Fallback Cleanup

- Remove any logic that throws away a valid partial result
- Fill only the missing fields
- Keep server and frontend sticky fallback behavior aligned

### Version Namespace

- Lock the namespace fields for `v1.1`
- Make cache keys, prompt versions, and generated artifacts line up with the same release label

### Validation

- Run backend syntax checks
- Run frontend build
- Verify at least one real portfolio narrative response end to end
- Compare local and server paths for the same input

### Release

- Push the `v1.1` branch
- Deploy only the approved commit
- Promote to production after the cleanup checks stay stable

## Definition of Done

- `v1.0` remains the archived baseline
- `v1.1` remains the active line
- `v1.1` has a single news path, a single prompt rule, and a single fallback policy
- Namespace fields are explicit and stable
- Backend and frontend both build cleanly
- Live narrative responses are reproducible
- Release notes can explain exactly what changed in `v1.1`

## Related Docs

- `marketflow/backend/prompts/md/inventory.md`
- `marketflow/backend/prompts/md/runtime-map.md`
- `marketflow/backend/prompts/md/versioning.md`
