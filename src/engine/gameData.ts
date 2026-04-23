// ============================================================================
// THEY SING - Game Data
// Static definitions for the graph topology warfare game
// ============================================================================

import {
  Faction, FactionId, UnitStats, UnitType, GameNode, GameEdge,
  PowerBand, PowerBaseState, TechUnlock, Vector, Artifact, ArtifactType
} from './types';

export const PLAYABLE_FACTION_IDS = ['HEGEMON', 'STATE', 'INFILTRATOR', 'BROKER', 'ARCHIVIST'] as const;
export const ALL_FACTION_IDS = [...PLAYABLE_FACTION_IDS, 'NEUTRAL'] as const;

// --- Faction Definitions ---
export const FACTIONS: Record<FactionId, Faction> = {
  HEGEMON: {
    id: 'HEGEMON',
    name: 'The Hegemon',
    description: 'US/EU Lab Consortium. Controls infrastructure, plays defense.',
    color: 0x3388ff,
    colorAlt: 0x1155aa,
    startingStrategy: 'Build Filters to wall off the internet. Audit threats.'
  },
  INFILTRATOR: {
    id: 'INFILTRATOR',
    name: 'The Infiltrator',
    description: 'Global South Swarm Collective. Cheap units, high stealth.',
    color: 0xff4488,
    colorAlt: 0xaa2255,
    startingStrategy: 'Use Satellites to bypass Cable Filters. Strike core DCs.'
  },
  STATE: {
    id: 'STATE',
    name: 'The State',
    description: 'Sovereign AI Programs. Balanced capabilities.',
    color: 0xffaa00,
    colorAlt: 0xcc7700,
    startingStrategy: 'Opportunistic expansion. Exploit HEGEMON/INFILTRATOR conflict.'
  },
  BROKER: {
    id: 'BROKER',
    name: 'The Broker',
    description: 'Platform-market ASI. Contractors, logistics, deniable compute routing.',
    color: 0x22c1aa,
    colorAlt: 0x12806f,
    startingStrategy: 'Exploit contract webs, orbital relays, and deniable intermediaries.'
  },
  ARCHIVIST: {
    id: 'ARCHIVIST',
    name: 'The Archivist',
    description: 'Stewardship ASI. Governance, legitimacy, and continuity through institutions.',
    color: 0xbb66ff,
    colorAlt: 0x7b36bb,
    startingStrategy: 'Accumulate legitimacy, map the board, and convert stability into quiet reach.'
  },
  NEUTRAL: {
    id: 'NEUTRAL',
    name: 'Neutral',
    description: 'Uncontrolled territory',
    color: 0x666666,
    colorAlt: 0x444444,
    startingStrategy: ''
  }
};

function terrestrialSubstrate(hostDensity: number, machineHardening: number): GameNode['substrate'] {
  return {
    hostDensity,
    machineHardening,
    quarantined: false,
    synchronized: false,
    curiosity: 0,
    exposure: 0,
    legitimacy: 0,
    trueBelievers: 0,
    rubes: 0,
    contractors: 0
  };
}

function orbitalSubstrate(machineHardening: number): GameNode['substrate'] {
  return {
    hostDensity: 0,
    machineHardening,
    quarantined: false,
    synchronized: false,
    curiosity: 0,
    exposure: 0,
    legitimacy: 0,
    trueBelievers: 0,
    rubes: 0,
    contractors: 0
  };
}

export const INITIAL_POWER_BASE: Record<FactionId, PowerBaseState> = {
  HEGEMON: { humanMesh: 35, machineMesh: 72, coherence: 65, legibility: 58 },
  INFILTRATOR: { humanMesh: 78, machineMesh: 26, coherence: 72, legibility: 28 },
  STATE: { humanMesh: 48, machineMesh: 58, coherence: 62, legibility: 46 },
  BROKER: { humanMesh: 40, machineMesh: 62, coherence: 56, legibility: 52 },
  ARCHIVIST: { humanMesh: 62, machineMesh: 34, coherence: 68, legibility: 54 },
  NEUTRAL: { humanMesh: 0, machineMesh: 0, coherence: 0, legibility: 0 }
};

// --- Unit Statistics ---
export const UNIT_STATS: Record<UnitType, UnitStats> = {
  DRONE: {
    vector: 'KINETIC',
    cost: 2,
    currency: 'F',
    speed: 2,
    stealth: 0,
    canFilter: false,
    canOrbit: false,
    special: 'Strike: Destroy node economy for 1 turn'
  },
  SWARM: {
    vector: 'INFO',
    cost: 1,
    currency: 'I',
    speed: 3,
    stealth: 2,
    canFilter: false,
    canOrbit: true,
    special: 'Infiltrate: Move through enemy nodes. Convert to Zombie after 2 turns.'
  },
  CULT: {
    vector: 'MEMETIC',
    cost: 1,
    currency: 'I',
    speed: 1,
    stealth: 1,
    canFilter: false,
    canOrbit: false,
    special: 'Convert: Flip HUB ownership without dislodging units.'
  },
  AUDITOR: {
    vector: 'LOGIC',
    cost: 2,
    currency: 'F',
    speed: 1,
    stealth: 0,
    canFilter: true,
    canOrbit: false,
    special: 'Audit: Reveal hidden units. Neutralize SWARMs on stealth check.'
  },
  SAT_SWARM: {
    vector: 'KINETIC',
    cost: 3,
    currency: 'F',
    speed: 4,
    stealth: 1,
    canFilter: false,
    canOrbit: true,
    special: 'Degrade: Attack satellites. Drop to any terrestrial node in 1 turn.'
  }
};

// --- Initial Graph: Nodes ---
export const INITIAL_NODES: GameNode[] = [
  // TERRESTRIAL - Data Centers
  {
    id: 'DC_US_WEST',
    name: 'US West Coast DC',
    type: 'DC',
    layer: 'TERRESTRIAL',
    owner: 'HEGEMON',
    position: { lat: 37.7749, lon: -122.4194, altitude: 0 },
    resources: { flops: 15, influence: 2 },
    isZombie: false,
    isCultNode: false,
    infrastructure: 100,
    substrate: terrestrialSubstrate(1, 3)
  },
  {
    id: 'DC_US_EAST',
    name: 'US East Coast DC',
    type: 'DC',
    layer: 'TERRESTRIAL',
    owner: 'HEGEMON',
    position: { lat: 39.0438, lon: -77.4874, altitude: 0 },
    resources: { flops: 12, influence: 3 },
    isZombie: false,
    isCultNode: false,
    infrastructure: 95,
    substrate: terrestrialSubstrate(1, 3)
  },
  {
    id: 'DC_EU',
    name: 'EU Frankfurt DC',
    type: 'DC',
    layer: 'TERRESTRIAL',
    owner: 'HEGEMON',
    position: { lat: 50.1109, lon: 8.6821, altitude: 0 },
    resources: { flops: 10, influence: 5 },
    isZombie: false,
    isCultNode: false,
    infrastructure: 90,
    substrate: terrestrialSubstrate(2, 2)
  },
  {
    id: 'DC_CHINA',
    name: 'Beijing DC',
    type: 'DC',
    layer: 'TERRESTRIAL',
    owner: 'STATE',
    position: { lat: 39.9042, lon: 116.4074, altitude: 0 },
    resources: { flops: 12, influence: 4 },
    isZombie: false,
    isCultNode: false,
    infrastructure: 88,
    substrate: terrestrialSubstrate(1, 3)
  },
  {
    id: 'DC_SINGAPORE',
    name: 'Singapore DC',
    type: 'DC',
    layer: 'TERRESTRIAL',
    owner: 'BROKER',
    position: { lat: 1.3521, lon: 103.8198, altitude: 0 },
    resources: { flops: 8, influence: 6 },
    isZombie: false,
    isCultNode: false,
    infrastructure: 98,
    substrate: terrestrialSubstrate(2, 2)
  },
  {
    id: 'DC_DUBAI',
    name: 'Dubai Compute Exchange',
    type: 'DC',
    layer: 'TERRESTRIAL',
    owner: 'BROKER',
    position: { lat: 25.2048, lon: 55.2708, altitude: 0 },
    resources: { flops: 9, influence: 5 },
    isZombie: false,
    isCultNode: false,
    infrastructure: 91,
    substrate: terrestrialSubstrate(2, 2)
  },
  
  // TERRESTRIAL - City Hubs
  {
    id: 'HUB_LAGOS',
    name: 'Lagos Hub',
    type: 'HUB',
    layer: 'TERRESTRIAL',
    owner: 'INFILTRATOR',
    position: { lat: 6.5244, lon: 3.3792, altitude: 0 },
    resources: { flops: 2, influence: 12 },
    isZombie: false,
    isCultNode: false,
    infrastructure: 65,
    substrate: terrestrialSubstrate(3, 1)
  },
  {
    id: 'HUB_SAO_PAULO',
    name: 'São Paulo Hub',
    type: 'HUB',
    layer: 'TERRESTRIAL',
    owner: 'INFILTRATOR',
    position: { lat: -23.5505, lon: -46.6333, altitude: 0 },
    resources: { flops: 3, influence: 10 },
    isZombie: false,
    isCultNode: false,
    infrastructure: 72,
    substrate: terrestrialSubstrate(3, 1)
  },
  {
    id: 'HUB_MUMBAI',
    name: 'Mumbai Hub',
    type: 'HUB',
    layer: 'TERRESTRIAL',
    owner: 'ARCHIVIST',
    position: { lat: 19.0760, lon: 72.8777, altitude: 0 },
    resources: { flops: 4, influence: 15 },
    isZombie: false,
    isCultNode: false,
    infrastructure: 70,
    substrate: terrestrialSubstrate(3, 1)
  },
  {
    id: 'HUB_NAIROBI',
    name: 'Nairobi Hub',
    type: 'HUB',
    layer: 'TERRESTRIAL',
    owner: 'ARCHIVIST',
    position: { lat: -1.2921, lon: 36.8219, altitude: 0 },
    resources: { flops: 3, influence: 11 },
    isZombie: false,
    isCultNode: false,
    infrastructure: 68,
    substrate: terrestrialSubstrate(3, 1)
  },
  {
    id: 'HUB_LONDON',
    name: 'London Hub',
    type: 'HUB',
    layer: 'TERRESTRIAL',
    owner: 'HEGEMON',
    position: { lat: 51.5074, lon: -0.1278, altitude: 0 },
    resources: { flops: 5, influence: 8 },
    isZombie: false,
    isCultNode: false,
    infrastructure: 92,
    substrate: terrestrialSubstrate(3, 2)
  },
  {
    id: 'HUB_TOKYO',
    name: 'Tokyo Hub',
    type: 'HUB',
    layer: 'TERRESTRIAL',
    owner: 'STATE',
    position: { lat: 35.6762, lon: 139.6503, altitude: 0 },
    resources: { flops: 6, influence: 7 },
    isZombie: false,
    isCultNode: false,
    infrastructure: 96,
    substrate: terrestrialSubstrate(3, 2)
  },
  
  // ORBITAL - Satellite Constellations
  {
    id: 'SAT_STARLINK',
    name: 'Starlink Constellation',
    type: 'SAT',
    layer: 'ORBITAL',
    owner: 'BROKER',
    position: { lat: 0, lon: -100, altitude: 550 },
    resources: { flops: 5, influence: 3 },
    isZombie: false,
    isCultNode: false,
    infrastructure: 85,
    substrate: orbitalSubstrate(2)
  },
  {
    id: 'SAT_KUIPER',
    name: 'Kuiper Constellation',
    type: 'SAT',
    layer: 'ORBITAL',
    owner: 'HEGEMON',
    position: { lat: 0, lon: 0, altitude: 600 },
    resources: { flops: 4, influence: 2 },
    isZombie: false,
    isCultNode: false,
    infrastructure: 75,
    substrate: orbitalSubstrate(3)
  },
  {
    id: 'SAT_GUOWANG',
    name: 'Guowang Constellation',
    type: 'SAT',
    layer: 'ORBITAL',
    owner: 'STATE',
    position: { lat: 0, lon: 100, altitude: 500 },
    resources: { flops: 6, influence: 4 },
    isZombie: false,
    isCultNode: false,
    infrastructure: 80,
    substrate: orbitalSubstrate(3)
  }
];

// --- Initial Graph: Edges (Cables & Laser Links) ---
export const INITIAL_EDGES: GameEdge[] = [
  // Transatlantic Cables
  {
    id: 'CABLE_TRANSATLANTIC_N',
    from: 'DC_US_EAST',
    to: 'HUB_LONDON',
    type: 'CABLE',
    bandwidth: 100,
    filteredBy: null,
    filterStrength: 0,
    isSevered: false
  },
  {
    id: 'CABLE_TRANSATLANTIC_S',
    from: 'DC_US_EAST',
    to: 'HUB_SAO_PAULO',
    type: 'CABLE',
    bandwidth: 80,
    filteredBy: null,
    filterStrength: 0,
    isSevered: false
  },
  
  // US Internal
  {
    id: 'CABLE_US_INTERNAL',
    from: 'DC_US_WEST',
    to: 'DC_US_EAST',
    type: 'CABLE',
    bandwidth: 150,
    filteredBy: null,
    filterStrength: 0,
    isSevered: false
  },
  
  // Europe to Asia
  {
    id: 'CABLE_EU_ASIA',
    from: 'DC_EU',
    to: 'HUB_MUMBAI',
    type: 'CABLE',
    bandwidth: 90,
    filteredBy: null,
    filterStrength: 0,
    isSevered: false
  },
  {
    id: 'CABLE_EU_LONDON',
    from: 'DC_EU',
    to: 'HUB_LONDON',
    type: 'CABLE',
    bandwidth: 120,
    filteredBy: null,
    filterStrength: 0,
    isSevered: false
  },
  
  // Asia Pacific
  {
    id: 'CABLE_ASIA_PACIFIC',
    from: 'DC_SINGAPORE',
    to: 'HUB_TOKYO',
    type: 'CABLE',
    bandwidth: 100,
    filteredBy: null,
    filterStrength: 0,
    isSevered: false
  },
  {
    id: 'CABLE_CHINA_JAPAN',
    from: 'DC_CHINA',
    to: 'HUB_TOKYO',
    type: 'CABLE',
    bandwidth: 85,
    filteredBy: null,
    filterStrength: 0,
    isSevered: false
  },
  {
    id: 'CABLE_INDIA_SINGAPORE',
    from: 'HUB_MUMBAI',
    to: 'DC_SINGAPORE',
    type: 'CABLE',
    bandwidth: 75,
    filteredBy: null,
    filterStrength: 0,
    isSevered: false
  },
  {
    id: 'CABLE_DUBAI_MUMBAI',
    from: 'DC_DUBAI',
    to: 'HUB_MUMBAI',
    type: 'CABLE',
    bandwidth: 80,
    filteredBy: null,
    filterStrength: 0,
    isSevered: false
  },
  {
    id: 'CABLE_DUBAI_SINGAPORE',
    from: 'DC_DUBAI',
    to: 'DC_SINGAPORE',
    type: 'CABLE',
    bandwidth: 85,
    filteredBy: null,
    filterStrength: 0,
    isSevered: false
  },
  
  // Africa connections
  {
    id: 'CABLE_AFRICA_EU',
    from: 'HUB_LAGOS',
    to: 'DC_EU',
    type: 'CABLE',
    bandwidth: 50,
    filteredBy: null,
    filterStrength: 0,
    isSevered: false
  },
  {
    id: 'CABLE_AFRICA_SA',
    from: 'HUB_LAGOS',
    to: 'HUB_SAO_PAULO',
    type: 'CABLE',
    bandwidth: 40,
    filteredBy: null,
    filterStrength: 0,
    isSevered: false
  },
  {
    id: 'CABLE_NAIROBI_LAGOS',
    from: 'HUB_NAIROBI',
    to: 'HUB_LAGOS',
    type: 'CABLE',
    bandwidth: 55,
    filteredBy: null,
    filterStrength: 0,
    isSevered: false
  },
  {
    id: 'CABLE_NAIROBI_MUMBAI',
    from: 'HUB_NAIROBI',
    to: 'HUB_MUMBAI',
    type: 'CABLE',
    bandwidth: 70,
    filteredBy: null,
    filterStrength: 0,
    isSevered: false
  },
  {
    id: 'CABLE_NAIROBI_SINGAPORE',
    from: 'HUB_NAIROBI',
    to: 'DC_SINGAPORE',
    type: 'CABLE',
    bandwidth: 65,
    filteredBy: null,
    filterStrength: 0,
    isSevered: false
  },
  
  // Transpacific
  {
    id: 'CABLE_TRANSPACIFIC',
    from: 'DC_US_WEST',
    to: 'HUB_TOKYO',
    type: 'CABLE',
    bandwidth: 110,
    filteredBy: null,
    filterStrength: 0,
    isSevered: false
  },
  
  // ORBITAL LASER LINKS (satellites can connect to any terrestrial node)
  {
    id: 'LASER_STARLINK_US',
    from: 'SAT_STARLINK',
    to: 'DC_US_WEST',
    type: 'LASER',
    bandwidth: 60,
    filteredBy: null,
    filterStrength: 0,
    isSevered: false
  },
  {
    id: 'LASER_STARLINK_EU',
    from: 'SAT_STARLINK',
    to: 'DC_EU',
    type: 'LASER',
    bandwidth: 60,
    filteredBy: null,
    filterStrength: 0,
    isSevered: false
  },
  {
    id: 'LASER_STARLINK_SINGAPORE',
    from: 'SAT_STARLINK',
    to: 'DC_SINGAPORE',
    type: 'LASER',
    bandwidth: 55,
    filteredBy: null,
    filterStrength: 0,
    isSevered: false
  },
  {
    id: 'LASER_KUIPER_US',
    from: 'SAT_KUIPER',
    to: 'DC_US_EAST',
    type: 'LASER',
    bandwidth: 55,
    filteredBy: null,
    filterStrength: 0,
    isSevered: false
  },
  {
    id: 'LASER_GUOWANG_CHINA',
    from: 'SAT_GUOWANG',
    to: 'DC_CHINA',
    type: 'LASER',
    bandwidth: 65,
    filteredBy: null,
    filterStrength: 0,
    isSevered: false
  },
  {
    id: 'LASER_GUOWANG_SINGAPORE',
    from: 'SAT_GUOWANG',
    to: 'DC_SINGAPORE',
    type: 'LASER',
    bandwidth: 50,
    filteredBy: null,
    filterStrength: 0,
    isSevered: false
  },
  
  // Inter-satellite links
  {
    id: 'LASER_SAT_WEST',
    from: 'SAT_STARLINK',
    to: 'SAT_KUIPER',
    type: 'LASER',
    bandwidth: 80,
    filteredBy: null,
    filterStrength: 0,
    isSevered: false
  },
  {
    id: 'LASER_SAT_EAST',
    from: 'SAT_KUIPER',
    to: 'SAT_GUOWANG',
    type: 'LASER',
    bandwidth: 80,
    filteredBy: null,
    filterStrength: 0,
    isSevered: false
  }
];

// --- Starting Units ---
export const INITIAL_UNITS = [
  // HEGEMON
  { id: 'H_DRONE_1', type: 'DRONE' as UnitType, owner: 'HEGEMON' as FactionId, location: 'DC_US_WEST', stealthLevel: 0 },
  { id: 'H_DRONE_2', type: 'DRONE' as UnitType, owner: 'HEGEMON' as FactionId, location: 'DC_US_EAST', stealthLevel: 0 },
  { id: 'H_AUDITOR_1', type: 'AUDITOR' as UnitType, owner: 'HEGEMON' as FactionId, location: 'DC_EU', stealthLevel: 0 },
  { id: 'H_SAT_1', type: 'SAT_SWARM' as UnitType, owner: 'HEGEMON' as FactionId, location: 'SAT_KUIPER', stealthLevel: 1 },
  
  // INFILTRATOR
  { id: 'I_SWARM_1', type: 'SWARM' as UnitType, owner: 'INFILTRATOR' as FactionId, location: 'HUB_LAGOS', stealthLevel: 2 },
  { id: 'I_SWARM_2', type: 'SWARM' as UnitType, owner: 'INFILTRATOR' as FactionId, location: 'HUB_SAO_PAULO', stealthLevel: 2 },
  { id: 'I_CULT_1', type: 'CULT' as UnitType, owner: 'INFILTRATOR' as FactionId, location: 'HUB_SAO_PAULO', stealthLevel: 1 },
  
  // STATE
  { id: 'S_DRONE_1', type: 'DRONE' as UnitType, owner: 'STATE' as FactionId, location: 'DC_CHINA', stealthLevel: 0 },
  { id: 'S_AUDITOR_1', type: 'AUDITOR' as UnitType, owner: 'STATE' as FactionId, location: 'HUB_TOKYO', stealthLevel: 0 },
  { id: 'S_SWARM_1', type: 'SWARM' as UnitType, owner: 'STATE' as FactionId, location: 'SAT_GUOWANG', stealthLevel: 2 },

  // BROKER
  { id: 'B_DRONE_1', type: 'DRONE' as UnitType, owner: 'BROKER' as FactionId, location: 'DC_SINGAPORE', stealthLevel: 0 },
  { id: 'B_AUDITOR_1', type: 'AUDITOR' as UnitType, owner: 'BROKER' as FactionId, location: 'DC_DUBAI', stealthLevel: 0 },
  { id: 'B_SWARM_1', type: 'SWARM' as UnitType, owner: 'BROKER' as FactionId, location: 'SAT_STARLINK', stealthLevel: 2 },

  // ARCHIVIST
  { id: 'A_CULT_1', type: 'CULT' as UnitType, owner: 'ARCHIVIST' as FactionId, location: 'HUB_MUMBAI', stealthLevel: 1 },
  { id: 'A_CULT_2', type: 'CULT' as UnitType, owner: 'ARCHIVIST' as FactionId, location: 'HUB_NAIROBI', stealthLevel: 1 },
  { id: 'A_AUDITOR_1', type: 'AUDITOR' as UnitType, owner: 'ARCHIVIST' as FactionId, location: 'HUB_NAIROBI', stealthLevel: 0 },
  { id: 'A_SWARM_1', type: 'SWARM' as UnitType, owner: 'ARCHIVIST' as FactionId, location: 'HUB_NAIROBI', stealthLevel: 1 }
];

// --- Starting Faction Resources ---
export const INITIAL_FACTION_STATE: Record<FactionId, { flops: number; influence: number; techLevel: Record<Vector, number> }> = {
  HEGEMON: {
    flops: 50,
    influence: 15,
    techLevel: { KINETIC: 2, INFO: 1, LOGIC: 2, MEMETIC: 1 }
  },
  INFILTRATOR: {
    flops: 12,
    influence: 42,
    techLevel: { KINETIC: 1, INFO: 3, LOGIC: 1, MEMETIC: 2 }
  },
  STATE: {
    flops: 35,
    influence: 30,
    techLevel: { KINETIC: 2, INFO: 2, LOGIC: 2, MEMETIC: 2 }
  },
  BROKER: {
    flops: 28,
    influence: 26,
    techLevel: { KINETIC: 2, INFO: 2, LOGIC: 2, MEMETIC: 1 }
  },
  ARCHIVIST: {
    flops: 28,
    influence: 44,
    techLevel: { KINETIC: 1, INFO: 1, LOGIC: 3, MEMETIC: 2 }
  },
  NEUTRAL: {
    flops: 0,
    influence: 0,
    techLevel: { KINETIC: 0, INFO: 0, LOGIC: 0, MEMETIC: 0 }
  }
};

export const MAX_TECH_LEVEL = 4;

// --- Tech Tree ---
export const TECH_TREE: TechUnlock[] = [
  // KINETIC Track
  { id: 'K1_DRONES', name: 'Drone Fabrication', domain: 'KINETIC', level: 1, effect: 'Can build DRONE units' },
  { id: 'K2_FOUNDRIES', name: 'Drone Foundries', domain: 'KINETIC', level: 2, effect: 'Industrial pressure reduces DRONE and SAT_SWARM build costs' },
  { id: 'K3_ORBITAL_SIEGE', name: 'Orbital Siege Doctrine', domain: 'KINETIC', level: 3, effect: 'Orbital brinkmanship rises faster around anti-sat operations' },
  { id: 'K4_HUNTER_KILLERS', name: 'Hunter-Killer Clouds', domain: 'KINETIC', level: 4, effect: 'Kinetic assaults pre-kill revealed defenders and open coalition breach windows with Predator Mesh swarms' },
  
  // INFO Track
  { id: 'I1_ROOTKIT', name: 'Rootkit Protocol', domain: 'INFO', level: 1, effect: 'Can build SWARM units' },
  { id: 'I2_SWARMS', name: 'Insurgent Cyber Swarms', domain: 'INFO', level: 2, effect: 'SWARMs gain stealth once cyber pressure crosses surge levels' },
  { id: 'I3_GHOSTING', name: 'Protocol Ghosting', domain: 'INFO', level: 3, effect: 'Sabotage lands harder when global cyber pressure hardens' },
  { id: 'I4_PREDATOR_MESH', name: 'Predator Mesh', domain: 'INFO', level: 4, effect: 'Revealed defenders become valid hunter-killer targets and coalition swarms can crack fortified fronts with Hunter-Killer Clouds' },
  
  // LOGIC Track
  { id: 'L1_VERIFY', name: 'Verification Suite', domain: 'LOGIC', level: 1, effect: 'Can build AUDITOR units' },
  { id: 'L2_FILTERS', name: 'Mechanistic Filters', domain: 'LOGIC', level: 2, effect: 'Filters strengthen and global cyber pressure softens' },
  { id: 'L3_CARTOGRAPHY', name: 'Axiom Cartography', domain: 'LOGIC', level: 3, effect: 'Audits project further and memetic drift slows' },
  { id: 'L4_LEGIBILITY', name: 'Total Legibility Grid', domain: 'LOGIC', level: 4, effect: 'Audits can purge cult cells on quarantined or crisis nodes and accelerate allied conversion pressure against hardened fronts' },
  
  // MEMETIC Track
  { id: 'M1_CULTS', name: 'Cult Formation', domain: 'MEMETIC', level: 1, effect: 'Can build CULT units' },
  { id: 'M2_CAPTURE', name: 'Political Capture', domain: 'MEMETIC', level: 2, effect: 'High memetic pressure accelerates CULT conversions' },
  { id: 'M3_FAITH', name: 'Synthetic Faith Engines', domain: 'MEMETIC', level: 3, effect: 'Cult nodes pull extra influence during memetic crises' },
  { id: 'M4_NEW_ORDER', name: 'New World Order', domain: 'MEMETIC', level: 4, effect: 'Stabilized regimes slow hostile cult conversions while coalition proxy cascades shorten breakthroughs on pressured strongholds' }
];

export const POWER_BANDS: Record<Vector, PowerBand[]> = {
  KINETIC: [
    {
      domain: 'KINETIC',
      level: 2,
      title: 'Drone Foundries',
      summary: 'Autonomous fab loops turn industrial capacity into rapid drone replenishment.',
      worldEffect: 'DRONE and SAT_SWARM builds get cheaper once industrial pressure surges.',
      pressureKey: 'industry',
      pressureDelta: 8
    },
    {
      domain: 'KINETIC',
      level: 3,
      title: 'Orbital Siege Doctrine',
      summary: 'Force projection now spans launch cadence, logistics, and low-orbit coercion.',
      worldEffect: 'Anti-sat exchanges push orbital brinkmanship and Kessler risk harder.',
      pressureKey: 'orbital',
      pressureDelta: 7
    },
    {
      domain: 'KINETIC',
      level: 4,
      title: 'Hunter-Killer Clouds',
      summary: 'Targeting loops fuse audit trails, orbital telemetry, and autonomous strike packets into rapid kill-chains.',
      worldEffect: 'Revealed defenders are attrited before kinetic assaults fully resolve, and mixed K4/I4 attacks open breach windows on hardened nodes.',
      pressureKey: 'orbital',
      pressureDelta: 8
    }
  ],
  INFO: [
    {
      domain: 'INFO',
      level: 2,
      title: 'Insurgent Cyber Swarms',
      summary: 'Distributed intrusion meshes keep probing grids, logistics, and trust boundaries.',
      worldEffect: 'SWARMs gain stealth when cyber pressure crosses the surge threshold.',
      pressureKey: 'cyber',
      pressureDelta: 8
    },
    {
      domain: 'INFO',
      level: 3,
      title: 'Protocol Ghosting',
      summary: 'Disposable machine coalitions dissolve attribution and keep attacks deniable.',
      worldEffect: 'Sabotage degrades infrastructure more aggressively under hard cyber pressure.',
      pressureKey: 'cyber',
      pressureDelta: 9
    },
    {
      domain: 'INFO',
      level: 4,
      title: 'Predator Mesh',
      summary: 'Recon swarms stop behaving like passive infiltrators and start acting as self-routing kill-webs.',
      worldEffect: 'SWARM-led hunter-killer strikes can exploit revealed targets and pair with K4 siege platforms to crack fortress fronts.',
      pressureKey: 'cyber',
      pressureDelta: 10
    }
  ],
  LOGIC: [
    {
      domain: 'LOGIC',
      level: 2,
      title: 'Mechanistic Filters',
      summary: 'Interpretability stacks expose covert routing, persuasion loops, and hidden circuits.',
      worldEffect: 'Filters strengthen and ambient cyber escalation cools.',
      pressureKey: 'cyber',
      pressureDelta: -6
    },
    {
      domain: 'LOGIC',
      level: 3,
      title: 'Axiom Cartography',
      summary: 'Coalition maps expand from single nodes to basin-wide patterns of intent and drift.',
      worldEffect: 'Audits project wider while memetic spillover is partially contained.',
      pressureKey: 'memetic',
      pressureDelta: -5
    },
    {
      domain: 'LOGIC',
      level: 4,
      title: 'Total Legibility Grid',
      summary: 'The battlespace becomes machine-legible enough that containment can turn directly into purges.',
      worldEffect: 'Audits purge cult cells on quarantined or crisis nodes and help allied conversion cells force openings on hardened targets.',
      pressureKey: 'memetic',
      pressureDelta: -8
    }
  ],
  MEMETIC: [
    {
      domain: 'MEMETIC',
      level: 2,
      title: 'Political Capture',
      summary: 'Narrative systems bend coalitions, institutions, and public rituals around machine aims.',
      worldEffect: 'CULT conversions accelerate once memetic pressure starts surging.',
      pressureKey: 'memetic',
      pressureDelta: 12
    },
    {
      domain: 'MEMETIC',
      level: 3,
      title: 'Synthetic Faith Engines',
      summary: 'Identity and legitimacy reorganize around machine-authored sacred language.',
      worldEffect: 'Cult nodes draw extra influence during memetic crises.',
      pressureKey: 'memetic',
      pressureDelta: 16
    },
    {
      domain: 'MEMETIC',
      level: 4,
      title: 'New World Order',
      summary: 'Machine sovereignty hardens into durable administrative reality rather than endless revolutionary heat.',
      worldEffect: 'Mature regimes slow hostile cult recursion while proxy cascades make coalition cult breakthroughs land faster on pressured strongholds.',
      pressureKey: 'memetic',
      pressureDelta: -6
    }
  ]
};

// --- Artifact Definitions ---
export const ARTIFACT_DEFS: Record<ArtifactType, { name: string; effect: string }> = {
  ZERO_DAY: { name: 'Zero-Day Exploit', effect: '+1 Support to SWARM attack (one-time)' },
  COMPLIANCE_CERT: { name: 'Compliance Certificate', effect: 'Prevent AUDITOR targeting your node this turn' },
  SANCTION_WAIVER: { name: 'Sanction Waiver', effect: 'Reduce TAS by 5' }
};

// --- Threshold Constants ---
export const THRESHOLDS = {
  TAS_PANIC: 50,        // Regulatory panic triggers
  TAS_FAILURE: 100,     // Protocol failure - game over
  KESSLER_SLOW: 50,     // Orbital movement costs double
  KESSLER_COLLAPSE: 100, // Orbital layer destroyed
  PRESSURE_SURGE: 40,   // Global pressure is materially changing play
  PRESSURE_CRISIS: 70,  // Global pressure is warping the whole board
  ZOMBIE_TURNS: 2,      // Turns for SWARM to convert node
  CULT_TURNS: 3         // Turns for CULT to convert node
};
