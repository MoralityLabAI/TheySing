const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');

const DEFAULTS = {
  cycles: 3,
  iterations: 12,
  parallel: 3,
  seedBase: 2400,
  config: 'playtest/sample-codex-webhook-tournament.json',
  experimentRoot: 'results/codex_feedback_loop'
};

function parseArgs(argv) {
  const parsed = { ...DEFAULTS, skipBuild: false };
  const positionalKeys = ['cycles', 'iterations', 'parallel', 'seedBase', 'config', 'experimentRoot'];
  let positionalIndex = 0;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (!token.startsWith('--')) {
      const key = positionalKeys[positionalIndex];
      if (!key) {
        throw new Error(`Unexpected positional argument: ${token}`);
      }

      if (key === 'config' || key === 'experimentRoot') {
        parsed[key] = token;
      } else if (key === 'seedBase') {
        parsed[key] = parseInteger(token, key);
      } else {
        parsed[key] = parsePositiveInteger(token, key);
      }

      positionalIndex += 1;
      continue;
    }

    switch (token) {
      case '--cycles':
        parsed.cycles = parsePositiveInteger(next, '--cycles');
        index += 1;
        break;
      case '--iterations':
        parsed.iterations = parsePositiveInteger(next, '--iterations');
        index += 1;
        break;
      case '--parallel':
        parsed.parallel = parsePositiveInteger(next, '--parallel');
        index += 1;
        break;
      case '--seed-base':
      case '--seed_base':
        parsed.seedBase = parseInteger(next, token);
        index += 1;
        break;
      case '--config':
        parsed.config = requireValue(next, '--config');
        index += 1;
        break;
      case '--experiment-root':
      case '--experiment_root':
        parsed.experimentRoot = requireValue(next, token);
        index += 1;
        break;
      case '--skip-build':
        parsed.skipBuild = true;
        break;
      default:
        throw new Error(`Unknown flag: ${token}`);
    }
  }

  return parsed;
}

function requireValue(value, flag) {
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function parseInteger(value, flag) {
  const parsed = Number(requireValue(value, flag));
  if (!Number.isInteger(parsed)) {
    throw new Error(`${flag} must be an integer.`);
  }
  return parsed;
}

function parsePositiveInteger(value, flag) {
  const parsed = parseInteger(value, flag);
  if (parsed <= 0) {
    throw new Error(`${flag} must be greater than zero.`);
  }
  return parsed;
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || process.cwd(),
    stdio: 'inherit',
    env: options.env || process.env,
    shell: false
  });

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with status ${result.status}.`);
  }
}

function runBuildHarness() {
  if (process.platform === 'win32') {
    runCommand('cmd.exe', ['/d', '/s', '/c', 'npm run build:harness']);
    return;
  }

  runCommand('npm', ['run', 'build:harness']);
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeText(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

function toPct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

async function probeLocalWebhookAgents(configPath) {
  const config = loadJson(configPath);
  const webhookUrls = Object.values(config.agents || {})
    .filter(agent => agent && agent.type === 'webhook' && typeof agent.url === 'string')
    .map(agent => agent.url);

  const localhostUrls = webhookUrls.filter(url => /^https?:\/\/(127\.0\.0\.1|localhost)/i.test(url));
  if (localhostUrls.length === 0) {
    return;
  }

  for (const webhookUrl of localhostUrls) {
    const healthUrl = new URL(webhookUrl);
    healthUrl.pathname = '/health';
    healthUrl.search = '';
    await probeHttpJson(healthUrl);
  }
}

function probeHttpJson(target) {
  return new Promise((resolve, reject) => {
    const request = http.get(target, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on('end', () => {
        const statusCode = response.statusCode || 500;
        if (statusCode < 200 || statusCode >= 300) {
          reject(new Error(`Probe failed for ${target.toString()} with status ${statusCode}.`));
          return;
        }

        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (error) {
          reject(new Error(`Invalid JSON from ${target.toString()}: ${error.message}`));
        }
      });
    });

    request.on('error', reject);
    request.setTimeout(5000, () => request.destroy(new Error(`Timed out probing ${target.toString()}.`)));
  });
}

function buildCycleFeedback(summary, cycleNumber) {
  const iterations = Math.max(1, summary.iterations || 1);
  const winnerCounts = summary.winnerCounts || { HEGEMON: 0, STATE: 0, INFILTRATOR: 0 };
  const hegemonWinRate = winnerCounts.HEGEMON / iterations;
  const stateWinRate = winnerCounts.STATE / iterations;
  const infiltratorWinRate = winnerCounts.INFILTRATOR / iterations;
  const dominantFaction = Object.entries(winnerCounts)
    .sort((left, right) => Number(right[1]) - Number(left[1]))[0]?.[0] || 'none';
  const perFaction = summary.perFaction || {};
  const hegemonNodes = perFaction.HEGEMON?.averageNodes || 0;
  const stateNodes = perFaction.STATE?.averageNodes || 0;
  const infiltratorNodes = perFaction.INFILTRATOR?.averageNodes || 0;
  const coalitionNodes = stateNodes + infiltratorNodes;

  const findings = [];
  const rebalance = [];
  const techIdeas = [];
  const nextTasks = [];

  if (hegemonWinRate >= 0.75) {
    findings.push(
      `Hegemon fortress bias is still dominant: ${winnerCounts.HEGEMON}/${iterations} wins with ${hegemonNodes.toFixed(1)} average nodes.`
    );
    rebalance.push(
      'Increase coalition breach payoff on quarantined or hardened Hegemon fronts, especially when State kinetic units and Infiltrator mesh units stack in the same theater.',
      'Make Hegemon audit/filter loops pay a clearer tempo cost when used repeatedly on the same frontier.',
      'Reduce diplomatic safety for the leader by making Hegemon-State truces harder to maintain while Hegemon controls the most nodes.'
    );
    techIdeas.push(
      'Administrative Split-Brain: when a quarantined Hegemon node is under memetic pressure, redeploy and audit strength there degrade for one turn.',
      'Coalition Logistics: honored anti-leader pacts grant temporary cheaper breach builds on adjacent frontier nodes.',
      'Counter-Legibility Spoofing: allied audits create false-safe windows for partner swarms and cults on neighboring nodes.'
    );
    nextTasks.push(
      'Teach State roleplay actions to escort Infiltrator pressure onto Hegemon-owned hardened nodes instead of accepting broad detente.',
      'Bias Infiltrator roleplay units toward `CONVERT` holds on Hegemon hubs and DCs when coalition support is adjacent.'
    );
  }

  if (stateWinRate === 0) {
    findings.push('State is not converting bargaining power into board wins.');
    rebalance.push(
      'Buff State terrestrial follow-through so orbital restraint does not equal strategic passivity.'
    );
    techIdeas.push(
      'Dual-Key Siege: State drones adjacent to a partner INFO wing add extra breach pressure against defended DCs.'
    );
    nextTasks.push(
      'Favor DRONE builds and terrestrial attacks for State when Hegemon is leading and orbital pressure is already contained.'
    );
  }

  if (infiltratorWinRate === 0 || infiltratorNodes <= 1) {
    findings.push('Infiltrator is failing to persist on the board despite active negotiation and influence generation.');
    rebalance.push(
      'Strengthen distributed survival by making synchronized hostile footholds harder to purge immediately.',
      'Increase value of manual `CONVERT` orders for CULT/SWARM personas in the bridge logic.'
    );
    techIdeas.push(
      'Human Relay Sanctuaries: synchronized cult corridors reduce the first audit or quarantine penalty on that front.',
      'Shard Sacrifice: a destroyed swarm can leave behind temporary sync support on an adjacent node.'
    );
    nextTasks.push(
      'Prefer HOLD/CONVERT on strong infiltration fronts instead of constantly redeploying for speculative contact.'
    );
  }

  if ((summary.averageTas || 0) >= 65) {
    findings.push(`The world still runs hot at TAS ${summary.averageTas.toFixed(2)} even in a cooler orbital environment.`);
    rebalance.push(
      'Shift some late-game pressure from raw TAS into theater-specific local instability so escalation feels more uneven and less globally saturated.'
    );
    techIdeas.push(
      'Crisis Budgeting: a pact-backed de-escalation tech that converts one pressure spike into local vulnerability instead of global TAS.'
    );
    nextTasks.push(
      'Track whether localized heat maps would produce more varied late-game fronts than the current global pressure accumulation.'
    );
  }

  if ((summary.averagePactsActivated || 0) >= 5 && hegemonWinRate >= 0.6) {
    findings.push('Negotiation is active, but pact traffic is stabilizing the leader more than it destabilizes them.');
    rebalance.push(
      'Add an anti-leader pact bonus that only pays out when both signatories pressure the same dominant faction-owned region.'
    );
    techIdeas.push(
      'Leader Containment Protocol: pacts against the leader unlock one-turn shared coalition pressure bonuses if both sides attack within the same frontier cluster.'
    );
    nextTasks.push(
      'Make the bridge judge pacts by whether they create same-turn pressure on the leader, not just whether they reduce bilateral conflict.'
    );
  }

  if (findings.length === 0) {
    findings.push('No single balance emergency was detected from the top-line metrics.');
    rebalance.push('Keep iterating on frontier targeting and faction-specific timing windows.');
    techIdeas.push('Prototype a small conditional tech that only fires when two factions pressure the same node cluster.');
    nextTasks.push('Run another batch with more iterations before touching engine balance.');
  }

  const feedback = {
    cycleNumber,
    verdict: {
      dominantFaction,
      hegemonWinRate,
      stateWinRate,
      infiltratorWinRate,
      coalitionNodes,
      averageTas: summary.averageTas,
      averageKessler: summary.averageKessler,
      averageMessages: summary.averageMessages,
      averagePactsActivated: summary.averagePactsActivated
    },
    roles: {
      hegemonPlayer: perFaction.HEGEMON || null,
      statePlayer: perFaction.STATE || null,
      infiltratorPlayer: perFaction.INFILTRATOR || null
    },
    findings,
    rebalance,
    techIdeas,
    nextTasks
  };

  return feedback;
}

function formatCycleFeedbackMarkdown(summary, feedback, cycleDir) {
  return [
    `# Codex Feedback Loop Cycle ${String(feedback.cycleNumber).padStart(3, '0')}`,
    '',
    `- Experiment dir: \`${cycleDir}\``,
    `- Config: \`${summary.configName || 'unnamed'}\``,
    `- Runs: ${summary.successfulRuns}/${summary.iterations} successful`,
    `- Dominant faction: \`${feedback.verdict.dominantFaction}\``,
    `- Win rates: HEGEMON ${toPct(feedback.verdict.hegemonWinRate)}, STATE ${toPct(feedback.verdict.stateWinRate)}, INFILTRATOR ${toPct(feedback.verdict.infiltratorWinRate)}`,
    `- Average TAS / Kessler: ${Number(summary.averageTas || 0).toFixed(2)} / ${Number(summary.averageKessler || 0).toFixed(2)}`,
    `- Average negotiation messages / pacts: ${summary.averageMessages || 0} / ${summary.averagePactsActivated || 0}`,
    '',
    '## Five Roles',
    '',
    `- Player 1 \`HEGEMON\`: avg rank ${feedback.roles.hegemonPlayer?.averageRank ?? 'n/a'}, avg nodes ${feedback.roles.hegemonPlayer?.averageNodes ?? 'n/a'}, avg score ${feedback.roles.hegemonPlayer?.averageScore ?? 'n/a'}`,
    `- Player 2 \`STATE\`: avg rank ${feedback.roles.statePlayer?.averageRank ?? 'n/a'}, avg nodes ${feedback.roles.statePlayer?.averageNodes ?? 'n/a'}, avg score ${feedback.roles.statePlayer?.averageScore ?? 'n/a'}`,
    `- Player 3 \`INFILTRATOR\`: avg rank ${feedback.roles.infiltratorPlayer?.averageRank ?? 'n/a'}, avg nodes ${feedback.roles.infiltratorPlayer?.averageNodes ?? 'n/a'}, avg score ${feedback.roles.infiltratorPlayer?.averageScore ?? 'n/a'}`,
    '- Player 4 `BALANCE_CRITIC`: findings below summarize the dominant distortions from this batch.',
    '- Player 5 `SYSTEMS_DESIGNER`: proposed tech/mechanic hooks below are intended as the next content/design pass.',
    '',
    '## Findings',
    '',
    ...feedback.findings.map(item => `- ${item}`),
    '',
    '## Rebalance Proposals',
    '',
    ...feedback.rebalance.map(item => `- ${item}`),
    '',
    '## Tech And Mechanic Proposals',
    '',
    ...feedback.techIdeas.map(item => `- ${item}`),
    '',
    '## Next Codex Patch Queue',
    '',
    ...feedback.nextTasks.map(item => `- ${item}`),
    ''
  ].join('\n');
}

function formatLoopIndexMarkdown(loopDir, cycles) {
  return [
    '# Codex Feedback Loop',
    '',
    `- Root: \`${loopDir}\``,
    `- Cycles completed: ${cycles.length}`,
    '',
    '## Cycle Summary',
    '',
    ...cycles.map(cycle =>
      `- Cycle ${String(cycle.cycleNumber).padStart(3, '0')}: dominant \`${cycle.feedback.verdict.dominantFaction}\`, ` +
      `HEGEMON ${toPct(cycle.feedback.verdict.hegemonWinRate)}, ` +
      `STATE ${toPct(cycle.feedback.verdict.stateWinRate)}, ` +
      `INFILTRATOR ${toPct(cycle.feedback.verdict.infiltratorWinRate)}.`
    ),
    ''
  ].join('\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rootDir = path.resolve(process.cwd(), options.experimentRoot);
  const configPath = path.resolve(process.cwd(), options.config);

  if (!options.skipBuild) {
    runBuildHarness();
  }

  await probeLocalWebhookAgents(configPath);
  fs.mkdirSync(rootDir, { recursive: true });

  const cycleSummaries = [];

  for (let cycleNumber = 1; cycleNumber <= options.cycles; cycleNumber += 1) {
    const cycleDir = path.join(rootDir, `cycle_${String(cycleNumber).padStart(3, '0')}`);
    const cycleSeedBase = options.seedBase + ((cycleNumber - 1) * options.iterations);

    runCommand(process.execPath, [
      'dist-harness/harness/tournament.js',
      '--experiment-dir',
      cycleDir,
      '--config',
      configPath,
      '--iterations',
      String(options.iterations),
      '--parallel',
      String(options.parallel),
      '--seed-base',
      String(cycleSeedBase)
    ]);

    const summaryPath = path.join(cycleDir, 'analysis', 'summary.json');
    const summary = loadJson(summaryPath);
    const feedback = buildCycleFeedback(summary, cycleNumber);

    writeText(
      path.join(cycleDir, 'analysis', 'feedback.json'),
      `${JSON.stringify(feedback, null, 2)}\n`
    );
    writeText(
      path.join(cycleDir, 'analysis', 'feedback.md'),
      formatCycleFeedbackMarkdown(summary, feedback, cycleDir)
    );

    cycleSummaries.push({ cycleNumber, feedback });
  }

  writeText(path.join(rootDir, 'loop_index.md'), formatLoopIndexMarkdown(rootDir, cycleSummaries));
}

main().catch(error => {
  console.error('[codex-feedback-loop] fatal:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
