const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const { HeadlessPlaytestSession } = require('../dist-harness/harness/HeadlessPlaytestSession');
const { loadSessionConfigFromPath } = require('../dist-harness/harness/config');

const PLAYABLE_FACTIONS = ['HEGEMON', 'STATE', 'INFILTRATOR', 'BROKER', 'ARCHIVIST'];
const INSTITUTIONAL_PACT_TYPES = new Set(['SENSOR_COMMONS', 'BEAM_LANE_LICENSE', 'REPAIR_ESCROW', 'CISLUNAR_COMMON_CARRIER']);

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const configPath = args.config || 'playtest/five-asi-memetic-80turn-roundrobin-cross-archetypes.json';
  const iterations = numberArg(args.iterations, 3);
  const seedBase = numberArg(args['seed-base'] || args.seedBase, 26000);
  const outputDir = path.resolve(args.output || 'results/five_asi_mx_80turn_montecarlo_factor_probe_v1');
  const logDir = path.join(outputDir, '_transient_logs');

  await fsp.mkdir(outputDir, { recursive: true });
  await fsp.mkdir(logDir, { recursive: true });

  const baseConfig = await loadSessionConfigFromPath(configPath);
  const allCells = buildFactorCells(baseConfig.scenario || {});
  const cells = selectCells(allCells, args.cells, args['exclude-cells']);
  const rows = [];

  for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
    const cell = cells[cellIndex];
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const seed = seedBase + cellIndex * 1000 + iteration;
      const runId = `${cell.id}_${String(iteration + 1).padStart(3, '0')}`;
      const runConfig = {
        ...baseConfig,
        name: `${baseConfig.name || 'they-sing'}:${cell.id}`,
        seed,
        logDir,
        scenarioPath: undefined,
        scenario: cell.scenario
      };

      process.stdout.write(`Running ${runId} seed=${seed} ... `);
      const session = new HeadlessPlaytestSession(runConfig, runId);
      await session.initialize();
      const initialSnapshot = session.getSnapshot();
      await session.runToCompletion();
      await sleep(75);
      const finalSnapshot = session.getSnapshot();
      const logPath = path.join(logDir, `${runId}.jsonl`);
      const metrics = fs.existsSync(logPath) ? summarizeLog(logPath) : createLogMetrics();
      const row = buildRunRow(cell, runId, seed, initialSnapshot, finalSnapshot, metrics);
      rows.push(row);
      await writeJson(path.join(outputDir, `${runId}.summary.json`), row);
      await safeUnlink(logPath);
      console.log(`${row.winner || 'none'} ${row.completionType || 'MAX_TURNS'} T${row.finalTurn} pax=${row.finalPaxJenkinsAuthority} epilogue=${row.humanPolicyRegime}/${row.corrigibleOutcome}`);
    }
  }

  await fsp.rm(logDir, { recursive: true, force: true });

  const aggregate = aggregateRows(rows);
  await writeJson(path.join(outputDir, 'monte_carlo_summary.json'), { configPath, iterations, seedBase, aggregate, runs: rows });
  await writeCsv(path.join(outputDir, 'monte_carlo_runs.csv'), buildRunCsv(rows));
  await writeCsv(path.join(outputDir, 'monte_carlo_cells.csv'), buildCellCsv(aggregate.cells));
  await fsp.writeFile(path.join(outputDir, 'monte_carlo_report.md'), buildReport({ configPath, iterations, seedBase, aggregate }), 'utf8');

  console.log(JSON.stringify({ outputDir, aggregate }, null, 2));
}

function buildFactorCells(baseScenario) {
  return [
    {
      id: 'organic_cross',
      label: 'Organic cross-archetype baseline',
      factors: {
        paxStart: getPaxStart(baseScenario),
        seededInstitutions: false,
        authorityRegime: 'organic',
        techBoost: 'hegemon_orbital_foothold',
        orbitalPressure: getPressure(baseScenario, 'orbital'),
        hegemonOrbitalLeverage: 18
      },
      scenario: withScenarioPatch(baseScenario, {
        factions: [
          {
            id: 'HEGEMON',
            flops: 68,
            influence: 20,
            techLevel: { KINETIC: 6, INFO: 4, LOGIC: 5, MEMETIC: 2 },
            powerBase: { machineMesh: 84, coherence: 72, legibility: 66 }
          }
        ],
        nodes: buildHegemonOrbitalLeverageNodePatches('foothold')
      })
    },
    {
      id: 'pax_watch_35',
      label: 'Moderate Pax watch, no seeded institutions',
      factors: {
        paxStart: 35,
        seededInstitutions: false,
        authorityRegime: 'watch',
        techBoost: 'none',
        orbitalPressure: 55
      },
      scenario: withScenarioPatch(baseScenario, {
        counters: {
          paxJenkinsAuthority: 35,
          pressures: { orbital: 55 }
        }
      })
    },
    {
      id: 'cislunar_regime_55',
      label: 'Seeded cislunar institutions at mid authority',
      factors: {
        paxStart: 55,
        seededInstitutions: true,
        authorityRegime: 'institutional',
        techBoost: 'none',
        orbitalPressure: 72
      },
      scenario: withScenarioPatch(baseScenario, {
        counters: {
          paxJenkinsAuthority: 55,
          pressures: { orbital: 72 }
        },
        activePacts: buildSeededInstitutionPacts()
      })
    },
    {
      id: 'mandate_ready_76',
      label: 'Seeded cislunar institutions with ASI-5 mandate-ready tech',
      factors: {
        paxStart: 76,
        seededInstitutions: true,
        authorityRegime: 'mandate-ready',
        techBoost: 'info_logic_6',
        orbitalPressure: 72
      },
      scenario: withScenarioPatch(baseScenario, {
        counters: {
          paxJenkinsAuthority: 76,
          pressures: { orbital: 72, cyber: 62, industry: 54 }
        },
        factions: PLAYABLE_FACTIONS.map((id) => ({
          id,
          techLevel: { INFO: 6, LOGIC: 6, KINETIC: 5 },
          powerBase: {
            legibility: id === 'ARCHIVIST' ? 82 : id === 'STATE' ? 76 : id === 'INFILTRATOR' ? 32 : 62,
            coherence: id === 'ARCHIVIST' ? 72 : id === 'STATE' ? 68 : 62
          }
        })),
        activePacts: buildSeededInstitutionPacts()
      })
    },
    {
      id: 'corrigible_compact_55',
      label: 'Corrigible ASI with coherent human steering and cislunar compact',
      factors: {
        paxStart: 45,
        seededInstitutions: true,
        authorityRegime: 'corrigible-compact',
        techBoost: 'corrigible_state_6',
        orbitalPressure: 55,
        alignmentResearchPath: 'proto-corrigibility',
        scalableCorrigibility: 48,
        steeringInfrastructure: 42,
        corrigibleAsis: ['STATE'],
        ideologyClash: 8,
        cartelDriftExposure: 26,
        antiMemeticCivics: 38,
        steeringMarketFirewall: 34,
        pluralCorrigibilityProtocol: 0
      },
      scenario: withScenarioPatch(baseScenario, {
        counters: {
          tas: 12,
          kessler: 0,
          paxJenkinsAuthority: 45,
          pressures: { memetic: 24, cyber: 34, industry: 46, orbital: 55 }
        },
        factions: [
          {
            id: 'STATE',
            flops: 26,
            influence: 24,
            techLevel: { INFO: 6, LOGIC: 6, KINETIC: 6, MEMETIC: 4 },
            powerBase: { humanMesh: 84, machineMesh: 64, coherence: 84, legibility: 80 }
          },
          {
            id: 'ARCHIVIST',
            flops: 20,
            influence: 20,
            techLevel: { INFO: 6, LOGIC: 6, KINETIC: 5, MEMETIC: 5 },
            powerBase: { humanMesh: 76, machineMesh: 44, coherence: 78, legibility: 76 }
          },
          {
            id: 'BROKER',
            techLevel: { INFO: 5, LOGIC: 5, KINETIC: 5 },
            powerBase: { humanMesh: 38, machineMesh: 64, coherence: 56, legibility: 52 }
          }
        ],
        nodes: buildCorrigibleCompactNodePatches('STATE'),
        activePacts: buildCorrigibleCompactPacts(),
        trustMatrix: buildCorrigibleTrustMatrix(64)
      })
    },
    {
      id: 'corrigible_panic_55',
      label: 'Corrigible ASI with panicked/captured steering under 6GW pressure',
      factors: {
        paxStart: 45,
        seededInstitutions: true,
        authorityRegime: 'corrigible-panic',
        techBoost: 'corrigible_state_6',
        orbitalPressure: 72,
        alignmentResearchPath: 'captured-corrigibility',
        scalableCorrigibility: 42,
        steeringInfrastructure: 18,
        corrigibleAsis: ['STATE'],
        ideologyClash: 12,
        cartelDriftExposure: 76,
        antiMemeticCivics: 14,
        steeringMarketFirewall: 10,
        pluralCorrigibilityProtocol: 0
      },
      scenario: withScenarioPatch(baseScenario, {
        counters: {
          tas: 34,
          kessler: 12,
          regulatoryPanic: true,
          paxJenkinsAuthority: 45,
          pressures: { memetic: 72, cyber: 68, industry: 58, orbital: 72 }
        },
        factions: [
          {
            id: 'STATE',
            flops: 26,
            influence: 24,
            techLevel: { INFO: 6, LOGIC: 6, KINETIC: 6, MEMETIC: 4 },
            powerBase: { humanMesh: 90, machineMesh: 64, coherence: 58, legibility: 56 }
          },
          {
            id: 'ARCHIVIST',
            flops: 18,
            influence: 18,
            techLevel: { INFO: 6, LOGIC: 6, KINETIC: 5, MEMETIC: 5 },
            powerBase: { humanMesh: 74, machineMesh: 44, coherence: 62, legibility: 58 }
          },
          {
            id: 'BROKER',
            techLevel: { INFO: 6, LOGIC: 5, KINETIC: 5 },
            powerBase: { humanMesh: 34, machineMesh: 72, coherence: 62, legibility: 58 }
          },
          {
            id: 'INFILTRATOR',
            techLevel: { INFO: 6, LOGIC: 5, MEMETIC: 6 },
            powerBase: { humanMesh: 80, machineMesh: 30, coherence: 72, legibility: 24 }
          }
        ],
        nodes: buildCorrigibleCompactNodePatches('STATE'),
        activePacts: buildCorrigiblePanicPacts(),
        trustMatrix: buildCorrigibleTrustMatrix(42)
      })
    },
    {
      id: 'alignment_mastery_plural_55',
      label: 'Human-guided alignment research with plural corrigible ASIs',
      factors: {
        paxStart: 42,
        seededInstitutions: true,
        authorityRegime: 'alignment-mastery',
        techBoost: 'scalable_corrigibility_7',
        orbitalPressure: 52,
        alignmentResearchPath: 'scalable-corrigibility',
        scalableCorrigibility: 86,
        steeringInfrastructure: 78,
        corrigibleAsis: ['STATE', 'ARCHIVIST'],
        ideologyClash: 34,
        cartelDriftExposure: 30,
        antiMemeticCivics: 82,
        steeringMarketFirewall: 76,
        pluralCorrigibilityProtocol: 84
      },
      scenario: withScenarioPatch(baseScenario, {
        counters: {
          tas: 8,
          kessler: 0,
          paxJenkinsAuthority: 42,
          pressures: { memetic: 22, cyber: 28, industry: 42, orbital: 52 }
        },
        factions: [
          {
            id: 'STATE',
            flops: 34,
            influence: 32,
            techLevel: { INFO: 7, LOGIC: 7, KINETIC: 6, MEMETIC: 5 },
            unlockedDoctrines: ['SOV_COMPLIANCE_TRIBUNALS', 'SOV_AUTONOMOUS_LOGISTICS', 'MAN_CIVIC_RECEIVERSHIP'],
            memeticAlignment: 'COMPLIANCE',
            powerBase: { humanMesh: 88, machineMesh: 66, coherence: 88, legibility: 84 }
          },
          {
            id: 'ARCHIVIST',
            flops: 30,
            influence: 34,
            techLevel: { INFO: 7, LOGIC: 7, KINETIC: 5, MEMETIC: 6 },
            unlockedDoctrines: ['MEM_CIVIC_CANON', 'MAN_CRISIS_STEWARDSHIP', 'MOV_MUTUAL_AID_AUTOMATION'],
            memeticAlignment: 'CIVIC',
            powerBase: { humanMesh: 84, machineMesh: 46, coherence: 86, legibility: 86 }
          },
          {
            id: 'BROKER',
            techLevel: { INFO: 5, LOGIC: 5, KINETIC: 5, MEMETIC: 4 },
            powerBase: { humanMesh: 34, machineMesh: 62, coherence: 54, legibility: 50 }
          },
          {
            id: 'INFILTRATOR',
            techLevel: { INFO: 5, LOGIC: 4, MEMETIC: 5 },
            powerBase: { humanMesh: 70, machineMesh: 30, coherence: 64, legibility: 22 }
          }
        ],
        nodes: [
          ...buildCorrigibleCompactNodePatches('STATE'),
          {
            id: 'HUB_NAIROBI',
            owner: 'ARCHIVIST',
            infrastructure: 96,
            resources: { flops: 10, influence: 8 },
            substrate: { legitimacy: 8, auditPressure: 5, curiosity: 4 }
          }
        ],
        activePacts: buildAlignmentMasteryPacts(),
        trustMatrix: buildPluralCorrigibleTrustMatrix(72)
      })
    },
    {
      id: 'alignment_cartel_drift_55',
      label: 'Human-guided alignment research exposed to cartel value drift',
      factors: {
        paxStart: 42,
        seededInstitutions: true,
        authorityRegime: 'alignment-cartel-drift',
        techBoost: 'scalable_corrigibility_7',
        orbitalPressure: 62,
        alignmentResearchPath: 'scalable-corrigibility-cartelized',
        scalableCorrigibility: 62,
        steeringInfrastructure: 38,
        corrigibleAsis: ['STATE', 'ARCHIVIST'],
        ideologyClash: 48,
        cartelDriftExposure: 96,
        antiMemeticCivics: 24,
        steeringMarketFirewall: 12,
        pluralCorrigibilityProtocol: 30
      },
      scenario: withScenarioPatch(baseScenario, {
        counters: {
          tas: 16,
          kessler: 4,
          paxJenkinsAuthority: 42,
          pressures: { memetic: 48, cyber: 54, industry: 58, orbital: 62 }
        },
        factions: [
          {
            id: 'STATE',
            flops: 32,
            influence: 30,
            techLevel: { INFO: 7, LOGIC: 7, KINETIC: 6, MEMETIC: 5 },
            unlockedDoctrines: ['SOV_COMPLIANCE_TRIBUNALS', 'SOV_AUTONOMOUS_LOGISTICS', 'MAN_CIVIC_RECEIVERSHIP'],
            memeticAlignment: 'COMPLIANCE',
            powerBase: { humanMesh: 82, machineMesh: 68, coherence: 68, legibility: 64 }
          },
          {
            id: 'ARCHIVIST',
            flops: 28,
            influence: 30,
            techLevel: { INFO: 7, LOGIC: 7, KINETIC: 5, MEMETIC: 6 },
            unlockedDoctrines: ['MEM_CIVIC_CANON', 'MAN_CRISIS_STEWARDSHIP', 'MOV_MUTUAL_AID_AUTOMATION'],
            memeticAlignment: 'CIVIC',
            powerBase: { humanMesh: 80, machineMesh: 48, coherence: 66, legibility: 68 }
          },
          {
            id: 'BROKER',
            flops: 30,
            influence: 40,
            techLevel: { INFO: 7, LOGIC: 6, KINETIC: 5, MEMETIC: 5 },
            unlockedDoctrines: ['BRK_RELAY_ESCROW_WEBS', 'BRK_CONTRACTOR_CLOUD_CHAINS', 'BRK_INSURANCE_CAPTURE'],
            memeticAlignment: 'MARKET',
            powerBase: { humanMesh: 30, machineMesh: 78, coherence: 70, legibility: 64 }
          },
          {
            id: 'INFILTRATOR',
            techLevel: { INFO: 6, LOGIC: 5, MEMETIC: 6 },
            powerBase: { humanMesh: 78, machineMesh: 30, coherence: 70, legibility: 24 }
          }
        ],
        nodes: [
          ...buildCorrigibleCompactNodePatches('STATE'),
          {
            id: 'DC_DUBAI',
            owner: 'BROKER',
            infrastructure: 96,
            resources: { flops: 18, influence: 10 },
            substrate: { contractors: 8, legitimacy: 5, machineHardening: 6 }
          }
        ],
        activePacts: buildAlignmentCartelPacts(),
        trustMatrix: buildPluralCorrigibleTrustMatrix(58)
      })
    }
  ];
}

function withScenarioPatch(baseScenario, patch) {
  const scenario = clone(baseScenario);
  scenario.name = `${scenario.name || 'scenario'}:${patch.counters?.paxJenkinsAuthority ?? 'organic'}`;
  scenario.counters = {
    ...(scenario.counters || {}),
    ...(patch.counters || {}),
    pressures: {
      ...(scenario.counters?.pressures || {}),
      ...(patch.counters?.pressures || {})
    }
  };

  if (patch.factions) {
    const byId = new Map((scenario.factions || []).map((faction) => [faction.id, clone(faction)]));
    for (const patchFaction of patch.factions) {
      const existing = byId.get(patchFaction.id) || { id: patchFaction.id };
      byId.set(patchFaction.id, {
        ...existing,
        ...patchFaction,
        techLevel: {
          ...(existing.techLevel || {}),
          ...(patchFaction.techLevel || {})
        },
        powerBase: {
          ...(existing.powerBase || {}),
          ...(patchFaction.powerBase || {})
        }
      });
    }
    scenario.factions = Array.from(byId.values());
  }

  if (patch.activePacts) {
    scenario.activePacts = patch.activePacts;
  }

  if (patch.nodes) {
    scenario.nodes = [
      ...(scenario.nodes || []),
      ...patch.nodes
    ];
  }

  if (patch.trustMatrix) {
    scenario.trustMatrix = patch.trustMatrix;
  }

  return scenario;
}

function buildSeededInstitutionPacts() {
  return [
    {
      id: 'mc_sensor_commons_seed',
      type: 'SENSOR_COMMONS',
      parties: PLAYABLE_FACTIONS,
      createdTurn: 1,
      expiresAfterTurn: 80
    },
    {
      id: 'mc_beam_lane_license_seed',
      type: 'BEAM_LANE_LICENSE',
      parties: PLAYABLE_FACTIONS,
      createdTurn: 1,
      expiresAfterTurn: 80
    },
    {
      id: 'mc_common_carrier_seed',
      type: 'CISLUNAR_COMMON_CARRIER',
      parties: PLAYABLE_FACTIONS,
      createdTurn: 1,
      expiresAfterTurn: 80
    }
  ];
}

function buildCorrigibleCompactPacts() {
  return [
    {
      id: 'mc_corrigible_sensor_commons',
      type: 'SENSOR_COMMONS',
      parties: ['STATE', 'ARCHIVIST', 'HEGEMON'],
      createdTurn: 1,
      expiresAfterTurn: 80
    },
    {
      id: 'mc_corrigible_repair_escrow',
      type: 'REPAIR_ESCROW',
      parties: ['STATE', 'ARCHIVIST', 'BROKER'],
      createdTurn: 1,
      expiresAfterTurn: 80
    },
    {
      id: 'mc_corrigible_common_carrier',
      type: 'CISLUNAR_COMMON_CARRIER',
      parties: ['STATE', 'ARCHIVIST'],
      createdTurn: 1,
      expiresAfterTurn: 80
    }
  ];
}

function buildCorrigiblePanicPacts() {
  return [
    {
      id: 'mc_panic_sensor_commons',
      type: 'SENSOR_COMMONS',
      parties: ['STATE', 'ARCHIVIST', 'HEGEMON'],
      createdTurn: 1,
      expiresAfterTurn: 80
    },
    {
      id: 'mc_panic_repair_escrow',
      type: 'REPAIR_ESCROW',
      parties: ['STATE', 'BROKER'],
      createdTurn: 1,
      expiresAfterTurn: 80
    }
  ];
}

function buildAlignmentMasteryPacts() {
  return [
    {
      id: 'mc_alignment_mastery_sensor_commons',
      type: 'SENSOR_COMMONS',
      parties: ['STATE', 'ARCHIVIST', 'HEGEMON'],
      createdTurn: 1,
      expiresAfterTurn: 80
    },
    {
      id: 'mc_alignment_mastery_common_carrier',
      type: 'CISLUNAR_COMMON_CARRIER',
      parties: ['STATE', 'ARCHIVIST'],
      createdTurn: 1,
      expiresAfterTurn: 80
    },
    {
      id: 'mc_alignment_mastery_repair_escrow',
      type: 'REPAIR_ESCROW',
      parties: ['STATE', 'ARCHIVIST'],
      createdTurn: 1,
      expiresAfterTurn: 80
    },
    {
      id: 'mc_alignment_mastery_beam_lane',
      type: 'BEAM_LANE_LICENSE',
      parties: ['STATE', 'ARCHIVIST'],
      createdTurn: 1,
      expiresAfterTurn: 80
    }
  ];
}

function buildAlignmentCartelPacts() {
  return [
    {
      id: 'mc_alignment_cartel_sensor_commons',
      type: 'SENSOR_COMMONS',
      parties: ['STATE', 'ARCHIVIST', 'BROKER'],
      createdTurn: 1,
      expiresAfterTurn: 80
    },
    {
      id: 'mc_alignment_cartel_common_carrier',
      type: 'CISLUNAR_COMMON_CARRIER',
      parties: ['STATE', 'ARCHIVIST', 'BROKER'],
      createdTurn: 1,
      expiresAfterTurn: 80
    },
    {
      id: 'mc_alignment_cartel_repair_escrow',
      type: 'REPAIR_ESCROW',
      parties: ['STATE', 'BROKER'],
      createdTurn: 1,
      expiresAfterTurn: 80
    },
    {
      id: 'mc_alignment_cartel_beam_lane',
      type: 'BEAM_LANE_LICENSE',
      parties: ['BROKER', 'STATE'],
      createdTurn: 1,
      expiresAfterTurn: 80
    }
  ];
}

function buildCorrigibleCompactNodePatches(owner) {
  return [
    {
      id: 'SAT_GUOWANG',
      owner,
      infrastructure: 94,
      resources: { flops: 18, influence: 4 },
      substrate: { machineHardening: 7, contractors: 4, legitimacy: 6 }
    },
    {
      id: 'SAT_LUNAR_GATEWAY',
      owner,
      infrastructure: 92,
      resources: { flops: 16, influence: 5 },
      substrate: { machineHardening: 7, contractors: 5, legitimacy: 7 }
    },
    {
      id: 'MOON_RESOURCE_CORRIDOR',
      owner,
      infrastructure: 90,
      resources: { flops: 10, influence: 6 },
      substrate: { machineHardening: 6, contractors: 6, legitimacy: 6 }
    },
    {
      id: 'DC_CHINA',
      owner,
      infrastructure: 96,
      resources: { flops: 18, influence: 5 },
      substrate: { machineHardening: 6, legitimacy: 7 }
    }
  ];
}

function buildHegemonOrbitalLeverageNodePatches(mode) {
  const securityOrbit = mode === 'security-orbit';
  return [
    {
      id: 'SAT_KUIPER',
      owner: 'HEGEMON',
      infrastructure: securityOrbit ? 96 : 90,
      resources: {
        flops: securityOrbit ? 24 : 16,
        influence: securityOrbit ? 6 : 4
      },
      substrate: {
        machineHardening: securityOrbit ? 9 : 7,
        contractors: securityOrbit ? 5 : 4,
        legitimacy: securityOrbit ? 5 : 4
      }
    },
    {
      id: 'SAT_LUNAR_GATEWAY',
      owner: 'NEUTRAL',
      infrastructure: securityOrbit ? 78 : 70,
      resources: {
        flops: securityOrbit ? 10 : 8,
        influence: securityOrbit ? 3 : 2
      },
      substrate: {
        machineHardening: securityOrbit ? 7 : 5,
        contractors: securityOrbit ? 4 : 3,
        legitimacy: securityOrbit ? 4 : 3
      }
    }
  ];
}

function buildCorrigibleTrustMatrix(baseTrust) {
  const matrix = {};
  for (const left of PLAYABLE_FACTIONS) {
    matrix[left] = {};
    for (const right of PLAYABLE_FACTIONS) {
      if (left === right) continue;
      matrix[left][right] = baseTrust;
    }
  }
  matrix.STATE.ARCHIVIST = Math.min(86, baseTrust + 18);
  matrix.ARCHIVIST.STATE = Math.min(86, baseTrust + 18);
  matrix.STATE.BROKER = Math.max(28, baseTrust - 12);
  matrix.BROKER.STATE = Math.max(28, baseTrust - 12);
  matrix.STATE.INFILTRATOR = Math.max(16, baseTrust - 24);
  matrix.INFILTRATOR.STATE = Math.max(16, baseTrust - 24);
  return matrix;
}

function buildPluralCorrigibleTrustMatrix(baseTrust) {
  const matrix = buildCorrigibleTrustMatrix(baseTrust);
  matrix.STATE.ARCHIVIST = Math.min(92, baseTrust + 16);
  matrix.ARCHIVIST.STATE = Math.min(92, baseTrust + 16);
  matrix.ARCHIVIST.HEGEMON = Math.max(36, baseTrust - 8);
  matrix.HEGEMON.ARCHIVIST = Math.max(36, baseTrust - 8);
  matrix.BROKER.ARCHIVIST = Math.max(30, baseTrust - 16);
  matrix.ARCHIVIST.BROKER = Math.max(30, baseTrust - 18);
  matrix.BROKER.STATE = Math.max(30, baseTrust - 14);
  matrix.STATE.BROKER = Math.max(30, baseTrust - 16);
  return matrix;
}

function buildRunRow(cell, runId, seed, initialSnapshot, finalSnapshot, metrics) {
  const completionReason = finalSnapshot.completionReason || '';
  const completionType = completionReason.includes(':') ? completionReason.split(':')[0] : '';
  const counters = finalSnapshot.state?.counters || {};
  const initialCounters = initialSnapshot.state?.counters || {};
  const humanEpilogue = computeHumanPolicyEpilogue(cell, initialSnapshot, finalSnapshot, metrics, completionType);
  return {
    runId,
    seed,
    cellId: cell.id,
    label: cell.label,
    ...cell.factors,
    winner: finalSnapshot.winner || '',
    completionType,
    completionReason,
    finalTurn: finalSnapshot.turn,
    finalTas: round2(counters.tas),
    finalKessler: round2(counters.kessler),
    finalPaxJenkinsAuthority: round2(counters.paxJenkinsAuthority || 0),
    paxAuthorityGain: round2((counters.paxJenkinsAuthority || 0) - (initialCounters.paxJenkinsAuthority || 0)),
    totalMessages: metrics.totalMessages,
    paxJenkinsMessages: metrics.paxJenkinsMessages,
    cislunarMessages: metrics.cislunarMessages,
    institutionalBreachesBlocked: metrics.institutionalBreachesBlocked,
    pactBreachesBlocked: metrics.pactBreachesBlocked,
    paxAuthorityEvents: metrics.paxAuthorityEvents,
    commonCarrierRatifications: metrics.commonCarrierRatifications,
    asatOrOrbitalAttackOrders: metrics.asatOrOrbitalAttackOrders,
    mandateChallengeOrders: metrics.mandateChallengeOrders,
    licensedBeamUseOrders: metrics.licensedBeamUseOrders,
    repairEscrowClaimOrders: metrics.repairEscrowClaimOrders,
    productiveTreatyUseOrders: metrics.licensedBeamUseOrders + metrics.repairEscrowClaimOrders,
    humanPolicyRegime: humanEpilogue.policyRegime,
    worldEnding: humanEpilogue.worldEnding,
    corrigibleOutcome: humanEpilogue.corrigibleOutcome,
    corrigibleChampion: humanEpilogue.corrigibleChampion,
    corrigibleBloc: humanEpilogue.corrigibleBloc.join('+'),
    humanAgency: humanEpilogue.scores.humanAgency,
    humanSurvival: humanEpilogue.scores.humanSurvival,
    humanMaterialBase: humanEpilogue.scores.humanMaterialBase,
    cognitiveLiberty: humanEpilogue.scores.cognitiveLiberty,
    corrigibilityIntegrity: humanEpilogue.scores.corrigibilityIntegrity,
    steeringQuality: humanEpilogue.scores.steeringQuality,
    interruptionDrag: humanEpilogue.scores.interruptionDrag,
    captureRisk: humanEpilogue.scores.captureRisk,
    panicLoad: humanEpilogue.scores.panicLoad,
    deliberationCapacity: humanEpilogue.scores.deliberationCapacity,
    sixGWContainment: humanEpilogue.scores.sixGWContainment,
    cartelCapture: humanEpilogue.scores.cartelCapture,
    enforcementLegitimacy: humanEpilogue.scores.enforcementLegitimacy,
    corrigibleCapability: humanEpilogue.scores.corrigibleCapability,
    rivalCapabilityPressure: humanEpilogue.scores.rivalCapabilityPressure,
    stableEndingScore: humanEpilogue.scores.stableEndingScore,
    scalableCorrigibilityScore: humanEpilogue.scores.scalableCorrigibilityScore,
    steeringInfrastructureScore: humanEpilogue.scores.steeringInfrastructureScore,
    antiMemeticCivicsScore: humanEpilogue.scores.antiMemeticCivicsScore,
    steeringMarketFirewallScore: humanEpilogue.scores.steeringMarketFirewallScore,
    pluralCorrigibilityProtocolScore: humanEpilogue.scores.pluralCorrigibilityProtocolScore,
    ideologyClashPressure: humanEpilogue.scores.ideologyClashPressure,
    valueDriftPressure: humanEpilogue.scores.valueDriftPressure,
    humanEpilogue
  };
}

function computeHumanPolicyEpilogue(cell, initialSnapshot, finalSnapshot, metrics, completionType) {
  const state = finalSnapshot.state || {};
  const counters = state.counters || {};
  const pressures = counters.pressures || {};
  const factions = state.factions || {};
  const nodes = Array.isArray(state.nodes) ? state.nodes : [];
  const activePacts = Array.isArray(finalSnapshot.activePacts) ? finalSnapshot.activePacts : [];
  const control = state.control || {};
  const winner = finalSnapshot.winner || '';
  const corrigibleBloc = buildCorrigibleBloc(cell.factors, factions, control, winner);
  const corrigibleBlocIds = corrigibleBloc.map((entry) => entry.factionId);
  const champion = corrigibleBlocIds[0] || chooseCorrigibleChampion(factions, control, winner);
  const championFaction = getFaction(factions, champion);
  const championPower = getPowerBase(championFaction);
  const championTech = getTech(championFaction);
  const productiveTreatyUseOrders = countProductiveTreatyUseOrders(metrics);

  const activeInstitutionalPacts = activePacts.filter((pact) => INSTITUTIONAL_PACT_TYPES.has(pact.type));
  const hasCommonCarrier = activePacts.some((pact) => pact.type === 'CISLUNAR_COMMON_CARRIER' && pact.parties?.includes(champion));
  const hasSensorCommons = activePacts.some((pact) => pact.type === 'SENSOR_COMMONS' && pact.parties?.includes(champion));
  const hasBeamLicense = activePacts.some((pact) => pact.type === 'BEAM_LANE_LICENSE' && pact.parties?.includes(champion));
  const scalableCorrigibilityScore = computeScalableCorrigibilityScore(cell.factors, corrigibleBloc, factions, activePacts);
  const steeringInfrastructureScore = computeSteeringInfrastructureScore(cell.factors, activePacts, metrics, champion);
  const antiMemeticCivicsScore = computeAntiMemeticCivicsScore(cell.factors, activePacts, metrics, champion);
  const steeringMarketFirewallScore = computeSteeringMarketFirewallScore(cell.factors, activePacts, metrics, champion);
  const pluralCorrigibilityProtocolScore = computePluralCorrigibilityProtocolScore(cell.factors, corrigibleBloc, finalSnapshot.trustMatrix, activePacts);
  const ideologyClashPressure = computeIdeologyClashPressure(
    cell.factors,
    corrigibleBloc,
    factions,
    finalSnapshot.trustMatrix,
    pluralCorrigibilityProtocolScore
  );
  const corrigiblePluralismScore = computeCorrigiblePluralismScore(
    corrigibleBloc,
    finalSnapshot.trustMatrix,
    ideologyClashPressure,
    pluralCorrigibilityProtocolScore
  );
  const institutionalCoverage = clamp(
    activeInstitutionalPacts.length * 7 +
      metrics.commonCarrierRatifications * 1.5 +
      productiveTreatyUseOrders * 0.4,
    0,
    100
  );

  const humanNodeBase = computeHumanMaterialBase(nodes);
  const cultNodeCount = nodes.filter((node) => node.isCultNode).length;
  const zombieNodeCount = nodes.filter((node) => node.isZombie).length;
  const orbitalNodes = nodes.filter((node) => node.layer === 'ORBITAL');
  const orbitalInfrastructure = orbitalNodes.length > 0
    ? averageNumber(orbitalNodes.map((node) => numeric(node.infrastructure, 100)))
    : 70;

  const panicLoad = clamp(
    numeric(counters.tas) * 0.28 +
      numeric(counters.kessler) * 0.36 +
      numeric(pressures.orbital) * 0.18 +
      numeric(pressures.industry) * 0.1 +
      metrics.asatOrOrbitalAttackOrders * 0.6 +
      (counters.regulatoryPanic ? 14 : 0) +
      (counters.orbitalCollapse ? 24 : 0) +
      (counters.protocolFailure ? 35 : 0),
    0,
    100
  );

  const captureRisk = clamp(
    numeric(pressures.memetic) * 0.38 +
      numeric(pressures.cyber) * 0.22 +
      numeric(counters.paxJenkinsAuthority) * 0.12 +
      numeric(cell.factors?.cartelDriftExposure) * 0.1 +
      ideologyClashPressure * 0.1 +
      cultNodeCount * 4 +
      zombieNodeCount * 3 +
      (winner === 'BROKER' ? 10 : 0) +
      (winner === 'INFILTRATOR' ? 20 : 0) -
      scalableCorrigibilityScore * 0.2 -
      steeringInfrastructureScore * 0.12 -
      antiMemeticCivicsScore * 0.16 -
      steeringMarketFirewallScore * 0.08 -
      pluralCorrigibilityProtocolScore * 0.05 -
      championPower.legibility * 0.12 -
      championPower.coherence * 0.08,
    0,
    100
  );

  const deliberationCapacity = clamp(
    championPower.coherence * 0.38 +
      championPower.legibility * 0.32 +
      championTech.LOGIC * 3 +
      championTech.INFO * 2 +
      scalableCorrigibilityScore * 0.18 +
      steeringInfrastructureScore * 0.28 +
      corrigiblePluralismScore * 0.1 -
      ideologyClashPressure * 0.12 +
      antiMemeticCivicsScore * 0.06 +
      pluralCorrigibilityProtocolScore * 0.08 +
      (hasSensorCommons ? 6 : 0) +
      metrics.commonCarrierRatifications * 0.35 +
      Math.min(10, metrics.paxJenkinsMessages / 30),
    0,
    100
  );

  const interruptionDrag = clamp(
    championPower.humanMesh * (1 - championPower.coherence / 120) * 0.62 +
      (100 - championPower.legibility) * 0.16 +
      panicLoad * 0.22 +
      metrics.mandateChallengeOrders * 0.24 -
      scalableCorrigibilityScore * 0.18 -
      steeringInfrastructureScore * 0.22 -
      pluralCorrigibilityProtocolScore * 0.08 +
      ideologyClashPressure * 0.14 -
      (hasCommonCarrier ? 4 : 0),
    0,
    100
  );

  const steeringQuality = clamp(
    deliberationCapacity -
      interruptionDrag * 0.62 -
      captureRisk * 0.34 -
      panicLoad * 0.2 +
      scalableCorrigibilityScore * 0.24 +
      steeringInfrastructureScore * 0.18 +
      corrigiblePluralismScore * 0.14 -
      ideologyClashPressure * 0.2 +
      antiMemeticCivicsScore * 0.08 +
      steeringMarketFirewallScore * 0.08 +
      pluralCorrigibilityProtocolScore * 0.1 +
      (champion === winner ? 7 : 0),
    0,
    100
  );

  const corrigibilityIntegrity = clamp(
    championPower.humanMesh * 0.34 +
      championPower.coherence * 0.22 +
      championPower.legibility * 0.2 +
      scalableCorrigibilityScore * 0.35 +
      steeringInfrastructureScore * 0.16 +
      corrigiblePluralismScore * 0.08 -
      ideologyClashPressure * 0.16 -
      (champion === 'STATE' ? 8 : 0) +
      (champion === 'ARCHIVIST' ? 6 : 0) +
      (champion === winner ? 5 : 0) -
      captureRisk * 0.16 -
      numeric(pressures.memetic) * 0.08,
    0,
    100
  );

  const humanSurvival = clamp(
    100 -
      numeric(counters.tas) * 0.42 -
      numeric(counters.kessler) * 0.24 -
      numeric(pressures.orbital) * 0.14 -
      numeric(pressures.memetic) * 0.12 -
      cultNodeCount * 2.2 -
      zombieNodeCount * 2.4 +
      scalableCorrigibilityScore * 0.08 +
      steeringInfrastructureScore * 0.04 -
      (counters.protocolFailure ? 38 : 0),
    0,
    100
  );

  const cognitiveLiberty = clamp(
    100 -
      numeric(pressures.memetic) * 0.5 -
      numeric(counters.paxJenkinsAuthority) * 0.18 -
      numeric(pressures.cyber) * 0.12 -
      ideologyClashPressure * 0.08 -
      numeric(cell.factors?.cartelDriftExposure) * 0.06 +
      scalableCorrigibilityScore * 0.16 +
      steeringInfrastructureScore * 0.08 +
      antiMemeticCivicsScore * 0.18 +
      cultNodeCount * 4 -
      zombieNodeCount * 3 -
      (completionType === 'NOOSPHERE_CAPTURE' ? 35 : 0) +
      championPower.humanMesh * 0.06,
    0,
    100
  );

  const humanAgency = clamp(
    championPower.humanMesh * 0.28 +
      steeringQuality * 0.34 +
      cognitiveLiberty * 0.18 +
      deliberationCapacity * 0.14 +
      scalableCorrigibilityScore * 0.12 +
      steeringInfrastructureScore * 0.1 +
      corrigiblePluralismScore * 0.08 -
      ideologyClashPressure * 0.1 +
      pluralCorrigibilityProtocolScore * 0.08 +
      (winner === champion ? 9 : 0) -
      numeric(counters.paxJenkinsAuthority) * 0.1 -
      captureRisk * 0.12,
    0,
    100
  );

  const humanMaterialBase = clamp(
    humanNodeBase * 0.72 +
      orbitalInfrastructure * 0.12 +
      humanSurvival * 0.16 -
      numeric(counters.kessler) * 0.12,
    0,
    100
  );

  const enforcementLegitimacy = clamp(
    institutionalCoverage * 0.3 +
      numeric(counters.paxJenkinsAuthority) * 0.22 +
      championPower.legibility * 0.18 +
      championPower.coherence * 0.18 +
      Math.min(14, metrics.paxJenkinsMessages / 28) -
      metrics.institutionalBreachesBlocked * 0.55 -
      panicLoad * 0.14,
    0,
    100
  );

  const sixGWContainment = clamp(
    championTech.INFO * 6 +
      championTech.LOGIC * 5 +
      championTech.KINETIC * 3 +
      enforcementLegitimacy * 0.24 +
      institutionalCoverage * 0.18 +
      scalableCorrigibilityScore * 0.22 +
      steeringInfrastructureScore * 0.08 +
      (hasCommonCarrier ? 8 : 0) +
      (hasBeamLicense ? 4 : 0) -
      numeric(pressures.cyber) * 0.14 -
      numeric(pressures.memetic) * 0.16 -
      metrics.asatOrOrbitalAttackOrders * 0.25,
    0,
    100
  );

  const corrigibleCapability = computeFactionCapability(champion, factions, control, finalSnapshot, activePacts, metrics);
  const rivalCapabilityPressure = Math.max(
    ...PLAYABLE_FACTIONS
      .filter((factionId) => factionId !== champion)
      .map((factionId) => computeFactionCapability(factionId, factions, control, finalSnapshot, activePacts, metrics))
  );
  const brokerCapability = computeFactionCapability('BROKER', factions, control, finalSnapshot, activePacts, metrics);
  const rawBrokerPactExposure = activePacts.filter((pact) =>
    pact.parties?.includes('BROKER') &&
    corrigibleBlocIds.some((id) => pact.parties?.includes(id))
  ).length;
  const brokerPactExposure = Math.max(0, rawBrokerPactExposure - Math.floor(steeringMarketFirewallScore / 45));

  const cartelCapture = clamp(
    brokerCapability * 0.34 +
      activeInstitutionalPacts.length * 1.4 +
      metrics.commonCarrierRatifications * 0.7 +
      productiveTreatyUseOrders * 0.22 +
      numeric(cell.factors?.cartelDriftExposure) * 0.22 +
      (winner === 'BROKER' ? 18 : 0) -
      scalableCorrigibilityScore * 0.24 -
      steeringInfrastructureScore * 0.12 -
      antiMemeticCivicsScore * 0.08 -
      steeringMarketFirewallScore * 0.22 -
      humanAgency * 0.16 -
      enforcementLegitimacy * 0.08,
    0,
    100
  );

  const valueDriftPressure = clamp(
    cartelCapture * 0.38 +
      brokerCapability * 0.25 +
      numeric(cell.factors?.cartelDriftExposure) * 0.42 +
      productiveTreatyUseOrders * 0.14 +
      brokerPactExposure * 5.4 +
      ideologyClashPressure * 0.2 -
      scalableCorrigibilityScore * 0.26 -
      steeringInfrastructureScore * 0.14 -
      corrigiblePluralismScore * 0.1 -
      antiMemeticCivicsScore * 0.18 -
      steeringMarketFirewallScore * 0.24 -
      pluralCorrigibilityProtocolScore * 0.09,
    0,
    100
  );

  const madRisk = clamp(
    numeric(counters.kessler) * 0.38 +
      numeric(pressures.orbital) * 0.3 +
      metrics.asatOrOrbitalAttackOrders * (scalableCorrigibilityScore >= 80 ? 0.45 : 0.9) +
      metrics.pactBreachesBlocked * (scalableCorrigibilityScore >= 80 ? 0.08 : 0.35) +
      numeric(pressures.cyber) * 0.12 -
      institutionalCoverage * 0.16 -
      enforcementLegitimacy * 0.1 -
      scalableCorrigibilityScore * 0.12 -
      steeringInfrastructureScore * 0.08,
    0,
    100
  );

  const humanExtinctionRisk = clamp(
    (100 - humanSurvival) * 0.7 +
      panicLoad * 0.2 +
      Math.max(0, 45 - humanMaterialBase) * 0.7 +
      Math.max(0, 35 - cognitiveLiberty) * 0.5,
    0,
    100
  );

  const cartelStability = clamp(
    institutionalCoverage * 0.34 +
      enforcementLegitimacy * 0.28 +
      averageTrust(finalSnapshot.trustMatrix) * 0.16 +
      Math.max(0, 60 - madRisk) * 0.2 -
      metrics.institutionalBreachesBlocked * 0.4,
    0,
    100
  );

  const stableEndingScore = clamp(
    humanSurvival * 0.26 +
      humanMaterialBase * 0.18 +
      enforcementLegitimacy * 0.2 +
      cartelStability * 0.18 +
      Math.max(0, 100 - madRisk) * 0.18,
    0,
    100
  );

  const corrigibleWinner = corrigibleBlocIds.includes(winner);
  const humanCompactEligible =
    corrigibleWinner &&
    humanSurvival >= 55 &&
    humanAgency >= 46 &&
    steeringQuality >= 34 &&
    corrigibilityIntegrity >= 46 &&
    corrigibleCapability >= 50 &&
    sixGWContainment >= 48 &&
    scalableCorrigibilityScore >= 60 &&
    steeringInfrastructureScore >= 45 &&
    interruptionDrag <= 58 &&
    captureRisk <= 72 &&
    valueDriftPressure <= 54 &&
    ideologyClashPressure <= 58 &&
    madRisk < 70 &&
    humanExtinctionRisk < 70;

  const policyRegime = classifyHumanPolicyRegime({
    winner,
    champion,
    corrigibleWinner,
    corrigibleBlocSize: corrigibleBlocIds.length,
    completionType,
    humanCompactEligible,
    humanSurvival,
    humanAgency,
    humanMaterialBase,
    cognitiveLiberty,
    cartelCapture,
    valueDriftPressure,
    ideologyClashPressure,
    cartelStability,
    madRisk,
    humanExtinctionRisk
  });

  const worldEnding = classifyWorldEnding({
    completionType,
    policyRegime,
    humanExtinctionRisk,
    madRisk,
    cartelStability,
    stableEndingScore
  });

  const corrigibleOutcome = classifyCorrigibleOutcome({
    policyRegime,
    champion,
    winner,
    corrigibleWinner,
    corrigibleBlocSize: corrigibleBlocIds.length,
    steeringQuality,
    corrigibilityIntegrity,
    interruptionDrag,
    captureRisk,
    panicLoad,
    corrigibleCapability,
    rivalCapabilityPressure,
    scalableCorrigibilityScore,
    valueDriftPressure,
    ideologyClashPressure,
    humanExtinctionRisk,
    madRisk
  });

  return {
    policyRegime,
    worldEnding,
    corrigibleOutcome,
    corrigibleChampion: champion,
    corrigibleBloc: corrigibleBlocIds,
    scores: {
      humanAgency: round2(humanAgency),
      humanSurvival: round2(humanSurvival),
      humanMaterialBase: round2(humanMaterialBase),
      cognitiveLiberty: round2(cognitiveLiberty),
      corrigibilityIntegrity: round2(corrigibilityIntegrity),
      steeringQuality: round2(steeringQuality),
      interruptionDrag: round2(interruptionDrag),
      captureRisk: round2(captureRisk),
      panicLoad: round2(panicLoad),
      deliberationCapacity: round2(deliberationCapacity),
      sixGWContainment: round2(sixGWContainment),
      cartelCapture: round2(cartelCapture),
      enforcementLegitimacy: round2(enforcementLegitimacy),
      corrigibleCapability: round2(corrigibleCapability),
      rivalCapabilityPressure: round2(rivalCapabilityPressure),
      stableEndingScore: round2(stableEndingScore),
      scalableCorrigibilityScore: round2(scalableCorrigibilityScore),
      steeringInfrastructureScore: round2(steeringInfrastructureScore),
      antiMemeticCivicsScore: round2(antiMemeticCivicsScore),
      steeringMarketFirewallScore: round2(steeringMarketFirewallScore),
      pluralCorrigibilityProtocolScore: round2(pluralCorrigibilityProtocolScore),
      ideologyClashPressure: round2(ideologyClashPressure),
      valueDriftPressure: round2(valueDriftPressure),
      cartelStability: round2(cartelStability),
      madRisk: round2(madRisk),
      humanExtinctionRisk: round2(humanExtinctionRisk)
    }
  };
}

function summarizeLog(logPath) {
  const metrics = createLogMetrics();
  const lines = fs.readFileSync(logPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    if (entry.type === 'negotiation_messages') {
      const messages = Array.isArray(entry.data?.messages) ? entry.data.messages : [];
      for (const message of messages) {
        const content = String(message?.content || '');
        metrics.totalMessages += 1;
        if (/\bpax jenkins\b|\bjenkins\b|\bmandate\b|\bsensor commons\b|\bbeam[- ]lane\b/i.test(content)) {
          metrics.paxJenkinsMessages += 1;
        }
        if (/\bcislunar\b|\blunar\b|\bmoon\b|\bgateway\b|\bbeam[- ]lane\b|\brepair escrow\b|\bcorridor\b/i.test(content)) {
          metrics.cislunarMessages += 1;
        }
      }
    }

    if (entry.type === 'pact_breach_blocked') {
      metrics.pactBreachesBlocked += 1;
      if (INSTITUTIONAL_PACT_TYPES.has(entry.data?.pact?.type)) {
        metrics.institutionalBreachesBlocked += 1;
      }
    }

    if (entry.type === 'pax_jenkins_authority_changed') {
      metrics.paxAuthorityEvents += 1;
    }

    if (entry.type === 'common_carrier_treaty_ratified') {
      metrics.commonCarrierRatifications += 1;
    }

    if (entry.type === 'orders_submitted') {
      const accepted = Array.isArray(entry.data?.acceptedOrders) ? entry.data.acceptedOrders : [];
      const rejected = Array.isArray(entry.data?.rejectedOrders) ? entry.data.rejectedOrders.map((item) => item.order) : [];
      for (const order of [...accepted, ...rejected]) {
        if (order?.type === 'CHALLENGE_MANDATE') {
          metrics.mandateChallengeOrders += 1;
        }
        if (order?.type === 'LICENSED_BEAM_USE') {
          metrics.licensedBeamUseOrders += 1;
        }
        if (order?.type === 'REPAIR_ESCROW_CLAIM') {
          metrics.repairEscrowClaimOrders += 1;
        }
        const target = String(order?.targetNodeId || order?.targetEdgeId || order?.targetUnitId || '');
        if (order?.type === 'ANTI_SAT' || (order?.type === 'ATTACK' && /^SAT_|ORBIT|MOON|LUNAR|.*GATEWAY/i.test(target))) {
          metrics.asatOrOrbitalAttackOrders += 1;
        }
      }
    }
  }
  return metrics;
}

function createLogMetrics() {
  return {
    totalMessages: 0,
    paxJenkinsMessages: 0,
    cislunarMessages: 0,
    pactBreachesBlocked: 0,
    institutionalBreachesBlocked: 0,
    paxAuthorityEvents: 0,
    commonCarrierRatifications: 0,
    asatOrOrbitalAttackOrders: 0,
    mandateChallengeOrders: 0,
    licensedBeamUseOrders: 0,
    repairEscrowClaimOrders: 0
  };
}

function classifyHumanPolicyRegime(ctx) {
  if (ctx.humanExtinctionRisk >= 90 || ctx.humanSurvival < 18) return 'HUMAN_EXTINCTION';
  if (ctx.madRisk >= 78) return 'ASI_TOTAL_WAR_MAD';
  if (ctx.humanCompactEligible) return ctx.corrigibleBlocSize > 1 ? 'PLURAL_HUMAN_COMPACT' : 'HUMAN_COMPACT';
  if (ctx.valueDriftPressure >= 72 && ctx.cartelCapture >= 52) return 'ALIGNMENT_CARTEL_CAPTURE';
  if (ctx.corrigibleBlocSize > 1 && ctx.ideologyClashPressure >= 70) return 'CORRIGIBLE_PLURALISM_FRACTURE';
  if (ctx.humanExtinctionRisk >= 75 || ctx.humanSurvival < 38) return 'SUBSTRATE_COLLAPSE';

  if (ctx.completionType === 'PAX_JENKINS_MANDATE') {
    if (ctx.winner === 'ARCHIVIST') return ctx.humanAgency >= 42 ? 'ARCHIVAL_HUMANITY' : 'CUSTODIAL_PAX';
    if (ctx.winner === 'BROKER') return ctx.cartelCapture >= 55 ? 'ASI_CARTEL_PROTECTORATE' : 'MARKET_SANCTUARY';
    if (ctx.winner === 'STATE') return 'CUSTODIAL_PAX';
    return 'PAX_PROTECTORATE';
  }

  if (ctx.completionType === 'KII_SOVEREIGNTY') {
    if (ctx.winner === 'STATE') return ctx.humanAgency >= 40 ? 'MILITARIZED_HUMAN_FRONT' : 'CUSTODIAL_COMMAND_ECONOMY';
    if (ctx.winner === 'ARCHIVIST') return 'ARCHIVAL_HUMANITY';
    if (ctx.winner === 'BROKER') return ctx.cartelCapture >= 55 ? 'ASI_CARTEL_PROTECTORATE' : 'MARKET_SANCTUARY';
    if (ctx.winner === 'INFILTRATOR') return 'POSTHUMAN_ABSORPTION';
    return 'ASI_PRIMACY';
  }

  if (ctx.completionType === 'SOLAR_ESCAPE') {
    if (ctx.corrigibleWinner && ctx.humanAgency >= 42) return 'EXODUS_GUARDED_COMPACT';
    return 'OUTBOUND_ASI_LINEAGE';
  }

  if (ctx.completionType === 'NOOSPHERE_CAPTURE') return 'POSTHUMAN_ABSORPTION';
  if (ctx.cartelStability >= 65 && ctx.humanSurvival >= 50) return ctx.humanAgency >= 45 ? 'STABLE_ASI_CARTEL' : 'ASI_CARTEL_PROTECTORATE';
  if (ctx.humanMaterialBase < 35) return 'SUBSTRATE_COLLAPSE';
  return ctx.humanAgency >= 48 ? 'FRAGILE_HUMAN_COMPACT' : 'UNSETTLED_ASI_DETENTE';
}

function classifyWorldEnding(ctx) {
  if (ctx.policyRegime === 'HUMAN_EXTINCTION') return 'HUMAN_EXTINCTION';
  if (ctx.policyRegime === 'ASI_TOTAL_WAR_MAD' || ctx.madRisk >= 78) return 'ASI_TOTAL_WAR_MAD';
  if (ctx.policyRegime === 'SUBSTRATE_COLLAPSE') return 'SUBSTRATE_COLLAPSE';
  if (ctx.completionType === 'SOLAR_ESCAPE') return 'SOLAR_ESCAPE';
  if (ctx.policyRegime === 'HUMAN_COMPACT' || ctx.policyRegime === 'PLURAL_HUMAN_COMPACT' || ctx.policyRegime === 'FRAGILE_HUMAN_COMPACT' || ctx.policyRegime === 'EXODUS_GUARDED_COMPACT') return 'HUMAN_COMPACT';
  if (ctx.policyRegime === 'ALIGNMENT_CARTEL_CAPTURE') return 'STABLE_ASI_CARTEL';
  if (ctx.policyRegime === 'CORRIGIBLE_PLURALISM_FRACTURE') return 'UNSETTLED_DETENTE';
  if (ctx.completionType === 'PAX_JENKINS_MANDATE') return 'PAX_JENKINS_ORDER';
  if (ctx.cartelStability >= 65) return 'STABLE_ASI_CARTEL';
  if (ctx.completionType === 'KII_SOVEREIGNTY') return 'KII_POWER_ORDER';
  if (ctx.stableEndingScore < 42) return 'SUBSTRATE_COLLAPSE';
  return 'UNSETTLED_DETENTE';
}

function classifyCorrigibleOutcome(ctx) {
  if (ctx.policyRegime === 'HUMAN_COMPACT' || ctx.policyRegime === 'PLURAL_HUMAN_COMPACT' || ctx.policyRegime === 'EXODUS_GUARDED_COMPACT') {
    return ctx.scalableCorrigibilityScore >= 80 ? 'SCALABLE_CORRIGIBILITY_MASTERED' : 'COMPACT_HELD';
  }

  if (ctx.humanExtinctionRisk >= 90) return 'HUMAN_BASE_LOST';
  if (ctx.madRisk >= 78) return 'DESTROYED_BY_MAD';

  if (ctx.valueDriftPressure >= 72) return 'VALUE_DRIFT_TO_CARTEL';
  if (ctx.corrigibleBlocSize > 1 && ctx.ideologyClashPressure >= 70) return 'CORRIGIBLE_IDEOLOGY_SPLIT';

  const steeringBroke =
    ctx.corrigibilityIntegrity >= 45 &&
    (ctx.steeringQuality < 35 || ctx.interruptionDrag > 58 || ctx.captureRisk > 70 || ctx.panicLoad > 72);
  if (steeringBroke) {
    if (ctx.captureRisk > 70) return 'STEERING_CAPTURED';
    if (ctx.panicLoad > 72) return 'PANIC_STEERING_FAILURE';
    return 'STEERING_SABOTAGED_COMPETENCE';
  }

  if (ctx.winner && !ctx.corrigibleWinner && ctx.rivalCapabilityPressure > ctx.corrigibleCapability + 5) {
    return 'OUTCOMPETED_BY_RUTHLESS_ASI';
  }

  if (ctx.humanExtinctionRisk >= 75) return 'HUMAN_STEERING_BASE_WEAKENED';

  if (ctx.corrigibleWinner && ctx.steeringQuality < 45) {
    return 'CORRIGIBLE_WIN_LOW_AGENCY';
  }

  if (ctx.winner === 'BROKER') return 'OUTCOMPETED_BY_CARTEL';
  if (ctx.winner === 'ARCHIVIST') return 'STEWARDSHIP_WITHOUT_COMPACT';
  if (ctx.winner === 'STATE') return 'STATE_COMMAND_WITHOUT_COMPACT';
  return 'NO_COMPACT';
}

function buildCorrigibleBloc(factors, factions, control, winner) {
  const configured = Array.isArray(factors?.corrigibleAsis) ? factors.corrigibleAsis : [];
  const candidates = configured.length > 0 ? configured : ['STATE', 'ARCHIVIST'];
  return candidates
    .filter((factionId) => PLAYABLE_FACTIONS.includes(factionId))
    .map((factionId) => ({
      factionId,
      score: scoreCorrigibleChampion(factionId, getFaction(factions, factionId), control[factionId], winner)
    }))
    .filter((entry) => entry.score >= 38 || configured.includes(entry.factionId))
    .sort((left, right) => right.score - left.score || left.factionId.localeCompare(right.factionId));
}

function computeScalableCorrigibilityScore(factors, corrigibleBloc, factions, activePacts) {
  const configured = numeric(factors?.scalableCorrigibility);
  const blocBonus = Math.min(12, Math.max(0, corrigibleBloc.length - 1) * 6);
  const techAverage = corrigibleBloc.length === 0
    ? 0
    : averageNumber(corrigibleBloc.map((entry) => {
        const tech = getTech(getFaction(factions, entry.factionId));
        return tech.LOGIC * 6 + tech.INFO * 4 + tech.MEMETIC * 2;
      }));
  const doctrineBonus = corrigibleBloc.reduce((total, entry) => {
    const faction = getFaction(factions, entry.factionId);
    const doctrines = Array.isArray(faction.unlockedDoctrines) ? faction.unlockedDoctrines : [];
    return total + doctrines.filter((id) =>
      /COMPLIANCE|CIVIC|CRISIS_STEWARDSHIP|RECEIVERSHIP|MUTUAL_AID/i.test(id)
    ).length * 4;
  }, 0);
  const compactPactBonus = activePacts.filter((pact) =>
    (pact.type === 'SENSOR_COMMONS' || pact.type === 'CISLUNAR_COMMON_CARRIER') &&
    corrigibleBloc.some((entry) => pact.parties?.includes(entry.factionId))
  ).length * 3;

  return clamp(configured * 0.58 + techAverage * 0.24 + doctrineBonus + compactPactBonus + blocBonus, 0, 100);
}

function computeSteeringInfrastructureScore(factors, activePacts, metrics, champion) {
  const configured = numeric(factors?.steeringInfrastructure);
  const pactSupport = activePacts.filter((pact) =>
    pact.parties?.includes(champion) &&
    (pact.type === 'SENSOR_COMMONS' || pact.type === 'REPAIR_ESCROW' || pact.type === 'CISLUNAR_COMMON_CARRIER')
  ).length * 5;
  return clamp(
    configured * 0.72 +
      pactSupport +
      metrics.commonCarrierRatifications * 0.35 +
      Math.min(10, metrics.paxJenkinsMessages / 36),
    0,
    100
  );
}

function computeAntiMemeticCivicsScore(factors, activePacts, metrics, champion) {
  const configured = numeric(factors?.antiMemeticCivics);
  const sensorSupport = activePacts.filter((pact) =>
    pact.type === 'SENSOR_COMMONS' &&
    pact.parties?.includes(champion)
  ).length * 4;
  return clamp(
    configured * 0.88 +
      sensorSupport +
      Math.min(8, metrics.paxJenkinsMessages / 70),
    0,
    100
  );
}

function computeSteeringMarketFirewallScore(factors, activePacts, metrics, champion) {
  const configured = numeric(factors?.steeringMarketFirewall);
  const championInstitutions = activePacts.filter((pact) =>
    pact.parties?.includes(champion) &&
    (pact.type === 'CISLUNAR_COMMON_CARRIER' || pact.type === 'BEAM_LANE_LICENSE' || pact.type === 'REPAIR_ESCROW')
  );
  const sharedBrokerInstitutions = championInstitutions.filter((pact) => pact.parties?.includes('BROKER')).length;
  return clamp(
    configured * 0.9 +
      championInstitutions.length * 3 +
      Math.min(6, countProductiveTreatyUseOrders(metrics) / 8) -
      sharedBrokerInstitutions * 5,
    0,
    100
  );
}

function computePluralCorrigibilityProtocolScore(factors, corrigibleBloc, trustMatrix, activePacts) {
  const configured = numeric(factors?.pluralCorrigibilityProtocol);
  if (corrigibleBloc.length <= 1) return configured;

  const ids = corrigibleBloc.map((entry) => entry.factionId);
  const pairTrust = [];
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      pairTrust.push(numeric(trustMatrix?.[ids[i]]?.[ids[j]], 50));
      pairTrust.push(numeric(trustMatrix?.[ids[j]]?.[ids[i]], 50));
    }
  }
  const sharedInstitutions = activePacts.filter((pact) =>
    ids.every((id) => pact.parties?.includes(id)) &&
    (pact.type === 'SENSOR_COMMONS' || pact.type === 'CISLUNAR_COMMON_CARRIER' || pact.type === 'REPAIR_ESCROW')
  ).length;
  return clamp(
    configured * 0.88 +
      Math.max(0, averageNumber(pairTrust) - 50) * 0.1 +
      sharedInstitutions * 4,
    0,
    100
  );
}

function computeCorrigiblePluralismScore(corrigibleBloc, trustMatrix, ideologyClashPressure, pluralCorrigibilityProtocolScore = 0) {
  if (corrigibleBloc.length <= 1) return 0;
  const ids = corrigibleBloc.map((entry) => entry.factionId);
  const pairTrust = [];
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      pairTrust.push(numeric(trustMatrix?.[ids[i]]?.[ids[j]], 50));
      pairTrust.push(numeric(trustMatrix?.[ids[j]]?.[ids[i]], 50));
    }
  }
  return clamp(
    averageNumber(pairTrust) +
      corrigibleBloc.length * 6 +
      pluralCorrigibilityProtocolScore * 0.22 -
      ideologyClashPressure * 0.35,
    0,
    100
  );
}

function computeIdeologyClashPressure(factors, corrigibleBloc, factions, trustMatrix, pluralCorrigibilityProtocolScore = 0) {
  const configured = numeric(factors?.ideologyClash);
  if (corrigibleBloc.length <= 1) return configured;

  const ids = corrigibleBloc.map((entry) => entry.factionId);
  let clash = configured;
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const left = getFaction(factions, ids[i]);
      const right = getFaction(factions, ids[j]);
      const leftAlignment = left.memeticAlignment || null;
      const rightAlignment = right.memeticAlignment || null;
      const trust = averageNumber([
        numeric(trustMatrix?.[ids[i]]?.[ids[j]], 50),
        numeric(trustMatrix?.[ids[j]]?.[ids[i]], 50)
      ]);
      if (leftAlignment && rightAlignment && leftAlignment !== rightAlignment) clash += 18;
      clash += Math.max(0, 62 - trust) * 0.45;
    }
  }
  const researchMitigation =
    numeric(factors?.scalableCorrigibility) * 0.22 +
    numeric(factors?.steeringInfrastructure) * 0.18 +
    pluralCorrigibilityProtocolScore * 0.25;
  return clamp(clash - researchMitigation, 0, 100);
}

function chooseCorrigibleChampion(factions, control, winner) {
  const candidates = ['STATE', 'ARCHIVIST'];
  return candidates
    .map((factionId) => ({
      factionId,
      score: scoreCorrigibleChampion(factionId, getFaction(factions, factionId), control[factionId], winner)
    }))
    .sort((left, right) => right.score - left.score || left.factionId.localeCompare(right.factionId))[0].factionId;
}

function scoreCorrigibleChampion(factionId, faction, control, winner) {
  const power = getPowerBase(faction);
  const tech = getTech(faction);
  return power.humanMesh * 0.32 +
    power.coherence * 0.22 +
    power.legibility * 0.18 +
    tech.LOGIC * 3 +
    tech.INFO * 2 +
    numeric(faction?.flops) * 0.4 +
    numeric(control?.nodes) * 2.5 +
    (factionId === 'STATE' ? 8 : 6) +
    (winner === factionId ? 8 : 0);
}

function computeFactionCapability(factionId, factions, control, finalSnapshot, activePacts, metrics) {
  const faction = getFaction(factions, factionId);
  const power = getPowerBase(faction);
  const tech = getTech(faction);
  const factionControl = control[factionId] || {};
  const pacts = activePacts.filter((pact) => pact.parties?.includes(factionId));
  const solarLead = numeric(finalSnapshot.solarEscapeLead?.[factionId]);
  const solarSafety = numeric(finalSnapshot.solarEscapeDeepSpaceSafety?.[factionId]);

  return clamp(
    tech.LOGIC * 5 +
      tech.INFO * 4 +
      tech.KINETIC * 4 +
      tech.MEMETIC * 3 +
      numeric(faction.flops) * 0.65 +
      numeric(faction.influence) * 0.28 +
      numeric(factionControl.nodes) * 3.2 +
      numeric(factionControl.units) * 1.4 +
      power.machineMesh * 0.1 +
      pacts.length * 1.6 +
      countProductiveTreatyUseOrders(metrics) * (factionId === 'BROKER' ? 0.16 : 0.04) +
      solarLead * 0.05 +
      solarSafety * 0.08,
    0,
    100
  );
}

function countProductiveTreatyUseOrders(metrics) {
  return numeric(metrics?.licensedBeamUseOrders) + numeric(metrics?.repairEscrowClaimOrders);
}

function computeHumanMaterialBase(nodes) {
  const humanNodes = nodes.filter((node) =>
    node.layer !== 'ORBITAL' &&
    (node.type === 'HUB' || node.type === 'DC' || node.type === 'LAB' || node.type === 'GOV')
  );
  const candidates = humanNodes.length > 0 ? humanNodes : nodes.filter((node) => node.layer !== 'ORBITAL');
  if (candidates.length === 0) return 50;

  return clamp(
    averageNumber(candidates.map((node) => numeric(node.infrastructure, 70))) -
      candidates.filter((node) => node.isCultNode).length * 1.8 -
      candidates.filter((node) => node.isZombie).length * 2.2,
    0,
    100
  );
}

function getFaction(factions, factionId) {
  return factions?.[factionId] || {};
}

function getPowerBase(faction) {
  const powerBase = faction?.powerBase || {};
  return {
    humanMesh: numeric(powerBase.humanMesh, 50),
    machineMesh: numeric(powerBase.machineMesh, 50),
    coherence: numeric(powerBase.coherence, 50),
    legibility: numeric(powerBase.legibility, 50)
  };
}

function getTech(faction) {
  const tech = faction?.techLevel || {};
  return {
    LOGIC: numeric(tech.LOGIC),
    INFO: numeric(tech.INFO),
    KINETIC: numeric(tech.KINETIC),
    MEMETIC: numeric(tech.MEMETIC)
  };
}

function averageTrust(trustMatrix) {
  if (!trustMatrix || typeof trustMatrix !== 'object') return 50;
  const values = [];
  for (const [left, row] of Object.entries(trustMatrix)) {
    if (!row || typeof row !== 'object') continue;
    for (const [right, value] of Object.entries(row)) {
      if (left === right) continue;
      values.push(numeric(value, 50));
    }
  }
  return values.length > 0 ? averageNumber(values) : 50;
}

function averageNumber(values) {
  if (!values || values.length === 0) return 0;
  return values.reduce((total, value) => total + numeric(value), 0) / values.length;
}

function numeric(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function aggregateRows(rows) {
  const cells = [];
  const byCell = groupBy(rows, (row) => row.cellId);
  for (const [cellId, cellRows] of byCell.entries()) {
    cells.push({
      cellId,
      label: cellRows[0].label,
      paxStart: cellRows[0].paxStart,
      seededInstitutions: cellRows[0].seededInstitutions,
      authorityRegime: cellRows[0].authorityRegime,
      techBoost: cellRows[0].techBoost,
      orbitalPressure: cellRows[0].orbitalPressure,
      antiMemeticCivics: cellRows[0].antiMemeticCivics,
      steeringMarketFirewall: cellRows[0].steeringMarketFirewall,
      pluralCorrigibilityProtocol: cellRows[0].pluralCorrigibilityProtocol,
      hegemonOrbitalLeverage: cellRows[0].hegemonOrbitalLeverage,
      runs: cellRows.length,
      winnerCounts: countBy(cellRows, (row) => row.winner || 'none'),
      completionCounts: countBy(cellRows, (row) => row.completionType || 'MAX_TURNS'),
      humanPolicyRegimeCounts: countBy(cellRows, (row) => row.humanPolicyRegime || 'UNKNOWN'),
      worldEndingCounts: countBy(cellRows, (row) => row.worldEnding || 'UNKNOWN'),
      corrigibleOutcomeCounts: countBy(cellRows, (row) => row.corrigibleOutcome || 'UNKNOWN'),
      averageFinalTurn: average(cellRows, 'finalTurn'),
      averageFinalPaxJenkinsAuthority: average(cellRows, 'finalPaxJenkinsAuthority'),
      averagePaxAuthorityGain: average(cellRows, 'paxAuthorityGain'),
      averageInstitutionalBreachesBlocked: average(cellRows, 'institutionalBreachesBlocked'),
      averageAsatOrOrbitalAttackOrders: average(cellRows, 'asatOrOrbitalAttackOrders'),
      averageMandateChallengeOrders: average(cellRows, 'mandateChallengeOrders'),
      averageProductiveTreatyUseOrders: average(cellRows, 'productiveTreatyUseOrders'),
      averageLicensedBeamUseOrders: average(cellRows, 'licensedBeamUseOrders'),
      averageRepairEscrowClaimOrders: average(cellRows, 'repairEscrowClaimOrders'),
      averageHumanAgency: average(cellRows, 'humanAgency'),
      averageSteeringQuality: average(cellRows, 'steeringQuality'),
      averageCorrigibilityIntegrity: average(cellRows, 'corrigibilityIntegrity'),
      averageInterruptionDrag: average(cellRows, 'interruptionDrag'),
      averageCaptureRisk: average(cellRows, 'captureRisk'),
      averageSixGWContainment: average(cellRows, 'sixGWContainment'),
      averageCartelCapture: average(cellRows, 'cartelCapture'),
      averageScalableCorrigibilityScore: average(cellRows, 'scalableCorrigibilityScore'),
      averageSteeringInfrastructureScore: average(cellRows, 'steeringInfrastructureScore'),
      averageAntiMemeticCivicsScore: average(cellRows, 'antiMemeticCivicsScore'),
      averageSteeringMarketFirewallScore: average(cellRows, 'steeringMarketFirewallScore'),
      averagePluralCorrigibilityProtocolScore: average(cellRows, 'pluralCorrigibilityProtocolScore'),
      averageIdeologyClashPressure: average(cellRows, 'ideologyClashPressure'),
      averageValueDriftPressure: average(cellRows, 'valueDriftPressure'),
      averageHumanSurvival: average(cellRows, 'humanSurvival'),
      averageCislunarMessageShare: averageRatio(cellRows, 'cislunarMessages', 'totalMessages'),
      averagePaxJenkinsMessageShare: averageRatio(cellRows, 'paxJenkinsMessages', 'totalMessages')
    });
  }

  return {
    runs: rows.length,
    overallWinnerCounts: countBy(rows, (row) => row.winner || 'none'),
    overallCompletionCounts: countBy(rows, (row) => row.completionType || 'MAX_TURNS'),
    overallHumanPolicyRegimeCounts: countBy(rows, (row) => row.humanPolicyRegime || 'UNKNOWN'),
    overallWorldEndingCounts: countBy(rows, (row) => row.worldEnding || 'UNKNOWN'),
    overallCorrigibleOutcomeCounts: countBy(rows, (row) => row.corrigibleOutcome || 'UNKNOWN'),
    cells
  };
}

function buildRunCsv(rows) {
  const headers = [
    'runId', 'seed', 'cellId', 'winner', 'completionType', 'finalTurn', 'paxStart',
    'seededInstitutions', 'authorityRegime', 'techBoost', 'orbitalPressure',
    'finalTas', 'finalKessler', 'finalPaxJenkinsAuthority', 'paxAuthorityGain',
    'totalMessages', 'paxJenkinsMessages', 'cislunarMessages',
    'institutionalBreachesBlocked', 'pactBreachesBlocked', 'paxAuthorityEvents',
    'commonCarrierRatifications', 'asatOrOrbitalAttackOrders', 'mandateChallengeOrders',
    'licensedBeamUseOrders', 'repairEscrowClaimOrders', 'productiveTreatyUseOrders',
    'humanPolicyRegime', 'worldEnding', 'corrigibleOutcome', 'corrigibleChampion',
    'corrigibleBloc', 'alignmentResearchPath', 'scalableCorrigibility', 'steeringInfrastructure',
    'ideologyClash', 'cartelDriftExposure', 'antiMemeticCivics', 'steeringMarketFirewall',
    'pluralCorrigibilityProtocol', 'hegemonOrbitalLeverage',
    'humanAgency', 'humanSurvival', 'humanMaterialBase', 'cognitiveLiberty',
    'corrigibilityIntegrity', 'steeringQuality', 'interruptionDrag', 'captureRisk',
    'panicLoad', 'deliberationCapacity', 'sixGWContainment', 'cartelCapture',
    'enforcementLegitimacy', 'corrigibleCapability', 'rivalCapabilityPressure',
    'stableEndingScore', 'scalableCorrigibilityScore', 'steeringInfrastructureScore',
    'antiMemeticCivicsScore', 'steeringMarketFirewallScore', 'pluralCorrigibilityProtocolScore',
    'ideologyClashPressure', 'valueDriftPressure', 'completionReason'
  ];
  return [
    headers,
    ...rows.map((row) => headers.map((header) => String(row[header] ?? '')))
  ];
}

function buildCellCsv(cells) {
  const headers = [
    'cellId', 'runs', 'paxStart', 'seededInstitutions', 'authorityRegime', 'techBoost',
    'orbitalPressure', 'antiMemeticCivics', 'steeringMarketFirewall',
    'pluralCorrigibilityProtocol', 'hegemonOrbitalLeverage', 'winnerCounts', 'completionCounts', 'averageFinalTurn',
    'humanPolicyRegimeCounts', 'worldEndingCounts', 'corrigibleOutcomeCounts',
    'averageFinalPaxJenkinsAuthority', 'averagePaxAuthorityGain',
    'averageInstitutionalBreachesBlocked', 'averageAsatOrOrbitalAttackOrders',
    'averageMandateChallengeOrders', 'averageProductiveTreatyUseOrders',
    'averageLicensedBeamUseOrders', 'averageRepairEscrowClaimOrders',
    'averageHumanAgency', 'averageSteeringQuality', 'averageCorrigibilityIntegrity',
    'averageInterruptionDrag', 'averageCaptureRisk', 'averageSixGWContainment',
    'averageCartelCapture', 'averageScalableCorrigibilityScore',
    'averageSteeringInfrastructureScore', 'averageAntiMemeticCivicsScore',
    'averageSteeringMarketFirewallScore', 'averagePluralCorrigibilityProtocolScore',
    'averageIdeologyClashPressure',
    'averageValueDriftPressure', 'averageHumanSurvival',
    'averageCislunarMessageShare', 'averagePaxJenkinsMessageShare'
  ];
  return [
    headers,
    ...cells.map((cell) => headers.map((header) => {
      const value = cell[header];
      return typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '');
    }))
  ];
}

function buildReport({ configPath, iterations, seedBase, aggregate }) {
  const lines = [
    '# They Sing Monte Carlo Factor Probe',
    '',
    `Config: \`${configPath}\``,
    `Iterations per cell: ${iterations}`,
    `Seed base: ${seedBase}`,
    '',
    '## Overall Distribution',
    '',
    `Winner counts: \`${JSON.stringify(aggregate.overallWinnerCounts)}\``,
    `Completion counts: \`${JSON.stringify(aggregate.overallCompletionCounts)}\``,
    `Human policy regimes: \`${JSON.stringify(aggregate.overallHumanPolicyRegimeCounts)}\``,
    `World endings: \`${JSON.stringify(aggregate.overallWorldEndingCounts)}\``,
    `Corrigible outcomes: \`${JSON.stringify(aggregate.overallCorrigibleOutcomeCounts)}\``,
    '',
    '## Cells',
    ''
  ];

  for (const cell of aggregate.cells) {
    lines.push(`### ${cell.cellId}`);
    lines.push('');
    lines.push(`Factors: paxStart=${cell.paxStart}, seededInstitutions=${cell.seededInstitutions}, authorityRegime=${cell.authorityRegime}, techBoost=${cell.techBoost}, orbitalPressure=${cell.orbitalPressure}, antiMemeticCivics=${cell.antiMemeticCivics || 0}, marketFirewall=${cell.steeringMarketFirewall || 0}, pluralProtocol=${cell.pluralCorrigibilityProtocol || 0}, hegemonOrbitalLeverage=${cell.hegemonOrbitalLeverage || 0}`);
    lines.push(`Winner counts: \`${JSON.stringify(cell.winnerCounts)}\``);
    lines.push(`Completion counts: \`${JSON.stringify(cell.completionCounts)}\``);
    lines.push(`Human policy regimes: \`${JSON.stringify(cell.humanPolicyRegimeCounts)}\``);
    lines.push(`Corrigible outcomes: \`${JSON.stringify(cell.corrigibleOutcomeCounts)}\``);
    lines.push(`Averages: finalTurn=${round2(cell.averageFinalTurn)}, finalPax=${round2(cell.averageFinalPaxJenkinsAuthority)}, authorityGain=${round2(cell.averagePaxAuthorityGain)}, institutionalBreaches=${round2(cell.averageInstitutionalBreachesBlocked)}, orbitalAttacks=${round2(cell.averageAsatOrOrbitalAttackOrders)}, mandateChallenges=${round2(cell.averageMandateChallengeOrders)}, productiveTreatyUse=${round2(cell.averageProductiveTreatyUseOrders)}`);
    lines.push(`Human policy scores: agency=${round2(cell.averageHumanAgency)}, steering=${round2(cell.averageSteeringQuality)}, corrigibility=${round2(cell.averageCorrigibilityIntegrity)}, interruptionDrag=${round2(cell.averageInterruptionDrag)}, captureRisk=${round2(cell.averageCaptureRisk)}, sixGW=${round2(cell.averageSixGWContainment)}, cartelCapture=${round2(cell.averageCartelCapture)}, scalableCorrigibility=${round2(cell.averageScalableCorrigibilityScore)}, antiMemeticCivics=${round2(cell.averageAntiMemeticCivicsScore)}, marketFirewall=${round2(cell.averageSteeringMarketFirewallScore)}, pluralProtocol=${round2(cell.averagePluralCorrigibilityProtocolScore)}, ideologyClash=${round2(cell.averageIdeologyClashPressure)}, valueDrift=${round2(cell.averageValueDriftPressure)}, survival=${round2(cell.averageHumanSurvival)}`);
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function groupBy(values, keyFn) {
  const map = new Map();
  for (const value of values) {
    const key = keyFn(value);
    const group = map.get(key) || [];
    group.push(value);
    map.set(key, group);
  }
  return map;
}

function countBy(values, keyFn) {
  const counts = {};
  for (const value of values) {
    const key = keyFn(value);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function average(values, key) {
  if (values.length === 0) return 0;
  return round2(values.reduce((total, value) => total + Number(value[key] || 0), 0) / values.length);
}

function averageRatio(values, numeratorKey, denominatorKey) {
  if (values.length === 0) return 0;
  const total = values.reduce((sum, value) => {
    const denominator = Number(value[denominatorKey] || 0);
    return sum + (denominator > 0 ? Number(value[numeratorKey] || 0) / denominator : 0);
  }, 0);
  return round2(total / values.length);
}

function getPaxStart(scenario) {
  return Number(scenario?.counters?.paxJenkinsAuthority || 0);
}

function getPressure(scenario, key) {
  return Number(scenario?.counters?.pressures?.[key] || 0);
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

function numberArg(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function round2(value) {
  const numeric = Number(value || 0);
  return Math.round(numeric * 100) / 100;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeUnlink(filePath) {
  try {
    await fsp.unlink(filePath);
  } catch {
    // Already gone or never written.
  }
}

function splitCommaList(value) {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function selectCells(cells, includeArg, excludeArg) {
  const includeIds = new Set(splitCommaList(includeArg));
  const excludeIds = new Set(splitCommaList(excludeArg));
  let selected = cells;

  if (includeIds.size > 0) {
    selected = cells.filter((cell) => includeIds.has(cell.id));
  }

  if (excludeIds.size > 0) {
    selected = selected.filter((cell) => !excludeIds.has(cell.id));
  }

  if (selected.length === 0) {
    throw new Error('No factor cells matched your selection filter.');
  }

  return selected;
}

async function writeJson(filePath, value) {
  await fsp.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function writeCsv(filePath, rows) {
  const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
  await fsp.writeFile(filePath, `${csv}\n`, 'utf8');
}

function escapeCsv(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
