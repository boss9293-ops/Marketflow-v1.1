import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// ── types ──────────────────────────────────────────────────────────────────────

interface RunEntry {
  timestamp:       string;
  status:          string;
  duration_sec?:   number | null;
  scripts_ok?:     number;
  scripts_failed?: number;
}

interface AuditEntry {
  run_timestamp:  string;
  total_attempts?: number;
  recovered?:      number;
}

interface Episode {
  episode_id:          string;
  status:              'active' | 'resolved';
  start_time:          string;
  end_time:            string | null;
  duration_runs:       number;
  failure_count:       number;
  retry_count:         number;
  scripts_failed_peak: number;
  root_cause:          string;
  severity:            string;
}

interface OpsMode {
  enabled:                        boolean;
  reason?:                        string;
  force_manual_attention_scripts?: string[];
}

interface RiskFactor { signal: string; description: string; points: number; }

// ── constants ──────────────────────────────────────────────────────────────────

const HISTORY_WINDOW  = 10;
const EPISODE_WINDOW  = 14; // days

// ── path candidates ────────────────────────────────────────────────────────────

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

function episodePaths(): string[] {
  return [
    path.resolve(process.cwd(), '..', 'backend', 'output', 'cache', 'pipeline_episode_log.json'),
    path.resolve(process.cwd(), 'backend', 'output', 'cache', 'pipeline_episode_log.json'),
    path.resolve(process.cwd(), '..', 'output', 'cache', 'pipeline_episode_log.json'),
  ];
}

function opsPaths(): string[] {
  return [
    path.resolve(process.cwd(), '..', 'backend', 'output', 'cache', 'pipeline_ops_mode.json'),
    path.resolve(process.cwd(), 'backend', 'output', 'cache', 'pipeline_ops_mode.json'),
    path.resolve(process.cwd(), '..', 'output', 'cache', 'pipeline_ops_mode.json'),
  ];
}

async function readJsonSafe(candidates: string[]): Promise<unknown> {
  for (const p of candidates) {
    try { return JSON.parse(await fs.readFile(p, 'utf-8')); } catch { /* next */ }
  }
  return null;
}

// ── helpers ────────────────────────────────────────────────────────────────────

function isFailure(run: RunEntry): boolean {
  return run.status !== 'success' || Number(run.scripts_failed ?? 0) > 0;
}

function daysAgo(ts: string | null | undefined): number {
  if (!ts) return 9999;
  try {
    const dt = new Date(ts);
    if (isNaN(dt.getTime())) return 9999;
    return (Date.now() - dt.getTime()) / 86_400_000;
  } catch { return 9999; }
}

// ── signal functions ───────────────────────────────────────────────────────────

function sigRecentFailureRate(history: RunEntry[]): [number, string, string] {
  const recent = history.slice(0, HISTORY_WINDOW);
  if (!recent.length) return [0, 'recent_failure_rate', 'No run history available'];
  const nFail = recent.filter(isFailure).length;
  const pct   = nFail / recent.length;
  const pts   = pct === 0 ? 0 : pct <= 0.20 ? 8 : pct <= 0.40 ? 15 : pct <= 0.60 ? 22 : 30;
  return [pts, 'recent_failure_rate', `${nFail}/${recent.length} recent runs failed (${Math.round(pct * 100)}%)`];
}

function sigFailureStreak(history: RunEntry[]): [number, string, string] {
  let streak = 0;
  for (const run of history) {
    if (isFailure(run)) streak++;
    else break;
  }
  const pts  = streak === 0 ? 0 : streak === 1 ? 10 : streak === 2 ? 18 : 25;
  const desc = streak > 0
    ? `${streak} consecutive failure${streak !== 1 ? 's' : ''} at head of history`
    : 'No current failure streak';
  return [pts, 'failure_streak', desc];
}

function sigActiveEpisode(episodes: Episode[]): [number, string, string] {
  if (!episodes.length || episodes[0].status !== 'active') {
    return [0, 'active_episode', 'No active episode'];
  }
  const ep  = episodes[0];
  const sev = ep.severity;
  const pts: Record<string, number> = { low: 8, medium: 14, high: 18, critical: 20 };
  const p   = pts[sev] ?? 8;
  return [p, 'active_episode',
    `Active ${sev} episode open since ${ep.start_time.slice(0, 16)} (${ep.duration_runs}r, ${ep.failure_count}f)`];
}

function sigRecentEpisode(episodes: Episode[]): [number, string, string] {
  const resolved = episodes.filter(e => e.status === 'resolved');
  if (!resolved.length) return [0, 'recent_episode', 'No resolved episodes'];
  const ep   = resolved[0];
  const days = daysAgo(ep.end_time ?? ep.start_time);
  const sev  = ep.severity;
  if (days > EPISODE_WINDOW) return [0, 'recent_episode', `Last resolved episode >${EPISODE_WINDOW}d ago`];
  const pts =
    sev === 'critical' ? (days <= 7 ? 15 : 10) :
    sev === 'high'     ? (days <= 7 ? 12 : 8)  :
    sev === 'medium'   ? (days <= 7 ? 8  : 5)  : 4;
  return [pts, 'recent_episode', `${sev} episode resolved ${days.toFixed(1)}d ago (${ep.episode_id})`];
}

function sigRecurringRootCause(episodes: Episode[]): [number, string, string] {
  const recent = episodes.filter(e => daysAgo(e.start_time) <= 30);
  if (recent.length < 2) return [0, 'recurring_root_cause', 'Fewer than 2 episodes in last 30d'];
  const counts: Record<string, number> = {};
  for (const e of recent) counts[e.root_cause] = (counts[e.root_cause] ?? 0) + 1;
  const [topCause, topN] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (topN < 2) return [0, 'recurring_root_cause', 'No recurring root cause'];
  const pts =
    (topCause === 'systemic' || topCause === 'recurring') ? (topN >= 3 ? 15 : 10) :
    topCause === 'intermittent' ? 5 : 0;
  return [pts, 'recurring_root_cause', `Root cause "${topCause}" in ${topN}/${recent.length} recent episodes`];
}

function sigRetryFailureRate(audit: AuditEntry[]): [number, string, string] {
  if (!audit.length) return [0, 'retry_failure_rate', 'No retry audit data'];
  const retried   = audit.filter(e => Number(e.total_attempts ?? 0) > 0);
  if (!retried.length) return [0, 'retry_failure_rate', 'No retried runs recorded'];
  const attempted = retried.reduce((s, e) => s + Number(e.total_attempts ?? 0), 0);
  const recovered = retried.reduce((s, e) => s + Number(e.recovered       ?? 0), 0);
  if (attempted === 0) return [0, 'retry_failure_rate', 'No retry attempts'];
  const rate = recovered / attempted;
  const pts  = rate >= 0.80 ? 2 : rate >= 0.50 ? 5 : 10;
  return [pts, 'retry_failure_rate', `Retry recovery rate ${Math.round(rate * 100)}% (${recovered}/${attempted} attempts)`];
}

function sigDurationAnomaly(history: RunEntry[]): [number, string, string] {
  const durations = history.slice(0, HISTORY_WINDOW)
    .map(r => r.duration_sec)
    .filter((d): d is number => d !== null && d !== undefined && !isNaN(d));
  if (durations.length < 3) return [0, 'duration_anomaly', 'Not enough duration data'];
  const latest = durations[0];
  const rest   = durations.slice(1);
  const sorted = [...rest].sort((a, b) => a - b);
  const mid    = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  if (median <= 0) return [0, 'duration_anomaly', 'Median duration is zero'];
  const spike = (latest - median) / median;
  const pts   = spike < 0.20 ? 0 : spike < 0.50 ? 4 : spike < 1.00 ? 7 : 10;
  const sign  = spike >= 0 ? '+' : '';
  return [pts, 'duration_anomaly', `Last run ${latest.toFixed(0)}s vs median ${median.toFixed(0)}s (${sign}${Math.round(spike * 100)}%)`];
}

function sigManualAttention(ops: OpsMode | null): [number, string, string] {
  if (!ops) return [0, 'manual_attention', 'No ops mode config'];
  const n   = (ops.force_manual_attention_scripts ?? []).length;
  const pts = n === 0 ? 0 : n === 1 ? 5 : 10;
  const desc = n > 0 ? `${n} script${n !== 1 ? 's' : ''} flagged for manual attention` : 'No manual attention flags';
  return [pts, 'manual_attention', desc];
}

function sigMaintenanceMode(ops: OpsMode | null): [number, string, string] {
  if (!ops?.enabled) return [0, 'maintenance_mode', 'Maintenance mode not active'];
  return [10, 'maintenance_mode', `Maintenance mode active: "${ops.reason ?? 'operator set'}"`];
}

// ── classification ─────────────────────────────────────────────────────────────

function riskLabel(score: number): string {
  if (score >= 75) return 'high';
  if (score >= 50) return 'elevated';
  if (score >= 25) return 'watch';
  return 'low';
}

function predictedMode(
  score: number, activeEpPts: number, recentEpPts: number, recurringPts: number
): string {
  if (score >= 75 || activeEpPts > 0) return 'at_risk';
  if (score >= 50 || recurringPts > 0) return 'degrading';
  if (score >= 25 || recentEpPts > 0) return 'fragile';
  return 'stable';
}

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const rawHistory  = await readJsonSafe(historyPaths());
    const rawAudit    = await readJsonSafe(auditPaths());
    const rawEpisodes = await readJsonSafe(episodePaths());
    const rawOps      = await readJsonSafe(opsPaths());

    const history:  RunEntry[]  = Array.isArray(rawHistory)  ? rawHistory  as RunEntry[]  : [];
    const audit:    AuditEntry[] = Array.isArray(rawAudit)   ? rawAudit    as AuditEntry[] : [];
    const episodes: Episode[]   = Array.isArray(rawEpisodes) ? rawEpisodes as Episode[]   : [];
    const ops: OpsMode | null   = rawOps && typeof rawOps === 'object' && !Array.isArray(rawOps)
      ? rawOps as OpsMode : null;

    if (!history.length) {
      return NextResponse.json({
        ok: false,
        failure_risk_score: 0, failure_risk_label: 'low',
        predicted_mode: 'stable', top_risk_factors: [],
        inputs: { history: false, audit: !!audit.length, episodes: !!episodes.length, ops: !!ops },
        error: 'pipeline_history.json not available',
      });
    }

    const signals: [number, string, string][] = [
      sigRecentFailureRate(history),
      sigFailureStreak(history),
      sigActiveEpisode(episodes),
      sigRecentEpisode(episodes),
      sigRecurringRootCause(episodes),
      sigRetryFailureRate(audit),
      sigDurationAnomaly(history),
      sigManualAttention(ops),
      sigMaintenanceMode(ops),
    ];

    const rawScore    = signals.reduce((s, sig) => s + sig[0], 0);
    const score       = Math.min(100, rawScore);
    const activeEpPts  = signals[2][0];
    const recentEpPts  = signals[3][0];
    const recurringPts = signals[4][0];

    const factors: RiskFactor[] = signals
      .filter(s => s[0] > 0)
      .map(s => ({ signal: s[1], description: s[2], points: s[0] }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 3);

    return NextResponse.json({
      ok:                 true,
      failure_risk_score: score,
      failure_risk_label: riskLabel(score),
      predicted_mode:     predictedMode(score, activeEpPts, recentEpPts, recurringPts),
      top_risk_factors:   factors,
      inputs: {
        history_runs:         history.length,
        audit_entries:        audit.length,
        episode_count:        episodes.length,
        ops_mode_enabled:     !!(ops?.enabled),
        history_window:       HISTORY_WINDOW,
        episode_window_days:  EPISODE_WINDOW,
      },
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      failure_risk_score: 0, failure_risk_label: 'low',
      predicted_mode: 'stable', top_risk_factors: [],
      inputs: {}, error: String(err),
    });
  }
}
