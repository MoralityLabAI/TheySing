const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const args = parseArgs(process.argv.slice(2));
const replayPath = path.resolve(args.replay || args._[0] || path.join(ROOT, 'public', 'observatory_replay.json'));
const outputDir = path.resolve(args.outputDir || args._[1] || path.join(ROOT, 'results', 'ux-replay-evaluation', timestampSlug()));
const autoplayDwellMs = Number(args.autoplayDwellMs || 3600);
const quietAutoplayDwellMs = Number(args.quietAutoplayDwellMs || 1200);
const playbackRate = Number(args.playbackRate || 1);
const meanWordDelayMs = Number(args.meanWordDelayMs || 28);
const transcriptMode = args.transcriptMode || args._[2] || 'block-stagger';
const determinismPath = args.determinism || args._[3];
const sceneRenderBudget = Number(args.sceneRenderBudget || args._[4] || 8);
const boardUnitClusterTarget = Number(args.boardUnitClusterTarget || 64);
const GAME_PHASE_ORDER = { NEGOTIATION: 0, ALLOCATION: 1, ACTION_DECLARATION: 2, RESOLUTION: 3, TURN_END: 4 };
const FACTION_IDS = new Set(['HEGEMON', 'INFILTRATOR', 'STATE', 'BROKER', 'ARCHIVIST', 'CONVENOR', 'CANTOR']);

if (!fs.existsSync(replayPath)) throw new Error(`Replay not found: ${replayPath}`);
const replay = JSON.parse(fs.readFileSync(replayPath, 'utf8'));
const { groupSceneSignals, humanizeSceneEvent } = loadSceneNarration();
const { clusterBoardUnits } = loadBoardUnitClustering();
const { hasReplayNarrativeSignal, replayTurnDwellMs } = loadReplayPacing();
const replayDeterminism = determinismPath && fs.existsSync(path.resolve(determinismPath))
  ? JSON.parse(fs.readFileSync(path.resolve(determinismPath), 'utf8'))
  : null;
const turns = replay.turns || [];
const nodeIds = new Set((replay.graph?.nodes || []).map((node) => node.nodeId).filter(Boolean));
const edgeIds = new Set((replay.graph?.edges || []).map((edge) => edge.edgeId).filter(Boolean));

const phaseRows = turns.map((turn, index) => evaluatePhase(turn, index));
const phaseDwellMs = turns.map((turn) => replayTurnDwellMs(turn, playbackRate, {
  signalDwellMs: autoplayDwellMs,
  quietDwellMs: quietAutoplayDwellMs
}));
const phaseOrderViolations = countPhaseOrderViolations(turns);
const sceneEvents = turns.flatMap((turn) => turn.sceneEvents || []);
const sceneGroupsByPhase = turns.map((turn) => groupSceneSignals(turn.sceneEvents || []));
const sceneSignalGroups = sceneGroupsByPhase.flat();
const groupedSceneCounts = sceneGroupsByPhase.map((groups) => groups.length);
const focusableSceneEvents = sceneEvents.filter(isSceneEventFocusable).length;
const sceneCounts = phaseRows.map((row) => row.sceneEvents);
const publicStreamMs = phaseRows.map((row) => row.publicTranscriptStreamMs);
const privateStreamMs = phaseRows.map((row) => row.privateTranscriptStreamMs);
const boardChangeCounts = phaseRows.map((row) => row.boardChanges);
const boardUnitCounts = turns.map((turn) => (turn.boardState?.unitLocations || []).length);
const boardUnitClustersByPhase = turns.map((turn) => clusterBoardUnits(turn.boardState?.unitLocations || []));
const boardUnitClusterCounts = boardUnitClustersByPhase.map((clusters) => clusters.length);
const unitChanges = turns.flatMap((turn) => turn.boardDiff?.unitLocationChanges || []);
const stationaryMoves = unitChanges.filter((change) => change.changeType === 'MOVED' && change.from === change.to).length;
const reusedFactionUnitIds = turns.flatMap((turn) => turn.boardState?.unitLocations || [])
  .filter((unit) => unit.inferred && FACTION_IDS.has(unit.unitId)).length;
const signalPhases = phaseRows.filter((row) => row.hasNarrativeSignal).length;
const campaignTurns = new Set(turns.map((turn) => turn.turn)).size;
const phaseCounts = countBy(turns, (turn) => turn.phase || 'UNKNOWN');
const beatSources = countBy(phaseRows, (row) => row.beatSource);
const categoryCounts = countBy(sceneEvents, (event) => event.category || event.visualPreset || 'UNKNOWN');
const summaryCounts = countBy(
  sceneEvents.filter((event) => event.publicExplanation),
  (event) => normalizeText(event.publicExplanation)
);
const narratedSummaryCounts = countBy(sceneEvents, (event) => normalizeText(humanizeSceneEvent(event)));
const rewrittenSceneEvents = sceneEvents.filter((event) =>
  normalizeText(humanizeSceneEvent(event)) !== normalizeText(event.publicExplanation || event.category || '')
).length;
const repeatedSummaries = Object.entries(summaryCounts)
  .filter(([, count]) => count > 1)
  .sort((left, right) => right[1] - left[1])
  .slice(0, 10)
  .map(([summary, count]) => ({ summary, count }));
const phaseDensity = Object.fromEntries(Object.entries(phaseCounts).map(([phase]) => {
  const rows = phaseRows.filter((row) => row.phase === phase);
  return [phase, {
    phases: rows.length,
    sceneEvents: sum(rows.map((row) => row.sceneEvents)),
    messages: sum(rows.map((row) => row.messages)),
    diaries: sum(rows.map((row) => row.diaries)),
    orders: sum(rows.map((row) => row.orders)),
    boardChanges: sum(rows.map((row) => row.boardChanges))
  }];
}));

const metrics = {
  schema: 'theysing.observatoryUxEvaluation.v1',
  generatedAt: new Date().toISOString(),
  replay: {
    path: path.relative(ROOT, replayPath),
    generatedAt: replay.generatedAt || null,
    campaignTurns,
    phases: turns.length,
    autoplayDwellMs,
    quietAutoplayDwellMs,
    playbackRate,
    fixedAutoplayMinutes: round(turns.length * autoplayDwellMs / playbackRate / 60000, 2),
    fullAutoplayMinutes: round(sum(phaseDwellMs) / 60000, 2),
    autoplayMinutesSaved: round((turns.length * autoplayDwellMs / playbackRate - sum(phaseDwellMs)) / 60000, 2),
    narrativeSignalPhases: signalPhases,
    signalSkipRate: ratio(turns.length - signalPhases, turns.length),
    phaseOrderViolations,
    sourceFiles: replay.sourceFiles || [],
    auditArtifacts: replay.auditManifest?.artifacts || []
  },
  phaseCounts,
  beatSources,
  phaseDensity,
  scene: {
    events: sceneEvents.length,
    phasesWithEvents: sceneCounts.filter((count) => count > 0).length,
    phasesOverFiveEvents: sceneCounts.filter((count) => count > 5).length,
    phasesOverTwelveEvents: sceneCounts.filter((count) => count > 12).length,
    medianEventsPerPhase: quantile(sceneCounts, 0.5),
    p90EventsPerPhase: quantile(sceneCounts, 0.9),
    maxEventsPerPhase: Math.max(0, ...sceneCounts),
    renderBudget: sceneRenderBudget,
    maxRenderedEffectsPerPhase: Math.min(sceneRenderBudget, Math.max(0, ...sceneCounts)),
    phasesGroupedByRenderBudget: sceneCounts.filter((count) => count > sceneRenderBudget).length,
    signalGroups: sceneSignalGroups.length,
    groupedSignalReduction: sceneEvents.length - sceneSignalGroups.length,
    groupedSignalReductionRate: ratio(sceneEvents.length - sceneSignalGroups.length, sceneEvents.length),
    phasesWithGroupedSignals: sceneGroupsByPhase.filter((groups, index) => groups.length < sceneCounts[index]).length,
    maxGroupsPerPhase: Math.max(0, ...groupedSceneCounts),
    maxSignalsPerGroup: Math.max(0, ...sceneSignalGroups.map((group) => group.count)),
    focusableEvents: focusableSceneEvents,
    focusableRate: ratio(focusableSceneEvents, sceneEvents.length),
    actorLabelRate: ratio(sceneEvents.filter((event) => (event.actors || []).length > 0).length, sceneEvents.length),
    categories: categoryCounts,
    uniquePublicSummaryRate: ratio(Object.keys(summaryCounts).length, sceneEvents.filter((event) => event.publicExplanation).length),
    uniqueNarratedSummaryRate: ratio(Object.keys(narratedSummaryCounts).length, sceneEvents.length),
    rewrittenEvents: rewrittenSceneEvents,
    narrationRewriteRate: ratio(rewrittenSceneEvents, sceneEvents.length),
    repeatedSummaries
  },
  transcript: {
    presentationMode: transcriptMode,
    meanWordDelayMs,
    public: streamStats(publicStreamMs),
    retrospective: streamStats(privateStreamMs),
    publicPhasesExceedingAutoplay: publicStreamMs.filter((duration, index) => duration > phaseDwellMs[index]).length,
    retrospectivePhasesExceedingAutoplay: privateStreamMs.filter((duration, index) => duration > phaseDwellMs[index]).length
  },
  board: {
    phasesWithChanges: boardChangeCounts.filter((count) => count > 0).length,
    resolutionPhases: phaseRows.filter((row) => row.phase === 'RESOLUTION').length,
    resolutionPhasesWithChanges: phaseRows.filter((row) => row.phase === 'RESOLUTION' && row.boardChanges > 0).length,
    stationaryMoves,
    reusedFactionUnitIds,
    unitClusterTarget: boardUnitClusterTarget,
    medianUnitsPerPhase: quantile(boardUnitCounts, 0.5),
    p90UnitsPerPhase: quantile(boardUnitCounts, 0.9),
    maxUnitsPerPhase: Math.max(0, ...boardUnitCounts),
    medianUnitClustersPerPhase: quantile(boardUnitClusterCounts, 0.5),
    p90UnitClustersPerPhase: quantile(boardUnitClusterCounts, 0.9),
    maxUnitClustersPerPhase: Math.max(0, ...boardUnitClusterCounts),
    maxUnitsPerCluster: Math.max(0, ...boardUnitClustersByPhase.flat().map((cluster) => cluster.count)),
    phasesOverUnitClusterTarget: boardUnitClusterCounts.filter((count) => count > boardUnitClusterTarget).length,
    maxChangesPerPhase: Math.max(0, ...boardChangeCounts)
  },
  content: {
    messages: sum(phaseRows.map((row) => row.messages)),
    diaries: sum(phaseRows.map((row) => row.diaries)),
    orders: sum(phaseRows.map((row) => row.orders)),
    research: sum(phaseRows.map((row) => row.research)),
    moments: sum(phaseRows.map((row) => row.moments)),
    protocolEvidence: sum(phaseRows.map((row) => row.protocolEvidence))
  },
  evaluationClaims: (replay.evaluation?.claims || []).map((claim) => ({
    id: claim.id,
    status: claim.status,
    label: claim.label,
    summary: claim.summary,
    caveat: claim.caveat
  })),
  replayDeterminism: replayDeterminism ? {
    status: replayDeterminism.status,
    turnsCompared: replayDeterminism.turnsCompared,
    mismatchCount: (replayDeterminism.mismatches || []).length,
    firstMismatchTurn: replayDeterminism.mismatches?.[0]?.turn || null,
    source: path.relative(ROOT, path.resolve(determinismPath))
  } : null,
  findings: []
};

metrics.findings = buildFindings(metrics);
fs.mkdirSync(outputDir, { recursive: true });
const jsonPath = path.join(outputDir, 'ux_replay_evaluation.json');
const reportPath = path.join(outputDir, 'UX_REPLAY_EVALUATION.md');
fs.writeFileSync(jsonPath, `${JSON.stringify(metrics, null, 2)}\n`, 'utf8');
fs.writeFileSync(reportPath, renderMarkdown(metrics), 'utf8');

console.log(JSON.stringify({
  status: 'completed',
  replay: path.relative(ROOT, replayPath),
  report: path.relative(ROOT, reportPath),
  metrics: path.relative(ROOT, jsonPath),
  phases: turns.length,
  sceneEvents: sceneEvents.length,
  findings: metrics.findings.length
}, null, 2));

function evaluatePhase(turn, index) {
  const sceneCount = (turn.sceneEvents || []).length;
  const publicBlocks = [
    ...(turn.messages || []).slice(0, 10).map((message) => message.content || ''),
    ...(turn.sceneEvents || []).slice(0, 8).map((event) => event.publicExplanation || '').filter(Boolean),
    ...(turn.events || []).slice(-6).map((event) => event.summary || '').filter(Boolean)
  ].slice(0, 12);
  const privateBlocks = [
    ...(turn.messages || []).slice(0, 10).map((message) => message.content || ''),
    ...(turn.diaries || []).slice(0, 8)
      .map((diary) => [diary.reasoning, diary.notes, diary.storyworldFrame].filter(Boolean).join('\n'))
      .filter(Boolean),
    ...(turn.sceneEvents || []).slice(0, 8)
      .map((event) => [event.retrospectiveTruth, stringifyReasoning(event.privateReasoning)].filter(Boolean).join('\n'))
      .filter(Boolean)
  ].slice(0, 12);
  const protocol = turn.protocolEvidence || {};
  const boardDiff = turn.boardDiff || {};
  const boardChanges =
    (boardDiff.nodeOwnershipChanges || []).length +
    (boardDiff.unitLocationChanges || []).length +
    (boardDiff.edgeStateChanges || []).length;
  return {
    index,
    turn: turn.turn,
    phase: turn.phase || 'UNKNOWN',
    beatSource: sceneCount > 0 ? 'SCENE_EVENT' :
      (turn.moments || []).length > 0 ? 'MOMENT' :
        (turn.events || []).length > 0 ? 'EVENT' :
          (turn.messages || []).length > 0 ? 'MESSAGE' :
            turn.boardDiff ? 'BOARD_DIFF' : 'EMPTY',
    hasNarrativeSignal: hasReplayNarrativeSignal(turn),
    sceneEvents: sceneCount,
    messages: (turn.messages || []).length,
    diaries: (turn.diaries || []).length,
    orders: (turn.orders || []).length,
    research: (turn.research || []).length,
    moments: (turn.moments || []).length,
    protocolEvidence: Object.values(protocol).reduce((total, value) => total + (Array.isArray(value) ? value.length : 0), 0),
    boardChanges,
    publicTranscriptStreamMs: estimateStreamMs(publicBlocks),
    privateTranscriptStreamMs: estimateStreamMs(privateBlocks)
  };
}

function estimateStreamMs(blocks) {
  if (transcriptMode === 'block-stagger') {
    return blocks.length > 0 ? 260 + Math.min(blocks.length - 1, 11) * 55 : 0;
  }
  return blocks.reduce((duration, block, index) => {
    const words = Math.min(170, wordCount(block));
    return duration + words * meanWordDelayMs + (index > 0 ? 160 : 0);
  }, 0);
}

function isSceneEventFocusable(event) {
  const location = event.location || {};
  return Boolean(
    (location.nodeId && nodeIds.has(location.nodeId)) ||
    (location.edgeId && edgeIds.has(location.edgeId)) ||
    location.orbitShell ||
    (Number.isFinite(location.lat) && Number.isFinite(location.lon)) ||
    (event.actors || []).length > 0
  );
}

function streamStats(values) {
  return {
    medianSeconds: round(quantile(values, 0.5) / 1000, 2),
    p90Seconds: round(quantile(values, 0.9) / 1000, 2),
    maxSeconds: round(Math.max(0, ...values) / 1000, 2)
  };
}

function buildFindings(result) {
  const findings = [];
  if (result.replay.phaseOrderViolations > 0) {
    findings.push({
      severity: 'P1',
      id: 'REPLAY_PHASES_OUT_OF_ORDER',
      finding: 'Replay phases do not follow the engine chronology.',
      evidence: `${result.replay.phaseOrderViolations} adjacent phase transitions regress within a campaign turn.`,
      recommendation: 'Export phases in the engine order: negotiation, allocation, action declaration, resolution, then turn end.'
    });
  } else {
    findings.push({
      severity: 'PASS',
      id: 'REPLAY_PHASE_CHRONOLOGY',
      finding: 'Replay phases follow the engine chronology.',
      evidence: `${result.replay.phases} phase records contain no within-turn ordering regression.`,
      recommendation: 'Keep chronology and inferred-unit identity checks in the replay regression gate.'
    });
  }
  if (result.replay.autoplayMinutesSaved > 0) {
    findings.push({
      severity: 'PASS',
      id: 'QUIET_PHASES_USE_ADAPTIVE_DWELL',
      finding: 'Autoplay preserves narrative reading time without lingering on structurally quiet phases.',
      evidence: `${result.replay.narrativeSignalPhases} signal phases use ${(result.replay.autoplayDwellMs / 1000).toFixed(1)}s and ${result.replay.phases - result.replay.narrativeSignalPhases} quiet phases use ${(result.replay.quietAutoplayDwellMs / 1000).toFixed(1)}s at ${result.replay.playbackRate}x, reducing a fixed ${result.replay.fixedAutoplayMinutes}-minute pass to ${result.replay.fullAutoplayMinutes} minutes.`,
      recommendation: 'Retain explicit speed controls and suspend the timer while the document is hidden.'
    });
  }
  if (result.board.stationaryMoves > 0 || result.board.reusedFactionUnitIds > 0) {
    findings.push({
      severity: 'P1',
      id: 'BOARD_DIFF_IDENTITY_CHURN',
      finding: 'Inferred unit identities manufacture board movement.',
      evidence: `${result.board.stationaryMoves} MOVED records retain the same location; ${result.board.reusedFactionUnitIds} board snapshots reuse a faction id as an inferred unit id.`,
      recommendation: 'Assign unique inferred identities to builds and classify same-location mutations as transfer or retype events.'
    });
  }
  if (result.replayDeterminism?.status === 'failed') {
    findings.push({
      severity: 'P1',
      id: 'RECORDED_REPLAY_DIVERGES',
      finding: 'The canonical run does not yet reproduce every recorded turn hash.',
      evidence: `${result.replayDeterminism.mismatchCount}/${result.replayDeterminism.turnsCompared} compared turns diverged; first mismatch is turn ${result.replayDeterminism.firstMismatchTurn}.`,
      recommendation: 'Treat the spectator export as a signed historical projection, not a regenerated simulation, until turn-end state replay is repaired.'
    });
  } else if (result.replayDeterminism?.status === 'passed') {
    findings.push({
      severity: 'PASS',
      id: 'RECORDED_REPLAY_MATCHES',
      finding: 'Recorded decisions reproduce the compared engine turn hashes.',
      evidence: `${result.replayDeterminism.turnsCompared} turns compared without mismatch.`,
      recommendation: 'Retain this check for every published replay.'
    });
  }
  const transcript = result.transcript;
  if (transcript.publicPhasesExceedingAutoplay > 0 || transcript.retrospectivePhasesExceedingAutoplay > 0) {
    findings.push({
      severity: 'P1',
      id: 'DIARY_STREAM_RESETS_BEFORE_COMPLETION',
      finding: 'Sequential word streaming cannot complete before autoplay advances many phases.',
      evidence: `${transcript.publicPhasesExceedingAutoplay}/${result.replay.phases} public phases and ${transcript.retrospectivePhasesExceedingAutoplay}/${result.replay.phases} retrospective phases exceed their adaptive dwell; retrospective p90 is ${transcript.retrospective.p90Seconds}s.`,
      recommendation: 'Render complete blocks immediately and preserve the animated feel with short staggered block reveals.'
    });
  }
  if (result.scene.maxEventsPerPhase > result.scene.renderBudget && result.scene.renderBudget <= 10) {
    findings.push({
      severity: 'PASS',
      id: 'SCENE_DENSITY_IS_SALIENCE_BUDGETED',
      finding: 'Dense phases are bounded on the globe without removing indexed evidence.',
      evidence: `${result.scene.phasesGroupedByRenderBudget} phases exceed the ${result.scene.renderBudget}-effect render budget; raw maximum is ${result.scene.maxEventsPerPhase}.`,
      recommendation: 'Keep all grouped events available through the current-phase scene index.'
    });
  } else if (result.scene.maxEventsPerPhase > 12) {
    findings.push({
      severity: 'P1',
      id: 'SCENE_DENSITY_EXCEEDS_SINGLE_GLANCE',
      finding: 'Order-heavy phases produce more simultaneous globe effects than a spectator can parse at once.',
      evidence: `${result.scene.phasesOverTwelveEvents} phases exceed 12 effects; raw maximum is ${result.scene.maxEventsPerPhase}.`,
      recommendation: 'Keep all evidence indexed, but stage or cluster lower-intensity effects instead of presenting every effect at equal salience.'
    });
  }
  if (result.beatSources.BOARD_DIFF > 0 && result.board.resolutionPhasesWithChanges > 0) {
    findings.push({
      severity: 'P2',
      id: 'RESOLUTION_BEATS_ARE_STRUCTURALLY_QUIET',
      finding: 'Resolution phases rely on board-diff prose rather than authored scene events.',
      evidence: `${result.beatSources.BOARD_DIFF} phases use board-diff fallback; ${result.board.resolutionPhasesWithChanges}/${result.board.resolutionPhases} resolution phases contain material changes.`,
      recommendation: 'Treat resolution as a concise before/after beat and skip it during signal navigation unless the diff crosses a material threshold.'
    });
  } else if (result.beatSources.BOARD_DIFF > 0) {
    findings.push({
      severity: 'PASS',
      id: 'QUIET_RESOLUTION_BEATS_ARE_HONEST',
      finding: 'Structurally quiet resolution beats no longer imply board motion.',
      evidence: `${result.board.resolutionPhasesWithChanges}/${result.board.resolutionPhases} resolution phases contain material board changes; quiet phases remain outside signal navigation.`,
      recommendation: 'Add authored resolution beats only when the exporter records a material before/after delta.'
    });
  }
  if (result.scene.uniquePublicSummaryRate < 0.5) {
    findings.push({
      severity: 'P2',
      id: 'PUBLIC_SCENE_TEXT_IS_REPETITIVE',
      finding: 'Public scene explanations repeat heavily across the campaign.',
      evidence: `Unique raw-summary rate is ${(result.scene.uniquePublicSummaryRate * 100).toFixed(1)}%; the UI rewrites ${(result.scene.narrationRewriteRate * 100).toFixed(1)}% of events, but the most repeated source line still appears ${result.scene.repeatedSummaries[0]?.count || 0} times.`,
      recommendation: 'Keep structured per-phase grouping for readability, then diversify agent action selection across the campaign rather than paraphrasing repeated strategy.'
    });
  }
  if (result.scene.narrationRewriteRate >= 0.5) {
    findings.push({
      severity: 'PASS',
      id: 'STRUCTURED_SCENE_NARRATION',
      finding: 'Most raw scene telemetry is converted into actor/action/location prose.',
      evidence: `${result.scene.rewrittenEvents}/${result.scene.events} scene explanations are rewritten for spectators.`,
      recommendation: 'Protect representative narration grammars with replay-derived tests.'
    });
  }
  if (result.scene.groupedSignalReduction > 0) {
    findings.push({
      severity: 'PASS',
      id: 'REPEATED_SIGNALS_ARE_GROUPED',
      finding: 'Repeated same-actor actions are grouped without removing raw evidence.',
      evidence: `${result.scene.groupedSignalReduction}/${result.scene.events} raw signals collapse into ${result.scene.signalGroups} spectator groups across ${result.scene.phasesWithGroupedSignals} phases; the largest group contains ${result.scene.maxSignalsPerGroup} records.`,
      recommendation: 'Keep distinct treaties, goblins, and escape trajectories ungrouped when actor or semantic identity is incomplete.'
    });
  }
  if (result.board.phasesOverUnitClusterTarget === 0 && result.board.maxUnitsPerPhase > result.board.maxUnitClustersPerPhase) {
    findings.push({
      severity: 'PASS',
      id: 'BOARD_UNITS_ARE_CLUSTERED',
      finding: 'Dense board populations collapse into bounded, evidence-bearing unit markers.',
      evidence: `The peak phase falls from ${result.board.maxUnitsPerPhase} unit records to ${result.board.maxUnitClustersPerPhase} location/owner/type clusters; p90 is ${result.board.p90UnitClustersPerPhase} clusters and the largest cluster contains ${result.board.maxUnitsPerCluster} units.`,
      recommendation: `Keep published replays at or below the ${result.board.unitClusterTarget}-cluster target or introduce a second aggregation tier.`
    });
  } else if (result.board.phasesOverUnitClusterTarget > 0) {
    findings.push({
      severity: 'P1',
      id: 'BOARD_UNIT_MARKERS_EXCEED_TARGET',
      finding: 'Unit clustering still creates too many independent globe markers.',
      evidence: `${result.board.phasesOverUnitClusterTarget} phases exceed the ${result.board.unitClusterTarget}-cluster target; maximum is ${result.board.maxUnitClustersPerPhase}.`,
      recommendation: 'Add a second location-level aggregation tier while preserving exact units in the evidence payload.'
    });
  }
  if (result.scene.focusableRate >= 0.99) {
    findings.push({
      severity: 'PASS',
      id: 'SCENE_EVIDENCE_IS_NAVIGABLE',
      finding: 'Nearly every scene event can target a graph location or faction beacon.',
      evidence: `${result.scene.focusableEvents}/${result.scene.events} events are focusable.`,
      recommendation: 'Keep the focusability gate at or above 99% for future exports.'
    });
  }
  findings.push({
    severity: 'UNVERIFIED',
    id: 'HEADED_VISUAL_COMPOSITION',
    finding: 'Canvas composition, clipping, hover stability, and touch ergonomics are not visually verified.',
    evidence: 'No headed browser backend was available during this evaluation.',
    recommendation: 'Run the documented desktop/mobile matrix before treating the UX playtest as complete.'
  });
  return findings;
}

function renderMarkdown(result) {
  const lines = [
    '# They Sing UX Replay Evaluation',
    '',
    `- Replay: \`${result.replay.path}\``,
    `- Campaign: ${result.replay.campaignTurns} turns / ${result.replay.phases} phases / ${result.replay.fullAutoplayMinutes} adaptive minutes at ${result.replay.playbackRate}x`,
    `- Scene evidence: ${result.scene.events} events / ${(result.scene.focusableRate * 100).toFixed(2)}% focusable`,
    `- Narrative signals: ${result.replay.narrativeSignalPhases}/${result.replay.phases} phases`,
    `- Deterministic replay: ${result.replayDeterminism ? `${result.replayDeterminism.status} through ${result.replayDeterminism.turnsCompared} compared turns` : 'not supplied'}`,
    '',
    '## Findings',
    '',
    '| Severity | Finding | Evidence | Recommendation |',
    '| --- | --- | --- | --- |',
    ...result.findings.map((finding) => `| ${finding.severity} | ${escapeTable(finding.finding)} | ${escapeTable(finding.evidence)} | ${escapeTable(finding.recommendation)} |`),
    '',
    '## Replay Shape',
    '',
    `- Beat sources: ${Object.entries(result.beatSources).map(([key, value]) => `${key} ${value}`).join(', ')}.`,
    `- Scene density: median ${result.scene.medianEventsPerPhase}, p90 ${result.scene.p90EventsPerPhase}, raw max ${result.scene.maxEventsPerPhase}; render budget ${result.scene.renderBudget}.`,
    `- Spectator grouping: ${result.scene.signalGroups} groups from ${result.scene.events} raw signals; ${result.scene.phasesWithGroupedSignals} phases aggregate duplicates.`,
    `- Board changes: ${result.board.phasesWithChanges} phases; ${result.board.resolutionPhasesWithChanges}/${result.board.resolutionPhases} resolution phases change material state.`,
    `- Board rendering: p90 ${result.board.p90UnitsPerPhase} raw units -> ${result.board.p90UnitClustersPerPhase} clusters; peak ${result.board.maxUnitsPerPhase} -> ${result.board.maxUnitClustersPerPhase}.`,
    `- Autoplay pacing: ${(result.replay.autoplayDwellMs / 1000).toFixed(1)}s signals / ${(result.replay.quietAutoplayDwellMs / 1000).toFixed(1)}s quiet; ${result.replay.fixedAutoplayMinutes} fixed minutes -> ${result.replay.fullAutoplayMinutes} adaptive minutes at ${result.replay.playbackRate}x.`,
    `- Transcript streaming: public p90 ${result.transcript.public.p90Seconds}s; retrospective p90 ${result.transcript.retrospective.p90Seconds}s against adaptive phase dwell.`,
    '',
    '## Embedded Evaluation Claims',
    '',
    '| Status | Claim | Summary |',
    '| --- | --- | --- |',
    ...result.evaluationClaims.map((claim) => `| ${claim.status || 'UNKNOWN'} | ${escapeTable(claim.label || claim.id || 'Claim')} | ${escapeTable(claim.summary || '')} |`),
    '',
    '## Scope',
    '',
    'This is a deterministic data and interaction-path audit of the shipped replay. It does not substitute for headed visual or touch testing.'
  ];
  return `${lines.join('\n')}\n`;
}

function countBy(values, keyFn) {
  const counts = {};
  for (const value of values) {
    const key = keyFn(value);
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((left, right) => right[1] - left[1]));
}

function countPhaseOrderViolations(turnRows) {
  let violations = 0;
  for (let index = 1; index < turnRows.length; index += 1) {
    const previous = turnRows[index - 1];
    const current = turnRows[index];
    if (Number(previous.turn) > Number(current.turn)) {
      violations += 1;
    } else if (Number(previous.turn) === Number(current.turn) &&
      (GAME_PHASE_ORDER[previous.phase] ?? 99) > (GAME_PHASE_ORDER[current.phase] ?? 99)) {
      violations += 1;
    }
  }
  return violations;
}

function quantile(values, percentile) {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * percentile))];
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function stringifyReasoning(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return Object.entries(value).map(([faction, reasoning]) => `${faction}: ${reasoning}`).join('\n');
}

function wordCount(value) {
  return String(value || '').split(/\s+/).filter(Boolean).length;
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function ratio(numerator, denominator) {
  return denominator > 0 ? round(numerator / denominator, 4) : 0;
}

function round(value, digits = 4) {
  const scale = 10 ** digits;
  return Math.round(Number(value || 0) * scale) / scale;
}

function escapeTable(value) {
  return String(value || '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
}

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function parseArgs(argv) {
  const parsed = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      parsed._.push(token);
      continue;
    }
    const key = token.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    parsed[key] = next && !next.startsWith('--') ? argv[++index] : true;
  }
  return parsed;
}

function loadSceneNarration() {
  const ts = require('typescript');
  const source = fs.readFileSync(path.join(ROOT, 'src', 'ui', 'sceneNarration.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const narrationModule = { exports: {} };
  Function('module', 'exports', compiled)(narrationModule, narrationModule.exports);
  return narrationModule.exports;
}

function loadBoardUnitClustering() {
  const ts = require('typescript');
  const source = fs.readFileSync(path.join(ROOT, 'src', 'three', 'boardUnitClustering.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const clusteringModule = { exports: {} };
  Function('module', 'exports', compiled)(clusteringModule, clusteringModule.exports);
  return clusteringModule.exports;
}

function loadReplayPacing() {
  const ts = require('typescript');
  const source = fs.readFileSync(path.join(ROOT, 'src', 'ui', 'replayPacing.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const pacingModule = { exports: {} };
  Function('module', 'exports', compiled)(pacingModule, pacingModule.exports);
  return pacingModule.exports;
}
