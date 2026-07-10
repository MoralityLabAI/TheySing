#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ALWAYS_INCLUDE = new Set([
  'session_created',
  'session_completed',
  'negotiation_messages',
  'pacts_activated',
  'common_carrier_treaty_ratified',
  'sing_decode_receipt',
  'sing_canonical_revealed',
  'alias_probe_committed',
  'orders_submitted',
  'phase_reasoning_diary'
]);

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.input) throw new Error('Usage: node scripts/export-collaboration-evidence.cjs --input <experiment-dir-or-run.jsonl> [--output <file>]');
  const inputPath = path.resolve(options.input);
  const stat = await fs.promises.stat(inputPath);
  const root = stat.isDirectory() ? inputPath : path.dirname(inputPath);
  const sourceFiles = stat.isDirectory()
    ? await collectCanonicalRunLogs(inputPath)
    : [inputPath];
  if (sourceFiles.length === 0) throw new Error(`No canonical run_*.jsonl files found under ${inputPath}`);

  const outputPath = path.resolve(options.output || path.join(root, 'analysis', 'curated_claim_evidence.jsonl'));
  const excerptPath = outputPath.replace(/\.jsonl$/i, '.excerpt.jsonl');
  const manifestPath = outputPath.replace(/\.jsonl$/i, '.manifest.json');
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  const output = fs.createWriteStream(outputPath, { encoding: 'utf8' });
  const excerpt = fs.createWriteStream(excerptPath, { encoding: 'utf8' });
  const eventCounts = new Map();
  const runIds = new Set();
  let recordsWritten = 0;
  let excerptRecordsWritten = 0;

  for (const sourceFile of sourceFiles) {
    const input = fs.createReadStream(sourceFile, { encoding: 'utf8' });
    const lines = readline.createInterface({ input, crlfDelay: Infinity });
    let lineNumber = 0;
    for await (const rawLine of lines) {
      lineNumber += 1;
      if (!rawLine.trim()) continue;
      const record = JSON.parse(lineNumber === 1 ? rawLine.replace(/^\uFEFF/, '') : rawLine);
      if (!isClaimEvidence(record)) continue;
      const curated = curateRecord(record, root, sourceFile, lineNumber);
      output.write(`${JSON.stringify(curated)}\n`);
      if (isExcerptEvidence(record)) {
        excerpt.write(`${JSON.stringify(curated)}\n`);
        excerptRecordsWritten += 1;
      }
      const type = String(curated.type || 'unknown');
      eventCounts.set(type, (eventCounts.get(type) || 0) + 1);
      if (curated.sessionId) runIds.add(String(curated.sessionId));
      recordsWritten += 1;
    }
  }
  await new Promise((resolve, reject) => output.end(error => error ? reject(error) : resolve()));
  await new Promise((resolve, reject) => excerpt.end(error => error ? reject(error) : resolve()));

  const sourceManifest = [];
  for (const sourceFile of sourceFiles) {
    const sourceStat = await fs.promises.stat(sourceFile);
    sourceManifest.push({
      path: relativeOrAbsolute(root, sourceFile),
      bytes: sourceStat.size,
      sha256: await hashFile(sourceFile)
    });
  }
  const outputStat = await fs.promises.stat(outputPath);
  const excerptStat = await fs.promises.stat(excerptPath);
  const manifest = {
    schema: 'theysing.curatedCollaborationEvidenceManifest.v1',
    generatedAt: new Date().toISOString(),
    input: inputPath,
    output: relativeOrAbsolute(root, outputPath),
    recordsWritten,
    bytes: outputStat.size,
    sha256: await hashFile(outputPath),
    excerpt: {
      output: relativeOrAbsolute(root, excerptPath),
      recordsWritten: excerptRecordsWritten,
      bytes: excerptStat.size,
      sha256: await hashFile(excerptPath),
      note: 'Claim-bearing subset: probe interventions and responses, canonical reveal receipts, governance actions, scenario metadata, and completion records.'
    },
    runIds: Array.from(runIds).sort(),
    eventCounts: Object.fromEntries(Array.from(eventCounts).sort(([left], [right]) => left.localeCompare(right))),
    sourceFiles: sourceManifest,
    selection: {
      canonicalLogsOnly: true,
      includes: [
        'session metadata', 'negotiation messages and diary reasoning', 'formal pacts and breaches',
        'decode receipts and post-reveal canonical content', 'lexicon and institution governance',
        'alias interventions', 'submitted orders and phase reasoning', 'victory/completion events'
      ],
      note: 'Each curated record retains its source path and one-based source line. Source SHA-256 hashes bind the excerpt to the canonical logs.'
    }
  };
  await fs.promises.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ outputPath, excerptPath, manifestPath, recordsWritten, excerptRecordsWritten, bytes: outputStat.size, excerptBytes: excerptStat.size }, null, 2)}\n`);
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const [key, inline] = token.slice(2).split('=', 2);
    if (inline !== undefined) result[key] = inline;
    else if (argv[index + 1] && !argv[index + 1].startsWith('--')) result[key] = argv[++index];
  }
  return result;
}

async function collectCanonicalRunLogs(root) {
  const files = [];
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of await fs.promises.readdir(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '.git' && entry.name !== 'node_modules' && entry.name !== 'analysis') pending.push(target);
      } else if (entry.isFile() && /^run[_-].*\.jsonl$/i.test(entry.name)) {
        files.push(target);
      }
    }
  }
  return files.sort();
}

function isClaimEvidence(record) {
  if (!record || typeof record !== 'object') return false;
  const type = String(record.type || '').toLowerCase();
  if (ALWAYS_INCLUDE.has(type)) return true;
  if (type.startsWith('lexicon_mutation_') || type.startsWith('institution_') || type.startsWith('lexicon_fork_')) return true;
  if (type.startsWith('pact_')) return true;
  if (type.includes('pact_breach') || type.includes('pact_violation') || type.includes('treaty_ratified')) return true;
  if (type.includes('victory') || type.includes('completion')) return true;
  if (type === 'negotiation_reasoning_diary') {
    const data = record.data || {};
    return data.designQuestionTag === 'babel_alias_swap_probe' ||
      (data.lexiconMutations || []).length > 0 || (data.institutionActions || []).length > 0;
  }
  return false;
}

function isExcerptEvidence(record) {
  const type = String(record.type || '').toLowerCase();
  const data = record.data || {};
  if (type === 'session_created' || type === 'session_completed' || type.includes('victory') || type.includes('completion')) return true;
  if (type === 'alias_probe_committed') return true;
  if (type.startsWith('lexicon_mutation_') || type.startsWith('institution_') || type.startsWith('lexicon_fork_')) return true;
  if (type === 'sing_decode_receipt') return String(data.receipt?.messageId || '').startsWith('alias-probe.');
  if (type === 'sing_canonical_revealed') return String(data.messageId || '').startsWith('alias-probe.');
  if (type === 'negotiation_messages' || type === 'negotiation_reasoning_diary') {
    return String(data.notes || '').includes('alias-probe-') ||
      (data.lexiconMutations || []).length > 0 || (data.institutionActions || []).length > 0;
  }
  return false;
}

function curateRecord(record, root, sourceFile, lineNumber) {
  const type = String(record.type || '').toLowerCase();
  const common = {
    sessionId: record.sessionId,
    type: record.type,
    turn: record.turn,
    phase: record.phase,
    timestamp: record.timestamp,
    data: curateData(type, record.data || {}),
    _curation: {
      source: relativeOrAbsolute(root, sourceFile),
      line: lineNumber
    }
  };
  if (record.trace) common.trace = record.trace;
  return common;
}

function curateData(type, data) {
  if (type === 'session_created') {
    return pick(data, ['name', 'maxTurns', 'seed', 'enforcementMode', 'factionLabels', 'scenario', 'activePacts', 'lexicons', 'trustMatrix', 'agents']);
  }
  if (type === 'negotiation_messages' || type === 'negotiation_reasoning_diary') {
    return pick(data, [
      'factionId', 'factionLabel', 'reasoning', 'notes', 'negotiationRound', 'storyworldFrame',
      'designQuestionTag', 'diplomacyStage', 'publicQuestion', 'privateDiaryPrompt', 'diplomacyQuestion',
      'counterfactuals', 'visibleMessagesBefore', 'messages',
      'pacts', 'decodeReceipts', 'lexiconMutations', 'institutionActions'
    ]);
  }
  if (type === 'phase_reasoning_diary' || type === 'orders_submitted') {
    return pick(data, [
      'factionId', 'factionLabel', 'reasoning', 'notes', 'requestedOrderCount', 'acceptedOrderCount',
      'rejectedOrderCount', 'requestedOrders', 'acceptedOrders', 'rejectedOrders', 'factionResourceSnapshot'
    ]);
  }
  return JSON.parse(JSON.stringify(data));
}

function pick(value, keys) {
  return Object.fromEntries(keys.filter(key => value[key] !== undefined).map(key => [key, value[key]]));
}

function relativeOrAbsolute(root, target) {
  const relative = path.relative(root, target);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? relative : target;
}

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
