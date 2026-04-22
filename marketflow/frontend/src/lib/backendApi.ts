const LOCAL_BACKEND_URL = 'http://localhost:5001'
// /api/flask/* is proxied via next.config.js rewrites → Railway backend
// Use clientApiUrl() for all client-side fetch calls to avoid hardcoding localhost
const PROXY_PREFIX = '/api/flask'

function normalizeBaseUrl(value: string): string {
  const trimmed = value.replace(/\/+$/, '').trim()
  if (trimmed && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return `https://${trimmed}`
  }
  return trimmed
}

export function resolveBackendBaseUrl(): string {
  if (typeof window === 'undefined' && process.env.VERCEL) {
    return 'https://marketflow-v11-production.up.railway.app'
  }

  const candidates = [
    process.env.NEXT_PUBLIC_BACKEND_API,
    process.env.NEXT_PUBLIC_BACKEND_URL,
    process.env.NEXT_PUBLIC_API_URL,
    process.env.BACKEND_URL,
    process.env.FLASK_API_URL,
    process.env.NEXT_PUBLIC_RAILWAY_BACKEND_URL,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return normalizeBaseUrl(candidate.trim())
    }
  }

  return LOCAL_BACKEND_URL
}

export function backendApiUrl(pathname: string): string {
  const baseUrl = resolveBackendBaseUrl()
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`
  return `${baseUrl}${normalizedPath}`
}

/**
 * Client-safe fetch URL for browser ('use client') components.
 *
 * - Production (Vercel): returns /api/flask/<path>  →  Next.js proxy → Railway
 *   → No CORS, no exposed localhost, no env var needed on client bundle
 * - Local dev (localhost): returns http://localhost:5001/<path> directly
 * - SSR (server-side): returns absolute Railway URL via resolveBackendBaseUrl()
 *
 * Usage:
 *   import { clientApiUrl } from '@/lib/backendApi'
 *   fetch(clientApiUrl('/api/market/indices'))
 */
export function clientApiUrl(pathname: string): string {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`
  // Server-side rendering: use absolute backend URL
  if (typeof window === 'undefined') {
    return backendApiUrl(normalizedPath)
  }
  // Browser - local dev: talk to local Flask directly
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1') {
    return `${LOCAL_BACKEND_URL}${normalizedPath}`
  }
  // Browser - production (Vercel, etc.): use the Next.js /api/flask proxy
  return `${PROXY_PREFIX}${normalizedPath}`
}

export function isLocalBackendUrl(value: string | null | undefined): boolean {
  if (!value) return false
  return normalizeBaseUrl(value) === LOCAL_BACKEND_URL
}
