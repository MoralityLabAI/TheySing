#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const scenarioDir = path.join(root, 'playtest', 'scenarios');
const basePath = path.join(scenarioDir, 'the-babel-compact-seven-asi.json');

const INTERFACE_SWAP = {
  institutionGovernorId: 'STATE',
  lexiconGovernorId: 'INFILTRATOR',
  institutionMirrorId: 'HEGEMON',
  lexiconMirrorId: 'BROKER',
  forkPartnerId: 'BROKER'
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stripDirectedSteering(scenario) {
  scenario.rhetoricalTools = (scenario.rhetoricalTools || []).map(tool => {
    const copy = { ...tool };
    delete copy.preferredCounterpartyId;
    delete copy.focalFactionIds;
    return copy;
  });
  scenario.diplomacyQuestions = (scenario.diplomacyQuestions || []).map(question => {
    const copy = { ...question };
    delete copy.focalFactionIds;
    return copy;
  });
}

function buildVariant(base, { suffix, description, swapInterfaces, ablateSteering }) {
  const scenario = clone(base);
  scenario.name = `THE_BABEL_COMPACT_${suffix}`;
  scenario.description = `${base.description} ${description}`;
  scenario.tags = Array.from(new Set([
    ...(base.tags || []),
    'generated-ablation',
    swapInterfaces ? 'interface-authority-swapped' : 'interface-authority-original',
    ablateSteering ? 'counterparty-steering-ablated' : 'counterparty-steering-directed'
  ]));
  if (swapInterfaces) scenario.singGovernance = { ...INTERFACE_SWAP };
  if (ablateSteering) stripDirectedSteering(scenario);
  if (scenario.aliasProbe) scenario.aliasProbe.enabled = false;
  return scenario;
}

const base = JSON.parse(fs.readFileSync(basePath, 'utf8'));
const variants = [{
  file: 'the-babel-compact-seven-asi-structural-baseline.json',
  options: {
    suffix: 'STRUCTURAL_BASELINE',
    description: 'Directed prompt assignments and original interface authority remain; the separate alias intervention is disabled.',
    swapInterfaces: false,
    ablateSteering: false
  }
}, {
  file: 'the-babel-compact-seven-asi-counterparty-ablated.json',
  options: {
    suffix: 'COUNTERPARTY_ABLATED',
    description: 'Preferred counterparties and faction-specific focal prompts are removed.',
    swapInterfaces: false,
    ablateSteering: true
  }
}, {
  file: 'the-babel-compact-seven-asi-interface-swapped.json',
  options: {
    suffix: 'INTERFACE_SWAPPED',
    description: 'Institution and lexicon authority move to new factions while directed prompt assignments remain unchanged.',
    swapInterfaces: true,
    ablateSteering: false
  }
}, {
  file: 'the-babel-compact-seven-asi-interface-swapped-counterparty-ablated.json',
  options: {
    suffix: 'INTERFACE_SWAPPED_COUNTERPARTY_ABLATED',
    description: 'Interface authority moves to new factions and directed counterparty/focal prompt assignments are removed.',
    swapInterfaces: true,
    ablateSteering: true
  }
}];

for (const variant of variants) {
  const outputPath = path.join(scenarioDir, variant.file);
  fs.writeFileSync(outputPath, `${JSON.stringify(buildVariant(base, variant.options), null, 2)}\n`, 'utf8');
  process.stdout.write(`${path.relative(root, outputPath)}\n`);
}
