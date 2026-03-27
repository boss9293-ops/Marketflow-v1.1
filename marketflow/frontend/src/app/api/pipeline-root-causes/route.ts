import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// ── types ────────────────────────────────────────────────────────────────────

type RootCause =
  | 'timeout'
  | 'missing_input'
  | 'malformed_json'
  | 'dependency_failure'
  | 'script_exception'
  | 'unknown';

interface ReportItem {
  filename: string;
  ok: boolean;
  elapsed_sec: number;
  description?: string;
}

interface HistoryRun {
  timestamp: string;
  status: string;
  scripts_ok?: number;
  scripts_failed?: number;
  failed_scripts?: string[];
}

// ── constants ────────────────────────────────────────────────────────────────

const TIMEOUT_SEC    = 180;
const FAST_FAIL_SEC  = 1.0;
const JSON_BUILD_SEC = 15.0;
const RECURRING_MIN  = 2;
const BREAKDOWN_CAP  = 10;

// ── helpers ──────────────────────────────────────────────────────────────────

async function readJsonSafe(candidates: string[]): Promise<unknown> {
  for (const p of candidates) {
    try { return JSON.parse(await fs.readFile(p, 'utf-8')); } catch { /* next */ }
  }
  return null;
}

function outputPaths(filename: string): string[] {
  return [
    path.resolve(process.cwd(), '..', 'backend', 'output', filename),
    path.resolve(process.cwd(), 'backend', 'output', filename),
    path.resolve(process.cwd(), '..', 'output', filename),
    path.resolve(process.cwd(), 'output', filename),
  ];
}

function classifyCause(
  filename: string,
  elapsed: number,
  itemIdx: number,
  allItems: ReportItem[],
): RootCause {
  // 1. dependency_failure: any earlier item in this run also failed
  if (itemIdx > 0 && allItems.slice(0, itemIdx).some((x) => !x.ok)) {
    return 'dependency_failure';
  }
  // 2. timeout
  if (elapsed > TIMEOUT_SEC) return 'timeout';
  // 3. missing_input
  if (elapsed < FAST_FAIL_SEC) return 'missing_input';
  // 4. malformed_json
  if (filename.startsWith('build_') && elapsed < JSON_BUILD_SEC) return 'malformed_json';
  // 5. script_exception (default)
  return 'script_exception';
}

interface FailureItem { script: string; cause: RootCause; elapsed: number; }

function causesFromReport(items: ReportItem[]): FailureItem[] {
  const results: FailureItem[] = [];
  items.forEach((item, idx) => {
    if (item.ok) return;
    results.push({
      script:  item.filename ?? '',
      cause:   classifyCause(item.filename ?? '', item.elapsed_sec ?? 0, idx, items),
      elapsed: item.elapsed_sec ?? 0,
    });
  });
  return results;
}

function causesFromHistoryRun(run: HistoryRun): FailureItem[] {
  return (run.failed_scripts ?? [])
    .filter(Boolean)
    .map((s) => ({ script: s, cause: 'unknown' as RootCause, elapsed: 0 }));
}

function dominantCause(counts: Record<string, number>): RootCause {
  const entries = Object.entries(counts);
  if (!entries.length) return 'unknown';
  return entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0] as RootCause;
}

// ── GET handler ──────────────────────────────────────────────────────────────

export async function GET() {
  const empty = {
    ok: true,
    total_failures_analyzed: 0,
    latest_root_cause: null as RootCause | null,
    top_root_causes: [] as { cause: RootCause; count: number }[],
    script_cause_breakdown: [] as { script: string; cause: RootCause; count: number }[],
    recurring_cause: null as RootCause | null,
    retry_events_supplemental: 0,
  };

  // 1. Primary: pipeline_report.json
  const reportRaw = await readJsonSafe(outputPaths('pipeline_report.json'));
  let latestCauses: FailureItem[] = [];
  if (reportRaw && typeof reportRaw === 'object' && !Array.isArray(reportRaw)) {
    const items = (reportRaw as Record<string, unknown>).items;
    if (Array.isArray(items)) {
      latestCauses = causesFromReport(items as ReportItem[]);
    }
  }

  // 2. History: pipeline_history.json
  const histRaw = await readJsonSafe(outputPaths('pipeline_history.json'));
  const historicalBatches: FailureItem[][] = [];
  if (Array.isArray(histRaw)) {
    const sorted = [...(histRaw as HistoryRun[])].sort(
      (a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? ''),
    );
    for (const run of sorted) {
      if (run.status === 'failure' || Number(run.scripts_failed ?? 0) > 0) {
        const batch = causesFromHistoryRun(run);
        if (batch.length) historicalBatches.push(batch);
      }
    }
  }

  // Fallback to most recent history batch if report shows all-success
  if (!latestCauses.length && historicalBatches.length) {
    latestCauses = historicalBatches[0];
  }

  if (!latestCauses.length) return NextResponse.json(empty);

  // 3. latest_root_cause
  const lcCounts: Record<string, number> = {};
  for (const { cause } of latestCauses) {
    lcCounts[cause] = (lcCounts[cause] ?? 0) + 1;
  }
  const latestRootCause = dominantCause(lcCounts);

  // 4. top_root_causes (all failures combined)
  const allFailures: FailureItem[] = [...latestCauses];
  for (const batch of historicalBatches) allFailures.push(...batch);

  const allCounts: Record<string, number> = {};
  for (const { cause } of allFailures) {
    allCounts[cause] = (allCounts[cause] ?? 0) + 1;
  }
  const topRootCauses = Object.entries(allCounts)
    .map(([cause, count]) => ({ cause: cause as RootCause, count }))
    .sort((a, b) => b.count - a.count);

  // 5. script_cause_breakdown
  const scriptMap: Record<string, Record<string, number>> = {};
  for (const { script, cause } of allFailures) {
    if (!scriptMap[script]) scriptMap[script] = {};
    scriptMap[script][cause] = (scriptMap[script][cause] ?? 0) + 1;
  }
  const breakdown = Object.entries(scriptMap)
    .map(([script, counts]) => ({
      script,
      cause: dominantCause(counts),
      count: Object.values(counts).reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, BREAKDOWN_CAP);

  // 6. recurring_cause
  let recurringCause: RootCause | null = null;
  if (historicalBatches.length >= RECURRING_MIN) {
    const streak: Record<string, number> = {};
    for (const batch of historicalBatches.slice(0, RECURRING_MIN)) {
      const batchCauses = new Set(batch.map((x) => x.cause));
      for (const c of batchCauses) streak[c] = (streak[c] ?? 0) + 1;
    }
    const candidates = Object.entries(streak).filter(([, n]) => n >= RECURRING_MIN);
    if (candidates.length) {
      recurringCause = candidates.reduce((a, b) => (b[1] > a[1] ? b : a))[0] as RootCause;
    }
  }

  // 7. Supplemental: retry history count
  const retryRaw = await readJsonSafe(outputPaths('cache/pipeline_retry_history.json'));
  const retryCount = Array.isArray(retryRaw) ? retryRaw.length : 0;

  return NextResponse.json({
    ok: true,
    total_failures_analyzed: allFailures.length,
    latest_root_cause: latestRootCause,
    top_root_causes: topRootCauses,
    script_cause_breakdown: breakdown,
    recurring_cause: recurringCause,
    retry_events_supplemental: retryCount,
  });
}
