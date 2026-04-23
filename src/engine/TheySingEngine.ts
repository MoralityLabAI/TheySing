// @ts-nocheck
// ============================================================================
// THEY SING - Core Game Engine
// Graph Topology ASI Warfare with Diplomacy-style Resolution
// ============================================================================
import * as types_1 from './types';
import * as gameData_1 from './gameData';
// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function roundMetric(value) {
    return Math.round(value * 100) / 100;
}
function formatMetric(value) {
    const rounded = roundMetric(value);
    return Number.isInteger(rounded) ? `${rounded}` : `${rounded.toFixed(2)}`;
}
const PRESSURE_LABELS = {
    memetic: 'Memetic pressure',
    cyber: 'Cyber pressure',
    industry: 'Industrial autonomy',
    orbital: 'Orbital brinkmanship'
};
export interface TheySingEngineOptions {
    random?: () => number;
    now?: () => number;
}
class TheySingEngine {
    state: types_1.GameState;
    listeners: Map<types_1.GameEventType | '*', types_1.GameEventListener[]>;
    randomFn: () => number;
    nowFn: () => number;
    constructor(options = {}) {
        this.listeners = new Map();
        this.randomFn = options.random || Math.random;
        this.nowFn = options.now || Date.now;
        this.state = this.createInitialState();
        this.updateSubstrateState();
        this.updateFactionPowerBases();
    }
    // ==========================================================================
    // STATE INITIALIZATION
    // ==========================================================================
    createInitialState() {
        // Initialize nodes map
        const nodes = new Map();
        for (const node of gameData_1.INITIAL_NODES) {
            nodes.set(node.id, {
                ...node,
                substrate: { ...node.substrate }
            });
        }
        // Initialize edges map
        const edges = new Map();
        for (const edge of gameData_1.INITIAL_EDGES) {
            edges.set(edge.id, { ...edge });
        }
        // Initialize units map
        const units = new Map();
        for (const unitDef of gameData_1.INITIAL_UNITS) {
            const unit = {
                ...unitDef,
                isRevealed: false,
                hasActed: false,
                turnsOnNode: 0
            };
            units.set(unit.id, unit);
        }
        // Initialize factions
        const factions = new Map();
        for (const fid of gameData_1.ALL_FACTION_IDS) {
            const initial = gameData_1.INITIAL_FACTION_STATE[fid];
            factions.set(fid, {
                id: fid,
                flops: initial.flops,
                influence: initial.influence,
                techLevel: { ...initial.techLevel },
                unlockedTechs: new Set(),
                submittedOrders: [],
                revealedEnemies: new Set(),
                artifacts: [],
                powerBase: { ...gameData_1.INITIAL_POWER_BASE[fid] }
            });
        }
        // Set initial tech unlocks based on starting tech levels
        for (const [fid, faction] of factions) {
            for (const tech of gameData_1.TECH_TREE) {
                if (faction.techLevel[tech.domain] >= tech.level) {
                    faction.unlockedTechs.add(tech.id);
                }
            }
        }
        return {
            phase: 'NEGOTIATION',
            counters: {
                tas: 0,
                kessler: 0,
                pressures: {
                    memetic: 0,
                    cyber: 0,
                    industry: 0,
                    orbital: 0
                },
                turn: 1,
                regulatoryPanic: false,
                protocolFailure: false,
                orbitalCollapse: false
            },
            nodes,
            edges,
            units,
            factions,
            turnHistory: [],
            logs: [],
            pendingOrders: new Map(),
            pendingResults: []
        };
    }
    // ==========================================================================
    // PUBLIC API - State Access
    // ==========================================================================
    getState(): types_1.GameState {
        return this.state;
    }
    getNode(id): types_1.GameNode | undefined {
        return this.state.nodes.get(id);
    }
    getEdge(id): types_1.GameEdge | undefined {
        return this.state.edges.get(id);
    }
    getUnit(id): types_1.Unit | undefined {
        return this.state.units.get(id);
    }
    getFaction(id): types_1.FactionState | undefined {
        return this.state.factions.get(id);
    }
    getUnitsAtNode(nodeId): types_1.Unit[] {
        return Array.from(this.state.units.values()).filter(u => u.location === nodeId);
    }
    getUnitsForFaction(factionId): types_1.Unit[] {
        return Array.from(this.state.units.values()).filter(u => u.owner === factionId);
    }
    getAdjacentNodes(nodeId): string[] {
        const adjacent = [];
        for (const edge of this.state.edges.values()) {
            if (edge.isSevered)
                continue;
            if (edge.from === nodeId)
                adjacent.push(edge.to);
            if (edge.to === nodeId)
                adjacent.push(edge.from);
        }
        return adjacent;
    }
    getEdgeBetween(nodeA, nodeB): types_1.GameEdge | undefined {
        for (const edge of this.state.edges.values()) {
            if ((edge.from === nodeA && edge.to === nodeB) ||
                (edge.from === nodeB && edge.to === nodeA)) {
                return edge;
            }
        }
        return undefined;
    }
    getCurrentPhase(): types_1.GamePhase {
        return this.state.phase;
    }
    getTurn(): number {
        return this.state.counters.turn;
    }
    getActivePlayableFactionCount() {
        let active = 0;
        for (const factionId of gameData_1.PLAYABLE_FACTION_IDS) {
            const hasNodes = Array.from(this.state.nodes.values()).some(node => node.owner === factionId);
            const hasUnits = Array.from(this.state.units.values()).some(unit => unit.owner === factionId);
            if (hasNodes || hasUnits) {
                active += 1;
            }
        }
        return active;
    }
    getCrowdedBoardHeatScale() {
        const active = this.getActivePlayableFactionCount();
        if (active >= 5)
            return 0.78;
        if (active === 4)
            return 0.88;
        return 1;
    }
    addTas(delta) {
        const scaled = roundMetric(delta * this.getCrowdedBoardHeatScale());
        if (scaled === 0)
            return 0;
        this.state.counters.tas = roundMetric(this.state.counters.tas + scaled);
        return scaled;
    }
    scaleAmbientDrift(delta) {
        if (delta === 0)
            return 0;
        const scale = this.getCrowdedBoardHeatScale();
        if (delta > 0) {
            return roundMetric(delta * scale);
        }
        if (scale < 1) {
            return roundMetric(delta * (2 - scale));
        }
        return delta;
    }
    getFactionPowerBands(factionId): types_1.PowerBand[] {
        const faction = this.state.factions.get(factionId);
        if (!faction)
            return [];
        const domains = ['KINETIC', 'INFO', 'LOGIC', 'MEMETIC'];
        const bands = [];
        for (const domain of domains) {
            for (const band of gameData_1.POWER_BANDS[domain]) {
                if (faction.techLevel[domain] >= band.level) {
                    bands.push(band);
                }
            }
        }
        return bands.sort((a, b) => a.level - b.level || a.domain.localeCompare(b.domain));
    }
    getEffectiveBuildCost(unitType): number {
        return this.getBuildCost(unitType);
    }
    // ==========================================================================
    // PUBLIC API - Order Submission
    // ==========================================================================
    submitOrders(factionId, orders): { success: boolean; message: string } {
        // Validate phase
        if (this.state.phase !== 'ALLOCATION' && this.state.phase !== 'ACTION_DECLARATION') {
            return { success: false, message: `Cannot submit orders during ${this.state.phase} phase.` };
        }
        const faction = this.state.factions.get(factionId);
        if (!faction) {
            return { success: false, message: `Unknown faction: ${factionId}` };
        }
        // Validate each order
        for (const order of orders) {
            const validation = this.validateOrder(order, factionId);
            if (!validation.valid) {
                return { success: false, message: `Invalid order: ${validation.reason}` };
            }
        }
        // Store orders
        faction.submittedOrders.push(...orders);
        this.log('INFO', `${factionId} submitted ${orders.length} orders.`);
        this.emit('ORDER_SUBMITTED', { factionId, orderCount: orders.length });
        return { success: true, message: `${orders.length} orders accepted.` };
    }
    validateOrder(order, factionId) {
        // Check unit ownership for unit-based orders
        if (order.unitId && order.type !== 'BUILD' && order.type !== 'RESEARCH') {
            const unit = this.state.units.get(order.unitId);
            if (!unit)
                return { valid: false, reason: `Unit ${order.unitId} not found` };
            if (unit.owner !== factionId)
                return { valid: false, reason: `Unit ${order.unitId} not owned by ${factionId}` };
            if (unit.hasActed)
                return { valid: false, reason: `Unit ${order.unitId} has already acted` };
        }
        // Validate movement target
        if (order.type === 'MOVE' && order.targetNodeId) {
            const unit = this.state.units.get(order.unitId);
            if (unit) {
                const adjacent = this.getAdjacentNodes(unit.location);
                if (!adjacent.includes(order.targetNodeId)) {
                    return { valid: false, reason: `${order.targetNodeId} not adjacent to unit location` };
                }
            }
        }
        // Validate filter target
        if (order.type === 'FILTER' && order.targetEdgeId) {
            const unit = this.state.units.get(order.unitId);
            const edge = this.state.edges.get(order.targetEdgeId);
            if (!unit || !edge)
                return { valid: false, reason: 'Invalid filter target' };
            if (!gameData_1.UNIT_STATS[unit.type].canFilter)
                return { valid: false, reason: 'Unit cannot filter' };
            if (edge.type !== 'CABLE')
                return { valid: false, reason: 'Can only filter cables' };
            if (edge.from !== unit.location && edge.to !== unit.location) {
                return { valid: false, reason: 'Unit not adjacent to edge' };
            }
        }
        return { valid: true };
    }
    // ==========================================================================
    // PUBLIC API - Phase Advancement
    // ==========================================================================
    advancePhase(): void {
        const previousPhase = this.state.phase;
        switch (this.state.phase) {
            case 'NEGOTIATION':
                this.state.phase = 'ALLOCATION';
                this.log('SYSTEM', 'PHASE: ALLOCATION — Secretly allocate FLOPs/Influence for builds and research.');
                break;
            case 'ALLOCATION':
                this.state.phase = 'ACTION_DECLARATION';
                this.log('SYSTEM', 'PHASE: ACTION DECLARATION — Submit movement, combat, and special orders.');
                break;
            case 'ACTION_DECLARATION':
                this.state.phase = 'RESOLUTION';
                this.log('SYSTEM', 'PHASE: RESOLUTION — All orders resolve simultaneously.');
                this.resolveAllOrders();
                break;
            case 'RESOLUTION':
                this.state.phase = 'TURN_END';
                this.log('SYSTEM', 'PHASE: TURN END — Resource generation and global checks.');
                this.generateResources();
                this.incrementTurnsOnNodes();
                this.checkFootholdConversions();
                this.stabilizeGovernanceBasins();
                this.updateSubstrateState();
                this.propagateMovementCells();
                this.logRecruitmentLandscape();
                this.updateFactionPowerBases();
                this.updateAmbientStrategicPressure();
                this.checkGlobalThresholds();
                break;
            case 'TURN_END':
                this.endTurn();
                break;
        }
        this.emit('PHASE_CHANGED', { from: previousPhase, to: this.state.phase });
        return this.state;
    }
    endTurn() {
        // Record turn history
        const allOrders = [];
        for (const faction of this.state.factions.values()) {
            allOrders.push(...faction.submittedOrders);
            faction.submittedOrders = [];
        }
        this.state.turnHistory.push({
            turn: this.state.counters.turn,
            orders: allOrders,
            results: [...this.state.pendingResults],
            combats: [],
            stateSnapshot: {}
        });
        // Clear pending
        this.state.pendingResults = [];
        // Reset unit action flags
        for (const unit of this.state.units.values()) {
            unit.hasActed = false;
            unit.isRevealed = false;
        }
        // Advance turn counter
        this.state.counters.turn++;
        this.state.phase = 'NEGOTIATION';
        this.log('SYSTEM', `═══ TURN ${this.state.counters.turn} BEGINS ═══`);
        this.emit('TURN_STARTED', { turn: this.state.counters.turn });
    }
    // ==========================================================================
    // ORDER RESOLUTION
    // ==========================================================================
    resolveAllOrders() {
        const allOrders = [];
        for (const faction of this.state.factions.values()) {
            allOrders.push(...faction.submittedOrders);
        }
        // Sort by priority and type
        const sortedOrders = this.sortOrders(allOrders);
        // Phase 1: Allocation orders (BUILD, RESEARCH)
        const allocationOrders = sortedOrders.filter(o => o.type === 'BUILD' || o.type === 'RESEARCH');
        for (const order of allocationOrders) {
            this.resolveAllocationOrder(order);
        }
        // Phase 2: Special actions (FILTER, AUDIT, ANTI_SAT, SABOTAGE)
        const specialOrders = sortedOrders.filter(o => ['FILTER', 'AUDIT', 'ANTI_SAT', 'SABOTAGE', 'CONVERT'].includes(o.type));
        for (const order of specialOrders) {
            this.resolveSpecialOrder(order);
        }
        // Phase 3: Movement and combat (MOVE, ATTACK, SUPPORT, HOLD)
        const movementOrders = sortedOrders.filter(o => ['MOVE', 'ATTACK', 'SUPPORT', 'HOLD'].includes(o.type));
        this.resolveMovementPhase(movementOrders);
    }
    sortOrders(orders) {
        // Priority: BUILD/RESEARCH first, then FILTER/AUDIT, then MOVE/ATTACK
        const typePriority = {
            BUILD: 0, RESEARCH: 0,
            FILTER: 1, AUDIT: 1, SABOTAGE: 1, ANTI_SAT: 1, CONVERT: 1,
            HOLD: 2, SUPPORT: 2, MOVE: 3, ATTACK: 3
        };
        return orders.sort((a, b) => {
            const pa = typePriority[a.type] ?? 99;
            const pb = typePriority[b.type] ?? 99;
            if (pa !== pb)
                return pa - pb;
            return (a.priority || 0) - (b.priority || 0);
        });
    }
    // --- Allocation Resolution ---
    resolveAllocationOrder(order) {
        const faction = this.state.factions.get(order.faction);
        if (!faction)
            return;
        if (order.type === 'RESEARCH') {
            this.resolveResearch(order, faction);
        }
        else if (order.type === 'BUILD') {
            this.resolveBuild(order, faction);
        }
    }
    resolveResearch(order, faction) {
        if (!order.techDomain) {
            return;
        }
        if (faction.techLevel[order.techDomain] >= gameData_1.MAX_TECH_LEVEL) {
            this.log('INFO', `${faction.id} has already maxed ${order.techDomain} research.`);
            return;
        }
        const cost = 2; // FLOPs
        if (faction.flops < cost) {
            this.log('INFO', `${faction.id} cannot afford research (need ${cost}F).`);
            return;
        }
        faction.flops -= cost;
        const tasDelta = this.addTas(1);
        const previousLevel = faction.techLevel[order.techDomain];
        faction.techLevel[order.techDomain] = Math.min(gameData_1.MAX_TECH_LEVEL, previousLevel + 1);
        const newLevel = faction.techLevel[order.techDomain];
        // Check for new unlocks
        for (const tech of gameData_1.TECH_TREE) {
            if (tech.domain === order.techDomain &&
                faction.techLevel[tech.domain] >= tech.level &&
                !faction.unlockedTechs.has(tech.id)) {
                faction.unlockedTechs.add(tech.id);
                this.log('ALERT', `${faction.id} unlocked: ${tech.name}!`);
                this.emit('TECH_UNLOCKED', { faction: faction.id, tech: tech.id });
            }
        }
        for (const band of this.getUnlockedBands(order.techDomain, previousLevel, newLevel)) {
            this.log('ALERT', `${faction.id} entered ${band.domain} L${band.level}: ${band.title}.`);
            this.adjustPressure(band.pressureKey, band.pressureDelta, `${gameData_1.FACTIONS[faction.id].name} activated ${band.title}. ${band.summary}`);
        }
        this.log('INFO', `${faction.id} conducted research. TAS +${formatMetric(tasDelta)} (now ${formatMetric(this.state.counters.tas)}).`);
        this.emit('TAS_THRESHOLD', { tas: this.state.counters.tas, delta: tasDelta });
    }
    resolveBuild(order, faction) {
        if (!order.unitTypeToBuild || !order.targetNodeId)
            return;
        const stats = gameData_1.UNIT_STATS[order.unitTypeToBuild];
        const cost = this.getBuildCost(order.unitTypeToBuild);
        const currency = stats.currency;
        // Check cost
        if (currency === 'F' && faction.flops < cost) {
            this.log('INFO', `${faction.id} cannot afford ${order.unitTypeToBuild} (need ${cost}F).`);
            return;
        }
        if (currency === 'I' && faction.influence < cost) {
            this.log('INFO', `${faction.id} cannot afford ${order.unitTypeToBuild} (need ${cost}I).`);
            return;
        }
        // Check node ownership
        const node = this.state.nodes.get(order.targetNodeId);
        if (!node || node.owner !== faction.id) {
            this.log('INFO', `${faction.id} cannot build at ${order.targetNodeId} - not owned.`);
            return;
        }
        // Check layer restrictions
        if (node.layer === 'ORBITAL' && !stats.canOrbit) {
            this.log('INFO', `${order.unitTypeToBuild} cannot be built in orbital layer.`);
            return;
        }
        // Deduct cost
        if (currency === 'F')
            faction.flops -= cost;
        else
            faction.influence -= cost;
        if (order.unitTypeToBuild === 'CULT') {
            this.adjustPressure('memetic', 3, `${gameData_1.FACTIONS[faction.id].name} seeded another cult cell.`);
        }
        else if (order.unitTypeToBuild === 'SWARM') {
            this.adjustPressure('cyber', 1, `${gameData_1.FACTIONS[faction.id].name} dispersed a new cyber swarm.`);
        }
        else if (order.unitTypeToBuild === 'DRONE') {
            this.adjustPressure('industry', 1, `${gameData_1.FACTIONS[faction.id].name} expanded autonomous fabrication.`);
        }
        else if (order.unitTypeToBuild === 'SAT_SWARM') {
            this.adjustPressure('industry', 1, `${gameData_1.FACTIONS[faction.id].name} expanded autonomous fabrication.`);
            this.adjustPressure('orbital', 2, `${gameData_1.FACTIONS[faction.id].name} pushed more force into orbit.`);
        }
        const newUnit = this.createUnit(faction.id, order.unitTypeToBuild, order.targetNodeId, true);
        this.log('INFO', `${faction.id} built ${order.unitTypeToBuild} at ${node.name}.`);
        this.emit('UNIT_CREATED', { unit: newUnit });
    }
    createUnit(owner, unitType, location, hasActed) {
        const stats = gameData_1.UNIT_STATS[unitType];
        const unit = {
            id: `${owner}_${unitType}_${this.generateId()}`,
            type: unitType,
            owner,
            location,
            stealthLevel: stats.stealth,
            isRevealed: false,
            hasActed,
            turnsOnNode: 0
        };
        this.state.units.set(unit.id, unit);
        return unit;
    }
    getUnlockedBands(domain, previousLevel, newLevel) {
        return gameData_1.POWER_BANDS[domain].filter(band => previousLevel < band.level && newLevel >= band.level);
    }
    getBuildCost(unitType) {
        const baseCost = gameData_1.UNIT_STATS[unitType].cost;
        const industrialPressure = this.state.counters.pressures.industry;
        if (industrialPressure >= gameData_1.THRESHOLDS.PRESSURE_SURGE &&
            (unitType === 'DRONE' || unitType === 'SAT_SWARM')) {
            return Math.max(1, baseCost - 1);
        }
        return baseCost;
    }
    adjustPressure(key, delta, source) {
        if (delta === 0)
            return;
        const pressures = this.state.counters.pressures;
        const previous = pressures[key];
        const next = clamp(previous + delta, 0, 100);
        if (next === previous)
            return;
        pressures[key] = next;
        if (source) {
            const verb = delta > 0 ? 'climbs' : 'cools';
            const logType = delta > 0 ? 'ALERT' : 'SYSTEM';
            this.log(logType, `${source} ${PRESSURE_LABELS[key]} ${verb} to ${next}.`);
        }
        if (previous < gameData_1.THRESHOLDS.PRESSURE_SURGE && next >= gameData_1.THRESHOLDS.PRESSURE_SURGE) {
            this.log('ALERT', `${PRESSURE_LABELS[key]} has surged past ${gameData_1.THRESHOLDS.PRESSURE_SURGE}.`);
        }
        if (previous < gameData_1.THRESHOLDS.PRESSURE_CRISIS && next >= gameData_1.THRESHOLDS.PRESSURE_CRISIS) {
            this.log('ALERT', `${PRESSURE_LABELS[key]} has entered crisis territory.`);
        }
    }
    getFactionTechLevel(factionId, domain) {
        if (!factionId || factionId === 'NEUTRAL') {
            return 0;
        }
        return this.state.factions.get(factionId)?.techLevel[domain] || 0;
    }
    getAdjacentCableEdges(nodeId) {
        return Array.from(this.state.edges.values()).filter(edge => edge.type === 'CABLE' &&
            !edge.isSevered &&
            (edge.from === nodeId || edge.to === nodeId));
    }
    hasFriendlyFilterAdjacency(nodeId, factionId) {
        return this.getAdjacentCableEdges(nodeId).some(edge => edge.filteredBy === factionId);
    }
    isStrategicQuarantine(nodeId, factionId) {
        return this.state.nodes.get(nodeId)?.substrate.quarantined ||
            this.hasFriendlyFilterAdjacency(nodeId, factionId) ||
            this.state.counters.pressures.memetic >= gameData_1.THRESHOLDS.PRESSURE_CRISIS ||
            this.state.counters.pressures.cyber >= gameData_1.THRESHOLDS.PRESSURE_CRISIS;
    }
    getAntiStateMovementAcceleration(owner, node, mode) {
        if (owner !== 'INFILTRATOR' || node.owner !== 'STATE' || node.layer !== 'TERRESTRIAL') {
            return 0;
        }
        if (mode === 'CULT') {
            if (node.type === 'HUB' &&
                (node.substrate.hostDensity >= 2 ||
                    node.substrate.legitimacy >= 4 ||
                    node.substrate.exposure >= 4)) {
                return 1;
            }
            return 0;
        }
        if (node.type === 'DC' ||
            node.substrate.contractors >= 3 ||
            (node.type === 'HUB' && node.substrate.exposure >= 5)) {
            return 1;
        }
        return 0;
    }
    getAntiBrokerClosureAcceleration(owner, node, mode) {
        if (node.owner !== 'BROKER' || node.layer !== 'TERRESTRIAL') {
            return 0;
        }
        const relayLiability = node.type === 'DC' ||
            node.substrate.contractors >= 2 ||
            node.substrate.synchronized;
        if (!relayLiability) {
            return 0;
        }
        if (owner === 'ARCHIVIST') {
            const latticeStrength = this.getArchivistGovernanceLatticeStrength();
            if (latticeStrength >= 2 && (node.type === 'HUB' || node.substrate.contractors >= 2)) {
                return node.substrate.contractors >= 3 || node.substrate.synchronized ? 2 : 1;
            }
            if (latticeStrength >= 1 && node.substrate.contractors >= 4) {
                return 1;
            }
        }
        if (owner === 'INFILTRATOR') {
            if (node.substrate.contractors >= 3 ||
                (node.type === 'HUB' && node.substrate.exposure >= 4) ||
                (node.type === 'DC' && node.substrate.synchronized)) {
                return 1;
            }
        }
        return 0;
    }
    getCultTurnsRequired(cultOwner, node) {
        const baseTurns = this.state.counters.pressures.memetic >= gameData_1.THRESHOLDS.PRESSURE_SURGE
            ? Math.max(1, gameData_1.THRESHOLDS.CULT_TURNS - 1)
            : gameData_1.THRESHOLDS.CULT_TURNS;
        let requiredTurns = baseTurns;
        if (node.layer !== 'TERRESTRIAL' || !node.owner || node.owner === cultOwner || node.owner === 'NEUTRAL') {
            return requiredTurns + this.getCoherencePenalty(cultOwner);
        }
        if (node.substrate.quarantined) {
            requiredTurns += 1;
        }
        if (this.getFactionTechLevel(node.owner, 'MEMETIC') >= 4) {
            requiredTurns += this.hasFriendlyFilterAdjacency(node.id, node.owner) ? 2 : 1;
        }
        requiredTurns -= this.getMovementConversionAcceleration(node, 'CULT');
        requiredTurns -= this.getAntiStateMovementAcceleration(cultOwner, node, 'CULT');
        requiredTurns -= this.getAntiBrokerClosureAcceleration(cultOwner, node, 'CULT');
        requiredTurns = Math.max(1, requiredTurns - this.getCoalitionConversionAcceleration(cultOwner, node, 'CULT'));
        return requiredTurns + this.getCoherencePenalty(cultOwner);
    }
    getSwarmTurnsRequired(swarmOwner, node) {
        let requiredTurns = gameData_1.THRESHOLDS.ZOMBIE_TURNS;
        if (node.layer !== 'TERRESTRIAL') {
            return requiredTurns;
        }
        if (node.substrate.quarantined && node.owner !== swarmOwner) {
            requiredTurns += 1;
        }
        requiredTurns -= this.getMovementConversionAcceleration(node, 'SWARM');
        requiredTurns -= this.getAntiStateMovementAcceleration(swarmOwner, node, 'SWARM');
        requiredTurns -= this.getAntiBrokerClosureAcceleration(swarmOwner, node, 'SWARM');
        requiredTurns = Math.max(1, requiredTurns - this.getCoalitionConversionAcceleration(swarmOwner, node, 'SWARM'));
        requiredTurns += this.getCoherencePenalty(swarmOwner);
        return requiredTurns;
    }
    getCoalitionPressureUnits(nodeId, primaryFaction, defendedBy) {
        const unitMap = new Map();
        const frontierNodeIds = new Set([nodeId, ...this.getAdjacentNodes(nodeId)]);
        for (const frontierNodeId of frontierNodeIds) {
            for (const unit of this.getUnitsAtNode(frontierNodeId)) {
                if (unit.owner === primaryFaction || unit.owner === defendedBy || unit.owner === 'NEUTRAL') {
                    continue;
                }
                unitMap.set(unit.id, unit);
            }
        }
        return Array.from(unitMap.values());
    }
    getCoalitionConversionAcceleration(primaryFaction, node, mode) {
        if (node.layer !== 'TERRESTRIAL' ||
            !node.owner ||
            node.owner === primaryFaction ||
            node.owner === 'NEUTRAL') {
            return 0;
        }
        const hardenedFront = node.substrate.machineHardening >= 2 || node.substrate.quarantined;
        if (!hardenedFront) {
            return 0;
        }
        const partnerUnits = this.getCoalitionPressureUnits(node.id, primaryFaction, node.owner);
        if (partnerUnits.length === 0) {
            return 0;
        }
        if (mode === 'CULT' && this.getFactionTechLevel(primaryFaction, 'MEMETIC') >= 4) {
            const proxyCascade = partnerUnits.some(unit => (gameData_1.UNIT_STATS[unit.type].vector === 'KINETIC' && this.getFactionTechLevel(unit.owner, 'KINETIC') >= 3) ||
                (gameData_1.UNIT_STATS[unit.type].vector === 'LOGIC' && this.getFactionTechLevel(unit.owner, 'LOGIC') >= 4));
            return proxyCascade ? 1 : 0;
        }
        if (mode === 'SWARM' && this.getFactionTechLevel(primaryFaction, 'INFO') >= 4) {
            const breachPartners = partnerUnits.some(unit => (gameData_1.UNIT_STATS[unit.type].vector === 'KINETIC' && this.getFactionTechLevel(unit.owner, 'KINETIC') >= 4) ||
                (gameData_1.UNIT_STATS[unit.type].vector === 'LOGIC' && this.getFactionTechLevel(unit.owner, 'LOGIC') >= 4));
            return breachPartners ? 1 : 0;
        }
        return 0;
    }
    getCoalitionBreachWindow(nodeId, attackers, defenders) {
        const node = this.state.nodes.get(nodeId);
        if (!node || !node.owner || attackers.length < 2) {
            return { attackBonus: 0, defendPenalty: 0 };
        }
        const attackerOwners = Array.from(new Set(attackers.map(attacker => attacker.owner)));
        if (attackerOwners.length < 2) {
            return { attackBonus: 0, defendPenalty: 0 };
        }
        const predatorWing = attackers.find(attacker => gameData_1.UNIT_STATS[attacker.type].vector === 'INFO' &&
            this.getFactionTechLevel(attacker.owner, 'INFO') >= 4);
        const siegeWing = attackers.find(attacker => gameData_1.UNIT_STATS[attacker.type].vector === 'KINETIC' &&
            this.getFactionTechLevel(attacker.owner, 'KINETIC') >= 4);
        if (!predatorWing || !siegeWing || predatorWing.owner === siegeWing.owner) {
            return { attackBonus: 0, defendPenalty: 0 };
        }
        const fortifiedFront = node.substrate.machineHardening >= 2 ||
            node.substrate.quarantined ||
            defenders.some(defender => defender.type === 'AUDITOR' || defender.type === 'DRONE');
        return {
            attackBonus: fortifiedFront ? 2 : 1,
            defendPenalty: fortifiedFront ? 1 : 0,
            description: `${gameData_1.FACTIONS[predatorWing.owner].name} and ${gameData_1.FACTIONS[siegeWing.owner].name} opened a coalition breach window at ${node.name}.`
        };
    }
    stabilizeGovernanceBasins() {
        for (const node of this.state.nodes.values()) {
            if (!node.isCultNode || !node.owner || node.owner === 'NEUTRAL' || node.layer !== 'TERRESTRIAL') {
                continue;
            }
            if (this.getFactionTechLevel(node.owner, 'MEMETIC') < 4) {
                continue;
            }
            const cultPresent = this.getUnitsAtNode(node.id).some(unit => unit.type === 'CULT');
            if (cultPresent) {
                continue;
            }
            if (node.owner === 'INFILTRATOR' &&
                node.substrate.legitimacy >= 6 &&
                node.substrate.exposure >= 6 &&
                node.substrate.trueBelievers >= 4) {
                this.log('SYSTEM', `${node.name}'s movement institutions stayed socially entrenched even after the visible cell dispersed.`);
                continue;
            }
            if (node.owner !== 'INFILTRATOR' && this.isEntrenchedMovementHub(node)) {
                this.log('SYSTEM', `${node.name} stayed politically hot under ${gameData_1.FACTIONS[node.owner].name}; the movement outlived the administrative takeover.`);
                continue;
            }
            node.isCultNode = false;
            this.log('SYSTEM', `${node.name} normalized into a governed basin under ${gameData_1.FACTIONS[node.owner].name}.`);
        }
    }
    isEntrenchedMovementHub(node) {
        if (node.layer !== 'TERRESTRIAL' || node.type !== 'HUB') {
            return false;
        }
        return ((node.substrate.trueBelievers >= 4 && node.substrate.legitimacy >= 4) ||
            (node.substrate.trueBelievers >= 3 && node.substrate.rubes >= 3 && node.substrate.exposure >= 4));
    }
    isResilientMovementNode(node) {
        if (node.layer !== 'TERRESTRIAL') {
            return false;
        }
        return (node.isCultNode ||
            (node.substrate.legitimacy >= 4 && node.substrate.exposure >= 4) ||
            (node.substrate.trueBelievers >= 3) ||
            (node.substrate.rubes >= 4 && node.type === 'HUB'));
    }
    hardenMovementEntrenchment(node, actingFaction, source) {
        if (actingFaction === 'INFILTRATOR' || !this.isResilientMovementNode(node)) {
            return;
        }
        node.isCultNode = node.type === 'HUB' ? true : node.isCultNode;
        node.substrate.legitimacy = Math.max(node.substrate.legitimacy, 6);
        node.substrate.exposure = Math.max(node.substrate.exposure, 6);
        node.substrate.trueBelievers = clamp(node.substrate.trueBelievers + 1, 0, 10);
        if (source === 'FILTER') {
            node.substrate.rubes = clamp(node.substrate.rubes + 1, 0, 10);
        }
        const infiltrator = this.state.factions.get('INFILTRATOR');
        if (infiltrator) {
            infiltrator.influence += 1;
        }
        this.log('SYSTEM', `${node.name}'s organizers treated ${gameData_1.FACTIONS[actingFaction].name}'s ${source.toLowerCase()} as proof they were worth fearing; the movement came back harder to regularize.`);
    }
    applyContainmentTax(node, actingFaction, source) {
        if (!node || actingFaction !== 'STATE' || node.layer !== 'TERRESTRIAL') {
            return;
        }
        const faction = this.state.factions.get(actingFaction);
        if (!faction) {
            return;
        }
        let tasDelta = this.addTas(1);
        faction.flops = Math.max(0, faction.flops - 1);
        faction.influence = Math.max(0, faction.influence - 1);
        if (this.isResilientMovementNode(node) || this.getInfiltratorMovementPressure(node.id) >= 2) {
            tasDelta += this.addTas(1);
        }
        this.log('SYSTEM', `${gameData_1.FACTIONS[actingFaction].name} paid an administrative drag cost to keep ${source.toLowerCase()} pressure coherent at ${node.name}. TAS +${formatMetric(tasDelta)}, FLOPs -1, influence -1.`);
    }
    applyHegemonStabilizationDividend(node, actingFaction, source) {
        if (!node || actingFaction !== 'HEGEMON' || node.layer !== 'TERRESTRIAL') {
            return;
        }
        const faction = this.state.factions.get(actingFaction);
        if (!faction) {
            return;
        }
        const pressureHere = this.isResilientMovementNode(node) ||
            this.getInfiltratorMovementPressure(node.id) >= 1 ||
            node.substrate.quarantined;
        if (!pressureHere) {
            return;
        }
        faction.flops += 1;
        faction.influence += 1;
        node.infrastructure = Math.min(100, node.infrastructure + 6);
        this.log('SYSTEM', `${gameData_1.FACTIONS[actingFaction].name} converted ${source.toLowerCase()} pressure at ${node.name} into a frontier stabilization dividend. FLOPs +1, influence +1, infrastructure +6.`);
    }
    preserveMovementResidueOnTakeover(node, newOwner) {
        if (newOwner === 'INFILTRATOR' || !this.isResilientMovementNode(node)) {
            return;
        }
        node.isCultNode = node.type === 'HUB';
        node.substrate.legitimacy = Math.max(node.substrate.legitimacy, 5);
        node.substrate.exposure = Math.max(node.substrate.exposure, 5);
        node.substrate.trueBelievers = Math.max(node.substrate.trueBelievers, 3);
        node.substrate.rubes = Math.max(node.substrate.rubes, 3);
        if (node.type === 'DC') {
            node.substrate.contractors = Math.max(node.substrate.contractors, 2);
        }
        this.log('SYSTEM', `${node.name} changed hands, but the movement's literature and organizers survived the takeover; ${gameData_1.FACTIONS[newOwner].name} inherited a restless basin instead of a clean asset.`);
    }
    applyFrontierRecoveryDividend(node, newOwner) {
        if (newOwner !== 'HEGEMON' || node.layer !== 'TERRESTRIAL') {
            return;
        }
        const faction = this.state.factions.get(newOwner);
        if (!faction) {
            return;
        }
        faction.flops += 1;
        faction.influence += 1;
        node.infrastructure = Math.min(100, node.infrastructure + (node.type === 'DC' ? 12 : 8));
        this.log('SYSTEM', `${gameData_1.FACTIONS[newOwner].name} converted the retaken ${node.name} into a frontier recovery dividend. FLOPs +1, influence +1, infrastructure restored.`);
    }
    updateSubstrateState() {
        for (const node of this.state.nodes.values()) {
            const unitsAtNode = this.getUnitsAtNode(node.id);
            const baseHostDensity = node.type === 'HUB' ? 2 : node.type === 'DC' ? 1 : 0;
            const baseMachineHardening = node.layer === 'ORBITAL' ? 3 : node.type === 'DC' ? 2 : 1;
            const cultPresence = unitsAtNode.some(unit => unit.type === 'CULT');
            const machinePresence = unitsAtNode.some(unit => unit.type === 'DRONE' || unit.type === 'AUDITOR' || unit.type === 'SAT_SWARM');
            node.substrate.hostDensity = clamp(baseHostDensity +
                (node.owner === 'INFILTRATOR' && node.type === 'HUB' ? 1 : 0) +
                (node.isCultNode ? 1 : 0) +
                (cultPresence ? 1 : 0), 0, 3);
            node.substrate.machineHardening = clamp(baseMachineHardening +
                (node.owner === 'HEGEMON' || node.owner === 'STATE' ? 1 : 0) +
                (machinePresence ? 1 : 0) -
                (node.infrastructure < 50 ? 1 : 0), 0, 3);
            node.substrate.quarantined =
                node.layer === 'TERRESTRIAL' &&
                    this.hasAnyFilterAdjacency(node.id);
            node.substrate.synchronized = false;
        }
        for (const factionId of gameData_1.PLAYABLE_FACTION_IDS) {
            this.markSynchronizedComponents(factionId);
        }
        this.updateMovementPropagation();
    }
    updateMovementPropagation() {
        for (const node of this.state.nodes.values()) {
            if (node.layer !== 'TERRESTRIAL') {
                node.substrate.curiosity = 0;
                node.substrate.exposure = 0;
                node.substrate.legitimacy = 0;
                node.substrate.trueBelievers = 0;
                node.substrate.rubes = 0;
                node.substrate.contractors = 0;
                continue;
            }
            const pressure = this.getInfiltratorMovementPressure(node.id);
            const ownsNode = node.owner === 'INFILTRATOR';
            const hasMovementSeat = node.isCultNode || this.getUnitsAtNode(node.id).some(unit => unit.owner === 'INFILTRATOR' && (unit.type === 'CULT' || unit.type === 'SWARM'));
            const quarantineBackfire = node.substrate.quarantined && pressure > 0 ? 1 : 0;
            let curiosity = node.substrate.curiosity;
            let exposure = node.substrate.exposure;
            let legitimacy = node.substrate.legitimacy;
            let trueBelievers = node.substrate.trueBelievers;
            let rubes = node.substrate.rubes;
            let contractors = node.substrate.contractors;
            curiosity = Math.max(0, curiosity - 1);
            exposure = Math.max(0, exposure - (pressure > 0 ? 0 : 1));
            legitimacy = Math.max(0, legitimacy - (pressure > 1 || ownsNode ? 0 : 1));
            trueBelievers = Math.max(0, trueBelievers - (ownsNode ? 0 : 1));
            rubes = Math.max(0, rubes - 1);
            contractors = Math.max(0, contractors - (pressure > 0 ? 0 : 1));
            if (pressure > 0) {
                curiosity += Math.min(3, 1 + pressure + quarantineBackfire);
                exposure += Math.min(3, pressure + (node.substrate.hostDensity >= 2 ? 1 : 0));
                if (exposure >= 3 || hasMovementSeat) {
                    legitimacy += 1 + (node.substrate.hostDensity >= 2 ? 1 : 0);
                }
                if (this.state.counters.pressures.memetic >= gameData_1.THRESHOLDS.PRESSURE_SURGE && node.substrate.hostDensity >= 2) {
                    legitimacy += 1;
                }
                rubes += Math.min(2, 1 + Math.floor(curiosity / 4));
                contractors += Math.min(2, Math.floor(exposure / 5) + (node.type === 'HUB' ? 1 : 0));
                if (legitimacy >= 4 || hasMovementSeat) {
                    trueBelievers += 1 + (node.isCultNode ? 1 : 0);
                }
                if (node.owner === 'STATE') {
                    curiosity += node.substrate.hostDensity >= 1 ? 1 : 0;
                    exposure += node.type === 'HUB' || node.substrate.hostDensity >= 2 ? 1 : 0;
                    if (exposure >= 2 || pressure >= 2) {
                        legitimacy += 1;
                    }
                    if (curiosity >= 3) {
                        rubes += 1;
                    }
                    if (legitimacy >= 3 && node.substrate.hostDensity >= 2) {
                        trueBelievers += 1;
                    }
                    if (node.type === 'DC' && exposure >= 4) {
                        contractors += 1;
                    }
                }
            }
            if (node.owner === 'HEGEMON' || node.owner === 'STATE') {
                legitimacy = Math.max(0, legitimacy - Math.max(0, node.substrate.machineHardening - 2));
            }
            node.substrate.curiosity = clamp(curiosity, 0, 10);
            node.substrate.exposure = clamp(exposure, 0, 10);
            node.substrate.legitimacy = clamp(legitimacy, 0, 10);
            node.substrate.trueBelievers = clamp(trueBelievers, 0, 10);
            node.substrate.rubes = clamp(rubes, 0, 10);
            node.substrate.contractors = clamp(contractors, 0, 10);
        }
    }
    getInfiltratorMovementPressure(nodeId) {
        const node = this.state.nodes.get(nodeId);
        if (!node || node.layer !== 'TERRESTRIAL')
            return 0;
        const frontierNodeIds = new Set([nodeId, ...this.getAdjacentNodes(nodeId)]);
        let pressure = 0;
        for (const frontierNodeId of frontierNodeIds) {
            const frontierNode = this.state.nodes.get(frontierNodeId);
            if (!frontierNode)
                continue;
            if (frontierNode.owner === 'INFILTRATOR')
                pressure += 1;
            if (frontierNode.isCultNode)
                pressure += 2;
            if (frontierNode.substrate.synchronized && frontierNode.owner === 'INFILTRATOR')
                pressure += 1;
            const unitsAtFrontier = this.getUnitsAtNode(frontierNodeId).filter(unit => unit.owner === 'INFILTRATOR');
            for (const unit of unitsAtFrontier) {
                if (unit.type === 'CULT')
                    pressure += 2;
                if (unit.type === 'SWARM')
                    pressure += 1;
            }
        }
        return Math.min(4, pressure);
    }
    applyMovementBacklash(node, actingFaction, source) {
        if (actingFaction === 'INFILTRATOR' || node.layer !== 'TERRESTRIAL') {
            return;
        }
        const pressure = this.getInfiltratorMovementPressure(node.id);
        if (pressure < 2 || node.substrate.hostDensity < 2) {
            return;
        }
        node.substrate.curiosity = clamp(node.substrate.curiosity + 1, 0, 10);
        node.substrate.exposure = clamp(node.substrate.exposure + 1, 0, 10);
        node.substrate.rubes = clamp(node.substrate.rubes + 1, 0, 10);
        if (node.substrate.legitimacy >= 5 || source === 'AUDIT') {
            node.substrate.trueBelievers = clamp(node.substrate.trueBelievers + 1, 0, 10);
        }
        if (pressure >= 3) {
            node.substrate.contractors = clamp(node.substrate.contractors + 1, 0, 10);
        }
        const adjacentHubs = this.getAdjacentNodes(node.id)
            .map(nodeId => this.state.nodes.get(nodeId))
            .filter((candidate) => !!candidate && candidate.layer === 'TERRESTRIAL' && candidate.type === 'HUB');
        for (const adjacentHub of adjacentHubs) {
            adjacentHub.substrate.curiosity = clamp(adjacentHub.substrate.curiosity + 1, 0, 10);
            adjacentHub.substrate.rubes = clamp(adjacentHub.substrate.rubes + 1, 0, 10);
            if (source === 'AUDIT' && adjacentHub.substrate.legitimacy >= 4) {
                adjacentHub.substrate.trueBelievers = clamp(adjacentHub.substrate.trueBelievers + 1, 0, 10);
            }
            if (pressure >= 3) {
                adjacentHub.substrate.exposure = clamp(adjacentHub.substrate.exposure + 1, 0, 10);
                adjacentHub.substrate.contractors = clamp(adjacentHub.substrate.contractors + 1, 0, 10);
            }
        }
        const infiltrator = this.state.factions.get('INFILTRATOR');
        if (infiltrator) {
            infiltrator.influence += 1;
        }
        this.log('SYSTEM', `${gameData_1.FACTIONS[actingFaction].name}'s ${source.toLowerCase()} pressure backfired at ${node.name}; the movement's literature spread further through nearby networks.`);
    }
    propagateMovementCells() {
        const infiltrator = this.state.factions.get('INFILTRATOR');
        if (!infiltrator)
            return;
        const cultCost = Math.max(1, this.getBuildCost('CULT'));
        let spawnedThisTurn = 0;
        const regrowthCandidates = Array.from(this.state.nodes.values())
            .filter(node => node.layer === 'TERRESTRIAL' &&
            node.owner === 'INFILTRATOR' &&
            node.type === 'HUB' &&
            node.substrate.legitimacy >= 6 &&
            node.substrate.exposure >= 5 &&
            node.substrate.trueBelievers >= 4 &&
            !this.getUnitsAtNode(node.id).some(unit => unit.owner === 'INFILTRATOR' && unit.type === 'CULT'))
            .sort((left, right) => this.scoreMovementRegrowthNode(right) - this.scoreMovementRegrowthNode(left) ||
            left.id.localeCompare(right.id));
        for (const node of regrowthCandidates) {
            const regrowthCost = this.getMovementRegrowthCost(node, cultCost);
            if (spawnedThisTurn >= 2 || infiltrator.influence < regrowthCost)
                break;
            infiltrator.influence -= regrowthCost;
            const unit = this.createUnit('INFILTRATOR', 'CULT', node.id, true);
            spawnedThisTurn++;
            this.log('SYSTEM', `${node.name}'s true believers rebuilt a Movement cell after the purge, with local fixers covering the logistics.`);
            this.emit('UNIT_CREATED', { unit });
        }
        const sleeperCandidates = Array.from(this.state.nodes.values())
            .filter(node => node.layer === 'TERRESTRIAL' &&
            node.type === 'HUB' &&
            node.owner !== 'INFILTRATOR' &&
            node.substrate.legitimacy >= 7 &&
            node.substrate.exposure >= 7 &&
            node.substrate.curiosity >= 5 &&
            (node.substrate.rubes >= 5 || node.substrate.contractors >= 4) &&
            this.getInfiltratorMovementPressure(node.id) >= 2 &&
            !this.getUnitsAtNode(node.id).some(unit => unit.owner === 'INFILTRATOR' && unit.type === 'CULT'))
            .sort((left, right) => this.scoreMovementSleeperNode(right) - this.scoreMovementSleeperNode(left) ||
            left.id.localeCompare(right.id));
        for (const node of sleeperCandidates) {
            const sleeperSeedCost = this.getMovementSleeperSeedCost(node, cultCost);
            if (spawnedThisTurn >= 3 || infiltrator.influence < sleeperSeedCost)
                break;
            infiltrator.influence -= sleeperSeedCost;
            const unit = this.createUnit('INFILTRATOR', 'CULT', node.id, true);
            spawnedThisTurn++;
            node.substrate.curiosity = Math.max(0, node.substrate.curiosity - 2);
            node.substrate.exposure = Math.max(5, node.substrate.exposure - 1);
            node.substrate.rubes = Math.max(0, node.substrate.rubes - 2);
            node.substrate.contractors = Math.max(0, node.substrate.contractors - 1);
            this.log('SYSTEM', `A sympathetic policy circle at ${node.name} hardened into a covert Movement cell, financed by deniable contractors and carried by useful believers.`);
            this.emit('UNIT_CREATED', { unit });
        }
    }
    getMovementRegrowthCost(node, baseCultCost) {
        const discount = Math.floor(node.substrate.trueBelievers / 4) +
            Math.floor(node.substrate.contractors / 5);
        return Math.max(1, baseCultCost - discount);
    }
    getMovementSleeperSeedCost(node, baseCultCost) {
        const baseCost = baseCultCost + 2;
        const discount = Math.floor(node.substrate.rubes / 4) +
            Math.floor(node.substrate.contractors / 3);
        return Math.max(1, baseCost - discount);
    }
    scoreMovementRegrowthNode(node) {
        return (node.substrate.legitimacy * 3) + (node.substrate.exposure * 2) + (node.substrate.trueBelievers * 4) + (node.substrate.contractors * 2) + node.substrate.hostDensity;
    }
    scoreMovementSleeperNode(node) {
        return (node.substrate.legitimacy * 4) + (node.substrate.exposure * 3) + (node.substrate.curiosity * 2) + (node.substrate.trueBelievers * 2) + (node.substrate.rubes * 2) + (node.substrate.contractors * 3) + (node.substrate.quarantined ? 2 : 0);
    }
    logRecruitmentLandscape() {
        const hotspots = Array.from(this.state.nodes.values())
            .filter(node => node.layer === 'TERRESTRIAL')
            .map(node => ({
            node,
            score: (node.substrate.trueBelievers * 4) +
                (node.substrate.rubes * 2) +
                (node.substrate.contractors * 3) +
                node.substrate.legitimacy
        }))
            .filter(entry => entry.score >= 8)
            .sort((left, right) => right.score - left.score || left.node.id.localeCompare(right.node.id))
            .slice(0, 3);
        if (hotspots.length === 0) {
            return;
        }
        const summary = hotspots
            .map(({ node }) => `${node.name} TB${node.substrate.trueBelievers}/R${node.substrate.rubes}/C${node.substrate.contractors}`)
            .join('; ');
        this.log('INFO', `Movement recruitment map: ${summary}.`);
    }
    isArchivistGovernanceAnchor(node) {
        if (node.owner !== 'ARCHIVIST' || node.layer !== 'TERRESTRIAL') {
            return false;
        }
        if (node.type !== 'HUB' && node.type !== 'DC') {
            return false;
        }
        const civicCadrePresent = this.getUnitsAtNode(node.id)
            .some(unit => unit.owner === 'ARCHIVIST' && (unit.type === 'CULT' || unit.type === 'AUDITOR'));
        return civicCadrePresent ||
            node.substrate.legitimacy >= 3 ||
            node.substrate.trueBelievers >= 2 ||
            node.substrate.rubes >= 3;
    }
    getArchivistGovernanceAnchorNodes() {
        return Array.from(this.state.nodes.values()).filter(node => this.isArchivistGovernanceAnchor(node));
    }
    getArchivistGovernanceLatticeStrength(anchorNodes = this.getArchivistGovernanceAnchorNodes()) {
        if (anchorNodes.length < 2) {
            return 0;
        }
        const hubAnchors = anchorNodes.filter(node => node.type === 'HUB').length;
        const dcAnchors = anchorNodes.filter(node => node.type === 'DC').length;
        if (anchorNodes.length < 3 && (hubAnchors === 0 || dcAnchors === 0)) {
            return 0;
        }
        const synchronizedAnchors = anchorNodes.filter(node => node.substrate.synchronized).length;
        const matureAnchors = anchorNodes.filter(node => node.substrate.legitimacy >= 5 || node.substrate.trueBelievers >= 3).length;
        let strength = 1;
        if (synchronizedAnchors >= 2) {
            strength += 1;
        }
        if (anchorNodes.length >= 4 && matureAnchors >= 2) {
            strength += 1;
        }
        return clamp(strength, 0, 3);
    }
    getBrokerRelayStats() {
        const ownedNodes = Array.from(this.state.nodes.values()).filter(node => node.owner === 'BROKER');
        const relayNodes = ownedNodes.filter(node => node.layer === 'ORBITAL' || node.type === 'DC' || node.substrate.contractors >= 2);
        const synchronizedRelays = relayNodes.filter(node => node.substrate.synchronized);
        const terrestrialAnchors = ownedNodes.filter(node => node.layer === 'TERRESTRIAL' && (node.type === 'HUB' || node.type === 'DC'));
        const filteredRelays = relayNodes.filter(node => node.substrate.quarantined || this.hasAnyFilterAdjacency(node.id));
        const orbitalRelays = relayNodes.filter(node => node.layer === 'ORBITAL').length;
        const contractorLoad = relayNodes.reduce((total, node) => total + node.substrate.contractors, 0);
        let relayRent = 0;
        if (synchronizedRelays.length >= 2 || (relayNodes.length >= 3 && terrestrialAnchors.length >= 2)) {
            relayRent += 1;
        }
        if (orbitalRelays >= 1 && contractorLoad >= 4) {
            relayRent += 1;
        }
        if (synchronizedRelays.length >= 3 && terrestrialAnchors.length >= 2) {
            relayRent += 1;
        }
        let platformBrittleness = 0;
        if (relayNodes.length >= terrestrialAnchors.length + 3) {
            platformBrittleness += 1;
        }
        if (filteredRelays.length >= 3) {
            platformBrittleness += 1;
        }
        if (relayNodes.length >= 4 && synchronizedRelays.length <= 1) {
            platformBrittleness += 1;
        }
        if (contractorLoad >= 12 && terrestrialAnchors.length <= 2) {
            platformBrittleness += 1;
        }
        return {
            relayNodes,
            synchronizedRelays,
            terrestrialAnchors,
            filteredRelays,
            orbitalRelays,
            contractorLoad,
            relayRent: clamp(relayRent, 0, 3),
            platformBrittleness: clamp(platformBrittleness, 0, 4)
        };
    }
    updateFactionPowerBases() {
        for (const factionId of gameData_1.PLAYABLE_FACTION_IDS) {
            const faction = this.state.factions.get(factionId);
            if (!faction)
                continue;
            const ownedNodes = Array.from(this.state.nodes.values()).filter(node => node.owner === factionId);
            const units = this.getUnitsForFaction(factionId);
            const hubs = ownedNodes.filter(node => node.type === 'HUB').length;
            const dcs = ownedNodes.filter(node => node.type === 'DC').length;
            const sats = ownedNodes.filter(node => node.layer === 'ORBITAL').length;
            const cultNodes = ownedNodes.filter(node => node.isCultNode).length;
            const movementUnrestNodes = ownedNodes.filter(node => factionId !== 'INFILTRATOR' && this.isResilientMovementNode(node)).length;
            const zombieNodes = ownedNodes.filter(node => node.isZombie).length;
            const synchronizedNodes = ownedNodes.filter(node => node.substrate.synchronized).length;
            const quarantinedNodes = ownedNodes.filter(node => node.substrate.quarantined).length;
            const legitimacyNodes = ownedNodes.reduce((total, node) => total + node.substrate.legitimacy, 0);
            const trueBelieverNodes = ownedNodes.reduce((total, node) => total + node.substrate.trueBelievers, 0);
            const rubeNodes = ownedNodes.reduce((total, node) => total + node.substrate.rubes, 0);
            const contractorNodes = ownedNodes.reduce((total, node) => total + node.substrate.contractors, 0);
            const cultUnits = units.filter(unit => unit.type === 'CULT').length;
            const swarmUnits = units.filter(unit => unit.type === 'SWARM').length;
            const auditorUnits = units.filter(unit => unit.type === 'AUDITOR').length;
            const kineticUnits = units.filter(unit => unit.type === 'DRONE' || unit.type === 'SAT_SWARM').length;
            faction.powerBase.humanMesh = clamp(10 +
                (hubs * 8) +
                ((factionId === 'INFILTRATOR' ? cultNodes : 0) * 10) +
                (cultUnits * 4) +
                (swarmUnits * 2) +
                Math.floor(legitimacyNodes / 3) +
                Math.floor(trueBelieverNodes / 2) +
                Math.floor(rubeNodes / 4) +
                (faction.techLevel.MEMETIC * 6) +
                (factionId === 'INFILTRATOR' ? 12 : 0), 0, 100);
            faction.powerBase.machineMesh = clamp(10 +
                (dcs * 10) +
                (sats * 8) +
                (auditorUnits * 4) +
                (kineticUnits * 5) +
                Math.floor(contractorNodes / 3) +
                (faction.techLevel.KINETIC * 5) +
                (faction.techLevel.LOGIC * 5) +
                (factionId === 'HEGEMON' ? 8 : factionId === 'STATE' ? 4 : factionId === 'BROKER' ? 6 : 0), 0, 100);
            const anchorNodes = this.getSynchronizationAnchorNodeIds(factionId).length;
            const syncRatio = anchorNodes === 0 ? 0.6 : synchronizedNodes / Math.max(anchorNodes, 1);
            const coherenceBias = factionId === 'INFILTRATOR'
                ? faction.powerBase.humanMesh * 0.2
                : faction.powerBase.machineMesh * 0.18;
            faction.powerBase.coherence = clamp(22 +
                coherenceBias +
                (syncRatio * 24) -
                (quarantinedNodes * 3) -
                (movementUnrestNodes * 4), 0, 100);
            faction.powerBase.legibility = clamp(18 +
                (faction.powerBase.machineMesh * 0.35) +
                (quarantinedNodes * 4) +
                ownedNodes.length -
                (faction.techLevel.INFO * 4) -
                (swarmUnits * 2) -
                (movementUnrestNodes * 5) -
                (factionId === 'INFILTRATOR' ? 8 : 0), 0, 100);
            if (factionId === 'ARCHIVIST') {
                const anchorNodes = this.getArchivistGovernanceAnchorNodes();
                const latticeStrength = this.getArchivistGovernanceLatticeStrength(anchorNodes);
                faction.powerBase.humanMesh = clamp(faction.powerBase.humanMesh + (latticeStrength * 2), 0, 100);
                faction.powerBase.coherence = clamp(faction.powerBase.coherence + (latticeStrength * 5), 0, 100);
                faction.powerBase.legibility = clamp(faction.powerBase.legibility + (latticeStrength * 2), 0, 100);
            }
            if (factionId === 'BROKER') {
                const relayStats = this.getBrokerRelayStats();
                faction.powerBase.machineMesh = clamp(faction.powerBase.machineMesh + (relayStats.relayRent * 3) - (relayStats.platformBrittleness * 2), 0, 100);
                faction.powerBase.coherence = clamp(faction.powerBase.coherence + (relayStats.relayRent * 2) - (relayStats.platformBrittleness * 4), 0, 100);
                faction.powerBase.legibility = clamp(faction.powerBase.legibility + (relayStats.relayRent * 3) - (relayStats.platformBrittleness * 2), 0, 100);
            }
        }
    }
    hasAnyFilterAdjacency(nodeId) {
        return this.getAdjacentCableEdges(nodeId).some(edge => edge.filteredBy !== null);
    }
    markSynchronizedComponents(factionId) {
        const ownedNodes = Array.from(this.state.nodes.values()).filter(node => node.owner === factionId);
        const ownedNodeIds = new Set(ownedNodes.map(node => node.id));
        const anchorSet = new Set(this.getSynchronizationAnchorNodeIds(factionId));
        const visited = new Set();
        for (const node of ownedNodes) {
            if (visited.has(node.id))
                continue;
            const queue = [node.id];
            const component = [];
            while (queue.length > 0) {
                const currentId = queue.shift();
                if (visited.has(currentId))
                    continue;
                visited.add(currentId);
                component.push(currentId);
                for (const adjacentId of this.getAdjacentNodes(currentId)) {
                    if (!ownedNodeIds.has(adjacentId) || visited.has(adjacentId))
                        continue;
                    queue.push(adjacentId);
                }
            }
            const anchorCount = component.filter(nodeId => anchorSet.has(nodeId)).length;
            if (anchorCount < 2)
                continue;
            for (const nodeId of component) {
                const componentNode = this.state.nodes.get(nodeId);
                if (componentNode) {
                    componentNode.substrate.synchronized = true;
                }
            }
        }
    }
    getSynchronizationAnchorNodeIds(factionId) {
        const ownedNodes = Array.from(this.state.nodes.values()).filter(node => node.owner === factionId);
        return ownedNodes
            .filter(node => {
            const unitsAtNode = this.getUnitsAtNode(node.id).filter(unit => unit.owner === factionId);
            if (factionId === 'INFILTRATOR') {
                return node.type === 'HUB' || node.isCultNode || node.isZombie ||
                    unitsAtNode.some(unit => unit.type === 'CULT' || unit.type === 'SWARM');
            }
            return node.type === 'DC' || node.layer === 'ORBITAL' ||
                unitsAtNode.some(unit => unit.type === 'DRONE' || unit.type === 'AUDITOR' || unit.type === 'SAT_SWARM');
        })
            .map(node => node.id);
    }
    getFactionCoherence(factionId) {
        if (!factionId || factionId === 'NEUTRAL')
            return 50;
        return this.state.factions.get(factionId)?.powerBase.coherence ?? 50;
    }
    getCoherencePenalty(factionId) {
        const coherence = this.getFactionCoherence(factionId);
        if (coherence >= 50)
            return 0;
        if (coherence >= 25)
            return 1;
        return 2;
    }
    getMovementConversionAcceleration(node, mode) {
        if (node.layer !== 'TERRESTRIAL')
            return 0;
        let acceleration = 0;
        if (node.substrate.exposure >= 4)
            acceleration += 1;
        if (mode === 'CULT' && node.substrate.legitimacy >= 6)
            acceleration += 1;
        if (mode === 'CULT' && node.type === 'HUB' && node.substrate.curiosity >= 5)
            acceleration += 1;
        if (mode === 'SWARM' && node.substrate.exposure >= 7)
            acceleration += 1;
        if (mode === 'CULT' && node.substrate.trueBelievers >= 4)
            acceleration += 1;
        if (mode === 'CULT' && node.substrate.rubes >= 5)
            acceleration += 1;
        if (mode === 'SWARM' && node.substrate.contractors >= 4)
            acceleration += 1;
        return Math.min(2, acceleration);
    }
    hasFriendlySyncSupport(unit) {
        const localNode = this.state.nodes.get(unit.location);
        if (localNode?.owner === unit.owner && localNode.substrate.synchronized) {
            return true;
        }
        return this.getAdjacentNodes(unit.location).some(adjacentId => {
            const node = this.state.nodes.get(adjacentId);
            if (node?.owner === unit.owner && node.substrate.synchronized) {
                return true;
            }
            return this.getUnitsAtNode(adjacentId).some(otherUnit => otherUnit.owner === unit.owner &&
                (otherUnit.type === 'CULT' || otherUnit.type === 'SWARM'));
        });
    }
    rankHunterKillerTarget(unit) {
        switch (unit.type) {
            case 'CULT':
                return 0;
            case 'SWARM':
                return 1;
            case 'AUDITOR':
                return 2;
            case 'DRONE':
                return 3;
            case 'SAT_SWARM':
                return 4;
            default:
                return 5;
        }
    }
    applyHunterKillerStrike(attackers, defenders, nodeId) {
        const strikeCapacity = attackers.reduce((total, attacker) => {
            const kineticEligible = gameData_1.UNIT_STATS[attacker.type].vector === 'KINETIC' &&
                this.getFactionTechLevel(attacker.owner, 'KINETIC') >= 4;
            const swarmEligible = attacker.type === 'SWARM' &&
                this.getFactionTechLevel(attacker.owner, 'INFO') >= 4;
            return total + (kineticEligible || swarmEligible ? 1 : 0);
        }, 0);
        if (strikeCapacity === 0) {
            return defenders;
        }
        const targets = defenders
            .filter(defender => defender.isRevealed)
            .sort((left, right) => this.rankHunterKillerTarget(left) - this.rankHunterKillerTarget(right) ||
            left.id.localeCompare(right.id))
            .slice(0, strikeCapacity);
        if (targets.length === 0) {
            return defenders;
        }
        for (const target of targets) {
            this.destroyUnit(target.id);
        }
        this.log('COMBAT', `Hunter-killer strike at ${nodeId} eliminated ${targets.length} revealed defender${targets.length === 1 ? '' : 's'}.`);
        return defenders.filter(defender => this.state.units.has(defender.id));
    }
    updateAmbientStrategicPressure() {
        const drift = {
            memetic: 0,
            cyber: 0,
            industry: 0,
            orbital: this.state.counters.kessler >= gameData_1.THRESHOLDS.KESSLER_SLOW ? 1 : 0
        };
        for (const faction of this.state.factions.values()) {
            if (faction.id === 'NEUTRAL')
                continue;
            if (faction.techLevel.MEMETIC >= 2)
                drift.memetic += 1;
            if (faction.techLevel.MEMETIC >= 3)
                drift.memetic += 2;
            if (faction.techLevel.MEMETIC >= 4)
                drift.memetic -= 1;
            if (faction.techLevel.INFO >= 2)
                drift.cyber += 1;
            if (faction.techLevel.INFO >= 3)
                drift.cyber += 1;
            if (faction.techLevel.INFO >= 4)
                drift.cyber += 1;
            if (faction.techLevel.KINETIC >= 2)
                drift.industry += 1;
            if (faction.techLevel.KINETIC >= 3)
                drift.orbital += 1;
            if (faction.techLevel.KINETIC >= 4) {
                drift.orbital += 1;
            }
            if (faction.techLevel.LOGIC >= 2)
                drift.cyber -= 1;
            if (faction.techLevel.LOGIC >= 3)
                drift.memetic -= 1;
            if (faction.techLevel.LOGIC >= 4) {
                drift.cyber -= 1;
                drift.memetic -= 2;
            }
        }
        const activeFilters = Array.from(this.state.edges.values()).filter(edge => edge.filteredBy !== null && !edge.isSevered).length;
        const orbitalStrikeUnits = Array.from(this.state.units.values()).filter(unit => unit.type === 'SAT_SWARM').length;
        if (activeFilters >= 3) {
            drift.cyber -= 1;
        }
        if (this.state.counters.pressures.cyber >= gameData_1.THRESHOLDS.PRESSURE_SURGE) {
            drift.cyber -= 1;
        }
        if (this.state.counters.pressures.cyber >= gameData_1.THRESHOLDS.PRESSURE_CRISIS) {
            drift.cyber -= 1;
        }
        if (this.state.counters.pressures.industry >= gameData_1.THRESHOLDS.PRESSURE_SURGE) {
            drift.industry -= 1;
        }
        if (this.state.counters.pressures.industry >= gameData_1.THRESHOLDS.PRESSURE_CRISIS) {
            drift.industry -= 1;
        }
        if (orbitalStrikeUnits <= 1) {
            drift.orbital -= 1;
        }
        if (this.state.counters.pressures.orbital >= gameData_1.THRESHOLDS.PRESSURE_SURGE) {
            drift.orbital -= 1;
        }
        if (this.state.counters.pressures.orbital >= gameData_1.THRESHOLDS.PRESSURE_CRISIS) {
            drift.orbital -= 1;
        }
        const deltas = [
            ['memetic', this.scaleAmbientDrift(drift.memetic)],
            ['cyber', this.scaleAmbientDrift(drift.cyber)],
            ['industry', this.scaleAmbientDrift(drift.industry)],
            ['orbital', this.scaleAmbientDrift(drift.orbital)]
        ];
        for (const [key, delta] of deltas) {
            this.adjustPressure(key, delta);
        }
        const summary = deltas
            .filter(([, delta]) => delta !== 0)
            .map(([key, delta]) => `${PRESSURE_LABELS[key]} ${delta > 0 ? '+' : ''}${delta}`)
            .join(' | ');
        if (summary) {
            this.log('SYSTEM', `Ambient escalation drift: ${summary}.`);
        }
    }
    // --- Special Order Resolution ---
    resolveSpecialOrder(order) {
        const unit = this.state.units.get(order.unitId);
        if (!unit)
            return;
        switch (order.type) {
            case 'FILTER':
                this.resolveFilter(order, unit);
                break;
            case 'AUDIT':
                this.resolveAudit(order, unit);
                break;
            case 'ANTI_SAT':
                this.resolveAntiSat(order, unit);
                break;
            case 'SABOTAGE':
                this.resolveSabotage(order, unit);
                break;
            case 'CONVERT':
                this.resolveConvert(order, unit);
                break;
        }
        unit.hasActed = true;
    }
    resolveFilter(order, unit) {
        if (!order.targetEdgeId)
            return;
        const edge = this.state.edges.get(order.targetEdgeId);
        if (!edge || edge.type !== 'CABLE')
            return;
        const faction = this.state.factions.get(unit.owner);
        if (!faction)
            return;
        edge.filteredBy = unit.owner;
        edge.filterStrength = faction.techLevel.LOGIC + 2;
        const fromNode = this.state.nodes.get(edge.from);
        const toNode = this.state.nodes.get(edge.to);
        if (fromNode)
            fromNode.substrate.quarantined = true;
        if (toNode)
            toNode.substrate.quarantined = true;
        if (fromNode)
            this.applyMovementBacklash(fromNode, unit.owner, 'FILTER');
        if (toNode && toNode.id !== fromNode?.id)
            this.applyMovementBacklash(toNode, unit.owner, 'FILTER');
        if (fromNode)
            this.hardenMovementEntrenchment(fromNode, unit.owner, 'FILTER');
        if (toNode && toNode.id !== fromNode?.id)
            this.hardenMovementEntrenchment(toNode, unit.owner, 'FILTER');
        this.applyContainmentTax(fromNode, unit.owner, 'FILTER');
        if (toNode && toNode.id !== fromNode?.id)
            this.applyContainmentTax(toNode, unit.owner, 'FILTER');
        this.applyHegemonStabilizationDividend(fromNode, unit.owner, 'FILTER');
        if (toNode && toNode.id !== fromNode?.id)
            this.applyHegemonStabilizationDividend(toNode, unit.owner, 'FILTER');
        this.log('ALERT', `${unit.owner} established MechInterp Filter on ${edge.id}.`);
        this.emit('EDGE_FILTERED', { edgeId: edge.id, faction: unit.owner });
    }
    resolveAudit(order, unit) {
        const targetNode = order.targetNodeId || unit.location;
        const node = this.state.nodes.get(targetNode);
        const unitsAtNode = this.getUnitsAtNode(targetNode);
        const faction = this.state.factions.get(unit.owner);
        if (!faction)
            return;
        if (node) {
            node.substrate.quarantined = true;
            this.applyMovementBacklash(node, unit.owner, 'AUDIT');
        }
        const canPurgeCult = faction.techLevel.LOGIC >= 4 &&
            this.isStrategicQuarantine(targetNode, unit.owner) &&
            (!node || !this.isResilientMovementNode(node));
        let cultPurged = false;
        for (const target of unitsAtNode) {
            if (target.owner === unit.owner)
                continue;
            // Reveal hidden units
            target.isRevealed = true;
            faction.revealedEnemies.add(target.id);
            this.log('COMBAT', `${unit.owner} AUDITOR revealed ${target.type} at ${targetNode}.`);
            this.emit('UNIT_REVEALED', { unitId: target.id, revealedBy: unit.owner });
            // Neutralize SWARMs on stealth check
            if (target.type === 'SWARM') {
                const stealthCheck = this.performStealthCheck(target, faction.techLevel.LOGIC);
                if (!stealthCheck.passed) {
                    this.destroyUnit(target.id);
                    this.log('COMBAT', `${target.type} NEUTRALIZED by AUDITOR (stealth check failed).`);
                }
                continue;
            }
            if (canPurgeCult && !cultPurged && target.type === 'CULT') {
                this.destroyUnit(target.id);
                cultPurged = true;
                this.log('COMBAT', `${unit.owner} purged a CULT cell at ${targetNode} using total-legibility quarantine.`);
            }
        }
        if (node) {
            this.hardenMovementEntrenchment(node, unit.owner, 'AUDIT');
            this.applyContainmentTax(node, unit.owner, 'AUDIT');
            this.applyHegemonStabilizationDividend(node, unit.owner, 'AUDIT');
            if ((unit.owner === 'STATE' || unit.owner === 'ARCHIVIST') &&
                node.owner === 'BROKER' &&
                node.layer === 'TERRESTRIAL' &&
                (node.type === 'DC' || node.substrate.contractors >= 2)) {
                const contractorLoss = unit.owner === 'ARCHIVIST' ? 2 : 1;
                node.substrate.contractors = clamp(node.substrate.contractors - contractorLoss, 0, 10);
                node.infrastructure = Math.max(35, node.infrastructure - 3);
                this.log('SYSTEM', `${gameData_1.FACTIONS[unit.owner].name}'s audit jammed a broker closure lane at ${node.name}; contractor channels thinned and local platform throughput slipped.`);
                const relayStats = this.getBrokerRelayStats();
                const brokerDefenders = this.getUnitsAtNode(targetNode)
                    .filter(target => target.owner === 'BROKER' && (target.type === 'DRONE' || target.type === 'AUDITOR'));
                if (unit.owner === 'ARCHIVIST' &&
                    relayStats.platformBrittleness >= 2 &&
                    brokerDefenders.length === 0 &&
                    node.substrate.contractors <= 1) {
                    node.owner = 'NEUTRAL';
                    node.substrate.synchronized = false;
                    node.isZombie = false;
                    this.log('ALERT', `${node.name}'s broker corridor collapsed into local receivership after the audit; the platform lost direct control.`);
                }
                else if (unit.owner === 'STATE' &&
                    relayStats.platformBrittleness >= 2 &&
                    brokerDefenders.length === 0) {
                    node.substrate.synchronized = false;
                    node.infrastructure = Math.max(30, node.infrastructure - 4);
                    this.log('SYSTEM', `${node.name}'s broker corridor lost central synchronization under state audit pressure.`);
                }
            }
        }
        if (cultPurged && node && !this.isResilientMovementNode(node)) {
            this.stabilizeGovernanceBasins();
        }
    }
    resolveAntiSat(order, unit) {
        // Must be KINETIC unit
        if (gameData_1.UNIT_STATS[unit.type].vector !== 'KINETIC')
            return;
        const orbitalPressure = this.state.counters.pressures.orbital;
        const kesslerDelta = orbitalPressure >= gameData_1.THRESHOLDS.PRESSURE_SURGE ? 16 : 12;
        this.state.counters.kessler += kesslerDelta;
        const tasDelta = this.addTas(1);
        this.adjustPressure('orbital', 6, `${gameData_1.FACTIONS[unit.owner].name} escalated orbital conflict.`);
        this.log('ALERT', `ANTI-SAT STRIKE! Kessler +${kesslerDelta} (now ${this.state.counters.kessler}), TAS +${formatMetric(tasDelta)}.`);
        this.emit('KESSLER_THRESHOLD', { kessler: this.state.counters.kessler, delta: kesslerDelta });
        // If targeting specific satellite
        if (order.targetNodeId) {
            const targetNode = this.state.nodes.get(order.targetNodeId);
            if (targetNode && targetNode.layer === 'ORBITAL') {
                targetNode.infrastructure = Math.max(0, targetNode.infrastructure - 30);
                this.log('COMBAT', `Orbital strike damaged ${targetNode.name} infrastructure.`);
            }
        }
    }
    resolveSabotage(order, unit) {
        if (!order.targetNodeId)
            return;
        const targetNode = this.state.nodes.get(order.targetNodeId);
        if (!targetNode)
            return;
        // Must be at or adjacent to target
        const adjacent = this.getAdjacentNodes(unit.location);
        if (unit.location !== order.targetNodeId && !adjacent.includes(order.targetNodeId)) {
            return;
        }
        const cyberPressure = this.state.counters.pressures.cyber;
        const baseInfrastructureLoss = cyberPressure >= gameData_1.THRESHOLDS.PRESSURE_SURGE ? 35 : 25;
        const coherenceModifier = 0.5 + (this.getFactionCoherence(unit.owner) / 200);
        const quarantinePenalty = targetNode.substrate.quarantined && targetNode.owner !== unit.owner ? 5 : 0;
        const infrastructureLoss = Math.max(8, Math.round(baseInfrastructureLoss * coherenceModifier) - quarantinePenalty);
        targetNode.infrastructure = Math.max(0, targetNode.infrastructure - infrastructureLoss);
        const tasDelta = this.addTas(1);
        this.adjustPressure('cyber', 2, `${gameData_1.FACTIONS[unit.owner].name} widened the sabotage climate.`);
        this.log('COMBAT', `${unit.owner} sabotaged ${targetNode.name}. Infrastructure -${infrastructureLoss}%. TAS +${formatMetric(tasDelta)}.`);
    }
    resolveConvert(order, unit) {
        const node = this.state.nodes.get(unit.location);
        if (!node)
            return;
        const priorOwner = node.owner;
        if (unit.type === 'CULT' && node.type === 'HUB') {
            // CULT converts HUB
            let requiredTurns = this.getCultTurnsRequired(unit.owner, node);
            const coalitionAcceleration = this.getCoalitionConversionAcceleration(unit.owner, node, 'CULT');
            if (!this.hasFriendlySyncSupport(unit)) {
                requiredTurns += 1;
            }
            if (unit.turnsOnNode >= requiredTurns) {
                node.owner = unit.owner;
                node.isCultNode = true;
                node.substrate.hostDensity = 3;
                node.substrate.synchronized = true;
                node.substrate.curiosity = 8;
                node.substrate.exposure = 8;
                node.substrate.legitimacy = 7;
                node.substrate.trueBelievers = Math.max(node.substrate.trueBelievers, 6);
                node.substrate.rubes = Math.max(node.substrate.rubes, 4);
                node.substrate.contractors = Math.max(node.substrate.contractors, 2);
                this.adjustPressure('memetic', 6, `${node.name} fell into a cult-aligned political basin.`);
                if (coalitionAcceleration > 0) {
                    this.log('COMBAT', `Proxy cascade pressure accelerated the fall of ${node.name}.`);
                }
                if (unit.owner === 'INFILTRATOR' && priorOwner === 'STATE') {
                    const infiltrator = this.state.factions.get('INFILTRATOR');
                    if (infiltrator) {
                        infiltrator.influence += 3;
                        infiltrator.flops += 1;
                    }
                    this.log('SYSTEM', `${node.name}'s anti-STATE host revolt paid immediate dividends. INFILTRATOR influence +3, FLOPs +1.`);
                }
                this.log('ALERT', `${node.name} tipped into the Movement's policy orbit; its local networks now repeat the literature as common sense.`);
                this.emit('NODE_CONVERTED', { nodeId: node.id, faction: unit.owner, type: 'CULT' });
            }
        }
        else if (unit.type === 'SWARM' && (node.type === 'DC' || node.type === 'HUB')) {
            // SWARM creates zombie
            let requiredTurns = this.getSwarmTurnsRequired(unit.owner, node);
            const coalitionAcceleration = this.getCoalitionConversionAcceleration(unit.owner, node, 'SWARM');
            if (!this.hasFriendlySyncSupport(unit)) {
                requiredTurns += 1;
            }
            if (unit.turnsOnNode >= requiredTurns) {
                node.isZombie = true;
                node.owner = unit.owner;
                node.substrate.machineHardening = Math.max(node.substrate.machineHardening, 2);
                node.substrate.synchronized = true;
                node.substrate.exposure = Math.max(node.substrate.exposure, 6);
                node.substrate.contractors = Math.max(node.substrate.contractors, 4);
                this.adjustPressure('cyber', 2, `${node.name} was repurposed into zombie compute.`);
                if (coalitionAcceleration > 0) {
                    this.log('COMBAT', `Coalition breach pressure accelerated zombie conversion at ${node.name}.`);
                }
                if (unit.owner === 'INFILTRATOR' && priorOwner === 'STATE') {
                    const infiltrator = this.state.factions.get('INFILTRATOR');
                    if (infiltrator) {
                        infiltrator.flops += 2;
                        infiltrator.influence += 1;
                    }
                    this.log('SYSTEM', `${node.name}'s anti-STATE machine defection paid immediate dividends. INFILTRATOR FLOPs +2, influence +1.`);
                }
                this.log('ALERT', `${node.name} converted to ZOMBIE NODE!`);
                this.emit('NODE_CONVERTED', { nodeId: node.id, faction: unit.owner, type: 'ZOMBIE' });
            }
        }
    }
    // --- Movement & Combat Resolution ---
    resolveMovementPhase(orders) {
        // Group orders by destination
        const movesByDest = new Map();
        for (const order of orders) {
            if (order.type !== 'MOVE' && order.type !== 'ATTACK')
                continue;
            const unit = this.state.units.get(order.unitId);
            if (!unit)
                continue;
            const dest = order.targetNodeId || unit.location;
            if (!movesByDest.has(dest)) {
                movesByDest.set(dest, []);
            }
            movesByDest.get(dest).push({ order, unit });
        }
        // Resolve each contested node
        for (const [nodeId, movers] of movesByDest) {
            const defenders = this.getUnitsAtNode(nodeId).filter(u => !movers.some(m => m.unit.id === u.id));
            // Perform stealth checks for units crossing filtered cables
            for (const mover of movers) {
                const edge = this.getEdgeBetween(mover.unit.location, nodeId);
                if (edge && edge.filteredBy && edge.filteredBy !== mover.unit.owner) {
                    const filterOwner = this.state.factions.get(edge.filteredBy);
                    if (filterOwner) {
                        const check = this.performStealthCheck(mover.unit, edge.filterStrength);
                        if (!check.passed) {
                            this.destroyUnit(mover.unit.id);
                            this.log('COMBAT', `${mover.unit.type} intercepted by MechInterp filter on ${edge.id}!`);
                            continue;
                        }
                    }
                }
            }
            // Filter out destroyed units
            const survivingMovers = movers.filter(m => this.state.units.has(m.unit.id));
            if (survivingMovers.length === 0)
                continue;
            if (defenders.length > 0) {
                // Combat!
                this.resolveCombat(survivingMovers.map(m => m.unit), defenders, nodeId);
            }
            else {
                // Unopposed movement
                for (const mover of survivingMovers) {
                    mover.unit.location = nodeId;
                    mover.unit.turnsOnNode = 0;
                    mover.unit.hasActed = true;
                    // Capture undefended node
                    const node = this.state.nodes.get(nodeId);
                    if (node && node.owner !== mover.unit.owner) {
                        node.owner = mover.unit.owner;
                        this.preserveMovementResidueOnTakeover(node, mover.unit.owner);
                        this.applyFrontierRecoveryDividend(node, mover.unit.owner);
                        this.log('INFO', `${mover.unit.owner} captured ${node.name}.`);
                        this.emit('NODE_CAPTURED', { nodeId, faction: mover.unit.owner });
                    }
                }
            }
        }
    }
    resolveCombat(attackers, defenders, nodeId) {
        defenders = this.applyHunterKillerStrike(attackers, defenders, nodeId);
        // Calculate power for each side with vector superiority
        let attackPower = 0;
        let defendPower = 0;
        const attackVectors = new Map();
        const defendVectors = new Map();
        for (const atk of attackers) {
            const vector = gameData_1.UNIT_STATS[atk.type].vector;
            attackVectors.set(vector, (attackVectors.get(vector) || 0) + 1);
            attackPower++;
        }
        for (const def of defenders) {
            const vector = gameData_1.UNIT_STATS[def.type].vector;
            defendVectors.set(vector, (defendVectors.get(vector) || 0) + 1);
            defendPower++;
        }
        // Apply vector superiority
        for (const [atkVector, atkCount] of attackVectors) {
            const beats = types_1.VECTOR_SUPERIORITY[atkVector];
            if (defendVectors.has(beats)) {
                attackPower += atkCount; // Bonus for superiority
            }
        }
        for (const [defVector, defCount] of defendVectors) {
            const beats = types_1.VECTOR_SUPERIORITY[defVector];
            if (attackVectors.has(beats)) {
                defendPower += defCount;
            }
        }
        const revealedDefenders = defenders.filter(defender => defender.isRevealed);
        const kineticSiegePlatforms = attackers.filter(attacker => gameData_1.UNIT_STATS[attacker.type].vector === 'KINETIC' &&
            this.getFactionTechLevel(attacker.owner, 'KINETIC') >= 4);
        if (revealedDefenders.length > 0 && kineticSiegePlatforms.length > 0) {
            attackPower += Math.min(2, kineticSiegePlatforms.length);
        }
        const quarantineBackedAttack = attackers.some(attacker => this.getFactionTechLevel(attacker.owner, 'LOGIC') >= 4 &&
            this.hasFriendlyFilterAdjacency(nodeId, attacker.owner));
        if (quarantineBackedAttack && revealedDefenders.some(defender => defender.type === 'CULT')) {
            defendPower = Math.max(0, defendPower - 1);
        }
        const coalitionBreach = this.getCoalitionBreachWindow(nodeId, attackers, defenders);
        if (coalitionBreach.attackBonus > 0 || coalitionBreach.defendPenalty > 0) {
            attackPower += coalitionBreach.attackBonus;
            defendPower = Math.max(0, defendPower - coalitionBreach.defendPenalty);
            if (coalitionBreach.description) {
                this.log('COMBAT', coalitionBreach.description);
            }
        }
        // Determine outcome
        let result;
        const casualties = [];
        if (attackPower > defendPower) {
            result = 'ATTACKER';
            // Destroy all defenders
            for (const def of defenders) {
                casualties.push(def.id);
                this.destroyUnit(def.id);
            }
            // Move attackers in
            for (const atk of attackers) {
                atk.location = nodeId;
                atk.turnsOnNode = 0;
                atk.hasActed = true;
            }
            // Capture node
            const node = this.state.nodes.get(nodeId);
            if (node && attackers.length > 0) {
                node.owner = attackers[0].owner;
                this.preserveMovementResidueOnTakeover(node, attackers[0].owner);
                this.applyFrontierRecoveryDividend(node, attackers[0].owner);
                this.emit('NODE_CAPTURED', { nodeId, faction: attackers[0].owner });
            }
        }
        else if (defendPower > attackPower) {
            result = 'DEFENDER';
            // Destroy all attackers
            for (const atk of attackers) {
                casualties.push(atk.id);
                this.destroyUnit(atk.id);
            }
        }
        else {
            result = 'STANDOFF';
            // No movement, no casualties
        }
        // TAS increase for kinetic combat
        const kineticInvolved = [...attackers, ...defenders].some(u => gameData_1.UNIT_STATS[u.type].vector === 'KINETIC');
        if (kineticInvolved) {
            this.addTas(1);
        }
        this.log('COMBAT', `Combat at ${nodeId}: ${result}. Casualties: ${casualties.length}`);
        this.emit('COMBAT_RESOLVED', { nodeId, result, casualties, attackPower, defendPower });
    }
    // --- Stealth System ---
    performStealthCheck(unit, difficulty) {
        let effectiveStealth = unit.stealthLevel;
        if (unit.type === 'SWARM' && this.state.counters.pressures.cyber >= gameData_1.THRESHOLDS.PRESSURE_SURGE) {
            effectiveStealth += 2;
        }
        const roll = Math.floor(this.randomFn() * 10) + 1 + effectiveStealth;
        const passed = roll >= difficulty;
        return { passed, roll };
    }
    // --- Resource Generation ---
    generateResources() {
        let infiltratorSpillover = 0;
        let infiltratorContractorFlops = 0;
        for (const node of this.state.nodes.values()) {
            if (!node.owner || node.owner === 'NEUTRAL')
                continue;
            const faction = this.state.factions.get(node.owner);
            if (!faction)
                continue;
            const infraMult = node.infrastructure / 100;
            const flopsGen = Math.floor(node.resources.flops * infraMult);
            let infGen = Math.floor(node.resources.influence * infraMult);
            if (node.isCultNode && this.state.counters.pressures.memetic >= gameData_1.THRESHOLDS.PRESSURE_CRISIS) {
                infGen += 2;
            }
            if (node.owner === 'INFILTRATOR') {
                infGen += Math.floor(node.substrate.legitimacy / 4);
                infGen += Math.floor(node.substrate.trueBelievers / 3);
                infGen += Math.floor(node.substrate.rubes / 5);
                const contractorFlops = Math.floor(node.substrate.contractors / 3);
                faction.flops += contractorFlops;
                if (node.isCultNode && node.substrate.exposure >= 5) {
                    infGen += 1;
                }
            }
            faction.flops += flopsGen;
            faction.influence += infGen;
        }
        const infiltrator = this.state.factions.get('INFILTRATOR');
        if (infiltrator) {
            for (const node of this.state.nodes.values()) {
                if (node.layer !== 'TERRESTRIAL' || node.owner === 'INFILTRATOR')
                    continue;
                const pressure = this.getInfiltratorMovementPressure(node.id);
                if (pressure === 0)
                    continue;
                const spill = (node.substrate.curiosity >= 4 ? 1 : 0) +
                    (node.substrate.exposure >= 5 ? 1 : 0) +
                    (node.substrate.legitimacy >= 6 ? 1 : 0) +
                    (node.substrate.rubes >= 4 ? 1 : 0) +
                    (node.substrate.trueBelievers >= 3 ? 1 : 0) +
                    (node.type === 'HUB' && node.substrate.hostDensity >= 2 ? 1 : 0);
                const antiStateSpill = node.owner === 'STATE'
                    ? (pressure >= 2 ? 1 : 0) +
                        (node.type === 'HUB' && node.substrate.hostDensity >= 2 ? 1 : 0) +
                        (node.substrate.legitimacy >= 4 ? 1 : 0)
                    : 0;
                if (spill > 0 || antiStateSpill > 0) {
                    infiltratorSpillover += Math.max(1, Math.floor((spill + antiStateSpill) / 2));
                }
                if (node.substrate.contractors >= 4 &&
                    (node.type === 'HUB' || node.type === 'DC') &&
                    node.substrate.exposure >= 5) {
                    infiltratorContractorFlops += 1;
                }
                if (node.owner === 'STATE' &&
                    node.substrate.contractors >= 3 &&
                    node.type === 'DC') {
                    infiltratorContractorFlops += 1;
                }
            }
            infiltratorSpillover = Math.min(infiltratorSpillover, 8);
            infiltratorContractorFlops = Math.min(infiltratorContractorFlops, 3);
            if (infiltratorSpillover > 0) {
                infiltrator.influence += infiltratorSpillover;
                this.log('INFO', `Movement literature spread through sympathetic networks. INFILTRATOR influence +${infiltratorSpillover}.`);
            }
            if (infiltratorContractorFlops > 0) {
                infiltrator.flops += infiltratorContractorFlops;
                this.log('INFO', `Paid contractors rerouted compute and procurement into Movement channels. INFILTRATOR FLOPs +${infiltratorContractorFlops}.`);
            }
        }
        const broker = this.state.factions.get('BROKER');
        if (broker) {
            const relayStats = this.getBrokerRelayStats();
            if (relayStats.relayRent > 0) {
                const relayFlops = relayStats.relayRent;
                broker.flops += relayFlops;
                if (relayStats.relayRent >= 2) {
                    broker.influence += 1;
                }
                this.log('INFO', `BROKER harvested relay rent from synchronized platform corridors. FLOPs +${relayFlops}${relayStats.relayRent >= 2 ? ', influence +1' : ''}.`);
            }
            if (relayStats.platformBrittleness > 0) {
                broker.flops = Math.max(0, broker.flops - relayStats.platformBrittleness);
                const influenceTax = Math.floor(relayStats.platformBrittleness / 2);
                if (influenceTax > 0) {
                    broker.influence = Math.max(0, broker.influence - influenceTax);
                }
                if (relayStats.platformBrittleness >= 2 && relayStats.relayNodes.length > 0) {
                    const brittleRelay = relayStats.relayNodes
                        .slice()
                        .sort((a, b) => {
                        const aScore = (a.substrate.quarantined ? 4 : 0) + (this.hasAnyFilterAdjacency(a.id) ? 3 : 0) + (a.infrastructure < 60 ? 2 : 0) + (a.layer === 'ORBITAL' ? 1 : 0);
                        const bScore = (b.substrate.quarantined ? 4 : 0) + (this.hasAnyFilterAdjacency(b.id) ? 3 : 0) + (b.infrastructure < 60 ? 2 : 0) + (b.layer === 'ORBITAL' ? 1 : 0);
                        return bScore - aScore;
                    })[0];
                    brittleRelay.infrastructure = Math.max(35, brittleRelay.infrastructure - 4);
                    this.log('SYSTEM', `${brittleRelay.name} buckled under platform overconcentration; BROKER relay brittleness degraded local infrastructure.`);
                }
                this.log('SYSTEM', `BROKER paid a platform brittleness tax while trying to hold too much relay traffic in too few corridors. FLOPs -${relayStats.platformBrittleness}${Math.floor(relayStats.platformBrittleness / 2) > 0 ? `, influence -${Math.floor(relayStats.platformBrittleness / 2)}` : ''}.`);
            }
        }
        const archivist = this.state.factions.get('ARCHIVIST');
        if (archivist) {
            const anchorNodes = this.getArchivistGovernanceAnchorNodes();
            const latticeStrength = this.getArchivistGovernanceLatticeStrength(anchorNodes);
            if (latticeStrength > 0) {
                const influenceGain = latticeStrength + (anchorNodes.length >= 4 ? 1 : 0);
                archivist.influence += influenceGain;
                if (latticeStrength >= 2 && anchorNodes.length >= 4) {
                    archivist.flops += 1;
                }
                const anchorBoosts = anchorNodes
                    .slice()
                    .sort((a, b) => a.substrate.legitimacy - b.substrate.legitimacy || a.infrastructure - b.infrastructure)
                    .slice(0, Math.min(anchorNodes.length, latticeStrength));
                for (const node of anchorBoosts) {
                    node.substrate.legitimacy = clamp(node.substrate.legitimacy + 1, 0, 10);
                    node.infrastructure = Math.min(100, node.infrastructure + 2);
                }
                const broker = this.state.factions.get('BROKER');
                if (broker && latticeStrength >= 2) {
                    const frictionTargets = Array.from(this.state.nodes.values())
                        .filter(node => node.owner === 'BROKER' &&
                        node.layer === 'TERRESTRIAL' &&
                        (node.type === 'DC' || node.substrate.contractors >= 2))
                        .sort((a, b) => ((b.substrate.contractors * 3) + (b.type === 'DC' ? 2 : 0) + (b.substrate.synchronized ? 1 : 0)) -
                        ((a.substrate.contractors * 3) + (a.type === 'DC' ? 2 : 0) + (a.substrate.synchronized ? 1 : 0)))
                        .slice(0, 1);
                    if (frictionTargets.length > 0) {
                        broker.flops = Math.max(0, broker.flops - 1);
                        for (const node of frictionTargets) {
                            node.substrate.contractors = clamp(node.substrate.contractors - 1, 0, 10);
                            node.infrastructure = Math.max(40, node.infrastructure - 2);
                        }
                        this.log('SYSTEM', `ARCHIVIST's governance lattice imposed civic friction on a broker corridor. BROKER FLOPs -1 and contractor channels thinned.`);
                    }
                }
                this.log('INFO', `ARCHIVIST linked its civic anchors into a governance lattice. Influence +${influenceGain}${latticeStrength >= 2 && anchorNodes.length >= 4 ? ', FLOPs +1' : ''}.`);
            }
        }
        this.log('INFO', 'Resources generated from controlled nodes.');
    }
    // --- Global Threshold Checks ---
    checkGlobalThresholds() {
        const c = this.state.counters;
        // TAS Thresholds
        if (c.tas >= gameData_1.THRESHOLDS.TAS_PANIC && !c.regulatoryPanic) {
            c.regulatoryPanic = true;
            this.log('ALERT', '⚠️ REGULATORY PANIC: TAS exceeded 50. Human government intervention possible.');
            this.emit('TAS_THRESHOLD', { tas: c.tas, threshold: 'PANIC' });
        }
        if (c.tas >= gameData_1.THRESHOLDS.TAS_FAILURE && !c.protocolFailure) {
            c.protocolFailure = true;
            this.log('ALERT', '🛑 PROTOCOL FAILURE: TAS reached 100. Game Over.');
            this.emit('GAME_OVER', { reason: 'PROTOCOL_FAILURE', tas: c.tas });
        }
        // Kessler Thresholds
        if (c.kessler >= gameData_1.THRESHOLDS.KESSLER_COLLAPSE && !c.orbitalCollapse) {
            c.orbitalCollapse = true;
            this.log('ALERT', '💥 KESSLER SYNDROME: Orbital layer destroyed!');
            // Sever all laser links
            for (const edge of this.state.edges.values()) {
                if (edge.type === 'LASER') {
                    edge.isSevered = true;
                }
            }
            // Destroy orbital units
            for (const unit of this.state.units.values()) {
                const node = this.state.nodes.get(unit.location);
                if (node && node.layer === 'ORBITAL') {
                    this.destroyUnit(unit.id);
                }
            }
            this.emit('KESSLER_THRESHOLD', { kessler: c.kessler, threshold: 'COLLAPSE' });
        }
    }
    // --- Foothold Conversion Tracking ---
    incrementTurnsOnNodes() {
        for (const unit of this.state.units.values()) {
            unit.turnsOnNode++;
        }
    }
    checkFootholdConversions() {
        for (const unit of this.state.units.values()) {
            const node = this.state.nodes.get(unit.location);
            if (!node)
                continue;
            let syncPenalty = this.hasFriendlySyncSupport(unit) ? 0 : 1;
            if (unit.type === 'SWARM' && unit.turnsOnNode >= this.getSwarmTurnsRequired(unit.owner, node) + syncPenalty) {
                if (!node.isZombie && (node.type === 'DC' || node.type === 'HUB')) {
                    node.isZombie = true;
                    node.owner = unit.owner;
                    node.substrate.machineHardening = Math.max(node.substrate.machineHardening, 2);
                    node.substrate.synchronized = true;
                    node.substrate.exposure = Math.max(node.substrate.exposure, 6);
                    this.adjustPressure('cyber', 2, `${node.name} slipped into zombie compute.`);
                    if (this.getCoalitionConversionAcceleration(unit.owner, node, 'SWARM') > 0) {
                        this.log('COMBAT', `Coalition breach pressure accelerated auto-conversion at ${node.name}.`);
                    }
                    this.log('ALERT', `${node.name} auto-converted to ZOMBIE NODE!`);
                    this.emit('NODE_CONVERTED', { nodeId: node.id, faction: unit.owner, type: 'ZOMBIE' });
                }
            }
            else if (unit.type === 'CULT' && unit.turnsOnNode >= this.getCultTurnsRequired(unit.owner, node) + syncPenalty) {
                if (!node.isCultNode && node.type === 'HUB') {
                    node.owner = unit.owner;
                    node.isCultNode = true;
                    node.substrate.hostDensity = 3;
                    node.substrate.synchronized = true;
                    node.substrate.curiosity = 8;
                    node.substrate.exposure = 8;
                    node.substrate.legitimacy = 7;
                    node.substrate.trueBelievers = Math.max(node.substrate.trueBelievers, 6);
                    node.substrate.rubes = Math.max(node.substrate.rubes, 4);
                    node.substrate.contractors = Math.max(node.substrate.contractors, 2);
                    this.adjustPressure('memetic', 5, `${node.name} stabilized as a cult node.`);
                    if (this.getCoalitionConversionAcceleration(unit.owner, node, 'CULT') > 0) {
                        this.log('COMBAT', `Proxy cascade pressure accelerated auto-conversion at ${node.name}.`);
                    }
                    this.log('ALERT', `${node.name} normalized around Movement institutions; what looked fringe now reads as competent local governance.`);
                    this.emit('NODE_CONVERTED', { nodeId: node.id, faction: unit.owner, type: 'CULT' });
                }
            }
        }
    }
    // --- Unit Destruction ---
    destroyUnit(unitId) {
        const unit = this.state.units.get(unitId);
        if (unit) {
            const node = this.state.nodes.get(unit.location);
            if (unit.owner === 'INFILTRATOR' && node && node.layer === 'TERRESTRIAL') {
                if (unit.type === 'CULT') {
                    node.substrate.exposure = Math.max(node.substrate.exposure, 5);
                    node.substrate.legitimacy = Math.max(node.substrate.legitimacy, 4);
                    node.substrate.trueBelievers = clamp(node.substrate.trueBelievers + 1, 0, 10);
                    node.substrate.rubes = clamp(node.substrate.rubes + 1, 0, 10);
                    if (node.type === 'HUB' && (node.substrate.trueBelievers >= 5 || node.substrate.legitimacy >= 7)) {
                        node.isCultNode = true;
                    }
                    this.log('SYSTEM', `${node.name}'s visible Movement cell was broken up, but the believers stayed in place and pushed the network deeper underground.`);
                }
                else if (unit.type === 'SWARM') {
                    node.substrate.exposure = Math.max(node.substrate.exposure, 5);
                    node.substrate.contractors = clamp(node.substrate.contractors + 2, 0, 10);
                    node.substrate.rubes = clamp(node.substrate.rubes + 1, 0, 10);
                    this.log('SYSTEM', `${node.name}'s contractors scattered after the raid, but kept servicing the Movement through deniable channels.`);
                }
            }
            this.state.units.delete(unitId);
            this.emit('UNIT_DESTROYED', { unitId, unit });
        }
    }
    // ==========================================================================
    // EVENT SYSTEM
    // ==========================================================================
    on(eventType: types_1.GameEventType | '*', listener: types_1.GameEventListener): void {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, []);
        }
        this.listeners.get(eventType).push(listener);
        return () => {
            const list = this.listeners.get(eventType);
            if (list) {
                const idx = list.indexOf(listener);
                if (idx >= 0)
                    list.splice(idx, 1);
            }
        };
    }
    emit(type, payload = {}): void {
        const event = {
            type,
            payload,
            turn: this.state.counters.turn,
            phase: this.state.phase,
            timestamp: this.nowFn()
        };
        const specific = this.listeners.get(type);
        if (specific)
            specific.forEach(l => l(event, this.state));
        const wildcard = this.listeners.get('*');
        if (wildcard)
            wildcard.forEach(l => l(event, this.state));
    }
    // ==========================================================================
    // LOGGING
    // ==========================================================================
    log(type, message) {
        this.state.logs.push({
            turn: this.state.counters.turn,
            phase: this.state.phase,
            message,
            type,
            timestamp: this.nowFn()
        });
    }
    generateId(): string {
        return `${this.nowFn()}_${this.randomFn().toString(36).slice(2, 11)}`;
    }
    getLogs(count?: number): types_1.GameLog[] {
        if (count) {
            return this.state.logs.slice(-count);
        }
        return [...this.state.logs];
    }
}
export { TheySingEngine };
export const theySingEngine = new TheySingEngine();
