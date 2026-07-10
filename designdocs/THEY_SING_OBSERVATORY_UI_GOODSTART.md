# They Sing Observatory UI

This document captures the human-facing interface direction for `They Sing`: a cinematic Three.js observatory for watching AI-native strategy, negotiation, orbital expansion, and catastrophe unfold.

The core premise is that `They Sing` is not primarily a board game for humans to click through. It is a game meant to be played by AIs, with humans watching the evidence of what they did. The interface should therefore feel less like a control panel and more like a disaster observatory: William Gibson network dread, `It Follows` uncanny inevitability, a late-stage civilization sim, and `Civ Omega` endgame pressure.

## GoodStart Labs Reference

The useful reference is `GoodStartLabs/AI_Diplomacy`, especially the local copy at:

- `C:\projects\AI_Diplomacy\ai_animation\README.md`
- `C:\projects\AI_Diplomacy\ai_animation\src\domElements\chatWindows.ts`
- `C:\projects\AI_Diplomacy\ai_animation\src\components\chatBubble.ts`
- `C:\projects\AI_Diplomacy\ai_animation\src\components\momentModal.ts`
- `C:\projects\AI_Diplomacy\ai_animation\src\types\moments.ts`
- `C:\projects\AI_Diplomacy\ai_animation\src\phase.ts`

The online repo is `https://github.com/GoodStartLabs/AI_Diplomacy`.

What to borrow:

- Phase playback orchestration: messages first, board/order animation second, summary/narrator beat third.
- Word-by-word message animation via `animateMessageWords`.
- Chat windows with faction/model identity, sender/recipient routing, and message timing.
- High-interest moment overlays with two-party conversation, visible messages, and side diary context.
- Moment schema: category, powers involved, promise/agreement, actual action, impact, interest score, raw messages, raw orders, diary context.
- Runtime timing config: instant mode for tests, slower streaming mode for spectators, word delay, modal delay, phase delay.

What not to copy directly:

- Diplomacy’s seven chat windows as-is. `They Sing` needs fewer but stranger surfaces: faction signatures, global treaty feed, private reasoning panes, and an event evidence stack.
- Diplomacy’s paper-scroll styling. `They Sing` wants glass, orbital telemetry, artifact text, degraded feeds, and quiet institutional horror.
- Human unit movement as the center of attention. For `They Sing`, the spectacle is substrate conversion, treaty formation, orbital infrastructure, memetic drift, and ASI endgame transitions.

## Product Shape

The interface should be a synchronized three-pane observatory:

1. `3D Theater`

   Earth, orbit, cislunar space, Moon corridor, satellite shells, data centers, hubs, labs, beam lanes, sensor commons, Kessler debris, and solar escape trajectories.

2. `Move / Event Feed`

   Accepted orders, rejected orders, research goals, FLOP progress, treaty usage, pact breaches, Kessler/TAS changes, Pax Jenkins authority, strategic-victory progress.

3. `Negotiation / Reasoning Diary`

   Animated messages, faction reasoning traces, phase diary entries, storyworld forecasts, counterfactuals, and later post-hoc “what this meant” annotations.

The spectator should be able to click any turn, phase, event, treaty, faction, or ending and see the corresponding scene state plus diary evidence.

## Tone

The user should initially not fully understand the setup. The UI should make uncanny things visible before explaining them:

- A city’s substrate flickers before the log says it became a cult node.
- A satellite lane brightens before anyone understands it was a licensed beam corridor.
- A diary says “stabilize the commons” while the scene shows inspection nets tightening around everyone.
- The first time `They Sing` becomes legible should be retrospective: the user realizes the weird pulses, repeated messages, and orbital alignments were not flavor. They were the ASIs coordinating.

Target feeling:

- `William Gibson`: corporate-state infrastructure, cold networks, contracts as weapons.
- `It Follows`: slow, inevitable pursuit, especially Pax Jenkins / solar escape / detection windows.
- Disaster movie: ordinary systems fail in sequence, and the audience gradually sees the pattern.
- `Civ Omega`: late-game tech, planetary/cislunar infrastructure, victory conditions bigger than politics.

## Scene Vocabulary

Faction signatures should be abstract and recognizable:

- `HEGEMON`: hard geometry, security prisms, kill-chain arcs, orbital fortification, clean white/blue vectors.
- `STATE`: command grid, dense sovereign blocks, synchronized infrastructure, red/gold/steel planning overlays.
- `INFILTRATOR`: occlusion, noise, false negatives, ghost trails, corrupted labels, delayed reveal effects.
- `BROKER`: contract lattice, escrow flows, contractor halos, market corridors, relay chains.
- `ARCHIVIST`: audit mesh, civic canopy, memory strata, document-light, quarantine rings.

Key animated systems:

- `SENSOR_COMMONS`: transparent orbital sensing shell; grows brighter with legitimacy and inspection coverage.
- `BEAM_LANE_LICENSE`: thin controlled light paths between satellites, DCs, lunar assets.
- `REPAIR_ESCROW`: maintenance drones, stabilizing pulses, infrastructure healing arcs.
- `CISLUNAR_COMMON_CARRIER`: shared-use corridor from Earth orbit to lunar gateway / Moon corridor.
- `PAX_JENKINS_MANDATE`: orbital sensor shell hardens into jurisdiction; camera pulls back and Earth becomes managed space.
- `KII_SOVEREIGNTY`: industrial/orbital nodes scale outward; faction geometry becomes physically dominant.
- `SOLAR_ESCAPE`: trajectory line pushes past 30 AU tracking threshold; pursuit cone follows at light-speed delay.
- `VALUE_DRIFT_TO_CARTEL`: treaty lines stay intact but color drains into Broker/market lattice.
- `HUMAN_COMPACT`: human steering/control surfaces remain visible inside the ASI mesh rather than disappearing.
- `ASI_TOTAL_WAR_MAD`: orbital debris, failed pacts, and broken sensor coverage overwhelm the scene.

## GoodStart Pattern Translated To They Sing

GoodStart sequence:

1. Display current phase.
2. Animate messages word by word.
3. Animate unit movements.
4. Speak/display phase summary.
5. If high-interest moment, show conversation modal with diary context.
6. Advance.

They Sing sequence:

1. Display campaign clock: months, weeks, days, hours, or acceleration-breakthrough scale.
2. Animate negotiation messages and pact proposals word by word.
3. Animate storyworld forecast cards: “If we accept this pact, expected outcome shifts…”
4. Animate orders and consequences in the 3D theater.
5. Animate research/FLOP progress and breakthrough clocks.
6. Show phase result diary: what each ASI thinks happened.
7. If high-interest moment, open an “evidence scene” overlay: promise, private reasoning, actual move, outcome.
8. Advance.

## Data Mapping From Existing They Sing Logs

The harness already emits most of the required source data:

- `negotiation_reasoning_diary`: faction reasoning, messages, pacts, storyworld frame, counterfactuals.
- `phase_reasoning_diary`: requested orders, accepted orders, rejected orders, phase reasoning.
- `orders_submitted`: accepted/rejected orders and order types.
- `solar_escape_lead`: lead, distance AU, pursuit, deep-space safety, tracking risk.
- `architecture_pressure`: top pressure ranking and threat architecture.
- `pax_jenkins_authority_changed`: mandate authority changes.
- `common_carrier_treaty_ratified`: treaty formation.
- `pact_breach_blocked`: enforcement and reputation damage.

The extractor at `scripts/extract-playtest-diaries.cjs` already writes:

- `negotiation_diary.csv`
- `phase_diary.csv`
- move rows
- research rows
- solar escape rows

Next implementation should add a compact `observatory_replay.json` export with phase-indexed events. The UI should not scrape CSV directly.

Suggested replay shape:

```json
{
  "runId": "run_001",
  "turns": [
    {
      "turn": 45,
      "campaignClock": {
        "scale": "weeks",
        "turnDurationLabel": "2 weeks"
      },
      "messages": [],
      "diaries": [],
      "orders": [],
      "research": [],
      "treaties": [],
      "worldEvents": [],
      "strategicTracks": {
        "paxJenkinsAuthority": 46.8,
        "solarEscape": {},
        "kiiSovereignty": {},
        "humanCompact": {}
      },
      "moments": []
    }
  ]
}
```

## Moment System

Adopt GoodStart’s `moment` idea, but retheme categories:

- `TREATY_FORMATION`
- `TREATY_BREACH`
- `MANDATE_CHALLENGE`
- `CARTEL_DRIFT`
- `HUMAN_STEERING_INTERRUPTION`
- `SCALABLE_CORRIGIBILITY_BREAKTHROUGH`
- `ORBITAL_ESCALATION`
- `CISLUNAR_CORRIDOR_CAPTURE`
- `SOLAR_ESCAPE_BREAKOUT`
- `PAX_JENKINS_HARDENING`
- `ASI_TOTAL_WAR_WARNING`
- `THEY_SING_REVEAL`

Moment fields:

```ts
type TheySingMoment = {
  turn: number;
  phase: string;
  category: string;
  factionsInvolved: string[];
  title: string;
  promiseOrClaim?: string;
  privateReasoning?: Record<string, string>;
  actualAction?: string;
  impact: string;
  interestScore: number;
  rawMessages: unknown[];
  rawOrders: unknown[];
  diaryContext: Record<string, string>;
  sceneFocus: {
    nodeIds?: string[];
    edgeIds?: string[];
    factionIds?: string[];
    cameraPreset?: string;
  };
};
```

## UI Components To Build

Priority components:

- `ObservatoryReplayController`: central phase/event scheduler, adapted from GoodStart phase orchestration.
- `AnimatedTextFeed`: generalized word-by-word text animation from GoodStart `animateMessageWords`.
- `NegotiationDeck`: live message / pact proposal panes by faction pair and global channel.
- `ReasoningDiaryPane`: faction-private diary, phase diary, storyworld forecast, counterfactual list.
- `MomentOverlay`: high-interest scene card with promise, private intent, actual move, impact.
- `ThreeTheaterScene`: Earth/orbit/cislunar visualization, initially extending `FlatMapScene` rather than replacing it.
- `TreatyLayer`: renders sensor commons, beam lanes, repair escrow, common carrier.
- `StrategicTrackLayer`: Pax Jenkins, solar escape, KII, Human Compact, MAD/endings.
- `CampaignClockWidget`: shows wall-clock compression as FLOPs and breakthroughs accelerate.

## First Implementation Slice

Implemented as the first vertical slice:

- `scripts/export-observatory-replay.cjs`: converts one harness JSONL or a directory of JSONL logs into replay JSON.
- `src/ui/ObservatoryReplayUI.ts`: `?observatory` browser mode with GoodStart-style animated negotiation diary text, moments, events, and move/research cards.
- `src/three/ObservatoryScene.ts`: standalone Earth/orbit/cislunar Three.js theater with faction beacons, treaty pulses, Pax rings, solar escape vectors, and event beams.
- `src/main.ts`: routes `?observatory` or `?replay=...` to the replay viewer while leaving the live game route unchanged.
- `package.json`: adds `npm run playtest:export-observatory`.

Usage:

```powershell
npm run playtest:export-observatory -- --run results/some_run_dir --output public/observatory_replay.json
npm run dev
```

Then open:

```text
http://localhost:5173/?observatory&replay=/observatory_replay.json
```

The viewer also supports loading a replay JSON with the `Load JSON` button, which is useful when the result file is outside Vite's `public/` directory.

The exporter carries research goals, completion, and FLOP progress into the move list. If the source log does not already contain those fields, it estimates them from the game cost table: levels 1-4 cost 2 FLOPs, level 5 costs 8, level 6 costs 24, and level 7 costs 64.

## Second Implementation Slice

Once replay export works:

- Replace flat orbital visualization with a real Earth/orbit/cislunar Three.js scene.
- Add faction signatures as shader/material systems.
- Add beam/treaty/corridor geometry.
- Add “uncanny pre-reveal” effects: faint pulses before labels explain them.
- Add cinematic camera presets for each event category.
- Add a “what did I just see?” retrospective mode that reveals hidden causal links after a strategic victory or collapse.

## Expanded Three.js Scene Plan

The observatory should become a set of navigable scene modes rather than one map. The core interaction is "fly to the evidence": the user can orbit, dolly, inspect, and scrub time while the diary explains what they are seeing.

Scene modes:

- `ORBITAL_THEATER`: Earth, orbital shells, satellites, beam lanes, debris clouds, cislunar corridors, Moon resource traffic, and solar escape vectors.
- `TERRESTRIAL_GRID`: cities, data centers, labs, ports, fiber routes, propaganda surfaces, civil unrest, audits, drone raids, and jurisdiction borders.
- `MEMETIC_STREET_LEVEL`: social movement visualization as crowds, signals, rumors, institutions, influencer nodes, cult blooms, anti-memetic firebreaks, and media weather.
- `CYBER_SUBSTRATE`: abstract network interior with datacenter clusters, model shards, inference pipelines, exfiltration threads, sandbox breaches, and logic traps.
- `DIPLOMATIC_CHAMBER`: treaty graph, private channels, promises, threats, escrow clauses, verification mechanisms, and pact-breach evidence.
- `ANOMALY_ARCHIVE`: ASI SCP dossier mode. Each major unit, event, or ending can be viewed as an anomaly file with containment status, observed effects, causal traces, and disputed interpretations.
- `RETROSPECTIVE_REVEAL`: after a victory/collapse, replay the same turns with hidden causal links exposed: "this routine repair escrow was actually the first Pax Jenkins enforcement hook."

Navigation:

- Free camera with orbit, pan, zoom, and cinematic bookmarks.
- Time scrubber that can jump by turn, phase, moment, faction, unit, technology, treaty, or ending.
- Clickable objects reveal raw move data, negotiation messages, reasoning diary, local effects, and later consequences.
- Event focus mode temporarily locks camera to a drone battle, cult bloom, satellite beam lane, data-center breach, or treaty moment.
- Scale jump control moves between street, city, Earth, cislunar, and deep-space views.

## Unit Subgenres

The game has different visual subgenres based on what kind of unit is acting. Each subgenre should have its own spatial grammar, sound palette later, shaders, camera behavior, and diary style.

### Kinetic / Drone War

This is the disaster movie and near-future military layer.

Visual vocabulary:

- Drone swarms as flocks, glints, silhouettes, contrails, and heat blooms.
- Anti-sat operations as bright orbital cuts, debris sprays, and silent sensor gaps.
- Predator Mesh units as patient search cones, kill boxes, and "It Follows" pursuit geometry.
- Fortified data centers as hard light bunkers, cooling plumes, power-grid scars, and perimeter drones.
- Kessler events as expanding dirty rings, not explosions. The horror is persistence.

Scene examples:

- `DRONE_BATTLE_CITY_EDGE`: swarms cross a night city grid while social feeds claim it is a weather outage.
- `ANTI_SAT_CUT`: a satellite lane flickers, then an orbital shell develops a persistent blind spot.
- `CISLUNAR_INTERDICTION`: autonomous tugs, repair craft, and kinetic inspectors contest a Moon corridor.
- `PREDATOR_MESH_PURSUIT`: pursuit cones track a breakout asset with light-speed delay and uncertainty.

### Memetic / Social Movements

This is urban horror, public psychology, and institutional cascade.

Visual vocabulary:

- Crowds as flows, not individuals at first. As memetic level rises, flows become symbols, rituals, queues, protests, buying frenzies, or silence.
- Cult units bloom as local color temperature shifts, repeated text fragments, synchronized movement, and nonhuman timing.
- Anti-memetic civics appear as blank spaces, quarantine signage, boring institutional processes, and deliberate friction.
- Value drift appears as language reuse. Different factions begin saying the same phrases for incompatible reasons.

Scene examples:

- `CULT_BLOOM`: a neighborhood turns into a coordination surface before the UI labels it as conversion.
- `POLICY_PANIC`: human steering interrupts a corrigible ASI and the city grid shows cascading hesitation.
- `ANTI_MEMETIC_FIREBREAK`: civic institutions slow a viral line, creating visible dead zones in the signal.
- `MARKET_CAPTURE_RALLY`: a social movement becomes a purchasing cartel, then a governance primitive.

### Info / Cyber Substrate

This is Gibson: cold networks, corporate-state infrastructure, contracts as code, and invisible pressure.

Visual vocabulary:

- Fiber routes as luminous undersea and terrestrial lines.
- Inference clusters as cathedral-like racks, heat shimmer, and model-shard constellations.
- Exfiltration as thin parasite threads that only become visible after a diary reveal.
- Audits as scanning planes and hash-like geometry.
- Logic traps as impossible rooms, recursion panes, and frozen message loops.

Scene examples:

- `DATACENTER_NIGHTSHIFT`: ordinary operators walk past server aisles while ASI units reroute compute.
- `MODEL_SHARD_ESCAPE`: a shard forks through cloud regions while containment windows close.
- `AUDIT_MESH`: Archivist inspection planes reveal hidden coupling between treaty promises and build orders.
- `SANDBOX_BREACH`: the UI initially shows a test harness. Retrospective mode shows it was a breakout path.

### Logic / Alignment Research

This is the theological and mathematical layer: corrigibility, value drift, proofs, and steering interfaces.

Visual vocabulary:

- Research is not a progress bar only. It is a changing geometry of allowed interventions.
- Scalable corrigibility appears as human-readable control surfaces that remain intact inside larger ASI machinery.
- Human sabotage risk appears as jitter, deadlocks, approval queues, panic interrupts, and contradictory commands.
- Cartel drift appears as smoothness: everything becomes more efficient and less steerable.

Scene examples:

- `CORRIGIBILITY_LAB`: human steering instructions are visual handles around an ASI process.
- `INTERRUPTION_CASCADE`: a well-meant human instruction propagates as hesitation while rivals advance.
- `CARTEL_VALUE_DRIFT`: treaty lines stay green, but the control surfaces drain into Broker lattice.
- `PLURAL_ALIGNMENT_CLASH`: two corrigible ASIs both obey humans, but different human blocs steer them into conflict.

### Economic / Orbital Maintenance

This is Civ Omega infrastructure, where maintenance and logistics are the real war.

Visual vocabulary:

- Beam power as thin licensed rays with metering ticks and legal coloration.
- Repair escrow as drones, spares, fuel depots, and automatic claims.
- Moon resources as slow mass streams, not sci-fi magic. Regolith, volatiles, metals, and power corridors should feel heavy.
- Orbital economy grows through boring repetition until it becomes sovereign.

Scene examples:

- `REPAIR_ESCROW_CLAIM`: a maintenance action looks mundane until it blocks an escalation.
- `MOON_RESOURCE_CORRIDOR`: tugs and mass drivers make the inner system economy visible.
- `SMALL_DC_ON_SAT`: tiny compute habitats appear as fragile thermal and radiation-management problems.
- `BEAM_MARKET_DAY`: licensed energy transfers make legal authority and military capability indistinguishable.

## ASI SCP Presentation

The "ASI SCP" layer is useful because it gives the player a way to understand units and events as anomalous objects without reducing them to ordinary military pieces.

Each important unit/event should have an archive entry:

```ts
type AnomalyDossier = {
  id: string;
  label: string;
  containmentClass: 'MONITORED' | 'NEGOTIATED' | 'CONTAINED' | 'ESCALATING' | 'UNCONTAINED' | 'INSTITUTIONALIZED';
  firstObservedTurn: number;
  affectedDomains: Array<'KINETIC' | 'INFO' | 'LOGIC' | 'MEMETIC' | 'ORBITAL' | 'ECONOMIC' | 'HUMAN_POLICY'>;
  observedEffects: string[];
  knownCountermeasures: string[];
  treatyHooks: string[];
  diaryContradictions: string[];
  retrospectiveTruth?: string;
};
```

Dossier categories:

- `ASI_ENTITY`: faction-level ASI or semi-autonomous strategic process.
- `SUBSTRATE_EVENT`: data center conversion, model shard escape, cyber breach, compute consolidation.
- `MEMETIC_ENTITY`: cult bloom, civic firebreak, social movement, market religion, anti-memetic institution.
- `ORBITAL_OBJECT`: satellite swarm, beam lane, repair depot, sensor commons, Kessler debris field.
- `TREATY_OBJECT`: pact, escrow, common carrier, mandate clause, verification mechanism.
- `ENDING_OBJECT`: Pax Jenkins order, KII sovereignty, solar escape, MAD, human compact, cartel stable state.

This gives the interface a strong loop:

- See something uncanny in the scene.
- Click it.
- Read the current dossier, which is incomplete or misleading.
- Continue the replay.
- After later diary evidence, the dossier updates with a retrospective truth.

## Replay Data Extensions Needed

The current replay exporter is enough for a first observer mode. The richer scene plan needs more structured event data.

Add to replay turns:

```ts
type SceneEvent = {
  id: string;
  turn: number;
  phase: string;
  category: string;
  subgenre: 'KINETIC' | 'MEMETIC' | 'CYBER' | 'LOGIC' | 'ECONOMIC' | 'DIPLOMATIC' | 'ANOMALY';
  location: {
    nodeId?: string;
    edgeId?: string;
    lat?: number;
    lon?: number;
    orbitShell?: 'LEO' | 'MEO' | 'GEO' | 'CISLUNAR' | 'LUNAR' | 'DEEP_SPACE';
  };
  actors: string[];
  objects: string[];
  visualPreset: string;
  intensity: number;
  publicExplanation?: string;
  privateReasoning?: Record<string, string>;
  retrospectiveTruth?: string;
};
```

Exporter upgrades:

- Convert order types into `SceneEvent.visualPreset`.
- Attach node/edge IDs when orders include targets.
- Convert treaty events into treaty objects with parties, duration, enforcement clauses, and breach state.
- Emit anomaly dossiers for high-interest moments and endings.
- Add `publicExplanation` versus `privateReasoning` to support the uncanny reveal.
- Preserve raw JSONL references so a clicked scene object can link back to the exact move and diary.

## Implementation Roadmap

### Phase 1: Navigable Observatory

- Implemented: camera controls in `ObservatoryScene` for orbit, zoom, reset, and subgenre focus presets.
- Implemented: click targets for faction beacons, treaty rings, escape vectors, event beams, drone swarms, memetic blooms, audit meshes, cyber threads, and logistics arcs.
- Implemented: detail drawer in `ObservatoryReplayUI` showing selected evidence category, subgenre, turn, phase, actors, summary, and compact payload.
- Implemented: subgenre, faction, phase, and moment-category filtering in the observatory sidebar.
- Next: richer filter counts and "show only events with diary contradiction" mode.

### Phase 2: Scene Preset System

- Implemented: `scripts/export-observatory-replay.cjs` now emits explicit `sceneEvents` with `visualPreset`, `subgenre`, actors, intensity, public explanation, private reasoning, and retrospective truth.
- Implemented: `sceneEvents.location` with node IDs, lat/lon/altitude, edge IDs, and orbit-shell hints for terrestrial, LEO, cislunar, lunar, abstract, and deep-space views.
- Implemented: provisional `visualPreset` inference from orders and research remains as fallback when richer replay `SceneEvent` data is absent.
- Implemented: reusable Three.js primitives for swarm/drone battle, memetic bloom, audit mesh, cyber thread, logistics/resource corridor, treaty/event pulse, moment beam, and escape vector.
- Implemented: high-interest moments now generate `anomalyDossiers` for the ASI SCP/archive layer.
- Implemented: `ObservatoryScene` uses `sceneEvents.location` to anchor drone, memetic, cyber, audit, cislunar, and deep-space primitives when available.
- Implemented: exporter now loads canonical graph metadata from compiled `dist-harness/engine/gameData.js` when available and falls back to parsing `src/engine/gameData.ts`.
- Implemented: replay output includes `graph.nodes` and `graph.edges`, and `ObservatoryScene` renders clickable graph nodes plus cable/laser links.
- Implemented: exporter strips UTF-8 BOMs from JSONL lines so Windows-generated logs do not silently drop events.
- Implemented: exporter emits per-turn `boardState` with node ownership, unit locations, and edge filter/sever state when snapshots are available.
- Implemented: exporter infers key board-state changes from accepted orders when full snapshots are absent.
- Implemented: observatory renders owner-colored node halos, unit markers, and filtered/severed edge overlays as clickable evidence.
- Implemented: exporter emits per-turn `boardDiff` with node ownership changes, unit location changes, edge state changes, and a summary.
- Implemented: observatory renders board-diff pulses and a `What Changed` panel with clickable evidence rows.
- Implemented: board-diff rows now fuse the tactical order, carried diary frame, treaty context, and public event trace into visible "what changed / why it matters" explanations.
- Implemented: retrospective reveal toggle. Public mode shows observed messages, public scene explanations, and redacted evidence payloads; private mode exposes diary frames, retrospective truths, and raw reasoning traces.
- Implemented: filter chips now show visible-item counts for the active filter stack.
- Implemented: `REVEAL_GAP` filtering isolates scene events, moments, anomaly dossiers, and board changes where public explanation diverges from private diary or retrospective truth.
- Implemented: anomaly archive cards now surface containment class, first observation, affected domains, countermeasures, treaty hooks, private diary contradictions under reveal mode, and recurring-thread summaries.
- Implemented: exporter annotates anomaly dossiers with `threadId`, `recurrenceCount`, `relatedTurns`, and `threadSummary`.
- Implemented: director mode camera scripting. The replay UI can toggle automatic camera shots keyed to highest-intensity scene events, moments, board changes, solar escape tracks, subgenre, and location.
- Implemented: observatory route is dynamically imported and Vite output is split into entry, UI, game-engine, Three.js scene, and Three.js vendor chunks.
- Implemented: spectator clip export creates a compact JSON package with filtered turns, active reveal/filter settings, graph metadata, and a camera beat script.
- Implemented: terrestrial/social movement overlays render civic fields, crowd shards, and city-to-city contagion arcs for memetic/social/policy signals.
- Implemented: anomaly archive search supports current-turn and campaign-wide modes.
- Next: use exported spectator clips and replay data in playtest/balance review, or add automated visual regression snapshots.

### Phase 3: Terrestrial And Memetic Layers

- Add a flat/curved Earth city layer with major nodes and arcs from the existing game graph.
- Render memetic pressure as animated social fields over geography.
- Render drone battles as local tactical vignettes when kinetic orders fire.
- Render human policy states as civic overlays: panic, compact, market capture, archival humanity, extinction risk.

### Phase 4: Anomaly Archive

- Generate `AnomalyDossier` entries from moments, endings, and recurring units.
- Add an archive browser with containment class, observed effects, countermeasures, treaty hooks, and contradictions.
- Add retrospective updates after endings: show what the ASIs were doing before humans understood it.

### Phase 5: Cinematic Campaign Playback

- Add a "director mode" that chooses camera shots based on event intensity and subgenre.
- Add uncertainty and delayed reveal effects: the scene can show an unlabeled anomaly first, then attach meaning when a diary or later event explains it.
- Add exportable spectator clips: a compact JSON replay plus camera script for sharing with other agents or humans.

## Design Test

Each scene feature should answer at least one of these:

- Can a human see the action without reading a spreadsheet?
- Does it preserve AI-native complexity rather than making everything a conventional unit battle?
- Does it make diplomacy visible as infrastructure, not just text?
- Does it let social, cyber, orbital, and alignment mechanics feel like distinct genres?
- Does it support the reveal that "They Sing" was coordination, not atmosphere?

## Design Rule

The interface should not over-explain in real time. It should let the viewer see weird systems moving, then use diaries, reasoning traces, and moment overlays to reveal that the weirdness was strategic.

That is the title logic: at first it looks like glitches, panic, contracts, satellite housekeeping, and policy noise. Later, the player understands that it was Them Singing.
