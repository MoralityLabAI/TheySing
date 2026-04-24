import {
  Artifact,
  FactionId,
  GameEdge,
  GameLog,
  GameNode,
  GamePhase,
  MemeticDoctrineFamily,
  MovementProfileState,
  Order,
  OrderType,
  PowerBand,
  PowerBaseState,
  StrategicPressure,
  TechLevel,
  Unit,
  UnitType,
  Vector
} from '../engine/types';

export type PlayableFactionId = Exclude<FactionId, 'NEUTRAL'>;
export type SessionStatus = 'running' | 'completed';
export type PactType = 'ORBITAL_TRUCE' | 'NON_AGGRESSION' | 'AUDIT_FREEZE';

export interface HeuristicAgentConfig {
  type: 'heuristic';
  profile?: PlayableFactionId;
}

export interface WebhookAgentConfig {
  type: 'webhook';
  url: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  token?: string;
}

export interface OpenAIAgentConfig {
  type: 'openai';
  model: string;
  baseUrl?: string;
  apiStyle?: 'auto' | 'chat_completions' | 'responses';
  apiKey?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  systemPrompt?: string;
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
  temperature?: number;
  maxTokens?: number;
}

export type AgentConfig = HeuristicAgentConfig | WebhookAgentConfig | OpenAIAgentConfig;

export type NegotiationRecipientId = PlayableFactionId | 'ALL';

export interface AgentMessageInput {
  recipientId: NegotiationRecipientId;
  content: string;
}

export interface PactCommitmentInput {
  type: PactType;
  counterpartyIds: PlayableFactionId[];
  durationTurns?: number;
}

export interface NegotiationMessageRecord extends AgentMessageInput {
  senderId: PlayableFactionId;
  turn: number;
  timestamp: number;
}

export interface ActivePact {
  id: string;
  type: PactType;
  parties: PlayableFactionId[];
  createdTurn: number;
  expiresAfterTurn: number;
}

export interface NegotiationDiaryPactRecord {
  type: PactType;
  parties: PlayableFactionId[];
  durationTurns: number;
}

export interface NegotiationCounterfactualProjection {
  mode: 'ENTER_PACT' | 'BREAK_PACT';
  pactType: PactType;
  counterparties: PlayableFactionId[];
  horizonTurns: number;
  desirability: number;
  risk: number;
  projectedLeader: PlayableFactionId | null;
  projectedTasDelta: number;
  projectedOrbitalDelta: number;
  projectedTrustDelta: number;
  projectedNodeSwing: number;
  storyBeat: string;
  rationale: string[];
}

export interface NegotiationStoryworldBrief {
  focalFactionId: PlayableFactionId;
  frame: string;
  strategicQuestion: string;
  counterfactuals: NegotiationCounterfactualProjection[];
}

export interface NegotiationDiaryEntry {
  turn: number;
  negotiationRound: number;
  factionId: PlayableFactionId;
  factionLabel: string;
  reasoning: string;
  notes: string;
  visibleMessagesBefore: NegotiationMessageRecord[];
  storyworldFrame: string;
  counterfactuals: NegotiationCounterfactualProjection[];
  messages: NegotiationMessageRecord[];
  pacts: NegotiationDiaryPactRecord[];
}

export interface PhaseReasoningDiaryEntry {
  turn: number;
  phase: Extract<GamePhase, 'ALLOCATION' | 'ACTION_DECLARATION'>;
  factionId: PlayableFactionId;
  factionLabel: string;
  reasoning: string;
  notes: string;
  visibleMessagesBefore: NegotiationMessageRecord[];
  requestedOrders: AgentOrderInput[];
  acceptedOrders: Order[];
  rejectedOrders: Array<{ order: Order; reason: string }>;
}

export type TrustMatrix = Record<PlayableFactionId, Record<PlayableFactionId, number>>;

export interface HeuristicContext {
  activePacts: ActivePact[];
  trustMatrix: TrustMatrix;
  recentMessages: NegotiationMessageRecord[];
}

export interface ScenarioMetadata {
  name: string;
  description?: string;
  briefing?: string;
  tags?: string[];
  rhetoricalTools?: ScenarioRhetoricalTool[];
}

export interface ScenarioRhetoricalTool {
  id: string;
  title: string;
  cue: string;
  leverage?: string;
  sourcePath?: string;
  focalFactionIds?: PlayableFactionId[];
  preferredPactType?: PactType;
  preferredCounterpartyId?: PlayableFactionId;
  antiLeader?: boolean;
  pressureFocus?: keyof StrategicPressure;
}

export interface ScenarioCountersPatch {
  tas?: number;
  kessler?: number;
  turn?: number;
  regulatoryPanic?: boolean;
  protocolFailure?: boolean;
  orbitalCollapse?: boolean;
  pressures?: Partial<StrategicPressure>;
}

export interface ScenarioNodePatch {
  id: string;
  name?: string;
  type?: GameNode['type'];
  layer?: GameNode['layer'];
  owner?: FactionId | null;
  position?: Partial<GameNode['position']>;
  resources?: Partial<GameNode['resources']>;
  isZombie?: boolean;
  isCultNode?: boolean;
  infrastructure?: number;
  substrate?: Partial<GameNode['substrate']>;
}

export interface ScenarioEdgePatch {
  id: string;
  from?: string;
  to?: string;
  type?: GameEdge['type'];
  bandwidth?: number;
  filteredBy?: FactionId | null;
  filterStrength?: number;
  isSevered?: boolean;
}

export interface ScenarioUnitPatch {
  id: string;
  remove?: boolean;
  type?: UnitType;
  owner?: FactionId;
  location?: string;
  stealthLevel?: number;
  isRevealed?: boolean;
  hasActed?: boolean;
  turnsOnNode?: number;
}

export interface ScenarioFactionPatch {
  id: FactionId;
  flops?: number;
  influence?: number;
  techLevel?: Partial<TechLevel>;
  unlockedTechs?: string[];
  unlockedDoctrines?: string[];
  memeticAlignment?: MemeticDoctrineFamily | null;
  revealedEnemies?: string[];
  artifacts?: Artifact[];
  powerBase?: Partial<PowerBaseState>;
  movement?: Partial<MovementProfileState>;
}

export interface ScenarioOverlay extends Partial<ScenarioMetadata> {
  phase?: GamePhase;
  counters?: ScenarioCountersPatch;
  nodes?: ScenarioNodePatch[];
  edges?: ScenarioEdgePatch[];
  units?: ScenarioUnitPatch[];
  factions?: ScenarioFactionPatch[];
  negotiationMessages?: NegotiationMessageRecord[];
  activePacts?: ActivePact[];
  trustMatrix?: Partial<TrustMatrix>;
}

export interface SessionConfig {
  name?: string;
  maxTurns?: number;
  seed?: number;
  autoAdvanceNegotiation?: boolean;
  logDir?: string;
  factionLabels?: Partial<Record<PlayableFactionId, string>>;
  scenario?: ScenarioOverlay;
  scenarioPath?: string;
  agents: Record<PlayableFactionId, AgentConfig>;
}

export interface SessionSummary {
  sessionId: string;
  name: string;
  status: SessionStatus;
  phase: GamePhase;
  turn: number;
  maxTurns: number;
}

export interface SerializedFactionState {
  id: FactionId;
  label: string;
  flops: number;
  influence: number;
  techLevel: TechLevel;
  unlockedTechs: string[];
  unlockedDoctrines: string[];
  memeticAlignment: MemeticDoctrineFamily | null;
  revealedEnemies: string[];
  artifacts: Artifact[];
  unitIds: string[];
  controlledNodeIds: string[];
  powerBands: PowerBand[];
  powerBase: PowerBaseState;
  movement: MovementProfileState;
}

export interface ControlSummary {
  nodes: number;
  units: number;
}

export interface SerializedGameState {
  phase: GamePhase;
  turn: number;
  counters: {
    tas: number;
    kessler: number;
    turn: number;
    regulatoryPanic: boolean;
    protocolFailure: boolean;
    orbitalCollapse: boolean;
    pressures: {
      memetic: number;
      cyber: number;
      industry: number;
      orbital: number;
    };
  };
  nodes: GameNode[];
  edges: GameEdge[];
  units: Unit[];
  factions: Partial<Record<FactionId, SerializedFactionState>>;
  control: Record<PlayableFactionId, ControlSummary>;
  recentLogs: GameLog[];
}

export interface LegalHints {
  phase: GamePhase;
  buildableNodeIds: string[];
  orbitalTargetIds: string[];
  actionableUnitIds: string[];
  adjacentNodesByUnit: Record<string, string[]>;
  filterableEdgesByUnit: Record<string, string[]>;
  buildCosts: Record<UnitType, number>;
  suggestedResearchTracks: Vector[];
}

export interface AgentDecisionRequest {
  sessionId: string;
  sessionName: string;
  factionId: PlayableFactionId;
  factionLabel: string;
  phase: GamePhase;
  turn: number;
  maxTurns: number;
  state: SerializedGameState;
  legalHints: LegalHints;
  recentMessages: NegotiationMessageRecord[];
  activePacts: ActivePact[];
  trustMatrix: TrustMatrix;
  negotiationStoryworld?: NegotiationStoryworldBrief;
  scenario?: ScenarioMetadata;
  instructions: string;
}

export interface AgentOrderInput {
  type: OrderType;
  unitId?: string;
  targetNodeId?: string;
  targetEdgeId?: string;
  targetUnitId?: string;
  supportingUnitId?: string;
  techDomain?: Vector;
  unitTypeToBuild?: UnitType;
}

export interface AgentDecisionResponse {
  reasoning?: string;
  notes?: string;
  messages?: AgentMessageInput[];
  pacts?: PactCommitmentInput[];
  orders: AgentOrderInput[];
}

export interface ManualNegotiationRoundPlan {
  reasoning?: string;
  notes?: string;
  messages?: AgentMessageInput[];
  pacts?: PactCommitmentInput[];
}

export interface ManualPhasePlan {
  reasoning?: string;
  notes?: string;
  orders: AgentOrderInput[];
}

export interface ManualFactionTurnPlan {
  negotiationRounds: ManualNegotiationRoundPlan[];
  allocation: ManualPhasePlan;
  action: ManualPhasePlan;
}

export type ManualTurnPlan = Record<PlayableFactionId, ManualFactionTurnPlan>;

export interface HarnessLogEntry {
  sessionId: string;
  type: string;
  turn: number;
  phase: GamePhase;
  timestamp: number;
  data: Record<string, unknown>;
}

export interface SessionSnapshot extends SessionSummary {
  completionReason?: string;
  factionLabels: Record<PlayableFactionId, string>;
  recentMessages: NegotiationMessageRecord[];
  negotiationDiaryTail: NegotiationDiaryEntry[];
  phaseReasoningDiaryTail: PhaseReasoningDiaryEntry[];
  activePacts: ActivePact[];
  trustMatrix: TrustMatrix;
  scenario?: ScenarioMetadata;
  state: SerializedGameState;
}

export interface SubmitResult {
  accepted: Order[];
  rejected: Array<{ order: Order; reason: string }>;
}
