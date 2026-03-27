import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// ── types ─────────────────────────────────────────────────────────────────────

interface RunEntry {
  timestamp:       string;
  status:          string;
  scripts_ok?:     number;
  scripts_failed?: number;
  duration_sec?:   number;
}

interface AuditEntry {
  run_timestamp:    string;
  total_attempts?:  number;
  recovered?:       number;
}

type EpisodeSeverity  = 'low' | 'medium' | 'high' | 'critical';
type EpisodeRootCause = 'transient' | 'intermittent' | 'recurring' | 'systemic';

interface Episode {
  episode_id:          string;
  status:              'active' | 'resolved';
  start_time:          string;
  end_time:            string | null;
  duration_runs:       number;
  failure_count:       number;
  retry_count:         number;
  scripts_failed_peak: number;
  root_cause:          EpisodeRootCause;
  severity:            EpisodeSeverity;
}

// ── constants ─────────────────────────────────────────────────────────────────

const CLOSE_STREAK      = 2;
const MAX_EPISODES      = 20;

const SEV_CRITICAL_SCRIPTS  = 10;
const SEV_CRITICAL_FAILURES = 5;
const SEV_HIGH_SCRIPTS      = 5;
const SEV_HIGH_FAILURES     = 4;
const SEV_MED_SCRIPTS       = 2;
const SEV_MED_FAILURES      = 2;

// ── helpers ───────────────────────────────────────────────────────────────────

function historyPaths(): string[] {
  return [
    path.resolve(process.cwd(), '..', 'backend', 'output', 'pipeline_history.json'),
    path.resolve(process.cwd(), 'backend', 'output', 'pipeline_history.json'),
    path.resolve(process.cwd(), '..', 'output', 'pipeline_history.json'),
  ];
}

function auditPaths(): string[] {
  return [
    path.resolve(process.cwd(), '..', 'backend', 'output', 'cache', 'pipeline_retry_audit.json'),
    path.resolve(process.cwd(), 'backend', 'output', 'cache', 'pipeline_retry_audit.json'),
    path.resolve(process.cwd(), '..', 'output', 'cache', 'pipeline_retry_audit.json'),
  ];
}

async function readJsonSafe(candidates: string[]): Promise<unknown> {
  for (const p of candidates) {
    try { return JSON.parse(await fs.readFile(p, 'utf-8')); } catch { /* next */ }
  }
  return null;
}

// ── classification ─────────────────────────────────────────────────────────────

function classifyEpisode(ep: Omit<Episode, 'severity' | 'root_cause'>): Episode {
  const { scripts_failed_peak, failure_count, retry_count } = ep;

  let severity: EpisodeSeverity;
  if (scripts_failed_peak >= SEV_CRITICAL_SCRIPTS || failure_count >= SEV_CRITICAL_FAILURES) {
    severity = 'critical';
  } else if (scripts_failed_peak >= SEV_HIGH_SCRIPTS || failure_count >= SEV_HIGH_FAILURES) {
    severity = 'high';
  } else if (scripts_failed_peak >= SEV_MED_SCRIPTS || failure_count >= SEV_MED_FAILURES || retry_count > 0) {
    severity = 'medium';
  } else {
    severity = 'low';
  }

  let root_cause: EpisodeRootCause;
  if (severity === 'critical') {
    root_cause = 'systemic';
  } else if (severity === 'high') {
    root_cause = 'recurring';
  } else if (severity === 'medium' && failure_count >= 2 && retry_count === 0) {
    root_cause = 'intermittent';
  } else {
    root_cause = 'transient';
  }

  return { ...ep, severity, root_cause };
}

// ── core state machine ─────────────────────────────────────────────────────────

function buildEpisodes(
  history:  RunEntry[],
  auditIdx: Map<string, AuditEntry>,
): { episodes: Episode[]; finalStreak: number } {
  const episodes: Episode[] = [];
  let currentEp: Omit<Episode, 'severity' | 'root_cause'> | null = null;
  let consecutiveOk = 0;

  // history is newest-first → process chronologically
  for (const run of [...history].reverse()) {
    const ts            = run.timestamp ?? '';
    const status        = run.status    ?? 'unknown';
    const scriptsFailed = Number(run.scripts_failed ?? 0);

    const auditEntry = auditIdx.get(ts);
    const retryCount = Number(auditEntry?.total_attempts ?? 0);

    const isFailure = status !== 'success' || scriptsFailed > 0;
    const hadRetry  = retryCount > 0;

    if (isFailure || hadRetry) {
      consecutiveOk = 0;

      if (!currentEp) {
        const epDate = ts.slice(0, 10).replace(/-/g, '');
        const epTime = ts.length >= 19 ? ts.slice(11, 19).replace(/:/g, '') : '000000';
        currentEp = {
          episode_id:          `ep-${epDate}-${epTime}`,
          status:              'active',
          start_time:          ts,
          end_time:            null,
          duration_runs:       1,
          failure_count:       isFailure ? 1 : 0,
          retry_count:         retryCount,
          scripts_failed_peak: scriptsFailed,
        };
      } else {
        currentEp.duration_runs += 1;
        if (isFailure) {
          currentEp.failure_count       += 1;
          currentEp.scripts_failed_peak  = Math.max(currentEp.scripts_failed_peak, scriptsFailed);
        }
        currentEp.retry_count += retryCount;
      }
    } else {
      consecutiveOk += 1;

      if (currentEp) {
        currentEp.duration_runs += 1;
        if (consecutiveOk >= CLOSE_STREAK) {
          currentEp.status   = 'resolved';
          currentEp.end_time = ts;
          episodes.push(classifyEpisode(currentEp));
          currentEp     = null;
          consecutiveOk = 0;
        }
      }
    }
  }

  // Still open → active
  if (currentEp) {
    episodes.push(classifyEpisode(currentEp));
  }

  // Return newest first
  episodes.reverse();
  return { episodes, finalStreak: consecutiveOk };
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const rawHistory = await readJsonSafe(historyPaths());
    if (!Array.isArray(rawHistory)) {
      return NextResponse.json({
        ok: false, active_episode: null, episodes: [],
        total_episodes: 0, current_streak: 0,
        error: 'pipeline_history.json not available',
      });
    }

    const history = rawHistory as RunEntry[];
    if (history.length === 0) {
      return NextResponse.json({
        ok: true, active_episode: null, episodes: [],
        total_episodes: 0, current_streak: 0,
      });
    }

    // Build audit index
    const rawAudit = await readJsonSafe(auditPaths());
    const auditIdx = new Map<string, AuditEntry>();
    if (Array.isArray(rawAudit)) {
      for (const entry of rawAudit as AuditEntry[]) {
        if (entry?.run_timestamp) auditIdx.set(entry.run_timestamp, entry);
      }
    }

    const { episodes, finalStreak } = buildEpisodes(history, auditIdx);
    const episodesOut = episodes.slice(0, MAX_EPISODES);
    const activeEp    = episodesOut[0]?.status === 'active' ? episodesOut[0] : null;

    return NextResponse.json({
      ok:             true,
      active_episode: activeEp,
      episodes:       episodesOut,
      total_episodes: episodesOut.length,
      current_streak: activeEp ? 0 : finalStreak,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false, active_episode: null, episodes: [],
      total_episodes: 0, current_streak: 0,
      error: String(err),
    });
  }
}
