import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// ── types ─────────────────────────────────────────────────────────────────────

interface OpsMode {
  enabled:                        boolean;
  reason:                         string;
  set_by:                         string;
  set_at:                         string;
  force_skip_scripts:             string[];
  force_manual_attention_scripts: string[];
  force_allow_retry_scripts:      string[];
}

// ── helpers ───────────────────────────────────────────────────────────────────

const DEFAULT_OPS: OpsMode = {
  enabled:                        false,
  reason:                         '',
  set_by:                         '',
  set_at:                         '',
  force_skip_scripts:             [],
  force_manual_attention_scripts: [],
  force_allow_retry_scripts:      [],
};

function opsPaths(): string[] {
  return [
    path.resolve(process.cwd(), '..', 'backend', 'output', 'cache', 'pipeline_ops_mode.json'),
    path.resolve(process.cwd(), 'backend', 'output', 'cache', 'pipeline_ops_mode.json'),
    path.resolve(process.cwd(), '..', 'output', 'cache', 'pipeline_ops_mode.json'),
  ];
}

async function readJsonSafe(candidates: string[]): Promise<unknown> {
  for (const p of candidates) {
    try { return JSON.parse(await fs.readFile(p, 'utf-8')); } catch { /* next */ }
  }
  return null;
}

async function writeJson(candidates: string[], data: unknown): Promise<void> {
  for (const p of candidates) {
    try {
      await fs.mkdir(path.dirname(p), { recursive: true });
      await fs.writeFile(p, JSON.stringify(data, null, 2), 'utf-8');
      return;
    } catch { /* next */ }
  }
  throw new Error('Could not write ops mode config — no writable path found');
}

function validate(body: unknown): string {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'body must be an object';
  const b = body as Record<string, unknown>;
  if ('enabled' in b && typeof b.enabled !== 'boolean') return '"enabled" must be a boolean';
  for (const key of ['force_skip_scripts', 'force_manual_attention_scripts', 'force_allow_retry_scripts']) {
    if (key in b) {
      if (!Array.isArray(b[key])) return `"${key}" must be an array`;
      if (!(b[key] as unknown[]).every((s) => typeof s === 'string')) return `"${key}" must contain only strings`;
    }
  }
  return '';
}

function normalise(body: Record<string, unknown>): OpsMode {
  return {
    enabled:                        Boolean(body.enabled ?? false),
    reason:                         String(body.reason  ?? '').slice(0, 200),
    set_by:                         String(body.set_by  ?? 'operator').slice(0, 100),
    set_at:                         new Date().toISOString(),
    force_skip_scripts:             (Array.isArray(body.force_skip_scripts)             ? body.force_skip_scripts             : []).map(String),
    force_manual_attention_scripts: (Array.isArray(body.force_manual_attention_scripts) ? body.force_manual_attention_scripts : []).map(String),
    force_allow_retry_scripts:      (Array.isArray(body.force_allow_retry_scripts)      ? body.force_allow_retry_scripts      : []).map(String),
  };
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const raw = await readJsonSafe(opsPaths());
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return NextResponse.json({ ok: true, config: DEFAULT_OPS });
    }
    const config = { ...DEFAULT_OPS, ...(raw as Partial<OpsMode>) };
    return NextResponse.json({ ok: true, config });
  } catch (err) {
    return NextResponse.json({ ok: false, config: DEFAULT_OPS, error: String(err) });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try { body = await req.json(); } catch { body = {}; }

    const err = validate(body);
    if (err) return NextResponse.json({ ok: false, error: err }, { status: 400 });

    // Merge with existing config so partial updates work
    const existing = await readJsonSafe(opsPaths()) as Partial<OpsMode> | null;
    const merged   = { ...DEFAULT_OPS, ...(existing ?? {}), ...(body as Record<string, unknown>) };
    const config   = normalise(merged);

    await writeJson(opsPaths(), config);
    return NextResponse.json({ ok: true, config });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
