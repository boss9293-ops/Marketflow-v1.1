# Phase J Step 4 — Data Status Consistency QA
**Date:** 2026-04-29 | **Status:** PASS

---

## 1. Status Labels Used

| Label | When |
|-------|------|
| LIVE | `data_mode === 'live'` from AI Regime Lens |
| SNAPSHOT | `data_mode === 'snapshot'` from AI Regime Lens (cache file loaded) |
| FALLBACK | fallback file loaded (not cache) |
| UNAVAILABLE | `interpData === null` (fetch failed or 503) |

Note: The `data_mode` field on `ai_regime` is set by `computeAIRegimeLens()` which currently always returns `'snapshot'` for file-based data. `LIVE` would be set when direct market API data is used in a future update.

---

## 2. Status by Tab

| Tab | Data Status Display | Location |
|-----|---------------------|---------|
| ENGINE | LIVE / SNAPSHOT / UNAVAILABLE + source | Footer (all tabs share footer) |
| SOXX/SOXL Translation | AI Regime component shown; no dedicated status | SoxxSoxlTranslationTab shows `data_source` block |
| Playback | `dataStatus.source` + note in response | SemiconductorPlaybackTab renders `dataStatus.note` |
| AI Regime Panel | `data_mode` badge shown in regime label display | Left panel MAP view |

---

## 3. Missing Data Disclosure

| Scenario | Disclosure |
|----------|-----------|
| `spreadData` empty | "Data pending" in chart |
| `rebasedData` empty | "Loading…" in chart |
| AI Regime not loaded | Stage badges = 'Unavailable' |
| Playback using fallback | `dataStatus.note` = "Historical period data is based on a static fallback dataset." |
| Playback using real VR data | `dataStatus.note` = "legacy stress reference" note |

---

## 4. Fallback Disclosure

| Route | Fallback Note |
|-------|--------------|
| `/api/interpretation` | `dataStatus.source = 'fallback'` + note in response |
| `/api/translation` | Same |
| `/api/playback` | `dataStatus.source = 'fallback'` when replay file missing |

---

## 5. Final QA

```
[✅] Footer shows LIVE/SNAPSHOT/UNAVAILABLE on all tabs
[✅] Footer source name visible (SNAPSHOT mode)
[✅] Chart empty states visible when data absent
[✅] Capital Flow Stage shows 'Unavailable' when ai_regime missing
[✅] Playback discloses fallback vs real data in dataStatus.note
[✅] AI Regime panel shows data_mode badge
[✅] No hidden missing data — all gaps disclosed
```

**PASS**
