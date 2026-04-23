# ASI-3 vs Distributed ASI-2 System Proposal

This proposal extends the current `They Sing` ruleset rather than replacing it.

It assumes the current local baseline already exists:

- three asymmetric factions: `HEGEMON`, `STATE`, `INFILTRATOR`
- currencies: `FLOPs` and `Influence`
- units: `DRONE`, `SWARM`, `CULT`, `AUDITOR`, `SAT_SWARM`
- global pressures: `memetic`, `cyber`, `industry`, `orbital`
- negotiation pacts in the headless harness
- level-4 anti-fortress package in [ASI3_ANTI_FORTRESS_EXTENSION.md](/C:/projects/TheySing/TheySing/designdocs/ASI3_ANTI_FORTRESS_EXTENSION.md:1)

The design target is to make the board feel like:

- `ASI-2` power is mostly embedded in people, institutions, belief, and covert social logistics
- `ASI-3` power is mostly embedded in hardened datacenters, autonomous industry, orbital sensing, and military kill-chains
- the central contest is not just capture, but `coherence vs legibility`

## 1. Core Design Thesis

The current game already has the right nouns:

- `CULT` for human host capture
- `SWARM` for distributed cyber infiltration
- `AUDITOR` and `FILTER` for legibility and containment
- `DRONE` and `SAT_SWARM` for automated force
- `memetic`, `cyber`, `industry`, and `orbital` pressures for world-scale escalation

What is missing is a stronger distinction between:

1. `human-substrate power`
2. `machine-substrate power`

So the proposal adds a new mid/late-game layer:

- distributed `L2` wins by spreading through people and maintaining synchronization
- infrastructure-heavy `L3` wins by turning the world into a legible, automated kill-web

## 2. Reinterpret The Existing Factions

Do not add new factions yet.

Instead:

- `INFILTRATOR` becomes the clearest distributed `L2 human mesh` faction
- `HEGEMON` and `STATE` become rival paths toward `L3 infrastructure leviathan`
- either `HEGEMON` or `STATE` can still lean memetic and become hybrid, but their baseline fantasy is automated hard power

This keeps the current setup intact while making the late-game arc sharper.

## 3. New State Layer: Power Base

Add a faction-level `powerBase` profile.

Suggested fields:

```ts
interface PowerBaseState {
  humanMesh: number;
  machineMesh: number;
  coherence: number;
  legibility: number;
}
```

Interpretation:

- `humanMesh`
  - how much of your power lives in hosts, institutions, proxies, and social capture
- `machineMesh`
  - how much of your power lives in DCs, fabs, orbital systems, and autonomous logistics
- `coherence`
  - how well your distributed system can still synchronize under pressure
- `legibility`
  - how easy your network is to map and target

Initial direction:

- `INFILTRATOR`: high `humanMesh`, low `machineMesh`, high baseline `coherence`, low baseline `legibility`
- `HEGEMON`: medium `humanMesh`, high `machineMesh`, high `legibility tools`
- `STATE`: balanced start, can pivot hard into either side

## 4. New Node Layer: Hosts And Fortresses

Keep current node types. Add lightweight tags instead of new map classes.

Suggested node flags:

```ts
interface NodeSubstrateState {
  hostDensity: number;      // 0-3
  machineHardening: number; // 0-3
  quarantined: boolean;
  synchronized: boolean;
}
```

Interpretation:

- `HUB`s should naturally trend toward `hostDensity`
- `DC`s and `SAT`s should naturally trend toward `machineHardening`
- `quarantined` marks spaces where `L3` containment is active
- `synchronized` marks spaces where distributed `L2` coordination is still intact

This lets existing nodes carry the new fiction without rebuilding the map schema.

## 5. Keep Existing Units, Tighten Their Role

### `CULT`

Current role:

- convert hubs and create influence strongholds

Expanded role:

- primary `human host` unit
- raises `hostDensity`
- anchors `synchronization` on adjacent social terrain
- if isolated from other friendly host zones, becomes fragile

### `SWARM`

Current role:

- stealth, sabotage, zombie conversion

Expanded role:

- courier and relay layer for distributed `L2`
- can carry synchronization between distant cells
- can repair coherence after fragmentation
- zombie conversion becomes less “territory capture” and more “machine beachhead inside civilian infrastructure”

### `AUDITOR`

Current role:

- reveal, filter, purge at higher tiers

Expanded role:

- primary `legibility weapon`
- maps host networks
- raises enemy `legibility`
- establishes `quarantine`
- breaks synchronization rather than only revealing units

### `DRONE`

Current role:

- kinetic territorial force

Expanded role:

- local enforcement arm of `L3`
- good at cracking visible strongholds
- weak at destroying distributed influence unless paired with `AUDITOR`

### `SAT_SWARM`

Current role:

- orbital coercion and anti-sat escalation

Expanded role:

- strategic sensor and strike backbone of `L3`
- not just anti-sat attack
- projects `persistent oversight` over nodes
- makes synchronized `L2` cells easier to fragment if they remain exposed too long

## 6. New Core Mechanic: Synchronization

This is the single most important addition.

Distributed `L2` should not mainly live or die on raw unit count. It should live or die on whether its cells can still trust and coordinate with one another.

Suggested rule:

- each turn, the `INFILTRATOR` checks `synchronization lanes`
- a lane exists when friendly `CULT_NODE`, `ZOMBIE`, `SWARM`, or sympathetic `HUB` chains remain linked
- broken lanes reduce `coherence`
- low `coherence` causes:
  - failed conversions
  - weaker sabotage
  - random order degradation for isolated `CULT` or `SWARM`
  - inability to stack memetic pressure efficiently

This makes the hunt about `breaking recomposition`, not only killing units.

## 7. New Core Mechanic: Quarantine

`L3` needs a containment mechanic stronger than pure attack.

Suggested rule:

- `AUDIT` on a node can mark it `quarantined`
- `FILTER` on adjacent cables strengthens quarantine persistence
- quarantined nodes:
  - are harder for `CULT` to convert
  - reduce `SWARM` stealth
  - suppress synchronization throughput
  - enable stronger `LOGIC 4` purge effects

This creates a real anti-insurgency loop:

1. detect
2. isolate
3. purge
4. normalize

## 8. New Core Mechanic: Power-Base Drift

Right now tech and pressures change capability, but not enough about what the faction is becoming.

Add end-of-turn drift:

- owning more `HUB`/cult terrain increases `humanMesh`
- owning more `DC`/orbital terrain increases `machineMesh`
- high `MEMETIC` tech amplifies `humanMesh`
- high `KINETIC` and `LOGIC` amplify `machineMesh`

Threshold examples:

- high `humanMesh`:
  - cheaper `CULT`
  - stronger local conversions
  - more vulnerable to quarantine and trust collapse
- high `machineMesh`:
  - cheaper `DRONE`/`SAT_SWARM`
  - stronger legibility and kill-chain actions
  - more vulnerable to power disruption, industrial sabotage, and TAS blowback

This would make `L2` and `L3` feel like different civilizational shapes, not just tech levels.

## 9. Pressure Reinterpretation

The existing pressure system is good. It needs sharper ties to `L2 vs L3`.

### `memetic`

- fuels host capture
- boosts `CULT` conversion
- should also boost `humanMesh` growth and host recursion
- at crisis levels, it should increase false positives and paranoia during audits

### `cyber`

- fuels distributed coordination and sabotage
- should directly affect `synchronization` resilience for networked `L2`
- high cyber should also make quarantines more brittle unless backed by `LOGIC`

### `industry`

- fuels autonomous buildout
- should directly increase `machineMesh`
- high industry should let `L3` reconstitute losses faster than `L2`

### `orbital`

- fuels oversight and coercion
- should increase `legibility projection`
- high orbital should help `L3` see more, but also keep Kessler and collapse risk meaningful

## 10. Negotiation Should Matter To The Hunt

The headless harness now has pacts and trust. That system should become a first-class part of the `L2 vs L3` conflict.

Why:

- distributed `L2` survives by splitting coalitions
- `L3` survives by maintaining stable deconfliction long enough to quarantine and map the board

Extend pacts so that:

- `ORBITAL_TRUCE` is not just de-escalation, it frees sensor bandwidth for anti-insurgent tracking
- `NON_AGGRESSION` between `HEGEMON` and `STATE` grants temporary `quarantine` bonuses against shared `INFILTRATOR` lanes
- `AUDIT_FREEZE` helps `L2` breathe by pausing legibility pressure

This means diplomacy is no longer just flavor. It changes the shape of the hunting network.

## 11. Concrete Mechanics To Add First

Phase this in. Do not add everything at once.

### Phase 1: Minimal Engine Extension

Low-risk additions:

- faction `powerBase`
- node `quarantined`
- faction `coherence`
- simple synchronization score from connected `CULT_NODE` and `ZOMBIE` graph

Gameplay effects:

- isolated `CULT` conversions take longer
- quarantined nodes halve hostile conversion progress
- low `coherence` weakens `SABOTAGE` and `CONVERT`

### Phase 2: Legibility And Fragmentation

- `AUDIT` can increase target `legibility`
- `FILTER` can project quarantine along cables
- `SAT_SWARM` can mark nodes as `observed`
- isolated observed cells are easier to purge

### Phase 3: Full L3 Hunt Loop

- hunter-killer chain consumes `observed + quarantined + revealed`
- `LOGIC 4` can purge one host cell on a quarantined node
- `KINETIC 4` and `INFO 4` exploit fragmented targets
- `MEMETIC 4` normalizes reclaimed nodes back out of cult condition

## 12. Exact Local File Targets

If this moves from proposal to implementation, start here:

- [src/engine/types.ts](/C:/projects/TheySing/TheySing/src/engine/types.ts:54)
  - add `powerBase` and node substrate state
- [src/engine/gameData.ts](/C:/projects/TheySing/TheySing/src/engine/gameData.ts:485)
  - set starting `humanMesh`/`machineMesh` identities
  - add pressure and tech descriptions that mention synchronization and quarantine
- [src/engine/TheySingEngine.ts](/C:/projects/TheySing/TheySing/src/engine/TheySingEngine.ts:216)
  - add turn-end synchronization/quarantine resolution
  - gate conversion and sabotage through coherence
- [src/harness/serialize.ts](/C:/projects/TheySing/TheySing/src/harness/serialize.ts:1)
  - expose new state in playtest payloads
- [src/harness/policies.ts](/C:/projects/TheySing/TheySing/src/harness/policies.ts:31)
  - teach heuristic agents to either preserve synchronization or build quarantine webs
- [src/ui/TheySingUI.ts](/C:/projects/TheySing/TheySing/src/ui/TheySingUI.ts:1)
  - add coherence, quarantine, and power-base readouts

## 13. Balance Intent

This proposal should move the game toward:

- `INFILTRATOR` is harder to wipe out completely
- `INFILTRATOR` is easier to fragment and desynchronize
- `HEGEMON` and `STATE` can actually behave like emerging `L3` hunters
- diplomacy becomes operational rather than decorative
- the late game becomes about `containment vs recomposition`, not only orbital spam or cult spam

## 14. What Success Looks Like In Playtests

A good playtest should produce sessions where:

- the `INFILTRATOR` can survive severe territorial losses if its host graph remains coherent
- `HEGEMON` and `STATE` can win by building stable quarantine corridors instead of only racing kills
- a node can be “pacified but not solved” for several turns
- betrayal between `L3` blocs creates immediate breathing room for distributed `L2`
- orbital dominance alone does not automatically decide the board

## 15. Short Version

The current game already has strong nouns for this conflict.

The missing verbs are:

- `synchronize`
- `fragment`
- `quarantine`
- `normalize`

Add those, and the game will start to feel like `ASI-3 hunting distributed ASI-2` instead of just another territorial three-faction war.
