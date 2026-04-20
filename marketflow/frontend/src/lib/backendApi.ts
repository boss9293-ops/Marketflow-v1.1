const LOCAL_BACKEND_URL = 'http://localhost:5001'

function normalizeBaseUrl(value: string): string {
  const trimmed = value.replace(/\/+$/, '').trim()
  if (trimmed && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return `https://${trimmed}`
  }
  return trimmed
}

export function resolveBackendBaseUrl(): string {
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

export function isLocalBackendUrl(value: string | null | undefined): boolean {
  if (!value) return false
  return normalizeBaseUrl(value) === LOCAL_BACKEND_URL
}
