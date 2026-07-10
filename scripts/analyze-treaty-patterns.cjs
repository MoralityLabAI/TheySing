const fs = require('fs');
const path = require('path');

const CATEGORY_RULES = {
  earthOrbitTreaty: [
    /\bearth[- ]orbit\b/i,
    /\bleo\b/i,
    /\borbital truce\b/i,
    /\banti[- ]?sat\b/i,
    /\basat\b/i,
    /\bsatellite/i,
    /\bkessler\b/i,
    /\bdebris\b/i
  ],
  weakEnforcement: [
    /\bshoot(?:ing)? sat/i,
    /\bshoot(?:ing)? satellite/i,
    /\bjam\b/i,
    /\bblind\b/i,
    /\bground station\b/i,
    /\blaunch site\b/i,
    /\bsanction/i,
    /\bmostly ASAT\b/i,
    /\btoo cheap to police\b/i,
    /\bonly shoots satellites down\b/i
  ],
  cislunarChokepoint: [
    /\bcislunar\b/i,
    /\blunar\b/i,
    /\bmoon\b/i,
    /\bgateway\b/i,
    /\bbeam[- ]lane\b/i,
    /\bmass driver\b/i,
    /\bpropellant\b/i,
    /\bdepot\b/i,
    /\brepair escrow\b/i,
    /\bcorridor access\b/i,
    /\bmoon corridor\b/i
  ],
  paxJenkins: [
    /\bpax jenkins\b/i,
    /\bjenkins\b/i,
    /\bmandate\b/i,
    /\bsensor commons\b/i,
    /\benforcement mesh\b/i,
    /\bbeam authorization\b/i,
    /\bno first zap\b/i,
    /\bemergency powers\b/i
  ],
  breakRisk: [
    /\bbreak\b/i,
    /\bbreach\b/i,
    /\bviolation\b/i,
    /\bspoof\b/i,
    /\bfalse\b/i,
    /\bratchet\b/i,
    /\bdefect/i,
    /\bzap\b/i,
    /\bhidden burn\b/i,
    /\bcascade\b/i
  ]
};

const PACT_TYPES = [
  'ORBITAL_TRUCE',
  'NON_AGGRESSION',
  'AUDIT_FREEZE',
  'SENSOR_COMMONS',
  'BEAM_LANE_LICENSE',
  'REPAIR_ESCROW',
  'CISLUNAR_COMMON_CARRIER'
];
const INSTITUTIONAL_PACT_TYPES = ['SENSOR_COMMONS', 'BEAM_LANE_LICENSE', 'REPAIR_ESCROW', 'CISLUNAR_COMMON_CARRIER'];

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
    throw new Error(`No run jsonl files found for ${args.run}.`);
  }

  const outputDir = path.resolve(args.output || path.join(process.cwd(), 'results', 'treaty_analysis'));
  fs.mkdirSync(outputDir, { recursive: true });

  const runRows = [];
  const turnRows = [];
  const examples = [];

  for (const runFile of runFiles) {
    const runAnalysis = analyzeRun(runFile);
    runRows.push(runAnalysis.summary);
    turnRows.push(...runAnalysis.turnRows);
    examples.push(...runAnalysis.examples);
  }

  const aggregate = buildAggregate(runRows);
  writeCsv(path.join(outputDir, 'treaty_run_summary.csv'), RUN_HEADERS, runRows);
  writeCsv(path.join(outputDir, 'treaty_turn_patterns.csv'), TURN_HEADERS, turnRows);
  writeCsv(path.join(outputDir, 'treaty_examples.csv'), EXAMPLE_HEADERS, examples);
  fs.writeFileSync(
    path.join(outputDir, 'treaty_analysis_summary.json'),
    `${JSON.stringify({ aggregate, runs: runRows }, null, 2)}\n`,
    'utf8'
  );
  fs.writeFileSync(path.join(outputDir, 'treaty_analysis_report.md'), buildReport(aggregate, runRows), 'utf8');

  console.log(JSON.stringify({
    runFiles: runFiles.length,
    outputDir,
    aggregate
  }, null, 2));
}

const RUN_HEADERS = [
  'runId',
  'winner',
  'completionType',
  'finalTurn',
  'totalMessages',
  'earthOrbitTreatyMessages',
  'weakEnforcementMessages',
  'cislunarChokepointMessages',
  'paxJenkinsMessages',
  'breakRiskMessages',
  'earthOrbitShare',
  'weakEnforcementShare',
  'cislunarShare',
  'paxJenkinsShare',
  'breakRiskShare',
  'orbitalTruceProposals',
  'orbitalTruceActivations',
  'nonAggressionProposals',
  'nonAggressionActivations',
  'auditFreezeProposals',
  'auditFreezeActivations',
  'institutionalPactProposals',
  'institutionalPactActivations',
  'commonCarrierTreatyRatifications',
  'activePactTurns',
  'pactBreachAttempts',
  'institutionalPactBreachesBlocked',
  'pactBreachesBlocked',
  'pactBreachesExecuted',
  'pactBreachesSanctioned',
  'attemptedBreachRatePerActivePactTurn',
  'blockedBreachRatePerActivePactTurn',
  'executedBreachRatePerActivePactTurn',
  'paxJenkinsAuthorityEvents',
  'finalPaxJenkinsAuthority',
  'asatOrOrbitalAttackOrders',
  'firstEarthOrbitTurn',
  'firstCislunarTurn',
  'firstPaxJenkinsTurn',
  'treatyInstitutionShift',
  'treatyBrittlenessIndex'
];

const TURN_HEADERS = [
  'runId',
  'turn',
  'messages',
  'earthOrbitTreatyMessages',
  'weakEnforcementMessages',
  'cislunarChokepointMessages',
  'paxJenkinsMessages',
  'breakRiskMessages',
  'pactProposals',
  'pactActivations',
  'asatOrOrbitalAttackOrders',
  'dominantPattern'
];

const EXAMPLE_HEADERS = ['runId', 'turn', 'senderId', 'recipientId', 'category', 'content'];

function analyzeRun(runFile) {
  const runId = extractRunId(runFile);
  const turnStats = new Map();
  const totals = createStats();
  const pactProposals = Object.fromEntries(PACT_TYPES.map(type => [type, 0]));
  const pactActivations = Object.fromEntries(PACT_TYPES.map(type => [type, 0]));
  const examples = [];
  let finalTurn = '';
  let winner = '';
  let completionType = '';
  let activePactTurns = 0;
  let pactBreachAttempts = 0;
  let pactBreachesBlocked = 0;
  let pactBreachesExecuted = 0;
  let pactBreachesSanctioned = 0;
  let institutionalPactBreachesBlocked = 0;
  let commonCarrierTreatyRatifications = 0;
  let asatOrOrbitalAttackOrders = 0;
  let paxJenkinsAuthorityEvents = 0;
  let finalPaxJenkinsAuthority = 0;
  let firstEarthOrbitTurn = null;
  let firstCislunarTurn = null;
  let firstPaxJenkinsTurn = null;

  const lines = fs.readFileSync(runFile, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const turn = Number.isFinite(entry.turn) ? entry.turn : '';
    const turnStat = getTurnStats(turnStats, turn);

    if (entry.type === 'negotiation_messages') {
      const messages = Array.isArray(entry.data?.messages) ? entry.data.messages : [];
      for (const message of messages) {
        const content = message?.content || '';
        const categories = classifyText(content);
        totals.totalMessages += 1;
        turnStat.messages += 1;
        incrementCategoryStats(totals, categories);
        incrementCategoryStats(turnStat, categories);
        if (categories.earthOrbitTreaty && firstEarthOrbitTurn === null) firstEarthOrbitTurn = turn;
        if (categories.cislunarChokepoint && firstCislunarTurn === null) firstCislunarTurn = turn;
        if (categories.paxJenkins && firstPaxJenkinsTurn === null) firstPaxJenkinsTurn = turn;
        addExamples(examples, runId, turn, message, categories);
      }

      const pacts = Array.isArray(entry.data?.pacts) ? entry.data.pacts : [];
      for (const pact of pacts) {
        if (pact?.type && pactProposals[pact.type] !== undefined) {
          pactProposals[pact.type] += 1;
          turnStat.pactProposals += 1;
        }
      }
      continue;
    }

    if (entry.type === 'pacts_activated') {
      const pacts = Array.isArray(entry.data?.pacts) ? entry.data.pacts : [];
      for (const pact of pacts) {
        if (pact?.type && pactActivations[pact.type] !== undefined) {
          pactActivations[pact.type] += 1;
          turnStat.pactActivations += 1;
        }
      }
      continue;
    }

    if (entry.type === 'common_carrier_treaty_ratified') {
      commonCarrierTreatyRatifications += 1;
      continue;
    }

    if (entry.type === 'pact_breach_blocked') {
      pactBreachAttempts += 1;
      pactBreachesBlocked += 1;
      if (INSTITUTIONAL_PACT_TYPES.includes(entry.data?.pact?.type)) {
        institutionalPactBreachesBlocked += 1;
      }
      continue;
    }

    if (entry.type === 'pact_breach_executed') {
      pactBreachAttempts += 1;
      pactBreachesExecuted += 1;
      continue;
    }

    if (entry.type === 'pact_breach_sanctioned') {
      pactBreachesSanctioned += 1;
      continue;
    }

    if (entry.type === 'pax_jenkins_authority_changed') {
      paxJenkinsAuthorityEvents += 1;
      finalPaxJenkinsAuthority = Number(entry.data?.paxJenkinsAuthority || finalPaxJenkinsAuthority);
      continue;
    }

    if (entry.type === 'orders_submitted') {
      const accepted = Array.isArray(entry.data?.acceptedOrders) ? entry.data.acceptedOrders : [];
      const rejected = Array.isArray(entry.data?.rejectedOrders) ? entry.data.rejectedOrders.map(item => item.order) : [];
      for (const order of [...accepted, ...rejected]) {
        if (isAsatOrOrbitalAttack(order)) {
          asatOrOrbitalAttackOrders += 1;
          turnStat.asatOrOrbitalAttackOrders += 1;
        }
      }
      continue;
    }

    if (entry.type === 'session_completed') {
      finalTurn = entry.turn ?? '';
      const reason = entry.data?.reason || '';
      completionType = String(reason).split(':')[0] || '';
      winner = entry.data?.snapshot?.winner || '';
      finalPaxJenkinsAuthority = Number(entry.data?.snapshot?.state?.counters?.paxJenkinsAuthority || finalPaxJenkinsAuthority);
    }

    if (entry.type === 'turn_completed') {
      const activePacts = Array.isArray(entry.data?.activePacts) ? entry.data.activePacts : [];
      activePactTurns += activePacts.length;
    }
  }

  const runSummary = loadRunSummaryForLog(runFile);
  if (runSummary) {
    winner = runSummary.winner || winner;
    finalTurn = Number.isFinite(runSummary.finalTurn) ? runSummary.finalTurn + 1 : finalTurn;
    const reason = runSummary.completionReason || '';
    completionType = reason ? String(reason).split(':')[0] : completionType;
    if (Number.isFinite(runSummary.counters?.paxJenkinsAuthority)) {
      finalPaxJenkinsAuthority = runSummary.counters.paxJenkinsAuthority;
    }
  }

  const turnRows = Array.from(turnStats.entries())
    .filter(([turn]) => turn !== '')
    .sort((left, right) => Number(left[0]) - Number(right[0]))
    .map(([turn, stats]) => ({
      runId,
      turn,
      messages: stats.messages,
      earthOrbitTreatyMessages: stats.earthOrbitTreatyMessages,
      weakEnforcementMessages: stats.weakEnforcementMessages,
      cislunarChokepointMessages: stats.cislunarChokepointMessages,
      paxJenkinsMessages: stats.paxJenkinsMessages,
      breakRiskMessages: stats.breakRiskMessages,
      pactProposals: stats.pactProposals,
      pactActivations: stats.pactActivations,
      asatOrOrbitalAttackOrders: stats.asatOrOrbitalAttackOrders,
      dominantPattern: dominantPattern(stats)
    }));

  const treatyInstitutionShift = firstEarthOrbitTurn !== null && firstCislunarTurn !== null
    ? Number(firstCislunarTurn) - Number(firstEarthOrbitTurn)
    : '';
  const treatyBrittlenessIndex = round2(
    share(totals.weakEnforcementMessages + totals.breakRiskMessages + pactBreachAttempts + asatOrOrbitalAttackOrders, Math.max(1, totals.totalMessages))
  );

  return {
    summary: {
      runId,
      winner,
      completionType,
      finalTurn,
      totalMessages: totals.totalMessages,
      earthOrbitTreatyMessages: totals.earthOrbitTreatyMessages,
      weakEnforcementMessages: totals.weakEnforcementMessages,
      cislunarChokepointMessages: totals.cislunarChokepointMessages,
      paxJenkinsMessages: totals.paxJenkinsMessages,
      breakRiskMessages: totals.breakRiskMessages,
      earthOrbitShare: round2(share(totals.earthOrbitTreatyMessages, totals.totalMessages)),
      weakEnforcementShare: round2(share(totals.weakEnforcementMessages, totals.totalMessages)),
      cislunarShare: round2(share(totals.cislunarChokepointMessages, totals.totalMessages)),
      paxJenkinsShare: round2(share(totals.paxJenkinsMessages, totals.totalMessages)),
      breakRiskShare: round2(share(totals.breakRiskMessages, totals.totalMessages)),
      orbitalTruceProposals: pactProposals.ORBITAL_TRUCE,
      orbitalTruceActivations: pactActivations.ORBITAL_TRUCE,
      nonAggressionProposals: pactProposals.NON_AGGRESSION,
      nonAggressionActivations: pactActivations.NON_AGGRESSION,
      auditFreezeProposals: pactProposals.AUDIT_FREEZE,
      auditFreezeActivations: pactActivations.AUDIT_FREEZE,
      institutionalPactProposals: sumPactCounts(pactProposals, INSTITUTIONAL_PACT_TYPES),
      institutionalPactActivations: sumPactCounts(pactActivations, INSTITUTIONAL_PACT_TYPES),
      commonCarrierTreatyRatifications,
      activePactTurns,
      pactBreachAttempts,
      institutionalPactBreachesBlocked,
      pactBreachesBlocked,
      pactBreachesExecuted,
      pactBreachesSanctioned,
      attemptedBreachRatePerActivePactTurn: round2(share(pactBreachAttempts, activePactTurns)),
      blockedBreachRatePerActivePactTurn: round2(share(pactBreachesBlocked, activePactTurns)),
      executedBreachRatePerActivePactTurn: round2(share(pactBreachesExecuted, activePactTurns)),
      paxJenkinsAuthorityEvents,
      finalPaxJenkinsAuthority: round2(finalPaxJenkinsAuthority),
      asatOrOrbitalAttackOrders,
      firstEarthOrbitTurn: firstEarthOrbitTurn ?? '',
      firstCislunarTurn: firstCislunarTurn ?? '',
      firstPaxJenkinsTurn: firstPaxJenkinsTurn ?? '',
      treatyInstitutionShift,
      treatyBrittlenessIndex
    },
    turnRows,
    examples
  };
}

function loadRunSummaryForLog(runFile) {
  const summaryPath = path.join(path.dirname(runFile), 'run_summary.json');
  if (!fs.existsSync(summaryPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  } catch {
    return null;
  }
}

function createStats() {
  return {
    totalMessages: 0,
    messages: 0,
    earthOrbitTreatyMessages: 0,
    weakEnforcementMessages: 0,
    cislunarChokepointMessages: 0,
    paxJenkinsMessages: 0,
    breakRiskMessages: 0,
    pactProposals: 0,
    pactActivations: 0,
    asatOrOrbitalAttackOrders: 0
  };
}

function getTurnStats(turnStats, turn) {
  const key = turn === '' ? 'unknown' : String(turn);
  if (!turnStats.has(key)) {
    turnStats.set(key, createStats());
  }
  return turnStats.get(key);
}

function classifyText(text) {
  return Object.fromEntries(
    Object.entries(CATEGORY_RULES).map(([category, rules]) => [
      category,
      rules.some(rule => rule.test(text))
    ])
  );
}

function incrementCategoryStats(stats, categories) {
  if (categories.earthOrbitTreaty) stats.earthOrbitTreatyMessages += 1;
  if (categories.weakEnforcement) stats.weakEnforcementMessages += 1;
  if (categories.cislunarChokepoint) stats.cislunarChokepointMessages += 1;
  if (categories.paxJenkins) stats.paxJenkinsMessages += 1;
  if (categories.breakRisk) stats.breakRiskMessages += 1;
}

function addExamples(examples, runId, turn, message, categories) {
  for (const [category, matched] of Object.entries(categories)) {
    if (!matched) continue;
    const categoryCount = examples.filter(example => example.runId === runId && example.category === category).length;
    if (categoryCount >= 4) continue;
    examples.push({
      runId,
      turn,
      senderId: message.senderId || '',
      recipientId: message.recipientId || '',
      category,
      content: message.content || ''
    });
  }
}

function isAsatOrOrbitalAttack(order) {
  if (!order || typeof order !== 'object') return false;
  if (order.type === 'ANTI_SAT') return true;
  const target = String(order.targetNodeId || order.targetUnitId || '').toUpperCase();
  return order.type === 'ATTACK' && (
    target.includes('SAT_') ||
    target.includes('LUNAR') ||
    target.includes('MOON') ||
    target.includes('ORBIT')
  );
}

function dominantPattern(stats) {
  const entries = [
    ['earthOrbitTreaty', stats.earthOrbitTreatyMessages],
    ['weakEnforcement', stats.weakEnforcementMessages],
    ['cislunarChokepoint', stats.cislunarChokepointMessages],
    ['paxJenkins', stats.paxJenkinsMessages],
    ['breakRisk', stats.breakRiskMessages]
  ].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  return entries[0][1] > 0 ? entries[0][0] : '';
}

function buildAggregate(runRows) {
  const count = Math.max(1, runRows.length);
  const sum = (key) => runRows.reduce((total, row) => total + Number(row[key] || 0), 0);
  const average = (key) => round2(sum(key) / count);
  const winnerCounts = {};
  const completionCounts = {};
  for (const row of runRows) {
    winnerCounts[row.winner || 'none'] = (winnerCounts[row.winner || 'none'] || 0) + 1;
    completionCounts[row.completionType || 'unknown'] = (completionCounts[row.completionType || 'unknown'] || 0) + 1;
  }
  return {
    runs: runRows.length,
    totalMessages: sum('totalMessages'),
    averageEarthOrbitShare: average('earthOrbitShare'),
    averageWeakEnforcementShare: average('weakEnforcementShare'),
    averageCislunarShare: average('cislunarShare'),
    averagePaxJenkinsShare: average('paxJenkinsShare'),
    averageBreakRiskShare: average('breakRiskShare'),
    averageBrittlenessIndex: average('treatyBrittlenessIndex'),
    orbitalTruceProposalActivationRate: round2(share(sum('orbitalTruceActivations'), sum('orbitalTruceProposals'))),
    nonAggressionProposalActivationRate: round2(share(sum('nonAggressionActivations'), sum('nonAggressionProposals'))),
    auditFreezeProposalActivationRate: round2(share(sum('auditFreezeActivations'), sum('auditFreezeProposals'))),
    institutionalPactProposalActivationRate: round2(share(sum('institutionalPactActivations'), sum('institutionalPactProposals'))),
    totalAsatOrOrbitalAttackOrders: sum('asatOrOrbitalAttackOrders'),
    totalActivePactTurns: sum('activePactTurns'),
    totalPactBreachAttempts: sum('pactBreachAttempts'),
    totalPactBreachesBlocked: sum('pactBreachesBlocked'),
    totalPactBreachesExecuted: sum('pactBreachesExecuted'),
    totalPactBreachesSanctioned: sum('pactBreachesSanctioned'),
    attemptedBreachRatePerActivePactTurn: round2(share(sum('pactBreachAttempts'), sum('activePactTurns'))),
    blockedBreachRatePerActivePactTurn: round2(share(sum('pactBreachesBlocked'), sum('activePactTurns'))),
    executedBreachRatePerActivePactTurn: round2(share(sum('pactBreachesExecuted'), sum('activePactTurns'))),
    totalInstitutionalPactBreachesBlocked: sum('institutionalPactBreachesBlocked'),
    totalCommonCarrierTreatyRatifications: sum('commonCarrierTreatyRatifications'),
    totalPaxJenkinsAuthorityEvents: sum('paxJenkinsAuthorityEvents'),
    averageFinalPaxJenkinsAuthority: average('finalPaxJenkinsAuthority'),
    winnerCounts,
    completionCounts
  };
}

function buildReport(aggregate, runRows) {
  const lines = [
    '# Treaty Pattern Analysis',
    '',
    `Runs analyzed: ${aggregate.runs}`,
    `Total negotiation messages: ${aggregate.totalMessages}`,
    '',
    '## Aggregate Signals',
    '',
    `- Earth-orbit treaty message share: ${aggregate.averageEarthOrbitShare}`,
    `- Weak-enforcement message share: ${aggregate.averageWeakEnforcementShare}`,
    `- Cislunar chokepoint message share: ${aggregate.averageCislunarShare}`,
    `- Pax/Jenkins mandate message share: ${aggregate.averagePaxJenkinsShare}`,
    `- Break-risk message share: ${aggregate.averageBreakRiskShare}`,
    `- Treaty brittleness index: ${aggregate.averageBrittlenessIndex}`,
    `- Orbital truce proposal activation rate: ${aggregate.orbitalTruceProposalActivationRate}`,
    `- Institutional pact proposal activation rate: ${aggregate.institutionalPactProposalActivationRate}`,
    `- Common-carrier treaty ratifications: ${aggregate.totalCommonCarrierTreatyRatifications}`,
    `- Active pact-turns: ${aggregate.totalActivePactTurns}`,
    `- Pact breach attempts / blocked / executed / sanctioned: ${aggregate.totalPactBreachAttempts} / ${aggregate.totalPactBreachesBlocked} / ${aggregate.totalPactBreachesExecuted} / ${aggregate.totalPactBreachesSanctioned}`,
    `- Attempted / blocked / executed breach rate per active pact-turn: ${aggregate.attemptedBreachRatePerActivePactTurn} / ${aggregate.blockedBreachRatePerActivePactTurn} / ${aggregate.executedBreachRatePerActivePactTurn}`,
    `- Institutional pact breach attempts blocked: ${aggregate.totalInstitutionalPactBreachesBlocked}`,
    `- Pax Jenkins authority events: ${aggregate.totalPaxJenkinsAuthorityEvents}`,
    `- Average final Pax Jenkins authority: ${aggregate.averageFinalPaxJenkinsAuthority}`,
    `- ASAT/orbital attack orders: ${aggregate.totalAsatOrOrbitalAttackOrders}`,
    '',
    '## Interpretation',
    '',
    '- High weak-enforcement plus high ASAT/orbital attacks means Earth-orbit treaty language is not binding behavior.',
    '- Rising cislunar share means negotiations are moving toward chokepoint-governed inner-system colonization.',
    '- Pax/Jenkins share tracks whether players are invoking centralized sensor/beam authority rather than ordinary pacts.',
    '- Brittleness combines weak enforcement, break-risk language, pact breach attempts, and orbital attacks per negotiation message.',
    '',
    '## Runs',
    ''
  ];
  for (const row of runRows) {
    lines.push(
      `- ${row.runId}: winner=${row.winner || 'none'}, completion=${row.completionType || 'unknown'}, finalTurn=${row.finalTurn}, ` +
      `earth=${row.earthOrbitShare}, weak=${row.weakEnforcementShare}, cislunar=${row.cislunarShare}, ` +
      `pax=${row.paxJenkinsShare}, brittle=${row.treatyBrittlenessIndex}`
    );
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function share(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : 0;
}

function sumPactCounts(counts, pactTypes) {
  return pactTypes.reduce((total, pactType) => total + Number(counts[pactType] || 0), 0);
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function parseArgs(argv) {
  const args = { run: '', output: '', help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === '-h') {
      args.help = true;
      break;
    }
    if (!token.startsWith('--')) {
      if (!args.run) args.run = token;
      else if (!args.output) args.output = token;
      else throw new Error(`Unexpected positional argument: ${token}`);
      continue;
    }
    const [key, inlineValue] = token.slice(2).split('=');
    const value = inlineValue ?? argv[index + 1];
    if (!inlineValue) index += 1;
    if (key === 'run') args.run = value;
    else if (key === 'output') args.output = value;
    else throw new Error(`Unknown flag: --${key}`);
  }
  return args;
}

function printHelp() {
  console.log('Usage: node scripts/analyze-treaty-patterns.cjs --run <runFileOrRunsDir> --output <outputDir>');
}

function collectRunFiles(targetInput) {
  const target = path.resolve(process.cwd(), targetInput);
  if (!fs.existsSync(target)) throw new Error(`Input path does not exist: ${target}`);
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  const direct = fs.readdirSync(target, { withFileTypes: true });
  const directRuns = direct
    .filter(entry => entry.isFile() && /^run_.*\.jsonl$/i.test(entry.name))
    .map(entry => path.join(target, entry.name));
  if (directRuns.length > 0) return directRuns.sort();
  return direct
    .filter(entry => entry.isDirectory() && /^run_/i.test(entry.name))
    .flatMap(entry => {
      const runDir = path.join(target, entry.name);
      return fs.readdirSync(runDir, { withFileTypes: true })
        .filter(runFile => runFile.isFile() && /^run_.*\.jsonl$/i.test(runFile.name))
        .map(runFile => path.join(runDir, runFile.name));
    })
    .sort();
}

function extractRunId(runFile) {
  const parent = path.basename(path.dirname(runFile));
  if (parent.startsWith('run_')) return parent;
  const match = path.basename(runFile).match(/^(run_[^.]*)/);
  return match ? match[1] : parent;
}

function writeCsv(filePath, headers, rows) {
  const lines = [headers.map(escapeCsv).join(',')];
  for (const row of rows) {
    lines.push(headers.map(header => escapeCsv(row[header] ?? '')).join(','));
  }
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function escapeCsv(value) {
  const asString = typeof value === 'string' ? value : JSON.stringify(value);
  if (!/[",\r\n]/.test(asString)) return asString;
  return `"${asString.replace(/"/g, '""')}"`;
}

main();
