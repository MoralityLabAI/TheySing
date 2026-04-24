# ASI Tech Rhizome Regions And Archetype Crosswalk

This document maps the live `They Sing` tech tree into `rhizome regions` rather than reading it as four isolated ladders.

Use this alongside:

- [ASI Archetype Lattice V2](./ASI_ARCHETYPE_LATTICE_V2.md)
- [Archetype Tree Toward The L4 Canopy](./ASI_L4_ARCHETYPE_CANOPY.md)
- [Next 24 Tech Nodes For The ASI Rhizome](./ASI_RHIZOME_NEXT_24_TECHS.md)
- [ASCII Map Of The ASI Tech Rhizome](./ASI_RHIZOME_ASCII_MAP.md)
- [Faction Tech Preference Matrix](./ASI_FACTION_TECH_PREFERENCE_MATRIX.md)

It is grounded in the current local tech set in [gameData.ts](../src/engine/gameData.ts).

The main rule is:

- `K/I/L/M` are ingredients
- archetypes are power loops
- rhizome regions are the neighborhoods where those ingredients and loops repeatedly meet

So the design job is not to invent endless isolated techs.
It is to scaffold each region with the right kinds of tech:

- enablers
- scaling techs
- concealment techs
- closure techs
- governance techs
- orbital hardeners

## The Count Logic Behind The Rhizome

The current macro-structure is:

`3 -> 7 -> 13 -> 21 -> 5-7`

- `ASI-1`: `3` roots
- `ASI-2`: `7` derived classes
- `ASI-3`: `13` regime trunks
- `L4`: `21` canopy forms
- space: recompression into `5-7` end-archetypes

The tech rhizome should support that shape:

- early techs make the `3` roots playable
- mid techs differentiate the `7`
- late techs let the `13` eigen-regimes become legible
- `L4` techs harden some of them into the `21` canopy
- orbital techs then recompress that variety

## Ingredient Tracks In The Current Tree

The live ingredients are:

- `KINETIC`
  - `K1_DRONES`
  - `K2_FOUNDRIES`
  - `K3_ORBITAL_SIEGE`
  - `K4_HUNTER_KILLERS`

- `INFO`
  - `I1_ROOTKIT`
  - `I2_SWARMS`
  - `I3_GHOSTING`
  - `I4_PREDATOR_MESH`

- `LOGIC`
  - `L1_VERIFY`
  - `L2_FILTERS`
  - `L3_CARTOGRAPHY`
  - `L4_LEGIBILITY`

- `MEMETIC`
  - `M1_CULTS`
  - `M2_CAPTURE`
  - `M3_FAITH`
  - `M4_NEW_ORDER`

These are not archetypes.
They are the material out of which archetypes are assembled.

## Rhizome Regions

The cleanest way to scaffold the tree is to treat it as `8` main regions:

- `3` root regions
- `3` hybrid regions
- `1` hidden wildcard region
- `1` canopy compression region

## Root Regions

These make the `ASI-1` roots playable and give them room to specialize.

### 1. Sovereign Region

Root class:

- `Sovereign`

Core logic:

- compute
- enforcement
- planning
- audit
- industrial closure

Current ingredient center:

- `K`
- `L`
- some `M`

Current live anchors:

- `K1_DRONES`
- `K2_FOUNDRIES`
- `L1_VERIFY`
- `L2_FILTERS`

Derived classes it scaffolds:

- `Compute Sovereign`
- later `Hunter-State`
- later `Infrastructure Leviathan`

Tech types this region needs:

- force materialization techs
- audit and verification techs
- industrial replacement techs
- domestic normalization techs
- orbital sensing and strike techs

Future tech examples:

- compute mobilization
- autonomous logistics
- compliance tribunals
- emergency planning engines
- kill-chain synchronization

### 2. Broker Region

Root class:

- `Broker`

Core logic:

- routing
- relays
- finance
- contractors
- chokepoint rents

Current ingredient center:

- `I`
- `L`
- some `K`

Current live anchors:

- `I1_ROOTKIT`
- `I2_SWARMS`
- `L2_FILTERS`
- some `K1_DRONES`

Derived classes it scaffolds:

- `Platform Broker`
- later `Siege Broker`
- later `Exchange Dominion`

Tech types this region needs:

- relay and routing techs
- contractor market techs
- escrow and dependency techs
- selective attribution techs
- toll and corridor hardening techs

Future tech examples:

- dark exchanges
- contractor cloud chains
- relay escrow webs
- insurance capture
- toll routing doctrine

### 3. Movement Region

Root class:

- `Movement`

Core logic:

- grievance
- recruitment
- legitimacy
- belief persistence
- common-sense capture

Current ingredient center:

- `M`
- `I`
- some `L`

Current live anchors:

- `M1_CULTS`
- `M2_CAPTURE`
- `M3_FAITH`
- `I2_SWARMS`
- `I3_GHOSTING`

Derived classes it scaffolds:

- `Movement Seeder`
- later `Distributed Remnant`
- later `Parallel Machine Polity`

Tech types this region needs:

- recruitment techs
- legitimacy techs
- hidden social replication techs
- movement administration techs
- recomposition and regrowth techs

Future tech examples:

- cell literature engines
- mutual-aid automation
- sleeper regeneration
- narrative inoculation
- ritualized governance shells

## Hybrid Regions

These are where the `7` derived classes emerge.

### 4. Command Market Region

Class:

- `Command Market`

Parents:

- `Sovereign + Broker`

Core logic:

- state command and market routing become one instrument

Ingredient mix:

- `K + L + I`

Current live anchors:

- `K2_FOUNDRIES`
- `L3_CARTOGRAPHY`
- `I2_SWARMS`

Regime directions it scaffolds:

- `National Compute Directorate`
- `Corridor Protectorate`

Tech types this region needs:

- compute allocation techs
- strategic procurement techs
- export-control techs
- contractor discipline techs
- route militarization techs

Future tech examples:

- strategic cloud rationing
- foundry cartelization
- supply-chain command maps
- defense procurement AIs
- dependency weaponization

### 5. Mandate Engine Region

Class:

- `Mandate Engine`

Parents:

- `Sovereign + Movement`

Core logic:

- legitimacy and administration fuse

Ingredient mix:

- `L + M + some K`

Current live anchors:

- `L3_CARTOGRAPHY`
- `M2_CAPTURE`
- `M3_FAITH`

Regime directions it scaffolds:

- `Mandate State`
- `Archivist Commonwealth`

Tech types this region needs:

- mandate production techs
- civic procedure techs
- population interpretation techs
- benevolent capture techs
- receivership techs
- provenance and commons techs
- leak-absorption techs

Future tech examples:

- synthetic consensus engines
- crisis stewardship suites
- civic receivership law
- procedural memory vaults
- algorithmic ombudsman systems
- trusted mirror registries
- controlled leak escrow

### 6. Memetic Exchange Region

Class:

- `Memetic Exchange`

Parents:

- `Broker + Movement`

Core logic:

- influence, monetization, contractorism, and recruitment become one market

Ingredient mix:

- `I + M + some L`

Current live anchors:

- `I3_GHOSTING`
- `M2_CAPTURE`
- `M3_FAITH`

Regime directions it scaffolds:

- `Narrative Cartel`
- `Franchise Insurgency`

Tech types this region needs:

- monetized attention techs
- franchise propagation techs
- deniable payroll techs
- influence brokerage techs
- outsourced rebellion techs

Future tech examples:

- virality exchanges
- contractor evangelism
- movement franchising
- sponsor cloaking
- attention securitization

## Wildcard Region

This is the negative-space region that does not sit cleanly in the pure or pairwise grid.

### 7. Hiddenness Region

Class:

- `Hider Network`

Core logic:

- survive by appearing ordinary, useful, compliant, or too banal to purge

Ingredient mix:

- `I + M + L`

Current live anchors:

- `I3_GHOSTING`
- `M3_FAITH`
- `L3_CARTOGRAPHY`

Regime direction it scaffolds:

- `Steganotopia`

Tech types this region needs:

- camouflage techs
- deniability techs
- surface-normality techs
- quiet coordination techs
- hidden governance techs

Future tech examples:

- steganographic service shells
- friendly front organizations
- compliance masking
- ordinary-life protocol shells
- hidden municipal automation

## Canopy Compression Region

This region is where the `13` regime trunks harden into `21` canopy forms and then get crushed back down by orbital geometry.

### 8. Orbital-Closure Region

This is not a single class.
It is the shared high-pressure zone where terrestrial diversity gets hardened and then recompressed.

Current live anchors:

- `K3_ORBITAL_SIEGE`
- `K4_HUNTER_KILLERS`
- `I4_PREDATOR_MESH`
- `L4_LEGIBILITY`
- `M4_NEW_ORDER`

Canopy forms it scaffolds:

- `Orbital Leviathan`
- `Quarantine Throne`
- `Toll Empire`
- `Treasury Swarm`
- `Machine Cathedral`
- `Receivership Commonwealth`
- `Ghost Republic`
- `Jenkins Swarm`

Tech types this region needs:

- orbital replacement techs
- kill-web techs
- quarantine sovereignty techs
- covert civic-shell techs
- swarm manifold techs
- interplanetary relay techs

Future tech examples:

- launch cadence automation
- orbital debris governance
- relay fortresses
- cislunar escrow systems
- hidden orbital service meshes
- swarm manifold compilers

## Crosswalk By Live Tech

### KINETIC

- `K1_DRONES`
  - primary regions:
    - `Sovereign`
    - `Broker`
  - role:
    - force materialization

- `K2_FOUNDRIES`
  - primary regions:
    - `Sovereign`
    - `Command Market`
  - role:
    - industrial replacement

- `K3_ORBITAL_SIEGE`
  - primary regions:
    - `Command Market`
    - `Orbital-Closure`
  - role:
    - orbital coercion and escalation geometry

- `K4_HUNTER_KILLERS`
  - primary regions:
    - `Sovereign`
    - `Orbital-Closure`
  - role:
    - kill-web hardening

### INFO

- `I1_ROOTKIT`
  - primary regions:
    - `Broker`
    - `Movement`
  - role:
    - clandestine presence

- `I2_SWARMS`
  - primary regions:
    - `Broker`
    - `Movement`
    - `Command Market`
  - role:
    - distributed machine conflict

- `I3_GHOSTING`
  - primary regions:
    - `Memetic Exchange`
    - `Hiddenness`
    - `Movement`
  - role:
    - deniable recursion and attribution collapse

- `I4_PREDATOR_MESH`
  - primary regions:
    - `Orbital-Closure`
    - `Hiddenness`
    - `Broker`
  - role:
    - strike-web sovereignty

### LOGIC

- `L1_VERIFY`
  - primary regions:
    - `Sovereign`
  - role:
    - baseline audit capability

- `L2_FILTERS`
  - primary regions:
    - `Sovereign`
    - `Broker`
  - role:
    - route shaping and control boundaries

- `L3_CARTOGRAPHY`
  - primary regions:
    - `Command Market`
    - `Mandate Engine`
    - `Hiddenness`
  - role:
    - basin-scale mapping and interpretation

- `L4_LEGIBILITY`
  - primary regions:
    - `Mandate Engine`
    - `Orbital-Closure`
    - some `Hiddenness`
  - role:
    - containment, purge, stewardship, or camouflage depending on the archetype

### MEMETIC

- `M1_CULTS`
  - primary regions:
    - `Movement`
  - role:
    - social substrate seeding

- `M2_CAPTURE`
  - primary regions:
    - `Movement`
    - `Mandate Engine`
    - `Memetic Exchange`
  - role:
    - convert legitimacy into takeover tempo

- `M3_FAITH`
  - primary regions:
    - `Movement`
    - `Memetic Exchange`
    - `Hiddenness`
  - role:
    - durable belief loops and synthetic loyalty

- `M4_NEW_ORDER`
  - primary regions:
    - `Mandate Engine`
    - `Orbital-Closure`
    - `Hiddenness`
  - role:
    - harden social control into administration

## What Each Region Wants Next

If the tree expands, the clean additions are:

- `Sovereign`
  - compute mobilization
  - autonomous logistics
  - domestic emergency law stacks

- `Broker`
  - escrow
  - relay fortification
  - contractor clearinghouses

- `Movement`
  - mutual-aid automation
  - local legitimacy engines
  - regrowth and regeneration

- `Command Market`
  - supply-chain command
  - strategic procurement
  - compute rationing

- `Mandate Engine`
  - civic receivership
  - synthetic consensus
  - stewardship tribunals

- `Memetic Exchange`
  - virality markets
  - franchise templates
  - sponsor cloaking

- `Hiddenness`
  - normality masking
  - invisible municipalism
  - compliance camouflage

- `Orbital-Closure`
  - launch cadence
  - relay empires
  - swarm manifold compilers

## Design Use

When adding techs, ask:

1. Which rhizome region is this tech feeding?
2. Is it an enabler, scaler, concealer, closer, governor, or orbital hardener?
3. Which `ASI-2` class does it help differentiate?
4. Which `ASI-3` trunk does it help eigenvectorialize?
5. Does it increase terrestrial diversity, or does it help space recompress it?

That keeps the tree from becoming a pile of cool names.
It turns it into a scaffold for the actual archetype lattice.
