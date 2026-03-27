import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
  const filename = 'pipeline_status.json';
  const candidates = [
    path.resolve(process.cwd(), '..', 'backend', 'output', filename),
    path.resolve(process.cwd(), 'backend', 'output', filename),
    path.resolve(process.cwd(), '..', 'output', filename),
    path.resolve(process.cwd(), 'output', filename),
  ];

  for (const candidate of candidates) {
    try {
      const data = await fs.readFile(candidate, 'utf-8');
      return NextResponse.json(JSON.parse(data));
    } catch {
      // try next
    }
  }

  return NextResponse.json(
    { status: "unknown", error: "pipeline_status.json not found" }
  );
}
