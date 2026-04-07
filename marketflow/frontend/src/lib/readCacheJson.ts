import fs from 'fs/promises'
import path from 'path'

const BACKEND_URL = process.env.FLASK_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_API || ''

export async function readCacheJson<T>(filename: string, fallback: T): Promise<T> {
  if (BACKEND_URL) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/data/${filename}`, { cache: 'no-store' })
      if (res.ok) return (await res.json()) as T
    } catch {
      // fall through to file system
    }
  }

  const candidates = [
    path.resolve(process.cwd(), '..', 'backend', 'output', filename),
    path.resolve(process.cwd(), 'backend', 'output', filename),
    path.resolve(process.cwd(), '..', 'backend', 'output', 'cache', filename),
    path.resolve(process.cwd(), 'backend', 'output', 'cache', filename),
    path.resolve(process.cwd(), '..', 'output', filename),
    path.resolve(process.cwd(), 'output', filename),
  ]
  for (const candidate of candidates) {
    try {
      return JSON.parse(await fs.readFile(candidate, 'utf-8')) as T
    } catch {
      // try next
    }
  }
  return fallback
}

export async function readCacheJsonOrNull<T>(filename: string): Promise<T | null> {
  if (BACKEND_URL) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/data/${filename}`, { cache: 'no-store' })
      if (res.ok) return (await res.json()) as T
    } catch {
      // fall through to file system
    }
  }

  const candidates = [
    path.resolve(process.cwd(), '..', 'backend', 'output', filename),
    path.resolve(process.cwd(), 'backend', 'output', filename),
    path.resolve(process.cwd(), '..', 'backend', 'output', 'cache', filename),
    path.resolve(process.cwd(), 'backend', 'output', 'cache', filename),
    path.resolve(process.cwd(), '..', 'output', filename),
    path.resolve(process.cwd(), 'output', filename),
  ]
  for (const candidate of candidates) {
    try {
      return JSON.parse(await fs.readFile(candidate, 'utf-8')) as T
    } catch {
      // try next
    }
  }
  return null
}
