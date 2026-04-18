import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

function collectOutputDirs(): string[] {
  const cwd = process.cwd();
  const roots: string[] = [cwd];
  let cursor = cwd;
  for (let i = 0; i < 6; i += 1) {
    const parent = path.dirname(cursor);
    if (!parent || parent === cursor) break;
    roots.push(parent);
    cursor = parent;
  }

  const out = new Set<string>();
  for (const root of roots) {
    out.add(path.resolve(root, 'backend', 'output'));
    out.add(path.resolve(root, 'marketflow', 'backend', 'output'));
    out.add(path.resolve(root, 'output'));
  }

  const envCandidates = [
    process.env.BACKEND_OUTPUT_DIR,
    process.env.MARKETFLOW_OUTPUT_DIR,
    process.env.OUTPUT_DIR,
  ].filter((v): v is string => !!v && String(v).trim().length > 0);
  for (const p of envCandidates) out.add(path.resolve(p));

  return Array.from(out);
}

const OUTPUT_DIRS = collectOutputDirs();

type CategoryId = 'DATA' | 'BUILD' | 'CACHE' | 'AI' | 'FRONTEND';

type ModuleDef = {
  id: string;
  file: string | string[];
  expected_interval: number;
  impact: string[];
  category: string;
  stage: CategoryId;
};

const MODULE_DEFS: ModuleDef[] = [
  { id: 'price_feed', file: ['cache/market_tape.json', 'market_tape.json'], expected_interval: 60, impact: ['risk_build', 'vr_build', 'dashboard'], category: 'Data Intake', stage: 'DATA' },
  { id: 'fred_macro', file: ['current_90d.json', 'cache/current_90d.json'], expected_interval: 1440, impact: ['macro_build', 'risk_build'], category: 'Data Intake', stage: 'DATA' },
  { id: 'volatility_feed', file: ['cache/market_tape.json', 'market_tape.json'], expected_interval: 60, impact: ['risk_build'], category: 'Data Intake', stage: 'DATA' },

  { id: 'macro_build', file: ['current_90d.json', 'cache/current_90d.json'], expected_interval: 1440, impact: ['risk_build', 'dashboard'], category: 'Build Layer', stage: 'BUILD' },
  { id: 'risk_build', file: ['risk_v1.json', 'cache/risk_v1.json'], expected_interval: 1440, impact: ['vr_build', 'ai_std_risk', 'ai_integrated'], category: 'Build Layer', stage: 'BUILD' },
  { id: 'vr_build', file: ['vr_survival.json', 'cache/vr_survival.json'], expected_interval: 1440, impact: ['dashboard'], category: 'Build Layer', stage: 'BUILD' },
  { id: 'soxx_context', file: ['soxx_context.json', 'cache/soxx_context.json'], expected_interval: 1440, impact: ['frontend_api', 'dashboard'], category: 'Build Layer', stage: 'BUILD' },
  { id: 'snapshot_build', file: ['snapshots_full_5y.json', 'cache/snapshots_full_5y.json'], expected_interval: 1440, impact: ['dashboard'], category: 'Build Layer', stage: 'BUILD' },

  { id: 'ai_std_risk', file: ['ai/std_risk/latest.json', 'cache/ai/std_risk/latest.json'], expected_interval: 720, impact: ['dashboard_ai'], category: 'AI Layer', stage: 'AI' },
  { id: 'ai_macro', file: ['ai/macro/latest.json', 'cache/ai/macro/latest.json'], expected_interval: 720, impact: ['macro_ai'], category: 'AI Layer', stage: 'AI' },
  { id: 'ai_integrated', file: ['ai/integrated/latest.json', 'cache/ai/integrated/latest.json'], expected_interval: 720, impact: ['briefing_api', 'dashboard_ai'], category: 'AI Layer', stage: 'AI' },

  { id: 'risk_v1.json', file: ['risk_v1.json', 'cache/risk_v1.json'], expected_interval: 1440, impact: ['frontend_api'], category: 'Cache Layer', stage: 'CACHE' },
  { id: 'vr_survival.json', file: ['vr_survival.json', 'cache/vr_survival.json'], expected_interval: 1440, impact: ['frontend_api'], category: 'Cache Layer', stage: 'CACHE' },
  { id: 'overview.json', file: ['cache/overview_home.json', 'cache/overview.json'], expected_interval: 1440, impact: ['frontend_api'], category: 'Cache Layer', stage: 'CACHE' },
];

async function getFileStat(filename: string | string[]) {
  const candidates = Array.isArray(filename) ? filename : [filename];
  for (const relFile of candidates) {
    for (const dir of OUTPUT_DIRS) {
      try {
        const fullPath = path.join(dir, relFile);
        const stat = await fs.stat(fullPath);
        return { path: fullPath, stat, exists: true, matched: relFile };
      } catch {
        // try next
      }
    }
  }
  return { path: null, stat: null, exists: false, matched: null };
}

function generateMaintenanceGuide(name: string, status: string, impact: string[]) {
  if (name.includes('price') || name.includes('volatility') || name.includes('fred')) {
    return {
      issue_summary: status === 'RED' ? `${name} data missing` : `${name} data stale`,
      possible_causes: ['API request failed', 'Rate limit exceeded', 'Collector stopped'],
      check_steps: ['Check the latest fetch log', 'Verify API keys and quota', 'Confirm the cache file exists'],
      related_files: ['collectors', 'backend/output/...'],
      impact,
    };
  }

  if (name.includes('vr_build') || name.includes('vr_survival')) {
    return {
      issue_summary: status === 'RED' ? 'VR output not generated' : 'VR output stale',
      possible_causes: ['risk_v1 missing', 'build script failure', 'dependency mismatch'],
      check_steps: ['Check risk_v1.json timestamp', 'Review vr build logs', 'Confirm the output file exists'],
      related_files: ['build_execution_playback.ts', 'vr_survival.json'],
      impact,
    };
  }

  if (name.includes('risk')) {
    return {
      issue_summary: 'Risk output missing or delayed',
      possible_causes: ['upstream input missing', 'build script failed', 'schema mismatch'],
      check_steps: ['Verify input timestamps', 'Check the build log', 'Confirm schema validation passes'],
      related_files: ['backend/output/risk_v1.json', 'backend/scripts/build_risk_v1.py'],
      impact,
    };
  }

  if (name.includes('soxx') || name.includes('soxl')) {
    return {
      issue_summary: `${name} semiconductor context missing or stale`,
      possible_causes: ['ohlcv_daily missing SOXX rows', 'build script failed', 'DB sync lag', 'schema mismatch'],
      check_steps: ['Check SOXX rows in ohlcv_daily', 'Run backend/scripts/build_soxx_context.py', 'Confirm backend/output/soxx_context.json exists'],
      related_files: ['backend/output/soxx_context.json', 'backend/scripts/build_soxx_context.py'],
      impact,
    };
  }

  if (name.includes('ai')) {
    const aiLayer = name.includes('macro') ? 'macro' : name.includes('integrated') ? 'integrated' : 'std_risk';
    return {
      issue_summary: `${name} AI cache stale or missing`,
      possible_causes: ['scheduler did not fire', 'provider key missing', 'JSON schema drift', 'provider latency spike'],
      check_steps: ['Confirm latest.json timestamp', 'Review build_ai_briefings.py logs', 'Verify provider keys', 'Re-run python backend/scripts/build_ai_briefings.py'],
      related_files: ['backend/scripts/build_ai_briefings.py', `backend/output/ai/${aiLayer}/latest.json`],
      impact,
    };
  }

  return {
    issue_summary: `${name} output stale or missing`,
    possible_causes: ['Unknown upstream failure', 'Internal script error'],
    check_steps: ['Check system logs', 'View pipeline history'],
    related_files: [`backend/output/${name}`],
    impact,
  };
}

function calculateSeverity(status: string, name: string) {
  if (status === 'RED') {
    if (name.includes('risk') || name.includes('price')) return 'CRITICAL';
    return 'HIGH';
  }
  if (status === 'YELLOW') return 'MEDIUM';
  if (status === 'GREEN') return 'LOW';
  return 'GRAY';
}

function computeDelayMinutes(mtimeMs: number): number {
  return Math.floor((Date.now() - mtimeMs) / (1000 * 60));
}

export async function GET() {
  try {
    const modulesOutput: any[] = [];
    const errorsOutput: any[] = [];
    let staleCount = 0;
    let failedCount = 0;
    const criticalFailures: string[] = [];
    const allImpacts = new Set<string>();

    for (const def of MODULE_DEFS) {
      const { path: filePath, stat, exists } = await getFileStat(def.file);
      let status = 'GRAY';
      let delayMinutes = 0;
      let lastUpdated: string | null = null;
      let reason = 'File not found';
      let silentFailure = false;

      if (exists && stat) {
        lastUpdated = new Date(stat.mtimeMs).toISOString();
        delayMinutes = computeDelayMinutes(stat.mtimeMs);
        if (delayMinutes <= def.expected_interval) {
          status = 'GREEN';
          reason = 'On time';
        } else if (delayMinutes <= def.expected_interval * 2) {
          status = 'YELLOW';
          reason = `${delayMinutes}m delay (expected < ${def.expected_interval}m)`;
          staleCount++;
        } else {
          status = 'RED';
          reason = `Stale by ${delayMinutes}m (expected < ${def.expected_interval}m)`;
          staleCount++;
          failedCount++;
          errorsOutput.push({
            module: def.id,
            severity: calculateSeverity('RED', def.id),
            type: 'stale_data',
            message: reason,
            time: new Date().toISOString(),
            pipeline_stage: def.stage,
            blocks: def.impact,
          });
        }

        if (filePath && def.id.includes('risk_v1')) {
          try {
            const content = await fs.readFile(filePath, 'utf8');
            if (content.length < 50) silentFailure = true;
          } catch {
            // ignore read issues
          }
        }
      } else {
        status = 'RED';
        failedCount++;
        errorsOutput.push({
          module: def.id,
          severity: calculateSeverity('RED', def.id),
          type: 'file_not_found',
          message: `Expected file ${Array.isArray(def.file) ? def.file.join(' OR ') : def.file} not found`,
          time: new Date().toISOString(),
          pipeline_stage: def.stage,
          blocks: def.impact,
        });
      }

      const severity = calculateSeverity(status, def.id);
      modulesOutput.push({
        name: def.id,
        category: def.category,
        status,
        severity,
        silent_failure: silentFailure,
        last_updated: lastUpdated,
        expected_interval: def.expected_interval,
        delay: delayMinutes,
        impact: def.impact,
        reason,
        maintenance: generateMaintenanceGuide(def.id, status, def.impact),
      });

      if (status === 'RED' || status === 'YELLOW') {
        if (severity === 'CRITICAL' || severity === 'HIGH') {
          criticalFailures.push(`${def.id} ${status === 'RED' ? 'failed/missing' : 'stale'}`);
        }
        def.impact.forEach((imp) => allImpacts.add(imp));
      }
    }

    let pipelineStatus = { status: 'unknown', last_run_at: null as string | null, duration_sec: 0, scripts_ok: 0 };
    const { path: pStatusPath, exists: pExists } = await getFileStat('pipeline_status.json');
    if (pExists && pStatusPath) {
      try {
        pipelineStatus = JSON.parse(await fs.readFile(pStatusPath, 'utf8'));
      } catch {
        // ignore
      }
    }

    const systemStatus = failedCount > 0 ? 'RED' : staleCount > 0 ? 'YELLOW' : 'GREEN';

    return NextResponse.json({
      system: {
        status: systemStatus,
        summary:
          failedCount > 0
            ? `${failedCount} modules failed, ${staleCount} stale`
            : staleCount > 0
              ? `${staleCount} modules delayed`
              : 'SYSTEM OK',
        failed_modules: failedCount,
        stale_modules: staleCount,
        alerts: errorsOutput.length,
        last_full_pipeline_run: pipelineStatus.last_run_at || new Date().toISOString(),
        top_causes: criticalFailures.slice(0, 3),
        critical_blockers: modulesOutput.filter((m) => m.severity === 'CRITICAL' && m.status === 'RED').map((m) => m.name),
        impacted_areas: Array.from(allImpacts),
      },
      pipeline: [
        {
          name: 'Main Pipeline',
          status:
            pipelineStatus.status === 'success'
              ? 'GREEN'
              : pipelineStatus.status === 'failure'
                ? 'RED'
                : 'GRAY',
          last_run: pipelineStatus.last_run_at || '--',
          duration_ms: (pipelineStatus.duration_sec || 0) * 1000,
          success_rate_24h: (pipelineStatus.scripts_ok || 0) / (MODULE_DEFS.length || 1),
          dependency_status: 'OK',
        },
      ],
      modules: modulesOutput,
      errors: errorsOutput,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
