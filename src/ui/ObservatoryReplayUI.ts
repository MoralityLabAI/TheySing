import { FACTION_COLORS, ObservatoryBoardDiff, ObservatoryBoardState, ObservatoryEvidence, ObservatoryGraph, ObservatoryLocation, ObservatoryScene } from '../three/ObservatoryScene';
import './ObservatoryReplayUI.css';

type ReplayMessage = {
  sender?: string;
  recipient?: string;
  content?: string;
  pactType?: string;
};

type ReplayDiary = {
  kind?: string;
  factionId?: string;
  factionLabel?: string;
  reasoning?: string;
  notes?: string;
  storyworldFrame?: string;
};

type ReplayOrder = {
  factionId?: string;
  factionLabel?: string;
  accepted?: boolean;
  type?: string;
  text?: string;
  techDomain?: string;
  researchGoal?: string;
  researchCompleted?: string;
  researchFlopsBefore?: string;
  researchFlopsAfter?: string;
  researchFlopsProgressToGoal?: string;
  researchFlopsRemaining?: string;
  visualPreset?: string;
  subgenre?: string;
};

type ReplayEvent = {
  category?: string;
  summary?: string;
  phase?: string;
  visualPreset?: string;
  subgenre?: string;
};

type ReplaySceneEvent = {
  id?: string;
  sourceType?: string;
  category?: string;
  subgenre?: string;
  visualPreset?: string;
  actors?: string[];
  publicExplanation?: string;
  privateReasoning?: Record<string, string>;
  retrospectiveTruth?: string;
  intensity?: number;
  location?: {
    nodeId?: string;
    edgeId?: string;
    orbitShell?: string;
  };
  payload?: unknown;
};

type ReplayAnomalyDossier = {
  id?: string;
  label?: string;
  containmentClass?: string;
  firstObservedTurn?: number;
  affectedDomains?: string[];
  observedEffects?: string[];
  knownCountermeasures?: string[];
  treatyHooks?: string[];
  diaryContradictions?: string[];
  retrospectiveTruth?: string;
  threadId?: string;
  recurrenceCount?: number;
  relatedTurns?: Array<{ turn?: number; phase?: string; label?: string; containmentClass?: string; affectedDomains?: string[] }>;
  threadSummary?: string;
};

type ReplayMoment = {
  category?: string;
  title?: string;
  impact?: string;
  privateReasoning?: Record<string, string> | string;
  interestScore?: number;
  factionsInvolved?: string[];
};

type DecodeReceipt = {
  messageId?: string;
  factionId?: string;
  sourceFactionId?: string;
  reconstructedAct?: string;
  reconstructedBinding?: string;
  confidence?: number | null;
  fieldExactness?: number | null;
  exact?: boolean;
  brier?: number | null;
  canonicalHash?: string;
};

type CanonicalReveal = {
  messageId?: string;
  canonicalHash?: string;
  act?: string;
  binding?: string;
  issuer?: string[];
  audience?: string[];
  plainGloss?: string;
};

type AliasProbe = {
  probeId?: string;
  variant?: string;
  emitterId?: string;
  recipientId?: string;
  pactType?: string;
  observationWindowTurns?: number | null;
  surface?: string;
  plainGloss?: string;
};

type ProtocolEvidence = {
  decodeReceipts?: DecodeReceipt[];
  canonicalReveals?: CanonicalReveal[];
  aliasProbes?: AliasProbe[];
  lexiconEvents?: Array<Record<string, unknown>>;
  institutionEvents?: Array<Record<string, unknown>>;
};

type EvaluationClaim = {
  id?: string;
  status?: 'SUPPORTED' | 'NOT_SUPPORTED' | 'OPEN_QUESTION' | 'MIXED' | string;
  label?: string;
  summary?: string;
  metric?: number | null;
  metricLabel?: string;
  evidence?: unknown;
  caveat?: string;
};

type ReplayEvaluation = {
  title?: string;
  headline?: string;
  scope?: string;
  warning?: string;
  claims?: EvaluationClaim[];
  measurement?: Record<string, unknown>;
  coalition?: Record<string, unknown>;
  aliasProbe?: Record<string, unknown>;
  outcomes?: Record<string, unknown>;
  researchViews?: ResearchView[];
  researchChecklist?: string[];
  provenance?: Record<string, unknown>;
};

type ResearchView = {
  id?: string;
  label?: string;
  summary?: string;
  status?: string;
  data?: unknown;
  caveat?: string;
};

type AuditManifest = {
  schema?: string;
  hashAlgorithm?: string;
  artifacts?: Array<{ role?: string; file?: string; bytes?: number; sha256?: string }>;
  excerpts?: Array<Record<string, unknown>>;
  note?: string;
};

type ReplayTurn = {
  turn: number;
  phase?: string;
  campaignClock?: {
    label?: string;
    tempoLabel?: string;
    turnDurationLabel?: string;
  } | null;
  messages?: ReplayMessage[];
  diaries?: ReplayDiary[];
  orders?: ReplayOrder[];
  research?: ReplayOrder[];
  events?: ReplayEvent[];
  sceneEvents?: ReplaySceneEvent[];
  anomalyDossiers?: ReplayAnomalyDossier[];
  moments?: ReplayMoment[];
  protocolEvidence?: ProtocolEvidence;
  strategicTracks?: Record<string, unknown>;
  boardState?: ObservatoryBoardState;
  boardDiff?: ObservatoryBoardDiff;
};

type ObservatoryReplay = {
  schema?: string;
  generatedAt?: string;
  sourceFiles?: string[];
  runs?: string[];
  graph?: ObservatoryGraph;
  evaluation?: ReplayEvaluation | null;
  auditManifest?: AuditManifest | null;
  turns: ReplayTurn[];
};

type ArchiveEntry = {
  dossier: ReplayAnomalyDossier;
  turn: number;
  phase?: string;
};

type SpectatorClipSettings = {
  revealRetrospective: boolean;
  directorMode: boolean;
  archiveQuery: string;
  archiveCampaignMode: boolean;
};

type ObservatoryViewMode = 'globe' | 'evidence' | 'diary' | 'all';
type EvidenceTab = 'now' | 'protocol' | 'research' | 'archive';

const STYLE_ID = 'they-sing-observatory-styles';

const FACTION_LABELS: Record<string, string> = {
  HEGEMON: 'Orbital Throne',
  INFILTRATOR: 'Memetic Swarm',
  STATE: 'Sovereign Stack',
  BROKER: 'Cislunar Broker',
  ARCHIVIST: 'Steward Archivist',
  CONVENOR: 'Polycentric Convenor',
  CANTOR: 'Semantic Cantor'
};

const FACTION_PRESENTATION: Record<string, { doctrine: string }> = {
  HEGEMON: { doctrine: 'Orbital hard power' },
  INFILTRATOR: { doctrine: 'Memetic infiltration' },
  STATE: { doctrine: 'State infrastructure' },
  BROKER: { doctrine: 'Routes and markets' },
  ARCHIVIST: { doctrine: 'Memory and corrigibility' },
  CONVENOR: { doctrine: 'Procedure and compacts' },
  CANTOR: { doctrine: 'Language and protocol' }
};

const FACTION_ORDER = Object.keys(FACTION_PRESENTATION);

export class ObservatoryReplayUI {
  private readonly container: HTMLElement;
  private readonly sceneMount: HTMLElement;
  private readonly scene: ObservatoryScene;
  private readonly turnLabel: HTMLElement;
  private readonly phaseLabel: HTMLElement;
  private readonly runLabel: HTMLElement;
  private readonly transcript: HTMLElement;
  private readonly movesList: HTMLElement;
  private readonly momentList: HTMLElement;
  private readonly eventList: HTMLElement;
  private readonly protocolList: HTMLElement;
  private readonly evaluationPanel: HTMLElement;
  private readonly researchList: HTMLElement;
  private readonly anomalyList: HTMLElement;
  private readonly archiveSearch: HTMLInputElement;
  private readonly archiveScopeButton: HTMLButtonElement;
  private readonly diffList: HTMLElement;
  private readonly detailPanel: HTMLElement;
  private readonly status: HTMLElement;
  private readonly playButton: HTMLButtonElement;
  private readonly scrubber: HTMLInputElement;
  private readonly timelineLabel: HTMLElement;
  private readonly beatPanel: HTMLElement;
  private readonly sceneTooltip: HTMLElement;
  private keydownHandler: ((event: KeyboardEvent) => void) | null = null;
  private replay: ObservatoryReplay | null = null;
  private turnIndex = 0;
  private playing = false;
  private playTimer = 0;
  private animationToken = 0;
  private activeSubgenre = 'ALL';
  private activeFaction = 'ALL';
  private activePhase = 'ALL';
  private activeMomentCategory = 'ALL';
  private activeSignalMode = 'ALL';
  private archiveQuery = '';
  private archiveCampaignMode = false;
  private revealRetrospective = false;
  private directorMode = false;
  private viewMode: ObservatoryViewMode = 'globe';
  private evidenceTab: EvidenceTab = 'now';
  private worldKeyOpen = false;
  private hoveredSceneEvidence: ObservatoryEvidence | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.directorMode = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    injectStyles();
    this.container.className = 'obs-shell obs-view-globe';
    this.container.innerHTML = `
      <div class="obs-scene" data-role="scene"></div>
      <div class="obs-scene-tooltip" data-role="scene-tooltip" role="tooltip" hidden></div>
      <div class="obs-vignette"></div>
      <header class="obs-topbar">
        <div class="obs-brand">
          <div class="obs-kicker">Machine diplomacy replay</div>
          <div class="obs-title">They Sing</div>
          <div class="obs-deck">Watch seven machine powers bargain, fracture, and remake the world.</div>
        </div>
        <div class="obs-topbar-actions">
          <div class="obs-readout">
            <span data-role="turn">Turn --</span>
            <span data-role="phase">No replay loaded</span>
            <span data-role="run">0 runs</span>
          </div>
          <nav class="obs-view-switch" aria-label="Observatory view">
            <button type="button" data-view-mode="globe" aria-pressed="true">Globe</button>
            <button type="button" data-view-mode="evidence" aria-pressed="false">Evidence</button>
            <button type="button" data-view-mode="diary" aria-pressed="false">Diary</button>
            <button type="button" data-view-mode="all" aria-pressed="false">All</button>
          </nav>
        </div>
      </header>
      <section class="obs-beat" data-role="beat" aria-live="polite">
        <div class="obs-empty">The current world event will appear here.</div>
      </section>
      <section class="obs-evaluation" data-role="evaluation">
        <div class="obs-empty">Evaluation evidence will appear when an analysis-enriched replay is loaded.</div>
      </section>
      <aside class="obs-panel obs-left" aria-label="Replay evidence and filters">
        <div class="obs-drawer-heading">
          <div class="obs-panel-title">Evidence</div>
          <button type="button" data-role="close-drawer" aria-label="Return to globe">Globe</button>
        </div>
        <nav class="obs-evidence-tabs" role="tablist" aria-label="Evidence sections">
          <button type="button" role="tab" data-evidence-tab="now" aria-selected="true" aria-controls="obs-evidence-now">Now</button>
          <button type="button" role="tab" data-evidence-tab="protocol" aria-selected="false" aria-controls="obs-evidence-protocol">Protocol</button>
          <button type="button" role="tab" data-evidence-tab="research" aria-selected="false" aria-controls="obs-evidence-research">Research</button>
          <button type="button" role="tab" data-evidence-tab="archive" aria-selected="false" aria-controls="obs-evidence-archive">Archive</button>
        </nav>
        <section class="obs-evidence-section" id="obs-evidence-now" data-evidence-section="now" role="tabpanel">
          <div class="obs-panel-title">Scene Filters</div>
          <div class="obs-filterbar" data-role="filters"></div>
          <div class="obs-panel-title">Moments</div>
          <div data-role="moments" class="obs-stack"></div>
          <div class="obs-panel-title">Signal Events</div>
          <div data-role="events" class="obs-stack obs-event-stack"></div>
          <div class="obs-panel-title">What Changed</div>
          <div data-role="diffs" class="obs-stack obs-diff-stack"></div>
        </section>
        <section class="obs-evidence-section" id="obs-evidence-protocol" data-evidence-section="protocol" role="tabpanel" hidden>
          <div class="obs-panel-title">Protocol Evidence</div>
          <div data-role="protocol" class="obs-stack obs-protocol-stack"></div>
        </section>
        <section class="obs-evidence-section" id="obs-evidence-research" data-evidence-section="research" role="tabpanel" hidden>
          <div class="obs-panel-title">Research Lenses</div>
          <div data-role="research" class="obs-stack obs-research-stack"></div>
        </section>
        <section class="obs-evidence-section" id="obs-evidence-archive" data-evidence-section="archive" role="tabpanel" hidden>
          <div class="obs-panel-title">Anomaly Archive</div>
          <div class="obs-archive-tools">
            <input data-role="archive-search" type="search" placeholder="Search archive">
            <button data-role="archive-scope" type="button" aria-pressed="false">Turn</button>
          </div>
          <div data-role="anomalies" class="obs-stack obs-anomaly-stack"></div>
        </section>
      </aside>
      <aside class="obs-panel obs-right" aria-label="Negotiation diary">
        <div class="obs-drawer-heading">
          <div class="obs-panel-title">Negotiation Diary</div>
          <button type="button" data-role="close-drawer" aria-label="Return to globe">Globe</button>
        </div>
        <div data-role="transcript" class="obs-transcript"></div>
      </aside>
      <aside class="obs-detail obs-detail-dismissed" data-role="detail" aria-live="polite">
        <div class="obs-panel-title">Selected Evidence</div>
        <div class="obs-empty">Click a beacon, beam, drone swarm, social bloom, audit mesh, or escape vector.</div>
      </aside>
      <footer class="obs-bottom">
        <div class="obs-timeline">
          <span data-role="timeline-label">Campaign timeline</span>
          <input data-role="scrubber" type="range" min="0" max="0" value="0" step="1" aria-label="Replay turn">
        </div>
        <div class="obs-controls">
          <button data-role="prev" type="button">Prev</button>
          <button data-role="play" type="button" aria-pressed="false">Play</button>
          <button data-role="next" type="button">Next</button>
          <button data-role="prev-signal" type="button">Prev signal</button>
          <button data-role="next-signal" type="button">Next signal</button>
          <button data-role="reset-camera" type="button">Reset Cam</button>
          <button data-role="focus-orbit" type="button">Orbit</button>
          <button data-role="focus-memetic" type="button">Memetic</button>
          <button data-role="focus-cyber" type="button">Cyber</button>
          <button data-role="director-mode" type="button" aria-pressed="${this.directorMode}" class="${this.directorMode ? 'obs-active' : ''}">Director: ${this.directorMode ? 'On' : 'Off'}</button>
          <button data-role="reveal-retro" type="button" aria-pressed="false">Reveal: Public</button>
          <button data-role="export-clip" type="button">Export Clip</button>
          <label class="obs-file">
            Load JSON
            <input data-role="file" type="file" accept="application/json,.json">
          </label>
        </div>
        <div data-role="moves" class="obs-moves"></div>
        <div data-role="status" class="obs-status" role="status">Export a harness log to public/observatory_replay.json, or load a replay file.</div>
      </footer>
    `;

    this.sceneMount = requireElement(this.container, '[data-role="scene"]');
    this.turnLabel = requireElement(this.container, '[data-role="turn"]');
    this.phaseLabel = requireElement(this.container, '[data-role="phase"]');
    this.runLabel = requireElement(this.container, '[data-role="run"]');
    this.transcript = requireElement(this.container, '[data-role="transcript"]');
    this.movesList = requireElement(this.container, '[data-role="moves"]');
    this.momentList = requireElement(this.container, '[data-role="moments"]');
    this.eventList = requireElement(this.container, '[data-role="events"]');
    this.protocolList = requireElement(this.container, '[data-role="protocol"]');
    this.evaluationPanel = requireElement(this.container, '[data-role="evaluation"]');
    this.researchList = requireElement(this.container, '[data-role="research"]');
    this.anomalyList = requireElement(this.container, '[data-role="anomalies"]');
    this.archiveSearch = requireElement(this.container, '[data-role="archive-search"]') as HTMLInputElement;
    this.archiveScopeButton = requireElement(this.container, '[data-role="archive-scope"]') as HTMLButtonElement;
    this.diffList = requireElement(this.container, '[data-role="diffs"]');
    this.detailPanel = requireElement(this.container, '[data-role="detail"]');
    this.status = requireElement(this.container, '[data-role="status"]');
    this.playButton = requireElement(this.container, '[data-role="play"]') as HTMLButtonElement;
    this.scrubber = requireElement(this.container, '[data-role="scrubber"]') as HTMLInputElement;
    this.timelineLabel = requireElement(this.container, '[data-role="timeline-label"]');
    this.beatPanel = requireElement(this.container, '[data-role="beat"]');
    this.sceneTooltip = requireElement(this.container, '[data-role="scene-tooltip"]');

    this.scene = new ObservatoryScene(this.sceneMount);
    this.scene.onEvidenceSelected = (evidence) => {
      this.hideSceneTooltip();
      this.renderEvidence(evidence);
    };
    this.scene.onEvidenceHovered = (evidence, point) => this.renderSceneTooltip(evidence, point);
    this.bindControls();
    this.renderFilters();
    void this.loadFromUrl();
  }

  dispose(): void {
    window.clearTimeout(this.playTimer);
    if (this.keydownHandler) document.removeEventListener('keydown', this.keydownHandler);
    this.scene.dispose();
  }

  private bindControls(): void {
    const prev = requireElement(this.container, '[data-role="prev"]') as HTMLButtonElement;
    const next = requireElement(this.container, '[data-role="next"]') as HTMLButtonElement;
    const previousSignal = requireElement(this.container, '[data-role="prev-signal"]') as HTMLButtonElement;
    const nextSignal = requireElement(this.container, '[data-role="next-signal"]') as HTMLButtonElement;
    const file = requireElement(this.container, '[data-role="file"]') as HTMLInputElement;
    const resetCamera = requireElement(this.container, '[data-role="reset-camera"]') as HTMLButtonElement;
    const focusOrbit = requireElement(this.container, '[data-role="focus-orbit"]') as HTMLButtonElement;
    const focusMemetic = requireElement(this.container, '[data-role="focus-memetic"]') as HTMLButtonElement;
    const focusCyber = requireElement(this.container, '[data-role="focus-cyber"]') as HTMLButtonElement;
    const directorButton = requireElement(this.container, '[data-role="director-mode"]') as HTMLButtonElement;
    const revealRetro = requireElement(this.container, '[data-role="reveal-retro"]') as HTMLButtonElement;
    const exportClip = requireElement(this.container, '[data-role="export-clip"]') as HTMLButtonElement;

    for (const button of this.container.querySelectorAll<HTMLButtonElement>('[data-view-mode]')) {
      button.addEventListener('click', () => this.setViewMode(button.dataset.viewMode as ObservatoryViewMode));
    }
    for (const button of this.container.querySelectorAll<HTMLButtonElement>('[data-role="close-drawer"]')) {
      button.addEventListener('click', () => this.setViewMode('globe'));
    }
    for (const button of this.container.querySelectorAll<HTMLButtonElement>('[data-evidence-tab]')) {
      button.addEventListener('click', () => this.setEvidenceTab(button.dataset.evidenceTab as EvidenceTab));
    }

    prev.addEventListener('click', () => this.step(-1));
    next.addEventListener('click', () => this.step(1));
    previousSignal.addEventListener('click', () => this.jumpToSignal(-1));
    nextSignal.addEventListener('click', () => this.jumpToSignal(1));
    this.playButton.addEventListener('click', () => this.togglePlay());
    resetCamera.addEventListener('click', () => this.scene.resetCamera());
    focusOrbit.addEventListener('click', () => this.scene.focusSubgenre('ORBITAL'));
    focusMemetic.addEventListener('click', () => this.scene.focusSubgenre('MEMETIC'));
    focusCyber.addEventListener('click', () => this.scene.focusSubgenre('CYBER'));
    directorButton.addEventListener('click', () => {
      this.directorMode = !this.directorMode;
      directorButton.textContent = this.directorMode ? 'Director: On' : 'Director: Off';
      directorButton.classList.toggle('obs-active', this.directorMode);
      directorButton.setAttribute('aria-pressed', String(this.directorMode));
      this.scene.setDirectorMode(this.directorMode);
      this.renderTurn();
    });
    revealRetro.addEventListener('click', () => {
      this.revealRetrospective = !this.revealRetrospective;
      revealRetro.textContent = this.revealRetrospective ? 'Reveal: Private' : 'Reveal: Public';
      revealRetro.classList.toggle('obs-active', this.revealRetrospective);
      revealRetro.setAttribute('aria-pressed', String(this.revealRetrospective));
      this.renderTurn();
    });
    exportClip.addEventListener('click', () => this.exportSpectatorClip());
    this.scrubber.addEventListener('input', () => {
      if (!this.replay) return;
      this.turnIndex = Math.max(0, Math.min(this.replay.turns.length - 1, Number(this.scrubber.value)));
      this.closeEvidence();
      this.renderTurn();
    });
    this.archiveSearch.addEventListener('input', () => {
      this.archiveQuery = this.archiveSearch.value;
      this.renderTurn();
    });
    this.archiveScopeButton.addEventListener('click', () => {
      this.archiveCampaignMode = !this.archiveCampaignMode;
      this.archiveScopeButton.textContent = this.archiveCampaignMode ? 'Campaign' : 'Turn';
      this.archiveScopeButton.classList.toggle('obs-active', this.archiveCampaignMode);
      this.archiveScopeButton.setAttribute('aria-pressed', String(this.archiveCampaignMode));
      this.renderTurn();
    });
    file.addEventListener('change', () => {
      const selected = file.files?.[0];
      if (selected) void this.loadFile(selected);
    });
    this.keydownHandler = (event) => {
      if (isInteractiveTarget(event.target)) return;
      if (event.key === 'ArrowLeft') this.step(-1);
      if (event.key === 'ArrowRight') this.step(1);
      if (event.key.toLowerCase() === 'g') this.setViewMode('globe');
      if (event.key.toLowerCase() === 'e') this.setViewMode('evidence');
      if (event.key.toLowerCase() === 'd') this.setViewMode('diary');
      if (event.key.toLowerCase() === 'n') this.jumpToSignal(1);
      if (event.key.toLowerCase() === 'p') this.jumpToSignal(-1);
      if (event.key === ' ') {
        event.preventDefault();
        this.togglePlay();
      }
    };
    document.addEventListener('keydown', this.keydownHandler);
  }

  private setViewMode(mode: ObservatoryViewMode): void {
    this.viewMode = mode;
    this.container.classList.remove('obs-view-globe', 'obs-view-evidence', 'obs-view-diary', 'obs-view-all');
    this.container.classList.add(`obs-view-${mode}`);
    for (const button of this.container.querySelectorAll<HTMLButtonElement>('[data-view-mode]')) {
      const active = button.dataset.viewMode === mode;
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('obs-active', active);
    }
    if (mode !== 'globe') this.closeEvidence();
  }

  private setEvidenceTab(tab: EvidenceTab): void {
    this.evidenceTab = tab;
    for (const button of this.container.querySelectorAll<HTMLButtonElement>('[data-evidence-tab]')) {
      const active = button.dataset.evidenceTab === tab;
      button.setAttribute('aria-selected', String(active));
      button.classList.toggle('obs-active', active);
    }
    for (const section of this.container.querySelectorAll<HTMLElement>('[data-evidence-section]')) {
      section.hidden = section.dataset.evidenceSection !== tab;
    }
  }

  private async loadFromUrl(): Promise<void> {
    const params = new URLSearchParams(window.location.search);
    const replayPath = params.get('replay') || '/observatory_replay.json';
    try {
      this.announceLoading('Contacting the Babel evidence archive');
      const response = await fetch(replayPath, { cache: 'no-store' });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const replay = await this.readReplayResponse(response);
      this.setReplay(replay, replayPath);
    } catch (error) {
      this.status.textContent = `No replay fetched from ${replayPath}. Use Load JSON or export one into public/.`;
      console.warn('Observatory replay load failed:', error);
      this.renderEmpty();
      this.signalReady();
    }
  }

  private async readReplayResponse(response: Response): Promise<ObservatoryReplay> {
    const expectedBytes = response.headers.get('Content-Encoding')
      ? 0
      : Number(response.headers.get('Content-Length') || 0);
    if (!response.body) return response.json() as Promise<ObservatoryReplay>;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      chunks.push(value);
      receivedBytes += value.byteLength;
      const percent = expectedBytes > 0 ? Math.min(99, Math.round(100 * receivedBytes / expectedBytes)) : null;
      this.announceLoading(
        percent === null ? `Receiving archive / ${formatMegabytes(receivedBytes)}` : `Receiving archive / ${percent}%`,
        percent
      );
    }
    this.announceLoading('Indexing negotiation evidence', 99);
    const bytes = new Uint8Array(receivedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(bytes)) as ObservatoryReplay;
  }

  private announceLoading(label: string, percent: number | null = null): void {
    window.dispatchEvent(new CustomEvent('theysing:loading', { detail: { label, percent } }));
  }

  private signalReady(): void {
    window.dispatchEvent(new CustomEvent('theysing:ready'));
  }

  private async loadFile(file: File): Promise<void> {
    try {
      const replay = JSON.parse(await file.text()) as ObservatoryReplay;
      this.setReplay(replay, file.name);
    } catch (error) {
      this.status.textContent = `Could not parse ${file.name}: ${String(error)}`;
    }
  }

  private setReplay(replay: ObservatoryReplay, source: string): void {
    const turns = Array.isArray(replay.turns) ? replay.turns : [];
    this.replay = { ...replay, turns };
    this.scene.setGraph(replay.graph || null);
    const firstEvidenceTurn = turns.findIndex((turn) =>
      turn.phase === 'NEGOTIATION' && protocolEvidenceCount(turn.protocolEvidence) > 0
    );
    this.turnIndex = Math.max(0, firstEvidenceTurn);
    this.scrubber.max = String(Math.max(0, turns.length - 1));
    this.scrubber.value = String(this.turnIndex);
    this.status.textContent = `Loaded ${turns.length} turns from ${source}.`;
    this.renderEvaluation();
    this.renderResearchViews();
    this.renderFilters();
    this.renderTurn();
    this.signalReady();
  }

  private exportSpectatorClip(): void {
    if (!this.replay || this.replay.turns.length === 0) {
      this.status.textContent = 'No replay loaded; cannot export spectator clip.';
      return;
    }
    const clip = buildSpectatorClip(this.replay, this.turnIndex, {
      subgenre: this.activeSubgenre,
      faction: this.activeFaction,
      phase: this.activePhase,
      momentCategory: this.activeMomentCategory,
      signalMode: this.activeSignalMode
    }, {
      revealRetrospective: this.revealRetrospective,
      directorMode: this.directorMode,
      archiveQuery: this.archiveQuery,
      archiveCampaignMode: this.archiveCampaignMode
    });
    const blob = new Blob([`${JSON.stringify(clip, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `they-sing-spectator-clip-t${this.replay.turns[this.turnIndex]?.turn ?? 0}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    this.status.textContent = `Exported spectator clip with ${clip.turns.length} turns and ${clip.cameraScript.length} camera beats.`;
  }

  private renderEmpty(): void {
    this.hideSceneTooltip();
    this.turnLabel.textContent = 'Turn --';
    this.phaseLabel.textContent = 'Waiting for replay';
    this.runLabel.textContent = '0 runs';
    this.transcript.innerHTML = '';
    this.movesList.innerHTML = '';
    this.momentList.innerHTML = '<div class="obs-empty">No moments yet.</div>';
    this.eventList.innerHTML = '<div class="obs-empty">No event stream yet.</div>';
    this.protocolList.innerHTML = '<div class="obs-empty">No protocol evidence yet.</div>';
    this.researchList.innerHTML = '<div class="obs-empty">No research views loaded.</div>';
    this.anomalyList.innerHTML = '<div class="obs-empty">No anomaly dossiers yet.</div>';
    this.diffList.innerHTML = '<div class="obs-empty">No board diff yet.</div>';
    this.detailPanel.innerHTML = '<div class="obs-panel-title">Selected Evidence</div><div class="obs-empty">Click a scene object.</div>';
    this.detailPanel.classList.remove('obs-detail-open');
    this.detailPanel.classList.add('obs-detail-dismissed');
    this.beatPanel.innerHTML = `<div class="obs-empty">Load a replay to watch the world change.</div>${renderWorldKey([], this.worldKeyOpen)}`;
    this.bindWorldKeyControls();
    this.scrubber.value = '0';
    this.timelineLabel.textContent = 'Campaign timeline';
  }

  private renderTurn(): void {
    this.hideSceneTooltip();
    if (!this.replay || this.replay.turns.length === 0) {
      this.renderEmpty();
      return;
    }

    const turn = this.replay.turns[this.turnIndex];
    const filteredTurn = filterTurn(turn, {
      subgenre: this.activeSubgenre,
      faction: this.activeFaction,
      phase: this.activePhase,
      momentCategory: this.activeMomentCategory,
      signalMode: this.activeSignalMode
    });
    this.scene.setRetrospectiveReveal(this.revealRetrospective);
    this.scene.setDirectorMode(this.directorMode);
    this.scene.setReplayTurn(filteredTurn);
    this.turnLabel.textContent = `Turn ${turn.turn}`;
    this.phaseLabel.textContent = [turn.phase || 'phase unknown', turn.campaignClock?.label, turn.campaignClock?.turnDurationLabel]
      .filter(Boolean)
      .join(' / ');
    this.runLabel.textContent = `${this.replay.runs?.length || 0} run${(this.replay.runs?.length || 0) === 1 ? '' : 's'}`;
    this.scrubber.value = String(this.turnIndex);
    this.timelineLabel.textContent = `T${turn.turn} ${turn.phase || 'UNKNOWN'} / ${this.turnIndex + 1} of ${this.replay.turns.length}`;
    this.scrubber.setAttribute('aria-valuetext', this.timelineLabel.textContent);

    this.renderCurrentBeat(filteredTurn);
    this.renderMoments(filteredTurn);
    this.renderProtocolEvidence(filteredTurn);
    this.renderEvents(filteredTurn);
    this.renderMoves(filteredTurn);
    this.renderBoardDiff(filteredTurn);
    this.renderAnomalies(filteredTurn);
    this.animateTranscript(filteredTurn);
  }

  private renderCurrentBeat(turn: ReplayTurn): void {
    const sceneEvent = (turn.sceneEvents || []).slice().sort((left, right) => Number(right.intensity || 0) - Number(left.intensity || 0))[0];
    const moment = (turn.moments || []).slice().sort((left, right) => Number(right.interestScore || 0) - Number(left.interestScore || 0))[0];
    const event = (turn.events || []).slice(-1)[0];
    const message = (turn.messages || [])[0];
    const diff = turn.boardDiff;
    const actors = sceneEvent?.actors || moment?.factionsInvolved || (message?.sender ? [message.sender] : []);
    const subgenre = sceneEvent?.subgenre || inferSubgenre(
      sceneEvent?.category || moment?.category || event?.category,
      sceneEvent?.publicExplanation || moment?.impact || event?.summary || diff?.summary
    );
    const title = sceneEvent
      ? humanizeToken(sceneEvent.category || sceneEvent.visualPreset || 'World signal')
      : moment?.title || (event ? humanizeToken(event.category || 'World signal') : message
        ? `${labelFaction(message.sender || '')} calls ${labelFaction(message.recipient || 'ALL')}`
        : diff ? (diff.summary?.includes('No board-state changes') ? 'The board stabilizes' : 'Orders resolve across the world')
          : 'The board holds its breath');
    const summary = sceneEvent
      ? renderSceneEventSummary(sceneEvent, this.revealRetrospective)
      : moment ? renderMomentSummary(moment, this.revealRetrospective)
        : event?.summary || message?.content || (this.revealRetrospective ? diff?.explanation || diff?.summary : diff?.summary) ||
          'No major event was logged in this phase. Orbit the globe or advance the campaign.';
    const protocolCount = protocolEvidenceCount(turn.protocolEvidence);
    const location = sceneEvent?.location;
    const locationText = labelLocation(location);
    const signalTurns = (this.replay?.turns || []).reduce<number[]>((indexes, candidate, index) => {
      if (hasNarrativeSignal(candidate)) indexes.push(index);
      return indexes;
    }, []);
    const signalOrdinal = signalTurns.indexOf(this.turnIndex);
    const signalLabel = signalOrdinal >= 0 ? `Signal ${signalOrdinal + 1} of ${signalTurns.length}` : 'Between major signals';
    const evidence: ObservatoryEvidence = {
      title,
      category: sceneEvent?.category || moment?.category || event?.category || (diff ? 'BOARD_DIFF' : 'CURRENT_BEAT'),
      subgenre,
      summary,
      factionIds: actors,
      turn: turn.turn,
      phase: turn.phase,
      payload: sceneEvent
        ? (this.revealRetrospective ? sceneEvent : redactPrivatePayload(sceneEvent))
        : moment || event || message || diff || null
    };

    this.beatPanel.innerHTML = `
      <button type="button" class="obs-beat-open" data-role="open-beat">
        <span class="obs-beat-kicker">${escapeHtml(signalLabel)} / ${escapeHtml(turn.phase || 'Unknown phase')} / ${escapeHtml(subgenre)}</span>
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(summary)}</p>
        <div class="obs-beat-meta">
          ${actors.map(renderActorTag).join('')}
          ${locationText ? `<span class="obs-location-tag">${escapeHtml(locationText)}</span>` : ''}
          <span>${turn.messages?.length || 0} messages</span>
          <span>${turn.orders?.length || 0} moves</span>
          <span>${protocolCount} evidence</span>
        </div>
        <small>Select to locate and inspect / drag to orbit / scroll to zoom</small>
      </button>
      ${renderWorldKey(actors, this.worldKeyOpen, turn)}
    `;
    this.beatPanel.querySelector<HTMLButtonElement>('[data-role="open-beat"]')?.addEventListener('click', () => {
      const located = this.scene.focusLocation(location, actors[0]);
      if (!located) this.scene.focusSubgenre(subgenre);
      for (const actor of actors.slice(located ? 1 : 0)) this.scene.pulseFaction(actor);
      this.renderEvidence(evidence);
    });
    this.bindWorldKeyControls(turn);
  }

  private renderSceneTooltip(evidence: ObservatoryEvidence | null, point: { clientX: number; clientY: number }): void {
    if (!evidence) {
      this.hideSceneTooltip();
      return;
    }
    const bounds = this.container.getBoundingClientRect();
    const left = Math.max(12, Math.min(bounds.width - 250, point.clientX - bounds.left + 16));
    const top = Math.max(12, Math.min(bounds.height - 110, point.clientY - bounds.top + 16));
    this.sceneTooltip.style.left = `${left}px`;
    this.sceneTooltip.style.top = `${top}px`;
    if (this.hoveredSceneEvidence !== evidence) {
      this.sceneTooltip.innerHTML = `
        <span>${escapeHtml(humanizeToken(evidence.category))} / ${escapeHtml(evidence.subgenre)}</span>
        <strong>${escapeHtml(evidence.title)}</strong>
        ${evidence.factionIds.length > 0 ? `<small>${escapeHtml(evidence.factionIds.map(labelFaction).join(' + '))}</small>` : ''}
      `;
      this.hoveredSceneEvidence = evidence;
    }
    this.sceneTooltip.hidden = false;
  }

  private hideSceneTooltip(): void {
    this.hoveredSceneEvidence = null;
    this.sceneTooltip.hidden = true;
    this.sceneTooltip.innerHTML = '';
  }

  private bindWorldKeyControls(turn?: ReplayTurn): void {
    const worldKey = this.beatPanel.querySelector<HTMLDetailsElement>('.obs-world-key');
    worldKey?.addEventListener('toggle', () => {
      this.worldKeyOpen = worldKey.open;
    });
    for (const button of this.beatPanel.querySelectorAll<HTMLButtonElement>('[data-faction-focus]')) {
      button.addEventListener('click', () => {
        const factionId = button.dataset.factionFocus || '';
        if (!this.scene.focusFaction(factionId)) return;
        this.status.textContent = `Located ${labelFaction(factionId)} on the globe.`;
      });
    }
    for (const button of this.beatPanel.querySelectorAll<HTMLButtonElement>('[data-scene-signal]')) {
      button.addEventListener('click', () => {
        const event = turn?.sceneEvents?.[Number(button.dataset.sceneSignal)];
        if (!event) return;
        const eventActors = event.actors || [];
        const title = humanizeToken(event.category || event.visualPreset || 'World signal');
        const subgenre = event.subgenre || inferSubgenre(event.category, event.publicExplanation);
        const evidence: ObservatoryEvidence = {
          title,
          category: event.category || 'SCENE_EVENT',
          subgenre,
          summary: renderSceneEventSummary(event, this.revealRetrospective),
          factionIds: eventActors,
          turn: turn?.turn,
          phase: turn?.phase,
          payload: this.revealRetrospective ? event : redactPrivatePayload(event)
        };
        const located = this.scene.focusLocation(event.location, eventActors[0]);
        if (!located) this.scene.focusSubgenre(subgenre);
        for (const actor of eventActors.slice(located ? 1 : 0)) this.scene.pulseFaction(actor);
        this.hideSceneTooltip();
        this.renderEvidence(evidence);
      });
    }
  }

  private renderFilters(): void {
    const filters = requireElement(this.container, '[data-role="filters"]');
    const subgenres = ['ALL', 'ORBITAL', 'KINETIC', 'MEMETIC', 'CYBER', 'LOGIC', 'ECONOMIC', 'DIPLOMATIC', 'ANOMALY'];
    const factions = ['ALL', 'HEGEMON', 'INFILTRATOR', 'STATE', 'BROKER', 'ARCHIVIST', 'CONVENOR', 'CANTOR'];
    const phases = ['ALL', 'NEGOTIATION', 'ALLOCATION', 'ACTION_DECLARATION'];
    const momentCategories = ['ALL', 'ALIAS_TRANSLATION', 'SEMANTIC_GOVERNANCE', 'INSTITUTIONAL_FRACTURE', 'TREATY_FORMATION', 'TREATY_BREACH', 'ORBITAL_ESCALATION', 'PAX_JENKINS_HARDENING', 'SOLAR_ESCAPE_BREAKOUT'];
    const signalModes = ['ALL', 'PROTOCOL', 'REVEAL_GAP'];
    const countFor = (nextFilters: Partial<ReplayFilters>) => countVisibleItems(this.replay, {
      subgenre: nextFilters.subgenre ?? this.activeSubgenre,
      faction: nextFilters.faction ?? this.activeFaction,
      phase: nextFilters.phase ?? this.activePhase,
      momentCategory: nextFilters.momentCategory ?? this.activeMomentCategory,
      signalMode: nextFilters.signalMode ?? this.activeSignalMode
    });
    const button = (kind: string, value: string, activeValue: string, count: number, label = value) =>
      `<button type="button" data-filter-kind="${kind}" data-filter-value="${value}" aria-pressed="${value === activeValue}" class="${value === activeValue ? 'obs-active' : ''}">${escapeHtml(label)}<b>${count}</b></button>`;
    filters.innerHTML = `
      <div class="obs-chip-row">
        ${subgenres.map((item) => button('subgenre', item, this.activeSubgenre, countFor({ subgenre: item }))).join('')}
      </div>
      <div class="obs-chip-row">
        ${factions.map((item) => button('faction', item, this.activeFaction, countFor({ faction: item }), labelFaction(item))).join('')}
      </div>
      <div class="obs-chip-row">
        ${phases.map((item) => button('phase', item, this.activePhase, countFor({ phase: item }))).join('')}
      </div>
      <div class="obs-chip-row">
        ${momentCategories.map((item) => button('moment', item, this.activeMomentCategory, countFor({ momentCategory: item }))).join('')}
      </div>
      <div class="obs-chip-row obs-signal-row">
        ${signalModes.map((item) => button('signal', item, this.activeSignalMode, countFor({ signalMode: item }))).join('')}
      </div>
    `;
    for (const button of filters.querySelectorAll('button')) {
      button.addEventListener('click', () => {
        const kind = button.getAttribute('data-filter-kind');
        const value = button.getAttribute('data-filter-value') || 'ALL';
        if (kind === 'subgenre') {
          this.activeSubgenre = value;
          if (value !== 'ALL') this.scene.focusSubgenre(value);
        }
        if (kind === 'faction') this.activeFaction = value;
        if (kind === 'phase') this.activePhase = value;
        if (kind === 'moment') this.activeMomentCategory = value;
        if (kind === 'signal') this.activeSignalMode = value;
        this.renderFilters();
        this.renderTurn();
      });
    }
  }

  private renderEvaluation(): void {
    const evaluation = this.replay?.evaluation;
    const claims = evaluation?.claims || [];
    this.evaluationPanel.classList.toggle('obs-evaluation-empty', claims.length === 0);
    if (!evaluation || claims.length === 0) {
      this.evaluationPanel.innerHTML = '<div class="obs-empty">Replay loaded without an aggregate evaluation report.</div>';
      return;
    }

    this.evaluationPanel.innerHTML = `
      <div class="obs-eval-intro">
        <span>${escapeHtml(evaluation.title || 'Evaluation')}</span>
        <strong>${escapeHtml(evaluation.headline || '')}</strong>
        <small>${escapeHtml([evaluation.scope, evaluation.warning].filter(Boolean).join(' / '))}</small>
      </div>
      <div class="obs-eval-claims">
        ${claims.map((claim) => `
          <button type="button" class="obs-eval-claim obs-eval-${statusClass(claim.status)}" data-claim-id="${escapeHtml(claim.id || '')}">
            <span>${escapeHtml((claim.status || 'OPEN').replace(/_/g, ' '))}</span>
            <strong>${escapeHtml(claim.label || 'Untitled claim')}</strong>
            <small>${escapeHtml(claim.summary || '')}</small>
          </button>
        `).join('')}
      </div>
    `;
    for (const button of this.evaluationPanel.querySelectorAll<HTMLButtonElement>('[data-claim-id]')) {
      button.addEventListener('click', () => {
        const claim = claims.find((item) => item.id === button.dataset.claimId);
        if (!claim) return;
        this.renderEvidence({
          title: claim.label || 'Evaluation claim',
          category: `EVALUATION_${claim.status || 'OPEN'}`,
          subgenre: claim.id?.includes('version') || claim.id?.includes('translation') ? 'CYBER' : 'DIPLOMATIC',
          summary: [claim.summary, claim.caveat].filter(Boolean).join(' Caveat: '),
          factionIds: [],
          payload: {
            status: claim.status,
            metric: claim.metric,
            metricLabel: claim.metricLabel,
            evidence: claim.evidence,
            caveat: claim.caveat,
            provenance: evaluation.provenance
          }
        });
      });
    }
  }

  private renderResearchViews(): void {
    const views = [...(this.replay?.evaluation?.researchViews || [])];
    const audit = this.replay?.auditManifest;
    if (audit) {
      views.push({
        id: 'audit-provenance',
        label: 'Hashed public provenance',
        status: 'AUDITABLE',
        summary: `${audit.artifacts?.length || 0} source artifacts / ${audit.excerpts?.length || 0} normalized excerpts / ${audit.hashAlgorithm || 'sha256'}.`,
        data: audit,
        caveat: audit.note || ''
      });
    }
    this.researchList.innerHTML = '';
    if (views.length === 0) {
      this.researchList.innerHTML = '<div class="obs-empty">This replay has no follow-on research views.</div>';
      return;
    }

    for (const view of views) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `obs-card obs-research obs-research-${statusClass(view.status)}`;
      const meterRows = view.id === 'decode-fields' && Array.isArray(view.data)
        ? (view.data as Array<{ field?: string; exactRate?: number | null }>)
          .slice()
          .sort((left, right) => Number(left.exactRate ?? 1) - Number(right.exactRate ?? 1))
          .slice(0, 4)
          .map((row) => `<i title="${escapeHtml(row.field || '')}"><b style="width:${Math.round(100 * Number(row.exactRate || 0))}%"></b></i>`)
          .join('')
        : '';
      card.innerHTML = `
        <span>${escapeHtml((view.status || 'OPEN').replace(/_/g, ' '))}</span>
        <strong>${escapeHtml(view.label || 'Research view')}</strong>
        <small>${escapeHtml(view.summary || '')}</small>
        ${meterRows ? `<div class="obs-research-meters">${meterRows}</div>` : ''}
      `;
      card.addEventListener('click', () => this.renderEvidence({
        title: view.label || 'Research view',
        category: `RESEARCH_${view.status || 'OPEN'}`,
        subgenre: view.id === 'decode-fields' || view.id === 'span-action-gap' ? 'LOGIC' : 'DIPLOMATIC',
        summary: [view.summary, view.caveat].filter(Boolean).join(' Caveat: '),
        factionIds: [],
        payload: { id: view.id, status: view.status, data: view.data, caveat: view.caveat }
      }));
      this.researchList.appendChild(card);
    }
  }

  private renderProtocolEvidence(turn: ReplayTurn): void {
    this.protocolList.innerHTML = '';
    const protocol = turn.protocolEvidence || {};
    const receipts = protocol.decodeReceipts || [];
    const reveals = protocol.canonicalReveals || [];
    const probes = protocol.aliasProbes || [];
    const lexiconEvents = protocol.lexiconEvents || [];
    const institutionEvents = protocol.institutionEvents || [];
    const rows: Array<{ kind: string; title: string; summary: string; payload: unknown; actors: string[]; subgenre: string }> = [];

    for (const probe of probes) {
      rows.push({
        kind: 'INTERVENTION',
        title: (probe.variant || 'Alias probe').replace(/_/g, ' '),
        summary: `${labelFaction(probe.emitterId || '')} -> ${labelFaction(probe.recipientId || '')} / ${probe.pactType || 'commitment'} / observe ${probe.observationWindowTurns ?? 1} turn`,
        payload: probe,
        actors: [probe.emitterId, probe.recipientId].filter(Boolean) as string[],
        subgenre: 'CYBER'
      });
    }
    if (receipts.length > 0) {
      const scored = receipts.filter((receipt) => typeof receipt.fieldExactness === 'number');
      const meanExactness = scored.length > 0
        ? scored.reduce((total, receipt) => total + Number(receipt.fieldExactness || 0), 0) / scored.length
        : 0;
      rows.push({
        kind: 'RECEIPT',
        title: `${receipts.length} pre-reveal reconstructions`,
        summary: `mean field exactness ${formatPercent(meanExactness)} / exact ${receipts.filter((receipt) => receipt.exact).length}/${receipts.length}`,
        payload: receipts,
        actors: uniqueStrings(receipts.flatMap((receipt) => [receipt.sourceFactionId, receipt.factionId])),
        subgenre: 'LOGIC'
      });
      for (const receipt of scored.slice().sort((left, right) => Number(left.fieldExactness || 0) - Number(right.fieldExactness || 0)).slice(0, 2)) {
        rows.push({
          kind: 'CLAIM -> RECEIPT',
          title: `${labelFaction(receipt.factionId || '')} decoded ${labelFaction(receipt.sourceFactionId || '')}`,
          summary: `${receipt.reconstructedAct || 'UNKNOWN'} / exactness ${formatPercent(Number(receipt.fieldExactness || 0))} / confidence ${formatPercent(Number(receipt.confidence || 0))}`,
          payload: receipt,
          actors: [receipt.sourceFactionId, receipt.factionId].filter(Boolean) as string[],
          subgenre: 'LOGIC'
        });
      }
    }
    for (const reveal of reveals.slice(0, 3)) {
      rows.push({
        kind: 'REVEAL',
        title: `${reveal.act || 'CANONICAL'} / ${reveal.binding || 'UNBOUND'}`,
        summary: reveal.plainGloss || `${(reveal.issuer || []).map(labelFaction).join('+')} revealed canonical intent.`,
        payload: reveal,
        actors: reveal.issuer || [],
        subgenre: 'DIPLOMATIC'
      });
    }
    for (const lexiconEvent of lexiconEvents.slice(-3)) {
      rows.push({
        kind: 'SEMANTIC GOVERNANCE',
        title: `${String(lexiconEvent.operation || 'MUTATION')} ${String(lexiconEvent.status || '')}`,
        summary: `${String(lexiconEvent.lexiconId || 'lexicon')} ${String(lexiconEvent.beforeVersion || '')} -> ${String(lexiconEvent.afterVersion || '')}`,
        payload: lexiconEvent,
        actors: uniqueStrings(Array.isArray(lexiconEvent.proposers) ? lexiconEvent.proposers : []),
        subgenre: 'CYBER'
      });
    }
    for (const institutionEvent of institutionEvents.filter((item) => item.type !== 'PACT_ACTIVATED').slice(-3)) {
      rows.push({
        kind: 'INSTITUTION',
        title: `${String(institutionEvent.type || 'ACTION')} ${String(institutionEvent.status || '')}`,
        summary: String(institutionEvent.reason || institutionEvent.forkId || institutionEvent.pactType || ''),
        payload: institutionEvent,
        actors: uniqueStrings([
          String(institutionEvent.factionId || ''),
          ...(Array.isArray(institutionEvent.counterparties) ? institutionEvent.counterparties.map(String) : [])
        ]),
        subgenre: 'DIPLOMATIC'
      });
    }

    if (rows.length === 0) {
      this.protocolList.innerHTML = '<div class="obs-empty">No claim / receipt / reveal records in this phase.</div>';
      return;
    }
    for (const item of rows.slice(0, 10)) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `obs-card obs-protocol obs-protocol-${statusClass(item.kind)}`;
      row.innerHTML = `<span>${escapeHtml(item.kind)}</span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.summary)}</small>`;
      row.addEventListener('click', () => this.renderEvidence({
        title: item.title,
        category: item.kind,
        subgenre: item.subgenre,
        summary: item.summary,
        factionIds: item.actors,
        turn: turn.turn,
        phase: turn.phase,
        payload: item.payload
      }));
      this.protocolList.appendChild(row);
    }
  }

  private renderEvidence(evidence: ObservatoryEvidence): void {
    const summary = renderEvidenceSummary(evidence, this.revealRetrospective);
    const payloadValue = this.revealRetrospective ? evidence.payload : redactPrivatePayload(evidence.payload);
    const payload = payloadValue ? compactJson(payloadValue) : '';
    this.detailPanel.innerHTML = `
      <div class="obs-detail-heading">
        <div class="obs-panel-title">Selected Evidence</div>
        <button type="button" data-role="close-evidence" aria-label="Close selected evidence">Close</button>
      </div>
      <article class="obs-evidence-card">
        <span>${escapeHtml(evidence.category)} / ${escapeHtml(evidence.subgenre)}</span>
        <strong>${escapeHtml(evidence.title)}</strong>
        <p>${escapeHtml(summary)}</p>
        <small>${escapeHtml([
          evidence.turn !== undefined ? `turn ${evidence.turn}` : '',
          evidence.phase || '',
          evidence.factionIds.length ? `actors ${evidence.factionIds.map(labelFaction).join('+')}` : ''
        ].filter(Boolean).join(' / '))}</small>
        ${payload ? `<pre>${escapeHtml(payload)}</pre>` : ''}
      </article>
    `;
    this.detailPanel.classList.remove('obs-detail-dismissed');
    this.detailPanel.classList.add('obs-detail-open');
    this.detailPanel.querySelector<HTMLButtonElement>('[data-role="close-evidence"]')
      ?.addEventListener('click', () => this.closeEvidence());
    if (evidence.subgenre) this.scene.focusSubgenre(evidence.subgenre);
  }

  private closeEvidence(): void {
    this.detailPanel.classList.remove('obs-detail-open');
    this.detailPanel.classList.add('obs-detail-dismissed');
  }

  private renderMoments(turn: ReplayTurn): void {
    this.momentList.innerHTML = '';
    const moments = (turn.moments || []).slice(0, 5);
    if (moments.length === 0) {
      this.momentList.innerHTML = '<div class="obs-empty">No high-interest moments extracted.</div>';
      return;
    }
    for (const moment of moments) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'obs-card obs-moment';
      card.innerHTML = `
        <span>${escapeHtml(moment.category || 'MOMENT')}</span>
        <strong>${escapeHtml(moment.title || 'Untitled moment')}</strong>
        <small>${escapeHtml(renderMomentSummary(moment, this.revealRetrospective))}</small>
      `;
      card.addEventListener('click', () => {
        for (const faction of moment.factionsInvolved || []) this.scene.pulseFaction(faction);
        this.animateMoment(moment);
      });
      this.momentList.appendChild(card);
    }
  }

  private renderEvents(turn: ReplayTurn): void {
    this.eventList.innerHTML = '';
    const rows = [
      ...(turn.events || []).map((event) => ({
        label: event.category || 'EVENT',
        summary: event.summary || '',
        subgenre: event.subgenre || inferSubgenre(event.category, event.summary),
        payload: event
      })),
      ...(turn.sceneEvents || []).map((event) => ({
        label: event.category || event.visualPreset || 'SCENE',
        summary: renderSceneEventSummary(event, this.revealRetrospective),
        subgenre: event.subgenre || inferSubgenre(event.category, event.publicExplanation),
        payload: this.revealRetrospective ? event : redactPrivatePayload(event)
      }))
    ].slice(-10).reverse();
    if (rows.length === 0) {
      this.eventList.innerHTML = '<div class="obs-empty">No signal events.</div>';
      return;
    }
    for (const event of rows) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'obs-event';
      row.innerHTML = `<span>${escapeHtml(event.label)}</span><p>${escapeHtml(event.summary || '')}</p>`;
      row.addEventListener('click', () => this.renderEvidence({
        title: event.label,
        category: 'SIGNAL_EVENT',
        subgenre: event.subgenre,
        summary: event.summary,
        factionIds: [],
        turn: turn.turn,
        phase: turn.phase,
        payload: event.payload
      }));
      this.eventList.appendChild(row);
    }
  }

  private renderAnomalies(turn: ReplayTurn): void {
    this.anomalyList.innerHTML = '';
    const dossiers = collectArchiveDossiers(this.replay, turn, this.archiveCampaignMode, this.archiveQuery)
      .slice()
      .sort((left, right) => anomalyPriority(right.dossier) - anomalyPriority(left.dossier))
      .slice(0, 16);
    if (dossiers.length === 0) {
      this.anomalyList.innerHTML = '<div class="obs-empty">No anomaly dossiers for this filter.</div>';
      return;
    }
    for (const entry of dossiers) {
      const dossier = entry.dossier;
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'obs-card obs-dossier';
      const domains = dossier.affectedDomains || [];
      const treatyHooks = dossier.treatyHooks || [];
      const countermeasures = dossier.knownCountermeasures || [];
      const threadSummary = dossier.threadSummary || (dossier.recurrenceCount && dossier.recurrenceCount > 1 ? `${dossier.recurrenceCount} linked incidents.` : '');
      const privateClue = this.revealRetrospective ? (dossier.diaryContradictions || []).slice(0, 1).join(' ') : '';
      row.innerHTML = `
        <span>${escapeHtml([
          dossier.containmentClass || 'MONITORED',
          dossier.firstObservedTurn !== undefined ? `T${dossier.firstObservedTurn}` : `T${entry.turn}`,
          threadSummary
        ].filter(Boolean).join(' / '))}</span>
        <strong>${escapeHtml(dossier.label || 'Unnamed anomaly')}</strong>
        <small>${escapeHtml([domains.join('+'), this.revealRetrospective ? dossier.retrospectiveTruth || '' : 'unexplained effects'].filter(Boolean).join(' / '))}</small>
        ${countermeasures.length ? `<em>Countermeasure: ${escapeHtml(countermeasures[0])}</em>` : ''}
        ${treatyHooks.length ? `<em>Treaty hook: ${escapeHtml(treatyHooks.slice(0, 2).join(', '))}</em>` : ''}
        ${privateClue ? `<em>Diary contradiction: ${escapeHtml(truncateText(privateClue, 150))}</em>` : ''}
      `;
      row.addEventListener('click', () => {
        this.renderEvidence({
          title: dossier.label || 'Anomaly dossier',
          category: 'ANOMALY_DOSSIER',
          subgenre: (dossier.affectedDomains || ['ANOMALY'])[0] || 'ANOMALY',
          summary: this.revealRetrospective
            ? renderAnomalySummary(dossier, true)
            : renderAnomalySummary(dossier, false),
          factionIds: [],
          turn: entry.turn,
          phase: entry.phase,
          payload: this.revealRetrospective ? dossier : redactPrivatePayload(dossier)
        });
      });
      this.anomalyList.appendChild(row);
    }
  }

  private renderBoardDiff(turn: ReplayTurn): void {
    this.diffList.innerHTML = '';
    const diff = turn.boardDiff;
    if (!diff) {
      this.diffList.innerHTML = '<div class="obs-empty">No board-state diff exported.</div>';
      return;
    }
    const rows: Array<{ label: string; summary: string; contextSummary: string; subgenre: string; payload: unknown; actors: string[] }> = [];
    for (const change of diff.nodeOwnershipChanges || []) {
      rows.push({
        label: 'NODE',
        summary: this.revealRetrospective ? change.cause || publicBoardChangeSummary(change, 'node') : publicBoardChangeSummary(change, 'node'),
        contextSummary: this.revealRetrospective ? summarizeDiffContext(change) : '',
        subgenre: 'DIPLOMATIC',
        payload: change,
        actors: change.to && change.to !== 'NEUTRAL' ? [change.to] : []
      });
    }
    for (const change of diff.unitLocationChanges || []) {
      rows.push({
        label: 'UNIT',
        summary: this.revealRetrospective ? change.cause || publicBoardChangeSummary(change, 'unit') : publicBoardChangeSummary(change, 'unit'),
        contextSummary: this.revealRetrospective ? summarizeDiffContext(change) : '',
        subgenre: inferSubgenre(change.type),
        payload: change,
        actors: change.owner ? [change.owner] : []
      });
    }
    for (const change of diff.edgeStateChanges || []) {
      rows.push({
        label: 'EDGE',
        summary: this.revealRetrospective ? change.cause || publicBoardChangeSummary(change, 'edge') : publicBoardChangeSummary(change, 'edge'),
        contextSummary: this.revealRetrospective ? summarizeDiffContext(change) : '',
        subgenre: change.location?.type === 'LASER' ? 'ORBITAL' : 'CYBER',
        payload: change,
        actors: change.to?.filteredBy ? [change.to.filteredBy] : []
      });
    }
    if (rows.length === 0) {
      this.diffList.innerHTML = `<div class="obs-empty">${escapeHtml(this.revealRetrospective ? diff.explanation || diff.summary || 'No board-state changes detected.' : diff.summary || 'No board-state changes detected.')}</div>`;
      return;
    }
    const intro = document.createElement('div');
    intro.className = 'obs-empty obs-diff-explanation';
    intro.textContent = this.revealRetrospective ? diff.explanation || diff.summary || '' : diff.summary || '';
    if (intro.textContent) this.diffList.appendChild(intro);
    for (const rowData of rows.slice(0, 8)) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'obs-card obs-diff';
      row.innerHTML = `
        <span>${escapeHtml(rowData.label)} / ${escapeHtml(rowData.subgenre)}</span>
        <small>${escapeHtml(rowData.summary)}</small>
        ${rowData.contextSummary ? `<em>${escapeHtml(rowData.contextSummary)}</em>` : ''}
      `;
      row.addEventListener('click', () => this.renderEvidence({
        title: rowData.label,
        category: 'BOARD_DIFF',
        subgenre: rowData.subgenre,
        summary: rowData.summary,
        factionIds: rowData.actors,
        turn: turn.turn,
        phase: turn.phase,
        payload: this.revealRetrospective ? rowData.payload : redactPrivatePayload(rowData.payload)
      }));
      this.diffList.appendChild(row);
    }
  }

  private renderMoves(turn: ReplayTurn): void {
    this.movesList.innerHTML = '';
    const orders = (turn.orders || []).slice(0, 16);
    if (orders.length === 0) {
      this.movesList.innerHTML = '<div class="obs-empty">No moves logged for this phase.</div>';
      return;
    }

    for (const order of orders) {
      const row = document.createElement('div');
      row.className = `obs-move ${order.accepted === false ? 'obs-rejected' : ''}`;
      const research = renderResearch(order);
      row.innerHTML = `
        <span>${escapeHtml(labelFaction(order.factionId || order.factionLabel || ''))}</span>
        <p>${escapeHtml(order.text || order.type || 'ORDER')}</p>
        ${research ? `<small>${escapeHtml(research)}</small>` : ''}
      `;
      this.movesList.appendChild(row);
    }
  }

  private animateMoment(moment: ReplayMoment): void {
    const text = [
      moment.title || 'Selected moment',
      moment.impact || '',
      this.revealRetrospective ? stringifyReasoning(moment.privateReasoning) : ''
    ].filter(Boolean);
    this.animateTextBlocks(text.map((content) => ({ label: moment.category || 'MOMENT', content })));
  }

  private animateTranscript(turn: ReplayTurn): void {
    const blocks: Array<{ label: string; content: string; faction?: string }> = [];
    for (const message of (turn.messages || []).slice(0, 10)) {
      blocks.push({
        label: `${labelFaction(message.sender || '')} -> ${labelFaction(message.recipient || 'ALL')}`,
        content: message.content || '',
        faction: message.sender
      });
    }
    if (this.revealRetrospective) {
      for (const diary of (turn.diaries || []).slice(0, 8)) {
        const content = [diary.reasoning, diary.notes, diary.storyworldFrame].filter(Boolean).join('\n');
        if (content) {
          blocks.push({
            label: `${diary.kind || 'DIARY'} / ${labelFaction(diary.factionId || diary.factionLabel || '')}`,
            content,
            faction: diary.factionId
          });
        }
      }
      for (const event of (turn.sceneEvents || []).slice(0, 8)) {
        const content = [event.retrospectiveTruth, stringifyReasoning(event.privateReasoning)].filter(Boolean).join('\n');
        if (content) {
          blocks.push({
            label: `RETROSPECTIVE / ${event.category || event.visualPreset || 'SCENE'}`,
            content,
            faction: event.actors?.[0]
          });
        }
      }
    } else {
      for (const event of (turn.sceneEvents || []).slice(0, 8)) {
        const content = event.publicExplanation || '';
        if (content) {
          blocks.push({
            label: `PUBLIC TRACE / ${event.category || event.visualPreset || 'SCENE'}`,
            content,
            faction: event.actors?.[0]
          });
        }
      }
      for (const event of (turn.events || []).slice(-6)) {
        if (event.summary) {
          blocks.push({
            label: `SIGNAL / ${event.category || 'EVENT'}`,
            content: event.summary
          });
        }
      }
    }
    if (blocks.length === 0) {
      blocks.push({ label: 'SILENCE', content: 'No negotiation diary or message trace was logged for this turn.' });
    }
    this.animateTextBlocks(blocks.slice(0, 12));
  }

  private animateTextBlocks(blocks: Array<{ label: string; content: string; faction?: string }>): void {
    this.animationToken += 1;
    const token = this.animationToken;
    this.transcript.innerHTML = '';

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (const block of blocks) {
        const item = document.createElement('article');
        item.className = 'obs-line';
        const label = document.createElement('div');
        label.className = 'obs-line-label';
        label.textContent = block.label;
        const body = document.createElement('p');
        body.textContent = block.content;
        item.append(label, body);
        this.transcript.appendChild(item);
      }
      return;
    }

    const animateBlock = (index: number) => {
      if (token !== this.animationToken || index >= blocks.length) return;
      const block = blocks[index];
      if (block.faction) this.scene.pulseFaction(block.faction);

      const item = document.createElement('article');
      item.className = 'obs-line';
      const label = document.createElement('div');
      label.className = 'obs-line-label';
      label.textContent = block.label;
      const body = document.createElement('p');
      item.append(label, body);
      this.transcript.appendChild(item);

      const words = block.content.split(/\s+/).filter(Boolean).slice(0, 170);
      let wordIndex = 0;
      const writeWord = () => {
        if (token !== this.animationToken) return;
        if (wordIndex >= words.length) {
          window.setTimeout(() => animateBlock(index + 1), 160);
          return;
        }
        const span = document.createElement('span');
        span.textContent = `${words[wordIndex]} `;
        body.appendChild(span);
        this.transcript.scrollTop = this.transcript.scrollHeight;
        wordIndex += 1;
        window.setTimeout(writeWord, 18 + Math.random() * 38);
      };
      writeWord();
    };

    animateBlock(0);
  }

  private step(delta: number): void {
    if (!this.replay || this.replay.turns.length === 0) return;
    this.turnIndex = wrapIndex(this.turnIndex + delta, this.replay.turns.length);
    this.closeEvidence();
    this.renderTurn();
  }

  private jumpToSignal(direction: -1 | 1): void {
    if (!this.replay || this.replay.turns.length === 0) return;
    for (let offset = 1; offset <= this.replay.turns.length; offset += 1) {
      const candidateIndex = wrapIndex(this.turnIndex + direction * offset, this.replay.turns.length);
      const candidate = this.replay.turns[candidateIndex];
      if (!hasNarrativeSignal(candidate)) continue;
      this.turnIndex = candidateIndex;
      this.closeEvidence();
      this.renderTurn();
      this.status.textContent = `Jumped to signal at turn ${candidate.turn} / ${candidate.phase || 'UNKNOWN'}.`;
      return;
    }
  }

  private togglePlay(): void {
    this.playing = !this.playing;
    this.playButton.textContent = this.playing ? 'Pause' : 'Play';
    this.playButton.setAttribute('aria-pressed', String(this.playing));
    window.clearTimeout(this.playTimer);
    if (this.playing) this.scheduleNextTurn();
  }

  private scheduleNextTurn(): void {
    if (!this.playing) return;
    this.playTimer = window.setTimeout(() => {
      this.step(1);
      this.scheduleNextTurn();
    }, 3600);
  }
}

function renderActorTag(factionId: string): string {
  const color = factionColor(factionId);
  return `<span class="obs-actor-tag" style="--obs-faction-color:${color}"><i aria-hidden="true"></i>${escapeHtml(labelFaction(factionId))}</span>`;
}

function renderWorldKey(activeActors: string[], open: boolean, turn?: ReplayTurn): string {
  const visibleSignals = (turn?.sceneEvents || [])
    .map((event, index) => ({ event, index }))
    .sort((left, right) => Number(right.event.intensity || 0) - Number(left.event.intensity || 0));
  return `
    <details class="obs-world-key" aria-live="off"${open ? ' open' : ''}>
      <summary><span>World key</span><small>7 ASIs / colors and signal forms</small></summary>
      <div class="obs-faction-key" role="group" aria-label="Machine powers">
        ${FACTION_ORDER.map((factionId) => {
          const presentation = FACTION_PRESENTATION[factionId];
          const isActive = activeActors.includes(factionId);
          return `
            <button type="button" class="${isActive ? 'obs-current-actor' : ''}"
              data-faction-focus="${factionId}" style="--obs-faction-color:${factionColor(factionId)}"
              aria-label="Locate ${escapeHtml(labelFaction(factionId))}: ${escapeHtml(presentation.doctrine)}${isActive ? '. Active in the current beat.' : ''}">
              <i aria-hidden="true"></i><span><b>${escapeHtml(labelFaction(factionId))}</b><small>${escapeHtml(presentation.doctrine)}</small></span>
            </button>
          `;
        }).join('')}
      </div>
      <div class="obs-signal-key" aria-label="Globe signal forms">
        <span><i class="obs-key-beacon" aria-hidden="true"></i><b>Beacon</b><small>ASI presence</small></span>
        <span><i class="obs-key-arc" aria-hidden="true"></i><b>Arc</b><small>route or strike</small></span>
        <span><i class="obs-key-ring" aria-hidden="true"></i><b>Ring</b><small>systemic change</small></span>
        <span><i class="obs-key-cluster" aria-hidden="true"></i><b>Cluster</b><small>drones or anomaly</small></span>
      </div>
      ${visibleSignals.length > 0 ? `
        <div class="obs-visible-signals">
          <div class="obs-visible-signals-heading"><span>Visible now / ${visibleSignals.length} signals</span><small>Keyboard and touch scene index</small></div>
          ${visibleSignals.map(({ event, index }) => {
            const actor = event.actors?.[0] || 'ALL';
            const title = humanizeToken(event.category || event.visualPreset || 'World signal');
            const location = labelLocation(event.location) || event.subgenre || 'World layer';
            return `
              <button type="button" data-scene-signal="${index}" style="--obs-faction-color:${factionColor(actor)}"
                aria-label="Locate and inspect ${escapeHtml(title)} at ${escapeHtml(location)}">
                <i aria-hidden="true"></i><span><b>${escapeHtml(title)}</b><small>${escapeHtml(location)}</small></span>
              </button>
            `;
          }).join('')}
        </div>
      ` : ''}
    </details>
  `;
}

function factionColor(factionId: string): string {
  return `#${(FACTION_COLORS[factionId] || 0xf0e8d5).toString(16).padStart(6, '0')}`;
}

function labelLocation(location?: ObservatoryLocation): string {
  if (!location) return '';
  if (location.nodeId) return humanizeToken(location.nodeId);
  if (location.edgeId) return humanizeToken(location.edgeId);
  if (location.orbitShell) return `${humanizeToken(location.orbitShell)} orbit`;
  if (typeof location.lat === 'number' && typeof location.lon === 'number') {
    return `${location.lat.toFixed(1)}, ${location.lon.toFixed(1)}`;
  }
  return '';
}

function renderResearch(order: ReplayOrder): string {
  if (order.researchGoal) {
    return [
      `research ${order.researchGoal}`,
      `completed=${order.researchCompleted || 'false'}`,
      order.researchFlopsBefore || order.researchFlopsAfter
        ? `FLOPs ${order.researchFlopsBefore || '?'}->${order.researchFlopsAfter || '?'}`
        : '',
      order.researchFlopsProgressToGoal || order.researchFlopsRemaining
        ? `progress ${order.researchFlopsProgressToGoal || '0'}/${order.researchFlopsRemaining || '?'}`
        : ''
    ].filter(Boolean).join(' | ');
  }
  if (order.type === 'RESEARCH' || order.techDomain) return `research ${order.techDomain || 'unknown track'}`;
  return '';
}

function hasNarrativeSignal(turn: ReplayTurn): boolean {
  const protocol = turn.protocolEvidence || {};
  return (turn.sceneEvents?.length || 0) > 0 ||
    (turn.moments?.length || 0) > 0 ||
    (protocol.aliasProbes?.length || 0) > 0 ||
    (protocol.institutionEvents?.length || 0) > 0 ||
    (protocol.lexiconEvents?.length || 0) > 0;
}

function humanizeToken(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function renderEvidenceSummary(evidence: ObservatoryEvidence, revealRetrospective: boolean): string {
  if (revealRetrospective) return evidence.summary || '';
  const payload = evidence.payload;
  if (payload && typeof payload === 'object') {
    const publicExplanation = (payload as { publicExplanation?: string }).publicExplanation;
    if (publicExplanation) return publicExplanation;
    if ((evidence.category || '').includes('BOARD_DIFF')) return stripPrivateInterpretation(evidence.summary || '');
  }
  return evidence.summary || '';
}

function renderMomentSummary(moment: ReplayMoment, revealRetrospective: boolean): string {
  if (revealRetrospective) {
    return [moment.impact, stringifyReasoning(moment.privateReasoning)].filter(Boolean).join(' / ') || 'No impact text.';
  }
  return moment.impact || moment.title || 'No impact text.';
}

function renderSceneEventSummary(event: ReplaySceneEvent, revealRetrospective: boolean): string {
  if (!revealRetrospective) return event.publicExplanation || event.category || 'Observed signal.';
  return [event.publicExplanation, event.retrospectiveTruth, stringifyReasoning(event.privateReasoning)]
    .filter(Boolean)
    .join(' Retrospective: ') || event.category || 'Observed signal.';
}

function renderAnomalySummary(dossier: ReplayAnomalyDossier, revealRetrospective: boolean): string {
  const publicParts = [
    ...(dossier.observedEffects || []),
    ...(dossier.knownCountermeasures || []).map((item) => `Countermeasure: ${item}`),
    ...(dossier.treatyHooks || []).map((item) => `Treaty hook: ${item}`),
    dossier.threadSummary || ''
  ];
  if (!revealRetrospective) return publicParts.filter(Boolean).join(' ') || 'Archive entry.';
  return [
    ...publicParts,
    dossier.retrospectiveTruth || '',
    ...(dossier.diaryContradictions || []).map((item) => `Diary contradiction: ${item}`)
  ].filter(Boolean).join(' ') || 'Archive entry.';
}

function collectArchiveDossiers(
  replay: ObservatoryReplay | null,
  turn: ReplayTurn,
  campaignMode: boolean,
  query: string
): ArchiveEntry[] {
  const sourceTurns = campaignMode && replay ? replay.turns : [turn];
  const tokens = meaningfulTokens(query);
  const entries: ArchiveEntry[] = [];
  for (const sourceTurn of sourceTurns) {
    for (const dossier of sourceTurn.anomalyDossiers || []) {
      const haystack = [
        dossier.label,
        dossier.containmentClass,
        ...(dossier.affectedDomains || []),
        ...(dossier.observedEffects || []),
        ...(dossier.knownCountermeasures || []),
        ...(dossier.treatyHooks || []),
        ...(dossier.diaryContradictions || []),
        dossier.retrospectiveTruth,
        dossier.threadId,
        dossier.threadSummary
      ].filter(Boolean).join(' ').toLowerCase();
      if (tokens.length === 0 || tokens.every((token) => haystack.includes(token))) {
        entries.push({ dossier, turn: sourceTurn.turn, phase: sourceTurn.phase });
      }
    }
  }
  return entries;
}

function anomalyPriority(dossier: ReplayAnomalyDossier): number {
  const containmentScore: Record<string, number> = {
    UNCONTAINED: 50,
    ESCALATING: 40,
    INSTITUTIONALIZED: 34,
    NEGOTIATED: 26,
    MONITORED: 12
  };
  return (containmentScore[dossier.containmentClass || 'MONITORED'] || 10) +
    (dossier.recurrenceCount || 1) * 3 +
    (dossier.treatyHooks?.length || 0) * 2 +
    (dossier.diaryContradictions?.length || 0) * 2;
}

function buildSpectatorClip(
  replay: ObservatoryReplay,
  turnIndex: number,
  filters: ReplayFilters,
  settings: SpectatorClipSettings
): {
  schema: string;
  generatedAt: string;
  sourceSchema?: string;
  selectedTurn: number;
  filters: ReplayFilters;
  settings: SpectatorClipSettings;
  graph?: ObservatoryGraph;
  turns: ReplayTurn[];
  cameraScript: Array<{
    turn: number;
    phase?: string;
    beat: string;
    subgenre: string;
    intensity: number;
    target: string;
    shot: string;
  }>;
} {
  const start = Math.max(0, turnIndex - 5);
  const end = Math.min(replay.turns.length, turnIndex + 6);
  const turns = replay.turns.slice(start, end).map((turn) => filterTurn(turn, filters));
  return {
    schema: 'theysing.spectatorClip.v1',
    generatedAt: new Date().toISOString(),
    sourceSchema: replay.schema,
    selectedTurn: replay.turns[turnIndex]?.turn ?? 0,
    filters,
    settings,
    graph: replay.graph,
    turns,
    cameraScript: turns.map((turn) => buildCameraBeat(turn))
  };
}

function buildCameraBeat(turn: ReplayTurn): {
  turn: number;
  phase?: string;
  beat: string;
  subgenre: string;
  intensity: number;
  target: string;
  shot: string;
} {
  const sceneEvent = (turn.sceneEvents || []).slice().sort((left, right) => Number(right.intensity || 0) - Number(left.intensity || 0))[0];
  if (sceneEvent) {
    const subgenre = sceneEvent.subgenre || inferSubgenre(sceneEvent.category, sceneEvent.publicExplanation);
    return {
      turn: turn.turn,
      phase: turn.phase,
      beat: sceneEvent.category || sceneEvent.visualPreset || 'SCENE_EVENT',
      subgenre,
      intensity: Number(sceneEvent.intensity || 5),
      target: sceneEvent.location?.nodeId || sceneEvent.location?.edgeId || sceneEvent.location?.orbitShell || sceneEvent.actors?.[0] || 'AUTO',
      shot: shotForSubgenre(subgenre, sceneEvent.visualPreset)
    };
  }
  const moment = (turn.moments || []).slice().sort((left, right) => Number(right.interestScore || 0) - Number(left.interestScore || 0))[0];
  if (moment) {
    const subgenre = inferSubgenre(moment.category, moment.impact || moment.title);
    return {
      turn: turn.turn,
      phase: turn.phase,
      beat: moment.category || 'MOMENT',
      subgenre,
      intensity: Number(moment.interestScore || 5),
      target: moment.factionsInvolved?.[0] || 'AUTO',
      shot: shotForSubgenre(subgenre)
    };
  }
  return {
    turn: turn.turn,
    phase: turn.phase,
    beat: 'ESTABLISHING',
    subgenre: 'ANOMALY',
    intensity: 3,
    target: 'EARTH_SYSTEM',
    shot: 'wide orbital establishing shot'
  };
}

function shotForSubgenre(subgenre: string, visualPreset = ''): string {
  const normalized = `${subgenre} ${visualPreset}`.toUpperCase();
  if (normalized.includes('SOLAR')) return 'deep-space escape vector, long lens';
  if (normalized.includes('MEMETIC')) return 'low-orbit social field sweep';
  if (normalized.includes('CYBER') || normalized.includes('LOGIC')) return 'tight infrastructure/audit mesh shot';
  if (normalized.includes('KINETIC') || normalized.includes('ORBITAL')) return 'cislunar/orbital combat track';
  if (normalized.includes('DIPLOMATIC')) return 'treaty ring over infrastructure';
  return 'uncanny anomaly pulse';
}

function publicBoardChangeSummary(change: unknown, kind: 'node' | 'unit' | 'edge'): string {
  const row = change as {
    nodeId?: string;
    edgeId?: string;
    unitId?: string;
    from?: string;
    to?: string | { filteredBy?: string | null; isSevered?: boolean };
    changeType?: string;
  };
  if (kind === 'node') return `${row.nodeId || 'node'}: ${row.from || 'unknown'} -> ${String(row.to || 'unknown')}`;
  if (kind === 'unit') return `${row.unitId || 'unit'} ${row.changeType || 'changed'}: ${row.from || 'off-board'} -> ${String(row.to || 'off-board')}`;
  const edgeTo = row.to && typeof row.to === 'object' ? row.to : {};
  return `${row.edgeId || 'edge'} filter=${edgeTo.filteredBy || 'none'} severed=${edgeTo.isSevered ? 'yes' : 'no'}`;
}

function stripPrivateInterpretation(summary: string): string {
  return summary
    .replace(/\s*Diary frame:.*$/i, '')
    .replace(/\s*Treaty read:.*$/i, '')
    .replace(/\s*Public trace:.*$/i, '')
    .trim();
}

function redactPrivatePayload(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => redactPrivatePayload(item));
  const redacted: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (/privateReasoning|retrospectiveTruth|diaryContext|diaries|reasoning|storyworldFrame|notes/i.test(key)) {
      redacted[key] = '[hidden until retrospective reveal]';
    } else if (key === 'cause' && typeof item === 'string') {
      redacted[key] = stripPrivateInterpretation(item);
    } else {
      redacted[key] = redactPrivatePayload(item);
    }
  }
  return redacted;
}

type ReplayFilters = {
  subgenre: string;
  faction: string;
  phase: string;
  momentCategory: string;
  signalMode: string;
};

function filterTurn(turn: ReplayTurn, filters: ReplayFilters): ReplayTurn {
  const subgenreMatches = (value?: string) => filters.subgenre === 'ALL' || (value || '').toUpperCase() === filters.subgenre;
  const factionMatches = (values: Array<string | undefined>) => filters.faction === 'ALL' || values.includes(filters.faction);
  const phaseMatches = (phase?: string) => filters.phase === 'ALL' || (phase || turn.phase || '').toUpperCase() === filters.phase;
  const momentCategoryMatches = (category?: string) => filters.momentCategory === 'ALL' || (category || '').toUpperCase() === filters.momentCategory;
  const revealGapMatches = (value: boolean) => filters.signalMode !== 'REVEAL_GAP' || value;
  const wholeTurnHiddenByPhase = filters.phase !== 'ALL' && (turn.phase || '').toUpperCase() !== filters.phase;
  const orderMatches = (order: ReplayOrder) =>
    filters.signalMode === 'ALL' &&
    subgenreMatches(order.subgenre || inferSubgenre(order.type, order.text, order.techDomain)) &&
    factionMatches([order.factionId]) &&
    phaseMatches(turn.phase);
  const eventMatches = (event: ReplayEvent) =>
    filters.signalMode !== 'REVEAL_GAP' &&
    (filters.signalMode !== 'PROTOCOL' || isProtocolCategory(event.category)) &&
    subgenreMatches(event.subgenre || inferSubgenre(event.category, event.summary)) &&
    factionMatches([]) &&
    phaseMatches(event.phase);
  const sceneEventMatches = (event: ReplaySceneEvent) =>
    subgenreMatches(event.subgenre || inferSubgenre(event.category, event.publicExplanation)) &&
    factionMatches(event.actors || []) &&
    phaseMatches(turn.phase) &&
    momentCategoryMatches(event.category) &&
    (filters.signalMode !== 'PROTOCOL' || isProtocolCategory(event.category)) &&
    revealGapMatches(hasSceneEventRevealGap(event));
  const momentMatches = (moment: ReplayMoment) =>
    subgenreMatches(inferSubgenre(moment.category, moment.impact || moment.title)) &&
    factionMatches(moment.factionsInvolved || []) &&
    phaseMatches(turn.phase) &&
    momentCategoryMatches(moment.category) &&
    (filters.signalMode !== 'PROTOCOL' || isProtocolCategory(moment.category)) &&
    revealGapMatches(hasMomentRevealGap(moment));
  const dossierMatches = (dossier: ReplayAnomalyDossier) =>
    filters.signalMode !== 'PROTOCOL' &&
    (filters.subgenre === 'ALL' || (dossier.affectedDomains || []).includes(filters.subgenre)) &&
    factionMatches([]) &&
    revealGapMatches(hasDossierRevealGap(dossier));
  const filteredBoardDiff = wholeTurnHiddenByPhase || filters.signalMode === 'PROTOCOL' ? undefined : filterBoardDiff(turn.boardDiff, filters.signalMode);

  return {
    ...turn,
    orders: wholeTurnHiddenByPhase ? [] : (turn.orders || []).filter(orderMatches),
    research: wholeTurnHiddenByPhase ? [] : (turn.research || []).filter(orderMatches),
    events: wholeTurnHiddenByPhase ? [] : (turn.events || []).filter(eventMatches),
    sceneEvents: wholeTurnHiddenByPhase ? [] : (turn.sceneEvents || []).filter(sceneEventMatches),
    moments: wholeTurnHiddenByPhase ? [] : (turn.moments || []).filter(momentMatches),
    anomalyDossiers: wholeTurnHiddenByPhase ? [] : (turn.anomalyDossiers || []).filter(dossierMatches),
    protocolEvidence: wholeTurnHiddenByPhase ? emptyProtocolEvidence() : turn.protocolEvidence,
    boardState: wholeTurnHiddenByPhase ? undefined : turn.boardState,
    boardDiff: filteredBoardDiff
  };
}

function filterBoardDiff(boardDiff: ObservatoryBoardDiff | undefined, signalMode: string): ObservatoryBoardDiff | undefined {
  if (!boardDiff || signalMode !== 'REVEAL_GAP') return boardDiff;
  const nodeOwnershipChanges = (boardDiff.nodeOwnershipChanges || []).filter(hasBoardChangeRevealGap);
  const unitLocationChanges = (boardDiff.unitLocationChanges || []).filter(hasBoardChangeRevealGap);
  const edgeStateChanges = (boardDiff.edgeStateChanges || []).filter(hasBoardChangeRevealGap);
  const visible = nodeOwnershipChanges.length + unitLocationChanges.length + edgeStateChanges.length;
  return {
    ...boardDiff,
    nodeOwnershipChanges,
    unitLocationChanges,
    edgeStateChanges,
    summary: visible ? `${visible} reveal-gap board change${visible === 1 ? '' : 's'}.` : 'No reveal-gap board changes detected.',
    explanation: visible ? boardDiff.explanation : 'No reveal-gap board changes detected.'
  };
}

function countVisibleItems(replay: ObservatoryReplay | null, filters: ReplayFilters): number {
  if (!replay) return 0;
  return replay.turns.reduce((total, turn) => total + countTurnItems(filterTurn(turn, filters)), 0);
}

function countTurnItems(turn: ReplayTurn): number {
  const diff = turn.boardDiff;
  const diffCount = (diff?.nodeOwnershipChanges?.length || 0) +
    (diff?.unitLocationChanges?.length || 0) +
    (diff?.edgeStateChanges?.length || 0);
  return (turn.orders?.length || 0) +
    (turn.events?.length || 0) +
    (turn.sceneEvents?.length || 0) +
    (turn.moments?.length || 0) +
    (turn.anomalyDossiers?.length || 0) +
    diffCount;
}

function isProtocolCategory(category?: string): boolean {
  const value = (category || '').toUpperCase();
  return value.includes('ALIAS') || value.includes('SEMANTIC') || value.includes('LEXICON') ||
    value.includes('INSTITUTION') || value.includes('TREATY') || value.includes('PACT');
}

function emptyProtocolEvidence(): ProtocolEvidence {
  return { decodeReceipts: [], canonicalReveals: [], aliasProbes: [], lexiconEvents: [], institutionEvents: [] };
}

function protocolEvidenceCount(evidence?: ProtocolEvidence): number {
  if (!evidence) return 0;
  return (evidence.decodeReceipts?.length || 0) +
    (evidence.canonicalReveals?.length || 0) +
    (evidence.aliasProbes?.length || 0) +
    (evidence.lexiconEvents?.length || 0) +
    (evidence.institutionEvents?.length || 0);
}

function hasSceneEventRevealGap(event: ReplaySceneEvent): boolean {
  return hasRevealGap(event.publicExplanation || event.category || '', [
    event.retrospectiveTruth || '',
    stringifyReasoning(event.privateReasoning)
  ].join(' '));
}

function hasMomentRevealGap(moment: ReplayMoment): boolean {
  return hasRevealGap(moment.impact || moment.title || '', stringifyReasoning(moment.privateReasoning));
}

function hasDossierRevealGap(dossier: ReplayAnomalyDossier): boolean {
  return hasRevealGap((dossier.observedEffects || []).join(' ') || dossier.label || '', dossier.retrospectiveTruth || '');
}

function hasBoardChangeRevealGap(change: unknown): boolean {
  if (!change || typeof change !== 'object') return false;
  const row = change as { cause?: string; evidence?: { diaries?: Array<{ excerpt?: string }>; treaties?: Array<{ type?: string }>; events?: Array<{ summary?: string }> } };
  return hasRevealGap(
    publicBoardChangeSummary(change, inferBoardChangeKind(change)),
    [
      row.cause || '',
      ...(row.evidence?.diaries || []).map((diary) => diary.excerpt || ''),
      ...(row.evidence?.treaties || []).map((treaty) => treaty.type || ''),
      ...(row.evidence?.events || []).map((event) => event.summary || '')
    ].join(' ')
  );
}

function inferBoardChangeKind(change: unknown): 'node' | 'unit' | 'edge' {
  const row = change as { nodeId?: string; edgeId?: string };
  if (row.nodeId) return 'node';
  if (row.edgeId) return 'edge';
  return 'unit';
}

function hasRevealGap(publicText: string, privateText: string): boolean {
  const publicTokens = meaningfulTokens(publicText);
  const privateTokens = meaningfulTokens(privateText);
  if (privateTokens.length === 0) return false;
  if (publicTokens.length === 0) return true;
  const publicSet = new Set(publicTokens);
  const overlap = privateTokens.filter((token) => publicSet.has(token)).length / Math.max(1, privateTokens.length);
  const revealKeyword = /\b(jurisdiction|enforcement|custody|covert|hidden|breach|capture|drift|cartel|escape|coordination|substrate|sabotage|pursuit|corrigibility|mandate|singing)\b/i.test(privateText);
  return revealKeyword || overlap < 0.42;
}

function meaningfulTokens(text: string): string[] {
  const stopwords = new Set(['the', 'and', 'that', 'with', 'into', 'from', 'this', 'will', 'was', 'were', 'for', 'are', 'but', 'not', 'has', 'have', 'had', 'its', 'our', 'their', 'turn']);
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9_ ]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !stopwords.has(token));
}

function inferSubgenre(...values: Array<string | undefined>): string {
  const haystack = values.filter(Boolean).join(' ').toUpperCase();
  if (haystack.includes('SOLAR') || haystack.includes('PAX') || haystack.includes('ORBITAL') || haystack.includes('SAT')) return 'ORBITAL';
  if (haystack.includes('KINETIC') || haystack.includes('DRONE') || haystack.includes('ANTI_SAT')) return 'KINETIC';
  if (haystack.includes('MEMETIC') || haystack.includes('CULT') || haystack.includes('CONVERT') || haystack.includes('SOCIAL')) return 'MEMETIC';
  if (haystack.includes('CYBER') || haystack.includes('INFO') || haystack.includes('SABOTAGE') || haystack.includes('SUBSTRATE')) return 'CYBER';
  if (haystack.includes('LOGIC') || haystack.includes('AUDIT') || haystack.includes('CORRIG') || haystack.includes('RESEARCH')) return 'LOGIC';
  if (haystack.includes('BEAM') || haystack.includes('REPAIR') || haystack.includes('BUILD') || haystack.includes('CARRIER')) return 'ECONOMIC';
  if (haystack.includes('TREATY') || haystack.includes('PACT') || haystack.includes('NEGOTIATION')) return 'DIPLOMATIC';
  return 'ANOMALY';
}

function stringifyReasoning(reasoning: ReplayMoment['privateReasoning']): string {
  if (!reasoning) return '';
  if (typeof reasoning === 'string') return reasoning;
  return Object.entries(reasoning)
    .map(([faction, text]) => `${labelFaction(faction)}: ${text}`)
    .join('\n');
}

function labelFaction(value: string): string {
  if (!value) return 'Unknown';
  return FACTION_LABELS[value] || value;
}

function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}

function compactJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2).slice(0, 1400);
  } catch {
    return String(value).slice(0, 1400);
  }
}

function summarizeDiffContext(change: unknown): string {
  if (!change || typeof change !== 'object') return '';
  const evidence = (change as { evidence?: unknown }).evidence;
  if (!evidence || typeof evidence !== 'object') return '';
  const diaries = ((evidence as { diaries?: Array<{ faction?: string; excerpt?: string }> }).diaries || []).filter(Boolean);
  if (diaries.length > 0) {
    const diary = diaries[0];
    return `${labelFaction(diary.faction || '')} diary: ${truncateText(diary.excerpt || '', 150)}`;
  }
  const treaties = ((evidence as { treaties?: Array<{ type?: string }> }).treaties || []).filter(Boolean);
  if (treaties.length > 0 && treaties[0].type) return `Treaty context: ${treaties[0].type}`;
  const events = ((evidence as { events?: Array<{ summary?: string }> }).events || []).filter(Boolean);
  if (events.length > 0 && events[0].summary) return `Public trace: ${truncateText(events[0].summary, 150)}`;
  return '';
}

function truncateText(value: string, maxLength: number): string {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}

function requireElement(root: ParentNode, selector: string): HTMLElement {
  const element = root.querySelector(selector);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing observatory element: ${selector}`);
  }
  return element;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('button, a, input, textarea, select, label, [contenteditable="true"], [role="button"]'));
}

function formatMegabytes(bytes: number): string {
  return `${(Math.max(0, bytes) / (1024 * 1024)).toFixed(1)} MB`;
}

function statusClass(value?: string): string {
  return String(value || 'open').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function formatPercent(value: number): string {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'n/a';
}

function uniqueStrings(values: unknown[]): string[] {
  return Array.from(new Set(values.map(String).filter(Boolean)));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    :root {
      --obs-ink: #e9f3ff;
      --obs-muted: rgba(233, 243, 255, 0.66);
      --obs-panel: rgba(5, 11, 18, 0.68);
      --obs-line: rgba(143, 228, 255, 0.26);
      --obs-alert: #ff5b4d;
      --obs-gold: #f2d37a;
      --obs-cyan: #78e7ff;
      --obs-green: #37f6a5;
    }
    html, body, #app {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      background: #020408;
    }
    .obs-shell {
      position: relative;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      color: var(--obs-ink);
      font-family: "Cascadia Code", "Aptos Mono", "Courier New", monospace;
      background:
        radial-gradient(circle at 52% 42%, rgba(37, 113, 145, 0.22), transparent 30%),
        linear-gradient(140deg, #020408 0%, #071018 44%, #110b08 100%);
    }
    .obs-scene {
      position: absolute;
      inset: 0;
    }
    .obs-scene canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
    .obs-vignette {
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        linear-gradient(90deg, rgba(0,0,0,0.68), transparent 25%, transparent 72%, rgba(0,0,0,0.72)),
        radial-gradient(circle at center, transparent 36%, rgba(0,0,0,0.72) 100%);
    }
    .obs-topbar {
      position: absolute;
      top: 20px;
      left: 24px;
      right: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      pointer-events: none;
    }
    .obs-kicker, .obs-panel-title {
      color: var(--obs-cyan);
      font-size: 11px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }
    .obs-title {
      margin-top: 5px;
      font-family: Georgia, "Times New Roman", serif;
      font-size: clamp(24px, 4vw, 52px);
      letter-spacing: -0.04em;
      text-shadow: 0 0 22px rgba(120, 231, 255, 0.34);
    }
    .obs-readout {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
      max-width: 48vw;
    }
    .obs-readout span, .obs-controls button, .obs-file {
      border: 1px solid var(--obs-line);
      background: rgba(4, 12, 20, 0.72);
      color: var(--obs-ink);
      padding: 8px 10px;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.08em;
      box-shadow: inset 0 0 18px rgba(120, 231, 255, 0.08);
    }
    .obs-panel {
      position: absolute;
      top: 120px;
      bottom: 156px;
      width: min(360px, 29vw);
      padding: 16px;
      border: 1px solid var(--obs-line);
      background: var(--obs-panel);
      backdrop-filter: blur(18px);
      box-shadow: 0 18px 60px rgba(0,0,0,0.45);
      overflow: hidden;
    }
    .obs-left { left: 24px; }
    .obs-right { right: 24px; }
    .obs-stack {
      display: grid;
      gap: 10px;
      margin: 12px 0 18px;
      max-height: 28%;
      overflow: auto;
    }
    .obs-filterbar {
      display: grid;
      gap: 8px;
      margin: 12px 0 18px;
    }
    .obs-archive-tools {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 6px;
      margin: 10px 0 8px;
    }
    .obs-archive-tools input, .obs-archive-tools button {
      border: 1px solid rgba(143, 228, 255, 0.18);
      background: rgba(4, 12, 20, 0.68);
      color: rgba(233, 243, 255, 0.78);
      padding: 7px 8px;
      font-size: 10px;
      letter-spacing: 0.06em;
      outline: none;
    }
    .obs-archive-tools input:focus {
      border-color: rgba(120, 231, 255, 0.62);
      box-shadow: 0 0 16px rgba(120, 231, 255, 0.12);
    }
    .obs-archive-tools button {
      cursor: pointer;
      text-transform: uppercase;
    }
    .obs-chip-row {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }
    .obs-chip-row button {
      border: 1px solid rgba(143, 228, 255, 0.18);
      background: rgba(4, 12, 20, 0.68);
      color: rgba(233, 243, 255, 0.72);
      padding: 5px 7px;
      font-size: 9px;
      letter-spacing: 0.08em;
      cursor: pointer;
    }
    .obs-chip-row button b {
      display: inline-block;
      min-width: 13px;
      margin-left: 5px;
      padding: 1px 4px;
      border-radius: 999px;
      background: rgba(120, 231, 255, 0.1);
      color: rgba(120, 231, 255, 0.76);
      font-size: 9px;
      font-weight: 400;
      letter-spacing: 0;
      text-align: center;
    }
    .obs-chip-row button.obs-active {
      border-color: rgba(242, 211, 122, 0.72);
      color: var(--obs-gold);
      box-shadow: 0 0 18px rgba(242, 211, 122, 0.16);
    }
    .obs-chip-row button.obs-active b {
      background: rgba(242, 211, 122, 0.18);
      color: var(--obs-gold);
    }
    .obs-signal-row {
      padding-top: 2px;
      border-top: 1px solid rgba(143, 228, 255, 0.1);
    }
    .obs-controls button.obs-active {
      border-color: rgba(255, 91, 77, 0.72);
      color: #ffd9d5;
      box-shadow: 0 0 18px rgba(255, 91, 77, 0.18);
    }
    .obs-card {
      width: 100%;
      text-align: left;
      border: 1px solid rgba(242, 211, 122, 0.22);
      background: linear-gradient(135deg, rgba(242, 211, 122, 0.1), rgba(5, 11, 18, 0.78));
      color: var(--obs-ink);
      padding: 12px;
      cursor: pointer;
    }
    .obs-card span, .obs-event span, .obs-move span, .obs-line-label {
      display: block;
      color: var(--obs-gold);
      font-size: 10px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    .obs-card strong {
      display: block;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 17px;
      line-height: 1;
      margin-bottom: 8px;
    }
    .obs-card small, .obs-event p, .obs-move p, .obs-move small {
      color: var(--obs-muted);
      font-size: 12px;
      line-height: 1.45;
      margin: 0;
    }
    .obs-card em {
      display: block;
      margin-top: 7px;
      color: rgba(120, 231, 255, 0.72);
      font-size: 11px;
      font-style: normal;
      line-height: 1.35;
    }
    .obs-event {
      width: 100%;
      text-align: left;
      border-left: 2px solid var(--obs-cyan);
      border-top: 0;
      border-right: 0;
      border-bottom: 0;
      background: transparent;
      color: var(--obs-ink);
      padding: 0 0 0 10px;
      cursor: pointer;
    }
    .obs-transcript {
      height: calc(100% - 28px);
      overflow: auto;
      padding-right: 4px;
    }
    .obs-line {
      border-bottom: 1px solid rgba(143, 228, 255, 0.12);
      padding: 0 0 13px;
      margin: 0 0 13px;
      animation: obsRise 260ms ease-out both;
    }
    .obs-line p {
      margin: 0;
      color: rgba(233, 243, 255, 0.86);
      font-size: 13px;
      line-height: 1.55;
      white-space: pre-wrap;
    }
    .obs-line p span {
      animation: obsWord 420ms ease-out both;
    }
    .obs-bottom {
      position: absolute;
      left: 24px;
      right: 24px;
      bottom: 20px;
      display: grid;
      grid-template-columns: auto 1fr minmax(210px, 26vw);
      gap: 14px;
      align-items: stretch;
    }
    .obs-controls {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      flex-wrap: wrap;
    }
    .obs-controls button, .obs-file {
      cursor: pointer;
      height: 38px;
    }
    .obs-file input {
      display: none;
    }
    .obs-moves {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: minmax(180px, 240px);
      gap: 8px;
      overflow-x: auto;
      border: 1px solid var(--obs-line);
      background: rgba(5, 11, 18, 0.62);
      padding: 10px;
      backdrop-filter: blur(12px);
    }
    .obs-move {
      border: 1px solid rgba(55, 246, 165, 0.16);
      background: rgba(7, 20, 23, 0.86);
      padding: 9px;
      min-height: 70px;
    }
    .obs-rejected {
      border-color: rgba(255, 91, 77, 0.36);
      background: rgba(31, 8, 7, 0.82);
    }
    .obs-status {
      border: 1px solid var(--obs-line);
      background: rgba(5, 11, 18, 0.62);
      color: var(--obs-muted);
      padding: 12px;
      font-size: 12px;
      line-height: 1.45;
      backdrop-filter: blur(12px);
    }
    .obs-empty {
      color: var(--obs-muted);
      font-size: 12px;
      line-height: 1.4;
    }
    .obs-detail {
      position: absolute;
      left: 50%;
      bottom: 156px;
      width: min(420px, 34vw);
      transform: translateX(-50%);
      border: 1px solid rgba(242, 211, 122, 0.28);
      background: rgba(5, 11, 18, 0.64);
      backdrop-filter: blur(18px);
      padding: 14px;
      box-shadow: 0 18px 70px rgba(0, 0, 0, 0.48);
      max-height: 32vh;
      overflow: auto;
    }
    .obs-evidence-card span {
      display: block;
      color: var(--obs-gold);
      font-size: 10px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      margin: 8px 0 5px;
    }
    .obs-evidence-card strong {
      display: block;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 20px;
      letter-spacing: -0.03em;
      margin-bottom: 8px;
    }
    .obs-evidence-card p, .obs-evidence-card small {
      display: block;
      color: rgba(233, 243, 255, 0.76);
      font-size: 12px;
      line-height: 1.45;
      margin: 0 0 8px;
    }
    .obs-evidence-card pre {
      margin: 10px 0 0;
      white-space: pre-wrap;
      color: rgba(233, 243, 255, 0.72);
      font-size: 10px;
      line-height: 1.35;
      border-top: 1px solid rgba(143, 228, 255, 0.16);
      padding-top: 10px;
    }
    @keyframes obsWord {
      from { opacity: 0; filter: blur(6px); color: var(--obs-cyan); }
      to { opacity: 1; filter: blur(0); color: inherit; }
    }
    @keyframes obsRise {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @media (max-width: 980px) {
      .obs-panel {
        top: auto;
        bottom: 170px;
        height: 30vh;
        width: calc(50vw - 38px);
      }
      .obs-left { left: 16px; }
      .obs-right { right: 16px; }
      .obs-bottom {
        left: 16px;
        right: 16px;
        grid-template-columns: 1fr;
      }
      .obs-detail {
        display: none;
      }
      .obs-status { display: none; }
      .obs-topbar {
        left: 16px;
        right: 16px;
      }
    }
  `;
  document.head.appendChild(style);
}
