const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST_SESSION = path.join(ROOT, 'dist-harness', 'harness', 'HeadlessPlaytestSession.js');
const PLAYABLE_FACTIONS = ['HEGEMON', 'STATE', 'INFILTRATOR', 'BROKER', 'ARCHIVIST', 'CONVENOR', 'CANTOR'];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runFile = path.resolve(args.run || args._[0] || '');
  if (!runFile || !fs.existsSync(runFile)) {
    throw new Error('Usage: node scripts/replay-harness-run.cjs --run <run.jsonl> [--config <session_config.json>]');
  }

  const runDir = path.dirname(runFile);
  const configPath = path.resolve(args.config || path.join(runDir, 'session_config.json'));
  if (!fs.existsSync(configPath)) {
    throw new Error(`Session config not found: ${path.relative(ROOT, configPath)}`);
  }

  const originalEntries = readJsonl(runFile);
  const sessionId = originalEntries.find((entry) => entry.sessionId)?.sessionId || path.basename(runFile, '.jsonl');
  const originalTurnHashes = extractTurnHashes(originalEntries);
  const turnPlans = buildTurnPlans(originalEntries);

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const replayLogDir = fs.mkdtempSync(path.join(os.tmpdir(), 'theysing-replay-'));
  config.logDir = replayLogDir;

  const { HeadlessPlaytestSession } = require(DIST_SESSION);
  const session = new HeadlessPlaytestSession(config, sessionId);
  await session.initialize();

  for (const turn of Array.from(turnPlans.keys()).sort((left, right) => left - right)) {
    await session.runManualTurn(turnPlans.get(turn));
  }

  await delay(50);
  const replayLogFile = path.join(replayLogDir, `${sessionId}.jsonl`);
  const replayEntries = readJsonl(replayLogFile);
  const replayTurnHashes = extractTurnHashes(replayEntries);
  const mismatches = [];

  for (const [turn, originalHash] of originalTurnHashes.entries()) {
    const replayHash = replayTurnHashes.get(turn);
    if (originalHash !== replayHash) {
      mismatches.push({ turn, originalHash, replayHash: replayHash || null });
    }
  }

  const summary = {
    schema: 'theysing.replayDeterminism.v1',
    runFile: path.relative(ROOT, runFile),
    configPath: path.relative(ROOT, configPath),
    sessionId,
    turnsCompared: originalTurnHashes.size,
    replayLogFile,
    status: mismatches.length === 0 ? 'passed' : 'failed',
    mismatches
  };

  console.log(JSON.stringify(summary, null, 2));
  if (mismatches.length > 0) {
    process.exitCode = 1;
  }
}

function buildTurnPlans(entries) {
  const turns = new Map();
  const completedTurns = new Set(entries
    .filter((entry) => entry.type === 'turn_completed')
    .map((entry) => Number(entry.turn))
    .filter(Number.isFinite));

  for (const turn of completedTurns) {
    turns.set(turn, emptyTurnPlan());
  }

  for (const entry of entries) {
    const turn = Number(entry.turn);
    if (!turns.has(turn)) continue;
    const plan = turns.get(turn);
    const data = entry.data || {};

    if (entry.type === 'negotiation_messages') {
      const factionId = data.factionId;
      if (!PLAYABLE_FACTIONS.includes(factionId)) continue;
      const roundIndex = Math.max(0, Number(data.negotiationRound || 1) - 1);
      while (plan[factionId].negotiationRounds.length <= roundIndex) {
        plan[factionId].negotiationRounds.push({ messages: [], pacts: [] });
      }
      plan[factionId].negotiationRounds[roundIndex] = {
        reasoning: data.reasoning || '',
        notes: data.notes || '',
        messages: Array.isArray(data.messages)
          ? data.messages.map((message) => ({
            recipientId: message.recipientId,
            content: message.content
          }))
          : [],
        pacts: Array.isArray(data.pacts)
          ? data.pacts.map((pact) => ({
            type: pact.type,
            counterpartyIds: Array.isArray(pact.parties)
              ? pact.parties.filter((party) => party !== factionId)
              : [],
            durationTurns: pact.durationTurns
          }))
          : []
      };
      continue;
    }

    if (entry.type === 'phase_reasoning_diary') {
      const factionId = data.factionId;
      if (!PLAYABLE_FACTIONS.includes(factionId)) continue;
      const phaseKey = entry.phase === 'ALLOCATION' ? 'allocation' : entry.phase === 'ACTION_DECLARATION' ? 'action' : null;
      if (!phaseKey) continue;
      plan[factionId][phaseKey] = {
        reasoning: data.reasoning || '',
        notes: data.notes || '',
        orders: Array.isArray(data.requestedOrders) ? data.requestedOrders.map(stripOrderForReplay) : []
      };
    }
  }

  for (const plan of turns.values()) {
    for (const factionId of PLAYABLE_FACTIONS) {
      if (plan[factionId].negotiationRounds.length === 0) {
        plan[factionId].negotiationRounds.push({ messages: [], pacts: [] });
      }
    }
  }

  return turns;
}

function stripOrderForReplay(order) {
  return {
    type: order.type,
    unitId: order.unitId,
    targetNodeId: order.targetNodeId,
    targetEdgeId: order.targetEdgeId,
    targetUnitId: order.targetUnitId,
    supportingUnitId: order.supportingUnitId,
    techDomain: order.techDomain,
    unitTypeToBuild: order.unitTypeToBuild
  };
}

function emptyTurnPlan() {
  return Object.fromEntries(PLAYABLE_FACTIONS.map((factionId) => [
    factionId,
    {
      negotiationRounds: [],
      allocation: { orders: [] },
      action: { orders: [] }
    }
  ]));
}

function extractTurnHashes(entries) {
  const hashes = new Map();
  for (const entry of entries) {
    if (entry.type !== 'turn_completed') continue;
    const turn = Number(entry.turn);
    const hash = entry.trace?.post_state_hash;
    if (Number.isFinite(turn) && typeof hash === 'string') {
      hashes.set(turn, hash);
    }
  }
  return hashes;
}

function readJsonl(file) {
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line.replace(/^\uFEFF/, ''));
      } catch (error) {
        throw new Error(`Invalid JSONL at ${path.relative(ROOT, file)}:${index + 1}: ${error.message}`);
      }
    });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      args[key] = argv[index + 1];
      index += 1;
    } else {
      args._.push(arg);
    }
  }
  return args;
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
