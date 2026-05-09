# Phase I Step 4 — Public Explanation Page Draft
**Date:** 2026-04-29 | **Status:** DRAFT

---

## Page Title

**AI Regime Lens for Semiconductor Capital Flow**

Korean: AI 레짐 기반 반도체 자본 흐름 분석

---

## 1. What This Engine Does

This engine tracks AI-era semiconductor capital flow using SOXX as the anchor.

It shows which semiconductor groups support or weaken SOXX, and how capital spreads from AI Compute into Memory, Foundry, Equipment, and broader participation.

Korean:
이 엔진은 SOXX를 기준으로 AI 시대 반도체 자본 흐름을 추적합니다.
어느 그룹이 SOXX를 지지하거나 약화시키는지, 자본이 AI 컴퓨팅에서 메모리, 파운드리, 장비, 광범위한 참여로 어떻게 확산되는지를 보여줍니다.

---

## 2. Why SOXX Is the Anchor

SOXX (iShares Semiconductor ETF) represents the broad semiconductor market.

It serves as the benchmark for comparing each bucket's relative strength or weakness.

When a bucket's line is above zero in the Relative Spread chart, it means that bucket is outperforming the broad semiconductor market. When below zero, it is underperforming.

---

## 3. What the Buckets Mean

| Bucket | What it represents |
|--------|-------------------|
| **AI Compute** | NVDA, AMD, AVGO — AI GPU and networking silicon |
| **Memory** | MU — DRAM and HBM capacity supporting AI workloads |
| **Foundry** | TSM — Manufacturing capacity for advanced semiconductor nodes |
| **Equipment** | ASML, AMAT, LRCX, KLAC — Tools and equipment enabling fab production |

AI Compute is the leading bucket in an AI-driven cycle. Capital typically flows from AI Compute into Memory, then Foundry, then Equipment as the cycle matures.

---

## 4. How to Read the Charts

### Relative Spread vs SOXX
Lines above zero: the bucket is outperforming SOXX.
Lines below zero: the bucket is lagging behind SOXX.
The zero line is SOXX itself.

### Rebased Bucket Flow
All series start at zero.
The chart shows where each bucket moved from the same starting point.
Separation between AI Compute and others = narrow leadership.
All moving together = broad participation.

### Capital Flow Stage
Shows how far AI-related capital has confirmed across the semiconductor value chain.

Stages:
- **Confirmed**: bucket is clearly outperforming SOXX (+3–5pp or more)
- **Partial**: moderate outperformance
- **Mixed**: near the SOXX baseline
- **Lagging / Weak**: underperforming SOXX

Healthy cycle: stages confirm sequentially from left to right.

---

## 5. What SOXL Sensitivity Means

SOXL is a 3× leveraged ETF tracking the PHLX Semiconductor Index.

SOXL Sensitivity shows how the current SOXX structure may become more amplified in a leveraged instrument.

| Sensitivity | Meaning |
|-------------|---------|
| High | Narrow leadership or contraction — leverage amplifies risk |
| Medium | Rotation or partial recovery — uneven structure |
| Low–Medium | Broad AI leadership — leverage amplifies broad participation |

This is a structural reference, not a recommendation on SOXL position sizing.

---

## 6. What This Is Not

This is not a trading signal.

This is not a forecast.

This is not a recommendation to buy or hold any security.

This is a structural reference tool for understanding AI-era semiconductor capital flow.

---

## 7. Implementation Note

This draft is suitable for:
- A help/about page: `app/semiconductor/about/page.tsx`
- A tooltip modal triggered from the dashboard
- A printed one-pager for demo use

No implementation required in Phase I. Documentation draft is the deliverable.
