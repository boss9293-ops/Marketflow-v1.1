import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// ── types ─────────────────────────────────────────────────────────────────────

type HealingStrategy = 'retry_now' | 'retry_upstream_first' | 'skip_and_degrade' | 'manual_attention';
type HealingState    = 'healthy' | 'degraded' | 'critical';

interface ReportItem {
  filename: string;
  ok:       boolean;
  elapsed_sec?: number;
}

interface PipelineReport {
  items?:   ReportItem[];
  success?: number;
  failed?:  number;
  total?:   number;
}

// ── constants ─────────────────────────────────────────────────────────────────

const RETRY_NOW_CAUSES    = new Set(['timeout', 'script_exception']);
const SKIP_DEGRADE_CAUSES = new Set(['missing_input', 'malformed_json']);
const TIMEOUT_SEC         = 180;
const FAST_FAIL_SEC       = 1.0;

// ── helpers ───────────────────────────────────────────────────────────────────

function reportPaths(): string[] {
  return [
    path.resolve(process.cwd(), '..', 'backend', 'output', 'pipeline_report.json'),
    path.resolve(process.cwd(), 'backend', 'output', 'pipeline_report.json'),
    path.resolve(process.cwd(), '..', 'output', 'pipeline_report.json'),
  ];
}

function statusPaths(): string[] {
  return [
    path.resolve(process.cwd(), '..', 'backend', 'output', 'pipeline_status.json'),
    path.resolve(process.cwd(), 'backend', 'output', 'pipeline_status.json'),
    path.resolve(process.cwd(), '..', 'output', 'pipeline_status.json'),
  ];
}

async function readJsonSafe(candidates: string[]): Promise<unknown> {
  for (const p of candidates) {
    try { return JSON.parse(await fs.readFile(p, 'utf-8')); } catch { /* next */ }
  }
  return null;
}

// Deterministic root-cause classification (mirrors Python backend logic)
function classifyCause(filename: string, elapsed: number, itemIdx: number, allItems: ReportItem[]): string {
  // dependency_failure: fast fail AND a preceding item also failed
  if (elapsed < FAST_FAIL_SEC) {
    const predecessorFailed = allItems.slice(0, itemIdx).some((it) => !it.ok);
    if (predecessorFailed) return 'dependency_failure';
  }
  if (elapsed >= TIMEOUT_SEC) return 'timeout';
  const lower = filename.toLowerCase();
  if (lower.includes('update_') || lower.includes('fetch_') || lower.includes('ingest_')) {
    return 'missing_input';
  }
  if (lower.includes('build_') && elapsed < FAST_FAIL_SEC) return 'malformed_json';
  return 'script_exception';
}

function findUpstream(script: string, allFailed: string[], scriptToIdx: Map<string, number>): string | null {
  const ownIdx = scriptToIdx.get(script) ?? -1;
  if (ownIdx <= 0) return null;
  const candidates = allFailed
    .filter((s) => s !== script && (scriptToIdx.get(s) ?? 9999) < ownIdx)
    .sort((a, b) => (scriptToIdx.get(a) ?? 0) - (scriptToIdx.get(b) ?? 0));
  return candidates.at(-1) ?? null;
}

function classifyStrategy(
  script:           string,
  rootCause:        string,
  allFailed:        string[],
  scriptToIdx:      Map<string, number>,
  allScriptsFailed: boolean,
): { strategy: HealingStrategy; upstream: string | null; reason: string } {
  if (allScriptsFailed) {
    return { strategy: 'manual_attention', upstream: null, reason: 'All scripts failed — pipeline critically unhealthy' };
  }
  if (rootCause === 'dependency_failure') {
    const up = findUpstream(script, allFailed, scriptToIdx);
    if (up) return { strategy: 'retry_upstream_first', upstream: up, reason: `Upstream '${up}' must recover first` };
    return { strategy: 'manual_attention', upstream: null, reason: 'Dependency failure — upstream not identifiable' };
  }
  if (SKIP_DEGRADE_CAUSES.has(rootCause)) {
    return { strategy: 'skip_and_degrade', upstream: null, reason: `Data format issue (${rootCause}) — low retry value` };
  }
  if (RETRY_NOW_CAUSES.has(rootCause)) {
    return { strategy: 'retry_now', upstream: null, reason: 'Transient failure — safe to retry' };
  }
  return { strategy: 'manual_attention', upstream: null, reason: 'No automatic healing strategy available' };
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  const emptyPlan = (error: string) => NextResponse.json({
    ok: false, healing_state: 'critical' as HealingState,
    strategies: [], retry_now_scripts: [], degraded: [], manual_attention: [], error,
  });

  try {
    const rawReport = await readJsonSafe(reportPaths());
    if (!rawReport || typeof rawReport !== 'object' || Array.isArray(rawReport)) {
      return emptyPlan('pipeline_report.json not available');
    }

    const report = rawReport as PipelineReport;
    const items  = Array.isArray(report.items) ? report.items : [];
    const failed = items.filter((it) => !it.ok);

    if (failed.length === 0) {
      return NextResponse.json({
        ok: true, healing_state: 'healthy' as HealingState,
        strategies: [], retry_now_scripts: [], degraded: [], manual_attention: [],
      });
    }

    const scriptToIdx = new Map<string, number>(items.map((it, i) => [it.filename, i]));
    const allFailed   = failed.map((it) => it.filename);

    const rawStatus = await readJsonSafe(statusPaths()) as Record<string, unknown> | null;
    const scriptsOk = typeof rawStatus?.scripts_ok === 'number'
      ? rawStatus.scripts_ok
      : (report.success ?? items.length - failed.length);
    const allScriptsFailed = scriptsOk === 0 && failed.length > 0;

    // Build cause map
    const causeMap = new Map<string, string>();
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.ok) {
        causeMap.set(it.filename, classifyCause(it.filename, it.elapsed_sec ?? 0, i, items));
      }
    }

    type StrategyEntry = { script: string; root_cause: string; strategy: HealingStrategy; upstream: string | null; reason: string };
    const strategies: StrategyEntry[] = [];
    const retryNow:   string[] = [];
    const degraded:   string[] = [];
    const manualAttn: string[] = [];

    for (const item of failed) {
      const script    = item.filename;
      const rootCause = causeMap.get(script) ?? 'unknown';
      const { strategy, upstream, reason } = classifyStrategy(script, rootCause, allFailed, scriptToIdx, allScriptsFailed);
      strategies.push({ script, root_cause: rootCause, strategy, upstream, reason });
      if (strategy === 'retry_now')           retryNow.push(script);
      else if (strategy === 'skip_and_degrade') degraded.push(script);
      else if (strategy === 'manual_attention') manualAttn.push(script);
    }

    // Promote upstreams of retry_upstream_first
    for (const entry of strategies) {
      if (entry.strategy !== 'retry_upstream_first' || !entry.upstream) continue;
      const up = entry.upstream;
      if (retryNow.includes(up)) continue;
      const upEntry = strategies.find((s) => s.script === up);
      if (upEntry?.strategy === 'manual_attention') continue;
      retryNow.push(up);
      if (upEntry) {
        upEntry.strategy = 'retry_now';
        upEntry.reason   = `Promoted: downstream '${entry.script}' requires this first`;
      }
    }

    const healingState: HealingState = allScriptsFailed || manualAttn.length > 0
      ? 'critical'
      : 'degraded';

    return NextResponse.json({
      ok: true, healing_state: healingState,
      strategies, retry_now_scripts: retryNow, degraded, manual_attention: manualAttn,
    });

  } catch (err) {
    return emptyPlan(String(err));
  }
}
