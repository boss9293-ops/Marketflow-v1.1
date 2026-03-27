import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

async function readJsonSafe(candidates: string[]): Promise<unknown> {
  for (const p of candidates) {
    try { return JSON.parse(await fs.readFile(p, 'utf-8')); } catch { /* next */ }
  }
  return null;
}

function statusPaths(): string[] {
  return [
    path.resolve(process.cwd(), '..', 'backend', 'output', 'pipeline_status.json'),
    path.resolve(process.cwd(), 'backend', 'output', 'pipeline_status.json'),
    path.resolve(process.cwd(), '..', 'output', 'pipeline_status.json'),
    path.resolve(process.cwd(), 'output', 'pipeline_status.json'),
  ];
}

export async function GET() {
  const raw = await readJsonSafe(statusPaths());

  if (!raw || typeof raw !== 'object') {
    return NextResponse.json({ retry_attempted: false });
  }

  const status = raw as Record<string, unknown>;

  return NextResponse.json({
    retry_attempted:       Boolean(status.retry_attempted ?? false),
    retried_scripts:       Array.isArray(status.retried_scripts) ? status.retried_scripts : [],
    retry_recovered_count: Number(status.retry_recovered_count ?? 0),
    retry_failed_count:    Number(status.retry_failed_count ?? 0),
    retry_summary:         Array.isArray(status.retry_summary) ? status.retry_summary : [],
  });
}
