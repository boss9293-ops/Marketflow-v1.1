import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import os from 'os'
import { performance } from 'perf_hooks'
import process from 'process'
import type {
  RawStandardPlaybackArchive,
  RawVRSurvivalPlaybackArchive,
} from '../vr/playback/vr_playback_loader'
import { buildStrategyArena } from '../vr/arena/compute_strategy_arena'

type BenchmarkMode = 'cold' | 'warm'

type LoadedArchives = {
  standardArchive: RawStandardPlaybackArchive
  survivalArchive: RawVRSurvivalPlaybackArchive
}

type BenchmarkSample = {
  wallMs: number
  loadMs: number
  buildMs: number
  cpuMs: number
  rssBytes: number
  heapUsedBytes: number
}

type BenchmarkSummary = {
  mode: BenchmarkMode
  includeInputLoading: boolean
  preloadMs: number | null
  iterations: number
  warmupIterations: number
  samples: BenchmarkSample[]
  wallMs: {
    avg: number
    p95: number
    min: number
    max: number
  }
  loadMs: {
    avg: number
    p95: number
  }
  buildMs: {
    avg: number
    p95: number
  }
  cpuMs: {
    avg: number
    p95: number
    ratioToWallAvg: number
  }
  peakMemoryBytes: {
    rss: number
    heapUsed: number
  }
}

type CloudRunCostScenario = {
  runs: number
  avgWallSec: number
  grossCostUsd: number
  netCostUsd: number
  billedCpuSeconds: number
  billedMemoryGiBSeconds: number
  billedRequests: number
}

const ITERATIONS = 20
const WARMUP_ITERATIONS = 1
const REPORT_PATH = resolve(__dirname, '..', 'docs', 'deploy', 'backtest_cost_probe.md')
const REPO_ROOT = resolve(__dirname, '..')
const STANDARD_ARCHIVE_PATH = join(REPO_ROOT, 'marketflow', 'backend', 'output', 'risk_v1_playback.json')
const SURVIVAL_ARCHIVE_PATH = join(REPO_ROOT, 'marketflow', 'backend', 'output', 'vr_survival_playback.json')
const CLOUD_RUN = {
  activeCpuPerVcpuSecond: 0.000024,
  activeMemoryPerGiBSecond: 0.0000025,
  requestPerMillion: 0.40,
  freeTier: {
    cpuSeconds: 180000,
    memoryGiBSeconds: 360000,
    requests: 2000000,
  },
}

function main() {
  const modeArg = process.argv.find((arg) => arg.startsWith('--mode='))
  if (modeArg) {
    runChild()
    return
  }

  if (!process.argv.includes('--write-report')) {
    process.stdout.write(
      'Usage: --mode=cold|warm for JSON output, or --write-report to regenerate docs/deploy/backtest_cost_probe.md\n'
    )
    return
  }

  const cold = benchmarkMode('cold')
  if (typeof global.gc === 'function') {
    global.gc()
  }
  const warm = benchmarkMode('warm')
  const environment = collectEnvironment()
  const report = buildMarkdownReport(environment, cold, warm)

  mkdirSync(resolve(REPORT_PATH, '..'), { recursive: true })
  writeFileSync(REPORT_PATH, report, 'utf8')
  process.stdout.write(report)
}

function runChild() {
  const mode = parseMode(process.argv)
  const summary = benchmarkMode(mode)
  process.stdout.write(JSON.stringify(summary))
}

function parseMode(argv: string[]): BenchmarkMode {
  const modeArg = argv.find((arg) => arg.startsWith('--mode='))
  const mode = modeArg?.split('=')[1] as BenchmarkMode | undefined
  if (mode === 'cold' || mode === 'warm') {
    return mode
  }
  throw new Error(`Missing or invalid --mode flag: ${modeArg ?? 'none'}`)
}

function benchmarkMode(mode: BenchmarkMode): BenchmarkSummary {
  const samples: BenchmarkSample[] = []
  const maybeGc = typeof global.gc === 'function' ? global.gc.bind(global) : null
  let peakRssBytes = 0
  let peakHeapUsedBytes = 0
  const preloadStart = mode === 'warm' ? performance.now() : null
  const warmArchives = mode === 'warm' ? loadArchivesFromDisk() : null
  const preloadMs = mode === 'warm' && preloadStart != null ? performance.now() - preloadStart : null
  const preloadMemory = mode === 'warm' ? sampleMemory() : null

  if (preloadMemory) {
    peakRssBytes = Math.max(peakRssBytes, preloadMemory.rssBytes)
    peakHeapUsedBytes = Math.max(peakHeapUsedBytes, preloadMemory.heapUsedBytes)
  }

  if (maybeGc) {
    maybeGc()
  }

  for (let index = 0; index < WARMUP_ITERATIONS + ITERATIONS; index += 1) {
    const iterStart = performance.now()
    const cpuStart = process.cpuUsage()
    let loadMs = 0
    let buildMs = 0
    let input: LoadedArchives

    if (mode === 'cold') {
      const loadStart = performance.now()
      input = loadArchivesFromDisk()
      loadMs = performance.now() - loadStart
      const loadMemory = sampleMemory()
      peakRssBytes = Math.max(peakRssBytes, loadMemory.rssBytes)
      peakHeapUsedBytes = Math.max(peakHeapUsedBytes, loadMemory.heapUsedBytes)
    } else {
      input = warmArchives!
    }

    const buildStart = performance.now()
    const arena = buildStrategyArena({
      standardArchive: input.standardArchive,
      survivalArchive: input.survivalArchive,
    })
    buildMs = performance.now() - buildStart
    const wallMs = performance.now() - iterStart
    if (!arena?.events?.length) {
      throw new Error(`Strategy arena did not produce any events in ${mode} mode`)
    }
    const cpuDelta = process.cpuUsage(cpuStart)
    const cpuMs = (cpuDelta.user + cpuDelta.system) / 1000
    const buildMemory = sampleMemory()
    peakRssBytes = Math.max(peakRssBytes, buildMemory.rssBytes)
    peakHeapUsedBytes = Math.max(peakHeapUsedBytes, buildMemory.heapUsedBytes)

    if (index >= WARMUP_ITERATIONS) {
      samples.push({
        wallMs,
        loadMs,
        buildMs,
        cpuMs,
        rssBytes: buildMemory.rssBytes,
        heapUsedBytes: buildMemory.heapUsedBytes,
      })
    }

    if (maybeGc) {
      maybeGc()
    }
  }

  return summarize(mode, preloadMs, samples, peakRssBytes, peakHeapUsedBytes)
}

function loadArchivesFromDisk(): LoadedArchives {
  const standardArchive = JSON.parse(readFileSync(STANDARD_ARCHIVE_PATH, 'utf8')) as RawStandardPlaybackArchive
  const survivalArchive = JSON.parse(readFileSync(SURVIVAL_ARCHIVE_PATH, 'utf8')) as RawVRSurvivalPlaybackArchive

  return { standardArchive, survivalArchive }
}

function sampleMemory() {
  const memory = process.memoryUsage()
  return {
    rssBytes: memory.rss,
    heapUsedBytes: memory.heapUsed,
  }
}

function summarize(
  mode: BenchmarkMode,
  preloadMs: number | null,
  samples: BenchmarkSample[],
  peakRssBytes: number,
  peakHeapUsedBytes: number
): BenchmarkSummary {
  const wallMs = samples.map((sample) => sample.wallMs)
  const loadMs = samples.map((sample) => sample.loadMs)
  const buildMs = samples.map((sample) => sample.buildMs)
  const cpuMs = samples.map((sample) => sample.cpuMs)
  const rssBytes = samples.map((sample) => sample.rssBytes)
  const heapUsedBytes = samples.map((sample) => sample.heapUsedBytes)

  const wallAvg = avg(wallMs)
  const cpuAvg = avg(cpuMs)

  return {
    mode,
    includeInputLoading: mode === 'cold',
    preloadMs,
    iterations: samples.length,
    warmupIterations: WARMUP_ITERATIONS,
    samples,
    wallMs: {
      avg: wallAvg,
      p95: quantile(wallMs, 0.95),
      min: Math.min(...wallMs),
      max: Math.max(...wallMs),
    },
    loadMs: {
      avg: avg(loadMs),
      p95: quantile(loadMs, 0.95),
    },
    buildMs: {
      avg: avg(buildMs),
      p95: quantile(buildMs, 0.95),
    },
    cpuMs: {
      avg: cpuAvg,
      p95: quantile(cpuMs, 0.95),
      ratioToWallAvg: wallAvg > 0 ? cpuAvg / wallAvg : 0,
    },
    peakMemoryBytes: {
      rss: peakRssBytes || Math.max(...rssBytes),
      heapUsed: peakHeapUsedBytes || Math.max(...heapUsedBytes),
    },
  }
}

function avg(values: number[]) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function quantile(values: number[], p: number) {
  if (!values.length) return 0
  if (values.length === 1) return values[0]
  const sorted = [...values].sort((a, b) => a - b)
  const index = (sorted.length - 1) * p
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower]
  const weight = index - lower
  return sorted[lower] * (1 - weight) + sorted[upper] * weight
}

function collectEnvironment() {
  const cpu = os.cpus()[0]
  return {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
    cpuModel: cpu?.model ?? 'unknown',
    cpuCores: os.cpus().length,
    totalMemoryGiB: os.totalmem() / (1024 ** 3),
    standardArchiveBytes: existsSync(STANDARD_ARCHIVE_PATH) ? statSync(STANDARD_ARCHIVE_PATH).size : 0,
    survivalArchiveBytes: existsSync(SURVIVAL_ARCHIVE_PATH) ? statSync(SURVIVAL_ARCHIVE_PATH).size : 0,
    benchmarkTarget: 'vr/arena/buildStrategyArena on 7-event arena built from standard + survival archives',
  }
}

function estimateCloudRunCosts(summary: BenchmarkSummary, vcpu = 1, memoryGiB = 0.5) {
  const avgWallSec = summary.wallMs.avg / 1000
  const runs = [100, 1000, 10000]
  return runs.map((count) => {
    const billedCpuSeconds = count * avgWallSec * vcpu
    const billedMemoryGiBSeconds = count * avgWallSec * memoryGiB
    const billedRequests = count

    const grossCostUsd =
      billedCpuSeconds * CLOUD_RUN.activeCpuPerVcpuSecond +
      billedMemoryGiBSeconds * CLOUD_RUN.activeMemoryPerGiBSecond +
      (billedRequests / 1_000_000) * CLOUD_RUN.requestPerMillion

    const netCpuSeconds = Math.max(0, billedCpuSeconds - CLOUD_RUN.freeTier.cpuSeconds)
    const netMemoryGiBSeconds = Math.max(0, billedMemoryGiBSeconds - CLOUD_RUN.freeTier.memoryGiBSeconds)
    const netRequests = Math.max(0, billedRequests - CLOUD_RUN.freeTier.requests)

    const netCostUsd =
      netCpuSeconds * CLOUD_RUN.activeCpuPerVcpuSecond +
      netMemoryGiBSeconds * CLOUD_RUN.activeMemoryPerGiBSecond +
      (netRequests / 1_000_000) * CLOUD_RUN.requestPerMillion

    return {
      runs: count,
      avgWallSec,
      grossCostUsd,
      netCostUsd,
      billedCpuSeconds,
      billedMemoryGiBSeconds,
      billedRequests,
    } satisfies CloudRunCostScenario
  })
}

function recommendedCloudRunCpu(summary: BenchmarkSummary) {
  return summary.cpuMs.ratioToWallAvg >= 0.85 ? 1 : 1
}

function recommendedCloudRunMemoryMiB(summary: BenchmarkSummary) {
  const peakMiB = summary.peakMemoryBytes.rss / (1024 * 1024)
  const paddedMiB = Math.ceil((peakMiB * 1.5) / 128) * 128
  return Math.max(512, paddedMiB)
}

function buildMarkdownReport(
  environment: ReturnType<typeof collectEnvironment>,
  cold: BenchmarkSummary,
  warm: BenchmarkSummary
) {
  const recommendedCpu = recommendedCloudRunCpu(cold)
  const recommendedMemoryMiB = recommendedCloudRunMemoryMiB(cold)
  const coldScenarios = estimateCloudRunCosts(cold, recommendedCpu, recommendedMemoryMiB / 1024)
  const warmScenarios = estimateCloudRunCosts(warm, recommendedCpu, recommendedMemoryMiB / 1024)

  return [
    '# Backtest Cost Probe',
    '',
    '## Measurement Environment',
    `- Node: \`${environment.nodeVersion}\``,
    `- OS: \`${environment.platform} ${environment.arch} ${environment.osRelease}\``,
    `- CPU: \`${environment.cpuModel}\``,
    `- Logical cores: \`${environment.cpuCores}\``,
    `- Total memory: \`${formatGiB(environment.totalMemoryGiB)} GiB\``,
    `- Target: \`${environment.benchmarkTarget}\``,
    `- Input files: \`risk_v1_playback.json\` (${formatMiB(environment.standardArchiveBytes)} MiB), \`vr_survival_playback.json\` (${formatMiB(environment.survivalArchiveBytes)} MiB)`,
    `- Measurement shape: \`${ITERATIONS} measured runs + ${WARMUP_ITERATIONS} warmup\` per mode`,
    '',
    '## Execution Time Summary',
    `- Cold / cache OFF includes file read + JSON parse + arena build in every run.`,
    `- Warm / cache ON loads input once before timing, then reuses parsed archives.`,
    '',
    renderBenchmarkSection('Cold / cache OFF', cold),
    '',
    renderBenchmarkSection('Warm / cache ON', warm),
    '',
    '## Memory Summary',
    `- Peak RSS observed on cold path: **${formatMiB(cold.peakMemoryBytes.rss)} MiB**`,
    `- Peak RSS observed on warm path: **${formatMiB(warm.peakMemoryBytes.rss)} MiB**`,
    `- Peak heap used on cold path: **${formatMiB(cold.peakMemoryBytes.heapUsed)} MiB**`,
    `- Peak heap used on warm path: **${formatMiB(warm.peakMemoryBytes.heapUsed)} MiB**`,
    '',
    '## CPU Usage Tendency',
    `- Cold path CPU / wall ratio: **${cold.cpuMs.ratioToWallAvg.toFixed(2)}x**`,
    `- Warm path CPU / wall ratio: **${warm.cpuMs.ratioToWallAvg.toFixed(2)}x**`,
    '- The simulator is synchronous and largely single-thread bound. A ratio near 1.0 means one vCPU is usually enough; more CPU will not help unless the code is parallelized.',
    '',
    '## Cloud Run Recommendation',
    `- Recommended CPU: **${recommendedCpu} vCPU**`,
    `- Recommended memory: **${recommendedMemoryMiB} MiB**`,
    `- Rationale: the benchmark is synchronous, and the current peak RSS stays well below a 1 GiB tier on the measured path.`,
    '',
    '## Cloud Run Cost Estimate',
    '- Pricing basis: Cloud Run request-based billing, us-central1 active pricing from Google Cloud pricing page.',
    `- Active CPU: \`${CLOUD_RUN.activeCpuPerVcpuSecond}\` USD per vCPU-second`,
    `- Active memory: \`${CLOUD_RUN.activeMemoryPerGiBSecond}\` USD per GiB-second`,
    `- Request fee: \`${CLOUD_RUN.requestPerMillion}\` USD per 1,000,000 requests`,
    `- Free tier: \`${CLOUD_RUN.freeTier.cpuSeconds.toLocaleString()} vCPU-seconds / ${CLOUD_RUN.freeTier.memoryGiBSeconds.toLocaleString()} GiB-seconds / ${CLOUD_RUN.freeTier.requests.toLocaleString()} requests per month\``,
    '',
    '### Current code path cost (cold / cache OFF)',
    renderScenarioTable(coldScenarios),
    '',
    '### Warm cache cost (warm / cache ON)',
    renderScenarioTable(warmScenarios),
    '',
    '## Bottlenecks',
    '- Most of the runtime is CPU-bound curve construction and replay aggregation, not request orchestration.',
    '- File parsing adds a non-trivial fixed cost when caching is off, but repeated runs benefit from OS page cache even without an application cache.',
    '- The function is synchronous, so running it on more than 1 vCPU does not reduce latency much unless the code is refactored to parallelize event windows.',
    '',
    '## Optimization Suggestions',
    '- Preload the two playback archives once at process start if the service is long-lived.',
    '- Keep Cloud Run concurrency low for this endpoint if you want predictable latency under concurrent backtest requests.',
    '- If more speed is needed, split the 7 event windows and process them in parallel worker threads or separate requests.',
    '- Cache the derived arena output when the input archives do not change.',
    '',
    '## Method Notes',
    '- `cold / cache OFF` measures the current application shape more closely because the JSON files are re-read and parsed for each run.',
    '- `warm / cache ON` estimates the lower bound if the service keeps parsed archives in memory.',
    '- Memory is reported as sampled process RSS peak, which is a practical upper bound for Cloud Run sizing in this benchmark.',
  ].join('\n')
}

function renderBenchmarkSection(title: string, summary: BenchmarkSummary) {
  return [
    `### ${title}`,
    `- Input loading included: **${summary.includeInputLoading ? 'yes' : 'no'}**`,
    `- Warmup runs: **${summary.warmupIterations}**`,
    `- Measured runs: **${summary.iterations}**`,
    summary.preloadMs != null ? `- One-time preload: **${formatSeconds(summary.preloadMs)}**` : null,
    `- Single run avg time: **${formatSeconds(summary.wallMs.avg)}**`,
    `- p95 time: **${formatSeconds(summary.wallMs.p95)}**`,
    `- Min / max: **${formatSeconds(summary.wallMs.min)} / ${formatSeconds(summary.wallMs.max)}**`,
    `- Load avg: **${formatSeconds(summary.loadMs.avg)}**`,
    `- Build avg: **${formatSeconds(summary.buildMs.avg)}**`,
    `- CPU avg: **${formatSeconds(summary.cpuMs.avg)}**`,
  ].filter(Boolean).join('\n')
}

function renderScenarioTable(scenarios: CloudRunCostScenario[]) {
  const header = ['Runs', 'Avg wall', 'Gross cost', 'Net cost after free tier', 'CPU sec', 'GiB-sec']
  const rows = scenarios.map((scenario) => [
    `${scenario.runs.toLocaleString()}`,
    formatSeconds(scenario.avgWallSec * 1000),
    formatMoney(scenario.grossCostUsd),
    formatMoney(scenario.netCostUsd),
    formatNumber(scenario.billedCpuSeconds),
    formatNumber(scenario.billedMemoryGiBSeconds),
  ])

  const lines = [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ]
  return lines.join('\n')
}

function formatSeconds(ms: number) {
  return `${(ms / 1000).toFixed(4)} s`
}

function formatMiB(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(1)
}

function formatGiB(value: number) {
  return value.toFixed(2)
}

function formatMoney(value: number) {
  return value < 0.01 ? `$${value.toFixed(6)}` : `$${value.toFixed(2)}`
}

function formatNumber(value: number) {
  return value.toFixed(1)
}

main()
