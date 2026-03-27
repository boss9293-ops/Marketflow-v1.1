import fs from 'fs/promises'
import path from 'path'
import { normalizeAiBriefing, type AiBriefing } from '@/lib/aiBriefing'

const OUTPUT_DIRS = [
  path.resolve(process.cwd(), '..', 'backend', 'output'),
  path.resolve(process.cwd(), 'backend', 'output'),
  path.resolve(process.cwd(), '..', 'output'),
  path.resolve(process.cwd(), 'output'),
]

const RELATIVE_PATHS: Record<'std_risk' | 'macro' | 'integrated', string> = {
  std_risk: 'ai/std_risk/latest.json',
  macro: 'ai/macro/latest.json',
  integrated: 'ai/integrated/latest.json',
}

export async function readCachedAiBriefing(layer: 'std_risk' | 'macro' | 'integrated'): Promise<{ briefing: AiBriefing; path: string } | null> {
  const relative = RELATIVE_PATHS[layer]
  for (const base of OUTPUT_DIRS) {
    const fullPath = path.join(base, relative)
    try {
      await fs.stat(fullPath)
      const raw = JSON.parse(await fs.readFile(fullPath, 'utf8'))
      return { briefing: normalizeAiBriefing(raw), path: fullPath }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code
      if (code === 'ENOENT') continue
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in ${fullPath}: ${error.message}`)
      }
    }
  }
  return null
}
