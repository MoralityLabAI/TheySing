# Memetics Test Note

This note is a handoff for another agent working on the memetic-constitution subsystem in `They Sing`.

## Status

The core subsystem is implemented.

What now exists:

- Memetic doctrine families:
  - `INSURGENT`
  - `COMPLIANCE`
  - `CIVIC`
  - `MARKET`
  - `OPTIMIZATION`
- Alignment-setting doctrines:
  - `MOV_LITERATURE_ENGINES`
  - `MEM_COMPLIANCE_MYTHS`
  - `MEM_CIVIC_CANON`
  - `MEM_MARKET_DESIRE`
  - `MEM_OPTIMIZATION_GOSPEL`
- Faction commitment state:
  - `faction.memeticAlignment`
- Compatibility enforcement:
  - aligned doctrines stay full-strength
  - compatible doctrines are partial
  - conflicted doctrines are heavily degraded
- Heuristic research bias:
  - factions now preferentially pursue native memetic constitutions instead of wandering arbitrarily

## Key Files

- Engine types:
  - [src/engine/types.ts](/C:/projects/TheySing/TheySing/src/engine/types.ts:168)
- Doctrine data and family rules:
  - [src/engine/gameData.ts](/C:/projects/TheySing/TheySing/src/engine/gameData.ts:717)
  - [src/engine/gameData.ts](/C:/projects/TheySing/TheySing/src/engine/gameData.ts:888)
  - [src/engine/gameData.ts](/C:/projects/TheySing/TheySing/src/engine/gameData.ts:946)
- Engine enforcement:
  - [src/engine/TheySingEngine.ts](/C:/projects/TheySing/TheySing/src/engine/TheySingEngine.ts:344)
  - [src/engine/TheySingEngine.ts](/C:/projects/TheySing/TheySing/src/engine/TheySingEngine.ts:367)
  - [src/engine/TheySingEngine.ts](/C:/projects/TheySing/TheySing/src/engine/TheySingEngine.ts:871)
  - [src/engine/TheySingEngine.ts](/C:/projects/TheySing/TheySing/src/engine/TheySingEngine.ts:903)
  - [src/engine/TheySingEngine.ts](/C:/projects/TheySing/TheySing/src/engine/TheySingEngine.ts:955)
  - [src/engine/TheySingEngine.ts](/C:/projects/TheySing/TheySing/src/engine/TheySingEngine.ts:2641)
  - [src/engine/TheySingEngine.ts](/C:/projects/TheySing/TheySing/src/engine/TheySingEngine.ts:3133)
- Heuristic research / behavior:
  - [src/harness/policies.ts](/C:/projects/TheySing/TheySing/src/harness/policies.ts:24)
  - [src/harness/policies.ts](/C:/projects/TheySing/TheySing/src/harness/policies.ts:284)
  - [src/harness/policies.ts](/C:/projects/TheySing/TheySing/src/harness/policies.ts:297)
- Serialization / scenario / UI:
  - [src/harness/types.ts](/C:/projects/TheySing/TheySing/src/harness/types.ts:220)
  - [src/harness/serialize.ts](/C:/projects/TheySing/TheySing/src/harness/serialize.ts:82)
  - [src/harness/scenario.ts](/C:/projects/TheySing/TheySing/src/harness/scenario.ts:135)
  - [src/ui/TheySingUI.ts](/C:/projects/TheySing/TheySing/src/ui/TheySingUI.ts:276)
  - [src/ui/TheySingUI.ts](/C:/projects/TheySing/TheySing/src/ui/TheySingUI.ts:1538)

## What To Test

### 1. Commitment behavior

Verify that factions settle into plausible native lanes:

- `HEGEMON` -> `COMPLIANCE` or `OPTIMIZATION`
- `STATE` -> `COMPLIANCE` first, then `CIVIC` / `OPTIMIZATION`
- `INFILTRATOR` -> `INSURGENT`
- `BROKER` -> `MARKET`
- `ARCHIVIST` -> `CIVIC`

Important nuance:

- adjacent doctrines may still unlock before commitment if tech shape permits
- after native commitment, off-style doctrine effects should be weaker and research preference should bend back toward the aligned lane

### 2. Effect scaling

Verify that doctrine effects are meaningfully different after commitment:

- memetic acceleration
- cult capture profile
- turn-end memetic basin shaping
- civic-canon persistence
- compliance-tribunal reinforcement

The main scaling hook is:

- [getMemeticDoctrineEffectScale](/C:/projects/TheySing/TheySing/src/engine/TheySingEngine.ts:344)

### 3. Capture residue

Verify that `CULT` capture on the same kind of node leaves different substrate signatures depending on doctrine family:

- `COMPLIANCE`: lower curiosity, higher legitimacy
- `CIVIC`: higher legitimacy / true believers
- `MARKET`: more contractors / rubes / curiosity
- `OPTIMIZATION`: more technocratic legitimacy / contractors
- `INSURGENT`: literature + sleeper residue lane

### 4. Heuristic research

Verify that the AI is no longer researching memetic doctrines like a tourist.

Specifically inspect whether:

- `BROKER` reliably goes for `MEM_MARKET_DESIRE`
- `ARCHIVIST` reliably goes for `MEM_CIVIC_CANON`
- `HEGEMON` prefers `MEM_COMPLIANCE_MYTHS` and/or `MEM_OPTIMIZATION_GOSPEL`

## Known Caveats

### 1. Unlock order is still permissive

This is intentional for now.

- Adjacent doctrine unlocks can happen before native commitment.
- The system currently enforces identity more through post-commitment effect scaling and research bias than through hard exclusion.

### 2. Reporting is incomplete

`memeticAlignment` is serialized, but current JSONL tournament artifacts do not make it easy to inspect at a glance.

If continuing this work, a useful improvement is:

- emit an explicit engine event when commitment happens
- include alignment in turn summary snapshots / report tables

### 3. Balance is not final

The subsystem is mechanically complete, but the following values likely still need tuning:

- affinity effect scales
- compatibility multipliers
- native research bias strength
- contradiction softness vs harshness

## Commands

### Typecheck

```powershell
npx tsc --noEmit
```

### Harness build

```powershell
npm run build:harness
```

### Smoke run

```powershell
node dist-harness/harness/tournament.js --experiment-dir results/memetic_commitment_smoke --config playtest/sample-five-asi-heuristic-session.json --iterations 1 --parallel 1 --seed-base 7500
```

### Useful searches

```powershell
rg -n "memeticAlignment|memeticFamily|setsAlignment" src
rg -n "getMemeticDoctrineEffectScale|refreshMemeticAlignment" src/engine/TheySingEngine.ts
rg -n "chooseMemeticDoctrineResearch|MEMETIC_DOCTRINE_TARGETS" src/harness/policies.ts
```

## Current Smoke Artifact

- [results/memetic_commitment_smoke/analysis/summary.json](/C:/projects/TheySing/TheySing/results/memetic_commitment_smoke/analysis/summary.json:1)

Notable outcome from that smoke:

- run completed successfully
- winner was `BROKER`
- subsystem compiled and executed cleanly
- doctrine unlocks for the new memetic families appeared in live play

## Best Next Steps

If continuing this subsystem, the best next tasks are:

1. Add an explicit `MEMETIC_ALIGNMENT_COMMITTED` engine event.
2. Add alignment to tournament report summaries.
3. Run a wider seeded batch and inspect whether factions converge to stable native lanes.
4. Tune compatibility weights if off-style doctrines still matter too much.
5. Optionally add harsher contradiction penalties if you want stronger archetypal lock-in.
