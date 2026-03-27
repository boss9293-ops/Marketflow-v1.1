import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// ── types ─────────────────────────────────────────────────────────────────────

const SKIP_CATEGORIES = [
  'policy_blocked',
  'deny_script',
  'max_retry_exceeded',
  'cooldown_active',
  'structural_failure',
] as const;

type SkipCategory = typeof SKIP_CATEGORIES[number];

interface ScriptDecision {
  script:        string;
  root_cause:    string;
  allowed:       boolean;
  skip_reason:   string | null;
  skip_category: SkipCategory | null;
  attempted:     boolean;
  result:        string;
}

interface AuditEntry {
  run_timestamp:    string;
  total_attempts:   number;
  recovered:        number;
  failed:           number;
  skipped:          number;
  recovery_rate:    number;
  script_decisions: ScriptDecision[];
  skip_breakdown:   Record<SkipCategory, number>;
}

interface AuditSummary {
  ok:                    boolean;
  total_runs:            number;
  total_attempts:        number;
  total_recovered:       number;
  total_failed:          number;
  total_skipped:         number;
  overall_recovery_rate: number;
  skip_breakdown:        Record<SkipCategory, number>;
  recent_entries:        Array<Omit<AuditEntry, 'script_decisions'>>;
  error?:                string;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function auditPaths(): string[] {
  return [
    path.resolve(process.cwd(), '..', 'backend', 'output', 'cache', 'pipeline_retry_audit.json'),
    path.resolve(process.cwd(), 'backend', 'output', 'cache', 'pipeline_retry_audit.json'),
    path.resolve(process.cwd(), '..', 'output', 'cache', 'pipeline_retry_audit.json'),
  ];
}

async function readJsonSafe(candidates: string[]): Promise<unknown> {
  for (const p of candidates) {
    try { return JSON.parse(await fs.readFile(p, 'utf-8')); } catch { /* next */ }
  }
  return null;
}

function emptySkipBreakdown(): Record<SkipCategory, number> {
  return Object.fromEntries(SKIP_CATEGORIES.map((k) => [k, 0])) as Record<SkipCategory, number>;
}

function buildSummary(entries: AuditEntry[]): AuditSummary {
  const totalRuns      = entries.length;
  const totalAttempts  = entries.reduce((s, e) => s + (e.total_attempts  ?? 0), 0);
  const totalRecovered = entries.reduce((s, e) => s + (e.recovered        ?? 0), 0);
  const totalFailed    = entries.reduce((s, e) => s + (e.failed           ?? 0), 0);
  const totalSkipped   = entries.reduce((s, e) => s + (e.skipped          ?? 0), 0);
  const overallRate    = totalAttempts > 0 ? Math.round((totalRecovered / totalAttempts) * 1000) / 1000 : 0;

  const skipBreakdown = emptySkipBreakdown();
  for (const e of entries) {
    const sb = e.skip_breakdown ?? {};
    for (const k of SKIP_CATEGORIES) {
      skipBreakdown[k] += (sb[k] ?? 0);
    }
  }

  const recentEntries = entries.slice(0, 5).map(({ script_decisions: _sd, ...rest }) => rest);

  return {
    ok:                    true,
    total_runs:            totalRuns,
    total_attempts:        totalAttempts,
    total_recovered:       totalRecovered,
    total_failed:          totalFailed,
    total_skipped:         totalSkipped,
    overall_recovery_rate: overallRate,
    skip_breakdown:        skipBreakdown,
    recent_entries:        recentEntries,
  };
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  const fallback: AuditSummary = {
    ok:                    false,
    total_runs:            0,
    total_attempts:        0,
    total_recovered:       0,
    total_failed:          0,
    total_skipped:         0,
    overall_recovery_rate: 0,
    skip_breakdown:        emptySkipBreakdown(),
    recent_entries:        [],
    error:                 'No audit data available',
  };

  try {
    const raw = await readJsonSafe(auditPaths());
    if (!Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json({ ...fallback, error: 'Audit file empty or missing' });
    }
    const entries = raw as AuditEntry[];
    return NextResponse.json(buildSummary(entries));
  } catch (err) {
    return NextResponse.json({ ...fallback, error: String(err) });
  }
}
