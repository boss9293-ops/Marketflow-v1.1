import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REPORTS_DIR = path.resolve(process.cwd(), '..', 'backend', 'services', 'admin_reports');

if (!fsSync.existsSync(REPORTS_DIR)) {
  fsSync.mkdirSync(REPORTS_DIR, { recursive: true });
}

export async function GET() {
  try {
    const files = await fs.readdir(REPORTS_DIR);
    
    const history = files
      .filter(f => f.startsWith('ai_repair_') && f.endsWith('.md'))
      .sort()
      .reverse(); // newest first

    return NextResponse.json({ files: history });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
