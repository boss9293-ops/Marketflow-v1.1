/** @type {import('next').NextConfig} */

function normalizeBackendUrl(value) {
  const trimmed = String(value ?? '').replace(/\/+$/, '').trim()
  if (trimmed && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return `https://${trimmed}`
  }
  return trimmed
}

function resolveBackendUrl() {
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
      return normalizeBackendUrl(candidate)
    }
  }

  return 'http://localhost:5001'
}

const BACKEND_URL = resolveBackendUrl()

const nextConfig = {
  webpack: (config, { dev }) => {
    if (dev) {
      // Disable webpack filesystem cache on Windows to prevent file-lock UNKNOWN errors
      config.cache = false
    }
    return config
  },
  async rewrites() {
    // Proxy /api/flask/* → Railway backend (bypasses CORS + env var issues)
    return [
      {
        source: '/api/flask/:path*',
        destination: `${BACKEND_URL}/:path*`,
      },
    ]
  },
}
module.exports = nextConfig
