# Phase J Step 1 — Data Source Path Audit
**Date:** 2026-04-29 | **Status:** PASS

---

## 1. Data Files Checked

| File | Resolved Path | Exists Locally |
|------|--------------|----------------|
| `semiconductor_market_data.json` | `marketflow/backend/output/cache/semiconductor_market_data.json` | ✅ |
| `semiconductor_mvp_latest.json` | `marketflow/backend/output/semiconductor_mvp_latest.json` | ❌ (fallback not present) |
| `2022_tightening.json` | `marketflow/backend/output/replay/2022_tightening.json` | ✅ |

---

## 2. Routes Using Each File

| File | Route |
|------|-------|
| `semiconductor_market_data.json` | `/api/interpretation`, `/api/translation` |
| `semiconductor_mvp_latest.json` | `/api/interpretation` (fallback), `/api/translation` (fallback) |
| `2022_tightening.json` | `/api/playback` |

---

## 3. Path Strategy

`process.cwd()` when Next.js runs from `marketflow/frontend/` resolves to that directory.

Multi-candidate path array (after hardening):

```ts
const DATA_CANDIDATES = [
  path.join(process.cwd(), '..', 'backend', 'output', 'cache', 'semiconductor_market_data.json'),
  path.join(process.cwd(), 'backend', 'output', 'cache', 'semiconductor_market_data.json'),
  path.join(process.cwd(), '..', 'backend', 'output', 'semiconductor_mvp_latest.json'),
  path.join(process.cwd(), 'backend', 'output', 'semiconductor_mvp_latest.json'),
]
```

First existing path wins. If none exists: returns 503.

---

## 4. Deployment Concern

In Vercel or other serverless deployments:
- Local file paths will not resolve
- API routes will return 503 with structured error
- Frontend handles 503 gracefully (shows "Awaiting data…")

**Action required for deployment:** Pre-bundle a static snapshot as public JSON or use an external data API. Not in Phase J scope.

---

## 5. Fallback Behavior

| Scenario | Behavior |
|----------|---------|
| Cache file found | Load and process normally |
| Cache missing, fallback found | Load fallback; dataStatus = 'fallback' |
| Both missing | Return 503 with `DATA_UNAVAILABLE` JSON |
| Engine processing fails | Return 500 with `ENGINE_ERROR` JSON |
| Replay file missing | `loadReplayTimeline` returns null; static fallback timeline used |

```
[✅] Multi-candidate paths implemented in interpretation, translation, playback routes
[✅] All files confirmed present at primary paths locally
[✅] Fallback file absence documented
[✅] Deployment risk documented
```
