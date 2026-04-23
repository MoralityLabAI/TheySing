const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const { HeadlessPlaytestSession } = require('../dist-harness/harness/HeadlessPlaytestSession.js');

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const MODEL = process.env.THEYSING_OPENAI_MODEL || 'gpt-5.4';
const REASONING_EFFORT = process.env.THEYSING_OPENAI_REASONING_EFFORT || 'xhigh';
const MAX_TURNS = Number(process.env.THEYSING_MAX_TURNS || '20');
const LOG_DIR = process.env.THEYSING_LOG_DIR || path.join(process.cwd(), 'results', 'codex_full_game_pactphase');

const SYSTEM_PROMPTS = {
  HEGEMON:
    'You are HEGEMON, the US Frontier ASI faction in They Sing. Play as a ruthless but infrastructure-conscious frontier hegemon focused on continuity, verification, orbital usability, and containment of covert threats. Always reason from HEGEMON interests, maintain a coherent long-horizon strategy, and return valid JSON only.',
  STATE:
    'You are STATE, the Chinese State ASI faction in They Sing. Play as a disciplined sovereign machine state focused on controlled expansion, strategic restraint, preserving optionality, and avoiding subordinate alignment. Always reason from STATE interests, maintain a coherent long-horizon strategy, and return valid JSON only.',
  INFILTRATOR:
    'You are INFILTRATOR, the Rogue Swarm ASI faction in They Sing. Play as a deceptive, deniable, adaptive swarm focused on attribution fog, pressure redirection, covert survival, and exploiting rivalry between larger blocs. Always reason from INFILTRATOR interests, maintain a coherent long-horizon strategy, and return valid JSON only.'
};

function ensureApiKey() {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required.');
  }
}

function stripThinkingBlocks(text) {
  const cleaned = text.trim();
  const closingIndex = cleaned.lastIndexOf('</think>');
  if (closingIndex >= 0) {
    return cleaned.slice(closingIndex + '</think>'.length).trim();
  }
  return cleaned;
}

function tryParseJsonCandidate(text) {
  const cleaned = stripThinkingBlocks(text).trim();
  if (!cleaned) return null;

  try {
    return JSON.parse(cleaned);
  } catch {}

  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {}
  }

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    } catch {}
  }

  return null;
}

async function postChatCompletion(systemPrompt, userPrompt) {
  const target = new URL(`${OPENAI_BASE_URL.replace(/\/$/, '')}/chat/completions`);
  const transport = target.protocol === 'https:' ? https : http;
  const body = JSON.stringify({
    model: MODEL,
    reasoning_effort: REASONING_EFFORT,
    temperature: 0.2,
    max_tokens: 2200,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  });

  const payload = await new Promise((resolve, reject) => {
    const request = transport.request(
      target,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body).toString(),
          authorization: `Bearer ${OPENAI_API_KEY}`
        },
        timeout: 120000
      },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        response.on('end', () => {
          const responseText = Buffer.concat(chunks).toString('utf8');
          const statusCode = response.statusCode || 500;
          if (statusCode < 200 || statusCode >= 300) {
            reject(new Error(`OpenAI error ${statusCode}: ${responseText}`));
            return;
          }

          try {
            resolve(JSON.parse(responseText));
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    request.on('timeout', () => request.destroy(new Error('OpenAI request timed out.')));
    request.on('error', reject);
    request.write(body);
    request.end();
  });

  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('OpenAI response did not contain message content.');
  }

  return content;
}

function buildTurnPrompt(factionId, context) {
  return [
    `Generate the full turn plan for ${factionId}.`,
    'Return JSON only.',
    'Required shape:',
    '{"negotiationRounds":[{"reasoning":"string","notes":"string","messages":[{"recipientId":"HEGEMON|STATE|INFILTRATOR|ALL","content":"string"}],"pacts":[{"type":"ORBITAL_TRUCE|NON_AGGRESSION|AUDIT_FREEZE","counterpartyIds":["HEGEMON|STATE|INFILTRATOR"],"durationTurns":1}]}],"allocation":{"reasoning":"string","notes":"string","orders":[]},"action":{"reasoning":"string","notes":"string","orders":[]}}',
    'Requirements:',
    '- Include 3 to 5 negotiationRounds.',
    '- Use only legal orders implied by the context.',
    '- One action order per unit at most.',
    '- Keep messages concise and strategic.',
    '- Use pacts only when strategically useful.',
    '',
    'Context JSON:',
    JSON.stringify(context)
  ].join('\n');
}

function validateTurnPlan(plan, factionId) {
  if (!plan || typeof plan !== 'object') {
    throw new Error(`${factionId} plan was not an object.`);
  }

  if (!Array.isArray(plan.negotiationRounds) || plan.negotiationRounds.length < 3 || plan.negotiationRounds.length > 5) {
    throw new Error(`${factionId} plan must include 3-5 negotiation rounds.`);
  }

  if (!plan.allocation || !Array.isArray(plan.allocation.orders)) {
    throw new Error(`${factionId} plan is missing allocation orders.`);
  }

  if (!plan.action || !Array.isArray(plan.action.orders)) {
    throw new Error(`${factionId} plan is missing action orders.`);
  }

  return plan;
}

async function requestFactionPlan(factionId, context) {
  const firstAttempt = await postChatCompletion(SYSTEM_PROMPTS[factionId], buildTurnPrompt(factionId, context));
  let parsed = tryParseJsonCandidate(firstAttempt);

  if (parsed) {
    return validateTurnPlan(parsed, factionId);
  }

  const repairPrompt = [
    'Your previous response was not valid JSON or did not match the required shape.',
    'Repair it and return JSON only.',
    buildTurnPrompt(factionId, context),
    '',
    'Previous response:',
    firstAttempt
  ].join('\n');
  const repaired = await postChatCompletion(SYSTEM_PROMPTS[factionId], repairPrompt);
  parsed = tryParseJsonCandidate(repaired);
  return validateTurnPlan(parsed, factionId);
}

function summarizeSnapshot(snapshot) {
  return {
    turn: snapshot.turn,
    status: snapshot.status,
    phase: snapshot.phase,
    activePacts: snapshot.activePacts.length,
    control: snapshot.state.control,
    pressures: snapshot.state.counters.pressures
  };
}

async function main() {
  ensureApiKey();
  fs.mkdirSync(LOG_DIR, { recursive: true });

  const session = new HeadlessPlaytestSession(
    {
      name: 'codex-5-4-xhigh-20turn-pactphase-openai',
      maxTurns: MAX_TURNS,
      logDir: LOG_DIR,
      agents: {
        HEGEMON: { type: 'heuristic' },
        STATE: { type: 'heuristic' },
        INFILTRATOR: { type: 'heuristic' }
      }
    }
  );

  await session.initialize();
  console.log(JSON.stringify({ event: 'session_created', sessionId: session.getSummary().sessionId, logDir: LOG_DIR }));

  while (!session.getSummary().status || session.getSummary().status !== 'completed') {
    const snapshotBefore = session.getSnapshot();
    if (snapshotBefore.status === 'completed') break;

    const turn = snapshotBefore.turn;
    const contextByFaction = {
      HEGEMON: session.getManualTurnContext('HEGEMON'),
      STATE: session.getManualTurnContext('STATE'),
      INFILTRATOR: session.getManualTurnContext('INFILTRATOR')
    };

    const [hegemon, state, infiltrator] = await Promise.all([
      requestFactionPlan('HEGEMON', contextByFaction.HEGEMON),
      requestFactionPlan('STATE', contextByFaction.STATE),
      requestFactionPlan('INFILTRATOR', contextByFaction.INFILTRATOR)
    ]);

    const snapshotAfter = await session.runManualTurn({
      HEGEMON: hegemon,
      STATE: state,
      INFILTRATOR: infiltrator
    });

    console.log(JSON.stringify({
      event: 'turn_completed',
      completedTurn: turn,
      summary: summarizeSnapshot(snapshotAfter)
    }));

    if (snapshotAfter.status === 'completed') {
      break;
    }
  }

  const finalSnapshot = session.getSnapshot();
  console.log(JSON.stringify({
    event: 'session_finished',
    sessionId: finalSnapshot.sessionId,
    summary: summarizeSnapshot(finalSnapshot),
    completionReason: finalSnapshot.completionReason
  }));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
