import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

type Run = {
  timestamp?: string;
  last_run_at?: string;
  status?: string;
  duration_sec?: number;
  scripts_ok?: number;
  scripts_failed?: number;
  failed_scripts?: string[];
};

function normalizeRun(r: Run) {
  return {
    timestamp: String(r.timestamp ?? r.last_run_at ?? ''),
    status: String(r.status ?? 'unknown'),
    duration_sec: Number(r.duration_sec ?? 0),
    scripts_ok: Number(r.scripts_ok ?? 0),
    scripts_failed: Number(r.scripts_failed ?? 0),
    failed_scripts: Array.isArray(r.failed_scripts) ? r.failed_scripts : [],
  };
}

function isFailure(r: ReturnType<typeof normalizeRun>): boolean {
  return r.status !== 'success' || r.scripts_failed > 0;
}

async function readJsonSafe(candidates: string[]): Promise<unknown> {
  for (const p of candidates) {
    try {
      const txt = await fs.readFile(p, 'utf-8');
      return JSON.parse(txt);
    } catch {
      // try next
    }
  }
  return null;
}

function historyPaths(filename: string): string[] {
  return [
    path.resolve(process.cwd(), '..', 'backend', 'output', filename),
    path.resolve(process.cwd(), 'backend', 'output', filename),
    path.resolve(process.cwd(), '..', 'output', filename),
    path.resolve(process.cwd(), 'output', filename),
  ];
}

export async function GET() {
  const raw = await readJsonSafe(historyPaths('pipeline_history.json'));

  const emptyMetrics = {
    total_runs: 0,
    success_runs: 0,
    failure_runs: 0,
    failure_rate_pct: 0,
    last_failure_ts: null as string | null,
    avg_duration_sec: 0,
    latest_duration_sec: 0,
    health_score: 0,
    health_label: 'Unknown',
  };

  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json({
      metrics: emptyMetrics,
      quality_checks: [
        {
          level: 'error',
          message: raw === null
            ? 'pipeline_history.json missing'
            : 'pipeline_history.json is empty',
        },
      ],
    });
  }

  const sorted = [...raw].sort((a, b) =>
    (b.timestamp ?? b.last_run_at ?? '') > (a.timestamp ?? a.last_run_at ?? '') ? 1 : -1
  );
  const recent = sorted.slice(0, 10).map(normalizeRun);
  const total = recent.length;
  const failures = recent.filter(isFailure);
  const successes = recent.filter((r) => !isFailure(r));
  const failureCount = failures.length;
  const failureRate = Math.round((failureCount / total) * 1000) / 10;
  const lastFailureTs = failures[0]?.timestamp ?? null;
  const avgDur = Math.round((recent.reduce((s, r) => s + r.duration_sec, 0) / total) * 10) / 10;
  const latest = recent[0];
  const latestDur = latest.duration_sec;

  const quality_checks: { level: string; message: string }[] = [];
  let score = 100;
  score -= Math.min(failureCount * 10, 50);

  if (latestDur > 900) {
    score -= 15;
    quality_checks.push({ level: 'warning', message: `Latest run took ${Math.round(latestDur)}s (threshold: 900s)` });
  }
  if (latest.scripts_ok === 0 && latestDur > 0) {
    score -= 10;
    quality_checks.push({ level: 'critical', message: 'Latest run: scripts_ok == 0' });
  }
  score = Math.max(0, Math.min(100, score));

  const health_label =
    score >= 90 ? 'Healthy' :
    score >= 75 ? 'Degraded' :
    score >= 50 ? 'At Risk' : 'Critical';

  return NextResponse.json({
    metrics: {
      total_runs: total,
      success_runs: successes.length,
      failure_runs: failureCount,
      failure_rate_pct: failureRate,
      last_failure_ts: lastFailureTs,
      avg_duration_sec: avgDur,
      latest_duration_sec: latestDur,
      health_score: score,
      health_label,
    },
    quality_checks,
  });
}
