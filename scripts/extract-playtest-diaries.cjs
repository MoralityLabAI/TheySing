const fs = require('fs');
const path = require('path');

const MAX_TECH_LEVEL = 4;
const RESEARCH_FLOP_COST = 2;

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (!args.run) {
    throw new Error('Missing required --run argument.');
  }

  const runFiles = collectRunFiles(args.run);
  if (runFiles.length === 0) {
    throw new Error(
      `No run jsonl files found for input ${args.run}. ` +
      'Pass a run file like runs/run_001/run_001.jsonl or a run directory.'
    );
  }

  const outputDir = path.resolve(args.output || path.join(process.cwd(), 'results', 'diary_exports'));
  fs.mkdirSync(outputDir, { recursive: true });

  const negotiationRows = [];
  const phaseRows = [];
  const moveRows = [];
  const researchRows = [];
  const counters = {
    negotiation: 0,
    phase: 0,
    orders: 0
  };

  for (const runFile of runFiles) {
    const runSummary = extractRunId(runFile);
    const lines = fs.readFileSync(runFile, 'utf8').split(/\r?\n/);

    for (const line of lines) {
      if (!line.trim()) continue;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch (error) {
        continue;
      }

      if (!entry || typeof entry !== 'object') continue;

      const base = {
        runId: runSummary,
        turn: entry.turn ?? '',
        phase: entry.phase || '',
        factionId: entry.data?.factionId || ''
      };

      if (entry.type === 'negotiation_reasoning_diary') {
        counters.negotiation += 1;
        const data = entry.data || {};
        negotiationRows.push({
          runId: base.runId,
          turn: base.turn,
          negotiationRound: data.negotiationRound ?? '',
          factionId: data.factionId || '',
          factionLabel: data.factionLabel || '',
          reasoning: data.reasoning || '',
          notes: data.notes || '',
          visibleMessageCount: Array.isArray(data.visibleMessagesBefore) ? data.visibleMessagesBefore.length : 0,
          messageCount: Array.isArray(data.messages) ? data.messages.length : 0,
          pactCount: Array.isArray(data.pacts) ? data.pacts.length : 0,
          storyworldFrame: data.storyworldFrame || '',
          counterfactuals: formatCounterfactuals(data.counterfactuals || []),
          messages: formatNegotiationMessages(data.messages || []),
          pacts: formatPacts(data.pacts || []),
          visibleMessages: formatMessageTimeline(data.visibleMessagesBefore || [])
        });
        continue;
      }

      if (entry.type === 'phase_reasoning_diary') {
        counters.phase += 1;
        const data = entry.data || {};
      phaseRows.push({
          runId: base.runId,
          turn: base.turn,
          phase: data.phase || entry.phase || '',
          factionId: data.factionId || '',
          factionLabel: data.factionLabel || '',
          reasoning: data.reasoning || '',
          notes: data.notes || '',
          visibleMessageCount: Array.isArray(data.visibleMessagesBefore) ? data.visibleMessagesBefore.length : 0,
          requestedOrders: formatOrderList(data.requestedOrders || []),
          acceptedOrders: formatOrderList(data.acceptedOrders || []),
          rejectedOrders: formatRejectedOrders(data.rejectedOrders || [])
        });
        continue;
      }

      if (entry.type === 'orders_submitted') {
        counters.orders += 1;
        const data = entry.data || {};
        const accepted = Array.isArray(data.acceptedOrders) ? data.acceptedOrders : [];
        const rejected = Array.isArray(data.rejectedOrders) ? data.rejectedOrders : [];
        const requested = data.requestedOrderCount || accepted.length + rejected.length;
        const preResources = sanitizeFactionResources(data.factionResourceSnapshot);

        for (const order of accepted) {
          moveRows.push({
            runId: base.runId,
            turn: base.turn,
            phase: entry.phase || '',
            factionId: base.factionId,
            factionLabel: data.factionLabel || '',
            order: orderToText(order),
            result: 'accepted',
            requestedOrderCount: requested,
            reason: '',
            unitId: order.unitId || '',
            targetNodeId: order.targetNodeId || '',
            targetEdgeId: order.targetEdgeId || '',
            targetUnitId: order.targetUnitId || '',
            supportingUnitId: order.supportingUnitId || '',
            techDomain: order.techDomain || '',
            unitTypeToBuild: order.unitTypeToBuild || '',
            researchGoal: '',
            researchGoalLevel: '',
            researchCompleted: '',
            researchFlopsBefore: '',
            researchFlopsAfter: '',
            researchFlopsProgressToGoal: '',
            researchFlopsRemaining: '',
            researchContextReason: '',
          });
          if (order.type === 'RESEARCH' && data.factionId) {
            researchRows.push({
              runId: base.runId,
              rowIndex: moveRows.length - 1,
              turn: base.turn,
              factionId: data.factionId,
              domain: order.techDomain || '',
              result: 'accepted',
              preState: preResources
                ? (preResources[data.factionId] || preResources.__singleFaction || null)
                : null
            });
          }
        }

        for (const rejectedEntry of rejected) {
          const order = rejectedEntry?.order || {};
          moveRows.push({
            runId: base.runId,
            turn: base.turn,
            phase: entry.phase || '',
            factionId: base.factionId,
            factionLabel: data.factionLabel || '',
            order: orderToText(order),
            result: 'rejected',
            requestedOrderCount: requested,
            reason: rejectedEntry.reason || 'Rejected',
            unitId: order.unitId || '',
            targetNodeId: order.targetNodeId || '',
            targetEdgeId: order.targetEdgeId || '',
            targetUnitId: order.targetUnitId || '',
            supportingUnitId: order.supportingUnitId || '',
            techDomain: order.techDomain || '',
            unitTypeToBuild: order.unitTypeToBuild || '',
            researchGoal: '',
            researchGoalLevel: '',
            researchCompleted: '',
            researchFlopsBefore: '',
            researchFlopsAfter: '',
            researchFlopsProgressToGoal: '',
            researchFlopsRemaining: '',
            researchContextReason: rejectedEntry.reason || 'Rejected',
          });
          if (order.type === 'RESEARCH' && data.factionId) {
            researchRows.push({
              runId: base.runId,
              rowIndex: moveRows.length - 1,
              turn: base.turn,
              factionId: data.factionId,
              domain: order.techDomain || '',
              result: 'rejected',
            preState: preResources
              ? (preResources[data.factionId] || preResources.__singleFaction || null)
              : null
            });
          }
        }
      }
    }
  }

  const turnFactionStates = buildTurnFactionStatesFromRunLog(runFiles, moveRows);
  applyResearchProgress(moveRows, researchRows, turnFactionStates);

  writeCsv(
    path.join(outputDir, 'negotiation_diary.csv'),
    [
      'runId',
      'turn',
      'negotiationRound',
      'factionId',
      'factionLabel',
      'reasoning',
      'notes',
      'visibleMessageCount',
      'messageCount',
      'pactCount',
      'storyworldFrame',
      'counterfactuals',
      'messages',
      'pacts',
      'visibleMessages'
    ],
    negotiationRows
  );

  writeCsv(
    path.join(outputDir, 'phase_diary.csv'),
    [
      'runId',
      'turn',
      'phase',
      'factionId',
      'factionLabel',
      'reasoning',
      'notes',
      'visibleMessageCount',
      'requestedOrders',
      'acceptedOrders',
      'rejectedOrders'
    ],
    phaseRows
  );

  writeCsv(
    path.join(outputDir, 'moves_trace.csv'),
    [
      'runId',
      'turn',
      'phase',
      'factionId',
      'factionLabel',
      'result',
      'order',
      'reason',
      'requestedOrderCount',
      'unitId',
      'targetNodeId',
      'targetEdgeId',
      'targetUnitId',
      'supportingUnitId',
      'techDomain',
      'unitTypeToBuild',
      'researchGoal',
      'researchGoalLevel',
      'researchCompleted',
      'researchFlopsBefore',
      'researchFlopsAfter',
      'researchFlopsProgressToGoal',
      'researchFlopsRemaining',
      'researchContextReason'
    ],
    moveRows
  );

  const summary = {
    runFiles: runFiles.length,
    extractedRuns: [...new Set(runFiles.map(extractRunId))],
    negotiationDiaryRows: negotiationRows.length,
    phaseDiaryRows: phaseRows.length,
    moveRows: moveRows.length,
    processedCounters: counters,
    outputDir
  };

  const summaryPath = path.join(outputDir, 'extraction_summary.json');
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify(summary, null, 2));
}

function parseArgs(argv) {
  const args = {
    run: '',
    output: '',
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      if (!args.run) {
        args.run = token;
        continue;
      }
      if (!args.output) {
        args.output = token;
        continue;
      }
      throw new Error(`Unexpected positional argument: ${token}`);
    }

    if (token === '--help' || token === '-h') {
      args.help = true;
      break;
    }
    if (!token.startsWith('--')) continue;

    const [key, inlineValue] = token.slice(2).split('=');
    const value = inlineValue ?? argv[index + 1];
    if (!inlineValue && value && !value.startsWith('--')) {
      index += 1;
    } else if (!inlineValue && token !== '--help' && token !== '-h' && (index + 1 >= argv.length || argv[index + 1]?.startsWith('--'))) {
      throw new Error(`Missing value for --${key}`);
    }

    if (key === 'run') {
      args.run = inlineValue || value;
      continue;
    }
    if (key === 'output') {
      args.output = inlineValue || value;
      continue;
    }

    throw new Error(`Unknown flag: --${key}`);
  }

  return args;
}

function printHelp() {
  console.log('Usage: node scripts/extract-playtest-diaries.cjs <runOrRunsDir> [outputDir]');
  console.log('   or:  node scripts/extract-playtest-diaries.cjs --run <runOrRunsDir> [--output <outputDir>]');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/extract-playtest-diaries.cjs --run results/five_player_roleplay_demo/runs/run_001/run_001.jsonl');
  console.log('  node scripts/extract-playtest-diaries.cjs --run results/five_player_roleplay_demo/runs --output results/five_player_roleplay_demo/diary_exports');
}

function collectRunFiles(targetInput) {
  const target = path.resolve(process.cwd(), targetInput);
  if (!fs.existsSync(target)) {
    throw new Error(`Input path does not exist: ${target}`);
  }

  const stat = fs.statSync(target);

  if (stat.isFile()) {
    if (!target.toLowerCase().endsWith('.jsonl')) {
      throw new Error(`File input must be a .jsonl run log: ${target}`);
    }
    return [target];
  }

  if (!stat.isDirectory()) {
    throw new Error(`Input must be a run jsonl file or directory: ${target}`);
  }

  const direct = fs.readdirSync(target, { withFileTypes: true });
  const directRuns = direct
    .filter((entry) => entry.isFile() && /^run_.*\.jsonl$/i.test(entry.name))
    .map((entry) => path.join(target, entry.name));

  if (directRuns.length > 0) {
    return directRuns.sort();
  }

  const runDirRuns = direct
    .filter((entry) => entry.isDirectory() && /^run_/i.test(entry.name))
    .map((entry) => path.join(target, entry.name))
    .flatMap((runDir) =>
      fs.readdirSync(runDir, { withFileTypes: true })
        .filter((runFile) => runFile.isFile() && /^run_.*\.jsonl$/i.test(runFile.name))
        .map((runFile) => path.join(runDir, runFile.name))
    );

  return runDirRuns.sort();
}

function extractRunId(runFile) {
  const file = path.basename(runFile);
  const parent = path.basename(path.dirname(runFile));
  if (parent.startsWith('run_')) return parent;
  const match = file.match(/^(run_[^.]*)/);
  return match ? match[1] : parent;
}

function writeCsv(filePath, headers, rows) {
  const lines = [
    headers.map(escapeCsv).join(',')
  ];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsv(row[header] ?? '')).join(','));
  }
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function escapeCsv(value) {
  const asString = typeof value === 'string' ? value : JSON.stringify(value);
  if (!/[",\r\n]/.test(asString)) {
    return asString;
  }
  return `"${asString.replace(/"/g, '""')}"`;
}

function formatCounterfactuals(counterfactuals) {
  return counterfactuals
    .map((item) => {
      if (!item || typeof item !== 'object') return String(item);
      return [
        `${item.mode}:${item.pactType}`,
        `counterparties=${Array.isArray(item.counterparties) ? item.counterparties.join(',') : ''}`,
        `h=${item.horizonTurns}`,
        `des=${item.desirability}`,
        `risk=${item.risk}`,
        `leader=${item.projectedLeader || 'n/a'}`,
        `tas=${item.projectedTasDelta}`,
        `orb=${item.projectedOrbitalDelta}`,
        `trust=${item.projectedTrustDelta}`,
        `node=${item.projectedNodeSwing}`,
        `story=${item.storyBeat || ''}`,
        `rationale=${Array.isArray(item.rationale) ? item.rationale.join(' / ') : ''}`
      ].join(' | ');
    })
    .join(' ; ');
}

function formatNegotiationMessages(messages) {
  return messages
    .map((message) => {
      if (!message || typeof message !== 'object') return String(message);
      return `${message.senderId || ''}->${message.recipientId || ''}: ${message.content || ''}`;
    })
    .join(' ; ');
}

function formatMessageTimeline(messages) {
  return messages
    .map((message) => {
      if (!message || typeof message !== 'object') return '';
      const sender = message.senderId || '';
      const recipient = message.recipientId || '';
      const content = message.content || '';
      return `${sender}=>${recipient}(${message.turn ?? '?'}) ${content}`;
    })
    .join(' | ');
}

function formatPacts(pacts) {
  return pacts
    .map((pact) => {
      if (!pact || typeof pact !== 'object') return String(pact);
      const parties = Array.isArray(pact.parties) ? pact.parties.join('+') : '';
      return `${pact.type || ''}(${parties})x${pact.durationTurns || ''}`;
    })
    .join(' ; ');
}

function orderToText(order) {
  if (!order || typeof order !== 'object') return String(order || '');
  const pieces = [
    order.type || 'UNKNOWN',
    order.unitId ? `unit=${order.unitId}` : '',
    order.targetNodeId ? `targetNodeId=${order.targetNodeId}` : '',
    order.targetEdgeId ? `targetEdgeId=${order.targetEdgeId}` : '',
    order.targetUnitId ? `targetUnitId=${order.targetUnitId}` : '',
    order.supportingUnitId ? `supportingUnitId=${order.supportingUnitId}` : '',
    order.techDomain ? `tech=${order.techDomain}` : '',
    order.unitTypeToBuild ? `build=${order.unitTypeToBuild}` : ''
  ].filter(Boolean);
  return pieces.join(' ');
}

function formatOrderList(orders) {
  return (orders || [])
    .map((order) => orderToText(order))
    .join(' ; ');
}

function formatRejectedOrders(entries) {
  return (entries || [])
    .map((entry) => `${orderToText(entry.order)} [${entry.reason || 'rejected'}]`)
    .join(' ; ');
}

  main();

function buildTurnFactionStatesFromRunLog(runFiles) {
  const states = new Map();

  for (const runFile of runFiles) {
    const runId = extractRunId(runFile);
    const lines = fs.readFileSync(runFile, 'utf8').split(/\r?\n/);

    for (const line of lines) {
      if (!line.trim()) continue;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch (error) {
        continue;
      }

      if (!entry || typeof entry !== 'object') continue;
      if (entry.type !== 'turn_completed') continue;

      const turn = numberField(entry.data, 'completedTurn');
      if (!Number.isFinite(turn)) continue;
      const resources = sanitizeFactionResources(entry.data && entry.data.factionResources);
      if (!resources) continue;

      states.set(`${runId}|${turn}`, resources);
    }
  }

  return states;
}

function applyResearchProgress(moveRows, researchRows, turnFactionStates) {
  const groups = new Map();

  for (const researchRow of researchRows) {
    const key = `${researchRow.runId}|${researchRow.turn}|${researchRow.factionId}|${researchRow.domain}`;
    const bucket = groups.get(key) || {
      entries: []
    };
    bucket.entries.push(researchRow);
    groups.set(key, bucket);
  }

  for (const [, bucket] of groups) {
    if (bucket.entries.length === 0) continue;

    const rowsByDomain = new Map();
    for (const row of bucket.entries) {
      const domain = row.domain || '';
      if (!rowsByDomain.has(domain)) {
        rowsByDomain.set(domain, []);
      }
      rowsByDomain.get(domain).push(row);
    }

    for (const [domain, domainRows] of rowsByDomain) {
      const sortedRows = domainRows.sort((left, right) => left.rowIndex - right.rowIndex);
      const endState = turnFactionStates.get(`${bucket.entries[0].runId}|${bucket.entries[0].turn}`) || {};
      const endFactionState = bucket.entries[0].factionId
        ? (endState[bucket.entries[0].factionId] || endState.__singleFaction || null)
        : null;

      let currentLevel = null;
      for (const entry of sortedRows) {
        const preLevel = asLevel(entry.preState?.techLevel?.[domain]);
        if (preLevel !== null) {
          currentLevel = preLevel;
          break;
        }
      }
      if (currentLevel === null) {
        currentLevel = asLevel(endFactionState?.techLevel?.[domain]);
      }
      if (currentLevel === null) {
        currentLevel = 0;
      }

      const appliedRows = sortedRows.map(entry => entry);
      for (const entry of appliedRows) {
        const moveRow = moveRows[entry.rowIndex];
        if (!moveRow) continue;

        if (currentLevel >= MAX_TECH_LEVEL) {
          moveRow.researchGoal = `${domain.toUpperCase()} to L${MAX_TECH_LEVEL}`;
          moveRow.researchGoalLevel = `${MAX_TECH_LEVEL}`;
          moveRow.researchCompleted = entry.result === 'accepted' ? 'false' : 'false';
          moveRow.researchFlopsBefore = '0';
          moveRow.researchFlopsAfter = '0';
          moveRow.researchFlopsProgressToGoal = '0';
          moveRow.researchFlopsRemaining = '0';
          continue;
        }

        const goalLevel = Math.min(MAX_TECH_LEVEL, currentLevel + 1);
        const flopsBefore = Math.max(0, (goalLevel - currentLevel) * RESEARCH_FLOP_COST);
        const isAccepted = entry.result === 'accepted';
        const flopsSpent = isAccepted ? Math.min(RESEARCH_FLOP_COST, flopsBefore) : 0;
        const flopsAfter = Math.max(0, flopsBefore - flopsSpent);

        moveRow.researchGoal = `${domain.toUpperCase()} to L${goalLevel}`;
        moveRow.researchGoalLevel = `${goalLevel}`;
        moveRow.researchCompleted = isAccepted && flopsSpent > 0 ? 'true' : 'false';
        moveRow.researchFlopsBefore = `${flopsBefore}`;
        moveRow.researchFlopsAfter = `${flopsAfter}`;
        moveRow.researchFlopsProgressToGoal = `${flopsSpent}`;
        moveRow.researchFlopsRemaining = `${flopsAfter}`;
        if (isAccepted && flopsSpent > 0) {
          currentLevel += 1;
        }
      }
    }
  }
}

function sanitizeFactionResources(value) {
  if (!value || typeof value !== 'object') return null;

  const normalizeResource = (rawFactionState) => {
    if (!rawFactionState || typeof rawFactionState !== 'object') return null;
    const rawTechLevel = rawFactionState.techLevel;
    if (!rawTechLevel || typeof rawTechLevel !== 'object') return null;

    const techLevel = {};
    const candidateDomains = ['KINETIC', 'INFO', 'LOGIC', 'MEMETIC'];
    for (const domain of candidateDomains) {
      if (typeof rawTechLevel[domain] === 'number' && Number.isFinite(rawTechLevel[domain])) {
        techLevel[domain] = rawTechLevel[domain];
      }
    }

    const flops = rawFactionState.flops;
    const influence = rawFactionState.influence;
    if (
      typeof flops !== 'number' ||
      !Number.isFinite(flops) ||
      typeof influence !== 'number' ||
      !Number.isFinite(influence)
    ) {
      return null;
    }

    return {
      flops,
      influence,
      techLevel
    };
  };

  const directResource = normalizeResource(value);
  if (directResource && Object.keys(directResource.techLevel).length > 0) {
    return { __singleFaction: directResource };
  }

  const sanitized = {};
  for (const [factionId, rawFactionState] of Object.entries(value)) {
    const resource = normalizeResource(rawFactionState);
    if (!resource) continue;
    sanitized[factionId] = resource;
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

function asLevel(rawLevel) {
  if (typeof rawLevel !== 'number' || !Number.isFinite(rawLevel)) return null;
  const level = Math.floor(rawLevel);
  return Number.isFinite(level) ? Math.min(MAX_TECH_LEVEL, Math.max(0, level)) : null;
}

function numberField(data, key) {
  const value = data?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
