import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
  const filename = 'pipeline_history.json';
  const candidates = [
    path.resolve(process.cwd(), '..', 'backend', 'output', filename),
    path.resolve(process.cwd(), 'backend', 'output', filename),
    path.resolve(process.cwd(), '..', 'output', filename),
    path.resolve(process.cwd(), 'output', filename),
  ];

  for (const candidate of candidates) {
    try {
      const data = await fs.readFile(candidate, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return NextResponse.json(parsed);
      }
    } catch {
      // try next
    }
  }

  return NextResponse.json([]);
}
