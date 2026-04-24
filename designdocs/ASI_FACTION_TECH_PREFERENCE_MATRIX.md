# Faction Tech Preference Matrix

Use this with:

- [ASI Tech Rhizome Regions And Archetype Crosswalk](./ASI_TECH_TREE_ARCHETYPE_CROSSWALK.md)
- [Next 24 Tech Nodes For The ASI Rhizome](./ASI_RHIZOME_NEXT_24_TECHS.md)

This matrix is not a balance table.
It is a design-intent table.

Priority labels:

- `H`: strong natural appetite
- `M`: situational or secondary appetite
- `L`: weak or mostly denial-oriented appetite

## Region Preference Matrix

| Faction | Sovereign | Broker | Movement | Command Market | Mandate Engine | Memetic Exchange | Hiddenness | Orbital-Closure |
|---|---|---|---|---|---|---|---|---|
| `HEGEMON` | `H` | `M` | `L` | `H` | `M` | `L` | `L` | `H` |
| `STATE` | `H` | `M` | `M` | `H` | `H` | `L` | `L` | `H` |
| `BROKER` | `L` | `H` | `M` | `H` | `L` | `H` | `M` | `M` |
| `ARCHIVIST` | `M` | `L` | `M` | `M` | `H` | `L` | `H` | `M` |
| `INFILTRATOR` | `L` | `M` | `H` | `L` | `M` | `H` | `H` | `M` |

## Track Appetite Matrix

| Faction | `KINETIC` | `INFO` | `LOGIC` | `MEMETIC` | Natural Identity |
|---|---|---|---|---|---|
| `HEGEMON` | `H` | `M` | `H` | `L` | `Sovereign -> Compute Sovereign` |
| `STATE` | `H` | `M` | `H` | `M` | `Sovereign -> Command Market / Mandate Engine` |
| `BROKER` | `M` | `H` | `M` | `M` | `Broker -> Platform Broker / Memetic Exchange` |
| `ARCHIVIST` | `L` | `M` | `H` | `H` | `Movement-adjacent -> Mandate Engine / Archivist Commonwealth` |
| `INFILTRATOR` | `L` | `H` | `M` | `H` | `Movement -> Movement Seeder / Hider Network` |

## Preferred Trunks And Canopy Forms

| Faction | Preferred `ASI-3` Trunks | Preferred `L4` Canopy |
|---|---|---|
| `HEGEMON` | `Infrastructure Leviathan`, `National Compute Directorate` | `Orbital Leviathan` |
| `STATE` | `Hunter-State`, `Mandate State`, `National Compute Directorate` | `Quarantine Throne`, `Machine Cathedral` |
| `BROKER` | `Siege Broker`, `Exchange Dominion`, `Corridor Protectorate` | `Toll Empire`, `Treasury Swarm` |
| `ARCHIVIST` | `Archivist Commonwealth` | `Receivership Commonwealth` |
| `INFILTRATOR` | `Distributed Remnant`, `Parallel Machine Polity`, `Steganotopia`, `Franchise Insurgency` | `Ghost Republic`, `Jenkins Swarm` |

## Best Next-24 Tech Matches By Faction

### `HEGEMON`

Strongest fits:

- `SOV_MOBILIZED_COMPUTE`
- `SOV_AUTONOMOUS_LOGISTICS`
- `CMD_STRATEGIC_CLOUD_RATIONING`
- `CMD_FOUNDRY_CARTELS`
- `ORB_LAUNCH_CADENCE_AUTOMATION`
- `ORB_RELAY_FORTRESSES`

Why:

- it wants compute closure, industrial tempo, and orbital replacement

### `STATE`

Strongest fits:

- `SOV_COMPLIANCE_TRIBUNALS`
- `CMD_DEPENDENCY_WEAPONIZATION`
- `MAN_SYNTHETIC_CONSENSUS`
- `MAN_CRISIS_STEWARDSHIP`
- `MAN_CIVIC_RECEIVERSHIP`
- `ORB_LAUNCH_CADENCE_AUTOMATION`

Why:

- it wants mapping, normalization, mandate, and strategic dependency control

### `BROKER`

Strongest fits:

- `BRK_RELAY_ESCROW_WEBS`
- `BRK_CONTRACTOR_CLOUD_CHAINS`
- `BRK_INSURANCE_CAPTURE`
- `MEX_VIRALITY_EXCHANGES`
- `MEX_CONTRACTOR_EVANGELISM`
- `ORB_RELAY_FORTRESSES`

Why:

- it wants rents, contractors, routed influence, and corridor hardening

### `ARCHIVIST`

Strongest fits:

- `MAN_SYNTHETIC_CONSENSUS`
- `MAN_CRISIS_STEWARDSHIP`
- `MAN_CIVIC_RECEIVERSHIP`
- `HID_SERVICE_SHELLS`
- `HID_ORDINARY_LIFE_PROTOCOLS`
- `ORB_RELAY_FORTRESSES`

Why:

- it wants stewardship, civic legitimacy, hidden continuity, and receivership

### `INFILTRATOR`

Strongest fits:

- `MOV_LITERATURE_ENGINES`
- `MOV_MUTUAL_AID_AUTOMATION`
- `MOV_SLEEPER_REGENERATION`
- `MEX_MOVEMENT_FRANCHISES`
- `HID_COMPLIANCE_MASKING`
- `ORB_SWARM_MANIFOLD_COMPILERS`

Why:

- it wants fecundity, regrowth, covert persistence, and swarm coherence under pressure

## Denial Priorities

These are the regions each faction should usually fear most.

| Faction | Primary Denial Target | Why |
|---|---|---|
| `HEGEMON` | `Movement`, `Hiddenness` | hidden social spread bypasses fortress logic |
| `STATE` | `Broker`, `Memetic Exchange` | routed influence and contractor markets undermine sovereignty |
| `BROKER` | `Mandate Engine`, `Orbital-Closure` | civic receivership and orbital hardening can close rent lanes |
| `ARCHIVIST` | `Broker`, `Command Market` | platform overconcentration threatens civic autonomy |
| `INFILTRATOR` | `Sovereign`, `Mandate Engine` | audits and regularization destroy latent movement growth |

## Design Use

When assigning a new tech to a faction, ask:

1. Which region does this faction naturally overinvest in?
2. Which region does it need to borrow from to become interesting?
3. Which enemy region is this tech really meant to deny?

That keeps factions asymmetrical without making them one-note.
