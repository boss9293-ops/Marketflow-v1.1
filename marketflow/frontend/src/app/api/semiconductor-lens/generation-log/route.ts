import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const GENERATION_LOG_PATHS = [
  path.join(process.cwd(), '..', 'backend', 'output', 'semiconductor', 'soxx_contribution_generation_log.json'),
  path.join(process.cwd(), 'backend', 'output', 'semiconductor', 'soxx_contribution_generation_log.json'),
  path.join(process.cwd(), '..', 'output', 'semiconductor', 'soxx_contribution_generation_log.json'),
]

export async function GET() {
  for (const candidate of GENERATION_LOG_PATHS) {
    try {
      if (!fs.existsSync(candidate)) continue
      const payload = JSON.parse(fs.readFileSync(candidate, 'utf-8'))
      return NextResponse.json(payload)
    } catch {
      // Try next candidate.
    }
  }

  return NextResponse.json({
    lastRunAt: null,
    status: 'unavailable',
    source: null,
    outputs: [],
    missingTickers: [],
    warnings: ['Generation log file not found.'],
    error: 'Generation log output not found. Run generate_soxx_contribution_outputs.py first.',
  })
}
