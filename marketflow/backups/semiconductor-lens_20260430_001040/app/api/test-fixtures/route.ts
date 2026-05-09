/**
 * FILE: app/api/semiconductor-lens/test-fixtures/route.ts
 * RESPONSIBILITY: Execute all 4 engine fixture scenarios and return results.
 * Internal use only — not for UI rendering.
 *
 * GET /api/semiconductor-lens/test-fixtures
 */

import { NextResponse } from 'next/server'
import { runAllFixtures } from '@/lib/semiconductor/__tests__/runSemiconductorFixtures'

export async function GET() {
  try {
    const results = runAllFixtures()
    return NextResponse.json(results, { status: 200 })
  } catch (err) {
    return NextResponse.json(
      { error: 'fixture run failed', detail: String(err) },
      { status: 500 },
    )
  }
}
