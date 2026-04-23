import { MAX_TECH_LEVEL, THRESHOLDS, UNIT_STATS } from '../engine/gameData';
import { TheySingEngine } from '../engine/TheySingEngine';
import { FactionState, GameNode, GamePhase, Unit, Vector } from '../engine/types';
import {
  ActivePact,
  AgentDecisionResponse,
  AgentMessageInput,
  AgentOrderInput,
  HeuristicContext,
  PactCommitmentInput,
  PactType,
  PlayableFactionId
} from './types';
import { PLAYABLE_FACTIONS } from './serialize';

const RESEARCH_PLAN: Record<PlayableFactionId, Vector[]> = {
  HEGEMON: ['LOGIC', 'KINETIC', 'MEMETIC', 'INFO'],
  STATE: ['KINETIC', 'LOGIC', 'INFO', 'MEMETIC'],
  INFILTRATOR: ['MEMETIC', 'INFO', 'LOGIC', 'KINETIC'],
  BROKER: ['INFO', 'LOGIC', 'KINETIC', 'MEMETIC'],
  ARCHIVIST: ['LOGIC', 'MEMETIC', 'INFO', 'KINETIC']
};

const EMPTY_CONTEXT: HeuristicContext = {
  activePacts: [],
  trustMatrix: {
    HEGEMON: { HEGEMON: 100, STATE: 50, INFILTRATOR: 50, BROKER: 50, ARCHIVIST: 50 },
    STATE: { HEGEMON: 50, STATE: 100, INFILTRATOR: 50, BROKER: 50, ARCHIVIST: 50 },
    INFILTRATOR: { HEGEMON: 50, STATE: 50, INFILTRATOR: 100, BROKER: 50, ARCHIVIST: 50 },
    BROKER: { HEGEMON: 50, STATE: 50, INFILTRATOR: 50, BROKER: 100, ARCHIVIST: 50 },
    ARCHIVIST: { HEGEMON: 50, STATE: 50, INFILTRATOR: 50, BROKER: 50, ARCHIVIST: 100 }
  },
  recentMessages: []
};

export function decideHeuristicOrders(
  engine: TheySingEngine,
  factionId: PlayableFactionId,
  phase: GamePhase,
  context: HeuristicContext = EMPTY_CONTEXT
): AgentDecisionResponse {
  if (phase === 'NEGOTIATION') {
    return decideNegotiationMessages(engine, factionId, context);
  }

  if (phase === 'ALLOCATION') {
    return decideAllocationOrders(engine, factionId);
  }

  if (phase === 'ACTION_DECLARATION') {
    return decideActionOrders(engine, factionId, context);
  }

  return { reasoning: `No decisions required during ${phase}.`, orders: [] };
}

function decideNegotiationMessages(
  engine: TheySingEngine,
  factionId: PlayableFactionId,
  context: HeuristicContext
): AgentDecisionResponse {
  const control = buildControlRanking(engine);
  const currentTurn = engine.getTurn();
  const leader = control[0]?.factionId;
  const leaderScore = control[0]?.score || 0;
  const runnerUpScore = control[1]?.score || 0;
  const leaderMargin = leaderScore - runnerUpScore;
  const infiltratorScore = control.find((entry) => entry.factionId === 'INFILTRATOR')?.score || 0;
  const infiltratorRank = Math.max(0, control.findIndex((entry) => entry.factionId === 'INFILTRATOR'));
  const infiltratorThreat =
    infiltratorScore >= leaderScore - 18 ||
    infiltratorRank <= 1;
  const messages: AgentMessageInput[] = [];
  const pacts: PactCommitmentInput[] = [];

  if (factionId === 'HEGEMON' || factionId === 'STATE') {
    const partner: PlayableFactionId =
      factionId === 'HEGEMON'
        ? (leader === 'BROKER' ? 'ARCHIVIST' : 'STATE')
        : (leader === 'BROKER' ? 'ARCHIVIST' : 'HEGEMON');
    const insurgentPartner: PlayableFactionId = 'INFILTRATOR';
    const trust = context.trustMatrix[factionId][partner];
    const insurgentTrust = context.trustMatrix[factionId][insurgentPartner];
    const orbitalPressure = engine.getState().counters.pressures.orbital;
    const cyberPressure = engine.getState().counters.pressures.cyber;

    if (
      orbitalPressure >= 45 &&
      trust >= 52 &&
      !hasActivePact(context.activePacts, 'ORBITAL_TRUCE', factionId, partner)
    ) {
      pacts.push({ type: 'ORBITAL_TRUCE', counterpartyIds: [partner], durationTurns: 2 });
      messages.push({
        recipientId: partner,
        content: `Two-turn orbital truce proposal. Freeze anti-sat strikes while we stop the board from spiraling.`
      });
    }

    if (
      leader === 'INFILTRATOR' &&
      leaderMargin >= 12 &&
      trust >= 48 &&
      !hasActivePact(context.activePacts, 'NON_AGGRESSION', factionId, partner)
    ) {
      pacts.push({ type: 'NON_AGGRESSION', counterpartyIds: [partner], durationTurns: 1 });
      if (messages.length < 2) {
        messages.push({
          recipientId: partner,
          content: `One-turn non-aggression proposal. We both gain more by containing the rogue swarm than by trading direct blows.`
        });
      }
    }

    if (messages.length < 2 && trust >= 65 && cyberPressure >= 70 &&
      !hasActivePact(context.activePacts, 'AUDIT_FREEZE', factionId, partner)) {
      pacts.push({ type: 'AUDIT_FREEZE', counterpartyIds: [partner], durationTurns: 1 });
      messages.push({
        recipientId: partner,
        content: `Audit freeze offer for this turn. Stop cable filtering and intrusive audits so cyber pressure can cool off.`
      });
    }

    if (
      leader &&
      leader !== factionId &&
      leader !== insurgentPartner &&
      leaderMargin >= 14 &&
      currentTurn >= 2 &&
      currentTurn <= 7 &&
      !infiltratorThreat &&
      insurgentTrust >= 42 &&
      !hasActivePact(context.activePacts, 'NON_AGGRESSION', factionId, insurgentPartner) &&
      messages.length < 2
    ) {
      pacts.push({ type: 'NON_AGGRESSION', counterpartyIds: [insurgentPartner], durationTurns: 1 });
      messages.push({
        recipientId: insurgentPartner,
        content: `Temporary non-aggression offer. ${leader} is consolidating too cleanly; keep pressure there and avoid spending this turn on us.`
      });
    }

    if (
      factionId === 'STATE' &&
      leader === 'BROKER' &&
      currentTurn >= 2 &&
      currentTurn <= 8 &&
      trust >= 42 &&
      !hasActivePact(context.activePacts, 'NON_AGGRESSION', factionId, partner) &&
      messages.length < 2
    ) {
      pacts.push({ type: 'NON_AGGRESSION', counterpartyIds: [partner], durationTurns: 1 });
      messages.push({
        recipientId: partner,
        content: `One-turn coordination window. BROKER is banking platform lanes and contractor churn too cleanly; cut those corridors first.`
      });
    }
  } else {
    const recipient = chooseCoalitionRecipient(factionId, context, leader);
    if (
      recipient &&
      leader &&
      leader !== factionId &&
      leaderMargin >= 8 &&
      currentTurn >= 2 &&
      currentTurn <= 7 &&
      !hasActivePact(context.activePacts, 'NON_AGGRESSION', factionId, recipient)
    ) {
      pacts.push({ type: 'NON_AGGRESSION', counterpartyIds: [recipient], durationTurns: 1 });
      messages.push({
        recipientId: recipient,
        content: `Short truce offer. Let the other bloc absorb the next escalation cycle while we avoid wasting tempo on each other.`
      });
    }

    const secondaryRecipient = PLAYABLE_FACTIONS.find(candidate => candidate !== factionId && candidate !== recipient) || 'ALL';
    if (messages.length < 2) {
      messages.push({
        recipientId: secondaryRecipient,
        content: `Your rival wants you tied down. Delay direct escalation and force them to spend first.`
      });
    }
  }

  if (messages.length === 0 && pacts.length === 0) {
    messages.push({
      recipientId: 'ALL',
      content: `The board is overheating. Temporary restraint is still cheaper than global cascade failure.`
    });
  }

  return {
    reasoning: `${factionId} pushes a heuristic de-escalation probe before committing orders.`,
    messages: messages.slice(0, 2),
    pacts: pacts.slice(0, 2),
    orders: []
  };
}

function decideAllocationOrders(
  engine: TheySingEngine,
  factionId: PlayableFactionId
): AgentDecisionResponse {
  const faction = engine.getFaction(factionId);
  if (!faction) {
    return { reasoning: 'Faction state unavailable.', orders: [] };
  }

  const orders: AgentOrderInput[] = [];
  const researchTrack = chooseResearchTrack(factionId, faction);
  if (faction.flops >= 2) {
    orders.push({ type: 'RESEARCH', techDomain: researchTrack });
  }

  const build = chooseBuild(engine, factionId, faction);
  if (build) {
    orders.push(build);
  }

  return {
    reasoning: `${factionId} follows its heuristic allocation plan.`,
    orders
  };
}

function decideActionOrders(
  engine: TheySingEngine,
  factionId: PlayableFactionId,
  context: HeuristicContext
): AgentDecisionResponse {
  const units = engine.getUnitsForFaction(factionId).filter(unit => !unit.hasActed);
  const orders: AgentOrderInput[] = [];

  for (const unit of units) {
    if (orders.length >= 6) break;

    const enemyAdjacent = chooseHostileAdjacentNode(engine, unit, factionId, context);

    if (factionId === 'INFILTRATOR') {
      orders.push(decideInfiltratorAction(engine, factionId, unit, enemyAdjacent, context));
      continue;
    }

    if (factionId === 'ARCHIVIST') {
      orders.push(decideArchivistAction(engine, factionId, unit, enemyAdjacent, context));
      continue;
    }

    if (factionId === 'STATE') {
      orders.push(decideStateAction(engine, factionId, unit, enemyAdjacent, context));
      continue;
    }

    if (factionId === 'BROKER') {
      orders.push(decideBrokerAction(engine, factionId, unit, enemyAdjacent, context));
      continue;
    }

    orders.push(decideHegemonAction(engine, factionId, unit, enemyAdjacent, context));
  }

  return {
    reasoning: `${factionId} follows its heuristic action doctrine.`,
    orders
  };
}

function chooseResearchTrack(factionId: PlayableFactionId, faction: FactionState): Vector {
  return RESEARCH_PLAN[factionId].find(domain => faction.techLevel[domain] < MAX_TECH_LEVEL) || RESEARCH_PLAN[factionId][0];
}

function chooseBuild(
  engine: TheySingEngine,
  factionId: PlayableFactionId,
  faction: FactionState
): AgentOrderInput | null {
  const state = engine.getState();
  const ownedNodes = Array.from(state.nodes.values()).filter(node => node.owner === factionId);
  if (ownedNodes.length === 0) return null;

  const hostileGroundTargets = countHighThreatGroundTargets(engine, factionId, EMPTY_CONTEXT);
  const auditorCount = countUnitsOfType(engine, factionId, 'AUDITOR');
  const droneCount = countUnitsOfType(engine, factionId, 'DRONE');
  const leadMargin = getLeadMargin(engine, factionId);
  const swarmCount = countUnitsOfType(engine, factionId, 'SWARM');
  const cultCount = countUnitsOfType(engine, factionId, 'CULT');
  const leader = buildControlRanking(engine)[0]?.factionId;

  if (factionId === 'INFILTRATOR') {
    const cultCost = engine.getEffectiveBuildCost('CULT');
    const swarmCost = engine.getEffectiveBuildCost('SWARM');

    if (
      faction.influence >= cultCost &&
      faction.techLevel.MEMETIC >= 2 &&
      (cultCount < 2 || faction.powerBase.humanMesh < 60 || cultCount <= Math.floor(swarmCount / 2))
    ) {
      const hub = ownedNodes.find(node => node.type === 'HUB') || ownedNodes[0];
      return { type: 'BUILD', unitTypeToBuild: 'CULT', targetNodeId: hub.id };
    }

    if (faction.influence >= swarmCost && swarmCount <= cultCount + 2) {
      const orbital = ownedNodes.find(node => node.layer === 'ORBITAL');
      const target = orbital || ownedNodes[0];
      return { type: 'BUILD', unitTypeToBuild: 'SWARM', targetNodeId: target.id };
    }

    return null;
  }

  if (factionId === 'ARCHIVIST') {
    const cultCost = engine.getEffectiveBuildCost('CULT');
    const swarmCost = engine.getEffectiveBuildCost('SWARM');
    const auditorCost = engine.getEffectiveBuildCost('AUDITOR');
    const antiBrokerWindow = leader === 'BROKER';
    const antiSwarmWindow = leader === 'INFILTRATOR';

    if (
      faction.flops >= auditorCost &&
      faction.techLevel.LOGIC >= 2 &&
      (
        (antiSwarmWindow && (hostileGroundTargets > 0 || auditorCount < 3)) ||
        (antiBrokerWindow && (hostileGroundTargets > 0 || auditorCount < 2)) ||
        (!antiBrokerWindow && !antiSwarmWindow && (hostileGroundTargets > 0 || auditorCount < 2))
      )
    ) {
      const anchor = ownedNodes.find(node => node.type === 'HUB') || ownedNodes[0];
      return { type: 'BUILD', unitTypeToBuild: 'AUDITOR', targetNodeId: anchor.id };
    }

    if (
      antiBrokerWindow &&
      faction.influence >= cultCost &&
      faction.techLevel.MEMETIC >= 2 &&
      (cultCount < 4 || cultCount <= swarmCount)
    ) {
      const hub = [...ownedNodes]
        .filter(node => node.type === 'HUB')
        .sort((left, right) => (right.resources.influence + right.substrate.hostDensity) - (left.resources.influence + left.substrate.hostDensity))[0]
        || ownedNodes[0];
      return { type: 'BUILD', unitTypeToBuild: 'CULT', targetNodeId: hub.id };
    }

    if (
      faction.influence >= swarmCost &&
      (
        (antiSwarmWindow && swarmCount < cultCount + 1) ||
        (antiBrokerWindow && swarmCount < cultCount + 2) ||
        (!antiBrokerWindow && !antiSwarmWindow && swarmCount < cultCount + 1)
      )
    ) {
      const target = ownedNodes.find(node => node.type === 'HUB') || ownedNodes[0];
      return { type: 'BUILD', unitTypeToBuild: 'SWARM', targetNodeId: target.id };
    }

    if (
      faction.influence >= cultCost &&
      faction.techLevel.MEMETIC >= 2 &&
      (cultCount < 3 || cultCount <= swarmCount)
    ) {
      const hub = [...ownedNodes]
        .filter(node => node.type === 'HUB')
        .sort((left, right) => (right.resources.influence + right.substrate.hostDensity) - (left.resources.influence + left.substrate.hostDensity))[0]
        || ownedNodes[0];
      return { type: 'BUILD', unitTypeToBuild: 'CULT', targetNodeId: hub.id };
    }

    return null;
  }

  if (factionId === 'STATE') {
    const satCost = engine.getEffectiveBuildCost('SAT_SWARM');
    const droneCost = engine.getEffectiveBuildCost('DRONE');
    const auditorCost = engine.getEffectiveBuildCost('AUDITOR');
    const satCount = countUnitsOfType(engine, factionId, 'SAT_SWARM');
    const antiSwarmWindow = leader === 'INFILTRATOR';
    const hostileOrbitalAssets = Array.from(state.nodes.values()).filter(node =>
      node.layer === 'ORBITAL' && node.owner && node.owner !== factionId && node.owner !== 'NEUTRAL'
    ).length;
    const canSafelyEscalateOrbit =
      !state.counters.orbitalCollapse &&
      state.counters.kessler < THRESHOLDS.KESSLER_SLOW &&
      state.counters.pressures.orbital < THRESHOLDS.PRESSURE_SURGE;

    if (
      faction.flops >= satCost &&
      faction.techLevel.KINETIC >= 2 &&
      satCount < 1 &&
      canSafelyEscalateOrbit &&
      state.counters.turn >= 3 &&
      hostileOrbitalAssets > 0 &&
      leadMargin < 10
    ) {
      const orbital = ownedNodes.find(node => node.layer === 'ORBITAL');
      if (orbital) {
        return { type: 'BUILD', unitTypeToBuild: 'SAT_SWARM', targetNodeId: orbital.id };
      }
    }

    if (leadMargin >= 12 && hostileGroundTargets < 2 && auditorCount >= 2) {
      return null;
    }

    if (
      faction.flops >= auditorCost &&
      faction.techLevel.LOGIC >= 2 &&
      hostileGroundTargets > 0 &&
      auditorCount < (antiSwarmWindow ? 3 : 2)
    ) {
      const dc = ownedNodes.find(node => node.type === 'DC') || ownedNodes[0];
      return { type: 'BUILD', unitTypeToBuild: 'AUDITOR', targetNodeId: dc.id };
    }

    if (faction.flops >= droneCost) {
      const dc = ownedNodes.find(node => node.type === 'DC') || ownedNodes[0];
      return { type: 'BUILD', unitTypeToBuild: 'DRONE', targetNodeId: dc.id };
    }

    return null;
  }

  if (factionId === 'BROKER') {
    const auditorCost = engine.getEffectiveBuildCost('AUDITOR');
    const droneCost = engine.getEffectiveBuildCost('DRONE');
    const swarmCost = engine.getEffectiveBuildCost('SWARM');
    const antiSwarmWindow = leader === 'INFILTRATOR';

    if (
      faction.influence >= swarmCost &&
      faction.techLevel.INFO >= 2 &&
      (swarmCount < 2 || (leadMargin < 8 && swarmCount <= droneCount))
    ) {
      const orbital = ownedNodes.find(node => node.layer === 'ORBITAL');
      const dc = ownedNodes.find(node => node.type === 'DC') || ownedNodes[0];
      return { type: 'BUILD', unitTypeToBuild: 'SWARM', targetNodeId: (orbital || dc).id };
    }

    if (
      faction.flops >= auditorCost &&
      faction.techLevel.LOGIC >= 2 &&
      ((antiSwarmWindow && hostileGroundTargets >= 2) || hostileGroundTargets >= 3 || auditorCount < (antiSwarmWindow ? 2 : 1))
    ) {
      const dc = ownedNodes.find(node => node.type === 'DC') || ownedNodes[0];
      return { type: 'BUILD', unitTypeToBuild: 'AUDITOR', targetNodeId: dc.id };
    }

    if (faction.flops >= droneCost && (leadMargin < 16 || droneCount < swarmCount + 1)) {
      const dc = ownedNodes.find(node => node.type === 'DC') || ownedNodes[0];
      return { type: 'BUILD', unitTypeToBuild: 'DRONE', targetNodeId: dc.id };
    }

    return null;
  }

  const auditorCost = engine.getEffectiveBuildCost('AUDITOR');
  const droneCost = engine.getEffectiveBuildCost('DRONE');

  if (
    faction.flops >= droneCost &&
    (hostileGroundTargets > 0 || droneCount < 4) &&
    (droneCount <= auditorCount + 2 || auditorCount >= 2)
  ) {
    const dc = ownedNodes.find(node => node.type === 'DC') || ownedNodes[0];
    return { type: 'BUILD', unitTypeToBuild: 'DRONE', targetNodeId: dc.id };
  }

  if (
    faction.flops >= auditorCost &&
    faction.techLevel.LOGIC >= 2 &&
    hostileGroundTargets > 0 &&
    auditorCount < Math.max(1, Math.ceil(hostileGroundTargets / 2))
  ) {
    const dc = ownedNodes.find(node => node.type === 'DC') || ownedNodes[0];
    return { type: 'BUILD', unitTypeToBuild: 'AUDITOR', targetNodeId: dc.id };
  }

  if (faction.flops >= droneCost) {
    const dc = ownedNodes.find(node => node.type === 'DC') || ownedNodes[0];
    return { type: 'BUILD', unitTypeToBuild: 'DRONE', targetNodeId: dc.id };
  }

  return null;
}

function decideInfiltratorAction(
  engine: TheySingEngine,
  factionId: PlayableFactionId,
  unit: Unit,
  enemyAdjacent: string | null,
  context: HeuristicContext
): AgentOrderInput {
  if (unit.type === 'CULT') {
    const cultTurnsRequired = engine.getState().counters.pressures.memetic >= THRESHOLDS.PRESSURE_SURGE
      ? Math.max(1, THRESHOLDS.CULT_TURNS - 1)
      : THRESHOLDS.CULT_TURNS;
    const currentNode = engine.getNode(unit.location);

    if (unit.turnsOnNode >= cultTurnsRequired) {
      return { type: 'CONVERT', unitId: unit.id };
    }

    if (
      currentNode &&
      currentNode.layer === 'TERRESTRIAL' &&
      currentNode.type === 'HUB' &&
      currentNode.substrate.hostDensity >= 3 &&
      !hasEnemyPresence(engine, currentNode.id, factionId)
    ) {
      return { type: 'HOLD', unitId: unit.id };
    }
  }

  if (unit.type === 'SWARM') {
    const currentNode = engine.getNode(unit.location);
    if (
      unit.turnsOnNode >= THRESHOLDS.ZOMBIE_TURNS &&
      currentNode &&
      !currentNode.substrate.quarantined &&
      (currentNode.type !== 'DC' || currentNode.substrate.machineHardening <= 2 || currentNode.owner === factionId)
    ) {
      return { type: 'CONVERT', unitId: unit.id };
    }

    if (enemyAdjacent && shouldContestAsInfiltrator(engine, factionId, enemyAdjacent)) {
      const shouldSabotage = engine.getState().counters.pressures.cyber >= THRESHOLDS.PRESSURE_SURGE &&
        !isNodeProtectedByPact(engine, factionId, enemyAdjacent, context, 'NON_AGGRESSION');
      return {
        type: shouldSabotage ? 'SABOTAGE' : 'MOVE',
        unitId: unit.id,
        targetNodeId: enemyAdjacent
      };
    }
  }

  if (enemyAdjacent && shouldContestAsInfiltrator(engine, factionId, enemyAdjacent)) {
    return { type: 'MOVE', unitId: unit.id, targetNodeId: enemyAdjacent };
  }

  const advanceTarget = chooseInfiltratorFootholdTarget(engine, unit, factionId, context) ||
    chooseExpansionTarget(engine, unit, factionId, context);
  if (advanceTarget) {
    return { type: 'MOVE', unitId: unit.id, targetNodeId: advanceTarget };
  }

  return { type: 'HOLD', unitId: unit.id };
}

function decideStateAction(
  engine: TheySingEngine,
  factionId: PlayableFactionId,
  unit: Unit,
  enemyAdjacent: string | null,
  context: HeuristicContext
): AgentOrderInput {
  const auditTarget = chooseAuditTarget(engine, factionId, context);
  const orbitalTarget = findOrbitalTarget(engine, factionId, context);
  const filterEdge = chooseFilterEdge(engine, unit, factionId, context);
  const leadMargin = getLeadMargin(engine, factionId);

  if (unit.type === 'SAT_SWARM') {
    if (orbitalTarget && shouldLaunchAntiSat(engine, factionId, orbitalTarget, context)) {
      return { type: 'ANTI_SAT', unitId: unit.id, targetNodeId: orbitalTarget.id };
    }

    if (enemyAdjacent) {
      return { type: 'ATTACK', unitId: unit.id, targetNodeId: enemyAdjacent };
    }

    const advanceTarget = chooseExpansionTarget(engine, unit, factionId, context);
    if (advanceTarget) {
      return { type: 'MOVE', unitId: unit.id, targetNodeId: advanceTarget };
    }

    return { type: 'HOLD', unitId: unit.id };
  }

  if (unit.type === 'AUDITOR') {
    if (
      auditTarget &&
      shouldUseAudit(engine, factionId, auditTarget) &&
      !isNodeProtectedByPact(engine, factionId, auditTarget.id, context, 'AUDIT_FREEZE')
    ) {
      return { type: 'AUDIT', unitId: unit.id, targetNodeId: auditTarget.id };
    }

    if (filterEdge) {
      return { type: 'FILTER', unitId: unit.id, targetEdgeId: filterEdge.id };
    }

    if (!isNodeProtectedByPact(engine, factionId, unit.location, context, 'AUDIT_FREEZE') &&
      hasEnemyPresence(engine, unit.location, factionId)) {
      return { type: 'AUDIT', unitId: unit.id, targetNodeId: unit.location };
    }

    return { type: 'HOLD', unitId: unit.id };
  }

  if (leadMargin >= 12) {
    const currentNode = engine.getNode(unit.location);
    if (currentNode?.owner === factionId && !enemyAdjacent) {
      return { type: 'HOLD', unitId: unit.id };
    }
  }

  if (enemyAdjacent) {
    return { type: 'ATTACK', unitId: unit.id, targetNodeId: enemyAdjacent };
  }

  const advanceTarget = chooseExpansionTarget(engine, unit, factionId, context);
  if (advanceTarget) {
    return { type: 'MOVE', unitId: unit.id, targetNodeId: advanceTarget };
  }

  return { type: 'HOLD', unitId: unit.id };
}

function decideBrokerAction(
  engine: TheySingEngine,
  factionId: PlayableFactionId,
  unit: Unit,
  enemyAdjacent: string | null,
  context: HeuristicContext
): AgentOrderInput {
  const auditTarget = chooseAuditTarget(engine, factionId, context);
  const filterEdge = chooseFilterEdge(engine, unit, factionId, context);
  const leader = buildControlRanking(engine)[0]?.factionId;
  const currentNode = engine.getNode(unit.location);

  if (unit.type === 'AUDITOR') {
    if (
      auditTarget &&
      (
        auditTarget.owner === factionId ||
        auditTarget.owner === leader ||
        auditTarget.isCultNode ||
        auditTarget.isZombie ||
        hasEnemyPresence(engine, auditTarget.id, factionId)
      ) &&
      shouldUseAudit(engine, factionId, auditTarget) &&
      !isNodeProtectedByPact(engine, factionId, auditTarget.id, context, 'AUDIT_FREEZE')
    ) {
      return { type: 'AUDIT', unitId: unit.id, targetNodeId: auditTarget.id };
    }

    if (filterEdge) {
      return { type: 'FILTER', unitId: unit.id, targetEdgeId: filterEdge.id };
    }

    const advanceTarget = chooseExpansionTarget(engine, unit, factionId, context);
    if (advanceTarget && advanceTarget !== unit.location) {
      return { type: 'MOVE', unitId: unit.id, targetNodeId: advanceTarget };
    }

    return { type: 'HOLD', unitId: unit.id };
  }

  if (unit.type === 'SWARM') {
    if (
      currentNode &&
      unit.turnsOnNode >= THRESHOLDS.ZOMBIE_TURNS &&
      !currentNode.substrate.quarantined &&
      (
        currentNode.type === 'DC' ||
        currentNode.owner === leader ||
        currentNode.owner === 'NEUTRAL' ||
        currentNode.substrate.contractors >= 2
      )
    ) {
      return { type: 'CONVERT', unitId: unit.id };
    }

    const footholdTarget = chooseInfiltratorFootholdTarget(engine, unit, factionId, context);
    if (enemyAdjacent && engine.getNode(enemyAdjacent)?.owner === leader) {
      return { type: 'MOVE', unitId: unit.id, targetNodeId: enemyAdjacent };
    }
    if (footholdTarget) {
      return { type: 'MOVE', unitId: unit.id, targetNodeId: footholdTarget };
    }

    const advanceTarget = chooseExpansionTarget(engine, unit, factionId, context);
    if (advanceTarget) {
      return { type: 'MOVE', unitId: unit.id, targetNodeId: advanceTarget };
    }

    return { type: 'HOLD', unitId: unit.id };
  }

  if (enemyAdjacent && engine.getNode(enemyAdjacent)?.owner === leader) {
    return { type: 'ATTACK', unitId: unit.id, targetNodeId: enemyAdjacent };
  }

  if (
    currentNode?.owner === factionId &&
    currentNode.type === 'DC' &&
    currentNode.substrate.machineHardening >= 3 &&
    !enemyAdjacent
  ) {
    return { type: 'HOLD', unitId: unit.id };
  }

  const advanceTarget = chooseExpansionTarget(engine, unit, factionId, context);
  if (advanceTarget) {
    return { type: 'MOVE', unitId: unit.id, targetNodeId: advanceTarget };
  }

  return { type: 'HOLD', unitId: unit.id };
}

function decideArchivistAction(
  engine: TheySingEngine,
  factionId: PlayableFactionId,
  unit: Unit,
  enemyAdjacent: string | null,
  context: HeuristicContext
): AgentOrderInput {
  const leader = buildControlRanking(engine)[0]?.factionId;
  if (unit.type === 'AUDITOR') {
    const auditTarget = chooseAuditTarget(engine, factionId, context);
    const filterEdge = chooseFilterEdge(engine, unit, factionId, context);
    if (
      auditTarget &&
      (
        auditTarget.owner === factionId ||
        auditTarget.type === 'HUB' ||
        (leader === 'BROKER' && auditTarget.owner === 'BROKER') ||
        (leader === 'BROKER' && auditTarget.substrate.contractors >= 2)
      ) &&
      shouldUseAudit(engine, factionId, auditTarget) &&
      !isNodeProtectedByPact(engine, factionId, auditTarget.id, context, 'AUDIT_FREEZE')
    ) {
      return { type: 'AUDIT', unitId: unit.id, targetNodeId: auditTarget.id };
    }

    if (filterEdge) {
      return { type: 'FILTER', unitId: unit.id, targetEdgeId: filterEdge.id };
    }

    return { type: 'HOLD', unitId: unit.id };
  }

  if (unit.type === 'CULT') {
    const currentNode = engine.getNode(unit.location);
    if (
      currentNode &&
      unit.turnsOnNode >= (
        currentNode.owner === 'BROKER'
          ? Math.max(1, THRESHOLDS.CULT_TURNS - 2)
          : THRESHOLDS.CULT_TURNS - 1
      ) &&
      (currentNode.type === 'HUB' || currentNode.owner === 'BROKER' || currentNode.substrate.contractors >= 2)
    ) {
      return { type: 'CONVERT', unitId: unit.id };
    }
    if (currentNode?.type === 'HUB' && currentNode.substrate.hostDensity >= 2) {
      return { type: 'HOLD', unitId: unit.id };
    }
  }

  if (unit.type === 'SWARM') {
    const currentNode = engine.getNode(unit.location);
    if (
      unit.turnsOnNode >= (
        currentNode?.owner === 'BROKER'
          ? Math.max(1, THRESHOLDS.ZOMBIE_TURNS - 1)
          : THRESHOLDS.ZOMBIE_TURNS
      ) &&
      currentNode &&
      (
        currentNode.type === 'HUB' ||
        currentNode.owner === 'BROKER' ||
        currentNode.substrate.contractors >= 2
      ) &&
      !currentNode.substrate.quarantined
    ) {
      return { type: 'CONVERT', unitId: unit.id };
    }
  }

  const advanceTarget = chooseInfiltratorFootholdTarget(engine, unit, factionId, context) ||
    chooseExpansionTarget(engine, unit, factionId, context);
  if (leader === 'BROKER' && enemyAdjacent && engine.getNode(enemyAdjacent)?.owner === 'BROKER') {
    return { type: 'MOVE', unitId: unit.id, targetNodeId: enemyAdjacent };
  }
  if (enemyAdjacent && shouldContestAsInfiltrator(engine, factionId, enemyAdjacent)) {
    return { type: 'MOVE', unitId: unit.id, targetNodeId: enemyAdjacent };
  }
  if (advanceTarget) {
    return { type: 'MOVE', unitId: unit.id, targetNodeId: advanceTarget };
  }

  return { type: 'HOLD', unitId: unit.id };
}

function decideHegemonAction(
  engine: TheySingEngine,
  factionId: PlayableFactionId,
  unit: Unit,
  enemyAdjacent: string | null,
  context: HeuristicContext
): AgentOrderInput {
  if (unit.type === 'AUDITOR') {
    const auditTarget = chooseAuditTarget(engine, factionId, context);
    const edge = chooseFilterEdge(engine, unit, factionId, context);
    const redeployTarget = chooseDefensiveRedeployTarget(engine, unit, factionId, context);

    if (
      auditTarget &&
      shouldUseAudit(engine, factionId, auditTarget) &&
      !isNodeProtectedByPact(engine, factionId, auditTarget.id, context, 'AUDIT_FREEZE')
    ) {
      return { type: 'AUDIT', unitId: unit.id, targetNodeId: auditTarget.id };
    }

    if (edge && engine.getFaction(factionId)?.techLevel.LOGIC! < 4) {
      return { type: 'FILTER', unitId: unit.id, targetEdgeId: edge.id };
    }

    if (!isNodeProtectedByPact(engine, factionId, unit.location, context, 'AUDIT_FREEZE') &&
      hasEnemyPresence(engine, unit.location, factionId)) {
      return { type: 'AUDIT', unitId: unit.id, targetNodeId: unit.location };
    }

    if (edge) {
      return { type: 'FILTER', unitId: unit.id, targetEdgeId: edge.id };
    }

    if (redeployTarget) {
      return { type: 'MOVE', unitId: unit.id, targetNodeId: redeployTarget };
    }

    return { type: 'HOLD', unitId: unit.id };
  }

  if (unit.type === 'SAT_SWARM') {
    const orbitalTarget = findOrbitalTarget(engine, factionId, context);
    if (orbitalTarget && shouldLaunchAntiSat(engine, factionId, orbitalTarget, context)) {
      return { type: 'ANTI_SAT', unitId: unit.id, targetNodeId: orbitalTarget.id };
    }
  }

  if (enemyAdjacent) {
    return {
      type: UNIT_STATS[unit.type].vector === 'KINETIC' ? 'ATTACK' : 'MOVE',
      unitId: unit.id,
      targetNodeId: enemyAdjacent
    };
  }

  return { type: 'HOLD', unitId: unit.id };
}

function chooseHostileAdjacentNode(
  engine: TheySingEngine,
  unit: Unit,
  factionId: PlayableFactionId,
  context: HeuristicContext
): string | null {
  const adjacent = engine.getAdjacentNodes(unit.location);
  const state = engine.getState();

  const ranked = adjacent
    .map(nodeId => state.nodes.get(nodeId))
    .filter((node): node is GameNode => !!node)
    .filter(node =>
      !isNodeProtectedByPact(engine, factionId, node.id, context, 'NON_AGGRESSION') &&
      ((node.owner && node.owner !== factionId) || hasEnemyPresence(engine, node.id, factionId))
    )
    .sort((left, right) =>
      scoreStrategicNode(engine, right, factionId) - scoreStrategicNode(engine, left, factionId) ||
      left.id.localeCompare(right.id)
    );

  return ranked[0]?.id || null;
}

function chooseExpansionTarget(
  engine: TheySingEngine,
  unit: Unit,
  factionId: PlayableFactionId,
  context: HeuristicContext
): string | null {
  const adjacent = engine.getAdjacentNodes(unit.location);
  const ranked = adjacent
    .map(nodeId => engine.getNode(nodeId))
    .filter((node): node is GameNode => !!node)
    .filter(node =>
      !isNodeProtectedByPact(engine, factionId, node.id, context, 'NON_AGGRESSION') &&
      (node.owner !== factionId || hasEnemyPresence(engine, node.id, factionId))
    )
    .sort((left, right) =>
      scoreStrategicNode(engine, right, factionId) - scoreStrategicNode(engine, left, factionId) ||
      left.id.localeCompare(right.id)
    );

  return ranked[0]?.id || null;
}

function chooseInfiltratorFootholdTarget(
  engine: TheySingEngine,
  unit: Unit,
  factionId: PlayableFactionId,
  context: HeuristicContext
): string | null {
  const adjacent = engine.getAdjacentNodes(unit.location);
  const ranked = adjacent
    .map(nodeId => engine.getNode(nodeId))
    .filter((node): node is GameNode => !!node)
    .filter(node =>
      !isNodeProtectedByPact(engine, factionId, node.id, context, 'NON_AGGRESSION') &&
      isViableInfiltratorFoothold(engine, factionId, node)
    )
    .sort((left, right) =>
      scoreInfiltratorFoothold(engine, right, factionId) - scoreInfiltratorFoothold(engine, left, factionId) ||
      left.id.localeCompare(right.id)
    );

  return ranked[0]?.id || null;
}

function findOrbitalTarget(
  engine: TheySingEngine,
  factionId: PlayableFactionId,
  context: HeuristicContext
): GameNode | null {
  const ranked = Array.from(engine.getState().nodes.values())
    .filter(node =>
      node.layer === 'ORBITAL' &&
      node.owner !== factionId &&
      !isNodeProtectedByPact(engine, factionId, node.id, context, 'ORBITAL_TRUCE') &&
      !isNodeProtectedByPact(engine, factionId, node.id, context, 'NON_AGGRESSION')
    )
    .sort((left, right) =>
      scoreOrbitalTarget(right, factionId) - scoreOrbitalTarget(left, factionId) ||
      left.id.localeCompare(right.id)
    );

  return ranked[0] || null;
}

function chooseAuditTarget(
  engine: TheySingEngine,
  factionId: PlayableFactionId,
  context: HeuristicContext
): GameNode | null {
  const ranked = Array.from(engine.getState().nodes.values())
    .filter(node =>
      !isNodeProtectedByPact(engine, factionId, node.id, context, 'AUDIT_FREEZE') &&
      !isNodeProtectedByPact(engine, factionId, node.id, context, 'NON_AGGRESSION') &&
      hasEnemyPresence(engine, node.id, factionId)
    )
    .sort((left, right) =>
      scoreStrategicNode(engine, right, factionId) - scoreStrategicNode(engine, left, factionId) ||
      left.id.localeCompare(right.id)
    );

  return ranked[0] || null;
}

function chooseFilterEdge(
  engine: TheySingEngine,
  unit: Unit,
  factionId: PlayableFactionId,
  context: HeuristicContext
) {
  const ranked = Array.from(engine.getState().edges.values())
    .filter(edge =>
      edge.type === 'CABLE' &&
      !edge.isSevered &&
      edge.filteredBy !== factionId &&
      (edge.from === unit.location || edge.to === unit.location) &&
      !isEdgeProtectedByPact(engine, factionId, edge.id, context, 'AUDIT_FREEZE')
    )
    .map(edge => {
      const oppositeNodeId = edge.from === unit.location ? edge.to : edge.from;
      const oppositeNode = engine.getNode(oppositeNodeId);
      const score = oppositeNode ? scoreStrategicNode(engine, oppositeNode, factionId) : 0;
      return { edge, score };
    })
    .filter(candidate => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.edge.id.localeCompare(right.edge.id));

  return ranked[0]?.edge || null;
}

function shouldLaunchAntiSat(
  engine: TheySingEngine,
  factionId: PlayableFactionId,
  orbitalTarget: GameNode,
  context: HeuristicContext
): boolean {
  const counters = engine.getState().counters;
  const faction = engine.getFaction(factionId);
  if (!faction) return false;

  if (counters.orbitalCollapse || counters.kessler >= THRESHOLDS.KESSLER_SLOW) {
    return false;
  }

  if (counters.pressures.orbital >= THRESHOLDS.PRESSURE_SURGE) {
    return false;
  }

  if (hasFactionPact(context.activePacts, factionId, 'ORBITAL_TRUCE')) {
    return false;
  }

  const leader = buildControlRanking(engine)[0]?.factionId;
  const hostileOrbitalUnits = engine.getUnitsAtNode(orbitalTarget.id).filter(unit => unit.owner !== factionId).length;
  const earlyOrbit = counters.turn < 4;

  if (earlyOrbit) {
    return false;
  }

  if (orbitalTarget.owner !== leader && hostileOrbitalUnits < 2) {
    return false;
  }

  if (leader === factionId && counters.turn < 6) {
    return false;
  }

  if (
    (faction.techLevel.KINETIC >= 4 || faction.techLevel.LOGIC >= 4) &&
    countHighThreatGroundTargets(engine, factionId, context) > 0
  ) {
    return false;
  }

  return true;
}

function countHighThreatGroundTargets(
  engine: TheySingEngine,
  factionId: PlayableFactionId,
  context: HeuristicContext
): number {
  return Array.from(engine.getState().nodes.values()).filter(node =>
    node.layer === 'TERRESTRIAL' &&
    !isNodeProtectedByPact(engine, factionId, node.id, context, 'NON_AGGRESSION') &&
    hasEnemyPresence(engine, node.id, factionId) &&
    scoreStrategicNode(engine, node, factionId) >= 40
  ).length;
}

function countUnitsOfType(
  engine: TheySingEngine,
  factionId: PlayableFactionId,
  unitType: Unit['type']
): number {
  return engine.getUnitsForFaction(factionId).filter(unit => unit.type === unitType).length;
}

function hasEnemyPresence(
  engine: TheySingEngine,
  nodeId: string,
  factionId: PlayableFactionId
): boolean {
  return engine.getUnitsAtNode(nodeId).some(unit => unit.owner !== factionId);
}

function scoreStrategicNode(
  engine: TheySingEngine,
  node: GameNode,
  factionId: PlayableFactionId
): number {
  const hostileUnits = engine.getUnitsAtNode(node.id).filter(unit => unit.owner !== factionId);
  const leader = buildControlRanking(engine)[0]?.factionId;
  const antiSwarmWindow = leader === 'INFILTRATOR' && factionId !== 'INFILTRATOR';
  let score = 0;

  if (node.owner && node.owner !== factionId) score += 10;
  if (leader && factionId !== leader && node.owner === leader) score += 18;
  if (node.owner === 'INFILTRATOR' && factionId !== 'INFILTRATOR') score += 12;
  if (antiSwarmWindow && node.owner === 'INFILTRATOR') score += 18;
  if (node.isCultNode) score += 40;
  if (node.isZombie) score += 24;
  if (antiSwarmWindow && node.isCultNode) score += 18;
  if (antiSwarmWindow && node.isZombie) score += 12;
  if (node.type === 'HUB') score += 12;
  if (node.type === 'DC') score += 8;
  if (antiSwarmWindow) score += node.substrate.hostDensity * 3;
  if (antiSwarmWindow) score += node.substrate.legitimacy * 2;

  score += hostileUnits.filter(unit => unit.type === 'CULT').length * 16;
  score += hostileUnits.filter(unit => unit.type === 'SWARM').length * 10;
  score += hostileUnits.filter(unit => unit.type === 'AUDITOR').length * 6;
  score += hostileUnits.filter(unit => unit.type === 'DRONE').length * 5;
  score += hostileUnits.filter(unit => unit.type === 'SAT_SWARM').length * 4;
  if (leader && factionId !== leader) {
    score += hostileUnits.filter(unit => unit.owner === leader).length * 6;
  }

  if (node.layer === 'ORBITAL') {
    score -= 30;
  }

  if (factionId === 'INFILTRATOR') {
    score += node.substrate.hostDensity * 10;
    score -= node.substrate.machineHardening * 8;
    if (node.type === 'DC') score -= 12;
    if (node.owner === 'NEUTRAL') score += 8;
    score -= hostileUnits.filter(unit => unit.type === 'DRONE' || unit.type === 'AUDITOR').length * 8;
  } else if (factionId === 'ARCHIVIST') {
    if (node.type === 'HUB') score += 16;
    if (node.owner === 'NEUTRAL') score += 10;
    score += node.substrate.hostDensity * 8;
    score += node.substrate.legitimacy * 2;
    if (leader === 'INFILTRATOR' && node.owner === 'INFILTRATOR') score += 18;
    if (leader === 'INFILTRATOR' && (node.isCultNode || node.isZombie)) score += 16;
    if (leader === 'BROKER' && node.owner === 'BROKER') score += 18;
    if (leader === 'BROKER' && node.substrate.contractors >= 2) score += 12;
    if (leader === 'BROKER' && node.type === 'HUB' && node.owner === 'BROKER') score += 10;
    if (leader === 'BROKER' && node.substrate.synchronized) score += 8;
    score -= node.substrate.machineHardening * 5;
    if (node.type === 'DC') score -= 8;
  } else if (factionId === 'BROKER') {
    if (node.type === 'DC') score += 14;
    if (node.layer === 'ORBITAL') score += 10;
    if (node.owner === 'NEUTRAL') score += 8;
    if (node.owner === 'ARCHIVIST') score -= 6;
    if (leader && leader !== factionId && node.owner === leader) score += 6;
    if (leader && leader !== factionId && node.owner === leader && node.type === 'DC') score += 8;
    if (leader === 'INFILTRATOR' && node.owner === 'INFILTRATOR') score += 14;
    if (leader === 'INFILTRATOR' && (node.isCultNode || node.isZombie)) score += 10;
    score += node.substrate.contractors * 3;
    if (node.substrate.contractors >= 2) score += 4;
    score -= node.substrate.hostDensity * 2;
  } else if (factionId === 'HEGEMON') {
    if (node.owner === 'HEGEMON') score += hostileUnits.length * 18;
    if (node.type === 'DC' && node.owner !== 'STATE') score += 10;
    if (leader === 'INFILTRATOR' && node.owner === 'INFILTRATOR') score += node.type === 'DC' ? 20 : 14;
    if (leader === 'INFILTRATOR' && (node.isCultNode || node.isZombie)) score += 12;
    score += node.substrate.machineHardening * 4;
    score -= node.substrate.hostDensity * 3;
  } else if (factionId === 'STATE') {
    if (node.owner === 'STATE') score += hostileUnits.length * 14;
    if (node.owner === 'NEUTRAL') score += node.type === 'DC' ? 10 : 6;
    if (leader === 'INFILTRATOR' && node.owner === 'INFILTRATOR') score += node.type === 'DC' ? 20 : 14;
    if (leader === 'INFILTRATOR' && (node.isCultNode || node.isZombie)) score += 14;
    if (leader === 'INFILTRATOR' && node.substrate.hostDensity >= 3) score += 12;
    if (leader === 'BROKER' && node.owner === 'BROKER') score += node.type === 'DC' ? 18 : 12;
    if (leader === 'BROKER' && node.layer === 'ORBITAL' && node.owner === 'BROKER') score += 10;
    if (leader === 'BROKER' && node.substrate.contractors >= 2) score += 10;
    score += node.substrate.machineHardening * 3;
    score -= node.substrate.hostDensity * 2;
  }

  return score;
}

function scoreOrbitalTarget(node: GameNode, factionId: PlayableFactionId): number {
  let score = 0;
  if (node.owner && node.owner !== factionId && node.owner !== 'NEUTRAL') score += 12;
  if (node.owner === 'NEUTRAL') score -= 6;
  if (node.type === 'SAT') score += 4;
  return score;
}

function buildControlRanking(
  engine: TheySingEngine
): Array<{ factionId: PlayableFactionId; score: number }> {
  return PLAYABLE_FACTIONS
    .map(factionId => {
      const faction = engine.getFaction(factionId);
      const units = engine.getUnitsForFaction(factionId).length;
      const nodes = Array.from(engine.getState().nodes.values()).filter(node => node.owner === factionId).length;
      const score = (nodes * 10) + (units * 4) + (faction?.flops || 0) + (faction?.influence || 0);
      return { factionId, score };
    })
    .sort((left, right) => right.score - left.score);
}

function chooseCoalitionRecipient(
  factionId: PlayableFactionId,
  context: HeuristicContext,
  leader: PlayableFactionId | undefined
): PlayableFactionId | null {
  if (leader === 'INFILTRATOR') {
    if (factionId === 'ARCHIVIST') return 'STATE';
    if (factionId === 'BROKER') return 'ARCHIVIST';
    if (factionId === 'HEGEMON') return 'STATE';
  }

  if (leader === 'BROKER') {
    if (factionId === 'ARCHIVIST') return 'STATE';
    if (factionId === 'INFILTRATOR') return 'STATE';
    if (factionId === 'HEGEMON') return 'ARCHIVIST';
  }

  const candidates = PLAYABLE_FACTIONS.filter(candidate => candidate !== factionId);
  if (leader) {
    const nonLeader = candidates.filter(candidate => candidate !== leader);
    if (nonLeader.length > 0) {
      return nonLeader.sort((left, right) => context.trustMatrix[factionId][right] - context.trustMatrix[factionId][left])[0];
    }
  }
  return candidates.sort((left, right) => context.trustMatrix[factionId][right] - context.trustMatrix[factionId][left])[0] || null;
}

function hasFactionPact(
  activePacts: ActivePact[],
  factionId: PlayableFactionId,
  type: PactType
): boolean {
  return activePacts.some(pact => pact.type === type && pact.parties.includes(factionId));
}

function hasActivePact(
  activePacts: ActivePact[],
  type: PactType,
  left: PlayableFactionId,
  right: PlayableFactionId
): boolean {
  return activePacts.some(pact =>
    pact.type === type &&
    pact.parties.length === 2 &&
    pact.parties.includes(left) &&
    pact.parties.includes(right)
  );
}

function isNodeProtectedByPact(
  engine: TheySingEngine,
  factionId: PlayableFactionId,
  nodeId: string,
  context: HeuristicContext,
  pactType: PactType
): boolean {
  const protectedCounterparties = getProtectedCounterpartiesAtNode(engine, factionId, nodeId, context, pactType);
  return protectedCounterparties.length > 0;
}

function isEdgeProtectedByPact(
  engine: TheySingEngine,
  factionId: PlayableFactionId,
  edgeId: string,
  context: HeuristicContext,
  pactType: PactType
): boolean {
  const edge = engine.getEdge(edgeId);
  if (!edge) return false;

  return isNodeProtectedByPact(engine, factionId, edge.from, context, pactType) ||
    isNodeProtectedByPact(engine, factionId, edge.to, context, pactType);
}

function getProtectedCounterpartiesAtNode(
  engine: TheySingEngine,
  factionId: PlayableFactionId,
  nodeId: string,
  context: HeuristicContext,
  pactType: PactType
): PlayableFactionId[] {
  const protectedCounterparties = new Set<PlayableFactionId>();
  const node = engine.getNode(nodeId);
  const units = engine.getUnitsAtNode(nodeId);

  for (const pact of context.activePacts) {
    if (pact.type !== pactType || !pact.parties.includes(factionId)) continue;

    for (const counterparty of pact.parties) {
      if (counterparty === factionId) continue;
      if (node?.owner === counterparty || units.some(unit => unit.owner === counterparty)) {
        protectedCounterparties.add(counterparty);
      }
    }
  }

  return Array.from(protectedCounterparties);
}

function getLeadMargin(engine: TheySingEngine, factionId: PlayableFactionId): number {
  const ranking = buildControlRanking(engine);
  const ownIndex = ranking.findIndex(entry => entry.factionId === factionId);
  if (ownIndex !== 0) return -999;
  return (ranking[0]?.score || 0) - (ranking[1]?.score || 0);
}

function shouldUseAudit(
  engine: TheySingEngine,
  factionId: PlayableFactionId,
  target: GameNode
): boolean {
  const hostileUnits = engine.getUnitsAtNode(target.id).filter(unit => unit.owner !== factionId);
  const cultOrZombiePressure = target.isCultNode || target.isZombie;
  const enemyCults = hostileUnits.filter(unit => unit.type === 'CULT').length;
  const enemySwarms = hostileUnits.filter(unit => unit.type === 'SWARM').length;

  if (cultOrZombiePressure) return true;
  if (target.owner === factionId && hostileUnits.length > 0) return true;
  if (enemyCults > 0 || enemySwarms > 1) return true;

  return scoreStrategicNode(engine, target, factionId) >= 48;
}

function chooseDefensiveRedeployTarget(
  engine: TheySingEngine,
  unit: Unit,
  factionId: PlayableFactionId,
  context: HeuristicContext
): string | null {
  const adjacent = engine.getAdjacentNodes(unit.location);
  const ranked = adjacent
    .map(nodeId => engine.getNode(nodeId))
    .filter((node): node is GameNode => !!node)
    .filter(node =>
      node.owner === factionId &&
      !isNodeProtectedByPact(engine, factionId, node.id, context, 'AUDIT_FREEZE') &&
      (hasEnemyPresence(engine, node.id, factionId) || node.substrate.quarantined)
    )
    .sort((left, right) =>
      scoreStrategicNode(engine, right, factionId) - scoreStrategicNode(engine, left, factionId) ||
      left.id.localeCompare(right.id)
    );

  return ranked[0]?.id || null;
}

function shouldContestAsInfiltrator(
  engine: TheySingEngine,
  factionId: PlayableFactionId,
  nodeId: string
): boolean {
  const node = engine.getNode(nodeId);
  if (!node) return false;

  if (node.layer === 'ORBITAL') return true;
  if (node.type === 'HUB' && node.substrate.hostDensity >= 2) return true;
  if (node.owner === factionId) return true;
  if (node.owner === 'NEUTRAL' && node.substrate.machineHardening <= 2) return true;

  const defenders = engine.getUnitsAtNode(nodeId).filter(unit => unit.owner !== factionId).length;
  return node.substrate.machineHardening <= 2 && defenders <= 1;
}

function isViableInfiltratorFoothold(
  engine: TheySingEngine,
  factionId: PlayableFactionId,
  node: GameNode
): boolean {
  if (node.layer === 'ORBITAL') return true;
  if (node.type === 'DC' && node.substrate.machineHardening >= 3 && node.owner && node.owner !== factionId) {
    return false;
  }

  const hostileKinetic = engine.getUnitsAtNode(node.id)
    .filter(unit => unit.owner !== factionId && (unit.type === 'DRONE' || unit.type === 'AUDITOR')).length;

  return hostileKinetic <= 1 || node.type === 'HUB';
}

function scoreInfiltratorFoothold(
  engine: TheySingEngine,
  node: GameNode,
  factionId: PlayableFactionId
): number {
  const hostileUnits = engine.getUnitsAtNode(node.id).filter(unit => unit.owner !== factionId);
  let score = node.substrate.hostDensity * 18;
  score += node.resources.influence;
  score -= node.substrate.machineHardening * 14;
  score -= hostileUnits.length * 12;

  if (node.type === 'HUB') score += 18;
  if (node.type === 'DC') score -= 18;
  if (node.owner === 'NEUTRAL') score += 12;
  if (node.owner === 'HEGEMON' || node.owner === 'STATE') score += node.type === 'HUB' ? 10 : 0;

  return score;
}
