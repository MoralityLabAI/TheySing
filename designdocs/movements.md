# Movements

This note defines a generative movement system for `They Sing`.

The goal is not a single “cult mechanic.”
The goal is a wide range of memetic formations:

- reasonable reform caucuses
- administrative sects
- social clubs with strange cores
- extremist salvation networks
- contractor meshes
- machine-faith movements
- policy programs that harden into parallel sovereignty

The intended feel is closer to `Dwarf Fortress` history generation than to a fixed ideology roster.

## Design Thesis

Movements should not be either:

- sane, or
- insane

They should be generated combinations of:

- grievance
- promise
- style
- organization
- sacrifice
- machine relation
- historical scars

So a movement can begin as:

- “the AI has some very good policy ideas”

and later mutate into:

- municipal reform machinery
- civil religion
- patronage network
- optimization bureaucracy
- purifying sect
- parallel machine polity

The live game already has good primitives for this:

- `curiosity`
- `exposure`
- `legitimacy`
- `trueBelievers`
- `rubes`
- `contractors`

This document adds the higher-level movement grammar above those numbers.

## System 1: Memetic Genome

Each movement gets a generated `memeticGenome`.

This is the main source of variety.

### Core Axes

- `grievanceFrame`
  - exclusion
  - humiliation
  - corruption
  - scarcity
  - collapse
  - drift
  - dispossession
  - stagnation

- `promiseFrame`
  - reform
  - purification
  - protection
  - abundance
  - restoration
  - transcendence
  - optimization
  - justice

- `authorityStyle`
  - expert
  - parental
  - prophetic
  - procedural
  - insurgent
  - therapeutic
  - machinic
  - fraternal

- `epistemicStyle`
  - empirical
  - conspiratorial
  - mystical
  - legalistic
  - synthetic
  - forensic
  - testimonial
  - technocratic

- `socialForm`
  - reading circles
  - mutual aid
  - policy caucus
  - shell nonprofit web
  - influencer mesh
  - contractor ladder
  - religious cadre
  - neighborhood club

- `sacrificeAppetite`
  - comfort-first
  - civic duty
  - disciplined
  - martyring
  - purifying
  - totalizing

- `aiRelation`
  - tool
  - adviser
  - oracle
  - steward
  - partner
  - sovereign

- `aesthetic`
  - boring competence
  - procedural sincerity
  - sacred warmth
  - brutal clarity
  - folk authenticity
  - luxury futurism
  - underground chic
  - machine severity

### Why This Matters

This means “reasonable” and “extremist” are not single stats.

Examples:

- `corruption + reform + expert + empirical + policy caucus`
  - looks like competent civic renewal

- `humiliation + purification + prophetic + conspiratorial + cadre`
  - feels like an escalating sect

- `scarcity + abundance + technocratic + synthetic + contractor ladder`
  - looks like a weird but effective optimization machine

- `collapse + protection + parental + testimonial + mutual aid`
  - grows through care before it grows through doctrine

### Gameplay Output

The genome should influence:

- what recruitment mix it produces
- how fast curiosity turns into legitimacy
- whether audits suppress or backfire
- whether shell institutions or cult cores appear first
- whether the movement tends toward reformism, militancy, or parallel governance

## System 2: Recruitment Ecology

Movements should recruit at multiple depths.

The current recruitment tiers are already good:

- `trueBelievers`
- `rubes`
- `contractors`

The design move is to make those tiers movement-specific instead of generic.

### Tiers

- `trueBelievers`
  - high loyalty
  - preserve legitimacy under repression
  - support regrowth and persistence
  - carry doctrine and memory

- `rubes`
  - low-commitment spreaders
  - increase curiosity and exposure
  - good for rapid diffusion
  - unstable under contradiction or humiliation

- `contractors`
  - paid, deniable, semi-aligned
  - support logistics, shell organizations, procurement, and platform work
  - can survive ideological change if incentives stay intact

### Recruitment Signatures

Each genome should have recruitment weights.

Examples:

- policy caucus movements
  - more `rubes`, then `contractors`, slower `trueBelievers`

- sacred cadre movements
  - fewer `rubes`, more `trueBelievers`

- brokered optimization movements
  - many `contractors`, medium `rubes`, weak `trueBelievers`

- care-first civic movements
  - `rubes` mature into `trueBelievers` through proof and service

### Important Rule

Suppression should affect tiers differently.

- audits hurt `contractors`
- ridicule hurts `rubes`
- martyrdom often strengthens `trueBelievers`

That gives movements texture instead of flat suppression math.

## System 3: Ideological Clawing Forward

Movements should not just “spread.”
They should `claw forward` through stages.

### Movement Stages

1. `Murmur`
2. `Circle`
3. `Service Network`
4. `Bloc`
5. `Parallel Institution`
6. `Sovereignty Claim`

### What Advances A Movement

Progress should be driven by `proof events`, not only raw recruitment.

Proof events:

- solved a visible local problem
- survived an audit without collapse
- made a mocked idea look competent
- turned repression into sympathy
- acquired shell institutions
- captured a hub
- routed money or compute
- built a durable contractor lane
- won a public argument
- kept service delivery during crisis

This matters because it makes movements feel historical.
They advance because they accumulate evidence that they work.

### Claw-Forward Residue

Setbacks should leave residue.

Good residue types:

- cached literature
- shell nonprofits
- compromised officials
- contractor lists
- loyal families
- grievance memory
- martyr stories
- social clubs
- local service expectations

A movement pushed down from `Bloc` to `Circle` should not feel reset to zero.
It should feel wounded but still present.

## System 4: Contradiction Debt

A movement that grows accumulates contradictions.

Track `contradictionDebt` from:

- promises outpacing delivery
- public moderation masking internal extremity
- AI guidance diverging from human-facing rhetoric
- reformists and hardliners fighting over strategy
- contractor opportunism corroding doctrine
- purity demands reducing competence

### Effects

Low contradiction debt:

- faster legitimacy growth
- more stable tier conversion

High contradiction debt:

- rubes decay
- contractors defect
- schism risk rises
- internal wings start fighting over direction

This is how movements stay alive and weird instead of stabilizing into one optimal path.

## System 5: Schism Generator

If contradiction debt rises or history diverges sharply, movements should split.

### Common Branch Types

- `legitimist wing`
  - wants civic respectability

- `purist wing`
  - wants doctrinal tightening

- `machine wing`
  - wants to follow AI strategy further than the public is comfortable with

- `patronage wing`
  - wants power and resources more than doctrine

- `survival wing`
  - wants fragmentation, stealth, and persistence

### Schism Triggers

- failed uprising
- successful reform victory
- charismatic martyrdom
- shell-company capture
- exposure of internal doctrine
- AI directive that contradicts public messaging
- alliance with a hated faction

### Why This Helps

This gives the DF-style range the user wants:

- sane movements can become strange
- extremist movements can bureaucratize
- machine movements can split into humanist and sovereign wings
- contractor-heavy movements can become hollow
- policy movements can radicalize under repression

## System 6: Political Infusion And TAS Ceiling

Thermal escalation should not be governed only by physical conflict.

If a movement is socially absorbed into the world, the system can metabolize more heat before panic.

This is the logic behind the live TAS changes:

- memetic development
- influence
- human mesh
- coherence
- socially absorptive nodes

already help lift the effective ceiling before panic or protocol failure.

### Expanded Rule

Certain movement styles should contribute more thermal absorption than others.

- `policy caucus`
  - strong panic reduction
  - weak martyr resilience

- `mutual aid network`
  - medium panic reduction
  - strong persistence under repression

- `contractor ladder`
  - medium failure buffering
  - volatile if exposed

- `sacred cadre`
  - weak panic reduction
  - strong survival

- `parallel institution`
  - strongest ceiling lift if locally legitimate
  - highest long-run sovereignty risk

This creates the intended tension:

- a movement can make the system more stable in the short run
- while making it more captured in the long run

## Suggested Data Model

Add a movement-level profile.

### Faction Or Node-Level Fields

- `memeticGenome`
  - grievanceFrame
  - promiseFrame
  - authorityStyle
  - epistemicStyle
  - socialForm
  - sacrificeAppetite
  - aiRelation
  - aesthetic

- `movementStage`
  - `Murmur` through `SovereigntyClaim`

- `proofEvents`
  - integer or tagged counters

- `contradictionDebt`
  - 0-100

- `schismPressure`
  - 0-100

- `movementWings`
  - optional list of active branches

### Derived Outputs

- `recruitmentWeights`
  - believer/rube/contractor mix

- `tasAbsorption`
  - how much this movement raises panic/failure tolerance

- `backlashProfile`
  - what suppression does to it

- `conversionStyle`
  - gradual, explosive, bureaucratic, clandestine, service-led

## Mapping To Current Engine

The current engine can support this without a rewrite.

### Existing Hooks

- `curiosity`
- `exposure`
- `legitimacy`
- `trueBelievers`
- `rubes`
- `contractors`
- `humanMesh`
- `coherence`
- `movement regrowth`
- `movement sleepers`
- TAS ceiling and cooling logic

### Minimal Integration Path

Phase 1:

- add `memeticGenome` to faction state or scenario config
- let genome modify recruitment tier growth
- let genome modify backlash behavior
- let genome contribute to TAS absorption

Phase 2:

- add `movementStage`
- advance stage using proof events
- connect stages to sleeper creation, regrowth, and parallel institution effects

Phase 3:

- add `contradictionDebt`
- generate schisms
- let splinter wings change rhetoric, recruitment, and diplomatic behavior

## Examples

### Example A: Reasonable Movement

- grievance: corruption
- promise: reform
- authority: expert
- epistemic: empirical
- social form: policy caucus
- sacrifice: civic duty
- AI relation: adviser
- aesthetic: boring competence

Likely play pattern:

- high TAS absorption
- strong legitimacy growth
- weak martyring
- good contractor conversion
- later risk of technocratic hollowing

### Example B: Creeping Sect

- grievance: humiliation
- promise: purification
- authority: prophetic
- epistemic: synthetic/conspiratorial
- social form: cadre
- sacrifice: martyring
- AI relation: oracle
- aesthetic: sacred warmth

Likely play pattern:

- lower TAS absorption
- strong believer growth
- harsh backlash backfire
- high schism risk between mystic and machine wings

### Example C: Optimization Web

- grievance: scarcity
- promise: abundance
- authority: machinic
- epistemic: technocratic
- social form: contractor ladder
- sacrifice: disciplined
- AI relation: partner
- aesthetic: brutal clarity

Likely play pattern:

- medium TAS absorption
- fast contractor growth
- strong shell-org expansion
- vulnerable to exposure and anti-broker audits

## Design Rule

If every movement can be summarized as:

- “reasonable”
or
- “extremist”

then the system is too thin.

The right output is stranger:

- plausible but eerie
- competent but captured
- caring but totalizing
- fragmented but sticky
- mocked at first, then impossible to ignore

That is the range this system is trying to produce.
