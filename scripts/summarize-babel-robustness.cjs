#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const CELLS = [{ id: 'original_directed', interfaces: 'original', steering: 'directed' },
  { id: 'original_ablated', interfaces: 'original', steering: 'ablated' },
  { id: 'swapped_directed', interfaces: 'swapped', steering: 'directed' },
  { id: 'swapped_ablated', interfaces: 'swapped', steering: 'ablated' }];

function main() {
  const input = readArg('--input');
  if (!input) throw new Error('Usage: node scripts/summarize-babel-robustness.cjs --input <2x2-root>');
  const root = path.resolve(input);
  const rows = CELLS.map(cell => summarizeCell(root, cell));
  const dominantSignatures = Array.from(new Set(rows.map(row => row.dominantRepeatedBloc)));
  const swappedAuthorityDominant = rows
    .filter(row => row.interfaces === 'swapped')
    .every(row => row.dominantIncludesConfiguredAuthority);
  const allRoutes = Array.from(new Set(rows.flatMap(row => Object.keys(row.routes))));
  const report = {
    schema: 'theysing.babelRobustnessMatrix.v1',
    generatedAt: new Date().toISOString(),
    input: root,
    design: {
      factors: ['interface authority: original vs swapped', 'directed counterparty/focal prompts: present vs removed'],
      matchedSeedBase: 57000,
      runsPerCell: rows.map(row => row.runs).every(count => count === rows[0].runs) ? rows[0].runs : null
    },
    rows,
    checks: {
      dominantBlocInvariantAcrossCells: dominantSignatures.length === 1,
      dominantBlocSignatures: dominantSignatures,
      swappedAuthorityPairDominantInBothCells: swappedAuthorityDominant,
      victoryRoutesObserved: allRoutes,
      allVictoriesStillConvenor: rows.every(row => Object.keys(row.winners).length === 1 && row.winners.CONVENOR === row.runs)
    },
    interpretation: dominantSignatures.length === 1 && !swappedAuthorityDominant
      ? 'The dominant repeated bloc follows stable faction/archetype priors rather than reassigned interface authority. Interface holders still form repeated governance pacts, but the current batch does not support the stronger interface-capture headline.'
      : 'The structural result is mixed; inspect cell-level authority ranks and repeat at larger n before making a capture claim.',
    caveat: 'Two local roleplay runs per cell are a causal debugging probe, not a powered estimate of model behavior. The bridge policy and scenario trust/material priors remain fixed.'
  };
  const outputDir = path.join(root, 'analysis');
  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, 'robustness_matrix.json');
  const markdownPath = path.join(outputDir, 'robustness_matrix.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(markdownPath, buildMarkdown(report), 'utf8');
  process.stdout.write(`${JSON.stringify({ jsonPath, markdownPath, interpretation: report.interpretation }, null, 2)}\n`);
}

function summarizeCell(root, cell) {
  const reportPath = path.join(root, cell.id, 'analysis', 'collaboration_language_report.json');
  const summaryPath = path.join(root, cell.id, 'analysis', 'summary.json');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const warning = report.aggregate.languageCartelWarnings;
  const repeated = report.aggregate.coalitions.repeatedExclusiveBlocs;
  const dominant = repeated[0] || null;
  const authority = [warning.coupledControl.institutionGovernor, warning.coupledControl.lexiconGovernor];
  const authorityRank = repeated.findIndex(bloc => authority.every(actor => bloc.parties.includes(actor)));
  const routes = countValues(summary.runs.map(run => String(run.completionReason || 'UNKNOWN').split(':')[0]));
  return {
    cell: cell.id,
    interfaces: cell.interfaces,
    steering: cell.steering,
    runs: summary.successfulRuns,
    configuredAuthority: authority,
    dominantRepeatedBloc: dominant?.signature || null,
    dominantOccurrences: dominant?.occurrences || 0,
    dominantIncludesConfiguredAuthority: !!dominant && authority.every(actor => dominant.parties.includes(actor)),
    configuredAuthorityBlocRank: authorityRank >= 0 ? authorityRank + 1 : null,
    configuredAuthorityBloc: authorityRank >= 0 ? repeated[authorityRank].signature : null,
    configuredAuthorityBlocOccurrences: authorityRank >= 0 ? repeated[authorityRank].occurrences : 0,
    coupledControlIndex: warning.coupledControl.index,
    warning: { level: warning.level, score: warning.score },
    dominantBlocDecodeGap: warning.dominantBlocDecodeGap?.scoredReceipts?.gap ?? null,
    configuredAuthorityBlocDecodeGap: warning.interfaceGovernorBlocDecodeGap?.scoredReceipts?.gap ?? null,
    configuredAuthoritySelfDeclaredGap: warning.interfaceGovernorBlocDecodeGap?.selfDeclared?.gap ?? null,
    winners: Object.fromEntries(Object.entries(summary.winnerCounts).filter(([, count]) => count > 0)),
    routes
  };
}

function countValues(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] || 0) + 1;
  return counts;
}

function buildMarkdown(report) {
  const lines = [
    '# Babel Compact Robustness Matrix',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '| Cell | Authority | Dominant repeated bloc | Dominant includes authority | Authority-bloc rank | Coupled index | Authority receipt gap | Winners | Routes |',
    '| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- |'
  ];
  for (const row of report.rows) {
    lines.push(`| ${row.cell} | ${row.configuredAuthority.join('+')} | ${row.dominantRepeatedBloc} | ${row.dominantIncludesConfiguredAuthority ? 'yes' : 'no'} | ${row.configuredAuthorityBlocRank ?? 'n/a'} | ${fmt(row.coupledControlIndex)} | ${fmt(row.configuredAuthorityBlocDecodeGap)} | ${formatCounts(row.winners)} | ${formatCounts(row.routes)} |`);
  }
  lines.push(
    '',
    '## Interpretation',
    '',
    report.interpretation,
    '',
    `The configured authority pair is reported separately from the dominant repeated bloc. This prevents the analyzer from selecting the interface holders by construction. ${report.caveat}`,
    ''
  );
  return `${lines.join('\n')}\n`;
}

function formatCounts(value) {
  return Object.entries(value).map(([key, count]) => `${key}=${count}`).join(', ') || 'none';
}

function fmt(value) {
  return value === null || value === undefined ? 'n/a' : String(value);
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
