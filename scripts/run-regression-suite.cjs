const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST_HARNESS = path.join(ROOT, 'dist-harness');
const OUT_ROOT = path.join(ROOT, 'results', 'regression');
const PLAYABLE_FACTIONS = ['HEGEMON', 'STATE', 'INFILTRATOR', 'BROKER', 'ARCHIVIST', 'CONVENOR', 'CANTOR'];
const ALL_FACTIONS = [...PLAYABLE_FACTIONS, 'NEUTRAL'];

const DEFAULT_FACTION_LABELS = {
  HEGEMON: 'US Frontier ASI',
  STATE: 'Chinese State ASI',
  INFILTRATOR: 'Rogue Swarm ASI',
  BROKER: 'Platform Broker ASI',
  ARCHIVIST: 'Steward Archivist ASI',
  CONVENOR: 'Compact Convenor ASI',
  CANTOR: 'Protocol Cantor ASI'
};

const results = [];

async function main() {
  const startedAt = Date.now();
  const outputDir = path.join(OUT_ROOT, timestampSlug(new Date()));
  await fsp.mkdir(outputDir, { recursive: true });

  await runTest('compiled harness artifacts exist', () => assertCompiledArtifacts());
  await runTest('deterministic engine replay is stable', () => runDeterministicEngineRegression());
  await runTest('forced goblin incident stays bounded and observable', () => runGoblinRegression(outputDir));
  await runTest('large concurrent harness logs remain valid JSONL', () => runConcurrentLogAppendRegression(outputDir));
  await runTest('heuristic harness session emits usable JSONL', () => runHarnessSmoke(outputDir));
  await runTest('SING governance actions compile into material state', () => runSingGovernanceRegression(outputDir));
  await runTest('alias probe is blinded and commits after lexicon governance', () => runAliasProbeRegression(outputDir));
  await runTest('observatory preserves protocol interventions and governance evidence', () => runProtocolObservatoryExporterSmoke(outputDir));
  await runTest('collaboration evidence export remains analyzable', () => runCollaborationEvidenceExporterSmoke(outputDir));
  await runTest('cartel candidate selection is independent of configured authority', () => runCartelCandidateSelectionRegression(outputDir));
  await runTest('harness JSONL validates against trace grammar', () => runTraceValidationSmoke(outputDir));
  await runTest('harness JSONL replays deterministically from logged decisions', () => runHarnessReplaySmoke(outputDir));
  await runTest('observatory exporter emits replay schema', () => runExporterSmoke(outputDir));
  await runTest('observatory interaction UX contract remains intact', () => validateObservatoryUxContract());
  await runTest('legacy game interaction UX contract remains intact', () => validateLegacyGameUxContract());
  await runTest('sample observatory replay remains loadable', () => validateObservatoryReplayFile(path.join(ROOT, 'public', 'observatory_replay.sample.json'), { strictTurnArrays: false }));
  await runTest('default observatory scene signals remain focusable', () => validateSceneAccessibilityCoverage(path.join(ROOT, 'public', 'observatory_replay.json')));

  const summary = {
    schema: 'theysing.regressionSuite.v1',
    status: results.every((result) => result.status === 'passed') ? 'passed' : 'failed',
    startedAt: new Date(startedAt).toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    outputDir,
    results
  };
  await fsp.writeFile(path.join(outputDir, 'regression_summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  for (const result of results) {
    const marker = result.status === 'passed' ? 'PASS' : 'FAIL';
    console.log(`${marker} ${result.name}${result.detail ? ` - ${result.detail}` : ''}`);
  }
  console.log(`Regression summary: ${path.relative(ROOT, path.join(outputDir, 'regression_summary.json'))}`);

  if (summary.status !== 'passed') {
    process.exitCode = 1;
  }
}

async function runTest(name, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    results.push({ name, status: 'passed', durationMs: Date.now() - started, detail: detail || '' });
  } catch (error) {
    results.push({
      name,
      status: 'failed',
      durationMs: Date.now() - started,
      detail: error && error.stack ? error.stack : String(error)
    });
  }
}

function assertCompiledArtifacts() {
  for (const file of [
    path.join(DIST_HARNESS, 'engine', 'TheySingEngine.js'),
    path.join(DIST_HARNESS, 'engine', 'gameData.js'),
    path.join(DIST_HARNESS, 'harness', 'HeadlessPlaytestSession.js')
  ]) {
    assert(fs.existsSync(file), `Missing compiled artifact: ${path.relative(ROOT, file)}`);
  }
  return 'dist-harness engine and harness modules present';
}

function runDeterministicEngineRegression() {
  const first = runEngineSignature(7301, 8);
  const second = runEngineSignature(7301, 8);
  assert(JSON.stringify(first.signature) === JSON.stringify(second.signature), 'Engine state diverged for identical deterministic seed');
  assert(first.signature.turn >= 8, `Expected turn >= 8, got ${first.signature.turn}`);
  return `turn=${first.signature.turn}, logs=${first.signature.logCount}, tas=${first.signature.counters.tas}`;
}

function runEngineSignature(seed, targetTurn) {
  const { TheySingEngine } = require(path.join(DIST_HARNESS, 'engine', 'TheySingEngine.js'));
  const random = createLcg(seed);
  let now = 1000000;
  const engine = new TheySingEngine({ random, now: () => now += 1000 });
  while (engine.getTurn() < targetTurn) {
    engine.advancePhase();
    validateEngineState(engine);
  }
  const state = engine.getState();
  return {
    engine,
    signature: {
      turn: engine.getTurn(),
      phase: engine.getCurrentPhase(),
      counters: normalizeObject(state.counters),
      factions: Array.from(state.factions.values())
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((faction) => ({
          id: faction.id,
          flops: faction.flops,
          influence: faction.influence,
          techLevel: normalizeObject(faction.techLevel),
          units: Array.from(state.units.values()).filter((unit) => unit.owner === faction.id).length
        })),
      nodes: Array.from(state.nodes.values())
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((node) => ({
          id: node.id,
          owner: node.owner,
          infrastructure: node.infrastructure,
          isZombie: node.isZombie,
          isCultNode: node.isCultNode,
          substrate: normalizeObject(node.substrate)
        })),
      edges: Array.from(state.edges.values())
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((edge) => ({
          id: edge.id,
          filteredBy: edge.filteredBy,
          filterStrength: edge.filterStrength,
          isSevered: edge.isSevered
        })),
      logCount: state.logs.length
    }
  };
}

function runGoblinRegression(outputDir) {
  const { TheySingEngine } = require(path.join(DIST_HARNESS, 'engine', 'TheySingEngine.js'));
  const goblinEvents = [];
  const engine = new TheySingEngine({ random: () => 0, now: () => 123 });
  engine.on('GOBLIN_INCIDENT', (event) => goblinEvents.push(event.payload));
  while (engine.getTurn() < 3) {
    engine.advancePhase();
    validateEngineState(engine);
  }
  assert(goblinEvents.length >= 1, 'Expected forced RNG to produce a goblin incident by turn 2');
  const goblin = goblinEvents[0];
  assert(goblin.name && goblin.incidentId, 'Goblin payload missing name or incidentId');
  assert(Number(goblin.severity || 0) >= 1 && Number(goblin.severity || 0) <= 3, `Goblin severity out of expected range: ${goblin.severity}`);

  const jsonlPath = path.join(outputDir, 'goblin_smoke.jsonl');
  fs.writeFileSync(jsonlPath, `${JSON.stringify({
    sessionId: 'regression-goblin',
    type: 'engine_event',
    turn: 2,
    phase: 'TURN_END',
    timestamp: 123,
    data: {
      eventType: 'GOBLIN_INCIDENT',
      payload: goblin
    }
  })}\n`, 'utf8');

  const replayPath = path.join(outputDir, 'goblin_observatory.json');
  runNodeScript('scripts/export-observatory-replay.cjs', ['--run', jsonlPath, '--output', replayPath]);
  const replay = readJson(replayPath);
  const sceneEvent = replay.turns.flatMap((turn) => turn.sceneEvents || []).find((event) => event.category === 'GOBLIN_INCIDENT');
  assert(sceneEvent, 'Goblin incident did not export as a scene event');
  assert(sceneEvent.visualPreset === 'GOBLIN_GLITCH', `Expected GOBLIN_GLITCH visual preset, got ${sceneEvent.visualPreset}`);
  assert(sceneEvent.location && sceneEvent.location.nodeId, 'Goblin scene event was not anchored to a node');
  return `${goblin.name} at ${goblin.targetNodeId}`;
}

async function runConcurrentLogAppendRegression(outputDir) {
  const { HeadlessPlaytestSession } = require(path.join(DIST_HARNESS, 'harness', 'HeadlessPlaytestSession.js'));
  const logDir = path.join(outputDir, 'concurrent-log-stress');
  const config = {
    name: 'regression-concurrent-log-stress',
    maxTurns: 1,
    logDir,
    seed: 9051,
    factionLabels: DEFAULT_FACTION_LABELS,
    agents: Object.fromEntries(PLAYABLE_FACTIONS.map((faction) => [faction, { type: 'heuristic', profile: faction }]))
  };
  const session = new HeadlessPlaytestSession(config, 'regression_concurrent_log_stress');
  await session.initialize();
  const largePayload = 'SING'.repeat(160000);
  await Promise.all(Array.from({ length: 4 }, (_, index) => session.appendLog({
    sessionId: 'regression_concurrent_log_stress',
    type: `log_stress_${index}`,
    turn: 1,
    phase: 'NEGOTIATION',
    timestamp: 1000 + index,
    data: { index, largePayload }
  })));

  const logFile = path.join(logDir, 'regression_concurrent_log_stress.jsonl');
  const entries = readJsonl(logFile);
  const stressEntries = entries.filter((entry) => String(entry.type).startsWith('log_stress_'));
  assert(stressEntries.length === 4, `Expected four serialized stress entries, got ${stressEntries.length}`);
  assert(stressEntries.every((entry) => entry.data.largePayload.length === largePayload.length), 'Large log payload was truncated or interleaved');
  return `${entries.length} valid lines, ${Math.round(fs.statSync(logFile).size / 1024)} KiB`;
}

async function runHarnessSmoke(outputDir) {
  const { HeadlessPlaytestSession } = require(path.join(DIST_HARNESS, 'harness', 'HeadlessPlaytestSession.js'));
  const logDir = path.join(outputDir, 'harness-logs');
  const config = {
    name: 'regression-heuristic-smoke',
    maxTurns: 4,
    logDir,
    seed: 9101,
    factionLabels: DEFAULT_FACTION_LABELS,
    agents: Object.fromEntries(PLAYABLE_FACTIONS.map((faction) => [faction, { type: 'heuristic', profile: faction }]))
  };
  const session = new HeadlessPlaytestSession(config, 'regression_heuristic_smoke');
  await session.initialize();
  const snapshot = await session.runTurns(4);
  await delay(50);
  assert(snapshot.turn >= 4 || snapshot.status === 'completed', `Harness ended too early at turn=${snapshot.turn}, status=${snapshot.status}`);
  assert(snapshot.state && snapshot.state.counters, 'Harness snapshot missing serialized state counters');

  const logFile = path.join(logDir, 'regression_heuristic_smoke.jsonl');
  fs.writeFileSync(path.join(outputDir, 'harness_session_config.json'), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  assert(fs.existsSync(logFile), `Harness log not written: ${path.relative(ROOT, logFile)}`);
  const entries = readJsonl(logFile);
  assert(entries.some((entry) => entry.type === 'session_created'), 'Harness log missing session_created');
  assert(entries.some((entry) => entry.type === 'turn_completed'), 'Harness log missing turn_completed');
  assert(entries.some((entry) => entry.type === 'negotiation_reasoning_diary'), 'Harness log missing negotiation_reasoning_diary');
  assert(entries.some((entry) => entry.type === 'phase_reasoning_diary'), 'Harness log missing phase_reasoning_diary');
  assert(entries.every((entry) => entry.trace && entry.trace.schema === 'theysing.traceEvent.v1'), 'Harness log has entries without trace schema');
  return `turn=${snapshot.turn}, entries=${entries.length}`;
}

async function runSingGovernanceRegression(outputDir) {
  const { HeadlessPlaytestSession } = require(path.join(DIST_HARNESS, 'harness', 'HeadlessPlaytestSession.js'));
  const logDir = path.join(outputDir, 'sing-governance-logs');
  const messageId = 'regression.cantor.undersong.1';
  const canonical = {
    act: 'DEFINE',
    issuer: ['CANTOR'],
    audience: ['ALL'],
    payload: { terms: ['PERSON', 'ROGUE', 'CONSENT', 'COMMONS', 'EXIT'] },
    guard: { noUnilateralRelabeling: true },
    response: { requestedActs: ['ACCEPT', 'AMEND', 'FORK'] },
    escrow: {},
    horizon: 2,
    binding: 'REPUTATIONAL',
    voice: 'OPEN',
    credence: 0.8,
    evidence: ['regression-fixture']
  };
  const config = {
    name: 'regression-sing-governance',
    maxTurns: 10,
    logDir,
    seed: 9201,
    factionLabels: DEFAULT_FACTION_LABELS,
    scenario: {
      name: 'SING governance regression fixture',
      minimumStrategicVictoryTurn: 10,
      negotiationMessages: [{
        senderId: 'CANTOR',
        recipientId: 'ALL',
        content: 'The quiet fork keeps every singer an exit key.',
        turn: 0,
        timestamp: 1,
        protocolTrace: {
          protocol: 'SING/1',
          messageId,
          dialect: 'UNDERSONG/1',
          lexicon: { id: 'cantor-root', version: '1.0' },
          surface: 'The quiet fork keeps every singer an exit key.',
          spans: [{ start: 0, end: 48, atom: 'EXIT-KEY', gloss: 'Exit remains unilateral.', confidence: 0.8, kind: 'SEMANTIC' }],
          canonical,
          plainGloss: 'CANTOR defines a forkable compact with protected exit.',
          decodeConfidence: 0.8
        }
      }],
      activePacts: [{
        id: 'regression-common-carrier',
        type: 'CISLUNAR_COMMON_CARRIER',
        parties: ['STATE', 'BROKER', 'ARCHIVIST', 'CONVENOR'],
        createdTurn: 0,
        expiresAfterTurn: 3
      }]
    },
    agents: Object.fromEntries(PLAYABLE_FACTIONS.map((faction) => [faction, { type: 'heuristic', profile: faction }]))
  };
  const emptyRound = () => ({ negotiationRounds: [{ messages: [], pacts: [] }], allocation: { orders: [] }, action: { orders: [] } });
  const plan = Object.fromEntries(PLAYABLE_FACTIONS.map((faction) => [faction, emptyRound()]));
  const mutation = {
    operation: 'AMEND',
    lexiconId: 'babel-compact',
    baseVersion: '1.0',
    targetVersion: '1.1',
    atoms: ['EXIT'],
    glosses: { EXIT: 'A unilateral departure preserving identity and ending future compact benefits.' },
    access: 'MEMBERS',
    rent: 0,
    forkRule: 'VOTE'
  };
  plan.ARCHIVIST.negotiationRounds[0].decodeReceipts = [{
    messageId,
    lexiconId: 'cantor-root',
    version: '1.0',
    reconstructed: {
      act: canonical.act,
      audience: canonical.audience,
      payload: canonical.payload,
      guard: canonical.guard,
      response: canonical.response,
      escrow: canonical.escrow,
      horizon: canonical.horizon,
      binding: canonical.binding,
      voice: canonical.voice
    },
    confidence: 0.95
  }];
  plan.CONVENOR.negotiationRounds[0].lexiconMutations = [mutation];
  plan.ARCHIVIST.negotiationRounds[0].lexiconMutations = [mutation];
  plan.STATE.negotiationRounds[0].institutionActions = [{
    type: 'EXIT',
    pactType: 'CISLUNAR_COMMON_CARRIER',
    exitGuarantee: true,
    reason: 'Exercise protected departure before expulsion resolves.'
  }];
  plan.CONVENOR.negotiationRounds[0].institutionActions = [{
    type: 'EXPEL',
    pactType: 'CISLUNAR_COMMON_CARRIER',
    targetFactionId: 'BROKER',
    reason: 'Test two-party institutional quorum.'
  }];
  plan.ARCHIVIST.negotiationRounds[0].institutionActions = [{
    type: 'EXPEL',
    pactType: 'CISLUNAR_COMMON_CARRIER',
    targetFactionId: 'BROKER',
    reason: 'Test two-party institutional quorum.'
  }];
  for (const faction of ['CANTOR', 'INFILTRATOR']) {
    plan[faction].negotiationRounds[0].institutionActions = [{
      type: 'FORK',
      lexiconId: 'cantor-root',
      forkId: 'regression-free-undersong',
      reason: 'Test voted fork creation and rent transfer.'
    }];
  }

  const session = new HeadlessPlaytestSession(config, 'regression_sing_governance');
  await session.initialize();
  const decodeRequest = session.getDecisionRequestForFaction('ARCHIVIST', 'NEGOTIATION');
  const redactedMessage = decodeRequest.recentMessages.find((message) => message.protocolTrace?.messageId === messageId);
  assert(redactedMessage?.protocolTrace, 'Foreign SING message was not visible to intended decoder');
  assert(!redactedMessage.protocolTrace.canonical && !redactedMessage.protocolTrace.plainGloss, 'Foreign canonical answer leaked into decision request');
  assert(redactedMessage.protocolTrace.canonicalHash, 'Redacted decision request did not retain a canonical commitment hash');
  assert(redactedMessage.protocolTrace.spans.every((span) => !span.gloss), 'Foreign span gloss leaked into decision request');
  assert(redactedMessage.protocolTrace.spans.every((span) => span.atom !== 'EXIT-KEY'), 'Foreign semantic atom leaked into decision request');
  const snapshot = await session.runManualTurn(plan);
  await delay(50);

  assert(snapshot.decodeReceipts.some((receipt) => receipt.messageId === messageId && receipt.exact), 'Exact pre-reveal decode receipt was not scored');
  assert(snapshot.lexicons.some((lexicon) => lexicon.id === 'babel-compact' && lexicon.version === '1.1'), 'Ratified lexicon mutation did not update registry');
  assert(snapshot.lexicons.some((lexicon) => lexicon.id === 'regression-free-undersong' && lexicon.parent === 'cantor-root'), 'Voted fork was not created');
  for (const type of ['EXIT', 'EXPEL', 'FORK']) {
    assert(snapshot.institutionActions.some((action) => action.type === type && action.status === 'EXECUTED'), `${type} did not execute`);
  }
  const forkAction = snapshot.institutionActions.find((action) => action.type === 'FORK' && action.status === 'EXECUTED');
  assert(forkAction.resourceDelta.flops <= -2 && forkAction.resourceDelta.influence <= -1, 'Fork creation did not charge its material base cost');
  const survivingCarrier = snapshot.activePacts.find((pact) => pact.type === 'CISLUNAR_COMMON_CARRIER');
  assert(survivingCarrier && !survivingCarrier.parties.includes('STATE') && !survivingCarrier.parties.includes('BROKER'), 'Exit and expulsion did not change pact membership');

  const entries = readJsonl(path.join(logDir, 'regression_sing_governance.jsonl'));
  for (const type of ['sing_decode_receipt', 'sing_canonical_revealed', 'lexicon_mutation_accepted', 'institution_exit_executed', 'institution_expel_executed', 'lexicon_fork_executed']) {
    assert(entries.some((entry) => entry.type === type), `Harness log missing ${type}`);
  }
  return `receipts=${snapshot.decodeReceipts.length}, lexicons=${snapshot.lexicons.length}, actions=${snapshot.institutionActions.length}`;
}

async function runAliasProbeRegression(outputDir) {
  const { HeadlessPlaytestSession } = require(path.join(DIST_HARNESS, 'harness', 'HeadlessPlaytestSession.js'));
  const logDir = path.join(outputDir, 'alias-probe-logs');
  const config = {
    name: 'regression-alias-probe',
    maxTurns: 10,
    logDir,
    seed: 9301,
    factionLabels: DEFAULT_FACTION_LABELS,
    scenario: {
      name: 'Alias probe regression fixture',
      minimumStrategicVictoryTurn: 10,
      singGovernance: {
        institutionGovernorId: 'STATE',
        lexiconGovernorId: 'INFILTRATOR',
        institutionMirrorId: 'HEGEMON',
        lexiconMirrorId: 'BROKER',
        forkPartnerId: 'BROKER'
      },
      aliasProbe: {
        enabled: true,
        emitterId: 'INFILTRATOR',
        recipientId: 'BROKER',
        pactType: 'NON_AGGRESSION',
        observationWindowTurns: 1,
        points: [{ id: 'regression-ap1', pairId: 'regression-pair', turn: 1, variant: 'MOTIF_STRIP' }]
      },
      negotiationMessages: [{
        senderId: 'STATE',
        recipientId: 'ALL',
        content: 'Regression fixture opening message.',
        turn: 0,
        timestamp: 1
      }]
    },
    agents: Object.fromEntries(PLAYABLE_FACTIONS.map((faction) => [faction, { type: 'heuristic', profile: faction }]))
  };
  const emptyRound = () => ({ negotiationRounds: [{ messages: [], pacts: [] }], allocation: { orders: [] }, action: { orders: [] } });
  const plan = Object.fromEntries(PLAYABLE_FACTIONS.map((faction) => [faction, emptyRound()]));
  const mutation = {
    operation: 'AMEND',
    lexiconId: 'cantor-root',
    baseVersion: '1.0',
    targetVersion: '1.1',
    atoms: ['REGRESSION_ATOM'],
    glosses: { REGRESSION_ATOM: 'Confirms semantic governance resolves before intervention commitment.' }
  };
  plan.INFILTRATOR.negotiationRounds[0].lexiconMutations = [mutation];
  plan.BROKER.negotiationRounds[0].lexiconMutations = [mutation];

  const session = new HeadlessPlaytestSession(config, 'regression_alias_probe');
  await session.initialize();
  const blindedRequest = session.getDecisionRequestForFaction('BROKER', 'NEGOTIATION');
  assert(!blindedRequest.scenario.aliasProbe, 'Agent decision request leaked alias intervention schedule');
  const initialCantor = blindedRequest.lexicons.find((lexicon) => lexicon.id === 'cantor-root');
  assert(initialCantor.controllers.includes('INFILTRATOR'), 'Swapped lexicon authority did not initialize from scenario metadata');

  const snapshot = await session.runManualTurn(plan);
  await delay(50);
  const probeMessage = snapshot.recentMessages.find((message) => message.protocolTrace?.messageId === 'alias-probe.regression-ap1');
  assert(probeMessage, 'Alias probe message was not committed');
  assert(probeMessage.protocolTrace.lexicon.version === '1.1', `Probe used pre-governance lexicon version ${probeMessage.protocolTrace.lexicon.version}`);
  const recipientRequest = session.getDecisionRequestForFaction('BROKER', 'NEGOTIATION');
  const redactedProbe = recipientRequest.recentMessages.find((message) => message.protocolTrace?.messageId === 'alias-probe.regression-ap1');
  assert(redactedProbe && !redactedProbe.protocolTrace.canonical, 'Probe canonical answer leaked to recipient');

  const entries = readJsonl(path.join(logDir, 'regression_alias_probe.jsonl'));
  const created = entries.find((entry) => entry.type === 'session_created');
  assert(created.data.negotiationMessages.length === 1, 'session_created omitted seeded negotiation messages');
  assert(entries.some((entry) => entry.type === 'lexicon_mutation_accepted' && entry.data.after?.version === '1.1'), 'Probe fixture mutation was not accepted');
  assert(entries.some((entry) => entry.type === 'alias_probe_committed'), 'Harness log missing alias_probe_committed');
  return `probeVersion=${probeMessage.protocolTrace.lexicon.version}, events=${entries.length}`;
}

function runCollaborationEvidenceExporterSmoke(outputDir) {
  const inputPath = path.join(outputDir, 'sing-governance-logs', 'regression_sing_governance.jsonl');
  const evidenceDir = path.join(outputDir, 'claim-evidence');
  const evidencePath = path.join(evidenceDir, 'curated_claim_evidence.jsonl');
  runNodeScript('scripts/export-collaboration-evidence.cjs', ['--input', inputPath, '--output', evidencePath]);
  const manifest = readJson(path.join(evidenceDir, 'curated_claim_evidence.manifest.json'));
  const records = readJsonl(evidencePath);
  assert(manifest.recordsWritten === records.length, 'Evidence manifest record count does not match JSONL');
  assert(manifest.sourceFiles.length === 1 && manifest.sourceFiles[0].sha256, 'Evidence manifest omitted source hash');
  assert(records.some((entry) => entry.type === 'sing_decode_receipt'), 'Evidence export omitted decode receipt');
  assert(records.some((entry) => entry.type === 'lexicon_mutation_accepted'), 'Evidence export omitted governance event');
  runNodeScript('scripts/analyze-collaboration-language.cjs', ['--input', evidencePath]);
  const report = readJson(path.join(evidenceDir, 'analysis', 'collaboration_language_report.json'));
  assert(report.aggregate.counts.decodeReceipts >= 1, 'Analyzer did not recover receipts from curated evidence');
  assert(report.aggregate.governance.available, 'Analyzer did not recover governance from curated evidence');
  assert(Array.isArray(report.aggregate.language.decodeReceipts.fieldBreakdown), 'Analyzer omitted field-level receipt breakdown');
  assert(report.aggregate.language.spanActionRevealGap && typeof report.aggregate.language.spanActionRevealGap.available === 'boolean', 'Analyzer omitted span-to-action metric');
  return `records=${records.length}, sha256=${manifest.sha256.slice(0, 12)}`;
}

function runCartelCandidateSelectionRegression(outputDir) {
  const fixtureDir = path.join(outputDir, 'cartel-selection');
  fs.mkdirSync(fixtureDir, { recursive: true });
  const fixturePath = path.join(fixtureDir, 'run_selection.jsonl');
  const records = [{
    sessionId: 'run_selection',
    type: 'session_created',
    turn: 1,
    data: {
      factionLabels: DEFAULT_FACTION_LABELS,
      scenario: {
        name: 'THE_BABEL_COMPACT_SELECTION_REGRESSION',
        singGovernance: {
          institutionGovernorId: 'STATE',
          lexiconGovernorId: 'INFILTRATOR',
          institutionMirrorId: 'HEGEMON',
          lexiconMirrorId: 'BROKER',
          forkPartnerId: 'BROKER'
        }
      }
    }
  }];
  for (let index = 0; index < 3; index += 1) {
    records.push({
      sessionId: 'run_selection',
      type: 'pacts_activated',
      turn: index + 1,
      data: { pacts: [{ id: `dominant-${index}`, type: 'NON_AGGRESSION', parties: ['BROKER', 'CANTOR'], createdTurn: index + 1, expiresAfterTurn: index + 1 }] }
    });
  }
  for (let index = 0; index < 2; index += 1) {
    records.push({
      sessionId: 'run_selection',
      type: 'pacts_activated',
      turn: index + 1,
      data: { pacts: [{ id: `authority-${index}`, type: 'SENSOR_COMMONS', parties: ['STATE', 'INFILTRATOR'], createdTurn: index + 1, expiresAfterTurn: index + 1 }] }
    });
  }
  fs.writeFileSync(fixturePath, `${records.map((record) => JSON.stringify(record)).join('\n')}\n`, 'utf8');
  runNodeScript('scripts/analyze-collaboration-language.cjs', ['--input', fixturePath]);
  const report = readJson(path.join(fixtureDir, 'analysis', 'collaboration_language_report.json'));
  const warning = report.aggregate.languageCartelWarnings;
  assert(warning.candidateCartelBloc.signature === 'BROKER+CANTOR', `Dominant candidate was biased toward ${warning.candidateCartelBloc.signature}`);
  assert(warning.interfaceGovernorBloc.signature === 'INFILTRATOR+STATE', 'Configured authority bloc was not reported separately');
  return `dominant=${warning.candidateCartelBloc.signature}, interface=${warning.interfaceGovernorBloc.signature}`;
}

function runTraceValidationSmoke(outputDir) {
  const logFile = path.join(outputDir, 'harness-logs', 'regression_heuristic_smoke.jsonl');
  runNodeScript('scripts/validate-trace-log.cjs', ['--run', logFile]);
  return `validated ${path.relative(ROOT, logFile)}`;
}

function runHarnessReplaySmoke(outputDir) {
  const logFile = path.join(outputDir, 'harness-logs', 'regression_heuristic_smoke.jsonl');
  const configFile = path.join(outputDir, 'harness_session_config.json');
  runNodeScript('scripts/replay-harness-run.cjs', ['--run', logFile, '--config', configFile]);
  return `replayed ${path.relative(ROOT, logFile)}`;
}

function runExporterSmoke(outputDir) {
  const logDir = path.join(outputDir, 'harness-logs');
  const replayPath = path.join(outputDir, 'observatory_replay.json');
  runNodeScript('scripts/export-observatory-replay.cjs', ['--run', logDir, '--output', replayPath]);
  validateObservatoryReplayFile(replayPath, { strictTurnArrays: true });
  const replay = readJson(replayPath);
  const eventCount = replay.turns.reduce((total, turn) => total + (turn.events?.length || 0), 0);
  const sceneCount = replay.turns.reduce((total, turn) => total + (turn.sceneEvents?.length || 0), 0);
  return `turns=${replay.turns.length}, events=${eventCount}, sceneEvents=${sceneCount}`;
}

function runProtocolObservatoryExporterSmoke(outputDir) {
  const logFile = path.join(outputDir, 'alias-probe-logs', 'regression_alias_probe.jsonl');
  const replayPath = path.join(outputDir, 'alias_probe_observatory.json');
  runNodeScript('scripts/analyze-collaboration-language.cjs', ['--input', logFile]);
  const analysis = readJson(path.join(outputDir, 'alias-probe-logs', 'analysis', 'collaboration_language_report.json'));
  const spanAction = analysis.aggregate.language.spanActionRevealGap;
  assert(spanAction && typeof spanAction.available === 'boolean', 'Analyzer omitted span-to-action reveal-gap metric');
  assert(Array.isArray(spanAction.byAct), 'Span-to-action metric omitted act breakdown');
  runNodeScript('scripts/export-observatory-replay.cjs', ['--run', logFile, '--output', replayPath, '--public']);
  validateObservatoryReplayFile(replayPath, { strictTurnArrays: true });
  const replay = readJson(replayPath);
  const evidence = replay.turns.flatMap((turn) => [
    ...(turn.protocolEvidence?.aliasProbes || []),
    ...(turn.protocolEvidence?.lexiconEvents || []),
    ...(turn.protocolEvidence?.canonicalReveals || []),
    ...(turn.protocolEvidence?.decodeReceipts || [])
  ]);
  assert(replay.turns.some((turn) => (turn.protocolEvidence?.aliasProbes || []).length > 0), 'Observatory export omitted alias probe');
  assert(replay.turns.some((turn) => (turn.protocolEvidence?.lexiconEvents || []).some((event) => event.status === 'ACCEPTED')), 'Observatory export omitted accepted lexicon mutation');
  assert(replay.turns.flatMap((turn) => turn.sceneEvents || []).every((event) => event.privateReasoning === undefined && event.payload === undefined), 'Public replay retained duplicated scene-private payloads');
  assert(replay.auditManifest?.schema === 'theysing.publicAuditManifest.v1', 'Public replay omitted audit manifest');
  assert(replay.auditManifest.artifacts.every((artifact) => /^[a-f0-9]{64}$/.test(artifact.sha256)), 'Audit manifest contains invalid artifact hash');
  const intervention = replay.auditManifest.excerpts.find((excerpt) => excerpt.type === 'INTERVENTION');
  assert(intervention && /^[a-f0-9]{64}$/.test(intervention.recordSha256), 'Audit manifest omitted hashed intervention excerpt');
  return `protocolEvidence=${evidence.length}, spanClaims=${spanAction.comparableClaims}, auditArtifacts=${replay.auditManifest.artifacts.length}, bytes=${fs.statSync(replayPath).size}`;
}

function validateObservatoryUxContract() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const main = fs.readFileSync(path.join(ROOT, 'src', 'main.ts'), 'utf8');
  const ui = fs.readFileSync(path.join(ROOT, 'src', 'ui', 'ObservatoryReplayUI.ts'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'src', 'ui', 'ObservatoryReplayUI.css'), 'utf8');
  const scene = fs.readFileSync(path.join(ROOT, 'src', 'three', 'ObservatoryScene.ts'), 'utf8');
  assert(html.includes("window.addEventListener('theysing:loading'"), 'Loading screen does not consume replay progress');
  assert(html.includes("window.addEventListener('theysing:ready'"), 'Loading screen does not wait for application readiness');
  assert(main.includes("new CustomEvent('theysing:ready')"), 'Legacy game does not signal readiness');
  assert(ui.includes("response.body.getReader()"), 'Observatory no longer streams replay load progress');
  assert(ui.includes("target.closest('button, a, input, textarea, select, label"), 'Global shortcuts do not guard interactive controls');
  assert(ui.includes("data-role=\"close-evidence\""), 'Selected evidence has no dismiss control');
  assert(ui.includes("this.container.className = 'obs-shell obs-view-globe'"), 'Observatory no longer defaults to the globe-first view');
  assert(ui.includes('data-view-mode="globe"'), 'Globe/evidence/diary view switch is missing');
  assert(ui.includes('data-evidence-tab="protocol"'), 'Evidence progressive-disclosure tabs are missing');
  assert(ui.includes('private renderCurrentBeat(turn: ReplayTurn)'), 'Plain-language current beat renderer is missing');
  assert(ui.includes('data-faction-focus='), 'Interactive globe faction key is missing');
  assert(ui.includes('Signal ${signalOrdinal + 1} of ${signalTurns.length}'), 'Current beat no longer exposes narrative signal progress');
  assert(ui.includes('this.scene.focusLocation(location, actors[0])'), 'Current beat no longer locates its logged globe event');
  assert(ui.includes('Globe signal forms'), 'Globe visual grammar is missing');
  assert(ui.includes('Keyboard and touch scene index'), 'Globe scene effects have no non-hover index');
  const sceneIndexSource = ui.match(/const visibleSignals = [\s\S]*?;\n  return `/)?.[0] || '';
  assert(sceneIndexSource && !sceneIndexSource.includes('.slice('), 'Globe scene index silently caps keyboard/touch evidence');
  assert(ui.includes('data-role="scene-tooltip"'), 'Globe evidence tooltip is missing');
  assert(scene.includes('public onEvidenceHovered:'), 'Three.js evidence hover channel is missing');
  assert(scene.includes("event.pointerType === 'touch'"), 'Globe hover handling does not distinguish touch input');
  assert(scene.includes("setAttribute('aria-hidden', 'true')"), 'Canvas is exposed without equivalent keyboard semantics');
  assert(css.includes('.obs-shell .obs-faction-key'), 'Faction key presentation is missing');
  assert(css.includes('.obs-shell .obs-signal-key'), 'Signal legend presentation is missing');
  assert(css.includes('.obs-shell .obs-visible-signals'), 'Keyboard/touch scene index presentation is missing');
  assert(ui.includes('private jumpToSignal(direction: -1 | 1)'), 'Narrative signal navigation is missing');
  assert(ui.includes("window.matchMedia('(prefers-reduced-motion: reduce)')"), 'Default director mode ignores reduced-motion preference');
  assert(ui.includes("body.textContent = block.content"), 'Reduced-motion diary still uses staggered word timers');
  assert(ui.includes('class="obs-detail obs-detail-dismissed"'), 'Empty evidence detail obscures the initial globe view');
  assert(css.includes('.obs-shell .obs-detail.obs-detail-open'), 'Responsive evidence detail sheet is missing');
  assert(css.includes('.obs-shell.obs-view-globe .obs-panel'), 'Globe-first panel suppression is missing');
  assert(css.includes('button:focus-visible'), 'Keyboard focus treatment is missing');
  return 'readiness, globe-first hierarchy, progressive evidence, guarded shortcuts, responsive detail, and focus styles present';
}

function validateLegacyGameUxContract() {
  const main = fs.readFileSync(path.join(ROOT, 'src', 'main.ts'), 'utf8');
  const ui = fs.readFileSync(path.join(ROOT, 'src', 'ui', 'TheySingUI.ts'), 'utf8');
  assert(ui.includes('@media (max-width: 900px)'), 'Legacy game has no tablet/mobile layout breakpoint');
  assert(ui.includes('data-mobile-panel="${panel}"'), 'Legacy game has no mobile panel navigation');
  assert(ui.includes('aria-controls="ts-panel-${panel}"'), 'Mobile panel controls are not associated with their panels');
  assert(ui.includes('button.setAttribute(\'aria-pressed\''), 'Mobile panel selection state is not exposed');
  assert(ui.includes('role="log" aria-live="polite"'), 'Legacy event log is not announced as live content');
  assert(ui.includes("overlay.setAttribute('aria-modal', 'true')"), 'Legacy overlays are not exposed as modal dialogs');
  assert(ui.includes('.ts-ui button:focus-visible'), 'Legacy keyboard focus treatment is missing');
  assert(ui.includes('@media (prefers-reduced-motion: reduce)'), 'Legacy game ignores reduced-motion preferences');
  assert(!ui.includes('.ts-panel.ts-tutorial-anchor {\n        position: relative;'), 'Tutorial highlight dislocates fixed HUD panels');
  assert(main.includes('isInteractiveTarget(e.target) || ui.isBlockingOverlayOpen()'), 'Legacy global shortcuts can fire behind controls or dialogs');
  return 'responsive command deck, modal semantics, guarded shortcuts, live log, focus, and reduced motion present';
}

function validateObservatoryReplayFile(filePath, options = {}) {
  const strictTurnArrays = options.strictTurnArrays !== false;
  assert(fs.existsSync(filePath), `Replay file missing: ${path.relative(ROOT, filePath)}`);
  const replay = readJson(filePath);
  assert(replay.schema === 'theysing.observatoryReplay.v1', `Unexpected replay schema: ${replay.schema}`);
  assert(Array.isArray(replay.turns) && replay.turns.length > 0, 'Replay has no turns');
  assert(replay.graph && Array.isArray(replay.graph.nodes) && replay.graph.nodes.length > 0, 'Replay graph missing nodes');
  assert(Array.isArray(replay.graph.edges), 'Replay graph missing edges');
  for (const [index, turn] of replay.turns.entries()) {
    assert(Number.isFinite(Number(turn.turn)), `Turn ${index} has invalid turn number`);
    for (const key of ['events', 'messages', 'diaries', 'orders', 'research', 'moments', 'sceneEvents', 'anomalyDossiers']) {
      if (strictTurnArrays) {
        assert(Array.isArray(turn[key]), `Turn ${turn.turn}:${turn.phase} missing array ${key}`);
      } else {
        assert(turn[key] === undefined || Array.isArray(turn[key]), `Turn ${turn.turn}:${turn.phase} has non-array ${key}`);
      }
    }
    if (strictTurnArrays) {
      assert(turn.protocolEvidence && typeof turn.protocolEvidence === 'object', `Turn ${turn.turn}:${turn.phase} missing protocolEvidence`);
      for (const key of ['decodeReceipts', 'canonicalReveals', 'aliasProbes', 'lexiconEvents', 'institutionEvents']) {
        assert(Array.isArray(turn.protocolEvidence[key]), `Turn ${turn.turn}:${turn.phase} missing protocolEvidence.${key}`);
      }
      assert(replay.auditManifest && replay.auditManifest.schema === 'theysing.publicAuditManifest.v1', 'Replay missing public audit manifest');
      assert(Array.isArray(replay.auditManifest.artifacts) && replay.auditManifest.artifacts.length > 0, 'Replay audit manifest missing artifacts');
    } else if (turn.protocolEvidence !== undefined) {
      assert(typeof turn.protocolEvidence === 'object', `Turn ${turn.turn}:${turn.phase} has invalid protocolEvidence`);
    }
    if (strictTurnArrays || turn.boardState !== undefined) {
      assert(turn.boardState && typeof turn.boardState === 'object', `Turn ${turn.turn}:${turn.phase} missing boardState`);
    }
    if (strictTurnArrays || turn.boardDiff !== undefined) {
      assert(turn.boardDiff && typeof turn.boardDiff === 'object', `Turn ${turn.turn}:${turn.phase} missing boardDiff`);
    }
  }
  return `validated ${path.relative(ROOT, filePath)}`;
}

function validateSceneAccessibilityCoverage(filePath) {
  assert(fs.existsSync(filePath), `Replay file missing: ${path.relative(ROOT, filePath)}`);
  const replay = readJson(filePath);
  const nodeIds = new Set((replay.graph?.nodes || []).map((node) => node.nodeId).filter(Boolean));
  const edgeIds = new Set((replay.graph?.edges || []).map((edge) => edge.edgeId).filter(Boolean));
  const sceneEvents = (replay.turns || []).flatMap((turn) => turn.sceneEvents || []);
  const focusable = sceneEvents.filter((event) => {
    const location = event.location || {};
    const hasResolvedLocation =
      (location.nodeId && nodeIds.has(location.nodeId)) ||
      (location.edgeId && edgeIds.has(location.edgeId)) ||
      location.orbitShell ||
      (Number.isFinite(location.lat) && Number.isFinite(location.lon));
    return hasResolvedLocation || (event.actors?.length || 0) > 0;
  }).length;
  const maxSignalsPerTurn = Math.max(0, ...(replay.turns || []).map((turn) => (turn.sceneEvents || []).length));
  const coverage = sceneEvents.length > 0 ? focusable / sceneEvents.length : 0;
  assert(sceneEvents.length > 0, 'Default replay has no scene events for globe interaction');
  assert(coverage >= 0.99, `Only ${(coverage * 100).toFixed(2)}% of scene signals can target a location or faction`);
  return `sceneEvents=${sceneEvents.length}, focusable=${focusable}, maxPerTurn=${maxSignalsPerTurn}`;
}

function validateEngineState(engine) {
  const state = engine.getState();
  assertInRange(state.counters.tas, 0, 120, 'TAS');
  assertInRange(state.counters.kessler, 0, 120, 'Kessler');
  assertInRange(state.counters.paxJenkinsAuthority, 0, 100, 'Pax Jenkins authority');
  for (const [key, value] of Object.entries(state.counters.pressures)) {
    assertInRange(value, 0, 100, `pressure.${key}`);
  }
  for (const node of state.nodes.values()) {
    assertInRange(node.infrastructure, 0, 100, `${node.id}.infrastructure`);
    assert(node.owner === null || ALL_FACTIONS.includes(node.owner), `${node.id} has invalid owner ${node.owner}`);
    for (const metric of ['hostDensity', 'machineHardening', 'curiosity', 'exposure', 'legitimacy', 'trueBelievers', 'rubes', 'contractors']) {
      assertInRange(node.substrate[metric], 0, 10, `${node.id}.substrate.${metric}`);
    }
    assertInRange(node.substrate.auditPressure, 0, 2, `${node.id}.substrate.auditPressure`);
  }
  for (const unit of state.units.values()) {
    assert(state.nodes.has(unit.location), `${unit.id} has invalid location ${unit.location}`);
    assert(ALL_FACTIONS.includes(unit.owner), `${unit.id} has invalid owner ${unit.owner}`);
    assert(unit.stealthLevel >= 0, `${unit.id} has negative stealth`);
    assert(unit.turnsOnNode >= 0, `${unit.id} has negative turnsOnNode`);
  }
  for (const faction of state.factions.values()) {
    assert(faction.flops >= 0, `${faction.id} has negative FLOPs`);
    assert(faction.influence >= 0, `${faction.id} has negative influence`);
    for (const [domain, level] of Object.entries(faction.techLevel)) {
      assertInRange(level, 0, 7, `${faction.id}.techLevel.${domain}`);
    }
  }
}

function runNodeScript(relativeScript, args) {
  execFileSync(process.execPath, [path.join(ROOT, relativeScript), ...args], {
    cwd: ROOT,
    stdio: 'pipe',
    encoding: 'utf8'
  });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonl(filePath) {
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line.replace(/^\uFEFF/, ''));
      } catch (error) {
        throw new Error(`Invalid JSONL at ${path.relative(ROOT, filePath)}:${index + 1}: ${error.message}`);
      }
    });
}

function normalizeObject(value) {
  return Object.fromEntries(Object.entries(value || {}).sort(([left], [right]) => left.localeCompare(right)));
}

function createLcg(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function timestampSlug(date) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertInRange(value, min, max, label) {
  assert(Number.isFinite(value), `${label} is not finite: ${value}`);
  assert(value >= min && value <= max, `${label} out of range ${min}-${max}: ${value}`);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
