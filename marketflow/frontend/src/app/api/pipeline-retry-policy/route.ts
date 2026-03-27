import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// ── types ────────────────────────────────────────────────────────────────────

export type RootCause =
  | 'timeout'
  | 'missing_input'
  | 'malformed_json'
  | 'dependency_failure'
  | 'script_exception'
  | 'unknown';

export interface RetryPolicy {
  enabled:              boolean;
  max_retry_per_script: number;
  allow_root_causes:    RootCause[];
  deny_root_causes:     RootCause[];
  allow_scripts:        string[];
  deny_scripts:         string[];
  cooldown_sec:         number;
}

// ── constants ────────────────────────────────────────────────────────────────

const VALID_ROOT_CAUSES = new Set<string>([
  'timeout', 'missing_input', 'malformed_json',
  'dependency_failure', 'script_exception', 'unknown',
]);

const DEFAULT_POLICY: RetryPolicy = {
  enabled:              true,
  max_retry_per_script: 1,
  allow_root_causes:    [],
  deny_root_causes:     [],
  allow_scripts:        [],
  deny_scripts:         [],
  cooldown_sec:         0,
};

// ── helpers ──────────────────────────────────────────────────────────────────

function policyPaths(): string[] {
  return [
    path.resolve(process.cwd(), '..', 'backend', 'output', 'cache', 'pipeline_retry_policy.json'),
    path.resolve(process.cwd(), 'backend', 'output', 'cache', 'pipeline_retry_policy.json'),
    path.resolve(process.cwd(), '..', 'output', 'cache', 'pipeline_retry_policy.json'),
  ];
}

async function readJsonSafe(candidates: string[]): Promise<unknown> {
  for (const p of candidates) {
    try { return JSON.parse(await fs.readFile(p, 'utf-8')); } catch { /* next */ }
  }
  return null;
}

async function resolvedCacheDir(): Promise<string | null> {
  const candidates = [
    path.resolve(process.cwd(), '..', 'backend', 'output', 'cache'),
    path.resolve(process.cwd(), 'backend', 'output', 'cache'),
    path.resolve(process.cwd(), '..', 'output', 'cache'),
  ];
  for (const p of candidates) {
    try { await fs.access(path.dirname(p)); return p; } catch { /* next */ }
  }
  return null;
}

function validatePolicy(data: unknown): { cleaned: RetryPolicy | null; errors: string[] } {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { cleaned: null, errors: ['Policy must be a JSON object.'] };
  }

  const d = data as Record<string, unknown>;
  const errors: string[] = [];
  const cleaned: Partial<RetryPolicy> = {};

  // enabled
  const enabled = 'enabled' in d ? d.enabled : DEFAULT_POLICY.enabled;
  if (typeof enabled !== 'boolean') {
    errors.push("'enabled' must be a boolean.");
  } else {
    cleaned.enabled = enabled;
  }

  // max_retry_per_script
  const max = 'max_retry_per_script' in d ? d.max_retry_per_script : DEFAULT_POLICY.max_retry_per_script;
  if (typeof max !== 'number' || !Number.isInteger(max) || max < 0 || max > 3) {
    errors.push("'max_retry_per_script' must be an integer 0..3.");
  } else {
    cleaned.max_retry_per_script = max;
  }

  // allow_root_causes
  const arc = 'allow_root_causes' in d ? d.allow_root_causes : [];
  if (!Array.isArray(arc)) {
    errors.push("'allow_root_causes' must be an array.");
  } else {
    const bad = arc.filter((x) => !VALID_ROOT_CAUSES.has(String(x)));
    if (bad.length) {
      errors.push(`'allow_root_causes' contains unknown value(s): ${JSON.stringify(bad)}`);
    } else {
      cleaned.allow_root_causes = arc as RootCause[];
    }
  }

  // deny_root_causes
  const drc = 'deny_root_causes' in d ? d.deny_root_causes : [];
  if (!Array.isArray(drc)) {
    errors.push("'deny_root_causes' must be an array.");
  } else {
    const bad = drc.filter((x) => !VALID_ROOT_CAUSES.has(String(x)));
    if (bad.length) {
      errors.push(`'deny_root_causes' contains unknown value(s): ${JSON.stringify(bad)}`);
    } else {
      cleaned.deny_root_causes = drc as RootCause[];
    }
  }

  // allow_scripts
  const as_ = 'allow_scripts' in d ? d.allow_scripts : [];
  if (!Array.isArray(as_)) {
    errors.push("'allow_scripts' must be an array.");
  } else {
    cleaned.allow_scripts = as_.filter(Boolean).map(String);
  }

  // deny_scripts
  const ds = 'deny_scripts' in d ? d.deny_scripts : [];
  if (!Array.isArray(ds)) {
    errors.push("'deny_scripts' must be an array.");
  } else {
    cleaned.deny_scripts = ds.filter(Boolean).map(String);
  }

  // cooldown_sec
  const cool = 'cooldown_sec' in d ? d.cooldown_sec : DEFAULT_POLICY.cooldown_sec;
  if (typeof cool !== 'number' || !Number.isInteger(cool) || cool < 0 || cool > 3600) {
    errors.push("'cooldown_sec' must be an integer 0..3600.");
  } else {
    cleaned.cooldown_sec = cool;
  }

  if (errors.length) return { cleaned: null, errors };

  return { cleaned: { ...DEFAULT_POLICY, ...cleaned } as RetryPolicy, errors: [] };
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const raw = await readJsonSafe(policyPaths());
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return NextResponse.json({ ok: true, policy: DEFAULT_POLICY });
  }

  const { cleaned } = validatePolicy(raw);
  return NextResponse.json({ ok: true, policy: cleaned ?? DEFAULT_POLICY });
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, errors: ['Invalid JSON body.'] }, { status: 400 });
  }

  const { cleaned, errors } = validatePolicy(body);
  if (errors.length || !cleaned) {
    return NextResponse.json({ ok: false, errors }, { status: 400 });
  }

  // Resolve write path
  const cacheDir = await resolvedCacheDir();
  if (!cacheDir) {
    return NextResponse.json(
      { ok: false, errors: ['Cannot resolve cache directory.'] },
      { status: 500 },
    );
  }

  try {
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(
      path.join(cacheDir, 'pipeline_retry_policy.json'),
      JSON.stringify(cleaned, null, 2),
      'utf-8',
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, errors: [`Failed to write policy: ${err}`] },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, policy: cleaned });
}
