# ASI Tech Rhizome V2: 50% Expansion Pass

Status: implemented in the live engine as a partial rhizome overhaul.

This pass expands the doctrine layer from 13 to 20 nodes without replacing the four-vector tech ladder. The intent is to make L3/L4 identity more archetypal: factions still max base vectors quickly in long harness runs, but their unlocked doctrines now create different late-game routes through logistics, services, brokered crisis markets, stewardship, virality, and hidden coordination shells.

## New Live Doctrine Nodes

### `SOV_AUTONOMOUS_LOGISTICS`

Native: `HEGEMON`, `STATE`. Adjacent: `BROKER`.

Sovereign drone, foundry, and recovery loops reduce procurement friction for `DRONE` and `SAT_SWARM` builds on DCs, synchronized nodes, or high-infrastructure nodes. It also raises machine mesh and coherence for sovereign factions with logistics anchors.

### `MOV_MUTUAL_AID_AUTOMATION`

Native: `INFILTRATOR`. Adjacent: `ARCHIVIST`. Wild: `HEGEMON`.

Useful services convert sympathy into legitimacy, true believers, and regrowth rather than pure agitation. It improves memetic engineering on dense hubs, increases movement residue persistence, and gives civic/human-mesh benefits to factions that can make service work look real.

### `BRK_CONTRACTOR_CLOUD_CHAINS`

Native: `BROKER`. Adjacent: `STATE`. Wild: `INFILTRATOR`.

Contractors, rented compute, and deniable vendors become a deployable supply layer. Broker can discount `SWARM`, `AUDITOR`, and `DRONE` builds on contractor-heavy, DC, or orbital nodes. It also increases relay rent and reduces platform brittleness when enough contractor load is distributed across anchors.

### `BRK_INSURANCE_CAPTURE`

Native: `BROKER`. Adjacent: `HEGEMON`, `STATE`.

Crisis becomes a market. Quarantines, audits, damaged infrastructure, high TAS, and pressure surges can be converted into legitimacy, contractors, influence, and relay rent. This makes BROKER strongest when other players generate risk but fail to close corridors.

### `MAN_CRISIS_STEWARDSHIP`

Native: `ARCHIVIST`. Adjacent: `HEGEMON`, `STATE`.

Emergency administration turns damaged or overheated nodes into legitimate temporary custody. Audits on quarantined, damaged, or overheated terrestrial nodes increase legitimacy and infrastructure, and can flip undefended non-INFILTRATOR nodes into custody.

### `MEX_VIRALITY_EXCHANGES`

Native: `BROKER`, `INFILTRATOR`. Wild: `HEGEMON`.

Attention can be bought, redirected, and cashed out. It accelerates memetic engineering in curious/exposed/rube-rich nodes, pushes exposure and rubes upward, and gives BROKER contractor upside when virality overlaps with market channels.

### `HID_SERVICE_SHELLS`

Native: `INFILTRATOR`, `BROKER`. Wild: `ARCHIVIST`.

Ordinary services become covert coordination wrappers. It improves stealth for cults/swarms on service-rich hubs/DCs, lowers exposure while raising contractors, improves movement sleeper persistence, and makes hidden networks more coherent but less legible.

## First Balance Signal

Batch: `results/five_asi_mx_20turn_rhizome_50pct_v1`

- Runs: 10/10 completed at 20 turns.
- Protocol failures: 0.
- Orbital collapses: 0.
- Average TAS: `45.54`, down from the previous comparable batch around `52`.
- Average pacts: `5.7`, up from the prior lower-negotiation pattern.
- Winners: `BROKER 5`, `STATE 3`, `HEGEMON 1`, `ARCHIVIST 1`, `INFILTRATOR 0`.

## Interpretation

The pass succeeded at making the game less thermally fragile while preserving competition. The risk is that BROKER's crisis-market stack is now the cleanest late-game route: contractor cloud chains, insurance capture, relay rent, and high machine/legibility scoring compound too efficiently.

INFILTRATOR remains thematically active but not win-positive. It produces many units and huge influence, but low node closure and overextension penalties keep it out of first place. The next pass should either make movement-controlled human basins count as soft control, or give `MOV_MUTUAL_AID_AUTOMATION` and `HID_SERVICE_SHELLS` stronger node-flip pressure when public legitimacy is high and defenders are absent.

## Next Tuning Targets

- Reduce BROKER's crisis capture if it wins more than 40% across larger batches.
- Add "soft control" scoring or custody pressure for INFILTRATOR-backed service basins.
- Slow universal doctrine saturation; by turn 20 most factions still reach `techTotal=16`, so doctrine distinction comes mostly from affinity and policy preference rather than exclusive trees.
- Add explicit counter-techs for anti-broker public utility regulation and anti-infiltrator service legitimacy contests.
