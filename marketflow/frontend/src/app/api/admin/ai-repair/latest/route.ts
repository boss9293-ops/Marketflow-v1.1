import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REPORTS_DIR = path.resolve(process.cwd(), '..', 'backend', 'services', 'admin_reports');

// Ensure directory exists
if (!fsSync.existsSync(REPORTS_DIR)) {
  fsSync.mkdirSync(REPORTS_DIR, { recursive: true });
}

export async function GET() {
  try {
    const latestPath = path.join(REPORTS_DIR, 'latest_ai_repair.md');
    
    if (!fsSync.existsSync(latestPath)) {
      return NextResponse.json({ markdown: "No recent AI Diagnosis available. Run a new diagnosis.", time: null });
    }

    const content = await fs.readFile(latestPath, 'utf8');
    const stat = await fs.stat(latestPath);
    
    return NextResponse.json({ markdown: content, time: stat.mtime.toISOString() });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
