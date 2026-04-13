/**
 * Turso (libSQL) 서버사이드 클라이언트 헬퍼
 * - 서버 컴포넌트 / Route Handler 전용 (클라이언트 번들에 포함되지 않음)
 * - 환경변수: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN
 */

let _client: import('@libsql/client').Client | null = null

export function getTursoClient(): import('@libsql/client').Client | null {
  if (_client) return _client

  const url = (
    process.env.TURSO_DATABASE_URL ||
    process.env.LIBSQL_URL ||
    'libsql://marketos-boss9293.aws-us-east-1.turso.io'
  ).trim()

  const authToken = (
    process.env.TURSO_AUTH_TOKEN ||
    process.env.LIBSQL_AUTH_TOKEN ||
    ''
  ).trim()

  if (!authToken) {
    console.warn('[Turso] TURSO_AUTH_TOKEN not set — Turso queries will be skipped.')
    return null
  }

  try {
    // Dynamic import to avoid bundling in client components
    const { createClient } = require('@libsql/client')
    _client = createClient({ url, authToken })
    return _client
  } catch (err) {
    console.error('[Turso] Failed to create client:', err)
    return null
  }
}
