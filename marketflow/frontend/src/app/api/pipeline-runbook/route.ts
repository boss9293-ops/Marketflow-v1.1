import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// ── types ──────────────────────────────────────────────────────────────────────

interface RunEntry { timestamp: string; status: string; duration_sec?: number | null; scripts_failed?: number; }
interface AuditEntry { run_timestamp: string; total_attempts?: number; recovered?: number; }
interface Episode {
  episode_id: string; status: 'active' | 'resolved';
  start_time: string; end_time: string | null;
  duration_runs: number; failure_count: number; retry_count: number;
  scripts_failed_peak: number; root_cause: string; severity: string;
}
interface OpsMode {
  enabled: boolean; reason?: string;
  force_manual_attention_scripts?: string[];
  force_skip_scripts?: string[];
}
interface PredictiveResponse {
  ok: boolean; failure_risk_score: number; failure_risk_label: string; predicted_mode: string;
}
interface Action { action_id: string; category: string; priority: string; title: string; description: string; }

// ── path candidates ────────────────────────────────────────────────────────────

const cwd = process.cwd();
const resolve = (...p: string[]) => path.resolve(cwd, ...p);

function histPaths()      { return [resolve('..','backend','output','pipeline_history.json'), resolve('backend','output','pipeline_history.json')]; }
function episodePaths()   { return [resolve('..','backend','output','cache','pipeline_episode_log.json'), resolve('backend','output','cache','pipeline_episode_log.json')]; }
function opsPaths()       { return [resolve('..','backend','output','cache','pipeline_ops_mode.json'), resolve('backend','output','cache','pipeline_ops_mode.json')]; }
function auditPaths()     { return [resolve('..','backend','output','cache','pipeline_retry_audit.json'), resolve('backend','output','cache','pipeline_retry_audit.json')]; }
function predictivePaths(){ return [resolve('..','backend','output','cache','pipeline_predictive_cache.json'), resolve('backend','output','cache','pipeline_predictive_cache.json')]; }

async function readJson(candidates: string[]): Promise<unknown> {
  for (const p of candidates) { try { return JSON.parse(await fs.readFile(p,'utf-8')); } catch {} }
  return null;
}

// ── helpers ────────────────────────────────────────────────────────────────────

const PRIORITY_RANK: Record<string,number> = { low:0, medium:1, high:2, critical:3 };

function daysAgo(ts: string|null|undefined): number {
  if (!ts) return 9999;
  try { const d = new Date(ts); return isNaN(d.getTime()) ? 9999 : (Date.now()-d.getTime())/86_400_000; }
  catch { return 9999; }
}

function isFailure(r: RunEntry): boolean {
  return r.status !== 'success' || Number(r.scripts_failed??0) > 0;
}

// ── fallback predictive (lightweight recompute if cache unavailable) ───────────

function computeScoreFromHistory(history: RunEntry[], episodes: Episode[]): PredictiveResponse {
  const recent   = history.slice(0, 10);
  const nFail    = recent.filter(isFailure).length;
  const pct      = recent.length ? nFail / recent.length : 0;
  let   score    = pct === 0 ? 0 : pct <= 0.20 ? 8 : pct <= 0.40 ? 15 : pct <= 0.60 ? 22 : 30;

  let streak = 0;
  for (const r of history) { if (isFailure(r)) streak++; else break; }
  score += streak === 0 ? 0 : streak === 1 ? 10 : streak === 2 ? 18 : 25;

  const activeEp = episodes[0]?.status === 'active' ? episodes[0] : null;
  if (activeEp) score += {low:8,medium:14,high:18,critical:20}[activeEp.severity]??8;

  const resolved = episodes.filter(e=>e.status==='resolved');
  if (resolved[0]) {
    const d=daysAgo(resolved[0].end_time??resolved[0].start_time), s=resolved[0].severity;
    if (d<=14) score += s==='critical'?(d<=7?15:10):s==='high'?(d<=7?12:8):s==='medium'?(d<=7?8:5):4;
  }

  score = Math.min(100, score);
  const label  = score>=75?'high':score>=50?'elevated':score>=25?'watch':'low';
  const activeP = activeEp?.severity;
  const mode   = (score>=75||activeEp)?'at_risk':(score>=50)?'degrading':(score>=25)?'fragile':'stable';
  return { ok: true, failure_risk_score: score, failure_risk_label: label, predicted_mode: mode };
}

// ── rule functions ─────────────────────────────────────────────────────────────

type Ctx = {
  score:number; label:string; mode:string; activeEp:Episode|null; recentEp:Episode|null;
  recentEpDays:number; recurringCause:string|null; recurringCount:number;
  retryRate:number|null; retryAttempted:number; ops:OpsMode|null;
  maintenanceOn:boolean; manualScripts:string[]; skipScripts:string[];
  lastRun:RunEntry|null; lastFailedCount:number; streak:number;
  durationSpike:number|null; historyLen:number; episodeCount:number;
};

function ruleActiveIncidentCritical(c:Ctx):Action|null {
  if (!c.activeEp||!['critical','high'].includes(c.activeEp.severity)) return null;
  const ep=c.activeEp, sev=ep.severity;
  return { action_id:'investigate_active_incident', category:'manual_investigation', priority:'critical',
    title:`Investigate active ${sev} incident immediately`,
    description:`Episode ${ep.episode_id} open since ${ep.start_time.slice(0,16)} — ${ep.duration_runs} runs, ${ep.failure_count} failures, root cause: ${ep.root_cause}. Review run logs now and identify failing scripts.` };
}

function ruleManualAttentionScripts(c:Ctx):Action|null {
  const s=c.manualScripts; if(!s.length) return null;
  const names=s.slice(0,4).join(', ')+(s.length>4?` (+${s.length-4} more)`:'');
  return { action_id:'review_manual_attention_scripts', category:'manual_investigation', priority:'critical',
    title:`Review ${s.length} manually-flagged script${s.length!==1?'s':''}`,
    description:`Operator has flagged ${names} for manual attention. These scripts are excluded from auto-retry. Investigate failure cause before re-queueing.` };
}

function ruleSuggestMaintenanceMode(c:Ctx):Action|null {
  if(c.maintenanceOn||c.score<75) return null;
  return { action_id:'enable_maintenance_mode', category:'maintenance_control', priority:'critical',
    title:'Enable maintenance mode to halt auto-retry',
    description:`Risk score is ${c.score}/100 (${c.label}). Auto-retry under sustained failures can amplify load. Enable maintenance mode via the Operator Mode card while investigating.` };
}

function ruleActiveIncidentModerate(c:Ctx):Action|null {
  if(!c.activeEp||!['low','medium'].includes(c.activeEp.severity)) return null;
  const ep=c.activeEp, sev=ep.severity;
  return { action_id:'monitor_active_incident', category:'manual_investigation', priority:'high',
    title:`Monitor active ${sev} incident`,
    description:`Episode ${ep.episode_id} has been open for ${ep.duration_runs} run(s) with ${ep.failure_count} failure(s). Root cause: ${ep.root_cause}. Verify next scheduled run resolves the issue.` };
}

function ruleRecurringRootCause(c:Ctx):Action|null {
  if(!c.recurringCause) return null;
  const note=['systemic','recurring'].includes(c.recurringCause)
    ?'This pattern is structural — check shared dependencies or config drift.'
    :'Intermittent failures at this frequency may indicate an unstable dependency.';
  return { action_id:'investigate_recurring_pattern', category:'manual_investigation', priority:'high',
    title:`Investigate recurring "${c.recurringCause}" root cause`,
    description:`Root cause "${c.recurringCause}" has appeared in ${c.recurringCount} episodes within the last 30 days. ${note}` };
}

function ruleDataIntegrity(c:Ctx):Action|null {
  const ep=c.activeEp??c.recentEp;
  const peak=ep?.scripts_failed_peak??0;
  if(c.score<50&&peak<5) return null;
  const trigger=c.score>=50?`risk score ${c.score}/100`:`${peak} scripts affected at episode peak`;
  return { action_id:'verify_data_integrity', category:'data_integrity', priority:'high',
    title:'Verify output data integrity',
    description:`Elevated failure level (${trigger}) may have left output files incomplete. Run a spot-check on key JSON outputs (pipeline_history, risk_v1, market_health) to confirm valid schemas and current timestamps.` };
}

function ruleReviewMaintenanceModeOff(c:Ctx):Action|null {
  if(!c.maintenanceOn||c.score>=50) return null;
  const reason=c.ops?.reason??'no reason recorded';
  return { action_id:'disable_maintenance_mode', category:'maintenance_control', priority:'high',
    title:'Consider disabling maintenance mode',
    description:`Maintenance mode is active ("${reason}") but risk score is ${c.score}/100 (${c.label}) — pipeline looks relatively healthy. Re-enable auto-retry once the issue is confirmed resolved.` };
}

function ruleFailedScriptsLastRun(c:Ctx):Action|null {
  const n=c.lastFailedCount; if(!n) return null;
  const ts=c.lastRun?.timestamp?.slice(0,16)??'?';
  return { action_id:'check_last_run_failures', category:'dependency_check', priority:'medium',
    title:`Investigate ${n} failed script${n!==1?'s':''} in last run`,
    description:`Last run at ${ts} had ${n} failed script${n!==1?'s':''}. Check run log for error details. Verify data source availability and authentication tokens are current.` };
}

function ruleRetryRecoveryPoor(c:Ctx):Action|null {
  const r=c.retryRate; if(r===null||r>=0.80) return null;
  const rec=Math.round(r*c.retryAttempted);
  return { action_id:'review_retry_policy', category:'retry_policy', priority:'medium',
    title:'Review retry policy — low recovery rate',
    description:`Retry recovery rate is ${Math.round(r*100)}% (${rec}/${c.retryAttempted} attempts recovered). Consider increasing cooldown between retries or reducing max_retry_per_script for scripts with structural failures.` };
}

function rulePostIncidentMonitor(c:Ctx):Action|null {
  const ep=c.recentEp, d=c.recentEpDays;
  if(!ep||d>3||c.activeEp) return null;
  return { action_id:'monitor_post_incident', category:'monitor', priority:'medium',
    title:`Monitor post-incident recovery (${ep.severity} episode resolved ${d.toFixed(1)}d ago)`,
    description:`Episode ${ep.episode_id} resolved ${d.toFixed(1)}d ago. Confirm the next 2-3 pipeline runs complete cleanly before declaring full recovery. Watch for recurrence of the same root cause.` };
}

function ruleDurationSpike(c:Ctx):Action|null {
  const s=c.durationSpike; if(s===null||s<0.50) return null;
  return { action_id:'investigate_duration_spike', category:'dependency_check', priority:'medium',
    title:`Investigate duration spike (+${Math.round(s*100)}% over median)`,
    description:`Last run took significantly longer than the recent median. This may indicate a slow upstream API, network congestion, or a script entering a retry loop. Check run logs for unusually long-running steps.` };
}

function ruleSkipScriptsActive(c:Ctx):Action|null {
  const s=c.skipScripts; if(!s.length) return null;
  const names=s.slice(0,3).join(', ')+(s.length>3?` (+${s.length-3} more)`:'');
  return { action_id:'review_skip_scripts', category:'retry_policy', priority:'medium',
    title:`Review force-skipped script${s.length!==1?'s':''}`,
    description:`${s.length} script${s.length!==1?' are':' is'} permanently force-skipped: ${names}. Confirm these exclusions are still intentional and that downstream consumers do not depend on their output.` };
}

function ruleWatchFailureRate(c:Ctx):Action|null {
  if(c.score===0||c.score>=50) return null;
  return { action_id:'watch_failure_rate', category:'monitor', priority:'low',
    title:`Watch failure rate — risk score ${c.score} (${c.label})`,
    description:`Risk score is ${c.score}/100 (${c.label}) — below action threshold but above baseline. Continue monitoring. If score rises above 50, escalate to dependency check and data integrity verification.` };
}

function ruleAllClear(c:Ctx):Action|null {
  if(c.score>0||c.activeEp||c.streak>0) return null;
  return { action_id:'routine_monitor', category:'monitor', priority:'low',
    title:'Routine monitoring — pipeline healthy',
    description:`No risk signals detected across ${c.historyLen} recent run(s). Pipeline is operating normally. No operator action required.` };
}

const RULES = [
  ruleActiveIncidentCritical, ruleManualAttentionScripts, ruleSuggestMaintenanceMode,
  ruleActiveIncidentModerate, ruleRecurringRootCause, ruleDataIntegrity,
  ruleReviewMaintenanceModeOff, ruleFailedScriptsLastRun, ruleRetryRecoveryPoor,
  rulePostIncidentMonitor, ruleDurationSpike, ruleSkipScriptsActive,
  ruleWatchFailureRate, ruleAllClear,
];

// ── context builder ────────────────────────────────────────────────────────────

function buildContext(
  pred: PredictiveResponse, history: RunEntry[], episodes: Episode[],
  ops: OpsMode|null, audit: AuditEntry[]
): Ctx {
  const activeEp  = episodes[0]?.status==='active' ? episodes[0] : null;
  const resolved  = episodes.filter(e=>e.status==='resolved');
  const recentEp  = resolved[0]??null;
  const recentEpDays = daysAgo(recentEp?.end_time??recentEp?.start_time);

  // Recurring root cause (30d window)
  const recent30  = episodes.filter(e=>daysAgo(e.start_time)<=30);
  const causeFreq: Record<string,number> = {};
  for (const e of recent30) causeFreq[e.root_cause]=(causeFreq[e.root_cause]??0)+1;
  let recurringCause:string|null=null, recurringCount=0;
  for (const [c,n] of Object.entries(causeFreq)) {
    if(n>=2&&['systemic','recurring','intermittent'].includes(c)) {
      if(n>recurringCount||(n===recurringCount&&PRIORITY_RANK[c]>PRIORITY_RANK[recurringCause??'transient'])) {
        recurringCause=c; recurringCount=n;
      }
    }
  }

  const retried     = audit.filter(e=>Number(e.total_attempts??0)>0);
  const retryAttempted = retried.reduce((s,e)=>s+Number(e.total_attempts??0),0);
  const retryRecovered = retried.reduce((s,e)=>s+Number(e.recovered??0),0);
  const retryRate   = retryAttempted>0 ? retryRecovered/retryAttempted : null;

  const lastRun = history[0]??null;
  const lastFailedCount = Number(lastRun?.scripts_failed??0);

  let streak=0;
  for (const r of history) { if(isFailure(r)) streak++; else break; }

  const durations = history.slice(0,10).map(r=>r.duration_sec).filter((d):d is number=>d!==null&&d!==undefined&&!isNaN(d));
  let durationSpike:number|null=null;
  if(durations.length>=3){
    const sorted=[...durations.slice(1)].sort((a,b)=>a-b);
    const mid=Math.floor(sorted.length/2);
    const median=sorted.length%2!==0?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;
    if(median>0) durationSpike=(durations[0]-median)/median;
  }

  return {
    score: pred.failure_risk_score, label: pred.failure_risk_label, mode: pred.predicted_mode,
    activeEp, recentEp, recentEpDays, recurringCause, recurringCount,
    retryRate, retryAttempted, ops, maintenanceOn: !!(ops?.enabled),
    manualScripts: ops?.force_manual_attention_scripts??[],
    skipScripts:   ops?.force_skip_scripts??[],
    lastRun, lastFailedCount, streak, durationSpike,
    historyLen: history.length, episodeCount: episodes.length,
  };
}

// ── classification ─────────────────────────────────────────────────────────────

function runbookState(actions: Action[]): string {
  if (!actions.length) return 'normal';
  const top = Math.max(...actions.map(a=>PRIORITY_RANK[a.priority]??0));
  return {3:'manual_required',2:'intervene',1:'observe',0:'normal'}[top] ?? 'normal';
}

function overallPriority(state: string): string {
  return {manual_required:'critical',intervene:'high',observe:'medium',normal:'low'}[state]??'low';
}

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const [rawHist, rawEps, rawOps, rawAudit] = await Promise.all([
      readJson(histPaths()), readJson(episodePaths()),
      readJson(opsPaths()), readJson(auditPaths()),
    ]);

    const history:  RunEntry[]  = Array.isArray(rawHist) ? rawHist  as RunEntry[]  : [];
    const episodes: Episode[]   = Array.isArray(rawEps)  ? rawEps   as Episode[]   : [];
    const ops:      OpsMode|null= rawOps&&typeof rawOps==='object'&&!Array.isArray(rawOps) ? rawOps as OpsMode : null;
    const audit:    AuditEntry[] = Array.isArray(rawAudit) ? rawAudit as AuditEntry[] : [];

    if (!history.length) {
      return NextResponse.json({ ok: false, runbook_state:'normal', priority:'low',
        recommended_actions:[], inputs:{}, error:'pipeline_history.json not available' });
    }

    // Use backend predictive cache if available, else recompute
    const rawPred = await readJson(predictivePaths());
    const pred: PredictiveResponse =
      rawPred && typeof rawPred==='object' && !Array.isArray(rawPred) && (rawPred as any).ok
        ? rawPred as PredictiveResponse
        : computeScoreFromHistory(history, episodes);

    const ctx     = buildContext(pred, history, episodes, ops, audit);
    const seen    = new Set<string>();
    const actions: Action[] = [];
    for (const rule of RULES) {
      const act = rule(ctx);
      if (!act || seen.has(act.action_id)) continue;
      seen.add(act.action_id); actions.push(act);
    }
    actions.sort((a,b) => (PRIORITY_RANK[b.priority]??0)-(PRIORITY_RANK[a.priority]??0));

    const state = runbookState(actions);
    return NextResponse.json({
      ok:                  true,
      runbook_state:       state,
      priority:            overallPriority(state),
      recommended_actions: actions,
      inputs: {
        predictive_score:        pred.failure_risk_score,
        predictive_label:        pred.failure_risk_label,
        predicted_mode:          pred.predicted_mode,
        active_episode:          ctx.activeEp?.episode_id??null,
        episode_count:           ctx.episodeCount,
        ops_mode_enabled:        ctx.maintenanceOn,
        manual_attention_count:  ctx.manualScripts.length,
        history_runs:            ctx.historyLen,
      },
    });
  } catch(err) {
    return NextResponse.json({ ok:false, runbook_state:'normal', priority:'low',
      recommended_actions:[], inputs:{}, error:String(err) });
  }
}
