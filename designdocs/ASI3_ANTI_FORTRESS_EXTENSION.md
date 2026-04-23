# ASI-3 Anti-Fortress Extension

This extension is a direct response to the `session_1776440384726_dd339fc6` full-game transcript, where the board froze after turn 4 and `HUB_SAO_PAULO` became a cult fortress that audits could reveal but not meaningfully reduce.

## Problem

The previous ruleset let late-game memetic recursion compound faster than any counter-force:

- `CULT` conversions accelerated under global memetic surge.
- `AUDIT` produced information but little material reduction.
- `ATTACK` had no kill-chain bonus for fighting fully revealed defenders.
- Once a cult stack reached critical mass, the board could freeze while all four pressure meters maxed out.

## ASI-3 Package

The new level-4 tech layer adds a late-game transition from ASI-2 chaos into ASI-3 consolidation:

- `KINETIC 4: Hunter-Killer Clouds`
  - Revealed defenders can be attrited before combat resolves.
  - Kinetic assaults gain a modest siege bonus against audited targets.

- `INFO 4: Predator Mesh`
  - Swarm-led forces can participate in the same hunter-killer kill-chain once defenders are revealed.

- `LOGIC 4: Total Legibility Grid`
  - `AUDIT` can purge one enemy `CULT` on quarantined or crisis nodes.
  - This converts audit superiority into actual anti-fortress progress.

- `MEMETIC 4: New World Order`
  - Mature regimes slow hostile cult conversion.
  - Cleansed cult hubs can normalize back into governed territory once cult units are gone.

## Intended Dynamics

This is meant to create a new late-game arc:

1. Audit and filter the fortress.
2. Purge cult cells with `LOGIC 4`.
3. Use hunter-killer assaults to grind down revealed stacks.
4. Stabilize the reclaimed basin with `MEMETIC 4` so it does not immediately recurse back into cult capture.

The goal is not to remove cult fortresses as a threat. The goal is to make them expensive, real late-game objectives instead of permanent equilibrium traps.

## Smoke Validation

A focused harness-engine smoke test confirmed the intended sequence:

- Start from a crisis board with `HEGEMON` at `KINETIC 4 / LOGIC 4 / MEMETIC 4`.
- Put a six-unit infiltrator fortress on `HUB_SAO_PAULO`.
- Resolve one turn with:
  - one remote `AUDIT` into Sao Paulo
  - one `FILTER` on `CABLE_AFRICA_SA`
  - three `DRONE` attacks into Sao Paulo

Observed result:

- `AUDIT` purged one cult cell immediately.
- Hunter-killer strike removed three more revealed defenders before combat resolution.
- The attack took Sao Paulo in the same resolution step.
- On the following `TURN_END`, `New World Order` normalization cleared the `isCultNode` flag.
