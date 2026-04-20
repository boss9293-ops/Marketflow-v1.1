# Project Context

## v1.1 Operating Setup

- Workspace: `d:\MyWork_ai\ProjectAgent\Marketflow\v1.1-20260419`
- Archived baseline: `v1.0`
- Current head at setup time: `729b94a`
- Operating rule: `v1.0` is the frozen archive, and this copy is the isolated `v1.1` line

## Working Doc

- [v1.1 Workplan](docs/v1_1_workplan.md)

## Current Priority Order

1. News cleanup
2. Prompt and LLM cleanup
3. Fallback cleanup
4. Version namespace lock
5. Validation
6. Release / promotion

## Notes

- Generated JSON, logs, and cache artifacts are outputs only
- Prompt inventory and runtime mapping are already tracked under `backend/prompts/md/`
- `v1.1` work should extend the current code path, not rewrite the archived line
