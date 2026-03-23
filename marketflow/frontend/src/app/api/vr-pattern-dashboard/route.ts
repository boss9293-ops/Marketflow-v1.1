import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

export async function GET() {
  try {
    const base = join(process.cwd(), '..', 'backend', 'output')
    const raw = readFileSync(join(base, 'vr_pattern_dashboard.json'), 'utf-8')
    return NextResponse.json(JSON.parse(raw))
  } catch {
    return NextResponse.json(
      { error: 'vr_pattern_dashboard.json not found - run build_vr_pattern_dashboard.py' },
      { status: 404 }
    )
  }
}
