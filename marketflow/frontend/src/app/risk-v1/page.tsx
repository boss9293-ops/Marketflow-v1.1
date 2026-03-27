import { cookies } from 'next/headers'
import { readFileSync } from 'fs'
import { join } from 'path'
import RiskV1ClientShell from '@/components/crash/standard/RiskV1ClientShell'
import type { RiskV1Data } from '@/components/crash/standard/RiskSystemV1'
import { UI_LANG_COOKIE, normalizeUiLang, pickLang, type UiLang } from '@/lib/uiLang'

function readOutputJson<T>(filename: string): T | null {
  try {
    const base = join(process.cwd(), '..', 'backend', 'output')
    const raw = readFileSync(join(base, filename), 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export default function RiskV1Page() {
  const uiLang: UiLang = normalizeUiLang(cookies().get(UI_LANG_COOKIE)?.value)
  const raw = readOutputJson<RiskV1Data>('risk_v1.json')

  if (!raw) {
    return (
      <main style={{ padding: '2.6rem', color: '#b7c6df', fontFamily: 'monospace' }}>
        <h2 style={{ color: '#ef4444' }}>{pickLang(uiLang, 'risk_v1.json을 찾을 수 없습니다', 'risk_v1.json not found')}</h2>
        <p>
          {pickLang(uiLang, '실행:', 'Run:')}{' '}
          <code style={{ background: '#111', padding: '0.26rem 0.65rem', borderRadius: 4 }}>
            py marketflow/backend/scripts/build_risk_v1.py
          </code>
        </p>
        <a href="/crash" style={{ color: '#6366f1' }}>
          {pickLang(uiLang, '← 크래시 허브', '← Crash Hub')}
        </a>
      </main>
    )
  }

  return <RiskV1ClientShell data={raw} initialUiLang={uiLang} />
}
