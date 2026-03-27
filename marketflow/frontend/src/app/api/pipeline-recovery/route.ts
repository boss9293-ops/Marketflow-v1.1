import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// ── config ────────────────────────────────────────────────────────────────────
const MIN_RUNS            = 3;
const REPEAT_FAIL_WINDOW  = 10;
const CRITICAL_FAIL_COUNT = 5;
const STRUCTURAL_MIN      = 3;

// ── types ─────────────────────────────────────────────────────────────────────
type Run = {
  timestamp?: string;
  last_run_at?: string;
  status?: string;
  duration_sec?: number;
  scripts_ok?: number;
  scripts_failed?: number;
  failed_scripts?: string[];
};

type NRun = {
  timestamp: string;
  status: string;
  duration_sec: number;
  scripts_ok: number;
  scripts_failed: number;
  failed_scripts: string[];
};

type ScriptDetail = {
  script: string;
  fail_count: number;
  consecutive: boolean;
  category: 'transient' | 'structural' | 'critical' | 'critical_historical';
};

// ── helpers ───────────────────────────────────────────────────────────────────
function normalize(r: Run): NRun {
  return {
    timestamp:      String(r.timestamp ?? r.last_run_at ?? ''),
    status:         String(r.status ?? 'unknown'),
    duration_sec:   Number(r.duration_sec ?? 0),
    scripts_ok:     Number(r.scripts_ok ?? 0),
    scripts_failed: Number(r.scripts_failed ?? 0),
    failed_scripts: Array.isArray(r.failed_scripts) ? r.failed_scripts : [],
  };
}

function isFail(r: NRun): boolean {
  return r.status !== 'success' || r.scripts_failed > 0;
}

async function readJsonSafe(candidates: string[]): Promise<unknown> {
  for (const p of candidates) {
    try { return JSON.parse(await fs.readFile(p, 'utf-8')); } catch { /* next */ }
  }
  return null;
}

function histPaths(file: string): string[] {
  return [
    path.resolve(process.cwd(), '..', 'backend', 'output', file),
    path.resolve(process.cwd(), 'backend', 'output', file),
    path.resolve(process.cwd(), '..', 'output', file),
    path.resolve(process.cwd(), 'output', file),
  ];
}

function countScriptFailures(runs: NRun[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of runs) {
    for (const s of r.failed_scripts) {
      if (s) counts[s] = (counts[s] ?? 0) + 1;
    }
  }
  return counts;
}

function findConsecutiveFailures(runs: NRun[]): Set<string> {
  const consecutive = new Set<string>();
  for (let i = 0; i < runs.length - 1; i++) {
    const curr = new Set(runs[i].failed_scripts.filter(Boolean));
    const next = new Set(runs[i + 1].failed_scripts.filter(Boolean));
    for (const s of curr) {
      if (next.has(s)) consecutive.add(s);
    }
  }
  return consecutive;
}

function buildSuggestedActions(
  state: string,
  retryCandidates: string[],
  manualAttention: string[],
  scriptsOkZero: boolean,
  intelCritical: boolean,
  failureStreak: number,
): string[] {
  if (state === 'stable') return ['Pipeline is stable. No action required.'];

  if (state === 'watch') return [
    'Single failure detected. Monitor next run before taking action.',
    'Check logs for the failed run to identify the root cause.',
  ];

  if (state === 'retryable') {
    const names = retryCandidates.slice(0, 3).join(', ');
    return [
      `Transient failure detected in: ${names}.`,
      'Re-run the pipeline — these scripts are eligible for automatic retry.',
      'If failure persists on next run, escalate to manual investigation.',
    ];
  }

  if (state === 'degraded') {
    const actions: string[] = [];
    if (retryCandidates.length > 0) {
      actions.push(`Retry candidates: ${retryCandidates.slice(0, 3).join(', ')} — re-run may resolve these.`);
    }
    if (manualAttention.length > 0) {
      actions.push(`Scripts needing investigation: ${manualAttention.slice(0, 3).join(', ')}.`);
    }
    actions.push('Review logs for repeated failures and check data dependencies.');
    return actions;
  }

  if (state === 'manual_attention') {
    const actions: string[] = [];
    if (scriptsOkZero) {
      actions.push('CRITICAL: Latest run had 0 scripts succeed. Check pipeline configuration and environment.');
    }
    if (intelCritical) {
      actions.push('CRITICAL: Pipeline intelligence reports critical state — systemic failure likely.');
    }
    if (failureStreak >= 3) {
      actions.push(`CRITICAL: Pipeline has failed ${failureStreak} consecutive run(s). Immediate investigation required.`);
    }
    if (manualAttention.length > 0) {
      actions.push(`Scripts requiring investigation: ${manualAttention.slice(0, 5).join(', ')}.`);
    }
    actions.push('Do not rely on pipeline output until failures are resolved.');
    actions.push('Check script logs, data sources, and environment configuration.');
    return actions;
  }

  return ['Wait for more pipeline runs before recovery analysis.'];
}

// ── entry point ───────────────────────────────────────────────────────────────
export async function GET() {
  const raw = await readJsonSafe(histPaths('pipeline_history.json'));

  const unknownResult = {
    recovery_state:    'unknown',
    retry_candidates:  [] as string[],
    manual_attention:  [] as string[],
    suggested_actions: ['Wait for more pipeline runs before recovery analysis.'],
    script_detail:     [] as ScriptDetail[],
  };

  if (!Array.isArray(raw) || raw.length < MIN_RUNS) {
    return NextResponse.json({
      ...unknownResult,
      reason: !Array.isArray(raw)
        ? 'pipeline_history.json missing'
        : `Only ${(raw as unknown[]).length} run(s) available (need ${MIN_RUNS})`,
    });
  }

  const runs = (raw as Run[])
    .map(normalize)
    .sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));

  const recent10  = runs.slice(0, REPEAT_FAIL_WINDOW);
  const recent5   = runs.slice(0, 5);
  const latest    = runs[0];

  // failure streak
  let failureStreak = 0;
  for (const r of runs) {
    if (isFail(r)) failureStreak++;
    else break;
  }

  const latestFailed    = new Set(latest.failed_scripts.filter(Boolean));
  const failCounts      = countScriptFailures(recent10);
  const consecutiveFails = findConsecutiveFailures(recent5);

  // ── classify each script that failed in latest run
  const retryCandidates: string[] = [];
  const manualAttention: string[] = [];
  const scriptDetail: ScriptDetail[] = [];

  for (const script of Array.from(latestFailed).sort()) {
    const count    = failCounts[script] ?? 1;
    const isConsec = consecutiveFails.has(script);
    const isHighRep = count >= STRUCTURAL_MIN;

    let category: ScriptDetail['category'];
    if (count >= CRITICAL_FAIL_COUNT) {
      category = 'critical';
    } else if (isConsec || isHighRep) {
      category = 'structural';
    } else {
      category = 'transient';
    }

    scriptDetail.push({ script, fail_count: count, consecutive: isConsec, category });

    if (category === 'transient') {
      retryCandidates.push(script);
    } else {
      manualAttention.push(script);
    }
  }

  // Flag critical historical scripts not in latest run
  for (const [script, count] of Object.entries(failCounts)) {
    if (!latestFailed.has(script) && count >= CRITICAL_FAIL_COUNT) {
      manualAttention.push(script);
      scriptDetail.push({
        script,
        fail_count: count,
        consecutive: consecutiveFails.has(script),
        category: 'critical_historical',
      });
    }
  }

  // ── force manual triggers
  const scriptsOkZero  = latest.scripts_ok === 0;
  const anyCritical    = scriptDetail.some(s => s.category === 'critical' || s.category === 'critical_historical');
  // Note: intel_critical would require calling the intelligence route — skipping for SSR simplicity
  const intelCritical  = false;

  const forceManual = scriptsOkZero || anyCritical || failureStreak >= 3;

  if (forceManual) {
    for (const s of retryCandidates) {
      if (!manualAttention.includes(s)) manualAttention.push(s);
    }
    retryCandidates.length = 0;
  }

  // ── recovery state
  let recoveryState: string;
  if (!isFail(latest) && failureStreak === 0) {
    recoveryState = 'stable';
  } else if (forceManual) {
    recoveryState = 'manual_attention';
  } else if (retryCandidates.length > 0 && manualAttention.length === 0) {
    recoveryState = 'retryable';
  } else if (manualAttention.length > 0 || retryCandidates.length > 0) {
    recoveryState = 'degraded';
  } else {
    recoveryState = 'watch';
  }

  const suggestedActions = buildSuggestedActions(
    recoveryState, retryCandidates, manualAttention,
    scriptsOkZero, intelCritical, failureStreak,
  );

  return NextResponse.json({
    recovery_state:    recoveryState,
    retry_candidates:  retryCandidates,
    manual_attention:  manualAttention,
    suggested_actions: suggestedActions,
    script_detail:     scriptDetail,
  });
}
