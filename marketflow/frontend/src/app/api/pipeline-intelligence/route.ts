import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// ── config ───────────────────────────────────────────────────────────────────
const MIN_RUNS = 5;
const DURATION_SPIKE_RATIO = 1.5;
const FAILURE_SPIKE_WINDOW = 3;
const FAILURE_SPIKE_MIN = 2;
const REPEAT_FAIL_WINDOW = 10;
const REPEAT_FAIL_MIN = 3;

// ── types ────────────────────────────────────────────────────────────────────
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

// ── helpers ──────────────────────────────────────────────────────────────────
function normalize(r: Run): NRun {
  return {
    timestamp:     String(r.timestamp ?? r.last_run_at ?? ''),
    status:        String(r.status ?? 'unknown'),
    duration_sec:  Number(r.duration_sec ?? 0),
    scripts_ok:    Number(r.scripts_ok ?? 0),
    scripts_failed:Number(r.scripts_failed ?? 0),
    failed_scripts:Array.isArray(r.failed_scripts) ? r.failed_scripts : [],
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

// ── analysis ─────────────────────────────────────────────────────────────────
function durationTrend(runs: NRun[]): string {
  if (runs.length < 4) return 'stable';
  const avgNew = (runs[0].duration_sec + runs[1].duration_sec) / 2;
  const older = runs.slice(2);
  const avgOld = older.reduce((s, r) => s + r.duration_sec, 0) / older.length;
  if (avgOld === 0) return 'stable';
  const ratio = avgNew / avgOld;
  if (ratio > 1.15) return 'up';
  if (ratio < 0.85) return 'down';
  return 'stable';
}

function failureTrend(runs: NRun[]): string {
  if (runs.length < 4) return 'stable';
  const newRate = (isFail(runs[0]) ? 1 : 0) + (isFail(runs[1]) ? 1 : 0);
  const older = runs.slice(2);
  const oldRate = older.filter(isFail).length / older.length;
  const nr = newRate / 2;
  if (nr > oldRate + 0.2) return 'worsening';
  if (nr < oldRate - 0.2) return 'improving';
  return 'stable';
}

function streaks(runs: NRun[]): { success_streak: number; failure_streak: number } {
  let ss = 0, fs = 0;
  for (const r of runs) { if (!isFail(r)) ss++; else break; }
  for (const r of runs) { if (isFail(r)) fs++; else break; }
  return { success_streak: ss, failure_streak: fs };
}

// ── entry point ───────────────────────────────────────────────────────────────
export async function GET() {
  const raw = await readJsonSafe(histPaths('pipeline_history.json'));

  const unknownResult = {
    state: 'unknown',
    trends: { duration_trend: 'unknown', failure_trend: 'unknown', success_streak: 0, failure_streak: 0 },
    anomalies: [] as object[],
    warnings: [] as object[],
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

  const recent5  = runs.slice(0, 5);
  const recent10 = runs.slice(0, REPEAT_FAIL_WINDOW);
  const { success_streak, failure_streak } = streaks(runs);
  const dur_trend  = durationTrend(recent5);
  const fail_trend = failureTrend(recent5);

  // anomalies
  const anomalies: object[] = [];

  // duration spike
  const latestDur = runs[0].duration_sec;
  const avgDur = recent5.reduce((s, r) => s + r.duration_sec, 0) / recent5.length;
  let durSpike: { type: string; detail: string } | null = null;
  if (avgDur > 0 && latestDur > avgDur * DURATION_SPIKE_RATIO) {
    durSpike = {
      type: 'duration_spike',
      detail: `Latest run ${Math.round(latestDur)}s is ${(latestDur / avgDur).toFixed(1)}× the 5-run avg (${Math.round(avgDur)}s)`,
    };
    anomalies.push(durSpike);
  }

  // failure spike
  const spikeWindow = runs.slice(0, FAILURE_SPIKE_WINDOW);
  const spikeCount = spikeWindow.filter(isFail).length;
  let failSpike: { type: string; detail: string } | null = null;
  if (spikeWindow.length === FAILURE_SPIKE_WINDOW && spikeCount >= FAILURE_SPIKE_MIN) {
    failSpike = {
      type: 'failure_spike',
      detail: `${spikeCount}/${FAILURE_SPIKE_WINDOW} of the most recent runs failed`,
    };
    anomalies.push(failSpike);
  }

  // repeated script failures
  const scriptCounts: Record<string, number> = {};
  for (const r of recent10) {
    for (const s of r.failed_scripts) {
      if (s) scriptCounts[s] = (scriptCounts[s] ?? 0) + 1;
    }
  }
  const repeatedScripts = Object.entries(scriptCounts)
    .filter(([, c]) => c >= REPEAT_FAIL_MIN)
    .sort((a, b) => b[1] - a[1])
    .map(([script, count]) => ({ script, count }));
  let repeated: { type: string; scripts: { script: string; count: number }[] } | null = null;
  if (repeatedScripts.length > 0) {
    repeated = { type: 'repeated_script_failure', scripts: repeatedScripts };
    anomalies.push(repeated);
  }

  // warnings
  const warnings: object[] = [];
  if (failure_streak >= 2 || failSpike) {
    warnings.push({
      code: 'unstable_pipeline',
      message: failure_streak >= 2
        ? `Pipeline has failed ${failure_streak} run(s) in a row.`
        : failSpike!.detail,
    });
  }
  if (dur_trend === 'up') {
    warnings.push({
      code: 'slowdown_trend',
      message: durSpike
        ? `Duration is trending up. ${durSpike.detail}`
        : 'Duration trending upward over recent runs.',
    });
  }
  if (repeated) {
    const names = repeated.scripts.slice(0, 3).map((s) => s.script).join(', ');
    warnings.push({ code: 'recurring_failures', message: `Scripts failing repeatedly: ${names}`, scripts: repeated.scripts });
  }

  const isCritical =
    failure_streak >= 3 ||
    (repeated !== null && repeated.scripts.some((s) => s.count >= 5));

  const state = isCritical ? 'critical' : warnings.length > 0 ? 'warning' : 'stable';

  return NextResponse.json({
    state,
    trends: { duration_trend: dur_trend, failure_trend: fail_trend, success_streak, failure_streak },
    anomalies,
    warnings,
  });
}
