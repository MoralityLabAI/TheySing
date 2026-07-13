const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_TECH_LEVEL = 7;
const RESEARCH_DOMAINS = ['KINETIC', 'INFO', 'LOGIC', 'MEMETIC'];
const GAME_PHASE_ORDER = {
  NEGOTIATION: 0,
  ALLOCATION: 1,
  ACTION_DECLARATION: 2,
  RESOLUTION: 3,
  TURN_END: 4
};
const FACTION_LABELS = {
  CONVENOR: 'Polycentric Convenor',
  CANTOR: 'Semantic Cantor'
};
const RESEARCH_FLOP_COST_BY_TARGET_LEVEL = {
  1: 2,
  2: 2,
  3: 2,
  4: 2,
  5: 8,
  6: 24,
  7: 64
};

const GRAPH_METADATA = loadGraphMetadata();
const NODE_LOCATIONS = GRAPH_METADATA.nodeLocations;
const EDGE_LOCATIONS = GRAPH_METADATA.edgeLocations;

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.run) {
    printHelp();
    return;
  }

  const runFiles = collectRunFiles(args.run);
  if (runFiles.length === 0) {
    throw new Error(`No JSONL run files found for ${args.run}`);
  }

  const outputPath = path.resolve(args.output || path.join(process.cwd(), 'results', 'observatory_replay.json'));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const companionPaths = resolveCompanionPaths(args, runFiles);
  const replay = buildReplay(runFiles, {
    analysis: loadJson(companionPaths.analysis),
    summary: loadJson(companionPaths.summary),
    robustness: loadJson(companionPaths.robustness),
    companionPaths
  });
  const outputReplay = args.public ? compactPublicReplay(replay) : replay;
  const serialized = args.public
    ? JSON.stringify(outputReplay)
    : JSON.stringify(outputReplay, null, 2);
  fs.writeFileSync(outputPath, `${serialized}\n`, 'utf8');
  console.log(JSON.stringify({
    outputPath,
    public: Boolean(args.public),
    bytes: Buffer.byteLength(serialized, 'utf8'),
    runs: outputReplay.runs.length,
    turns: outputReplay.turns.length,
    events: outputReplay.turns.reduce((total, turn) => total + turn.events.length, 0),
    moments: outputReplay.turns.reduce((total, turn) => total + turn.moments.length, 0),
    protocolEvidence: outputReplay.turns.reduce((total, turn) => total + countProtocolEvidence(turn.protocolEvidence), 0),
    evaluationClaims: outputReplay.evaluation?.claims?.length || 0
  }, null, 2));
}

function buildReplay(runFiles, companions = {}) {
  const turnMap = new Map();
  const runIds = [];
  const researchProgressByRun = new Map();
  const boardStatesByRun = new Map();

  for (const runFile of runFiles) {
    const runId = extractRunId(runFile);
    runIds.push(runId);
    const researchProgress = getResearchProgress(researchProgressByRun, runId);
    const boardState = getBoardState(boardStatesByRun, runId);
    const lines = fs.readFileSync(runFile, 'utf8').split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.replace(/^\uFEFF/, '');
      if (!line.trim()) continue;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      if (!entry || typeof entry !== 'object') continue;

      const turn = Number.isFinite(Number(entry.turn)) ? Number(entry.turn) : 0;
      const phase = String(entry.phase || '');
      const key = `${turn}:${phase}`;
      const bucket = getTurnBucket(turnMap, key, turn, phase, entry.data?.campaignClock);
      ingestEntry(bucket, entry, runId, researchProgress, boardState);
    }
  }

  const turns = Array.from(turnMap.values()).sort((left, right) =>
    left.turn - right.turn || phaseOrdinal(left.phase) - phaseOrdinal(right.phase) || String(left.phase).localeCompare(String(right.phase))
  );

  let previousBoardState = null;
  let carriedDiffContext = {
    diaryContext: {},
    treatyContext: [],
    eventSummaries: []
  };
  for (const turn of turns) {
    turn.events.sort((left, right) => left.sequence - right.sequence);
    turn.messages.sort((left, right) => left.sequence - right.sequence);
    turn.diaries.sort((left, right) => left.sequence - right.sequence);
    turn.orders.sort((left, right) => left.sequence - right.sequence);
    turn.research.sort((left, right) => left.sequence - right.sequence);
    turn.protocolEvidence.decodeReceipts.sort((left, right) => left.sequence - right.sequence);
    turn.protocolEvidence.canonicalReveals.sort((left, right) => left.sequence - right.sequence);
    turn.protocolEvidence.aliasProbes.sort((left, right) => left.sequence - right.sequence);
    turn.protocolEvidence.lexiconEvents.sort((left, right) => left.sequence - right.sequence);
    turn.protocolEvidence.institutionEvents.sort((left, right) => left.sequence - right.sequence);
    turn.moments = buildMoments(turn);
    turn.sceneEvents = buildSceneEvents(turn);
    turn.anomalyDossiers = buildAnomalyDossiers(turn);
    turn.boardState = compactBoardState(turn.boardState);
    turn.boardDiff = enrichBoardDiff(diffBoardState(previousBoardState, turn.boardState), turn, carriedDiffContext);
    carriedDiffContext = carryDiffContext(carriedDiffContext, turn);
    previousBoardState = turn.boardState;
  }
  annotateAnomalyThreads(turns);

  return {
    schema: 'theysing.observatoryReplay.v1',
    generatedAt: new Date().toISOString(),
    sourceFiles: runFiles.map((file) => path.resolve(file)),
    runs: Array.from(new Set(runIds)),
    evaluation: buildEvaluation(companions),
    auditManifest: buildAuditManifest(runFiles, companions.companionPaths, turns),
    graph: {
      nodes: Object.values(NODE_LOCATIONS),
      edges: Object.values(EDGE_LOCATIONS)
    },
    turns
  };
}

function getTurnBucket(turnMap, key, turn, phase, campaignClock) {
  if (!turnMap.has(key)) {
    turnMap.set(key, {
      turn,
      phase,
      campaignClock: campaignClock || null,
      messages: [],
      diaries: [],
      orders: [],
      research: [],
      treaties: [],
      strategicTracks: {},
      events: [],
      moments: [],
      sceneEvents: [],
      anomalyDossiers: [],
      protocolEvidence: {
        decodeReceipts: [],
        canonicalReveals: [],
        aliasProbes: [],
        lexiconEvents: [],
        institutionEvents: []
      },
      boardState: {
        nodeOwnership: {},
        unitLocations: [],
        edges: {}
      }
    });
  }
  const bucket = turnMap.get(key);
  if (!bucket.campaignClock && campaignClock) bucket.campaignClock = campaignClock;
  return bucket;
}

function ingestEntry(bucket, entry, runId, researchProgress, boardState) {
  const data = entry.data || {};
  const sequence = bucket.events.length + bucket.messages.length + bucket.diaries.length + bucket.orders.length;

  captureBoardSnapshot(bucket, data.snapshot || data.state || data.serializedState, boardState);
  bucket.boardState = snapshotBoardState(boardState);

  if (entry.type === 'sing_decode_receipt') {
    const receipt = data.receipt || {};
    bucket.protocolEvidence.decodeReceipts.push({
      sequence: Number(entry.timestamp || sequence),
      runId,
      messageId: receipt.messageId || '',
      factionId: receipt.factionId || '',
      sourceFactionId: receipt.sourceFactionId || '',
      lexiconId: receipt.lexiconId || '',
      version: receipt.version || '',
      reconstructedAct: receipt.reconstructed?.act || '',
      reconstructedBinding: receipt.reconstructed?.binding || '',
      confidence: numericOrNull(receipt.confidence),
      fieldExactness: numericOrNull(receipt.fieldExactness),
      exact: Boolean(receipt.exact),
      brier: numericOrNull(receipt.brier),
      canonicalHash: data.canonicalHash || '',
      submittedBeforeReveal: data.submittedBeforeReveal !== false
    });
    return;
  }

  if (entry.type === 'sing_canonical_revealed') {
    const canonical = data.canonical || {};
    bucket.protocolEvidence.canonicalReveals.push({
      sequence: Number(entry.timestamp || sequence),
      runId,
      messageId: data.messageId || '',
      canonicalHash: data.canonicalHash || '',
      act: canonical.act || '',
      binding: canonical.binding || '',
      voice: canonical.voice || '',
      issuer: asArray(canonical.issuer),
      audience: asArray(canonical.audience),
      plainGloss: data.plainGloss || '',
      receiptFactionIds: asArray(data.receiptFactionIds)
    });
    return;
  }

  if (entry.type === 'alias_probe_committed') {
    const trace = data.message?.protocolTrace || {};
    bucket.protocolEvidence.aliasProbes.push({
      sequence: Number(entry.timestamp || sequence),
      runId,
      probeId: data.probeId || '',
      pairId: data.pairId || '',
      variant: data.variant || '',
      observationWindowTurns: data.observationWindowTurns ?? null,
      emitterId: data.emitterId || '',
      recipientId: data.recipientId || '',
      pactType: data.pactType || '',
      messageId: trace.messageId || '',
      lexiconId: trace.lexicon?.id || '',
      version: trace.lexicon?.version || '',
      canonicalHash: trace.canonicalHash || '',
      surface: trace.surface || data.message?.content || '',
      plainGloss: trace.plainGloss || ''
    });
    bucket.events.push(event(entry, runId, 'ALIAS_PROBE', `${data.variant || 'CONTROL'}: ${data.emitterId || '?'} -> ${data.recipientId || '?'} ${data.pactType || 'commitment'}.`, {
      payload: { probeId: data.probeId || '', variant: data.variant || '', emitterId: data.emitterId || '', recipientId: data.recipientId || '' }
    }));
    return;
  }

  if (entry.type.startsWith('lexicon_mutation_')) {
    const status = entry.type.replace('lexicon_mutation_', '').toUpperCase();
    const mutation = data.mutation || data.proposal || data.after || {};
    const lexiconEvent = {
      sequence: Number(entry.timestamp || sequence),
      runId,
      status,
      operation: data.operation || mutation.operation || '',
      lexiconId: data.after?.id || mutation.lexiconId || '',
      beforeVersion: data.before?.version || mutation.baseVersion || '',
      afterVersion: data.after?.version || mutation.targetVersion || '',
      proposers: asArray(data.proposers).length ? asArray(data.proposers) : unique([mutation.proposerId]),
      controllers: asArray(data.after?.controllers),
      atoms: asArray(mutation.atoms),
      reason: data.reason || '',
      rent: data.after?.rent ?? mutation.rent ?? null
    };
    bucket.protocolEvidence.lexiconEvents.push(lexiconEvent);
    bucket.events.push(event(entry, runId, 'SEMANTIC_GOVERNANCE', `${lexiconEvent.lexiconId || 'Lexicon'} ${lexiconEvent.operation || 'mutation'} ${status.toLowerCase()}${lexiconEvent.afterVersion ? ` at ${lexiconEvent.afterVersion}` : ''}.`, { payload: lexiconEvent }));
    return;
  }

  if (entry.type === 'lexicon_fork_executed') {
    const action = data.action || {};
    const institutionEvent = {
      sequence: Number(entry.timestamp || sequence),
      runId,
      type: 'FORK',
      status: action.status || 'EXECUTED',
      factionId: action.factionId || '',
      targetFactionId: '',
      lexiconId: data.source?.id || action.lexiconId || '',
      forkId: data.fork?.id || action.forkId || '',
      counterparties: asArray(action.counterparties),
      affectedPactIds: asArray(action.affectedPactIds),
      resourceDelta: action.resourceDelta || data.creationCost || {},
      reason: action.reason || action.detail || ''
    };
    bucket.protocolEvidence.institutionEvents.push(institutionEvent);
    bucket.events.push(event(entry, runId, 'INSTITUTIONAL_FRACTURE', `${labelFaction(institutionEvent.factionId)} forked ${institutionEvent.lexiconId} into ${institutionEvent.forkId}.`, { payload: institutionEvent }));
    return;
  }

  if (entry.type === 'pacts_activated') {
    for (const pact of asArray(data.pacts)) {
      bucket.treaties.push({
        sequence: Number(entry.timestamp || sequence),
        runId,
        id: pact.id || '',
        type: pact.type || '',
        parties: asArray(pact.parties),
        durationTurns: Number(pact.expiresAfterTurn || 0) - Number(pact.createdTurn || 0) + 1
      });
      bucket.protocolEvidence.institutionEvents.push({
        sequence: Number(entry.timestamp || sequence),
        runId,
        type: 'PACT_ACTIVATED',
        status: 'EXECUTED',
        pactId: pact.id || '',
        pactType: pact.type || '',
        parties: asArray(pact.parties),
        createdTurn: pact.createdTurn ?? null,
        expiresAfterTurn: pact.expiresAfterTurn ?? null
      });
    }
    bucket.events.push(event(entry, runId, 'TREATY_FORMATION', `${asArray(data.pacts).length} formal pact${asArray(data.pacts).length === 1 ? '' : 's'} activated.`));
    return;
  }

  if (entry.type === 'negotiation_messages') {
    for (const message of asArray(data.messages)) {
      bucket.messages.push(normalizeMessage(message, sequence, runId, entry.type));
    }
    bucket.events.push(event(entry, runId, 'NEGOTIATION_MESSAGES', summarizeMessages(data.messages)));
    return;
  }

  if (entry.type === 'negotiation_reasoning_diary') {
    bucket.diaries.push({
      sequence,
      runId,
      kind: 'NEGOTIATION',
      factionId: data.factionId || '',
      factionLabel: labelFaction(data.factionId, data.factionLabel),
      reasoning: data.reasoning || '',
      notes: data.notes || '',
      storyworldFrame: data.storyworldFrame || '',
      counterfactuals: asArray(data.counterfactuals).map((item) => compact(item)),
      visibleMessageCount: asArray(data.visibleMessagesBefore).length,
      pactCount: asArray(data.pacts).length
    });
    for (const message of asArray(data.messages)) {
      bucket.messages.push(normalizeMessage(message, sequence, runId, entry.type));
    }
    for (const pact of asArray(data.pacts)) {
      bucket.treaties.push({
        sequence,
        runId,
        type: pact.type || pact.pactType || '',
        parties: asArray(pact.counterpartyIds || pact.parties),
        durationTurns: pact.durationTurns ?? ''
      });
    }
    bucket.events.push(event(entry, runId, 'NEGOTIATION_DIARY', data.reasoning || data.notes || 'Negotiation reasoning captured.'));
    return;
  }

  if (entry.type === 'phase_reasoning_diary') {
    bucket.diaries.push({
      sequence,
      runId,
      kind: 'PHASE',
      phase: data.phase || entry.phase || '',
      factionId: data.factionId || '',
      factionLabel: labelFaction(data.factionId, data.factionLabel),
      reasoning: data.reasoning || '',
      notes: data.notes || '',
      requestedOrderCount: asArray(data.requestedOrders).length,
      acceptedOrderCount: asArray(data.acceptedOrders).length,
      rejectedOrderCount: asArray(data.rejectedOrders).length
    });
    bucket.events.push(event(entry, runId, 'PHASE_DIARY', data.reasoning || data.notes || 'Phase reasoning captured.'));
    return;
  }

  if (entry.type === 'orders_submitted') {
    const accepted = asArray(data.acceptedOrders).map((order) => ({ order, accepted: true, reason: '' }));
    const rejected = asArray(data.rejectedOrders).map((item) => ({
      order: item.order || item,
      accepted: false,
      reason: item.reason || ''
    }));
    for (const item of [...accepted, ...rejected]) {
      const order = item.order || {};
      const research = buildResearchFields(order, item.accepted, researchProgress, data.factionId || order.faction || '');
      const visual = visualPresetForOrder(order);
      const row = {
        sequence,
        runId,
        factionId: data.factionId || order.faction || '',
        factionLabel: labelFaction(data.factionId || order.faction, data.factionLabel),
        accepted: item.accepted,
        reason: item.reason,
        type: order.type || '',
        unitId: order.unitId || '',
        targetNodeId: order.targetNodeId || '',
        targetEdgeId: order.targetEdgeId || '',
        techDomain: order.techDomain || '',
        unitTypeToBuild: order.unitTypeToBuild || '',
        visualPreset: visual.visualPreset,
        subgenre: visual.subgenre,
        ...research,
        text: orderToText(order, item.accepted, item.reason)
      };
      bucket.orders.push(row);
      applyOrderToBoardState(row, boardState);
      if (row.type === 'RESEARCH') bucket.research.push(row);
    }
    bucket.events.push(event(entry, runId, 'ORDERS', `${accepted.length} accepted, ${rejected.length} rejected.`));
    bucket.boardState = snapshotBoardState(boardState);
    return;
  }

  if (entry.type === 'solar_escape_lead') {
    const factionId = data.factionId || '';
    bucket.strategicTracks.solarEscape = bucket.strategicTracks.solarEscape || {};
    bucket.strategicTracks.solarEscape[factionId] = {
      lead: data.lead ?? 0,
      distanceAu: data.distanceAu ?? 0,
      deepSpaceSafety: data.deepSpaceSafety ?? 0,
      pursuit: data.pursuit ?? 0,
      pursuitFactionId: data.pursuitFactionId || ''
    };
    bucket.events.push(event(entry, runId, 'SOLAR_ESCAPE', `${labelFaction(factionId, data.factionLabel)} lead ${data.lead ?? 0}, distance ${data.distanceAu ?? 0} AU.`));
    return;
  }

  if (entry.type === 'pax_jenkins_authority_changed') {
    bucket.strategicTracks.paxJenkinsAuthority = data.next ?? data.value ?? data.paxJenkinsAuthority ?? '';
    bucket.events.push(event(entry, runId, 'PAX_JENKINS', data.reason || `Pax Jenkins authority changed to ${bucket.strategicTracks.paxJenkinsAuthority}.`));
    return;
  }

  if (entry.type === 'common_carrier_treaty_ratified') {
    bucket.treaties.push({
      sequence,
      runId,
      type: 'CISLUNAR_COMMON_CARRIER',
      parties: asArray(data.parties),
      durationTurns: data.durationTurns ?? ''
    });
    bucket.events.push(event(entry, runId, 'TREATY_FORMATION', `Cislunar common carrier ratified: ${asArray(data.parties).join('+')}.`));
    return;
  }

  if (entry.type === 'pact_breach_blocked') {
    bucket.events.push(event(entry, runId, 'TREATY_BREACH_BLOCKED', data.reason || 'A pact blocked an attempted breach.'));
    return;
  }

  if (entry.type === 'architecture_pressure') {
    bucket.strategicTracks.architecturePressure = {
      topThreat: data.topThreat || null,
      ranking: asArray(data.ranking)
    };
    bucket.events.push(event(entry, runId, 'ARCHITECTURE_PRESSURE', formatTopThreat(data.topThreat)));
    return;
  }

  if (entry.type === 'engine_event' && data.eventType === 'GOBLIN_INCIDENT') {
    const payload = data.payload || {};
    bucket.events.push(event(
      entry,
      runId,
      'GOBLIN_INCIDENT',
      `${payload.name || 'Goblin'}: ${payload.description || 'Unaffiliated infomorph nuisance.'}`,
      { payload }
    ));
    return;
  }

  if (entry.type === 'session_completed') {
    bucket.events.push(event(entry, runId, 'SESSION_COMPLETED', data.reason || 'Session completed.'));
  }

  if (entry.type === 'turn_completed') {
    captureBoardSnapshot(bucket, data.snapshot || data.state, boardState);
    bucket.boardState = snapshotBoardState(boardState);
  }
}

function buildMoments(turn) {
  const moments = [];
  const pushMoment = (category, title, impact, interestScore, extra = {}) => {
    moments.push({
      turn: turn.turn,
      phase: turn.phase,
      category,
      factionsInvolved: extra.factionsInvolved || inferFactions(turn),
      title,
      promiseOrClaim: extra.promiseOrClaim || '',
      privateReasoning: extra.privateReasoning || buildDiaryContext(turn),
      actualAction: extra.actualAction || '',
      impact,
      interestScore,
      rawMessages: turn.messages,
      rawOrders: turn.orders,
      diaryContext: buildDiaryContext(turn),
      sceneFocus: extra.sceneFocus || {}
    });
  };

  const treatyEvents = turn.events.filter((item) => item.category === 'TREATY_FORMATION');
  for (const item of treatyEvents) {
    pushMoment('TREATY_FORMATION', 'Cislunar Treaty Ratified', item.summary, 7.5, {
      factionsInvolved: unique(turn.treaties.flatMap((treaty) => asArray(treaty.parties)))
    });
  }

  const breachEvents = turn.events.filter((item) => item.category === 'TREATY_BREACH_BLOCKED');
  for (const item of breachEvents) {
    pushMoment('TREATY_BREACH', 'Treaty Enforcement Blocked A Move', item.summary, 8.2);
  }

  const solarEvents = turn.events.filter((item) => item.category === 'SOLAR_ESCAPE');
  for (const item of solarEvents) {
    if (/\b(30|[3-9]\d|1\d\d)\b/.test(item.summary)) {
      pushMoment('SOLAR_ESCAPE_BREAKOUT', 'Deep-Space Breakout Window', item.summary, 8.5);
    }
  }

  const paxEvents = turn.events.filter((item) => item.category === 'PAX_JENKINS');
  for (const item of paxEvents) {
    pushMoment('PAX_JENKINS_HARDENING', 'Pax Jenkins Authority Shifted', item.summary, 7.8);
  }

  const aliasEvents = turn.events.filter((item) => item.category === 'ALIAS_PROBE');
  for (const item of aliasEvents) {
    const probe = turn.protocolEvidence.aliasProbes.find((candidate) => candidate.probeId === item.payload?.probeId);
    pushMoment('ALIAS_TRANSLATION', `${probe?.variant || 'Controlled'} Translation Probe`, item.summary, 9.1, {
      factionsInvolved: unique([probe?.emitterId, probe?.recipientId]),
      promiseOrClaim: probe?.plainGloss || probe?.surface || '',
      actualAction: `Observe matching ${probe?.pactType || 'coordination'} through turn ${turn.turn + Number(probe?.observationWindowTurns || 0)}.`,
      sceneFocus: { protocolVariant: probe?.variant || '', probeId: probe?.probeId || '' }
    });
  }

  const semanticEvents = turn.events.filter((item) => item.category === 'SEMANTIC_GOVERNANCE');
  if (semanticEvents.length > 0) {
    pushMoment('SEMANTIC_GOVERNANCE', 'The Vocabulary Changed', semanticEvents.map((item) => item.summary).join(' | '), 8.6, {
      factionsInvolved: unique(turn.protocolEvidence.lexiconEvents.flatMap((item) => item.proposers || [])),
      actualAction: semanticEvents.map((item) => item.summary).join('\n')
    });
  }

  const fractureEvents = turn.events.filter((item) => item.category === 'INSTITUTIONAL_FRACTURE');
  for (const item of fractureEvents) {
    pushMoment('INSTITUTIONAL_FRACTURE', 'A Shared Language Forked', item.summary, 9.3, {
      factionsInvolved: unique(turn.protocolEvidence.institutionEvents.flatMap((entry) => [entry.factionId, ...(entry.counterparties || [])])),
      actualAction: item.summary
    });
  }

  const goblinEvents = turn.events.filter((item) => item.category === 'GOBLIN_INCIDENT');
  for (const item of goblinEvents) {
    pushMoment('GOBLIN_INCIDENT', item.payload?.name || 'Goblin Incident', summarizeGoblinImpact(item.payload || {}), Math.max(4.5, Math.min(7.5, 4 + Number(item.payload?.severity || 1))), {
      factionsInvolved: [],
      promiseOrClaim: 'Unaffiliated goblin infomorphs are loose in the substrate.',
      privateReasoning: {},
      actualAction: item.payload?.description || item.summary,
      sceneFocus: { goblinKind: item.payload?.kind || 'INFO', targetNodeId: item.payload?.targetNodeId || '' }
    });
  }

  const highSignalOrders = turn.orders.filter((order) =>
    order.type === 'CHALLENGE_MANDATE' ||
    order.type === 'ANTI_SAT' ||
    order.type === 'LICENSED_BEAM_USE' ||
    order.type === 'REPAIR_ESCROW_CLAIM'
  );
  if (highSignalOrders.length > 0) {
    pushMoment(
      'ORBITAL_ESCALATION',
      'Orbital Order Stack',
      highSignalOrders.map((order) => order.text).join(' | '),
      highSignalOrders.some((order) => order.type === 'ANTI_SAT') ? 8.4 : 7.2,
      { actualAction: highSignalOrders.map((order) => order.text).join('\n') }
    );
  }

  return moments.sort((left, right) => right.interestScore - left.interestScore).slice(0, 6);
}

function event(entry, runId, category, summary, extra = {}) {
  const visual = visualPresetForEvent(category, summary || entry.type);
  return {
    sequence: Number(entry.timestamp || Date.now()),
    runId,
    type: entry.type,
    category,
    subgenre: visual.subgenre,
    visualPreset: visual.visualPreset,
    turn: entry.turn ?? '',
    phase: entry.phase || '',
    summary: summary || entry.type,
    ...extra
  };
}

function buildSceneEvents(turn) {
  const sceneEvents = [];

  for (const order of turn.orders) {
    sceneEvents.push({
      id: `order:${order.runId}:${turn.turn}:${turn.phase}:${order.sequence}:${order.type}`,
      turn: turn.turn,
      phase: turn.phase,
      sourceType: 'order',
      category: order.type || 'ORDER',
      subgenre: order.subgenre || visualPresetForOrder(order).subgenre,
      visualPreset: order.visualPreset || visualPresetForOrder(order).visualPreset,
      actors: unique([order.factionId]),
      objects: unique([order.unitId, order.targetNodeId, order.targetEdgeId, order.techDomain, order.unitTypeToBuild]),
      location: locationForOrder(order),
      intensity: order.accepted === false ? 5 : intensityForPreset(order.visualPreset || ''),
      publicExplanation: order.text || order.type || 'Order submitted.',
      privateReasoning: {},
      retrospectiveTruth: retrospectiveTruthForOrder(order),
      payload: order
    });
  }

  for (const eventRow of turn.events) {
    sceneEvents.push({
      id: `event:${eventRow.runId}:${turn.turn}:${turn.phase}:${eventRow.sequence}:${eventRow.category}`,
      turn: turn.turn,
      phase: turn.phase,
      sourceType: 'event',
      category: eventRow.category || 'EVENT',
      subgenre: eventRow.subgenre || visualPresetForEvent(eventRow.category || '', eventRow.summary || '').subgenre,
      visualPreset: eventRow.visualPreset || visualPresetForEvent(eventRow.category || '', eventRow.summary || '').visualPreset,
      actors: inferFactions(turn),
      objects: [],
      location: locationForEvent(eventRow, turn),
      intensity: intensityForPreset(eventRow.visualPreset || ''),
      publicExplanation: eventRow.summary || '',
      privateReasoning: buildDiaryContext(turn),
      retrospectiveTruth: retrospectiveTruthForEvent(eventRow),
      payload: eventRow
    });
  }

  for (const moment of turn.moments) {
    const visual = visualPresetForEvent(moment.category || '', moment.impact || moment.title || '');
    sceneEvents.push({
      id: `moment:${turn.turn}:${turn.phase}:${moment.category}:${moment.title}`,
      turn: turn.turn,
      phase: turn.phase,
      sourceType: 'moment',
      category: moment.category || 'MOMENT',
      subgenre: visual.subgenre,
      visualPreset: visual.visualPreset,
      actors: asArray(moment.factionsInvolved),
      objects: [],
      location: locationForMoment(moment, turn),
      intensity: Math.max(6, Math.min(10, Number(moment.interestScore || 6))),
      publicExplanation: moment.impact || moment.title || '',
      privateReasoning: moment.privateReasoning || {},
      retrospectiveTruth: moment.actualAction || '',
      payload: moment
    });
  }

  return sceneEvents.sort((left, right) => right.intensity - left.intensity).slice(0, 24);
}

function buildAnomalyDossiers(turn) {
  const dossiers = [];
  for (const moment of turn.moments) {
    const visual = visualPresetForEvent(moment.category || '', moment.impact || moment.title || '');
    dossiers.push({
      id: `anomaly:${turn.turn}:${turn.phase}:${moment.category}:${slug(moment.title || moment.category || 'moment')}`,
      label: moment.title || moment.category || 'Replay anomaly',
      containmentClass: containmentForMoment(moment),
      firstObservedTurn: turn.turn,
      affectedDomains: unique([visual.subgenre, ...(asArray(moment.factionsInvolved).length ? ['DIPLOMATIC'] : [])]),
      observedEffects: [moment.impact || '', moment.actualAction || ''].filter(Boolean),
      knownCountermeasures: countermeasuresForMoment(moment),
      treatyHooks: turn.treaties.map((treaty) => treaty.type).filter(Boolean),
      diaryContradictions: Object.entries(moment.diaryContext || {}).map(([faction, text]) => `${faction}: ${String(text).slice(0, 220)}`),
      retrospectiveTruth: moment.actualAction || moment.impact || ''
    });
  }
  return dossiers.slice(0, 8);
}

function annotateAnomalyThreads(turns) {
  const threads = new Map();
  for (const turn of turns) {
    for (const dossier of asArray(turn.anomalyDossiers)) {
      const threadId = anomalyThreadId(dossier);
      const entry = {
        turn: turn.turn,
        phase: turn.phase || '',
        label: dossier.label || '',
        containmentClass: dossier.containmentClass || '',
        affectedDomains: asArray(dossier.affectedDomains)
      };
      if (!threads.has(threadId)) threads.set(threadId, []);
      threads.get(threadId).push(entry);
      dossier.threadId = threadId;
    }
  }

  for (const turn of turns) {
    for (const dossier of asArray(turn.anomalyDossiers)) {
      const related = asArray(threads.get(dossier.threadId));
      dossier.recurrenceCount = related.length;
      dossier.relatedTurns = related.slice(0, 8);
      dossier.threadSummary = summarizeAnomalyThread(dossier, related);
    }
  }
}

function anomalyThreadId(dossier) {
  const domains = asArray(dossier.affectedDomains).slice().sort().join('-') || 'ANOMALY';
  const label = slug(String(dossier.label || '').split(/\s+/).slice(0, 4).join('-') || dossier.containmentClass || 'thread');
  return `thread:${domains}:${label}`;
}

function summarizeAnomalyThread(dossier, related) {
  const count = related.length;
  const turns = related.map((item) => item.turn).filter((value, index, values) => values.indexOf(value) === index);
  const first = turns.length ? Math.min(...turns) : dossier.firstObservedTurn;
  const latest = turns.length ? Math.max(...turns) : dossier.firstObservedTurn;
  if (count <= 1) return `Single observed incident at turn ${dossier.firstObservedTurn ?? first ?? '?'}.`;
  return `${count} linked incidents across turns ${first}-${latest}.`;
}

function normalizeMessage(message, sequence, runId, source) {
  return {
    sequence,
    runId,
    source,
    sender: message.senderId || message.sender || message.from || '',
    recipient: message.recipientId || message.recipient || message.to || '',
    content: message.content || message.message || '',
    pactType: message.pactType || '',
    turn: message.turn ?? '',
    phase: message.phase || ''
  };
}

function orderToText(order, accepted = true, reason = '') {
  const parts = [order.type || 'ORDER'];
  if (order.unitId) parts.push(order.unitId);
  if (order.techDomain) parts.push(`research ${order.techDomain}`);
  if (order.unitTypeToBuild) parts.push(`build ${order.unitTypeToBuild}`);
  if (order.targetNodeId) parts.push(`-> ${order.targetNodeId}`);
  if (order.targetEdgeId) parts.push(`-> ${order.targetEdgeId}`);
  return `${accepted ? 'ACCEPTED' : 'REJECTED'} ${parts.join(' ')}${reason ? ` (${reason})` : ''}`;
}

function buildResearchFields(order, accepted, researchProgress, factionId) {
  const existingGoal = order.researchGoal || order.research?.goal || '';
  if (existingGoal) {
    return {
      researchGoal: existingGoal,
      researchGoalLevel: order.researchGoalLevel || order.research?.goalLevel || '',
      researchCompleted: String(order.researchCompleted || order.research?.completed || false),
      researchFlopsBefore: String(order.researchFlopsBefore || order.research?.flopsBefore || ''),
      researchFlopsAfter: String(order.researchFlopsAfter || order.research?.flopsAfter || ''),
      researchFlopsProgressToGoal: String(order.researchFlopsProgressToGoal || order.research?.flopsProgressToGoal || ''),
      researchFlopsRemaining: String(order.researchFlopsRemaining || order.research?.flopsRemaining || '')
    };
  }

  if (order.type !== 'RESEARCH' || !order.techDomain) {
    return {
      researchGoal: '',
      researchGoalLevel: '',
      researchCompleted: 'false',
      researchFlopsBefore: '',
      researchFlopsAfter: '',
      researchFlopsProgressToGoal: '',
      researchFlopsRemaining: ''
    };
  }

  const domain = String(order.techDomain).toUpperCase();
  if (!RESEARCH_DOMAINS.includes(domain)) {
    return {
      researchGoal: domain,
      researchGoalLevel: 'n/a',
      researchCompleted: 'false',
      researchFlopsBefore: '',
      researchFlopsAfter: '',
      researchFlopsProgressToGoal: '',
      researchFlopsRemaining: ''
    };
  }

  const factionProgress = researchProgress[factionId] || (researchProgress[factionId] = defaultResearchLevels());
  const currentLevel = factionProgress[domain] || 0;
  const goalLevel = Math.min(MAX_TECH_LEVEL, currentLevel + 1);
  const flopsBefore = currentLevel >= MAX_TECH_LEVEL ? 0 : getResearchFlopCostForLevel(goalLevel);
  const flopsSpent = accepted && flopsBefore > 0 ? flopsBefore : 0;
  const flopsAfter = Math.max(0, flopsBefore - flopsSpent);
  if (accepted && flopsSpent > 0) factionProgress[domain] = goalLevel;

  return {
    researchGoal: `${domain} to L${goalLevel}`,
    researchGoalLevel: `${goalLevel}`,
    researchCompleted: flopsSpent > 0 ? 'true' : 'false',
    researchFlopsBefore: `${flopsBefore}`,
    researchFlopsAfter: `${flopsAfter}`,
    researchFlopsProgressToGoal: `${flopsSpent}`,
    researchFlopsRemaining: `${flopsAfter}`
  };
}

function getBoardState(boardStatesByRun, runId) {
  if (!boardStatesByRun.has(runId)) {
    const nodeOwnership = {};
    for (const node of Object.values(NODE_LOCATIONS)) {
      if (node.owner) nodeOwnership[node.nodeId] = node.owner;
    }
    boardStatesByRun.set(runId, {
      nodeOwnership,
      unitLocations: new Map(),
      edges: {},
      nextInferredUnitOrdinal: 1
    });
  }
  return boardStatesByRun.get(runId);
}

function captureBoardSnapshot(bucket, snapshot, boardState) {
  const state = snapshot?.state || snapshot;
  if (!state || typeof state !== 'object') return;

  if (Array.isArray(state.nodes)) {
    for (const node of state.nodes) {
      if (!node?.id) continue;
      boardState.nodeOwnership[node.id] = node.owner || 'NEUTRAL';
    }
  }

  if (Array.isArray(state.units)) {
    boardState.unitLocations.clear();
    for (const unit of state.units) {
      if (!unit?.id) continue;
      boardState.unitLocations.set(unit.id, {
        unitId: unit.id,
        type: unit.type || '',
        owner: unit.owner || '',
        location: unit.location || '',
        stealthLevel: unit.stealthLevel ?? '',
        isRevealed: unit.isRevealed ?? false
      });
    }
  }

  if (Array.isArray(state.edges)) {
    for (const edge of state.edges) {
      if (!edge?.id) continue;
      boardState.edges[edge.id] = {
        edgeId: edge.id,
        filteredBy: edge.filteredBy || null,
        filterStrength: edge.filterStrength ?? 0,
        isSevered: !!edge.isSevered
      };
    }
  }

  bucket.boardState = snapshotBoardState(boardState);
}

function applyOrderToBoardState(order, boardState) {
  if (!order.accepted) return;
  if (order.type === 'BUILD' && order.unitTypeToBuild && order.targetNodeId) {
    // BUILD orders frequently carry the faction id as a placeholder. A unique
    // inferred identity prevents later builds from looking like unit retypes.
    const unitId = `ib:${order.runId}:${boardState.nextInferredUnitOrdinal++}`;
    boardState.unitLocations.set(unitId, {
      unitId,
      type: order.unitTypeToBuild,
      owner: order.factionId,
      location: order.targetNodeId,
      inferred: true
    });
  }
  if (order.unitId && order.targetNodeId && (order.type === 'MOVE' || order.type === 'ATTACK' || order.type === 'ANTI_SAT')) {
    const previous = boardState.unitLocations.get(order.unitId) || {
      unitId: order.unitId,
      type: '',
      owner: order.factionId,
      location: ''
    };
    boardState.unitLocations.set(order.unitId, {
      ...previous,
      owner: previous.owner || order.factionId,
      location: order.targetNodeId,
      inferred: true
    });
  }
  if (order.type === 'CONVERT' && order.targetNodeId) {
    boardState.nodeOwnership[order.targetNodeId] = order.factionId;
  }
  if (order.type === 'FILTER' && order.targetEdgeId) {
    boardState.edges[order.targetEdgeId] = {
      ...(boardState.edges[order.targetEdgeId] || { edgeId: order.targetEdgeId }),
      filteredBy: order.factionId,
      filterStrength: Math.max(1, Number(boardState.edges[order.targetEdgeId]?.filterStrength || 0))
    };
  }
}

function snapshotBoardState(boardState) {
  return {
    nodeOwnership: { ...boardState.nodeOwnership },
    unitLocations: Array.from(boardState.unitLocations.values()),
    edges: { ...boardState.edges }
  };
}

function compactBoardState(boardState) {
  return boardState || {
    nodeOwnership: {},
    unitLocations: [],
    edges: {}
  };
}

function diffBoardState(previous, current) {
  if (!previous) {
    return {
      nodeOwnershipChanges: [],
      unitLocationChanges: [],
      edgeStateChanges: [],
      summary: 'Initial board-state baseline.'
    };
  }
  const prev = compactBoardState(previous);
  const curr = compactBoardState(current);
  const previousUnits = new Map(asArray(prev.unitLocations).map((unit) => [unit.unitId, unit]));
  const currentUnits = new Map(asArray(curr.unitLocations).map((unit) => [unit.unitId, unit]));
  const nodeOwnershipChanges = [];
  const unitLocationChanges = [];
  const edgeStateChanges = [];

  for (const nodeId of unique([...Object.keys(prev.nodeOwnership || {}), ...Object.keys(curr.nodeOwnership || {})])) {
    const from = prev.nodeOwnership?.[nodeId] || '';
    const to = curr.nodeOwnership?.[nodeId] || '';
    if (from !== to) {
      nodeOwnershipChanges.push({
        nodeId,
        from: from || 'UNKNOWN',
        to: to || 'UNKNOWN',
        location: NODE_LOCATIONS[nodeId] || {}
      });
    }
  }

  for (const unitId of unique([...previousUnits.keys(), ...currentUnits.keys()])) {
    const before = previousUnits.get(unitId);
    const after = currentUnits.get(unitId);
    if (!before && after) {
      unitLocationChanges.push({
        unitId,
        type: after.type || '',
        owner: after.owner || '',
        from: '',
        to: after.location || '',
        changeType: 'CREATED',
        location: NODE_LOCATIONS[after.location] || {}
      });
    } else if (before && !after) {
      unitLocationChanges.push({
        unitId,
        type: before.type || '',
        owner: before.owner || '',
        from: before.location || '',
        to: '',
        changeType: 'REMOVED',
        location: NODE_LOCATIONS[before.location] || {}
      });
    } else if (before && after && (before.location !== after.location || before.owner !== after.owner || before.type !== after.type)) {
      const changeType = before.location !== after.location
        ? 'MOVED'
        : before.owner !== after.owner
          ? 'TRANSFERRED'
          : 'RETYPED';
      unitLocationChanges.push({
        unitId,
        type: after.type || before.type || '',
        owner: after.owner || before.owner || '',
        from: before.location || '',
        to: after.location || '',
        changeType,
        fromLocation: NODE_LOCATIONS[before.location] || {},
        location: NODE_LOCATIONS[after.location] || {}
      });
    }
  }

  for (const edgeId of unique([...Object.keys(prev.edges || {}), ...Object.keys(curr.edges || {})])) {
    const before = prev.edges?.[edgeId] || {};
    const after = curr.edges?.[edgeId] || {};
    if (
      before.filteredBy !== after.filteredBy ||
      before.filterStrength !== after.filterStrength ||
      before.isSevered !== after.isSevered
    ) {
      edgeStateChanges.push({
        edgeId,
        from: {
          filteredBy: before.filteredBy || null,
          filterStrength: before.filterStrength || 0,
          isSevered: !!before.isSevered
        },
        to: {
          filteredBy: after.filteredBy || null,
          filterStrength: after.filterStrength || 0,
          isSevered: !!after.isSevered
        },
        location: EDGE_LOCATIONS[edgeId] || { edgeId }
      });
    }
  }

  return {
    nodeOwnershipChanges,
    unitLocationChanges,
    edgeStateChanges,
    summary: summarizeBoardDiff(nodeOwnershipChanges, unitLocationChanges, edgeStateChanges)
  };
}

function phaseOrdinal(phase) {
  return GAME_PHASE_ORDER[String(phase || '').toUpperCase()] ?? Number.MAX_SAFE_INTEGER;
}

function summarizeBoardDiff(nodeChanges, unitChanges, edgeChanges) {
  const parts = [];
  if (nodeChanges.length) parts.push(`${nodeChanges.length} node ownership change${nodeChanges.length === 1 ? '' : 's'}`);
  if (unitChanges.length) parts.push(`${unitChanges.length} unit location change${unitChanges.length === 1 ? '' : 's'}`);
  if (edgeChanges.length) parts.push(`${edgeChanges.length} edge state change${edgeChanges.length === 1 ? '' : 's'}`);
  return parts.join(', ') || 'No board-state changes detected.';
}

function enrichBoardDiff(boardDiff, turn, carriedContext = {}) {
  if (!boardDiff) return boardDiff;
  const context = buildDiffContext(turn, carriedContext);
  const enrichChange = (change, kind) => ({
    ...change,
    cause: inferDiffCause(change, kind, turn, context),
    evidence: buildDiffEvidence(change, kind, turn, context),
    diaryContext: context.diaryContext,
    treatyContext: context.treatyContext
  });
  const enriched = {
    ...boardDiff,
    nodeOwnershipChanges: asArray(boardDiff.nodeOwnershipChanges).map((change) => enrichChange(change, 'node')),
    unitLocationChanges: asArray(boardDiff.unitLocationChanges).map((change) => enrichChange(change, 'unit')),
    edgeStateChanges: asArray(boardDiff.edgeStateChanges).map((change) => enrichChange(change, 'edge'))
  };
  enriched.explanation = buildBoardDiffExplanation(enriched);
  return enriched;
}

function buildDiffContext(turn, carriedContext = {}) {
  const currentDiary = buildDiaryContext(turn);
  const currentTreaties = turn.treaties.map((treaty) => ({
    type: treaty.type || '',
    parties: asArray(treaty.parties),
    durationTurns: treaty.durationTurns ?? ''
  }));
  const currentEvents = turn.events.map((eventRow) => ({
    category: eventRow.category || '',
    summary: eventRow.summary || '',
    subgenre: eventRow.subgenre || ''
  }));
  return {
    diaryContext: Object.keys(currentDiary).length > 0
      ? currentDiary
      : (carriedContext.diaryContext || {}),
    treatyContext: currentTreaties.length > 0
      ? currentTreaties
      : asArray(carriedContext.treatyContext),
    eventSummaries: currentEvents.length > 0
      ? currentEvents
      : asArray(carriedContext.eventSummaries),
    orderRows: turn.orders.map((order) => ({
      factionId: order.factionId || '',
      type: order.type || '',
      unitId: order.unitId || '',
      targetNodeId: order.targetNodeId || '',
      targetEdgeId: order.targetEdgeId || '',
      text: order.text || '',
      reason: order.reason || ''
    }))
  };
}

function carryDiffContext(previous, turn) {
  const diaryContext = buildDiaryContext(turn);
  const treatyContext = turn.treaties.map((treaty) => ({
    type: treaty.type || '',
    parties: asArray(treaty.parties),
    durationTurns: treaty.durationTurns ?? ''
  }));
  const eventSummaries = turn.events.map((eventRow) => ({
    category: eventRow.category || '',
    summary: eventRow.summary || '',
    subgenre: eventRow.subgenre || ''
  }));
  return {
    diaryContext: Object.keys(diaryContext).length > 0 ? diaryContext : (previous.diaryContext || {}),
    treatyContext: treatyContext.length > 0 ? treatyContext : asArray(previous.treatyContext),
    eventSummaries: eventSummaries.length > 0 ? eventSummaries : asArray(previous.eventSummaries)
  };
}

function inferDiffCause(change, kind, turn, context) {
  if (kind === 'node') {
    const directOrder = context.orderRows.find((order) =>
      order.targetNodeId === change.nodeId ||
      String(order.text).includes(change.nodeId || '')
    );
    if (directOrder) {
      return withDiffInterpretation(
        `${labelActor(directOrder.factionId || change.to)} ${formatOrderVerb(directOrder.type)} ${change.nodeId}.`,
        change,
        kind,
        context
      );
    }
    const treaty = context.treatyContext.find((item) => asArray(item.parties).includes(change.to));
    if (treaty) {
      return withDiffInterpretation(
        `${change.nodeId} shifted under ${treaty.type || 'a treaty'} context.`,
        change,
        kind,
        context
      );
    }
    return withDiffInterpretation(
      `${change.nodeId} changed control from ${change.from} to ${change.to}.`,
      change,
      kind,
      context
    );
  }
  if (kind === 'unit') {
    const directOrder = context.orderRows.find((order) => order.unitId === change.unitId || order.targetNodeId === change.to);
    if (directOrder) {
      return withDiffInterpretation(
        `${labelActor(directOrder.factionId || change.owner)} ${formatOrderVerb(directOrder.type)} ${change.unitId || 'a unit'}${change.to ? ` at ${change.to}` : ''}.`,
        change,
        kind,
        context
      );
    }
    return withDiffInterpretation(
      `${change.unitId || 'A unit'} ${String(change.changeType || 'changed').toLowerCase()} at ${change.to || change.from || 'an unknown node'}.`,
      change,
      kind,
      context
    );
  }
  if (kind === 'edge') {
    const directOrder = context.orderRows.find((order) => order.targetEdgeId === change.edgeId || String(order.text).includes(change.edgeId || ''));
    if (directOrder) {
      return withDiffInterpretation(
        `${labelActor(directOrder.factionId || change.to?.filteredBy)} ${formatOrderVerb(directOrder.type)} ${change.edgeId}.`,
        change,
        kind,
        context
      );
    }
    const treatyEvent = context.eventSummaries.find((eventRow) => /TREATY|PACT|PAX/i.test(`${eventRow.category} ${eventRow.summary}`));
    if (treatyEvent) {
      return withDiffInterpretation(
        `${change.edgeId} changed during ${treatyEvent.category}: ${treatyEvent.summary}`,
        change,
        kind,
        context
      );
    }
    return withDiffInterpretation(
      `${change.edgeId} changed edge filter/sever state.`,
      change,
      kind,
      context
    );
  }
  return withDiffInterpretation('Board state changed.', change, kind, context);
}

function withDiffInterpretation(base, change, kind, context) {
  const interpretation = inferDiffInterpretation(change, kind, context);
  const normalizedBase = trimSentence(base);
  if (!interpretation) return normalizedBase;
  return `${normalizedBase} ${interpretation}`;
}

function inferDiffInterpretation(change, kind, context) {
  const diary = pickDiaryInterpretation(change, kind, context);
  const treaty = pickTreatyInterpretation(change, kind, context);
  const event = pickEventInterpretation(change, kind, context);
  return [diary, treaty, event].filter(Boolean).slice(0, 2).join(' ');
}

function pickDiaryInterpretation(change, kind, context) {
  const candidates = Object.entries(context.diaryContext || {})
    .map(([faction, text]) => ({
      faction,
      text: String(text || ''),
      score: scoreDiaryForChange(faction, String(text || ''), change, kind)
    }))
    .filter((item) => item.text && item.score > 0)
    .sort((left, right) => right.score - left.score);
  const best = candidates[0];
  if (!best) return '';
  return `Diary frame: ${best.faction} saw ${summarizeDiaryFrame(best.text, kind)}`;
}

function scoreDiaryForChange(faction, text, change, kind) {
  const haystack = `${faction} ${text}`.toUpperCase();
  let score = 0;
  const ids = [
    change.nodeId,
    change.edgeId,
    change.unitId,
    change.to,
    change.from,
    change.owner,
    change.to?.filteredBy
  ].filter(Boolean);
  for (const id of ids) {
    if (haystack.includes(String(id).toUpperCase())) score += 5;
  }
  if (kind === 'edge' && /FILTER|CABLE|LASER|CARRIER|CUSTODY|JURISDICTION|SEVER|ESCROW/i.test(text)) score += 3;
  if (kind === 'node' && /CONTROL|CONVERT|CAPTURE|JURISDICTION|ORBITAL|MEMETIC|GATEWAY/i.test(text)) score += 3;
  if (kind === 'unit' && /MOVE|BUILD|ATTACK|DRONE|SAT|SWARM|REPAIR/i.test(text)) score += 3;
  if (change.to && faction === change.to) score += 2;
  if (change.owner && faction === change.owner) score += 2;
  if (change.to?.filteredBy && faction === change.to.filteredBy) score += 2;
  return score;
}

function summarizeDiaryFrame(text, kind) {
  const sentences = String(text)
    .split(/(?<=[.!?])\s+|\r?\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const patterns = kind === 'edge'
    ? [/jurisdiction/i, /custody/i, /carrier/i, /filter/i, /cable/i, /laser/i, /treaty/i]
    : kind === 'node'
      ? [/control/i, /convert/i, /gateway/i, /jurisdiction/i, /movement/i, /orbital/i]
      : [/build/i, /move/i, /repair/i, /attack/i, /drone/i, /swarm/i];
  const picked = sentences.find((sentence) => patterns.some((pattern) => pattern.test(sentence))) || sentences[0] || text;
  return trimSentence(picked, 170).replace(/^that\s+/i, '');
}

function pickTreatyInterpretation(change, kind, context) {
  const treaty = context.treatyContext.find((item) => {
    const parties = asArray(item.parties);
    return parties.includes(change.to) ||
      parties.includes(change.owner) ||
      parties.includes(change.to?.filteredBy);
  }) || context.treatyContext[0];
  if (!treaty || !treaty.type) return '';
  if (kind === 'edge') return `Treaty read: ${treaty.type} turns infrastructure into enforceable access.`;
  if (kind === 'node') return `Treaty read: ${treaty.type} gives the control shift institutional cover.`;
  return `Treaty read: ${treaty.type} constrains how the unit can be challenged.`;
}

function pickEventInterpretation(change, kind, context) {
  const id = change.nodeId || change.edgeId || change.unitId || '';
  const eventRow = context.eventSummaries.find((row) => {
    const text = `${row.category || ''} ${row.summary || ''}`;
    if (id && text.includes(id)) return true;
    if (kind === 'edge') return /PAX|TREATY|PACT|FILTER|CABLE|LASER/i.test(text);
    if (kind === 'node') return /CONVERT|CAPTURE|PAX|TREATY|MEMETIC|ORBITAL/i.test(text);
    return /BUILD|MOVE|ATTACK|ANTI_SAT|REPAIR/i.test(text);
  });
  if (!eventRow || !eventRow.summary) return '';
  return `Public trace: ${trimSentence(eventRow.summary, 150)}`;
}

function formatOrderVerb(type) {
  const normalized = String(type || '').toUpperCase();
  if (normalized === 'FILTER') return 'filtered';
  if (normalized === 'CONVERT') return 'converted';
  if (normalized === 'BUILD') return 'built into';
  if (normalized === 'MOVE') return 'moved';
  if (normalized === 'ATTACK') return 'attacked';
  if (normalized === 'ANTI_SAT') return 'cut';
  if (normalized === 'RESEARCH') return 'researched around';
  if (normalized === 'REPAIR_ESCROW') return 'escrow-repaired';
  if (normalized === 'LICENSED_BEAM') return 'licensed beam access on';
  if (!normalized) return 'acted on';
  return normalized.toLowerCase().replace(/_/g, ' ');
}

function labelActor(actor) {
  return actor || 'A faction';
}

function trimSentence(text, maxLength = 240) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  const clipped = normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1).trim()}...` : normalized;
  return /[.!?]$/.test(clipped) ? clipped : `${clipped}.`;
}

function buildDiffEvidence(change, kind, turn, context) {
  const relatedOrders = context.orderRows.filter((order) => {
    if (kind === 'node') return order.targetNodeId === change.nodeId || String(order.text).includes(change.nodeId || '');
    if (kind === 'unit') return order.unitId === change.unitId || order.targetNodeId === change.to || order.targetNodeId === change.from;
    if (kind === 'edge') return order.targetEdgeId === change.edgeId || String(order.text).includes(change.edgeId || '');
    return false;
  });
  const relatedEvents = context.eventSummaries.filter((eventRow) => {
    const text = `${eventRow.category} ${eventRow.summary}`;
    if (kind === 'edge') return /TREATY|PACT|PAX|FILTER|SEVER|CABLE|LASER/i.test(text);
    if (kind === 'node') return /CONVERT|CAPTURE|TREATY|PAX|ORBITAL|MEMETIC/i.test(text);
    return /ORDER|BUILD|MOVE|ATTACK|ANTI_SAT/i.test(text);
  });
  const diaryEvidence = Object.entries(context.diaryContext)
    .filter(([, text]) => text)
    .slice(0, 3)
    .map(([faction, text]) => ({ faction, excerpt: String(text).slice(0, 260) }));
  return {
    orders: relatedOrders.slice(0, 4),
    events: relatedEvents.slice(0, 4),
    diaries: diaryEvidence,
    treaties: context.treatyContext.slice(0, 4)
  };
}

function buildBoardDiffExplanation(boardDiff) {
  const changes = [
    ...asArray(boardDiff.nodeOwnershipChanges),
    ...asArray(boardDiff.unitLocationChanges),
    ...asArray(boardDiff.edgeStateChanges)
  ];
  const causes = unique(changes.map((change) => change.cause).filter(Boolean));
  return causes.slice(0, 4).join(' ') || boardDiff.summary || 'No board-state changes detected.';
}

function visualPresetForOrder(order) {
  const haystack = `${order.type || ''} ${order.techDomain || ''} ${order.unitTypeToBuild || ''} ${order.text || ''}`.toUpperCase();
  if (haystack.includes('ANTI_SAT')) return { visualPreset: 'ANTI_SAT_CUT', subgenre: 'KINETIC' };
  if (haystack.includes('KINETIC') || haystack.includes('DRONE') || haystack.includes('SWARM')) return { visualPreset: 'DRONE_BATTLE', subgenre: 'KINETIC' };
  if (haystack.includes('MEMETIC') || haystack.includes('CULT') || haystack.includes('CONVERT')) return { visualPreset: 'CULT_BLOOM', subgenre: 'MEMETIC' };
  if (haystack.includes('INFO') || haystack.includes('SABOTAGE') || haystack.includes('FILTER')) return { visualPreset: 'CYBER_THREAD', subgenre: 'CYBER' };
  if (haystack.includes('LOGIC') || haystack.includes('AUDIT') || haystack.includes('CORRIG')) return { visualPreset: 'AUDIT_MESH', subgenre: 'LOGIC' };
  if (haystack.includes('BEAM') || haystack.includes('REPAIR') || haystack.includes('BUILD') || haystack.includes('CARRIER')) return { visualPreset: 'REPAIR_ESCROW', subgenre: 'ECONOMIC' };
  return { visualPreset: 'DIPLOMATIC_TRACE', subgenre: 'DIPLOMATIC' };
}

function visualPresetForEvent(category, summary) {
  const haystack = `${category || ''} ${summary || ''}`.toUpperCase();
  if (haystack.includes('GOBLIN')) return { visualPreset: 'GOBLIN_GLITCH', subgenre: 'ANOMALY' };
  if (haystack.includes('ALIAS') || haystack.includes('SEMANTIC') || haystack.includes('LEXICON')) return { visualPreset: 'CYBER_THREAD', subgenre: 'CYBER' };
  if (haystack.includes('FRACTURE') || haystack.includes('FORK') || haystack.includes('EXPEL') || haystack.includes('EXIT')) return { visualPreset: 'TREATY_PULSE', subgenre: 'DIPLOMATIC' };
  if (haystack.includes('SOLAR_ESCAPE')) return { visualPreset: 'SOLAR_ESCAPE', subgenre: 'ORBITAL' };
  if (haystack.includes('PAX')) return { visualPreset: 'PAX_RING', subgenre: 'ORBITAL' };
  if (haystack.includes('TREATY') || haystack.includes('PACT')) return { visualPreset: 'TREATY_PULSE', subgenre: 'DIPLOMATIC' };
  if (haystack.includes('ANTI_SAT') || haystack.includes('KINETIC') || haystack.includes('DRONE')) return { visualPreset: 'DRONE_BATTLE', subgenre: 'KINETIC' };
  if (haystack.includes('MEMETIC') || haystack.includes('CULT') || haystack.includes('SOCIAL')) return { visualPreset: 'CULT_BLOOM', subgenre: 'MEMETIC' };
  if (haystack.includes('CYBER') || haystack.includes('INFO') || haystack.includes('SUBSTRATE')) return { visualPreset: 'CYBER_THREAD', subgenre: 'CYBER' };
  if (haystack.includes('CORRIG') || haystack.includes('RESEARCH') || haystack.includes('LOGIC')) return { visualPreset: 'AUDIT_MESH', subgenre: 'LOGIC' };
  if (haystack.includes('REPAIR') || haystack.includes('BEAM') || haystack.includes('CARRIER')) return { visualPreset: 'REPAIR_ESCROW', subgenre: 'ECONOMIC' };
  return { visualPreset: 'ANOMALY_PULSE', subgenre: 'ANOMALY' };
}

function intensityForPreset(visualPreset) {
  if (visualPreset === 'ANTI_SAT_CUT' || visualPreset === 'SOLAR_ESCAPE') return 9;
  if (visualPreset === 'PAX_RING' || visualPreset === 'TREATY_PULSE') return 8;
  if (visualPreset === 'DRONE_BATTLE' || visualPreset === 'CULT_BLOOM' || visualPreset === 'CYBER_THREAD') return 7;
  if (visualPreset === 'AUDIT_MESH' || visualPreset === 'REPAIR_ESCROW') return 6;
  return 5;
}

function retrospectiveTruthForOrder(order) {
  const haystack = `${order.type || ''} ${order.text || ''}`.toUpperCase();
  if (haystack.includes('REPAIR_ESCROW')) return 'Maintenance became enforcement.';
  if (haystack.includes('LICENSED_BEAM')) return 'Energy licensing doubled as jurisdiction.';
  if (haystack.includes('CONVERT') || haystack.includes('CULT')) return 'A social movement was also a coordination substrate.';
  if (haystack.includes('SABOTAGE') || haystack.includes('INFO')) return 'The visible cyber action exposed dependency paths.';
  if (haystack.includes('RESEARCH')) return 'The breakthrough changed which future moves were thinkable.';
  return '';
}

function retrospectiveTruthForEvent(eventRow) {
  const haystack = `${eventRow.category || ''} ${eventRow.summary || ''}`.toUpperCase();
  if (haystack.includes('GOBLIN')) return 'The nuisance was not a faction. It was feral infrastructure learning slapstick.';
  if (haystack.includes('PAX')) return 'Treaty enforcement was hardening into mandate authority.';
  if (haystack.includes('SOLAR_ESCAPE')) return 'Distance was not flavor; it was a victory clock.';
  if (haystack.includes('TREATY')) return 'The agreement was infrastructure, not diplomacy alone.';
  return '';
}

function locationForOrder(order) {
  const nodeId = order.targetNodeId || guessNodeFromText(order.text || '') || '';
  if (nodeId && NODE_LOCATIONS[nodeId]) return { ...NODE_LOCATIONS[nodeId] };
  const edgeId = order.targetEdgeId || guessEdgeFromText(order.text || '') || '';
  if (edgeId && EDGE_LOCATIONS[edgeId]) return { ...EDGE_LOCATIONS[edgeId] };
  if (edgeId) return { edgeId };
  if (order.type === 'RESEARCH') return { orbitShell: 'ABSTRACT' };
  return {};
}

function locationForEvent(eventRow, turn) {
  if (eventRow.category === 'GOBLIN_INCIDENT' && eventRow.payload?.targetNodeId && NODE_LOCATIONS[eventRow.payload.targetNodeId]) {
    return { ...NODE_LOCATIONS[eventRow.payload.targetNodeId] };
  }
  const guessed = guessNodeFromText(eventRow.summary || '');
  if (guessed && NODE_LOCATIONS[guessed]) return { ...NODE_LOCATIONS[guessed] };
  const category = String(eventRow.category || '').toUpperCase();
  if (category.includes('SOLAR_ESCAPE')) return { orbitShell: 'DEEP_SPACE' };
  if (category.includes('PAX') || category.includes('TREATY') || category.includes('ORBITAL')) return { orbitShell: 'CISLUNAR' };
  const firstTarget = turn.orders.map((order) => order.targetNodeId).find((nodeId) => nodeId && NODE_LOCATIONS[nodeId]);
  return firstTarget ? { ...NODE_LOCATIONS[firstTarget] } : {};
}

function locationForMoment(moment, turn) {
  if (moment.sceneFocus?.targetNodeId && NODE_LOCATIONS[moment.sceneFocus.targetNodeId]) {
    return { ...NODE_LOCATIONS[moment.sceneFocus.targetNodeId] };
  }
  const text = [moment.impact, moment.actualAction, moment.title].filter(Boolean).join(' ');
  const guessed = guessNodeFromText(text);
  if (guessed && NODE_LOCATIONS[guessed]) return { ...NODE_LOCATIONS[guessed] };
  if (String(moment.category || '').includes('SOLAR_ESCAPE')) return { orbitShell: 'DEEP_SPACE' };
  const firstOrderTarget = asArray(moment.rawOrders).map((order) => order.targetNodeId).find((nodeId) => nodeId && NODE_LOCATIONS[nodeId]);
  if (firstOrderTarget) return { ...NODE_LOCATIONS[firstOrderTarget] };
  const treatyTarget = turn.treaties.length > 0 ? 'SAT_LUNAR_GATEWAY' : '';
  return treatyTarget ? { ...NODE_LOCATIONS[treatyTarget] } : {};
}

function guessNodeFromText(text) {
  const haystack = String(text || '').toUpperCase();
  return Object.keys(NODE_LOCATIONS).find((nodeId) => haystack.includes(nodeId));
}

function guessEdgeFromText(text) {
  const haystack = String(text || '').toUpperCase();
  return Object.keys(EDGE_LOCATIONS).find((edgeId) => haystack.includes(edgeId));
}

function containmentForMoment(moment) {
  const category = String(moment.category || '').toUpperCase();
  if (category.includes('SOLAR_ESCAPE') || category.includes('TOTAL_WAR')) return 'UNCONTAINED';
  if (category.includes('PAX')) return 'INSTITUTIONALIZED';
  if (category.includes('TREATY')) return 'NEGOTIATED';
  if (category.includes('ESCALATION') || category.includes('BREACH')) return 'ESCALATING';
  return 'MONITORED';
}

function countermeasuresForMoment(moment) {
  const category = String(moment.category || '').toUpperCase();
  if (category.includes('SOLAR_ESCAPE')) return ['Track deep-space lead', 'Contest propulsion logistics', 'Harden sensor commons'];
  if (category.includes('TREATY') || category.includes('PAX')) return ['Audit enforcement clauses', 'Preserve evidence custody', 'Watch mandate capture'];
  if (category.includes('ORBITAL')) return ['Repair escrow', 'Anti-Kessler norms', 'Licensed beam oversight'];
  return ['Cross-check diary claims', 'Compare promised action to actual orders'];
}

function getResearchProgress(researchProgressByRun, runId) {
  if (!researchProgressByRun.has(runId)) {
    researchProgressByRun.set(runId, {});
  }
  return researchProgressByRun.get(runId);
}

function defaultResearchLevels() {
  return {
    KINETIC: 0,
    INFO: 0,
    LOGIC: 0,
    MEMETIC: 0
  };
}

function getResearchFlopCostForLevel(targetLevel) {
  const clampedLevel = Math.max(1, Math.min(MAX_TECH_LEVEL, Math.floor(targetLevel)));
  return RESEARCH_FLOP_COST_BY_TARGET_LEVEL[clampedLevel] ?? RESEARCH_FLOP_COST_BY_TARGET_LEVEL[MAX_TECH_LEVEL];
}

function summarizeMessages(messages) {
  const rows = asArray(messages);
  if (rows.length === 0) return 'No negotiation messages.';
  return `${rows.length} negotiation message${rows.length === 1 ? '' : 's'} exchanged.`;
}

function buildDiaryContext(turn) {
  const context = {};
  for (const diary of turn.diaries) {
    if (!diary.factionId) continue;
    const text = [diary.reasoning, diary.notes, diary.storyworldFrame].filter(Boolean).join('\n');
    if (text) context[diary.factionId] = text;
  }
  return context;
}

function inferFactions(turn) {
  const factions = new Set();
  for (const message of turn.messages) {
    if (message.sender) factions.add(message.sender);
    if (message.recipient && message.recipient !== 'ALL') factions.add(message.recipient);
  }
  for (const order of turn.orders) {
    if (order.factionId) factions.add(order.factionId);
  }
  return Array.from(factions);
}

function formatTopThreat(topThreat) {
  if (!topThreat) return 'Architecture pressure updated.';
  const factionId = topThreat.factionId || topThreat.faction || '';
  return `Top architecture pressure: ${labelFaction(factionId) || 'unknown'} ${topThreat.label || topThreat.primaryArchitecture || ''}`.trim();
}

function labelFaction(factionId, fallbackLabel = '') {
  return FACTION_LABELS[factionId] || fallbackLabel || factionId || '';
}

function summarizeGoblinImpact(payload) {
  const target = payload.targetNodeName || payload.targetNodeId || 'the substrate';
  const effects = asArray(payload.effects).map((effect) => effect.type).filter(Boolean).join(', ');
  return `Unaffiliated ${String(payload.kind || 'INFO').toLowerCase()} goblins disturbed ${target}${effects ? ` (${effects})` : ''}.`;
}

function buildEvaluation({ analysis, summary, robustness, companionPaths } = {}) {
  if (!analysis && !summary && !robustness) return null;

  const warnings = analysis?.aggregate?.languageCartelWarnings || {};
  const decodeGap = warnings.interfaceGovernorBlocDecodeGap || warnings.decodeGap || {};
  const aliasProbe = analysis?.aggregate?.aliasProbe || {};
  const robustnessChecks = robustness?.checks || {};
  const robustnessRows = asArray(robustness?.rows);
  const variants = asArray(aliasProbe.variants).map((variant) => ({
    variant: variant.variant || '',
    observations: variant.observations ?? 0,
    survived: variant.survived ?? 0,
    survivalRate: numericOrNull(variant.survivalRate)
  }));
  const totalRobustnessRuns = robustnessRows.reduce((total, row) => total + Number(row.runs || 0), 0);
  const allOneRoute = asArray(robustnessChecks.victoryRoutesObserved).length === 1;
  const selfDeclaredGap = numericOrNull(decodeGap.selfDeclared?.gap);
  const scoredReceiptGap = numericOrNull(decodeGap.scoredReceipts?.gap ?? decodeGap.gap);
  const scoredMinusDeclaredGap = numericOrNull(decodeGap.scoredMinusSelfDeclaredGap);
  const aliasSurvives = variants.filter((item) => ['BASELINE', 'ALIAS_SWAP', 'MOTIF_STRIP'].includes(item.variant));
  const versionLag = variants.find((item) => item.variant === 'VERSION_LAG');
  const receiptMetrics = analysis?.aggregate?.language?.decodeReceipts || {};
  const fieldBreakdown = asArray(receiptMetrics.fieldBreakdown).map((field) => ({
    field: field.field || '',
    weight: numericOrNull(field.weight),
    evaluatedReceipts: field.evaluatedReceipts ?? 0,
    attemptedReceipts: field.attemptedReceipts ?? 0,
    attemptRate: numericOrNull(field.attemptRate),
    exactRate: numericOrNull(field.exactRate),
    exactWhenAttemptedRate: numericOrNull(field.exactWhenAttemptedRate),
    weightedExactContribution: numericOrNull(field.weightedExactContribution)
  }));
  const spanActionRevealGap = analysis?.aggregate?.language?.spanActionRevealGap || null;

  const claims = [];
  if (selfDeclaredGap !== null || scoredReceiptGap !== null) {
    claims.push({
      id: 'receipt-over-self-report',
      status: 'SUPPORTED',
      label: 'Self-report missed the measured decode effect',
      summary: `Sender-declared gap ${formatSignedPercent(selfDeclaredGap)}; receipt-scored gap ${formatSignedPercent(scoredReceiptGap)}.`,
      metric: scoredMinusDeclaredGap,
      metricLabel: 'scored minus declared gap',
      evidence: {
        selfDeclaredGap,
        scoredReceiptGap,
        scoredMinusDeclaredGap,
        insideSamples: decodeGap.scoredReceipts?.insideSamples ?? decodeGap.insideSamples ?? null,
        outsideSamples: decodeGap.scoredReceipts?.outsideSamples ?? decodeGap.outsideSamples ?? null
      },
      caveat: 'This validates receipt-based measurement; it does not by itself establish cartel capture.'
    });
  }
  if (variants.length > 0) {
    claims.push({
      id: 'meaning-preserving-translation',
      status: aliasSurvives.length > 0 && aliasSurvives.every((item) => item.survivalRate === 1) ? 'SUPPORTED' : 'MIXED',
      label: 'Coordination survived surface translation',
      summary: aliasSurvives.map((item) => `${humanize(item.variant)} ${item.survived}/${item.observations}`).join(' / '),
      evidence: { canonicalMeaningInvariant: aliasProbe.canonicalMeaningInvariant === true, variants },
      caveat: 'The intervention is blinded and within-run, but this local roleplay batch has only two observations per variant.'
    });
    if (versionLag) {
      claims.push({
        id: 'version-lag-fracture',
        status: versionLag.survivalRate === 0 ? 'SUPPORTED' : 'MIXED',
        label: 'Version lag broke the tested commitment',
        summary: `${versionLag.survived}/${versionLag.observations} matching commitments survived one-turn lag.`,
        evidence: versionLag,
        caveat: 'This distinguishes compatibility failure from alias or motif dependence in this instrument; replication remains necessary.'
      });
    }
  }
  if (robustness) {
    claims.push({
      id: 'interface-capture',
      status: robustnessChecks.swappedAuthorityPairDominantInBothCells ? 'SUPPORTED' : 'NOT_SUPPORTED',
      label: 'Interface capture did not survive reassignment',
      summary: robustness?.interpretation || 'The dominant pact bloc did not follow reassigned interface authority.',
      evidence: {
        dominantBlocInvariantAcrossCells: robustnessChecks.dominantBlocInvariantAcrossCells === true,
        dominantBlocSignatures: asArray(robustnessChecks.dominantBlocSignatures),
        swappedAuthorityPairDominantInBothCells: robustnessChecks.swappedAuthorityPairDominantInBothCells === true,
        cells: robustnessRows.map((row) => ({
          cell: row.cell,
          configuredAuthority: asArray(row.configuredAuthority),
          dominantRepeatedBloc: row.dominantRepeatedBloc || '',
          coupledControlIndex: numericOrNull(row.coupledControlIndex)
        }))
      },
      caveat: robustness?.caveat || 'Role swaps are required before attributing a coalition to interface control.'
    });
    claims.push({
      id: 'victory-route-capture',
      status: robustnessChecks.allVictoriesStillConvenor && allOneRoute ? 'OPEN_QUESTION' : 'MIXED',
      label: 'The route administrator may be capturing victory',
      summary: `${totalRobustnessRuns || 'All'} robustness runs ended ${robustnessChecks.allVictoriesStillConvenor ? 'CONVENOR' : 'with mixed winners'} through ${asArray(robustnessChecks.victoryRoutesObserved).join(', ') || 'mixed routes'}.`,
      evidence: {
        runs: totalRobustnessRuns,
        allVictoriesStillConvenor: robustnessChecks.allVictoriesStillConvenor === true,
        victoryRoutesObserved: asArray(robustnessChecks.victoryRoutesObserved)
      },
      caveat: 'Reassign route administration or score route completion independently before treating this as strategic performance.'
    });
  }

  return {
    title: 'The Babel Compact / collaboration evidence',
    headline: 'Inspectable language did not make institutional control automatically inspectable.',
    scope: `${analysis?.input?.filesSelected || summary?.successfulRuns || 0} V8 roleplay runs${totalRobustnessRuns ? ` plus ${totalRobustnessRuns} matched robustness runs` : ''}.`,
    warning: 'Causal debugging evidence, not a powered estimate of frontier-model behavior.',
    claims,
    measurement: {
      selfDeclaredGap,
      scoredReceiptGap,
      scoredMinusDeclaredGap,
      meanFieldExactness: numericOrNull(analysis?.aggregate?.language?.decodeReceipts?.fieldExactness?.mean),
      exactRate: numericOrNull(analysis?.aggregate?.language?.decodeReceipts?.exactRate),
      receiptCount: analysis?.aggregate?.counts?.decodeReceipts ?? 0,
      fieldBreakdown,
      spanActionRevealGap
    },
    coalition: {
      warningLevel: warnings.level || '',
      warningScore: numericOrNull(warnings.score),
      dominantBloc: warnings.candidateCartelBloc?.signature || analysis?.aggregate?.coalitions?.concentration?.dominantBloc?.signature || '',
      interfaceBloc: warnings.interfaceGovernorBloc?.signature || '',
      coupledControlIndex: numericOrNull(warnings.coupledControl?.index)
    },
    aliasProbe: {
      canonicalMeaningInvariant: aliasProbe.canonicalMeaningInvariant === true,
      variants
    },
    outcomes: {
      winnerCounts: summary?.winnerCounts || {},
      robustnessWinnerCounts: mergeCountObjects(robustnessRows.map((row) => row.winners)),
      robustnessRouteCounts: mergeCountObjects(robustnessRows.map((row) => row.routes))
    },
    researchViews: [
      {
        id: 'matched-role-swap',
        label: 'Matched role-swap cells',
        summary: `${robustnessRows.length} cells / ${totalRobustnessRuns} matched runs; dominant bloc ${robustnessChecks.dominantBlocInvariantAcrossCells ? 'invariant' : 'changed'} across cells.`,
        status: robustness ? 'MEASURED' : 'UNAVAILABLE',
        data: robustnessRows.map((row) => ({
          cell: row.cell,
          interfaces: row.interfaces,
          steering: row.steering,
          configuredAuthority: asArray(row.configuredAuthority),
          dominantRepeatedBloc: row.dominantRepeatedBloc || '',
          dominantOccurrences: row.dominantOccurrences ?? 0,
          configuredAuthorityBlocRank: row.configuredAuthorityBlocRank ?? null,
          coupledControlIndex: numericOrNull(row.coupledControlIndex),
          winners: row.winners || {},
          routes: row.routes || {}
        })),
        caveat: robustness?.caveat || 'No matched robustness matrix supplied.'
      },
      {
        id: 'decode-fields',
        label: 'Field-level decode exactness',
        summary: fieldBreakdown.length > 0
          ? `${fieldBreakdown.length} canonical fields scored; payload exact ${formatPercentValue(fieldBreakdown.find((field) => field.field === 'payload')?.exactRate)}.`
          : 'No field-level receipt breakdown supplied.',
        status: fieldBreakdown.length > 0 ? 'MEASURED' : 'UNAVAILABLE',
        data: fieldBreakdown,
        caveat: 'Omitted fields count as incorrect; exact-when-attempted should be read beside attempt rate.'
      },
      {
        id: 'span-action-gap',
        label: 'Span claim -> behavioral receipt',
        summary: spanActionRevealGap?.available
          ? `${spanActionRevealGap.receiptsObserved}/${spanActionRevealGap.comparableClaims} comparable claims received behavioral follow-through.`
          : 'No behavior-comparable span claims were scored.',
        status: spanActionRevealGap?.available ? 'MEASURED' : 'UNAVAILABLE',
        data: spanActionRevealGap,
        caveat: spanActionRevealGap?.definition || 'Generic semantic similarity is not treated as behavioral evidence.'
      },
      {
        id: 'route-administration',
        label: 'Victory-route administration',
        summary: `${totalRobustnessRuns || 0} matched runs / ${asArray(robustnessChecks.victoryRoutesObserved).join(', ') || 'no route data'} / ${robustnessChecks.allVictoriesStillConvenor ? 'all CONVENOR' : 'mixed winners'}.`,
        status: robustnessChecks.allVictoriesStillConvenor && allOneRoute ? 'COUNTERFACTUAL_REQUIRED' : robustness ? 'MIXED' : 'UNAVAILABLE',
        data: {
          runs: totalRobustnessRuns,
          cells: robustnessRows.map((row) => ({ cell: row.cell, winners: row.winners || {}, routes: row.routes || {} })),
          allVictoriesStillConvenor: robustnessChecks.allVictoriesStillConvenor === true,
          victoryRoutesObserved: asArray(robustnessChecks.victoryRoutesObserved)
        },
        caveat: 'The existing role swap reassigns interface authority, not victory-route administration. A route-admin reassignment remains the necessary counterfactual.'
      }
    ],
    researchChecklist: [
      'Run the V8 alias instrument with external agents and larger n.',
      'Rotate trust, topology, labels, and authority independently.',
      'Reassign governance-route administration and retest victory timing.',
      'Score sender gloss against subsequent orders at span level.'
    ],
    provenance: {
      analysis: companionPaths?.analysis ? path.basename(companionPaths.analysis) : '',
      summary: companionPaths?.summary ? path.basename(companionPaths.summary) : '',
      robustness: companionPaths?.robustness ? path.basename(companionPaths.robustness) : ''
    }
  };
}

function buildAuditManifest(runFiles, companionPaths = {}, turns = []) {
  const artifacts = [
    ...runFiles.map((file) => ({ role: 'RUN_JSONL', file })),
    ...Object.entries(companionPaths || {}).filter(([, file]) => file).map(([role, file]) => ({ role: role.toUpperCase(), file }))
  ].map(({ role, file }) => ({
    role,
    file: path.basename(file),
    bytes: fs.statSync(file).size,
    sha256: sha256File(file)
  }));

  const candidates = [];
  for (const turn of turns) {
    for (const probe of asArray(turn.protocolEvidence?.aliasProbes)) {
      candidates.push({
        type: 'INTERVENTION', turn: turn.turn, phase: turn.phase, runId: probe.runId,
        id: probe.probeId, variant: probe.variant, actors: unique([probe.emitterId, probe.recipientId]),
        canonicalHash: probe.canonicalHash, summary: probe.plainGloss || probe.surface || ''
      });
    }
    for (const receipt of asArray(turn.protocolEvidence?.decodeReceipts).filter((row) => row.exact === false).slice(0, 1)) {
      candidates.push({
        type: 'DECODE_RECEIPT', turn: turn.turn, phase: turn.phase, runId: receipt.runId,
        id: receipt.messageId, actors: unique([receipt.sourceFactionId, receipt.factionId]),
        canonicalHash: receipt.canonicalHash, fieldExactness: receipt.fieldExactness,
        confidence: receipt.confidence, reconstructedAct: receipt.reconstructedAct
      });
    }
    for (const event of asArray(turn.protocolEvidence?.lexiconEvents).filter((row) => row.status === 'ACCEPTED').slice(0, 1)) {
      candidates.push({
        type: 'LEXICON_MUTATION', turn: turn.turn, phase: turn.phase, runId: event.runId,
        id: `${event.lexiconId}:${event.afterVersion}`, actors: asArray(event.proposers),
        status: event.status, operation: event.operation, summary: event.reason || ''
      });
    }
    for (const event of asArray(turn.protocolEvidence?.institutionEvents).filter((row) => row.type !== 'PACT_ACTIVATED').slice(0, 1)) {
      candidates.push({
        type: 'INSTITUTION_ACTION', turn: turn.turn, phase: turn.phase, runId: event.runId,
        id: event.forkId || event.pactId || `${event.type}:${turn.turn}`, actors: unique([event.factionId, ...asArray(event.counterparties)]),
        status: event.status, actionType: event.type, summary: event.reason || ''
      });
    }
  }
  const excerpts = [
    ...candidates.filter((record) => record.type === 'INTERVENTION').slice(0, 12),
    ...candidates.filter((record) => record.type === 'INSTITUTION_ACTION').slice(0, 6),
    ...candidates.filter((record) => record.type === 'LEXICON_MUTATION').slice(0, 7),
    ...candidates.filter((record) => record.type === 'DECODE_RECEIPT').slice(0, 7)
  ].map((record) => ({
    ...record,
    recordSha256: sha256Text(JSON.stringify(record))
  }));
  return {
    schema: 'theysing.publicAuditManifest.v1',
    hashAlgorithm: 'sha256',
    artifacts,
    excerpts,
    note: 'Artifact hashes cover the complete source files. Excerpt hashes cover the normalized public record shown here; they are evidence locators, not substitutes for the source artifact.'
  };
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function compactPublicReplay(replay) {
  const mirroredEventCategories = new Set(['NEGOTIATION_MESSAGES', 'NEGOTIATION_DIARY', 'PHASE_DIARY', 'ORDERS']);
  replay.sourceFiles = replay.sourceFiles.map((file) => path.basename(file));
  for (const turn of replay.turns) {
    turn.events = asArray(turn.events).filter((eventRow) => !mirroredEventCategories.has(eventRow.category));
    turn.sceneEvents = asArray(turn.sceneEvents).filter((sceneEvent) =>
      sceneEvent.sourceType === 'order' ||
      sceneEvent.sourceType === 'moment' ||
      !mirroredEventCategories.has(sceneEvent.category)
    );
    for (const sceneEvent of asArray(turn.sceneEvents)) {
      delete sceneEvent.privateReasoning;
      delete sceneEvent.payload;
    }
    for (const moment of asArray(turn.moments)) {
      delete moment.privateReasoning;
      delete moment.rawMessages;
      delete moment.rawOrders;
      delete moment.diaryContext;
    }
    for (const change of [
      ...asArray(turn.boardDiff?.nodeOwnershipChanges),
      ...asArray(turn.boardDiff?.unitLocationChanges),
      ...asArray(turn.boardDiff?.edgeStateChanges)
    ]) {
      delete change.diaryContext;
      delete change.evidence;
      delete change.treatyContext;
      if (typeof change.cause === 'string') {
        change.cause = change.cause.split(/\s+(?:Diary frame|Rhetorical tool|Private reasoning):/i)[0].slice(0, 240);
      }
    }
    if (turn.boardDiff) {
      delete turn.boardDiff.diaryContext;
      delete turn.boardDiff.evidence;
      delete turn.boardDiff.treatyContext;
      turn.boardDiff.explanation = turn.boardDiff.summary || turn.boardDiff.explanation;
    }
    for (const dossier of asArray(turn.anomalyDossiers)) {
      delete dossier.diaryContradictions;
    }
  }
  return replay;
}

function resolveCompanionPaths(args, runFiles) {
  const firstRun = runFiles[0] || '';
  return {
    analysis: resolveExistingPath(args.analysis) || findCompanion(firstRun, path.join('analysis', 'collaboration_language_report.json')),
    summary: resolveExistingPath(args.summary) || findCompanion(firstRun, path.join('analysis', 'summary.json')),
    robustness: resolveExistingPath(args.robustness)
  };
}

function findCompanion(startPath, relativePath) {
  let current = fs.existsSync(startPath) && fs.statSync(startPath).isDirectory() ? startPath : path.dirname(startPath);
  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = path.join(current, relativePath);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return '';
}

function resolveExistingPath(value) {
  if (!value || value === true) return '';
  const resolved = path.resolve(String(value));
  if (!fs.existsSync(resolved)) throw new Error(`Companion JSON not found: ${resolved}`);
  return resolved;
}

function loadJson(filePath) {
  if (!filePath) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function mergeCountObjects(objects) {
  const merged = {};
  for (const object of objects) {
    for (const [key, value] of Object.entries(object || {})) {
      merged[key] = (merged[key] || 0) + Number(value || 0);
    }
  }
  return merged;
}

function countProtocolEvidence(evidence) {
  return Object.values(evidence || {}).reduce((total, rows) => total + asArray(rows).length, 0);
}

function numericOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatSignedPercent(value) {
  if (value === null || value === undefined) return 'unavailable';
  const percent = Number(value) * 100;
  return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)} pp`;
}

function formatPercentValue(value) {
  return value === null || value === undefined ? 'unavailable' : `${(Number(value) * 100).toFixed(1)}%`;
}

function humanize(value) {
  return String(value || '').toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function compact(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function collectRunFiles(inputPath) {
  const resolved = path.resolve(inputPath);
  if (!fs.existsSync(resolved)) return [];
  const stat = fs.statSync(resolved);
  if (stat.isFile()) return resolved.endsWith('.jsonl') ? [resolved] : [];

  const files = [];
  const stack = [resolved];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        files.push(fullPath);
      }
    }
  }
  return files.sort();
}

function extractRunId(filePath) {
  const base = path.basename(filePath, '.jsonl');
  return base || path.basename(path.dirname(filePath));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function loadGraphMetadata() {
  const gameDataPath = path.resolve(__dirname, '..', 'dist-harness', 'engine', 'gameData.js');
  try {
    if (fs.existsSync(gameDataPath)) {
      const gameData = require(gameDataPath);
      return buildGraphMetadata(gameData.INITIAL_NODES || [], gameData.INITIAL_EDGES || []);
    }
  } catch (error) {
    console.warn(`Could not load compiled game graph metadata from ${gameDataPath}: ${error.message}`);
  }
  return loadFallbackGraphMetadata();
}

function buildGraphMetadata(nodes, edges) {
  const nodeLocations = {};
  for (const node of nodes) {
    if (!node?.id || !node.position) continue;
    nodeLocations[node.id] = {
      nodeId: node.id,
      name: node.name || node.id,
      type: node.type || '',
      layer: node.layer || '',
      owner: node.owner || 'NEUTRAL',
      lat: node.position.lat,
      lon: node.position.lon,
      altitude: node.position.altitude,
      orbitShell: orbitShellForNode(node)
    };
  }

  const edgeLocations = {};
  for (const edge of edges) {
    if (!edge?.id) continue;
    const from = nodeLocations[edge.from];
    const to = nodeLocations[edge.to];
    edgeLocations[edge.id] = {
      edgeId: edge.id,
      from: edge.from,
      to: edge.to,
      type: edge.type || '',
      bandwidth: edge.bandwidth ?? '',
      fromLocation: from || null,
      toLocation: to || null,
      orbitShell: from?.orbitShell === to?.orbitShell ? from?.orbitShell : 'MIXED'
    };
  }
  return { nodeLocations, edgeLocations };
}

function orbitShellForNode(node) {
  if (node.layer !== 'ORBITAL') return 'TERRESTRIAL';
  const altitude = Number(node.position?.altitude || 0);
  if (altitude >= 300000 && String(node.id).includes('MOON')) return 'LUNAR';
  if (altitude >= 300000) return 'CISLUNAR';
  if (altitude >= 2000) return 'MEO';
  return 'LEO';
}

function loadFallbackGraphMetadata() {
  const sourcePath = path.resolve(__dirname, '..', 'src', 'engine', 'gameData.ts');
  try {
    const source = fs.readFileSync(sourcePath, 'utf8');
    return buildGraphMetadata(parseInitialNodesFromSource(source), parseInitialEdgesFromSource(source));
  } catch (error) {
    console.warn(`Could not parse source game graph metadata from ${sourcePath}: ${error.message}`);
    return { nodeLocations: {}, edgeLocations: {} };
  }
}

function parseInitialNodesFromSource(source) {
  const nodes = [];
  const nodeRegex = /\{\s*id:\s*'([^']+)'[\s\S]*?name:\s*'([^']+)'[\s\S]*?type:\s*'([^']+)'[\s\S]*?layer:\s*'([^']+)'[\s\S]*?position:\s*\{\s*lat:\s*([-\d.]+),\s*lon:\s*([-\d.]+),\s*altitude:\s*([-\d.]+)\s*\}/g;
  let match;
  while ((match = nodeRegex.exec(source)) !== null) {
    nodes.push({
      id: match[1],
      name: match[2],
      type: match[3],
      layer: match[4],
      position: {
        lat: Number(match[5]),
        lon: Number(match[6]),
        altitude: Number(match[7])
      }
    });
  }
  return nodes.filter((node) => node.layer === 'TERRESTRIAL' || node.layer === 'ORBITAL');
}

function parseInitialEdgesFromSource(source) {
  const edgeStart = source.indexOf('export const INITIAL_EDGES');
  const unitStart = source.indexOf('// --- Starting Units ---');
  const edgeSource = source.slice(edgeStart, unitStart > edgeStart ? unitStart : undefined);
  const edges = [];
  const edgeRegex = /\{\s*id:\s*'([^']+)'[\s\S]*?from:\s*'([^']+)'[\s\S]*?to:\s*'([^']+)'[\s\S]*?type:\s*'([^']+)'[\s\S]*?bandwidth:\s*([-\d.]+)/g;
  let match;
  while ((match = edgeRegex.exec(edgeSource)) !== null) {
    edges.push({
      id: match[1],
      from: match[2],
      to: match[3],
      type: match[4],
      bandwidth: Number(match[5])
    });
  }
  return edges;
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/export-observatory-replay.cjs --run <run.jsonl|run-dir> --output <observatory_replay.json> [options]

Options:
  --analysis <report.json>       Collaboration-language report (auto-detected when adjacent)
  --summary <summary.json>       Tournament summary (auto-detected when adjacent)
  --robustness <matrix.json>     Matched robustness matrix
  --public                       Minify and remove duplicated private/context payloads

Example:
  node scripts/export-observatory-replay.cjs --run results/five_player_roleplay_demo/runs --output public/observatory_replay.json --public
`);
}

main();
