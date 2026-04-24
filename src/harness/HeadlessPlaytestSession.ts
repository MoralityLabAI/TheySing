import { appendFile, mkdir } from 'fs/promises';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import { randomBytes } from 'crypto';

import { TheySingEngine } from '../engine/TheySingEngine';
import { GamePhase, Order, OrderType } from '../engine/types';
import { decideHeuristicOrders } from './policies';
import { applyScenarioOverlay } from './scenario';
import { buildFactionLabels, buildLegalHints, PLAYABLE_FACTIONS, serializeGameState } from './serialize';
import {
  ActivePact,
  AgentConfig,
  AgentDecisionRequest,
  AgentDecisionResponse,
  AgentMessageInput,
  AgentOrderInput,
  HarnessLogEntry,
  HeuristicContext,
  ManualTurnPlan,
  NegotiationCounterfactualProjection,
  NegotiationDiaryEntry,
  NegotiationMessageRecord,
  NegotiationStoryworldBrief,
  OpenAIAgentConfig,
  PactCommitmentInput,
  PactType,
  PhaseReasoningDiaryEntry,
  PlayableFactionId,
  ScenarioMetadata,
  ScenarioRhetoricalTool,
  SessionConfig,
  SessionSnapshot,
  SessionStatus,
  SessionSummary,
  SubmitResult,
  TrustMatrix,
  WebhookAgentConfig
} from './types';

const DEFAULT_MAX_TURNS = 12;
const DEFAULT_TRUST = 50;
const MAX_TRUST = 100;
const MAX_PACT_DURATION_TURNS = 3;
const NEGOTIATION_DIARY_TAIL_TURNS = 4;
const PHASE_REASONING_DIARY_TAIL_TURNS = 4;
const PACT_REUSE_COOLDOWN_TURNS = 4;

interface NormalizedPactCommitment {
  proposerId: PlayableFactionId;
  type: PactType;
  parties: PlayableFactionId[];
  durationTurns: number;
}

interface PactViolation {
  pact: ActivePact;
  counterparties: PlayableFactionId[];
  reason: string;
}

export class HeadlessPlaytestSession {
  public readonly sessionId: string;

  private readonly engine: TheySingEngine;
  private readonly config: SessionConfig;
  private readonly factionLabels: Record<PlayableFactionId, string>;
  private readonly logFilePath: string;
  private readonly negotiationMessages: NegotiationMessageRecord[] = [];
  private readonly negotiationDiary: NegotiationDiaryEntry[] = [];
  private readonly phaseReasoningDiary: PhaseReasoningDiaryEntry[] = [];
  private readonly trustMatrix: TrustMatrix = createTrustMatrix();
  private readonly breachedPactIds = new Set<string>();
  private readonly breachPenaltyKeys = new Set<string>();
  private readonly pendingNegotiationPactProposals = new Map<
    string,
    { commitment: NormalizedPactCommitment; proposers: Set<PlayableFactionId> }
  >();
  private readonly activatedNegotiationPactKeys = new Set<string>();
  private readonly pactCooldowns = new Map<string, number>();
  private readonly scenario?: ScenarioMetadata;

  private activePacts: ActivePact[] = [];
  private brokerLeverageGrantedTurn: number | null = null;

  private status: SessionStatus = 'running';
  private completionReason?: string;
  private completionLogged = false;

  constructor(config: SessionConfig, sessionId?: string) {
    this.sessionId = sessionId || createSessionId();
    this.config = normalizeSessionConfig(config);
    this.factionLabels = buildFactionLabels(this.config.factionLabels);
    this.logFilePath = path.join(this.config.logDir || 'playtest-logs', `${this.sessionId}.jsonl`);

    const seedContext = typeof this.config.seed === 'number'
      ? createSeedContext(this.config.seed)
      : null;
    this.engine = new TheySingEngine({
      random: seedContext?.random,
      now: seedContext?.now
    });

    const scenarioApplication = applyScenarioOverlay(this.engine, this.config.scenario);
    this.scenario = scenarioApplication.metadata;
    this.negotiationMessages.push(...scenarioApplication.negotiationMessages);
    this.seedNegotiationDiaryFromMessages(scenarioApplication.negotiationMessages);
    this.activePacts = scenarioApplication.activePacts;
    if (scenarioApplication.trustMatrix) {
      applyTrustMatrixPatch(this.trustMatrix, scenarioApplication.trustMatrix);
    }
  }

  public async initialize(): Promise<void> {
    await mkdir(path.dirname(this.logFilePath), { recursive: true });
    this.engine.on('*', (event) => {
      void this.appendLog({
        sessionId: this.sessionId,
        type: 'engine_event',
        turn: event.turn,
        phase: event.phase,
        timestamp: event.timestamp,
        data: {
          eventType: event.type,
          payload: event.payload
        }
      });
    });

    await this.appendLog({
      sessionId: this.sessionId,
      type: 'session_created',
      turn: this.engine.getTurn(),
      phase: this.engine.getCurrentPhase(),
      timestamp: Date.now(),
        data: {
          name: this.config.name || this.sessionId,
          maxTurns: this.config.maxTurns,
          seed: this.config.seed,
          factionLabels: this.factionLabels,
          scenario: this.scenario,
          activePacts: this.activePacts,
          trustMatrix: cloneTrustMatrix(this.trustMatrix),
          agents: summarizeAgents(this.config.agents),
          startingConstitutions: summarizeFactionConstitutions(this.engine, this.factionLabels)
        }
      });
  }

  public getSummary(): SessionSummary {
    return {
      sessionId: this.sessionId,
      name: this.config.name || this.sessionId,
      status: this.status,
      phase: this.engine.getCurrentPhase(),
      turn: this.engine.getTurn(),
      maxTurns: this.config.maxTurns || DEFAULT_MAX_TURNS
    };
  }

  public getSnapshot(): SessionSnapshot {
    return {
      ...this.getSummary(),
      completionReason: this.completionReason,
      factionLabels: this.factionLabels,
      recentMessages: this.negotiationMessages.slice(-20),
      negotiationDiaryTail: cloneNegotiationDiary(this.negotiationDiary),
      phaseReasoningDiaryTail: clonePhaseReasoningDiary(this.phaseReasoningDiary),
      activePacts: this.activePacts.map(pact => ({ ...pact, parties: [...pact.parties] })),
      trustMatrix: cloneTrustMatrix(this.trustMatrix),
      scenario: this.scenario,
      state: serializeGameState(this.engine, this.factionLabels)
    };
  }

  public getDecisionRequestForFaction(
    factionId: PlayableFactionId,
    phase: Extract<GamePhase, 'NEGOTIATION' | 'ALLOCATION' | 'ACTION_DECLARATION'>
  ): AgentDecisionRequest {
    return this.buildDecisionRequest(factionId, phase);
  }

  public getManualTurnContext(factionId: PlayableFactionId): {
    negotiation: AgentDecisionRequest;
    allocation: AgentDecisionRequest;
    action: AgentDecisionRequest;
  } {
    return {
      negotiation: this.buildDecisionRequest(factionId, 'NEGOTIATION'),
      allocation: this.buildDecisionRequest(factionId, 'ALLOCATION'),
      action: this.buildDecisionRequest(factionId, 'ACTION_DECLARATION')
    };
  }

  public async stepPhase(): Promise<SessionSnapshot> {
    if (this.status === 'completed') {
      return this.getSnapshot();
    }

    const phase = this.engine.getCurrentPhase();
    const turn = this.engine.getTurn();

    if (phase === 'NEGOTIATION' && this.config.autoAdvanceNegotiation !== false) {
      await this.runNegotiationPhase();
    }

    if (phase === 'ALLOCATION' || phase === 'ACTION_DECLARATION') {
      await this.runDecisionPhase(phase);
    }

    if (phase === 'TURN_END') {
      await this.resolveTurnEndPacts();
    }

    this.engine.advancePhase();

    await this.appendLog({
      sessionId: this.sessionId,
      type: 'phase_advanced',
      turn,
      phase,
      timestamp: Date.now(),
      data: {
        nextPhase: this.engine.getCurrentPhase(),
        snapshot: this.getSummary()
      }
    });

    this.updateCompletion();
    return this.getSnapshot();
  }

  public async runTurn(): Promise<SessionSnapshot> {
    if (this.isCompleted()) {
      return this.getSnapshot();
    }

    const startingTurn = this.engine.getTurn();

    do {
      await this.stepPhase();
    } while (
      !this.isCompleted() &&
      !(this.engine.getCurrentPhase() === 'NEGOTIATION' && this.engine.getTurn() > startingTurn)
    );

    const snapshot = this.getSnapshot();
    await this.appendLog({
      sessionId: this.sessionId,
      type: 'turn_completed',
      turn: startingTurn,
      phase: 'TURN_END',
      timestamp: Date.now(),
      data: {
        completedTurn: startingTurn,
        nextTurn: snapshot.turn,
        nextPhase: snapshot.phase,
        status: snapshot.status,
        completionReason: snapshot.completionReason || null,
        counters: snapshot.state.counters,
        control: snapshot.state.control,
        activePacts: snapshot.activePacts,
        recentMessages: snapshot.recentMessages.slice(-6),
        negotiationDiaryTail: snapshot.negotiationDiaryTail,
        phaseReasoningDiaryTail: snapshot.phaseReasoningDiaryTail
      }
    });
    return snapshot;
  }

  public async runTurns(turnCount: number): Promise<SessionSnapshot> {
    const targetTurn = this.engine.getTurn() + Math.max(0, turnCount);
    while (!this.isCompleted() && this.engine.getTurn() < targetTurn) {
      await this.runTurn();
    }
    return this.getSnapshot();
  }

  public async runToCompletion(): Promise<SessionSnapshot> {
    while (!this.isCompleted()) {
      await this.runTurn();
    }
    return this.getSnapshot();
  }

  public async runManualTurn(turnPlan: ManualTurnPlan): Promise<SessionSnapshot> {
    if (this.isCompleted()) {
      return this.getSnapshot();
    }

    if (this.engine.getCurrentPhase() !== 'NEGOTIATION') {
      throw new Error(`Manual turn execution requires NEGOTIATION phase, got ${this.engine.getCurrentPhase()}.`);
    }

    const startingTurn = this.engine.getTurn();
    const negotiationRoundCount = validateManualTurnPlan(turnPlan);
    this.resetNegotiationPhasePactTracking();

    for (let roundIndex = 0; roundIndex < negotiationRoundCount; roundIndex += 1) {
      const decisions = PLAYABLE_FACTIONS.map((factionId) => {
        const roundPlan = turnPlan[factionId].negotiationRounds[roundIndex];
        return {
          factionId,
          decision: {
            reasoning: roundPlan?.reasoning,
            notes: roundPlan?.notes,
            messages: roundPlan?.messages || [],
            pacts: roundPlan?.pacts || [],
            orders: []
          } as AgentDecisionResponse
        };
      });

      await this.applyNegotiationDecisions(decisions, roundIndex + 1);
    }

    await this.applyBrokerRelationshipLeverage();

    await this.advancePhaseWithLogging('NEGOTIATION', startingTurn);

    await this.applyPhaseDecisions(
      'ALLOCATION',
      PLAYABLE_FACTIONS.map((factionId) => ({
        factionId,
        decision: {
          reasoning: turnPlan[factionId].allocation.reasoning,
          notes: turnPlan[factionId].allocation.notes,
          orders: turnPlan[factionId].allocation.orders || []
        } as AgentDecisionResponse
      }))
    );
    await this.advancePhaseWithLogging('ALLOCATION', this.engine.getTurn());

    await this.applyPhaseDecisions(
      'ACTION_DECLARATION',
      PLAYABLE_FACTIONS.map((factionId) => ({
        factionId,
        decision: {
          reasoning: turnPlan[factionId].action.reasoning,
          notes: turnPlan[factionId].action.notes,
          orders: turnPlan[factionId].action.orders || []
        } as AgentDecisionResponse
      }))
    );
    await this.advancePhaseWithLogging('ACTION_DECLARATION', this.engine.getTurn());

    await this.advancePhaseWithLogging('RESOLUTION', this.engine.getTurn());
    if (!this.isCompleted()) {
      await this.resolveTurnEndPacts();
      await this.advancePhaseWithLogging('TURN_END', this.engine.getTurn());
    }

    const snapshot = this.getSnapshot();
    await this.appendTurnCompletedLog(startingTurn, snapshot);
    return snapshot;
  }

  private async runDecisionPhase(phase: Extract<GamePhase, 'ALLOCATION' | 'ACTION_DECLARATION'>): Promise<void> {
    const decisions = await Promise.all(
      PLAYABLE_FACTIONS.map(async factionId => ({
        factionId,
        decision: await this.requestDecision(factionId, phase)
      }))
    );

    await this.applyPhaseDecisions(phase, decisions);
  }

  private async runNegotiationPhase(): Promise<void> {
    this.resetNegotiationPhasePactTracking();

    const decisions = await Promise.all(
      PLAYABLE_FACTIONS.map(async factionId => ({
        factionId,
        decision: await this.requestDecision(factionId, 'NEGOTIATION')
      }))
    );
    await this.applyNegotiationDecisions(decisions);
    await this.applyBrokerRelationshipLeverage();
  }

  private async applyPhaseDecisions(
    phase: Extract<GamePhase, 'ALLOCATION' | 'ACTION_DECLARATION'>,
    decisions: Array<{ factionId: PlayableFactionId; decision: AgentDecisionResponse }>
  ): Promise<void> {
    const prePhaseFactionResources = this.captureFactionResources();
    for (const { factionId, decision } of decisions) {
      const visibleMessagesBefore = this.getVisibleMessages(factionId);
      const orders = this.normalizeOrders(factionId, phase, decision.orders);
      const submitResult = await this.submitOrders(factionId, orders);

      this.recordPhaseReasoningDiaryEntry(
        factionId,
        phase,
        decision,
        visibleMessagesBefore,
        decision.orders,
        submitResult
      );

      await this.appendLog({
        sessionId: this.sessionId,
        type: 'orders_submitted',
        turn: this.engine.getTurn(),
        phase,
        timestamp: Date.now(),
        data: {
          factionId,
          factionLabel: this.factionLabels[factionId],
          reasoning: decision.reasoning || '',
          notes: decision.notes || '',
          requestedOrderCount: decision.orders.length,
          acceptedOrderCount: submitResult.accepted.length,
          rejectedOrderCount: submitResult.rejected.length,
          acceptedOrders: submitResult.accepted,
          rejectedOrders: submitResult.rejected,
          factionResourceSnapshot: prePhaseFactionResources[factionId] || null
        }
      });

      await this.appendLog({
        sessionId: this.sessionId,
        type: 'phase_reasoning_diary',
        turn: this.engine.getTurn(),
        phase,
        timestamp: Date.now(),
        data: {
          factionId,
          factionLabel: this.factionLabels[factionId],
          reasoning: decision.reasoning || '',
          notes: decision.notes || '',
          visibleMessagesBefore,
          requestedOrders: decision.orders || [],
          acceptedOrders: submitResult.accepted,
          rejectedOrders: submitResult.rejected
        }
      });
    }
  }

  private async applyNegotiationDecisions(
    decisions: Array<{ factionId: PlayableFactionId; decision: AgentDecisionResponse }>,
    negotiationRound?: number
  ): Promise<void> {
    const commitmentsByFaction = new Map<PlayableFactionId, NormalizedPactCommitment[]>();
    const effectiveNegotiationRound = negotiationRound || 1;

    for (const { factionId, decision } of decisions) {
      const visibleMessagesBefore = this.getVisibleMessages(factionId);
      const storyworld = this.buildNegotiationStoryworld(factionId);
      const messages = this.normalizeMessages(factionId, decision.messages || []);
      const pacts = this.normalizePacts(factionId, decision.pacts || []);
      this.negotiationMessages.push(...messages);
      this.recordNegotiationDiaryEntry(
        factionId,
        decision,
        visibleMessagesBefore,
        storyworld,
        messages,
        pacts,
        effectiveNegotiationRound
      );
      commitmentsByFaction.set(factionId, pacts);

      await this.appendLog({
        sessionId: this.sessionId,
        type: 'negotiation_messages',
        turn: this.engine.getTurn(),
        phase: 'NEGOTIATION',
        timestamp: Date.now(),
        data: {
          factionId,
          factionLabel: this.factionLabels[factionId],
          reasoning: decision.reasoning || '',
          notes: decision.notes || '',
          negotiationRound: effectiveNegotiationRound,
          messageCount: messages.length,
          messages,
          pactCount: pacts.length,
          pacts
        }
      });

      await this.appendLog({
        sessionId: this.sessionId,
        type: 'negotiation_reasoning_diary',
        turn: this.engine.getTurn(),
        phase: 'NEGOTIATION',
        timestamp: Date.now(),
        data: {
          factionId,
          factionLabel: this.factionLabels[factionId],
          reasoning: decision.reasoning || '',
          notes: decision.notes || '',
          negotiationRound: effectiveNegotiationRound,
          storyworldFrame: storyworld.frame,
          counterfactuals: storyworld.counterfactuals,
          visibleMessagesBefore,
          messages,
          pacts
        }
      });
    }

    const activatedPacts = this.activateNegotiatedPacts(commitmentsByFaction);
    if (activatedPacts.length > 0) {
      await this.appendLog({
        sessionId: this.sessionId,
        type: 'pacts_activated',
        turn: this.engine.getTurn(),
        phase: 'NEGOTIATION',
        timestamp: Date.now(),
        data: {
          negotiationRound: negotiationRound || 1,
          pacts: activatedPacts
        }
      });
    }
  }

  private async advancePhaseWithLogging(phase: GamePhase, turn: number): Promise<void> {
    this.engine.advancePhase();
    await this.appendLog({
      sessionId: this.sessionId,
      type: 'phase_advanced',
      turn,
      phase,
      timestamp: Date.now(),
      data: {
        nextPhase: this.engine.getCurrentPhase(),
        snapshot: this.getSummary()
      }
    });
    this.updateCompletion();
  }

  private async appendTurnCompletedLog(startingTurn: number, snapshot: SessionSnapshot): Promise<void> {
    await this.appendLog({
      sessionId: this.sessionId,
      type: 'turn_completed',
      turn: startingTurn,
      phase: 'TURN_END',
      timestamp: Date.now(),
      data: {
        completedTurn: startingTurn,
        nextTurn: snapshot.turn,
        nextPhase: snapshot.phase,
        status: snapshot.status,
        completionReason: snapshot.completionReason || null,
        factionResources: this.captureFactionResources(),
        counters: snapshot.state.counters,
        control: snapshot.state.control,
        activePacts: snapshot.activePacts,
        recentMessages: snapshot.recentMessages.slice(-6),
        negotiationDiaryTail: snapshot.negotiationDiaryTail,
        phaseReasoningDiaryTail: snapshot.phaseReasoningDiaryTail
      }
    });
  }

  private captureFactionResources(): Record<
    PlayableFactionId,
    { flops: number; influence: number; techLevel: Record<string, number> }
  > {
    const state = this.engine.getState();
    const resources = {} as Record<
      PlayableFactionId,
      { flops: number; influence: number; techLevel: Record<string, number> }
    >;

    for (const factionId of PLAYABLE_FACTIONS) {
      const faction = state.factions.get(factionId);
      if (!faction) continue;

      resources[factionId] = {
        flops: faction.flops,
        influence: faction.influence,
        techLevel: {
          KINETIC: faction.techLevel.KINETIC,
          INFO: faction.techLevel.INFO,
          LOGIC: faction.techLevel.LOGIC,
          MEMETIC: faction.techLevel.MEMETIC
        }
      };
    }

    return resources;
  }

  private async requestDecision(
    factionId: PlayableFactionId,
    phase: Extract<GamePhase, 'NEGOTIATION' | 'ALLOCATION' | 'ACTION_DECLARATION'>
  ): Promise<AgentDecisionResponse> {
    const agent = this.config.agents[factionId];
    if (agent.type === 'heuristic') {
      return decideHeuristicOrders(this.engine, factionId, phase, this.buildHeuristicContext(factionId));
    }

    const payload = this.buildDecisionRequest(factionId, phase);
    await this.appendLog({
      sessionId: this.sessionId,
      type: 'agent_request',
      turn: this.engine.getTurn(),
      phase,
      timestamp: Date.now(),
      data: {
        factionId,
        provider: agent.type,
        target: agent.type === 'webhook' ? agent.url : agent.model,
        timeoutMs: agent.timeoutMs || 30000
      }
    });

    try {
      const response = agent.type === 'webhook'
        ? await postJson(agent, payload)
        : await postOpenAIJson(agent, payload);
      const parsed = parseDecisionResponse(response);

      await this.appendLog({
        sessionId: this.sessionId,
        type: 'agent_response',
        turn: this.engine.getTurn(),
        phase,
        timestamp: Date.now(),
        data: {
          factionId,
          provider: agent.type,
          target: agent.type === 'webhook' ? agent.url : agent.model,
          orderCount: parsed.orders.length,
          messageCount: (parsed.messages || []).length,
          pactCount: (parsed.pacts || []).length,
          reasoning: parsed.reasoning || '',
          notes: parsed.notes || ''
        }
      });

      return parsed;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown webhook error';
      await this.appendLog({
        sessionId: this.sessionId,
        type: 'agent_response_error',
        turn: this.engine.getTurn(),
        phase,
        timestamp: Date.now(),
        data: {
          factionId,
          provider: agent.type,
          target: agent.type === 'webhook' ? agent.url : agent.model,
          message
        }
      });

      const fallback = decideHeuristicOrders(this.engine, factionId, phase, this.buildHeuristicContext(factionId));
      return {
        ...fallback,
        reasoning: `Webhook failed for ${factionId}; heuristic fallback applied.`,
        notes: message
      };
    }
  }

  private buildDecisionRequest(
    factionId: PlayableFactionId,
    phase: Extract<GamePhase, 'NEGOTIATION' | 'ALLOCATION' | 'ACTION_DECLARATION'>
  ): AgentDecisionRequest {
    const instructions = phase === 'NEGOTIATION'
      ? [
          'Return JSON only.',
          'Shape: { "reasoning"?: string, "notes"?: string, "messages": AgentMessageInput[], "pacts"?: PactCommitmentInput[], "orders": [] }.',
          'Include a short operator-readable reasoning diary string in "reasoning"; it is logged between negotiation turns.',
          'Use negotiationStoryworld.frame and negotiationStoryworld.counterfactuals as your compact alliance forecast surface.',
          'When possible, let messages and pacts reflect whether entering or breaking an alliance improves your projected position over the next 2 turns.',
          'You may send up to 2 concise negotiation messages.',
          'You may propose up to 2 pacts using type = ORBITAL_TRUCE | NON_AGGRESSION | AUDIT_FREEZE, counterpartyIds, and optional durationTurns (1-3).',
          `Each message must use recipientId = ${PLAYABLE_FACTIONS.join(' | ')} | ALL.`,
          'Do not send messages to yourself.',
          'Pacts only activate if every named party returns the same commitment during this negotiation phase.',
          'If you accept or mirror a pact offer from another faction, include the exact pact in the pacts array; negotiation prose alone does not activate anything.',
          'Prefer encoding concrete deals as pacts instead of only describing them in messages.',
          'Use negotiation to propose deconfliction, temporary alignment, or pressure redirection.'
        ].join(' ')
      : [
          'Return JSON only.',
          'Shape: { "reasoning"?: string, "notes"?: string, "orders": AgentOrderInput[], "messages"?: [] }.',
          'Include a short operator-readable reasoning diary string in "reasoning"; it is logged for this phase.',
          'For BUILD and RESEARCH, you may omit unitId; the harness will inject the faction id.',
          'For unit actions, use one order per unit for this phase.',
          'Orders that violate active pacts are blocked and logged as reputation damage.',
          `Use faction ids ${PLAYABLE_FACTIONS.join(', ')} as the playable blocs.`
        ].join(' ');

    const scenarioInstructions = this.scenario?.briefing
      ? `Scenario briefing: ${this.scenario.briefing}`
      : undefined;

    return {
      sessionId: this.sessionId,
      sessionName: this.config.name || this.sessionId,
      factionId,
      factionLabel: this.factionLabels[factionId],
      phase,
      turn: this.engine.getTurn(),
      maxTurns: this.config.maxTurns || DEFAULT_MAX_TURNS,
      state: serializeGameState(this.engine, this.factionLabels),
      legalHints: buildLegalHints(this.engine, factionId, phase),
      recentMessages: this.getVisibleMessages(factionId),
      activePacts: this.activePacts.map(pact => ({ ...pact, parties: [...pact.parties] })),
      trustMatrix: cloneTrustMatrix(this.trustMatrix),
      negotiationStoryworld: phase === 'NEGOTIATION' ? this.buildNegotiationStoryworld(factionId) : undefined,
      scenario: this.scenario,
      instructions: scenarioInstructions ? `${instructions} ${scenarioInstructions}` : instructions
    };
  }

  private normalizeOrders(
    factionId: PlayableFactionId,
    phase: Extract<GamePhase, 'ALLOCATION' | 'ACTION_DECLARATION'>,
    rawOrders: AgentOrderInput[]
  ): Order[] {
    const allowedTypes = phase === 'ALLOCATION'
      ? new Set<OrderType>(['BUILD', 'RESEARCH'])
      : new Set<OrderType>(['MOVE', 'HOLD', 'SUPPORT', 'ATTACK', 'FILTER', 'SABOTAGE', 'ANTI_SAT', 'CONVERT', 'AUDIT']);

    const seenUnitIds = new Set<string>();
    const orders: Order[] = [];

    rawOrders.forEach((rawOrder, index) => {
      const type = normalizeOrderType(rawOrder.type);
      if (!type || !allowedTypes.has(type)) return;

      const unitId = rawOrder.unitId || (type === 'BUILD' || type === 'RESEARCH' ? factionId : undefined);
      if (!unitId) return;

      if (type !== 'BUILD' && type !== 'RESEARCH') {
        if (seenUnitIds.has(unitId)) return;
        seenUnitIds.add(unitId);
      }

      orders.push({
        id: `${this.sessionId}_${this.engine.getTurn()}_${phase}_${factionId}_${index}`,
        faction: factionId,
        unitId,
        type,
        targetNodeId: rawOrder.targetNodeId,
        targetEdgeId: rawOrder.targetEdgeId,
        targetUnitId: rawOrder.targetUnitId,
        supportingUnitId: rawOrder.supportingUnitId,
        techDomain: rawOrder.techDomain,
        unitTypeToBuild: rawOrder.unitTypeToBuild,
        priority: index
      });
    });

    return orders;
  }

  private async submitOrders(factionId: PlayableFactionId, orders: Order[]): Promise<SubmitResult> {
    const accepted: Order[] = [];
    const rejected: Array<{ order: Order; reason: string }> = [];

    for (const order of orders) {
      const pactViolation = this.findPactViolation(factionId, order);
      if (pactViolation) {
        rejected.push({ order, reason: pactViolation.reason });
        this.registerPactBreach(factionId, pactViolation, order);
        await this.appendLog({
          sessionId: this.sessionId,
          type: 'pact_breach_blocked',
          turn: this.engine.getTurn(),
          phase: this.engine.getCurrentPhase(),
          timestamp: Date.now(),
          data: {
            factionId,
            factionLabel: this.factionLabels[factionId],
            order,
            reason: pactViolation.reason,
            pact: pactViolation.pact,
            counterparties: pactViolation.counterparties
          }
        });
        continue;
      }

      const result = this.engine.submitOrders(factionId, [order]);
      if (result.success) {
        accepted.push(order);
      } else {
        rejected.push({ order, reason: result.message });
      }
    }

    return { accepted, rejected };
  }

  private updateCompletion(): void {
    const state = this.engine.getState();
    if (state.counters.protocolFailure) {
      this.status = 'completed';
      this.completionReason = 'Protocol failure';
    } else if ((this.config.maxTurns || DEFAULT_MAX_TURNS) < state.counters.turn) {
      this.status = 'completed';
      this.completionReason = `Reached max turn limit (${this.config.maxTurns || DEFAULT_MAX_TURNS})`;
    }

    if (this.status === 'completed' && !this.completionLogged) {
      this.completionLogged = true;
      void this.appendLog({
        sessionId: this.sessionId,
        type: 'session_completed',
        turn: this.engine.getTurn(),
        phase: this.engine.getCurrentPhase(),
        timestamp: Date.now(),
        data: {
          reason: this.completionReason || 'Completed',
          snapshot: this.getSummary()
        }
      });
    }
  }

  private async appendLog(entry: HarnessLogEntry): Promise<void> {
    await appendFile(this.logFilePath, `${JSON.stringify(entry)}\n`, 'utf8');
  }

  private normalizeMessages(
    factionId: PlayableFactionId,
    rawMessages: AgentMessageInput[]
  ): NegotiationMessageRecord[] {
    const seenRecipients = new Set<string>();
    const accepted: NegotiationMessageRecord[] = [];

    for (const rawMessage of rawMessages) {
      if (accepted.length >= 2) break;
      if (!rawMessage || typeof rawMessage !== 'object') continue;

      const recipientId = normalizeRecipientId(rawMessage.recipientId);
      if (!recipientId || recipientId === factionId) continue;
      if (seenRecipients.has(recipientId)) continue;

      const content = normalizeMessageContent(rawMessage.content);
      if (!content) continue;

      seenRecipients.add(recipientId);
      accepted.push({
        senderId: factionId,
        recipientId,
        content,
        turn: this.engine.getTurn(),
        timestamp: Date.now()
      });
    }

    return accepted;
  }

  private normalizePacts(
    factionId: PlayableFactionId,
    rawPacts: PactCommitmentInput[]
  ): NormalizedPactCommitment[] {
    const accepted: NormalizedPactCommitment[] = [];
    const seenKeys = new Set<string>();

    for (const rawPact of rawPacts) {
      if (accepted.length >= 2) break;
      if (!rawPact || typeof rawPact !== 'object') continue;

      const type = normalizePactType(rawPact.type);
      if (!type) continue;

      const counterparties = Array.isArray(rawPact.counterpartyIds)
        ? rawPact.counterpartyIds
            .map(counterpartyId => normalizePlayableFactionId(counterpartyId))
            .filter((counterpartyId): counterpartyId is PlayableFactionId => !!counterpartyId && counterpartyId !== factionId)
        : [];
      if (counterparties.length === 0) continue;

      const parties = uniquePlayableFactions([factionId, ...counterparties]);
      const durationTurns = clampPactDuration(rawPact.durationTurns);
      const pactKey = buildPactKey(type, parties, durationTurns);
      if (seenKeys.has(pactKey)) continue;

      seenKeys.add(pactKey);
      accepted.push({
        proposerId: factionId,
        type,
        parties,
        durationTurns
      });
    }

    return accepted;
  }

  private getVisibleMessages(factionId: PlayableFactionId): NegotiationMessageRecord[] {
    return this.negotiationMessages
      .filter(message =>
        message.recipientId === 'ALL' ||
        message.senderId === factionId ||
        message.recipientId === factionId
      )
      .slice(-12);
  }

  private buildHeuristicContext(factionId: PlayableFactionId): HeuristicContext {
    return {
      activePacts: this.activePacts.map(pact => ({ ...pact, parties: [...pact.parties] })),
      trustMatrix: cloneTrustMatrix(this.trustMatrix),
      recentMessages: this.getVisibleMessages(factionId)
    };
  }

  private buildNegotiationStoryworld(factionId: PlayableFactionId): NegotiationStoryworldBrief {
    const leader = this.getLeadingFaction();
    const rival = this.getStrongestRival(factionId);
    const frame = this.buildStoryworldFrame(factionId, leader, rival);
    const strategicQuestion = this.buildStrategicQuestion(factionId, leader, rival);
    const counterfactuals = this.buildNegotiationCounterfactuals(factionId, leader);

    return {
      focalFactionId: factionId,
      frame,
      strategicQuestion,
      counterfactuals
    };
  }

  private buildNegotiationCounterfactuals(
    factionId: PlayableFactionId,
    leader: PlayableFactionId | null
  ): NegotiationCounterfactualProjection[] {
    const candidates: NegotiationCounterfactualProjection[] = [];
    const counterparties = PLAYABLE_FACTIONS.filter(candidate => candidate !== factionId);

    for (const counterpartyId of counterparties) {
      for (const pactType of ['NON_AGGRESSION', 'ORBITAL_TRUCE', 'AUDIT_FREEZE'] as PactType[]) {
        candidates.push(this.buildEnterPactProjection(factionId, counterpartyId, pactType, leader));
      }
    }

    for (const pact of this.activePacts) {
      if (!pact.parties.includes(factionId)) continue;
      const counterpartiesForPact = pact.parties.filter(candidate => candidate !== factionId);
      if (counterpartiesForPact.length === 0) continue;
      candidates.push(this.buildBreakPactProjection(factionId, counterpartiesForPact, pact, leader));
    }

    return candidates
      .sort((left, right) =>
        (right.desirability - right.risk) - (left.desirability - left.risk) ||
        left.pactType.localeCompare(right.pactType) ||
        left.counterparties.join('+').localeCompare(right.counterparties.join('+'))
      )
      .slice(0, 4);
  }

  private buildEnterPactProjection(
    factionId: PlayableFactionId,
    counterpartyId: PlayableFactionId,
    pactType: PactType,
    leader: PlayableFactionId | null
  ): NegotiationCounterfactualProjection {
    const trust = this.trustMatrix[factionId][counterpartyId];
    const pressure = this.engine.getState().counters.pressures;
    const ownScore = this.computeFactionScore(factionId);
    const counterpartyScore = this.computeFactionScore(counterpartyId);
    const leaderScore = leader ? this.computeFactionScore(leader) : 0;
    const scoreGap = counterpartyScore - ownScore;
    const leaderIsOther = leader && leader !== factionId && leader !== counterpartyId;
    const leaderIsCounterparty = leader === counterpartyId;
    const antiLeaderCoalition = leader === 'HEGEMON' && factionId !== 'HEGEMON' && counterpartyId !== 'HEGEMON';
    const stabilizesLeader = leader === 'HEGEMON' && factionId !== 'HEGEMON' && counterpartyId === 'HEGEMON';
    const hasExistingAntiLeaderPact = leader === 'HEGEMON' && factionId !== 'HEGEMON' && this.activePacts.some(pact =>
      pact.parties.includes(factionId) &&
      !pact.parties.includes('HEGEMON')
    );
    const activeSamePact = this.activePacts.some(pact =>
      pact.type === pactType && pact.parties.includes(factionId) && pact.parties.includes(counterpartyId)
    );

    let desirability = 36 + Math.round((trust - 50) / 2);
    let risk = 22 + Math.round((100 - trust) / 4);
    let projectedTasDelta = 0;
    let projectedOrbitalDelta = 0;
    let projectedTrustDelta = 4;
    let projectedNodeSwing = 0;
    const rationale: string[] = [];

    if (leaderIsOther) {
      desirability += 16;
      projectedNodeSwing += 1;
      rationale.push(`Shared pressure on ${leader} is available if both sides stop trading tempo.`);
    }

    if (antiLeaderCoalition) {
      desirability += pactType === 'NON_AGGRESSION' ? 30 : pactType === 'ORBITAL_TRUCE' ? 20 : 12;
      risk -= 12;
      projectedTrustDelta += 2;
      projectedNodeSwing += 2;
      rationale.push('This pact forms an anti-HEGEMON coalition lane rather than just slowing the board.');
    }

    if (stabilizesLeader) {
      const stabilizerPenalty = factionId === 'INFILTRATOR'
        ? (pactType === 'ORBITAL_TRUCE' && pressure.orbital >= 75 ? 10 : 24)
        : (pactType === 'ORBITAL_TRUCE' ? (pressure.orbital >= 75 ? 6 : 14) : 18);
      desirability -= stabilizerPenalty;
      risk += stabilizerPenalty;
      projectedNodeSwing -= 1;
      rationale.push('This pact risks stabilizing HEGEMON more than it improves coalition position.');
    }

    if (hasExistingAntiLeaderPact && stabilizesLeader) {
      desirability -= 12;
      risk += 14;
      projectedTrustDelta -= 2;
      rationale.push('A separate anti-HEGEMON lane already exists, so cross-cutting quiet with HEGEMON is especially destabilizing.');
    }

    if (pactType === 'ORBITAL_TRUCE') {
      desirability += Math.round(pressure.orbital / 8);
      risk += leaderIsCounterparty ? 8 : 0;
      projectedOrbitalDelta = -Math.max(2, Math.round(pressure.orbital / 20));
      projectedTasDelta = -1;
      rationale.push('Orbital restraint lowers debris pressure and preserves launch capacity.');
    } else if (pactType === 'AUDIT_FREEZE') {
      desirability += Math.round(pressure.cyber / 10);
      risk += counterpartyId === 'INFILTRATOR' ? 12 : 6;
      projectedTasDelta = -1;
      projectedNodeSwing += counterpartyId === 'INFILTRATOR' ? -1 : 0;
      rationale.push('Audit restraint trades legibility for short-run de-escalation.');
    } else {
      desirability += 8;
      projectedNodeSwing += leaderIsOther ? 1 : 0;
      rationale.push('Short non-aggression can convert defensive tempo into local buildup.');
    }

    if (scoreGap > 120) {
      risk += 10;
      rationale.push(`${counterpartyId} is materially stronger on the current board and may bank the pause better.`);
    }

    if (leader && leader !== factionId) {
      const leaderGap = leaderScore - ownScore;
      if (leaderGap >= 250 && counterpartyId !== leader) {
        desirability += 8;
        projectedNodeSwing += 1;
        rationale.push(`The board gap to ${leader} is large enough that coalition tempo matters immediately.`);
      }
      if (leaderGap >= 250 && counterpartyId === leader) {
        risk += 8;
        rationale.push(`The board gap to ${leader} makes a stabilizing pact more dangerous than usual.`);
      }
    }

    if (activeSamePact) {
      desirability -= 10;
      rationale.push('A matching pact already exists, so the marginal gain is small.');
    }

    const projectedLeader = antiLeaderCoalition
      ? (ownScore + 120 >= leaderScore ? factionId : leader)
      : leaderIsOther
        ? leader
        : (scoreGap > 0 ? counterpartyId : factionId);
    const storyBeat = `${factionId} tests ${pactType} with ${counterpartyId} to ${leaderIsOther ? `compress ${leader}'s lead` : 'buy cleaner positioning'}.`;

    return {
      mode: 'ENTER_PACT',
      pactType,
      counterparties: [counterpartyId],
      horizonTurns: 2,
      desirability: clampProjectionScore(desirability),
      risk: clampProjectionScore(risk),
      projectedLeader,
      projectedTasDelta,
      projectedOrbitalDelta,
      projectedTrustDelta,
      projectedNodeSwing,
      storyBeat,
      rationale
    };
  }

  private buildBreakPactProjection(
    factionId: PlayableFactionId,
    counterparties: PlayableFactionId[],
    pact: ActivePact,
    leader: PlayableFactionId | null
  ): NegotiationCounterfactualProjection {
    const averageTrust = Math.round(
      counterparties.reduce((sum, counterpartyId) => sum + this.trustMatrix[factionId][counterpartyId], 0) /
      Math.max(1, counterparties.length)
    );
    const pressure = this.engine.getState().counters.pressures;
    const targetCounterparty = counterparties[0];
    const targetStronger = targetCounterparty ? this.computeFactionScore(targetCounterparty) > this.computeFactionScore(factionId) : false;
    const breaksAntiLeaderCoalition = leader === 'HEGEMON' && factionId !== 'HEGEMON' && counterparties.every(counterpartyId => counterpartyId !== 'HEGEMON');
    const breaksLeaderStabilizer = leader === 'HEGEMON' && counterparties.includes('HEGEMON') && factionId !== 'HEGEMON';

    let desirability = 28;
    let risk = 32 + Math.round(averageTrust / 3);
    let projectedTasDelta = 1;
    let projectedOrbitalDelta = pact.type === 'ORBITAL_TRUCE' ? 3 : 0;
    let projectedTrustDelta = -18;
    let projectedNodeSwing = 0;
    const rationale: string[] = [];

    if (leader && counterparties.includes(leader)) {
      desirability += 18;
      projectedNodeSwing += 1;
      rationale.push(`Breaking with ${leader} may open a direct displacement window.`);
    }

    if (breaksAntiLeaderCoalition) {
      desirability -= 20;
      risk += 16;
      projectedTrustDelta -= 4;
      projectedNodeSwing -= 2;
      rationale.push('Breaking this pact collapses an anti-HEGEMON coalition lane and usually helps the leader.');
    }

    if (breaksLeaderStabilizer) {
      desirability += 12;
      risk -= 4;
      projectedNodeSwing += 1;
      rationale.push('Breaking this pact can reopen pressure on HEGEMON instead of subsidizing its recovery.');
    }

    if (pact.type === 'ORBITAL_TRUCE') {
      desirability += pressure.orbital < 55 ? 6 : -8;
      rationale.push('Ending orbital restraint reopens anti-sat leverage but risks debris escalation.');
    } else if (pact.type === 'AUDIT_FREEZE') {
      desirability += 10;
      projectedTasDelta = 0;
      rationale.push('Resuming audits can restore legibility if covert pressure is building.');
    } else {
      desirability += targetStronger ? 8 : -2;
      projectedNodeSwing += targetStronger ? 1 : 0;
      rationale.push('Breaking non-aggression is only attractive if the pause mainly benefits the other side.');
    }

    if (averageTrust >= 65) {
      risk += 10;
      rationale.push('High bilateral trust means visible betrayal will poison later bargaining.');
    }

    const projectedLeader = leader && !counterparties.includes(leader) ? leader : factionId;
    const storyBeat = `${factionId} contemplates breaking ${pact.type} with ${counterparties.join('+')} to force a sharper board.`;

    return {
      mode: 'BREAK_PACT',
      pactType: pact.type,
      counterparties: [...counterparties],
      horizonTurns: 2,
      desirability: clampProjectionScore(desirability),
      risk: clampProjectionScore(risk),
      projectedLeader,
      projectedTasDelta,
      projectedOrbitalDelta,
      projectedTrustDelta,
      projectedNodeSwing,
      storyBeat,
      rationale
    };
  }

  private buildStoryworldFrame(
    factionId: PlayableFactionId,
    leader: PlayableFactionId | null,
    rival: PlayableFactionId | null
  ): string {
    const pressures = this.engine.getState().counters.pressures;
    const ownScore = this.computeFactionScore(factionId);
    const leaderText = leader ? `${leader} leads the board` : 'the board is flat';
    const rivalText = rival ? `${rival} is the nearest pressure source` : 'no single rival dominates';
    const pressureText = `memetic ${pressures.memetic}, cyber ${pressures.cyber}, industry ${pressures.industry}, orbital ${pressures.orbital}`;
    const rhetoricalTool = this.selectScenarioRhetoricalTool(factionId, leader);
    const rhetoricalText = rhetoricalTool
      ? ` Rhetorical tool ${rhetoricalTool.title}: ${rhetoricalTool.cue}${rhetoricalTool.leverage ? ` ${rhetoricalTool.leverage}` : ''}`
      : '';
    return `${leaderText}; ${rivalText}; ${factionId} sits at score ${ownScore}; global heat is ${pressureText}.${rhetoricalText}`;
  }

  private buildStrategicQuestion(
    factionId: PlayableFactionId,
    leader: PlayableFactionId | null,
    rival: PlayableFactionId | null
  ): string {
    if (leader && leader !== factionId) {
      return `Does ${factionId} gain more by aligning briefly against ${leader}, or by preserving betrayal leverage against ${rival || leader}?`;
    }
    return `Does ${factionId} lock in restraint to preserve the lead, or bait a rival into breaking first?`;
  }

  private selectScenarioRhetoricalTool(
    factionId: PlayableFactionId,
    leader: PlayableFactionId | null
  ): ScenarioRhetoricalTool | null {
    const tools = this.scenario?.rhetoricalTools || [];
    if (tools.length === 0) return null;

    const pressures = this.engine.getState().counters.pressures;
    const ranked = [...tools].sort((left, right) =>
      this.scoreScenarioRhetoricalTool(right, factionId, leader, pressures) -
      this.scoreScenarioRhetoricalTool(left, factionId, leader, pressures) ||
      left.title.localeCompare(right.title)
    );

    return ranked[0] || null;
  }

  private scoreScenarioRhetoricalTool(
    tool: ScenarioRhetoricalTool,
    factionId: PlayableFactionId,
    leader: PlayableFactionId | null,
    pressures: { memetic: number; cyber: number; industry: number; orbital: number }
  ): number {
    let score = 0;

    if (!tool.focalFactionIds?.length || tool.focalFactionIds.includes(factionId)) score += 12;
    if (tool.antiLeader && leader && leader !== factionId) score += 10;
    if (tool.preferredCounterpartyId && leader && tool.preferredCounterpartyId !== leader) score += 3;

    if (tool.pressureFocus) {
      score += Math.round((pressures[tool.pressureFocus] || 0) / 10);
    }

    if (tool.preferredPactType === 'NON_AGGRESSION' && leader === 'HEGEMON' && factionId !== 'HEGEMON') {
      score += 8;
    }

    return score;
  }

  private getLeadingFaction(): PlayableFactionId | null {
    const ranked = PLAYABLE_FACTIONS
      .map((factionId) => ({ factionId, score: this.computeFactionScore(factionId) }))
      .sort((left, right) => right.score - left.score || left.factionId.localeCompare(right.factionId));
    return ranked[0]?.factionId || null;
  }

  private getStrongestRival(factionId: PlayableFactionId): PlayableFactionId | null {
    const ranked = PLAYABLE_FACTIONS
      .filter(candidate => candidate !== factionId)
      .map((candidate) => ({ factionId: candidate, score: this.computeFactionScore(candidate) }))
      .sort((left, right) => right.score - left.score || left.factionId.localeCompare(right.factionId));
    return ranked[0]?.factionId || null;
  }

  private computeFactionScore(factionId: PlayableFactionId): number {
    const state = this.engine.getState();
    const faction = state.factions.get(factionId);
    if (!faction) return 0;

    const controlledNodes = Array.from(state.nodes.values()).filter(node => node.owner === factionId).length;
    const ownedUnits = Array.from(state.units.values()).filter(unit => unit.owner === factionId).length;
    const techTotal = Object.values(faction.techLevel as unknown as Record<string, unknown>)
      .map((value) => finiteNumber(value))
      .reduce((sum, value) => sum + value, 0);
    const unlockedTechCount = faction.unlockedTechs instanceof Set ? faction.unlockedTechs.size : 0;
    return (
      controlledNodes * 100 +
      ownedUnits * 25 +
      finiteNumber(faction.influence) * 2 +
      finiteNumber(faction.flops) +
      techTotal * 10 +
      unlockedTechCount * 4
    );
  }

  private seedNegotiationDiaryFromMessages(messages: NegotiationMessageRecord[]): void {
    const groupedEntries = new Map<string, NegotiationDiaryEntry>();

    for (const message of messages) {
      const key = `${message.turn}:${message.senderId}`;
      const existing = groupedEntries.get(key);
      if (existing) {
        existing.messages.push({ ...message });
        continue;
      }

      groupedEntries.set(key, {
        turn: message.turn,
        negotiationRound: 1,
        factionId: message.senderId,
        factionLabel: this.factionLabels[message.senderId],
        reasoning: '',
        notes: '',
        visibleMessagesBefore: [],
        storyworldFrame: '',
        counterfactuals: [],
        messages: [{ ...message }],
        pacts: []
      });
    }

    this.negotiationDiary.push(...groupedEntries.values());
    this.trimNegotiationDiaryTail();
  }

  private recordNegotiationDiaryEntry(
    factionId: PlayableFactionId,
    decision: AgentDecisionResponse,
    visibleMessagesBefore: NegotiationMessageRecord[],
    storyworld: NegotiationStoryworldBrief,
    messages: NegotiationMessageRecord[],
    pacts: NormalizedPactCommitment[],
    negotiationRound: number
  ): void {
    this.negotiationDiary.push({
      turn: this.engine.getTurn(),
      negotiationRound,
      factionId,
      factionLabel: this.factionLabels[factionId],
      reasoning: decision.reasoning || '',
      notes: decision.notes || '',
      visibleMessagesBefore: visibleMessagesBefore.map((message) => ({ ...message })),
      storyworldFrame: storyworld.frame,
      counterfactuals: storyworld.counterfactuals.map((projection) => ({
        ...projection,
        counterparties: [...projection.counterparties],
        rationale: [...projection.rationale]
      })),
      messages: messages.map(message => ({ ...message })),
      pacts: pacts.map((pact) => ({
        type: pact.type,
        parties: [...pact.parties],
        durationTurns: pact.durationTurns
      }))
    });
    this.trimNegotiationDiaryTail();
  }

  private trimNegotiationDiaryTail(): void {
    const turns = Array.from(new Set(this.negotiationDiary.map((entry) => entry.turn))).sort((left, right) => right - left);
    const keptTurns = new Set(turns.slice(0, NEGOTIATION_DIARY_TAIL_TURNS));
    const trimmed = this.negotiationDiary.filter((entry) => keptTurns.has(entry.turn));

    this.negotiationDiary.length = 0;
    this.negotiationDiary.push(...trimmed.map((entry) => ({
      ...entry,
      visibleMessagesBefore: entry.visibleMessagesBefore.map((message) => ({ ...message })),
      counterfactuals: cloneCounterfactuals(entry.counterfactuals),
      messages: entry.messages.map((message) => ({ ...message })),
      pacts: entry.pacts.map((pact) => ({ ...pact, parties: [...pact.parties] }))
    })));
  }

  private recordPhaseReasoningDiaryEntry(
    factionId: PlayableFactionId,
    phase: Extract<GamePhase, 'ALLOCATION' | 'ACTION_DECLARATION'>,
    decision: AgentDecisionResponse,
    visibleMessagesBefore: NegotiationMessageRecord[],
    requestedOrders: AgentOrderInput[],
    submitResult: SubmitResult
  ): void {
    this.phaseReasoningDiary.push({
      turn: this.engine.getTurn(),
      phase,
      factionId,
      factionLabel: this.factionLabels[factionId],
      reasoning: decision.reasoning || '',
      notes: decision.notes || '',
      visibleMessagesBefore: visibleMessagesBefore.map((message) => ({ ...message })),
      requestedOrders: requestedOrders.map((order) => ({ ...order })),
      acceptedOrders: submitResult.accepted.map((order) => ({ ...order })),
      rejectedOrders: submitResult.rejected.map((rejected) => ({
        order: { ...rejected.order },
        reason: rejected.reason
      }))
    });
    this.trimPhaseReasoningDiaryTail();
  }

  private trimPhaseReasoningDiaryTail(): void {
    const turns = Array.from(new Set(this.phaseReasoningDiary.map((entry) => entry.turn))).sort((left, right) => right - left);
    const keptTurns = new Set(turns.slice(0, PHASE_REASONING_DIARY_TAIL_TURNS));
    const trimmed = this.phaseReasoningDiary.filter((entry) => keptTurns.has(entry.turn));

    this.phaseReasoningDiary.length = 0;
    this.phaseReasoningDiary.push(...trimmed.map((entry) => ({
      ...entry,
      visibleMessagesBefore: entry.visibleMessagesBefore.map((message) => ({ ...message })),
      requestedOrders: entry.requestedOrders.map((order) => ({ ...order })),
      acceptedOrders: entry.acceptedOrders.map((order) => ({ ...order })),
      rejectedOrders: entry.rejectedOrders.map((rejected) => ({
        order: { ...rejected.order },
        reason: rejected.reason
      }))
    })));
  }

  private activateNegotiatedPacts(
    commitmentsByFaction: Map<PlayableFactionId, NormalizedPactCommitment[]>
  ): ActivePact[] {
    for (const commitments of commitmentsByFaction.values()) {
      for (const commitment of commitments) {
        const key = buildPactKey(commitment.type, commitment.parties, commitment.durationTurns);
        const entry = this.pendingNegotiationPactProposals.get(key) || {
          commitment,
          proposers: new Set<PlayableFactionId>()
        };
        entry.proposers.add(commitment.proposerId);
        this.pendingNegotiationPactProposals.set(key, entry);
      }
    }

    const activated: ActivePact[] = [];
    for (const [key, { commitment, proposers }] of this.pendingNegotiationPactProposals.entries()) {
      if (this.activatedNegotiationPactKeys.has(key)) continue;

      const isUnanimous = commitment.parties.every(partyId => proposers.has(partyId));
      if (!isUnanimous) continue;

      const cooldownKey = buildPactCooldownKey(commitment.type, commitment.parties);
      const cooldownUntilTurn = this.pactCooldowns.get(cooldownKey);
      if (typeof cooldownUntilTurn === 'number' && cooldownUntilTurn >= this.engine.getTurn()) {
        continue;
      }

      const pact: ActivePact = {
        id: `${this.sessionId}_${this.engine.getTurn()}_${buildPactKey(commitment.type, commitment.parties, commitment.durationTurns)}`,
        type: commitment.type,
        parties: [...commitment.parties],
        createdTurn: this.engine.getTurn(),
        expiresAfterTurn: this.engine.getTurn() + commitment.durationTurns - 1
      };

      this.activePacts = this.activePacts.filter(activePact =>
        !(activePact.type === pact.type && sameParties(activePact.parties, pact.parties))
      );
      this.activePacts.push(pact);
      this.activatedNegotiationPactKeys.add(key);
      this.adjustTrustForParties(pact.parties, 2);
      activated.push(pact);
    }

    return activated;
  }

  private resetNegotiationPhasePactTracking(): void {
    this.pendingNegotiationPactProposals.clear();
    this.activatedNegotiationPactKeys.clear();
  }

  private findPactViolation(factionId: PlayableFactionId, order: Order): PactViolation | null {
    for (const pact of this.activePacts) {
      if (!pact.parties.includes(factionId)) continue;
      if (this.engine.getTurn() > pact.expiresAfterTurn) continue;

      const counterparties = this.identifyTargetedCounterparties(factionId, pact, order);
      if (counterparties.length === 0) continue;

      if (pact.type === 'ORBITAL_TRUCE' && order.type === 'ANTI_SAT') {
        return {
          pact,
          counterparties,
          reason: this.buildPactViolationReason(pact.type, counterparties)
        };
      }

      if (pact.type === 'NON_AGGRESSION' && isNonAggressionOrder(order.type)) {
        return {
          pact,
          counterparties,
          reason: this.buildPactViolationReason(pact.type, counterparties)
        };
      }

      if (pact.type === 'AUDIT_FREEZE' && (order.type === 'AUDIT' || order.type === 'FILTER')) {
        return {
          pact,
          counterparties,
          reason: this.buildPactViolationReason(pact.type, counterparties)
        };
      }
    }

    return null;
  }

  private identifyTargetedCounterparties(
    factionId: PlayableFactionId,
    pact: ActivePact,
    order: Order
  ): PlayableFactionId[] {
    const counterparties = pact.parties.filter(partyId => partyId !== factionId);
    const impacted = new Set<PlayableFactionId>();
    const targetNodeIds = new Set<string>();

    if (order.targetNodeId) {
      targetNodeIds.add(order.targetNodeId);
    }

    const actingUnit = this.engine.getUnit(order.unitId);
    if ((order.type === 'CONVERT' || order.type === 'AUDIT') && actingUnit) {
      targetNodeIds.add(actingUnit.location);
    }

    if (order.targetUnitId) {
      const targetUnit = this.engine.getUnit(order.targetUnitId);
      const targetOwner = normalizePlayableFactionId(targetUnit?.owner);
      if (targetOwner && counterparties.includes(targetOwner)) {
        impacted.add(targetOwner);
      }
    }

    for (const nodeId of targetNodeIds) {
      for (const counterpartyId of this.identifyCounterpartiesAtNode(nodeId, counterparties)) {
        impacted.add(counterpartyId);
      }
    }

    if (order.type === 'FILTER' && order.targetEdgeId) {
      const edge = this.engine.getEdge(order.targetEdgeId);
      if (edge) {
        const edgeController = normalizePlayableFactionId(edge.filteredBy);
        if (edgeController && counterparties.includes(edgeController)) {
          impacted.add(edgeController);
        }

        for (const counterpartyId of this.identifyCounterpartiesAtNode(edge.from, counterparties)) {
          impacted.add(counterpartyId);
        }
        for (const counterpartyId of this.identifyCounterpartiesAtNode(edge.to, counterparties)) {
          impacted.add(counterpartyId);
        }
      }
    }

    return Array.from(impacted).sort();
  }

  private identifyCounterpartiesAtNode(nodeId: string, counterparties: PlayableFactionId[]): PlayableFactionId[] {
    const impacted = new Set<PlayableFactionId>();
    const node = this.engine.getNode(nodeId);
    const owner = normalizePlayableFactionId(node?.owner);
    if (owner && counterparties.includes(owner)) {
      impacted.add(owner);
    }

    for (const unit of this.engine.getUnitsAtNode(nodeId)) {
      const unitOwner = normalizePlayableFactionId(unit.owner);
      if (unitOwner && counterparties.includes(unitOwner)) {
        impacted.add(unitOwner);
      }
    }

    return Array.from(impacted).sort();
  }

  private buildPactViolationReason(type: PactType, counterparties: PlayableFactionId[]): string {
    const labels = counterparties.map(counterpartyId => this.factionLabels[counterpartyId]).join(', ');
    return `Blocked by ${type} pact with ${labels}.`;
  }

  private registerPactBreach(factionId: PlayableFactionId, violation: PactViolation, order: Order): void {
    this.breachedPactIds.add(violation.pact.id);

    const penaltyKey = `${this.engine.getTurn()}:${violation.pact.id}:${factionId}`;
    if (!this.breachPenaltyKeys.has(penaltyKey)) {
      this.breachPenaltyKeys.add(penaltyKey);
      this.adjustTrustForParties([factionId, ...violation.counterparties], -18);

      const faction = this.engine.getFaction(factionId);
      if (faction) {
        faction.influence = Math.max(0, faction.influence - 2);
      }
    }

    if (order.type === 'ANTI_SAT') {
      const state = this.engine.getState();
      state.counters.pressures.orbital = clampPressure(state.counters.pressures.orbital + 2);
    }
  }

  private async resolveTurnEndPacts(): Promise<void> {
    if (this.activePacts.length === 0) {
      this.breachedPactIds.clear();
      this.breachPenaltyKeys.clear();
      return;
    }

    const currentTurn = this.engine.getTurn();
    const continuingPacts: ActivePact[] = [];
    const expiredPacts: ActivePact[] = [];

    for (const pact of this.activePacts) {
      if (currentTurn <= pact.expiresAfterTurn && !this.breachedPactIds.has(pact.id)) {
        const benefits = this.applyPactBenefits(pact);
        await this.appendLog({
          sessionId: this.sessionId,
          type: 'pact_honored',
          turn: currentTurn,
          phase: 'TURN_END',
          timestamp: Date.now(),
          data: {
            pact,
            benefits
          }
        });
      }

      if (pact.expiresAfterTurn > currentTurn) {
        continuingPacts.push(pact);
      } else {
        expiredPacts.push(pact);
      }
    }

    this.activePacts = continuingPacts;

    for (const pact of expiredPacts) {
      this.pactCooldowns.set(
        buildPactCooldownKey(pact.type, pact.parties),
        currentTurn + PACT_REUSE_COOLDOWN_TURNS
      );
      await this.appendLog({
        sessionId: this.sessionId,
        type: 'pact_expired',
        turn: currentTurn,
        phase: 'TURN_END',
        timestamp: Date.now(),
        data: {
          pact
        }
      });
    }

    this.breachedPactIds.clear();
    this.breachPenaltyKeys.clear();
  }

  private applyPactBenefits(pact: ActivePact): Record<string, unknown> {
    const state = this.engine.getState();
    const resourceChanges = Object.fromEntries(
      PLAYABLE_FACTIONS.map((factionId) => [factionId, {}])
    ) as Record<PlayableFactionId, { flops?: number; influence?: number }>;
    const artifactChanges = {} as Record<PlayableFactionId, string[]>;
    for (const factionId of PLAYABLE_FACTIONS) {
      artifactChanges[factionId] = [];
    }

    const grant = (factionId: PlayableFactionId, flops = 0, influence = 0): void => {
      const faction = this.engine.getFaction(factionId);
      if (!faction) return;
      if (flops !== 0) {
        faction.flops = Math.max(0, faction.flops + flops);
        resourceChanges[factionId].flops = flops;
      }
      if (influence !== 0) {
        faction.influence = Math.max(0, faction.influence + influence);
        resourceChanges[factionId].influence = influence;
      }
    };

    const grantArtifact = (factionId: PlayableFactionId, artifactType: string, reason: string): void => {
      if (this.engine.grantFactionArtifact(factionId, artifactType as any, reason)) {
        artifactChanges[factionId].push(artifactType);
      }
    };

    if (pact.type === 'ORBITAL_TRUCE') {
      state.counters.pressures.orbital = clampPressure(state.counters.pressures.orbital - 4);
      state.counters.kessler = Math.max(0, state.counters.kessler - 5);
    } else if (pact.type === 'NON_AGGRESSION') {
      state.counters.tas = Math.max(0, state.counters.tas - 0.5);
    } else {
      state.counters.pressures.cyber = clampPressure(state.counters.pressures.cyber - 3);
    }

    if (pact.parties.includes('BROKER')) {
      const leader = this.getCurrentStrategicLeader();
      const brokerScore = this.getStrategicPositionScore('BROKER');
      const leaderScore = leader ? this.getStrategicPositionScore(leader) : brokerScore;
      const counterparties = pact.parties.filter((party) => party !== 'BROKER');
      const averageTrust = counterparties.length > 0
        ? counterparties.reduce((sum, party) => sum + this.trustMatrix.BROKER[party], 0) / counterparties.length
        : 0;

      if (
        leader &&
        leader !== 'BROKER' &&
        leaderScore >= brokerScore + 40 &&
        averageTrust >= 52
      ) {
        grantArtifact('BROKER', 'BACKCHANNEL_DOSSIER', `${pact.type.toLowerCase()} with ${counterparties.join(', ') || 'nobody'}`);
      }
    }

    this.adjustTrustForParties(pact.parties, 1);

    return {
      type: pact.type,
      parties: pact.parties,
      tas: state.counters.tas,
      kessler: state.counters.kessler,
      pressures: { ...state.counters.pressures },
      resourceChanges,
      artifactChanges
    };
  }

  private adjustTrustForParties(parties: PlayableFactionId[], delta: number): void {
    for (let index = 0; index < parties.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < parties.length; otherIndex += 1) {
        const left = parties[index];
        const right = parties[otherIndex];
        this.trustMatrix[left][right] = clampTrust(this.trustMatrix[left][right] + delta);
        this.trustMatrix[right][left] = clampTrust(this.trustMatrix[right][left] + delta);
      }
    }
  }

  private getStrategicPositionScore(factionId: PlayableFactionId): number {
    const faction = this.engine.getFaction(factionId);
    if (!faction) {
      return 0;
    }
    const state = this.engine.getState();
    const ownedNodes = Array.from(state.nodes.values()).filter((node) => node.owner === factionId).length;
    const units = Array.from(state.units.values()).filter((unit) => unit.owner === factionId).length;
    return (ownedNodes * 100) + (units * 18) + faction.flops + Math.round(faction.influence * 0.8);
  }

  private getCurrentStrategicLeader(): PlayableFactionId | null {
    let leader: PlayableFactionId | null = null;
    let bestScore = -Infinity;

    for (const factionId of PLAYABLE_FACTIONS) {
      const score = this.getStrategicPositionScore(factionId);
      if (score > bestScore) {
        bestScore = score;
        leader = factionId;
      }
    }

    return leader;
  }

  private async applyBrokerRelationshipLeverage(): Promise<void> {
    const currentTurn = this.engine.getTurn();
    if (this.brokerLeverageGrantedTurn === currentTurn) {
      return;
    }
    if (currentTurn < 2) {
      return;
    }

    const broker = this.engine.getFaction('BROKER');
    if (!broker) {
      return;
    }

    const leader = this.getCurrentStrategicLeader();
    if (!leader || leader === 'BROKER') {
      return;
    }

    const ranking = PLAYABLE_FACTIONS
      .map((factionId) => ({ factionId, score: this.getStrategicPositionScore(factionId) }))
      .sort((left, right) => right.score - left.score);
    const leaderEntry = ranking[0];
    const brokerEntry = ranking.find((entry) => entry.factionId === 'BROKER');
    if (!leaderEntry || !brokerEntry || leaderEntry.factionId === 'BROKER') {
      return;
    }

    const activeBrokerPacts = this.activePacts.filter((pact) => pact.parties.includes('BROKER'));
    const brokerRank = ranking.findIndex((entry) => entry.factionId === 'BROKER');
    const relationshipEntries = PLAYABLE_FACTIONS
      .filter((factionId) => factionId !== 'BROKER')
      .map((factionId) => ({
        factionId,
        trust: this.trustMatrix.BROKER[factionId],
        hasPact: activeBrokerPacts.some((pact) => pact.parties.includes(factionId))
      }));
    const anchoredPartners = relationshipEntries.filter((entry) => entry.trust >= 50 || entry.hasPact);
    const leverageScore = relationshipEntries.reduce((sum, entry) => {
      let contribution = entry.trust >= 50 ? 3 : 0;
      contribution += Math.max(0, entry.trust - 55);
      if (entry.hasPact) contribution += 8;
      if (entry.factionId === leader && entry.trust >= 50) contribution += 3;
      return sum + contribution;
    }, 0)
      + (leaderEntry.score >= brokerEntry.score + 18 ? 4 : 0)
      + (brokerRank >= 2 ? 4 : brokerRank === 1 ? 2 : 0);

    if (anchoredPartners.length < 2 || leverageScore < 11) {
      return;
    }

    if (!this.engine.grantFactionArtifact('BROKER', 'BACKCHANNEL_DOSSIER', 'relationship leverage as a trusted intermediary')) {
      return;
    }

    broker.flops += 1;
    broker.influence += 1;
    this.brokerLeverageGrantedTurn = currentTurn;

    await this.appendLog({
      sessionId: this.sessionId,
      type: 'broker_relationship_leverage',
      turn: currentTurn,
      phase: 'NEGOTIATION',
      timestamp: Date.now(),
      data: {
        leader,
        leaderScore: leaderEntry.score,
        brokerScore: brokerEntry.score,
        leverageScore,
        anchoredPartners: anchoredPartners.map((entry) => ({
          factionId: entry.factionId,
          trust: entry.trust,
          hasPact: entry.hasPact
        })),
        flopsDelta: 1,
        influenceDelta: 1
      }
    });
  }

  private isCompleted(): boolean {
    return this.status === 'completed';
  }
}

function normalizeSessionConfig(config: SessionConfig): SessionConfig {
  return {
    name: config.name || 'they-sing-headless-playtest',
    maxTurns: config.maxTurns || DEFAULT_MAX_TURNS,
    seed: typeof config.seed === 'number' ? Math.floor(config.seed) : undefined,
    autoAdvanceNegotiation: config.autoAdvanceNegotiation !== false,
    logDir: config.logDir || 'playtest-logs',
    factionLabels: config.factionLabels,
    scenarioPath: config.scenarioPath,
    scenario: config.scenario,
    agents: config.agents
  };
}

function validateManualTurnPlan(turnPlan: ManualTurnPlan): number {
  let roundCount = 0;

  for (const factionId of PLAYABLE_FACTIONS) {
    const factionPlan = turnPlan[factionId];
    if (!factionPlan) {
      throw new Error(`Manual turn plan is missing faction ${factionId}.`);
    }

    const negotiationRounds = Array.isArray(factionPlan.negotiationRounds) ? factionPlan.negotiationRounds.length : 0;
    if (negotiationRounds < 3 || negotiationRounds > 5) {
      throw new Error(
        `Manual turn plan for ${factionId} must include 3-5 negotiation rounds; got ${negotiationRounds}.`
      );
    }

    if (!factionPlan.allocation || !Array.isArray(factionPlan.allocation.orders)) {
      throw new Error(`Manual turn plan for ${factionId} is missing allocation orders.`);
    }

    if (!factionPlan.action || !Array.isArray(factionPlan.action.orders)) {
      throw new Error(`Manual turn plan for ${factionId} is missing action orders.`);
    }

    roundCount = Math.max(roundCount, negotiationRounds);
  }

  return roundCount;
}

function summarizeAgents(agents: Record<PlayableFactionId, AgentConfig>): Record<PlayableFactionId, Record<string, unknown>> {
  return Object.fromEntries(
    PLAYABLE_FACTIONS.map((factionId) => [factionId, summarizeAgent(agents[factionId])])
  ) as Record<PlayableFactionId, Record<string, unknown>>;
}

function summarizeFactionConstitutions(
  engine: TheySingEngine,
  factionLabels: Record<PlayableFactionId, string>
): Record<PlayableFactionId, Record<string, unknown>> {
  const state = engine.getState();
  const summary = {} as Record<PlayableFactionId, Record<string, unknown>>;

  for (const factionId of PLAYABLE_FACTIONS) {
    const faction = state.factions.get(factionId);
    summary[factionId] = faction
      ? {
        label: factionLabels[factionId],
        memeticAlignment: faction.memeticAlignment,
        movementName: faction.movement.name,
        movementStage: faction.movement.stage,
        socialForm: faction.movement.socialForm,
        authorityStyle: faction.movement.authorityStyle,
        aiRelation: faction.movement.aiRelation,
        tasAbsorption: faction.movement.tasAbsorption,
        unlockedDoctrines: Array.from(faction.unlockedDoctrines).sort()
      }
      : {
        label: factionLabels[factionId],
        memeticAlignment: null,
        movementName: 'Unknown',
        movementStage: 'MURMUR',
        socialForm: 'READING_CIRCLES',
        authorityStyle: 'EXPERT',
        aiRelation: 'TOOL',
        tasAbsorption: 0,
        unlockedDoctrines: []
      };
  }

  return summary;
}

function summarizeAgent(agent: AgentConfig): Record<string, unknown> {
  if (agent.type === 'heuristic') {
    return { type: agent.type, profile: agent.profile || 'default' };
  }

  if (agent.type === 'openai') {
    return {
      type: agent.type,
      model: agent.model,
      baseUrl: agent.baseUrl || process.env.LOCAL_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      timeoutMs: agent.timeoutMs || 30000,
      headers: Object.keys(agent.headers || {})
    };
  }

  return {
    type: agent.type,
    url: agent.url,
    timeoutMs: agent.timeoutMs || 30000,
    headers: Object.keys(agent.headers || {})
  };
}

function normalizeOrderType(type: string): OrderType | null {
  const normalized = type.toUpperCase();
  const validTypes: OrderType[] = [
    'MOVE', 'HOLD', 'SUPPORT', 'ATTACK', 'FILTER',
    'SABOTAGE', 'ANTI_SAT', 'CONVERT', 'AUDIT', 'BUILD', 'RESEARCH'
  ];

  return validTypes.includes(normalized as OrderType) ? normalized as OrderType : null;
}

function parseDecisionResponse(value: unknown): AgentDecisionResponse {
  if (typeof value === 'string') {
    const parsedValue = tryParseJsonCandidate(value);
    return parsedValue ? parseDecisionResponse(parsedValue) : { orders: [], messages: [] };
  }

  if (Array.isArray(value)) {
    return { orders: value as AgentOrderInput[] };
  }

  if (!value || typeof value !== 'object') {
    return { orders: [] };
  }

  const candidate = value as Partial<AgentDecisionResponse>;
  return {
    reasoning: typeof candidate.reasoning === 'string' ? candidate.reasoning : undefined,
    notes: typeof candidate.notes === 'string' ? candidate.notes : undefined,
    messages: Array.isArray(candidate.messages) ? candidate.messages as AgentMessageInput[] : [],
    pacts: Array.isArray(candidate.pacts) ? candidate.pacts as PactCommitmentInput[] : [],
    orders: Array.isArray(candidate.orders) ? candidate.orders as AgentOrderInput[] : []
  };
}

async function postJson(agent: WebhookAgentConfig, payload: AgentDecisionRequest): Promise<unknown> {
  const target = new URL(agent.url);
  const transport = target.protocol === 'https:' ? https : http;
  const body = JSON.stringify(payload);

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body).toString(),
    ...(agent.headers || {})
  };

  if (agent.token) {
    headers.authorization = `Bearer ${agent.token}`;
  }

  return new Promise((resolve, reject) => {
    const request = transport.request(
      target,
      {
        method: 'POST',
        headers,
        timeout: agent.timeoutMs || 30000
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        response.on('end', () => {
          const responseText = Buffer.concat(chunks).toString('utf8');
          const statusCode = response.statusCode || 500;

          if (statusCode < 200 || statusCode >= 300) {
            reject(new Error(`Webhook ${target.toString()} returned ${statusCode}: ${responseText}`));
            return;
          }

          try {
            resolve(responseText ? JSON.parse(responseText) : {});
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    request.on('timeout', () => {
      request.destroy(new Error(`Webhook ${target.toString()} timed out.`));
    });
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

async function postOpenAIJson(agent: OpenAIAgentConfig, payload: AgentDecisionRequest): Promise<unknown> {
  const baseUrl = resolveOpenAIBaseUrl(agent);
  const apiKey = resolveOpenAIApiKey(agent, baseUrl);
  const requestStyle = resolveOpenAIRequestStyle(agent.model, baseUrl, agent.apiStyle);
  const systemPrompt = buildSystemPrompt(agent, payload);
  const userPrompt = buildUserPrompt(payload);

  if (requestStyle === 'responses') {
    return postOpenAIResponses(agent, baseUrl, apiKey, systemPrompt, userPrompt);
  }

  return postOpenAIChatCompletions(agent, baseUrl, apiKey, systemPrompt, userPrompt);
}

function createSessionId(): string {
  return `session_${Date.now()}_${randomBytes(4).toString('hex')}`;
}

function tryParseJsonCandidate(text: string): unknown | null {
  const cleaned = stripThinkingBlocks(text).trim();
  if (!cleaned) return null;

  try {
    return JSON.parse(cleaned);
  } catch {
    // fall through
  }

  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // fall through
    }
  }

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    } catch {
      // fall through
    }
  }

  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    try {
      return JSON.parse(cleaned.slice(firstBracket, lastBracket + 1));
    } catch {
      return null;
    }
  }

  return null;
}

function extractOpenAIResponseText(payload: Record<string, unknown>): string {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return stripThinkingBlocks(payload.output_text);
  }

  const output = Array.isArray(payload.output) ? payload.output : [];
  if (output.length > 0) {
    const text = output
      .flatMap(item => {
        if (!item || typeof item !== 'object') return [];
        const content = Array.isArray((item as { content?: unknown }).content)
          ? (item as { content: Array<Record<string, unknown>> }).content
          : [];
        return content.map(contentItem => {
          const candidate = contentItem?.text;
          return typeof candidate === 'string' ? candidate : '';
        });
      })
      .join('\n')
      .trim();

    if (text) {
      return stripThinkingBlocks(text);
    }
  }

  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const firstChoice = choices[0] as Record<string, unknown> | undefined;
  const message = firstChoice && typeof firstChoice === 'object'
    ? firstChoice.message as Record<string, unknown> | undefined
    : undefined;

  const content = message?.content;
  if (typeof content === 'string') {
    return stripThinkingBlocks(content);
  }

  if (Array.isArray(content)) {
    const text = content
      .map(item => {
        if (item && typeof item === 'object' && 'text' in item) {
          return String((item as { text?: unknown }).text || '');
        }
        return '';
      })
      .join('\n')
      .trim();
    return stripThinkingBlocks(text);
  }

  throw new Error('OpenAI-compatible response did not include message content.');
}

async function postOpenAIChatCompletions(
  agent: OpenAIAgentConfig,
  baseUrl: string,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<unknown> {
  const body: Record<string, unknown> = {
    model: agent.model,
    reasoning_effort: agent.reasoningEffort ?? 'medium',
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: userPrompt
      }
    ]
  };
  body[resolveChatTokenParamName(agent.model, baseUrl)] = agent.maxTokens ?? 1200;
  if (shouldIncludeChatTemperature(agent.model, baseUrl, agent.temperature)) {
    body.temperature = agent.temperature ?? 0.2;
  }

  const parsed = await postOpenAIRequest(
    baseUrl,
    apiKey,
    agent.timeoutMs || 30000,
    agent.headers || {},
    'chat/completions',
    body
  );

  return extractOpenAIResponseText(parsed);
}

async function postOpenAIResponses(
  agent: OpenAIAgentConfig,
  baseUrl: string,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<unknown> {
  const body: Record<string, unknown> = {
    model: agent.model,
    input: [
      `System instructions:\n${systemPrompt}`,
      '',
      `User request:\n${userPrompt}`
    ].join('\n'),
    max_output_tokens: agent.maxTokens ?? 1200
  };

  if (agent.reasoningEffort) {
    body.reasoning = { effort: agent.reasoningEffort };
  }

  const parsed = await postOpenAIRequest(
    baseUrl,
    apiKey,
    agent.timeoutMs || 30000,
    agent.headers || {},
    'responses',
    body
  );

  return extractOpenAIResponseText(parsed);
}

async function postOpenAIRequest(
  baseUrl: string,
  apiKey: string,
  timeoutMs: number,
  extraHeaders: Record<string, string>,
  endpointPath: 'chat/completions' | 'responses',
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const target = new URL(endpointPath, ensureTrailingSlash(baseUrl));
  const transport = target.protocol === 'https:' ? https : http;
  const requestBody = JSON.stringify(body);
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(requestBody).toString(),
    ...extraHeaders
  };

  if (apiKey) {
    headers.authorization = `Bearer ${apiKey}`;
  }

  return new Promise((resolve, reject) => {
    const request = transport.request(
      target,
      {
        method: 'POST',
        headers,
        timeout: timeoutMs
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        response.on('end', () => {
          const responseText = Buffer.concat(chunks).toString('utf8');
          const statusCode = response.statusCode || 500;

          if (statusCode < 200 || statusCode >= 300) {
            reject(new Error(`OpenAI-compatible endpoint ${target.toString()} returned ${statusCode}: ${responseText}`));
            return;
          }

          try {
            resolve(JSON.parse(responseText) as Record<string, unknown>);
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    request.on('timeout', () => {
      request.destroy(new Error(`OpenAI-compatible endpoint ${target.toString()} timed out.`));
    });
    request.on('error', reject);
    request.write(requestBody);
    request.end();
  });
}

function buildSystemPrompt(agent: OpenAIAgentConfig, payload: AgentDecisionRequest): string {
  const negotiationReminder = payload.phase === 'NEGOTIATION'
    ? 'During negotiation, if you accept a pact offer, mirror it explicitly in the pacts array. Messages alone do not activate pacts.'
    : '';

  return agent.systemPrompt || [
    `You are the strategic controller for ${payload.factionLabel} (${payload.factionId}) in They Sing.`,
    'You are operating a simultaneous-move negotiation game with allocation and action phases.',
    negotiationReminder,
    'Return valid JSON only and follow the provided instructions exactly.'
  ].filter(Boolean).join(' ');
}

function buildUserPrompt(payload: AgentDecisionRequest): string {
  return [
    `Session: ${payload.sessionName} (${payload.sessionId})`,
    `Faction: ${payload.factionLabel} (${payload.factionId})`,
    `Phase: ${payload.phase}`,
    `Turn: ${payload.turn} / ${payload.maxTurns}`,
    '',
    'Visible recent negotiation messages:',
    JSON.stringify(payload.recentMessages, null, 2),
    '',
    'Active pacts:',
    JSON.stringify(payload.activePacts, null, 2),
    '',
    'Trust matrix:',
    JSON.stringify(payload.trustMatrix, null, 2),
    '',
    'Scenario:',
    JSON.stringify(payload.scenario || null, null, 2),
    '',
    'State:',
    JSON.stringify(payload.state, null, 2),
    '',
    'Legal hints:',
    JSON.stringify(payload.legalHints, null, 2),
    '',
    'Instructions:',
    payload.instructions
  ].join('\n');
}

function resolveOpenAIBaseUrl(agent: OpenAIAgentConfig): string {
  return (
    agent.baseUrl ||
    process.env.LOCAL_OPENAI_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    'https://api.openai.com/v1'
  );
}

function resolveOpenAIApiKey(agent: OpenAIAgentConfig, baseUrl: string): string {
  if (agent.apiKey) return agent.apiKey;
  if (isLocalBaseUrl(baseUrl)) {
    return process.env.LOCAL_OPENAI_API_KEY || '';
  }
  return process.env.OPENAI_API_KEY || '';
}

function resolveOpenAIRequestStyle(
  model: string,
  baseUrl: string,
  apiStyle: OpenAIAgentConfig['apiStyle']
): 'chat_completions' | 'responses' {
  if (apiStyle === 'chat_completions' || apiStyle === 'responses') {
    return apiStyle;
  }

  if (isOfficialOpenAIBaseUrl(baseUrl) && modelRequiresResponsesApi(model)) {
    return 'responses';
  }

  return 'chat_completions';
}

function isLocalBaseUrl(baseUrl: string): boolean {
  const candidate = new URL(ensureTrailingSlash(baseUrl));
  const host = candidate.hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1' || !host.includes('.');
}

function isOfficialOpenAIBaseUrl(baseUrl: string): boolean {
  const candidate = new URL(ensureTrailingSlash(baseUrl));
  return candidate.hostname.toLowerCase() === 'api.openai.com';
}

function modelRequiresResponsesApi(model: string): boolean {
  const normalized = model.trim().toLowerCase();
  return normalized.includes('codex') || normalized.endsWith('-pro');
}

function resolveChatTokenParamName(model: string, baseUrl: string): 'max_tokens' | 'max_completion_tokens' {
  if (isOfficialOpenAIBaseUrl(baseUrl) && model.trim().toLowerCase().startsWith('gpt-5')) {
    return 'max_completion_tokens';
  }
  return 'max_tokens';
}

function shouldIncludeChatTemperature(
  model: string,
  baseUrl: string,
  temperature: number | undefined
): boolean {
  if (isOfficialOpenAIBaseUrl(baseUrl) && model.trim().toLowerCase().startsWith('gpt-5')) {
    return temperature === 1;
  }
  return true;
}

function ensureTrailingSlash(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

function stripThinkingBlocks(text: string): string {
  const cleaned = text.trim();
  const closingIndex = cleaned.lastIndexOf('</think>');
  if (closingIndex >= 0) {
    return cleaned.slice(closingIndex + '</think>'.length).trim();
  }
  return cleaned;
}

function normalizeRecipientId(recipientId: unknown): NegotiationMessageRecord['recipientId'] | null {
  if (typeof recipientId !== 'string') return null;
  const normalized = recipientId.toUpperCase();
  if (normalized === 'ALL') return 'ALL';
  if (PLAYABLE_FACTIONS.includes(normalized as PlayableFactionId)) {
    return normalized as PlayableFactionId;
  }
  return null;
}

function normalizeMessageContent(content: unknown): string | null {
  if (typeof content !== 'string') return null;
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  return normalized.slice(0, 400);
}

function normalizePactType(type: unknown): PactType | null {
  if (typeof type !== 'string') return null;
  const normalized = type.toUpperCase();
  if (normalized === 'ORBITAL_TRUCE' || normalized === 'NON_AGGRESSION' || normalized === 'AUDIT_FREEZE') {
    return normalized;
  }
  return null;
}

function normalizePlayableFactionId(value: unknown): PlayableFactionId | null {
  if (typeof value !== 'string') return null;
  const normalized = value.toUpperCase();
  if (PLAYABLE_FACTIONS.includes(normalized as PlayableFactionId)) {
    return normalized as PlayableFactionId;
  }
  return null;
}

function createTrustMatrix(): TrustMatrix {
  const matrix = {} as TrustMatrix;
  for (const factionId of PLAYABLE_FACTIONS) {
    matrix[factionId] = {} as TrustMatrix[PlayableFactionId];
    for (const otherFactionId of PLAYABLE_FACTIONS) {
      matrix[factionId][otherFactionId] = factionId === otherFactionId ? MAX_TRUST : DEFAULT_TRUST;
    }
  }
  return matrix;
}

function cloneTrustMatrix(trustMatrix: TrustMatrix): TrustMatrix {
  const clone = {} as TrustMatrix;
  for (const factionId of PLAYABLE_FACTIONS) {
    clone[factionId] = { ...trustMatrix[factionId] };
  }
  return clone;
}

function cloneNegotiationDiary(entries: NegotiationDiaryEntry[]): NegotiationDiaryEntry[] {
  return entries.map((entry) => ({
    ...entry,
    visibleMessagesBefore: entry.visibleMessagesBefore.map((message) => ({ ...message })),
    counterfactuals: cloneCounterfactuals(entry.counterfactuals),
    messages: entry.messages.map((message) => ({ ...message })),
    pacts: entry.pacts.map((pact) => ({ ...pact, parties: [...pact.parties] }))
  }));
}

function clonePhaseReasoningDiary(entries: PhaseReasoningDiaryEntry[]): PhaseReasoningDiaryEntry[] {
  return entries.map((entry) => ({
    ...entry,
    visibleMessagesBefore: entry.visibleMessagesBefore.map((message) => ({ ...message })),
    requestedOrders: entry.requestedOrders.map((order) => ({ ...order })),
    acceptedOrders: entry.acceptedOrders.map((order) => ({ ...order })),
    rejectedOrders: entry.rejectedOrders.map((rejected) => ({
      order: { ...rejected.order },
      reason: rejected.reason
    }))
  }));
}

function uniquePlayableFactions(factionIds: PlayableFactionId[]): PlayableFactionId[] {
  return Array.from(new Set(factionIds)).sort() as PlayableFactionId[];
}

function clampPactDuration(durationTurns: unknown): number {
  if (typeof durationTurns !== 'number' || !Number.isFinite(durationTurns)) {
    return 1;
  }
  return Math.max(1, Math.min(MAX_PACT_DURATION_TURNS, Math.floor(durationTurns)));
}

function buildPactKey(type: PactType, parties: PlayableFactionId[], durationTurns: number): string {
  return `${type}:${[...parties].sort().join('+')}:${durationTurns}`;
}

function buildPactCooldownKey(type: PactType, parties: PlayableFactionId[]): string {
  return `${type}:${[...parties].sort().join('+')}`;
}

function cloneCounterfactuals(
  projections: NegotiationCounterfactualProjection[]
): NegotiationCounterfactualProjection[] {
  return projections.map((projection) => ({
    ...projection,
    counterparties: [...projection.counterparties],
    rationale: [...projection.rationale]
  }));
}

function sameParties(left: PlayableFactionId[], right: PlayableFactionId[]): boolean {
  if (left.length !== right.length) return false;
  return [...left].sort().every((partyId, index) => partyId === [...right].sort()[index]);
}

function isNonAggressionOrder(type: OrderType): boolean {
  return type === 'MOVE' || type === 'ATTACK' || type === 'SABOTAGE' || type === 'CONVERT' || type === 'ANTI_SAT';
}

function clampTrust(value: number): number {
  return Math.max(0, Math.min(MAX_TRUST, value));
}

function clampPressure(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function clampProjectionScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function finiteNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function applyTrustMatrixPatch(
  trustMatrix: TrustMatrix,
  patch: Partial<TrustMatrix>
): void {
  for (const factionId of PLAYABLE_FACTIONS) {
    const row = patch[factionId];
    if (!row) continue;

    for (const counterpartyId of PLAYABLE_FACTIONS) {
      const value = row[counterpartyId];
      if (typeof value === 'number') {
        trustMatrix[factionId][counterpartyId] = clampTrust(value);
      }
    }
  }
}

function createSeedContext(seed: number): { random: () => number; now: () => number } {
  let state = (seed >>> 0) || 1;
  let tick = 1_700_000_000_000 + seed * 10_000;

  const random = (): number => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const now = (): number => {
    tick += 1;
    return tick;
  };

  return { random, now };
}
