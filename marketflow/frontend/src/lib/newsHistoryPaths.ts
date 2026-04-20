import { existsSync } from 'fs'
import path from 'path'

function normalizeRelativePath(value: string): string {
  return String(value || '')
    .replace(/\\/g, '/')
    .trim()
    .replace(/^\/+|\/+$/g, '')
}

function findWorkspaceRoot(): string {
  let current = path.resolve(process.cwd())
  for (let depth = 0; depth < 6; depth += 1) {
    if (existsSync(path.resolve(current, 'backend')) && existsSync(path.resolve(current, 'frontend'))) {
      return current
    }
    const parent = path.dirname(current)
    if (parent === current) {
      break
    }
    current = parent
  }
  return path.resolve(process.cwd(), '..')
}

function dedupePaths(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const candidate = path.resolve(value)
    if (seen.has(candidate)) {
      continue
    }
    seen.add(candidate)
    out.push(candidate)
  }
  return out
}

function normalizeHistoryFilename(filename: string): string {
  const rel = normalizeRelativePath(filename)
  if (!rel || rel.split('/').some((part) => part === '..')) {
    throw new Error(`Invalid news history filename: ${filename}`)
  }
  return rel
}

function canonicalHistoryRoot(): string {
  return path.resolve(findWorkspaceRoot(), 'backend', 'output', 'cache')
}

function legacyHistoryRoot(): string {
  return path.resolve(findWorkspaceRoot(), 'frontend', '.cache')
}

export function resolveNewsHistoryReadCandidates(filename: string): string[] {
  const rel = normalizeHistoryFilename(filename)
  return dedupePaths([path.resolve(canonicalHistoryRoot(), rel)])
}

export function resolveNewsHistoryCandidates(filename: string): string[] {
  return resolveNewsHistoryReadCandidates(filename)
}

export function resolveLegacyNewsHistoryCandidates(filename: string): string[] {
  const rel = normalizeHistoryFilename(filename)
  return dedupePaths([path.resolve(legacyHistoryRoot(), rel)])
}

export function resolveNewsHistoryWritePath(filename: string): string {
  const rel = normalizeHistoryFilename(filename)
  return path.resolve(canonicalHistoryRoot(), rel)
}

export function resolveNewsHistoryPath(filename: string): string {
  return resolveNewsHistoryWritePath(filename)
}

export function resolvePreferredNewsHistoryPath(filename: string): string {
  return resolveNewsHistoryWritePath(filename)
}
