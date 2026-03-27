import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

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

function outputPaths(filename: string): string[] {
  return [
    path.resolve(process.cwd(), '..', 'backend', 'output', filename),
    path.resolve(process.cwd(), 'backend', 'output', filename),
    path.resolve(process.cwd(), '..', 'output', filename),
    path.resolve(process.cwd(), 'output', filename),
  ];
}

type Run = {
  timestamp?: string;
  last_run_at?: string;
  failed_scripts?: string[];
};

export async function GET() {
  const rawHistory = await readJsonSafe(outputPaths('pipeline_history.json'));
  const rawReport = await readJsonSafe(outputPaths('pipeline_report.json'));

  // Aggregate failed_scripts from recent 10 runs
  const scriptCounts: Record<string, number> = {};
  if (Array.isArray(rawHistory)) {
    const sorted = [...rawHistory as Run[]].sort((a, b) =>
      (b.timestamp ?? b.last_run_at ?? '') > (a.timestamp ?? a.last_run_at ?? '') ? 1 : -1
    );
    for (const run of sorted.slice(0, 10)) {
      const scripts = Array.isArray(run.failed_scripts) ? run.failed_scripts : [];
      for (const s of scripts) {
        if (s) scriptCounts[s] = (scriptCounts[s] ?? 0) + 1;
      }
    }
  }

  const top_failed_scripts = Object.entries(scriptCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([script, fail_count]) => ({ script, fail_count }));

  // Latest pipeline_report.json failures
  type ReportItem = { filename?: string; description?: string; ok?: boolean; elapsed_sec?: number };
  const latest_report_failures: { script: string; description: string; elapsed_sec: number }[] = [];
  if (rawReport && typeof rawReport === 'object' && !Array.isArray(rawReport)) {
    const report = rawReport as { items?: ReportItem[] };
    for (const item of report.items ?? []) {
      if (!item.ok) {
        const name = String(item.filename ?? '');
        if (name) {
          latest_report_failures.push({
            script: name,
            description: String(item.description ?? ''),
            elapsed_sec: Math.round((Number(item.elapsed_sec ?? 0)) * 10) / 10,
          });
        }
      }
    }
  }

  return NextResponse.json({ top_failed_scripts, latest_report_failures });
}
