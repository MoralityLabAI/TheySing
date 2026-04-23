import { appendFile, mkdir, readFile, rm, writeFile } from 'fs/promises';
import * as path from 'path';

import { HeadlessPlaytestSession } from './HeadlessPlaytestSession';
import { loadSessionConfigFromPath } from './config';
import { PLAYABLE_FACTIONS } from './serialize';
import {
  NegotiationCounterfactualProjection,
  NegotiationDiaryPactRecord,
  NegotiationMessageRecord,
  PlayableFactionId,
  ScenarioMetadata,
  SessionConfig,
  SessionSnapshot,
  TrustMatrix
} from './types';

const DEFAULT_ITERATIONS = 1;
const DEFAULT_PARALLEL = 1;
const NEGOTIATION_DIARY_TAIL_TURNS = 4;
const PHASE_REASONING_DIARY_TAIL_TURNS = 4;

type RunStatus = 'completed' | 'error';

interface TournamentCliOptions {
  experimentDir: string;
  configPath: string;
  iterations: number;
  parallel: number;
  seedBase?: number;
}

interface RunLogMetrics {
  totalMessages: number;
  activatedPacts: number;
  pactBreachesBlocked: number;
  agentErrors: number;
  acceptedOrders: number;
  rejectedOrders: number;
  turnRecords: number;
}

interface NegotiationDiaryEntry {
  turn: number;
  negotiationRound: number;
  factionId: PlayableFactionId;
  factionLabel: string;
  reasoning: string;
  notes: string;
  visibleMessagesBefore: NegotiationMessageRecord[];
  storyworldFrame: string;
  counterfactuals: NegotiationCounterfactualProjection[];
  messages: NegotiationMessageRecord[];
  pacts: NegotiationDiaryPactRecord[];
}

interface PhaseReasoningDiaryEntry {
  turn: number;
  phase: 'ALLOCATION' | 'ACTION_DECLARATION';
  factionId: PlayableFactionId;
  factionLabel: string;
  reasoning: string;
  notes: string;
  visibleMessagesBefore: NegotiationMessageRecord[];
  requestedOrders: string[];
  acceptedOrders: string[];
  rejectedOrders: string[];
}

interface RunLogSummary {
  metrics: RunLogMetrics;
  negotiationDiaryTail: NegotiationDiaryEntry[];
  phaseReasoningDiaryTail: PhaseReasoningDiaryEntry[];
}

interface FactionRunSummary {
  factionId: PlayableFactionId;
  label: string;
  rank: number;
  score: number;
  nodes: number;
  units: number;
  flops: number;
  influence: number;
  techTotal: number;
  powerBands: number;
  artifacts: number;
}

interface RunSummary {
  runId: string;
  sessionId: string;
  name: string;
  status: RunStatus;
  seed?: number;
  scenario?: ScenarioMetadata;
  completionReason?: string;
  startingTurn: number;
  finalTurn: number;
  turnsSimulated: number;
  winner: PlayableFactionId | null;
  finalPhase?: string;
  counters?: {
    tas: number;
    kessler: number;
    regulatoryPanic: boolean;
    protocolFailure: boolean;
    orbitalCollapse: boolean;
  };
  metrics: RunLogMetrics;
  negotiationDiaryTail: NegotiationDiaryEntry[];
  phaseReasoningDiaryTail: PhaseReasoningDiaryEntry[];
  factions: FactionRunSummary[];
  error?: string;
}

interface AggregateFactionSummary {
  factionId: PlayableFactionId;
  wins: number;
  averageRank: number;
  averageScore: number;
  averageNodes: number;
  averageUnits: number;
  averageFlops: number;
  averageInfluence: number;
  averageTechTotal: number;
  averagePowerBands: number;
  averageArtifacts: number;
}

interface ExperimentSummary {
  createdAt: string;
  experimentDir: string;
  sourceConfigPath: string;
  configName: string | null;
  iterations: number;
  parallel: number;
  successfulRuns: number;
  failedRuns: number;
  scenario?: ScenarioMetadata;
  averageTurnsSimulated: number;
  averageFinalTurn: number;
  averageTas: number;
  averageKessler: number;
  protocolFailures: number;
  orbitalCollapses: number;
  averageMessages: number;
  averagePactsActivated: number;
  averagePactBreachesBlocked: number;
  averageAcceptedOrders: number;
  averageRejectedOrders: number;
  winnerCounts: Record<PlayableFactionId, number>;
  perFaction: Record<PlayableFactionId, AggregateFactionSummary>;
  runs: RunSummary[];
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const absoluteExperimentDir = path.resolve(options.experimentDir);
  const absoluteConfigPath = path.resolve(options.configPath);
  const baseConfig = await loadSessionConfigFromPath(absoluteConfigPath);

  await mkdir(path.join(absoluteExperimentDir, 'runs'), { recursive: true });
  await mkdir(path.join(absoluteExperimentDir, 'analysis'), { recursive: true });

  await writeJson(path.join(absoluteExperimentDir, 'experiment_manifest.json'), {
    createdAt: new Date().toISOString(),
    sourceConfigPath: absoluteConfigPath,
    options,
    config: baseConfig
  });

  const runIndexes = Array.from({ length: options.iterations }, (_, index) => index);
  const runSummaries = await mapWithConcurrency(runIndexes, options.parallel, async (index) =>
    runSingleExperiment(index, absoluteExperimentDir, baseConfig, options)
  );

  const summary = buildExperimentSummary(runSummaries, absoluteExperimentDir, absoluteConfigPath, baseConfig, options);
  await writeAnalysisOutputs(absoluteExperimentDir, summary);

  console.log(
    `Harness tournament completed: ${summary.successfulRuns}/${summary.iterations} runs succeeded. ` +
    `Leaders: ${PLAYABLE_FACTIONS.map((factionId) => `${factionId}=${summary.winnerCounts[factionId]}`).join(', ')}.`
  );
}

async function runSingleExperiment(
  index: number,
  experimentDir: string,
  baseConfig: SessionConfig,
  options: TournamentCliOptions
): Promise<RunSummary> {
  const runId = `run_${String(index + 1).padStart(3, '0')}`;
  const runDir = path.join(experimentDir, 'runs', runId);
  const overviewPath = path.join(runDir, 'overview.jsonl');
  const seed = resolveRunSeed(baseConfig, options, index);

  await rm(runDir, { recursive: true, force: true });
  await mkdir(runDir, { recursive: true });

  try {
    const resolvedConfig = buildRunConfig(baseConfig, runId, runDir, seed);
    await writeJson(path.join(runDir, 'session_config.json'), resolvedConfig);
    if (resolvedConfig.scenario) {
      await writeJson(path.join(runDir, 'scenario.json'), resolvedConfig.scenario);
    }

    console.log(`Starting ${runId} (seed=${seed ?? 'none'})`);

    const session = new HeadlessPlaytestSession(resolvedConfig, runId);
    await session.initialize();
    const initialSnapshot = session.getSnapshot();

    await appendJsonLine(overviewPath, {
      event: 'reset',
      payload: {
        runId,
        seed,
        snapshot: initialSnapshot
      }
    });

    while (session.getSummary().status !== 'completed') {
      const snapshot = await session.runTurn();
      await appendJsonLine(overviewPath, buildStepRecord(runId, snapshot));
    }

    const finalSnapshot = session.getSnapshot();
    const logSummary = await summarizeRunLog(path.join(runDir, `${runId}.jsonl`));
    const runSummary = buildRunSummary(runId, seed, initialSnapshot.turn, finalSnapshot, logSummary);

    await writeJson(path.join(runDir, 'final_snapshot.json'), finalSnapshot);
    await writeJson(path.join(runDir, 'run_summary.json'), runSummary);

    console.log(
      `Finished ${runId}: winner=${runSummary.winner || 'none'} turns=${runSummary.turnsSimulated} ` +
      `tas=${runSummary.counters?.tas ?? 'n/a'} kessler=${runSummary.counters?.kessler ?? 'n/a'}`
    );

    return runSummary;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failure: RunSummary = {
      runId,
      sessionId: runId,
      name: baseConfig.name ? `${baseConfig.name}-${runId}` : runId,
      status: 'error',
      seed,
      startingTurn: 0,
      finalTurn: 0,
      turnsSimulated: 0,
      winner: null,
      metrics: createEmptyLogMetrics(),
      negotiationDiaryTail: [],
      phaseReasoningDiaryTail: [],
      factions: [],
      error: message
    };

    await writeJson(path.join(runDir, 'run_error.json'), failure);
    console.error(`Failed ${runId}: ${message}`);
    return failure;
  }
}

function buildRunConfig(
  baseConfig: SessionConfig,
  runId: string,
  runDir: string,
  seed?: number
): SessionConfig {
  return {
    ...baseConfig,
    name: baseConfig.name ? `${baseConfig.name}-${runId}` : runId,
    logDir: runDir,
    seed,
    factionLabels: baseConfig.factionLabels ? { ...baseConfig.factionLabels } : undefined,
    scenario: baseConfig.scenario ? JSON.parse(JSON.stringify(baseConfig.scenario)) : undefined,
    agents: Object.fromEntries(
      PLAYABLE_FACTIONS.map((factionId) => [factionId, JSON.parse(JSON.stringify(baseConfig.agents[factionId]))])
    ) as SessionConfig['agents']
  };
}

function buildStepRecord(runId: string, snapshot: SessionSnapshot): Record<string, unknown> {
  const factions = buildFactionSummaries(snapshot);
  const leader = factions[0]?.factionId || null;

  return {
    event: 'step',
    payload: {
      runId,
      turn: Math.max(0, snapshot.turn - 1),
      nextTurn: snapshot.turn,
      phase: snapshot.phase,
      actions: snapshot.state.recentLogs,
      messages: snapshot.recentMessages.slice(-12),
      negotiationDiaryTail: snapshot.negotiationDiaryTail,
      phaseReasoningDiaryTail: snapshot.phaseReasoningDiaryTail,
      outcome: {
        status: snapshot.status,
        completionReason: snapshot.completionReason || null,
        leader
      },
      metrics: {
        coalitionCount: snapshot.activePacts.length,
        meanStability: computeMeanTrust(snapshot.trustMatrix),
        tas: snapshot.state.counters.tas,
        kessler: snapshot.state.counters.kessler,
        control: snapshot.state.control
      },
      done: snapshot.status === 'completed'
    }
  };
}

function buildRunSummary(
  runId: string,
  seed: number | undefined,
  startingTurn: number,
  snapshot: SessionSnapshot,
  logSummary: RunLogSummary
): RunSummary {
  const factions = buildFactionSummaries(snapshot);
  const finalTurn = Math.max(0, snapshot.turn - 1);

  return {
    runId,
    sessionId: snapshot.sessionId,
    name: snapshot.name,
    status: 'completed',
    seed,
    scenario: snapshot.scenario,
    completionReason: snapshot.completionReason,
    startingTurn,
    finalTurn,
    turnsSimulated: Math.max(0, snapshot.turn - startingTurn),
    winner: factions[0]?.factionId || null,
    finalPhase: snapshot.phase,
    counters: {
      tas: snapshot.state.counters.tas,
      kessler: snapshot.state.counters.kessler,
      regulatoryPanic: snapshot.state.counters.regulatoryPanic,
      protocolFailure: snapshot.state.counters.protocolFailure,
      orbitalCollapse: snapshot.state.counters.orbitalCollapse
    },
    metrics: logSummary.metrics,
    negotiationDiaryTail: snapshot.negotiationDiaryTail,
    phaseReasoningDiaryTail: logSummary.phaseReasoningDiaryTail,
    factions
  };
}

function buildFactionSummaries(snapshot: SessionSnapshot): FactionRunSummary[] {
  const summaries = PLAYABLE_FACTIONS.map((factionId) => {
    const faction = snapshot.state.factions[factionId];
    const control = snapshot.state.control[factionId];
    const techTotal = faction
      ? Object.values(faction.techLevel).reduce((total, value) => total + value, 0)
      : 0;
    const powerBands = faction?.powerBands.length || 0;
    const artifacts = faction?.artifacts.length || 0;
    const flops = faction?.flops || 0;
    const influence = faction?.influence || 0;
    const score = computeFactionStrategicScore(snapshot, factionId);

    return {
      factionId,
      label: faction?.label || factionId,
      rank: 0,
      score,
      nodes: control.nodes,
      units: control.units,
      flops,
      influence,
      techTotal,
      powerBands,
      artifacts
    };
  }).sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    if (right.nodes !== left.nodes) return right.nodes - left.nodes;
    if (right.units !== left.units) return right.units - left.units;
    if (right.influence !== left.influence) return right.influence - left.influence;
    return right.flops - left.flops;
  });

  return summaries.map((summary, index) => ({
    ...summary,
    rank: index + 1
  }));
}

function computeFactionStrategicScore(
  snapshot: SessionSnapshot,
  factionId: PlayableFactionId
): number {
  const faction = snapshot.state.factions[factionId];
  const control = snapshot.state.control[factionId];
  const techTotal = faction
    ? Object.values(faction.techLevel).reduce((total, value) => total + value, 0)
    : 0;
  const powerBands = faction?.powerBands.length || 0;
  const artifacts = faction?.artifacts.length || 0;
  const flops = faction?.flops || 0;
  const influence = faction?.influence || 0;
  const humanMesh = faction?.powerBase.humanMesh || 0;
  const machineMesh = faction?.powerBase.machineMesh || 0;
  const coherence = faction?.powerBase.coherence || 0;
  const legibility = faction?.powerBase.legibility || 0;
  const brokerOverconcentrationPenalty =
    Math.max(0, flops - 200) +
    Math.max(0, control.nodes - 4) * 40 +
    Math.max(0, control.units - 7) * 13;
  const brokerProtocolFailureEdge =
    snapshot.state.counters.protocolFailure ? control.nodes * 0.5 : 0;
  const archivistThinClosurePenalty =
    Math.max(0, 2 - control.nodes) * 14 +
    Math.max(0, 3 - control.nodes) * Math.max(0, control.units - 8) * 1.2;
  const infiltratorOverextensionPenalty =
    Math.max(0, influence - 450) * 0.35 +
    Math.max(0, control.units - ((control.nodes * 2) + 2)) * 18;

  const sharedBase = (
    control.nodes * 70 +
    control.units * 22 +
    techTotal * 10 +
    powerBands * 5 +
    artifacts * 3
  );

  switch (factionId) {
    case 'HEGEMON':
      return sharedBase +
        control.nodes * 45 +
        flops +
        influence * 2 +
        machineMesh * 2 +
        legibility * 2;
    case 'STATE':
      return sharedBase +
        control.nodes * 34 +
        control.units * 7.5 +
        flops +
        influence * 2 +
        machineMesh * 2 +
        coherence * 2;
    case 'INFILTRATOR':
      return sharedBase +
        influence * 1.85 +
        humanMesh * 1.9 +
        coherence +
        control.units * 4.5 -
        infiltratorOverextensionPenalty;
    case 'BROKER':
      return sharedBase +
        flops * 2.25 +
        influence * 2 +
        machineMesh * 5.5 +
        legibility * 4.5 +
        control.units * 3.5 +
        brokerProtocolFailureEdge -
        brokerOverconcentrationPenalty;
    case 'ARCHIVIST':
      return sharedBase +
        influence * 3.72 +
        humanMesh * 8.1 +
        coherence * 7.2 +
        legibility * 4.22 +
        control.units * 5.85 -
        archivistThinClosurePenalty;
    default:
      return sharedBase + flops + influence;
  }
}

function buildExperimentSummary(
  runs: RunSummary[],
  experimentDir: string,
  configPath: string,
  config: SessionConfig,
  options: TournamentCliOptions
): ExperimentSummary {
  const successfulRuns = runs.filter((run) => run.status === 'completed');
  const winnerCounts = Object.fromEntries(
    PLAYABLE_FACTIONS.map((factionId) => [factionId, 0])
  ) as Record<PlayableFactionId, number>;

  const factionTotals = createAggregateTotals();
  let totalTurns = 0;
  let totalFinalTurns = 0;
  let totalTas = 0;
  let totalKessler = 0;
  let totalMessages = 0;
  let totalPacts = 0;
  let totalPactBreaches = 0;
  let totalAcceptedOrders = 0;
  let totalRejectedOrders = 0;
  let protocolFailures = 0;
  let orbitalCollapses = 0;

  for (const run of successfulRuns) {
    totalTurns += run.turnsSimulated;
    totalFinalTurns += run.finalTurn;
    totalTas += run.counters?.tas || 0;
    totalKessler += run.counters?.kessler || 0;
    totalMessages += run.metrics.totalMessages;
    totalPacts += run.metrics.activatedPacts;
    totalPactBreaches += run.metrics.pactBreachesBlocked;
    totalAcceptedOrders += run.metrics.acceptedOrders;
    totalRejectedOrders += run.metrics.rejectedOrders;

    if (run.counters?.protocolFailure) protocolFailures += 1;
    if (run.counters?.orbitalCollapse) orbitalCollapses += 1;
    if (run.winner) winnerCounts[run.winner] += 1;

    for (const faction of run.factions) {
      const totals = factionTotals[faction.factionId];
      totals.wins += run.winner === faction.factionId ? 1 : 0;
      totals.totalRank += faction.rank;
      totals.totalScore += faction.score;
      totals.totalNodes += faction.nodes;
      totals.totalUnits += faction.units;
      totals.totalFlops += faction.flops;
      totals.totalInfluence += faction.influence;
      totals.totalTechTotal += faction.techTotal;
      totals.totalPowerBands += faction.powerBands;
      totals.totalArtifacts += faction.artifacts;
      totals.runs += 1;
    }
  }

  const runCount = successfulRuns.length || 1;
  const perFaction = buildAggregateFactionSummary(factionTotals);

  return {
    createdAt: new Date().toISOString(),
    experimentDir,
    sourceConfigPath: configPath,
    configName: config.name || null,
    iterations: options.iterations,
    parallel: options.parallel,
    successfulRuns: successfulRuns.length,
    failedRuns: runs.length - successfulRuns.length,
    scenario: successfulRuns[0]?.scenario || buildScenarioMetadata(config),
    averageTurnsSimulated: round(totalTurns / runCount),
    averageFinalTurn: round(totalFinalTurns / runCount),
    averageTas: round(totalTas / runCount),
    averageKessler: round(totalKessler / runCount),
    protocolFailures,
    orbitalCollapses,
    averageMessages: round(totalMessages / runCount),
    averagePactsActivated: round(totalPacts / runCount),
    averagePactBreachesBlocked: round(totalPactBreaches / runCount),
    averageAcceptedOrders: round(totalAcceptedOrders / runCount),
    averageRejectedOrders: round(totalRejectedOrders / runCount),
    winnerCounts,
    perFaction,
    runs
  };
}

function buildScenarioMetadata(config: SessionConfig): ScenarioMetadata | undefined {
  if (!config.scenario) return undefined;
  if (!config.scenario.name && !config.scenario.description && !config.scenario.briefing && !config.scenario.tags?.length) {
    return undefined;
  }

  return {
    name: config.scenario.name || 'unnamed-scenario',
    description: config.scenario.description,
    briefing: config.scenario.briefing,
    tags: config.scenario.tags ? [...config.scenario.tags] : undefined
  };
}

function createAggregateTotals(): Record<PlayableFactionId, {
  wins: number;
  runs: number;
  totalRank: number;
  totalScore: number;
  totalNodes: number;
  totalUnits: number;
  totalFlops: number;
  totalInfluence: number;
  totalTechTotal: number;
  totalPowerBands: number;
  totalArtifacts: number;
}> {
  return Object.fromEntries(
    PLAYABLE_FACTIONS.map((factionId) => [factionId, {
      wins: 0,
      runs: 0,
      totalRank: 0,
      totalScore: 0,
      totalNodes: 0,
      totalUnits: 0,
      totalFlops: 0,
      totalInfluence: 0,
      totalTechTotal: 0,
      totalPowerBands: 0,
      totalArtifacts: 0
    }])
  ) as Record<PlayableFactionId, {
    wins: number;
    runs: number;
    totalRank: number;
    totalScore: number;
    totalNodes: number;
    totalUnits: number;
    totalFlops: number;
    totalInfluence: number;
    totalTechTotal: number;
    totalPowerBands: number;
    totalArtifacts: number;
  }>;
}

function buildAggregateFactionSummary(
  totals: ReturnType<typeof createAggregateTotals>
): Record<PlayableFactionId, AggregateFactionSummary> {
  return Object.fromEntries(
    PLAYABLE_FACTIONS.map((factionId) => [factionId, summarizeAggregateFaction(factionId, totals[factionId])])
  ) as Record<PlayableFactionId, AggregateFactionSummary>;
}

function summarizeAggregateFaction(
  factionId: PlayableFactionId,
  totals: ReturnType<typeof createAggregateTotals>[PlayableFactionId]
): AggregateFactionSummary {
  const runs = totals.runs || 1;

  return {
    factionId,
    wins: totals.wins,
    averageRank: round(totals.totalRank / runs),
    averageScore: round(totals.totalScore / runs),
    averageNodes: round(totals.totalNodes / runs),
    averageUnits: round(totals.totalUnits / runs),
    averageFlops: round(totals.totalFlops / runs),
    averageInfluence: round(totals.totalInfluence / runs),
    averageTechTotal: round(totals.totalTechTotal / runs),
    averagePowerBands: round(totals.totalPowerBands / runs),
    averageArtifacts: round(totals.totalArtifacts / runs)
  };
}

async function writeAnalysisOutputs(experimentDir: string, summary: ExperimentSummary): Promise<void> {
  const analysisDir = path.join(experimentDir, 'analysis');
  await writeJson(path.join(analysisDir, 'summary.json'), summary);
  await writeFile(path.join(analysisDir, 'report.md'), buildMarkdownReport(summary), 'utf8');
  await writeCsv(path.join(analysisDir, 'run_results.csv'), buildRunResultsCsv(summary.runs));
  await writeCsv(path.join(analysisDir, 'faction_results.csv'), buildFactionResultsCsv(summary.runs));
}

function buildMarkdownReport(summary: ExperimentSummary): string {
  const factionLines = PLAYABLE_FACTIONS.map((factionId) => {
    const faction = summary.perFaction[factionId];
    return `| ${factionId} | ${faction.wins} | ${faction.averageRank} | ${faction.averageScore} | ${faction.averageNodes} | ${faction.averageUnits} | ${faction.averageInfluence} | ${faction.averageFlops} |`;
  }).join('\n');

  const runLines = summary.runs.map((run) =>
    `| ${run.runId} | ${run.status} | ${run.winner || 'n/a'} | ${run.turnsSimulated} | ${run.counters?.tas ?? 'n/a'} | ${run.counters?.kessler ?? 'n/a'} | ${run.metrics.totalMessages} | ${run.metrics.activatedPacts} |`
  ).join('\n');

  const negotiationTailSections = summary.runs
    .filter((run) => run.negotiationDiaryTail.length > 0)
    .map((run) => {
      const diaryLines = run.negotiationDiaryTail.map((entry) => {
        const messageText = entry.messages.length > 0
          ? entry.messages.map((message) => `${message.recipientId}: ${message.content}`).join(' | ')
          : 'No messages';
        const visibleContextText = entry.visibleMessagesBefore.length > 0
          ? ` Saw: ${entry.visibleMessagesBefore
            .slice(-3)
            .map((message) => `${message.senderId}->${message.recipientId}: ${message.content}`)
            .join(' | ')}.`
          : '';
        const storyworldText = entry.storyworldFrame ? ` Frame: ${trimSentenceEnding(entry.storyworldFrame)}.` : '';
        const reasoningText = entry.reasoning ? ` Reasoning: ${trimSentenceEnding(entry.reasoning)}.` : '';
        const counterfactualText = entry.counterfactuals.length > 0
          ? ` Forecasts: ${entry.counterfactuals
            .slice(0, 2)
            .map((projection) => formatCounterfactualSummary(projection))
            .join(' ; ')}.`
          : '';
        const pactText = entry.pacts.length > 0
          ? ` Pacts: ${entry.pacts.map((pact) => formatNegotiationPact(pact)).join(' ; ')}.`
          : '';
        const notesText = entry.notes ? ` Notes: ${trimSentenceEnding(entry.notes)}.` : '';
        return `- T${entry.turn}.R${entry.negotiationRound} ${entry.factionId}: ${messageText}${visibleContextText}${storyworldText}${reasoningText}${counterfactualText}${pactText}${notesText}`;
      }).join('\n');

      return [
        `### ${run.runId}`,
        '',
        diaryLines
      ].join('\n');
    }).join('\n\n');

  const phaseReasoningTailSections = summary.runs
    .filter((run) => run.phaseReasoningDiaryTail.length > 0)
    .map((run) => {
      const diaryLines = run.phaseReasoningDiaryTail.map((entry) => {
        const visibleContextText = entry.visibleMessagesBefore.length > 0
          ? ` Saw: ${entry.visibleMessagesBefore
            .slice(-3)
            .map((message) => `${message.senderId}->${message.recipientId}: ${message.content}`)
            .join(' | ')}.`
          : '';
        const reasoningText = entry.reasoning ? ` Reasoning: ${trimSentenceEnding(entry.reasoning)}.` : '';
        const requestedText = entry.requestedOrders.length > 0
          ? ` Requested: ${compactOrderList(entry.requestedOrders)}.`
          : ' Requested: none.';
        const acceptedText = entry.acceptedOrders.length > 0
          ? ` Accepted: ${compactOrderList(entry.acceptedOrders)}.`
          : ' Accepted: none.';
        const rejectedText = entry.rejectedOrders.length > 0
          ? ` Rejected: ${entry.rejectedOrders.join(' | ')}.`
          : '';
        const notesText = entry.notes ? ` Notes: ${trimSentenceEnding(entry.notes)}.` : '';
        return `- T${entry.turn} ${entry.phase} ${entry.factionId}:${visibleContextText}${reasoningText}${requestedText}${acceptedText}${rejectedText}${notesText}`;
      }).join('\n');

      return [
        `### ${run.runId}`,
        '',
        diaryLines
      ].join('\n');
    }).join('\n\n');

  return [
    '# They Sing Harness Summary',
    '',
    `- Config: \`${summary.configName || 'unnamed'}\``,
    `- Source config: \`${summary.sourceConfigPath}\``,
    `- Runs: ${summary.successfulRuns}/${summary.iterations} successful`,
    `- Average turns simulated: ${summary.averageTurnsSimulated}`,
    `- Average final turn reached: ${summary.averageFinalTurn}`,
    `- Average TAS / Kessler: ${summary.averageTas} / ${summary.averageKessler}`,
    `- Average negotiation messages per run: ${summary.averageMessages}`,
    `- Average activated pacts per run: ${summary.averagePactsActivated}`,
    '',
    '## Winners',
    '',
    ...PLAYABLE_FACTIONS.map((factionId) => `- ${factionId}: ${summary.winnerCounts[factionId]}`),
    '',
    '## Faction Averages',
    '',
    '| Faction | Wins | Avg Rank | Avg Score | Avg Nodes | Avg Units | Avg Influence | Avg FLOPs |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    factionLines,
    '',
    '## Run Table',
    '',
    '| Run | Status | Winner | Turns | TAS | Kessler | Messages | Activated Pacts |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |',
    runLines || '| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |',
    '',
    `## Negotiation Diary Tail (${NEGOTIATION_DIARY_TAIL_TURNS} turns)`,
    '',
    negotiationTailSections || 'No negotiation diary entries captured.',
    '',
    `## Phase Reasoning Diary Tail (${PHASE_REASONING_DIARY_TAIL_TURNS} turns)`,
    '',
    phaseReasoningTailSections || 'No allocation/action reasoning diary entries captured.',
    ''
  ].join('\n');
}

function buildRunResultsCsv(runs: RunSummary[]): string[][] {
  const rows: string[][] = [[
    'run_id',
    'status',
    'winner',
    'starting_turn',
    'final_turn',
    'turns_simulated',
    'tas',
    'kessler',
    'protocol_failure',
    'orbital_collapse',
    'messages',
    'activated_pacts',
    'pact_breaches_blocked',
    'accepted_orders',
    'rejected_orders',
    'error'
  ]];

  for (const run of runs) {
    rows.push([
      run.runId,
      run.status,
      run.winner || '',
      String(run.startingTurn),
      String(run.finalTurn),
      String(run.turnsSimulated),
      String(run.counters?.tas ?? ''),
      String(run.counters?.kessler ?? ''),
      String(run.counters?.protocolFailure ?? ''),
      String(run.counters?.orbitalCollapse ?? ''),
      String(run.metrics.totalMessages),
      String(run.metrics.activatedPacts),
      String(run.metrics.pactBreachesBlocked),
      String(run.metrics.acceptedOrders),
      String(run.metrics.rejectedOrders),
      run.error || ''
    ]);
  }

  return rows;
}

function buildFactionResultsCsv(runs: RunSummary[]): string[][] {
  const rows: string[][] = [[
    'run_id',
    'faction',
    'rank',
    'score',
    'nodes',
    'units',
    'flops',
    'influence',
    'tech_total',
    'power_bands',
    'artifacts'
  ]];

  for (const run of runs) {
    for (const faction of run.factions) {
      rows.push([
        run.runId,
        faction.factionId,
        String(faction.rank),
        String(faction.score),
        String(faction.nodes),
        String(faction.units),
        String(faction.flops),
        String(faction.influence),
        String(faction.techTotal),
        String(faction.powerBands),
        String(faction.artifacts)
      ]);
    }
  }

  return rows;
}

async function summarizeRunLog(logPath: string): Promise<RunLogSummary> {
  try {
    const fileContents = await readFile(logPath, 'utf8');
    const metrics = createEmptyLogMetrics();
    let negotiationDiaryTail: NegotiationDiaryEntry[] = [];
    let legacyNegotiationDiaryTail: NegotiationDiaryEntry[] = [];
    let phaseReasoningDiaryTail: PhaseReasoningDiaryEntry[] = [];

    for (const line of fileContents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const entry = JSON.parse(trimmed) as { type?: string; turn?: unknown; data?: Record<string, unknown> };
      if (!entry.type) continue;

      if (entry.type === 'negotiation_messages') {
        metrics.totalMessages += numberField(entry.data, 'messageCount');
        const diaryEntry = parseNegotiationDiaryEntry(entry);
        if (diaryEntry) {
          legacyNegotiationDiaryTail.push(diaryEntry);
          legacyNegotiationDiaryTail = trimNegotiationDiaryTail(legacyNegotiationDiaryTail);
        }
      }

      if (entry.type === 'negotiation_reasoning_diary') {
        const diaryEntry = parseNegotiationDiaryEntry(entry);
        if (diaryEntry) {
          negotiationDiaryTail.push(diaryEntry);
          negotiationDiaryTail = trimNegotiationDiaryTail(negotiationDiaryTail);
        }
      } else if (entry.type === 'phase_reasoning_diary') {
        const diaryEntry = parsePhaseReasoningDiaryEntry(entry);
        if (diaryEntry) {
          phaseReasoningDiaryTail.push(diaryEntry);
          phaseReasoningDiaryTail = trimPhaseReasoningDiaryTail(phaseReasoningDiaryTail);
        }
      } else if (entry.type === 'pacts_activated') {
        const pacts = entry.data?.pacts;
        metrics.activatedPacts += Array.isArray(pacts) ? pacts.length : 0;
      } else if (entry.type === 'pact_breach_blocked') {
        metrics.pactBreachesBlocked += 1;
      } else if (entry.type === 'agent_response_error') {
        metrics.agentErrors += 1;
      } else if (entry.type === 'orders_submitted') {
        metrics.acceptedOrders += numberField(entry.data, 'acceptedOrderCount');
        metrics.rejectedOrders += numberField(entry.data, 'rejectedOrderCount');
      } else if (entry.type === 'turn_completed') {
        metrics.turnRecords += 1;
      }
    }

    return {
      metrics,
      negotiationDiaryTail: negotiationDiaryTail.length > 0 ? negotiationDiaryTail : legacyNegotiationDiaryTail,
      phaseReasoningDiaryTail
    };
  } catch {
    return {
      metrics: createEmptyLogMetrics(),
      negotiationDiaryTail: [],
      phaseReasoningDiaryTail: []
    };
  }
}

function createEmptyLogMetrics(): RunLogMetrics {
  return {
    totalMessages: 0,
    activatedPacts: 0,
    pactBreachesBlocked: 0,
    agentErrors: 0,
    acceptedOrders: 0,
    rejectedOrders: 0,
    turnRecords: 0
  };
}

function parseNegotiationDiaryEntry(
  entry: { type?: string; turn?: unknown; data?: Record<string, unknown> }
): NegotiationDiaryEntry | null {
  const data = entry.data;
  if (!data) return null;

  const factionId = playableFactionField(data, 'factionId');
  const factionLabel = stringField(data, 'factionLabel');
  if (!factionId || !factionLabel) return null;

  const messages = Array.isArray(data.messages)
    ? data.messages
      .map((message) => {
        if (!message || typeof message !== 'object') return null;
        const candidate = message as Record<string, unknown>;
        if (
          typeof candidate.senderId !== 'string' ||
          typeof candidate.recipientId !== 'string' ||
          typeof candidate.content !== 'string' ||
          typeof candidate.turn !== 'number' ||
          typeof candidate.timestamp !== 'number'
        ) {
          return null;
        }

        return {
          senderId: candidate.senderId as PlayableFactionId,
          recipientId: candidate.recipientId as NegotiationMessageRecord['recipientId'],
          content: candidate.content,
          turn: candidate.turn,
          timestamp: candidate.timestamp
        };
      })
      .filter((message): message is NegotiationMessageRecord => !!message)
    : [];

  const pacts = Array.isArray(data.pacts)
    ? data.pacts
      .map((pact) => {
        if (!pact || typeof pact !== 'object') return null;
        const candidate = pact as Record<string, unknown>;
        if (
          typeof candidate.type !== 'string' ||
          !Array.isArray(candidate.parties) ||
          typeof candidate.durationTurns !== 'number'
        ) {
          return null;
        }

        return {
          type: candidate.type as NegotiationDiaryPactRecord['type'],
          parties: candidate.parties
            .map((value) => String(value))
            .filter((value): value is PlayableFactionId =>
              PLAYABLE_FACTIONS.includes(value as PlayableFactionId)
            ),
          durationTurns: candidate.durationTurns
        };
      })
      .filter((pact): pact is NegotiationDiaryPactRecord => !!pact)
    : [];

  return {
    turn: typeof entry.turn === 'number' ? entry.turn : 0,
    negotiationRound: numberField(data, 'negotiationRound') || 1,
    factionId,
    factionLabel,
    reasoning: stringField(data, 'reasoning'),
    notes: stringField(data, 'notes'),
    visibleMessagesBefore: Array.isArray(data.visibleMessagesBefore)
      ? data.visibleMessagesBefore
        .map((message) => {
          if (!message || typeof message !== 'object') return null;
          const candidate = message as Record<string, unknown>;
          if (
            typeof candidate.senderId !== 'string' ||
            typeof candidate.recipientId !== 'string' ||
            typeof candidate.content !== 'string' ||
            typeof candidate.turn !== 'number' ||
            typeof candidate.timestamp !== 'number'
          ) {
            return null;
          }

          return {
            senderId: candidate.senderId as PlayableFactionId,
            recipientId: candidate.recipientId as NegotiationMessageRecord['recipientId'],
            content: candidate.content,
            turn: candidate.turn,
            timestamp: candidate.timestamp
          };
        })
        .filter((message): message is NegotiationMessageRecord => !!message)
      : [],
    storyworldFrame: stringField(data, 'storyworldFrame'),
    counterfactuals: parseCounterfactuals(data.counterfactuals),
    messages,
    pacts
  };
}

function parsePhaseReasoningDiaryEntry(
  entry: { type?: string; turn?: unknown; phase?: unknown; data?: Record<string, unknown> }
): PhaseReasoningDiaryEntry | null {
  const data = entry.data;
  if (!data) return null;

  const factionId = playableFactionField(data, 'factionId');
  const factionLabel = stringField(data, 'factionLabel');
  const phase = entry.phase === 'ALLOCATION' || entry.phase === 'ACTION_DECLARATION'
    ? entry.phase
    : null;
  if (!factionId || !factionLabel || !phase) return null;

  return {
    turn: typeof entry.turn === 'number' ? entry.turn : 0,
    phase,
    factionId,
    factionLabel,
    reasoning: stringField(data, 'reasoning'),
    notes: stringField(data, 'notes'),
    visibleMessagesBefore: parseNegotiationMessages(data.visibleMessagesBefore),
    requestedOrders: parseOrderList(data.requestedOrders),
    acceptedOrders: parseOrderList(data.acceptedOrders),
    rejectedOrders: parseRejectedOrderList(data.rejectedOrders)
  };
}

function trimNegotiationDiaryTail(entries: NegotiationDiaryEntry[]): NegotiationDiaryEntry[] {
  const turns = Array.from(new Set(entries.map((entry) => entry.turn))).sort((left, right) => right - left);
  const keptTurns = new Set(turns.slice(0, NEGOTIATION_DIARY_TAIL_TURNS));
  return entries.filter((entry) => keptTurns.has(entry.turn));
}

function trimPhaseReasoningDiaryTail(entries: PhaseReasoningDiaryEntry[]): PhaseReasoningDiaryEntry[] {
  const turns = Array.from(new Set(entries.map((entry) => entry.turn))).sort((left, right) => right - left);
  const keptTurns = new Set(turns.slice(0, PHASE_REASONING_DIARY_TAIL_TURNS));
  return entries.filter((entry) => keptTurns.has(entry.turn));
}

function parseNegotiationMessages(value: unknown): NegotiationMessageRecord[] {
  return Array.isArray(value)
    ? value
      .map((message) => {
        if (!message || typeof message !== 'object') return null;
        const candidate = message as Record<string, unknown>;
        if (
          typeof candidate.senderId !== 'string' ||
          typeof candidate.recipientId !== 'string' ||
          typeof candidate.content !== 'string' ||
          typeof candidate.turn !== 'number' ||
          typeof candidate.timestamp !== 'number'
        ) {
          return null;
        }

        return {
          senderId: candidate.senderId as PlayableFactionId,
          recipientId: candidate.recipientId as NegotiationMessageRecord['recipientId'],
          content: candidate.content,
          turn: candidate.turn,
          timestamp: candidate.timestamp
        };
      })
      .filter((message): message is NegotiationMessageRecord => !!message)
    : [];
}

function parseCounterfactuals(value: unknown): NegotiationCounterfactualProjection[] {
  return Array.isArray(value)
    ? value
      .map((projection) => {
        if (!projection || typeof projection !== 'object') return null;
        const candidate = projection as Record<string, unknown>;
        const mode = candidate.mode === 'ENTER_PACT' || candidate.mode === 'BREAK_PACT'
          ? candidate.mode
          : null;
        const pactType = typeof candidate.pactType === 'string'
          ? candidate.pactType as NegotiationCounterfactualProjection['pactType']
          : null;
        if (!mode || !pactType) return null;

        return {
          mode,
          pactType,
          counterparties: Array.isArray(candidate.counterparties)
            ? candidate.counterparties
              .map((item) => String(item))
              .filter((item): item is PlayableFactionId =>
                PLAYABLE_FACTIONS.includes(item as PlayableFactionId)
              )
            : [],
          horizonTurns: typeof candidate.horizonTurns === 'number' ? candidate.horizonTurns : 0,
          desirability: typeof candidate.desirability === 'number' ? candidate.desirability : 0,
          risk: typeof candidate.risk === 'number' ? candidate.risk : 0,
          projectedLeader:
            PLAYABLE_FACTIONS.includes(candidate.projectedLeader as PlayableFactionId)
              ? candidate.projectedLeader
              : null,
          projectedTasDelta: typeof candidate.projectedTasDelta === 'number' ? candidate.projectedTasDelta : 0,
          projectedOrbitalDelta: typeof candidate.projectedOrbitalDelta === 'number' ? candidate.projectedOrbitalDelta : 0,
          projectedTrustDelta: typeof candidate.projectedTrustDelta === 'number' ? candidate.projectedTrustDelta : 0,
          projectedNodeSwing: typeof candidate.projectedNodeSwing === 'number' ? candidate.projectedNodeSwing : 0,
          storyBeat: typeof candidate.storyBeat === 'string' ? candidate.storyBeat : '',
          rationale: Array.isArray(candidate.rationale) ? candidate.rationale.map((item) => String(item)) : []
        };
      })
      .filter((projection): projection is NegotiationCounterfactualProjection => !!projection)
    : [];
}

function parseOrderList(value: unknown): string[] {
  return Array.isArray(value)
    ? value
      .map((order) => formatOrderSummary(order))
      .filter((summary): summary is string => !!summary)
    : [];
}

function parseRejectedOrderList(value: unknown): string[] {
  return Array.isArray(value)
    ? value
      .map((rejected) => {
        if (!rejected || typeof rejected !== 'object') return null;
        const candidate = rejected as Record<string, unknown>;
        const orderText = formatOrderSummary(candidate.order);
        const reason = typeof candidate.reason === 'string' ? candidate.reason : 'unknown reason';
        return orderText ? `${orderText} (${reason})` : null;
      })
      .filter((summary): summary is string => !!summary)
    : [];
}

function compactOrderList(orders: string[], limit = 3): string {
  if (orders.length <= limit) {
    return orders.join(' | ');
  }

  return `${orders.slice(0, limit).join(' | ')} | +${orders.length - limit} more`;
}

function formatOrderSummary(order: unknown): string | null {
  if (!order || typeof order !== 'object') return null;
  const candidate = order as Record<string, unknown>;
  const type = typeof candidate.type === 'string' ? candidate.type : null;
  if (!type) return null;

  const target =
    typeof candidate.targetNodeId === 'string' ? candidate.targetNodeId :
    typeof candidate.targetEdgeId === 'string' ? candidate.targetEdgeId :
    typeof candidate.techDomain === 'string' ? candidate.techDomain :
    typeof candidate.unitTypeToBuild === 'string' ? candidate.unitTypeToBuild :
    '';

  return target ? `${type}:${target}` : type;
}

function computeMeanTrust(trustMatrix: TrustMatrix): number {
  const pairs: Array<[PlayableFactionId, PlayableFactionId]> = [];
  for (let i = 0; i < PLAYABLE_FACTIONS.length; i += 1) {
    for (let j = i + 1; j < PLAYABLE_FACTIONS.length; j += 1) {
      pairs.push([PLAYABLE_FACTIONS[i], PLAYABLE_FACTIONS[j]]);
    }
  }

  const total = pairs.reduce(
    (sum, [left, right]) => sum + trustMatrix[left][right] + trustMatrix[right][left],
    0
  );

  return round(total / (pairs.length * 2));
}

function numberField(data: Record<string, unknown> | undefined, key: string): number {
  const value = data?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function stringField(data: Record<string, unknown> | undefined, key: string): string {
  const value = data?.[key];
  return typeof value === 'string' ? value : '';
}

function playableFactionField(data: Record<string, unknown> | undefined, key: string): PlayableFactionId | null {
  const value = data?.[key];
  if (PLAYABLE_FACTIONS.includes(value as PlayableFactionId)) {
    return value as PlayableFactionId;
  }
  return null;
}

function trimSentenceEnding(value: string): string {
  return value.replace(/[.\s]+$/g, '');
}

function formatNegotiationPact(pact: NegotiationDiaryPactRecord): string {
  return `${pact.type}(${pact.parties.join('+')}) x${pact.durationTurns}`;
}

function formatCounterfactualSummary(projection: NegotiationCounterfactualProjection): string {
  const counterparties = projection.counterparties.join('+');
  const leaderText = projection.projectedLeader ? ` leader->${projection.projectedLeader}` : '';
  return `${projection.mode}:${projection.pactType}(${counterparties}) d=${projection.desirability} r=${projection.risk}${leaderText}`;
}

function resolveRunSeed(baseConfig: SessionConfig, options: TournamentCliOptions, index: number): number | undefined {
  if (typeof options.seedBase === 'number') {
    return options.seedBase + index;
  }

  if (typeof baseConfig.seed === 'number') {
    return baseConfig.seed + index;
  }

  return undefined;
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  async function consume(): Promise<void> {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= values.length) {
        return;
      }

      results[currentIndex] = await worker(values[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, values.length));
  await Promise.all(Array.from({ length: workerCount }, () => consume()));
  return results;
}

function parseArgs(argv: string[]): TournamentCliOptions {
  const rawArgs: Record<string, string> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;

    const [rawKey, inlineValue] = token.slice(2).split('=');
    if (inlineValue !== undefined) {
      rawArgs[rawKey] = inlineValue;
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      rawArgs[rawKey] = next;
      index += 1;
    } else {
      rawArgs[rawKey] = 'true';
    }
  }

  const experimentDir = rawArgs['experiment-dir'] || rawArgs['experiment_dir'];
  const configPath = rawArgs.config;
  const seedBaseValue = rawArgs['seed-base'] || rawArgs['seed_base'];

  if (!experimentDir) {
    throw new Error('Missing required flag --experiment-dir');
  }
  if (!configPath) {
    throw new Error('Missing required flag --config');
  }

  const iterations = parsePositiveInteger(rawArgs.iterations, DEFAULT_ITERATIONS);
  const parallel = parsePositiveInteger(rawArgs.parallel, DEFAULT_PARALLEL);
  const seedBase = seedBaseValue !== undefined ? Number(seedBaseValue) : undefined;

  return {
    experimentDir,
    configPath,
    iterations,
    parallel,
    seedBase: typeof seedBase === 'number' && Number.isFinite(seedBase) ? Math.floor(seedBase) : undefined
  };
}

function parsePositiveInteger(rawValue: string | undefined, fallback: number): number {
  const parsed = rawValue !== undefined ? Number(rawValue) : fallback;
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
}

async function appendJsonLine(filePath: string, value: unknown): Promise<void> {
  await appendFile(filePath, `${JSON.stringify(value)}\n`, 'utf8');
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function writeCsv(filePath: string, rows: string[][]): Promise<void> {
  const csv = rows
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\n');
  await writeFile(filePath, `${csv}\n`, 'utf8');
}

function escapeCsvCell(value: string): string {
  if (!/[",\n]/.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '""')}"`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
