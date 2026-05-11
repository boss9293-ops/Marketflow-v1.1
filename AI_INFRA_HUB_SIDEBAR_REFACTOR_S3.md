# AI Infra Hub Sidebar Refactor S-3

Branch: `v1.1` | Date: 2026-05-11

---

## Purpose

Refactor the sidebar navigation under the semiconductor/infrastructure section.

Remove legacy duplicate entries (`반도체 사이클`, `SOXX / SOXL`), rename the parent zone to `AI 인프라 허브`, and split the single toggle page into two dedicated sidebar routes.

---

## Previous Sidebar Structure

```
SC 반도체 사이클
 ├─ 반도체 사이클    (/semiconductor)
 ├─ SOXX / SOXL      (/soxx-soxl)
 └─ 반도체렌즈       (/semiconductor-lens)
```

`/semiconductor-lens` page rendered `SemiconductorIntelligenceShell`, which contained a top toggle to switch between:
- SOXX/SOXL Lens → `TerminalXDashboard`
- AI Infrastructure Radar → `AIInfrastructureRadar`

---

## New Sidebar Structure

```
AI 인프라 허브
 ├─ 반도체렌즈       (/semiconductor-lens)
 └─ 인프라섹터렌즈   (/semiconductor-lens/infrastructure)
```

Zone header: `AI` icon in teal (`#3FB6A8`), label `AI 인프라 허브`.

---

## Route Mapping

| Label | Route | Renders |
|---|---|---|
| 반도체렌즈 | `/semiconductor-lens` | `TerminalXDashboard` (SOXX/SOXL Lens) |
| 인프라섹터렌즈 | `/semiconductor-lens/infrastructure` | `AIInfrastructureRadar` (AI 인프라 레이더) |

Legacy routes (accessible but not in sidebar):

| Route | Status |
|---|---|
| `/semiconductor` | Accessible (SemiconductorRiskPanel), removed from sidebar |
| `/soxx-soxl` | Accessible (SoxxSoxlDashboard), removed from sidebar |

---

## Component Mapping

| New Route | Component |
|---|---|
| `/semiconductor-lens` | `TerminalXDashboard` (direct import, no Shell) |
| `/semiconductor-lens/infrastructure` | `AIInfrastructureRadar` (direct import) |

`SemiconductorIntelligenceShell` — no longer used by either page. Preserved as-is (not deleted).

---

## Top Toggle Removal

`SemiconductorIntelligenceShell` previously rendered a top toggle (SOXX/SOXL Lens | AI Infrastructure Radar). Both pages now bypass this shell and render their components directly.

The toggle is effectively removed from the user's view without modifying `SemiconductorIntelligenceShell.tsx`.

---

## Legacy Route Handling

| Route | Action |
|---|---|
| `/semiconductor` | Removed from sidebar only. Page still accessible via direct URL. |
| `/soxx-soxl` | Removed from sidebar only. Page still accessible via direct URL. |

No hard deletion. No redirect applied (safe baseline). Redirects can be added in S-3B if confirmed safe.

---

## Files Modified

| File | Change |
|---|---|
| `src/components/Sidebar.tsx` | Zone header renamed, scItems replaced, badge color updated |
| `src/app/semiconductor-lens/page.tsx` | Replaced Shell with direct `TerminalXDashboard` render |

## Files Created

| File | Purpose |
|---|---|
| `src/app/semiconductor-lens/infrastructure/page.tsx` | 인프라섹터렌즈 — renders `AIInfrastructureRadar` |
| `AI_INFRA_HUB_SIDEBAR_REFACTOR_S3.md` | This document |

---

## Validation Results

| Check | Status |
|---|---|
| Sidebar parent label = AI 인프라 허브 | PASS |
| Sidebar child 반도체렌즈 exists | PASS |
| Sidebar child 인프라섹터렌즈 exists | PASS |
| 반도체 사이클 removed from sidebar | PASS |
| SOXX / SOXL removed from sidebar | PASS |
| 반도체렌즈 renders TerminalXDashboard | PASS |
| 인프라섹터렌즈 renders AIInfrastructureRadar | PASS |
| Top toggle removed | PASS (pages bypass Shell) |
| Legacy routes accessible | PASS (not in sidebar, page intact) |
| AIInfrastructureRadar renders | PASS |
| Value Chain tab works | PASS |
| Heatmap tab works | PASS |
| State Labels / RS / RRG tabs work | PASS |
| TypeScript build | 0 errors |

---

## Remaining Work

1. Optional redirects for legacy routes (`/semiconductor` → `/semiconductor-lens`, `/soxx-soxl` → `/semiconductor-lens`) — deferred to S-3B
2. `SemiconductorIntelligenceShell.tsx` — can be archived or deleted in a future cleanup phase once legacy routes are confirmed unused
3. No mobile sidebar QA performed — deferred to S-3B QA pass
