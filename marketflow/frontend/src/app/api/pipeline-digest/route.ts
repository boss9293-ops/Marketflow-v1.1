import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// ── types ──────────────────────────────────────────────────────────────────────

interface RunEntry   { timestamp: string; status: string; scripts_failed?: number; duration_sec?: number | null; }
interface Episode    { episode_id:string; status:'active'|'resolved'; start_time:string; end_time:string|null; duration_runs:number; failure_count:number; scripts_failed_peak?: number; severity:string; root_cause:string; }
interface OpsMode    { enabled:boolean; reason?:string; force_manual_attention_scripts?:string[]; force_skip_scripts?:string[]; }
interface AuditEntry { run_timestamp:string; total_attempts?:number; recovered?:number; }

// ── path helpers ───────────────────────────────────────────────────────────────

const cwd     = process.cwd();
const resolve = (...p: string[]) => path.resolve(cwd, ...p);

function histPaths()    { return [resolve('..','backend','output','pipeline_history.json'),          resolve('backend','output','pipeline_history.json')]; }
function episodePaths() { return [resolve('..','backend','output','cache','pipeline_episode_log.json'),   resolve('backend','output','cache','pipeline_episode_log.json')]; }
function opsPaths()     { return [resolve('..','backend','output','cache','pipeline_ops_mode.json'),      resolve('backend','output','cache','pipeline_ops_mode.json')]; }
function auditPaths()   { return [resolve('..','backend','output','cache','pipeline_retry_audit.json'),   resolve('backend','output','cache','pipeline_retry_audit.json')]; }
function predictivePaths() { return [resolve('..','backend','output','cache','pipeline_predictive_cache.json'), resolve('backend','output','cache','pipeline_predictive_cache.json')]; }

async function readJson(candidates: string[]): Promise<unknown> {
  for (const p of candidates) { try { return JSON.parse(await fs.readFile(p,'utf-8')); } catch {} }
  return null;
}

// ── helpers ────────────────────────────────────────────────────────────────────

function daysAgo(ts: string|null|undefined): number {
  if (!ts) return 9999;
  try { const d=new Date(ts); return isNaN(d.getTime())?9999:(Date.now()-d.getTime())/86_400_000; }
  catch { return 9999; }
}

function isFailure(r: RunEntry): boolean {
  return r.status !== 'success' || Number(r.scripts_failed??0) > 0;
}

// ── lightweight predictive recompute (fallback) ────────────────────────────────

function computeScoreFromHistory(history: RunEntry[], episodes: Episode[]): {
  failure_risk_score: number; failure_risk_label: string; predicted_mode: string;
} {
  const recent   = history.slice(0,10);
  const nFail    = recent.filter(isFailure).length;
  const pct      = recent.length ? nFail/recent.length : 0;
  let   score    = pct===0?0:pct<=0.20?8:pct<=0.40?15:pct<=0.60?22:30;
  let   streak   = 0;
  for (const r of history) { if(isFailure(r)) streak++; else break; }
  score += streak===0?0:streak===1?10:streak===2?18:25;
  const activeEp = episodes[0]?.status==='active'?episodes[0]:null;
  if (activeEp) score += ({low:8,medium:14,high:18,critical:20} as Record<string,number>)[activeEp.severity]??8;
  const resolved = episodes.filter(e=>e.status==='resolved');
  if (resolved[0]) {
    const d=daysAgo(resolved[0].end_time??resolved[0].start_time), s=resolved[0].severity;
    if(d<=14) score += s==='critical'?(d<=7?15:10):s==='high'?(d<=7?12:8):s==='medium'?(d<=7?8:5):4;
  }
  score = Math.min(100, score);
  const label = score>=75?'high':score>=50?'elevated':score>=25?'watch':'low';
  const mode  = (score>=75||activeEp)?'at_risk':score>=50?'degrading':score>=25?'fragile':'stable';
  return { failure_risk_score: score, failure_risk_label: label, predicted_mode: mode };
}

// ── runbook recompute (lightweight) ────────────────────────────────────────────

const PRIORITY_RANK: Record<string,number> = { low:0, medium:1, high:2, critical:3 };

function computeRunbookStateFromSignals(
  score: number, activeEp: Episode|null, recentEp: Episode|null,
  recentDays: number, streak: number, lastFailedCount: number,
  manualScripts: string[], maintenanceOn: boolean,
): { state: string; priority: string; topTitle: string|null } {
  // Mirror the priority rules: highest-priority signal wins for state
  let topRank = 0;
  let topTitle: string|null = null;

  const bump = (rank: number, title: string) => {
    if (rank > topRank) { topRank=rank; topTitle=title; }
  };

  if (activeEp && ['high','critical'].includes(activeEp.severity))
    bump(3, `Investigate active ${activeEp.severity} incident immediately`);
  if (manualScripts.length)
    bump(3, `Review ${manualScripts.length} manually-flagged script(s)`);
  if (!maintenanceOn && score>=75)
    bump(3, 'Enable maintenance mode to halt auto-retry');
  if (activeEp && ['low','medium'].includes(activeEp.severity))
    bump(2, `Monitor active ${activeEp.severity} incident`);
  if (score>=50 || (activeEp&&(activeEp.scripts_failed_peak??0)>=5))
    bump(2, 'Verify output data integrity');
  if (lastFailedCount>0)
    bump(1, `Investigate ${lastFailedCount} failed script(s) in last run`);
  if (recentEp && recentDays<=3 && !activeEp)
    bump(1, `Monitor post-incident recovery`);
  if (score>0 && score<50)
    bump(0, `Watch failure rate — risk score ${score}`);

  const state = topRank===3?'manual_required':topRank===2?'intervene':topRank===1?'observe':'normal';
  const priority = {manual_required:'critical',intervene:'high',observe:'medium',normal:'low'}[state]??'low';
  return { state, priority, topTitle };
}

// ── template builders ──────────────────────────────────────────────────────────

const MODE_LABEL: Record<string,string> = {
  stable:'stable mode', fragile:'fragile mode', degrading:'degrading mode', at_risk:'at-risk mode',
};

function buildSentence1(state:string, score:number, label:string, mode:string): string {
  const m = MODE_LABEL[mode]??`${mode} mode`;
  if (state==='normal')
    return 'Pipeline is operating normally.';
  if (state==='observe')
    return `Pipeline is in a ${label} state (risk score ${score}/100, ${m}).`;
  if (state==='intervene')
    return `Pipeline requires attention (risk score ${score}/100, ${m}).`;
  return `Pipeline requires immediate operator intervention (risk score ${score}/100).`;
}

function buildSentence2(activeEp:Episode|null, recentEp:Episode|null, recentDays:number): string|null {
  if (activeEp) {
    return `An active ${activeEp.severity} incident has been running for ${activeEp.duration_runs} run(s) with ${activeEp.failure_count} failure(s).`;
  }
  if (recentEp && recentDays<=3) {
    return `A ${recentEp.severity} incident resolved ${recentDays.toFixed(1)}d ago — monitor for recurrence.`;
  }
  return null;
}

function buildSentence3(state:string, topTitle:string|null): string {
  const t = topTitle ? (topTitle[0].toLowerCase()+topTitle.slice(1)) : 'the highest-priority issue';
  if (state==='normal')   return 'No action required — continue routine monitoring.';
  if (state==='observe')  return 'Monitor the next 2–3 runs and escalate if the failure rate increases.';
  if (state==='intervene') return `Investigate ${t} before the next scheduled run.`;
  return `Immediate operator action required: ${t}.`;
}

function buildHighlights(
  score:number, label:string, streak:number,
  activeEp:Episode|null, recentEp:Episode|null, recentDays:number,
  topTitle:string|null, historyLen:number,
): string[] {
  const items: string[] = [];
  items.push(`Risk score ${score}/100 — ${label}`);
  if (activeEp) {
    items.push(`Active ${activeEp.severity} incident (${activeEp.duration_runs} run(s) open)`);
  } else if (recentEp && recentDays<=3) {
    items.push(`${recentEp.severity.charAt(0).toUpperCase()+recentEp.severity.slice(1)} incident resolved ${recentDays.toFixed(1)}d ago`);
  } else if (streak>0) {
    items.push(`Current failure streak: ${streak} run(s)`);
  } else {
    items.push(`${Math.min(historyLen,20)} recent run(s) clean — no active incident`);
  }
  if (topTitle) {
    const priority = score>=75?'critical':score>=50?'high':score>=25?'medium':'low';
    items.push(`${priority.charAt(0).toUpperCase()+priority.slice(1)}: ${topTitle}`);
  }
  return items.slice(0,3);
}

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const [rawHist, rawEps, rawOps, rawAudit] = await Promise.all([
      readJson(histPaths()), readJson(episodePaths()),
      readJson(opsPaths()), readJson(auditPaths()),
    ]);

    const history:  RunEntry[]  = Array.isArray(rawHist)  ? rawHist  as RunEntry[]  : [];
    const episodes: Episode[]   = Array.isArray(rawEps)   ? rawEps   as Episode[]   : [];
    const ops:      OpsMode|null= (rawOps&&typeof rawOps==='object'&&!Array.isArray(rawOps)) ? rawOps as OpsMode : null;

    if (!history.length) {
      return NextResponse.json({
        ok:false, state:'normal', priority:'low',
        summary:'Digest unavailable — no pipeline history found.',
        highlights:[], inputs:{}, error:'pipeline_history.json not available',
      });
    }

    // Predictive score
    const rawPred = await readJson(predictivePaths());
    const pred = (rawPred&&typeof rawPred==='object'&&!Array.isArray(rawPred)&&(rawPred as any).ok)
      ? rawPred as {failure_risk_score:number; failure_risk_label:string; predicted_mode:string}
      : computeScoreFromHistory(history, episodes);

    const score = pred.failure_risk_score;
    const label = pred.failure_risk_label;
    const mode  = pred.predicted_mode;

    // Episodes
    const activeEp  = episodes[0]?.status==='active' ? episodes[0] : null;
    const resolved  = episodes.filter(e=>e.status==='resolved');
    const recentEp  = resolved[0]??null;
    const recentDays = recentEp ? daysAgo(recentEp.end_time??recentEp.start_time) : 9999;

    // Streak
    let streak=0;
    for (const r of history) { if(isFailure(r)) streak++; else break; }

    const lastFailedCount = Number(history[0]?.scripts_failed??0);
    const manualScripts   = ops?.force_manual_attention_scripts??[];
    const maintenanceOn   = !!(ops?.enabled);

    // Runbook state
    const { state, priority, topTitle } = computeRunbookStateFromSignals(
      score, activeEp, recentEp, recentDays, streak, lastFailedCount,
      manualScripts, maintenanceOn,
    );

    // Build summary
    const s1 = buildSentence1(state, score, label, mode);
    const s2 = buildSentence2(activeEp, recentEp, recentDays);
    const s3 = buildSentence3(state, topTitle);
    const summary = [s1, s2, s3].filter(Boolean).join(' ');

    const highlights = buildHighlights(
      score, label, streak, activeEp, recentEp, recentDays, topTitle, history.length,
    );

    return NextResponse.json({
      ok: true, state, priority, summary, highlights,
      inputs: {
        predictive_score: score,
        predictive_label: label,
        predicted_mode:   mode,
        runbook_state:    state,
        active_episode:   activeEp?.episode_id??null,
        recent_ep_days:   recentEp ? Math.round(recentDays*100)/100 : null,
        history_runs:     history.length,
      },
    });
  } catch(err) {
    return NextResponse.json({
      ok:false, state:'normal', priority:'low',
      summary:'Digest unavailable — internal error.',
      highlights:[], inputs:{}, error:String(err),
    });
  }
}
