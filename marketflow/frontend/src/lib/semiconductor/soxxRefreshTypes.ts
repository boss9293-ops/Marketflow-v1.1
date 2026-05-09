export type SoxxRefreshLayer =
  | 'holdings'
  | 'price_history'
  | 'returns'
  | 'contribution_snapshot'
  | 'contribution_history'
  | 'freshness'

export type SoxxRefreshStatus =
  | 'success'
  | 'partial'
  | 'failed'
  | 'skipped'

export type SoxxRefreshLogEntry = {
  layer: SoxxRefreshLayer
  status: SoxxRefreshStatus
  startedAt: string
  finishedAt?: string
  source: string
  asOf?: string
  recordsProcessed?: number
  missingTickers?: string[]
  warnings: string[]
  error?: string
}

export type SoxxRefreshTrigger = 'manual' | 'scheduled' | 'api' | 'unknown'

export type SoxxRefreshRunSummary = {
  runId: string
  trigger: SoxxRefreshTrigger
  startedAt: string
  finishedAt?: string
  status: SoxxRefreshStatus
  entries: SoxxRefreshLogEntry[]
  warnings: string[]
}
