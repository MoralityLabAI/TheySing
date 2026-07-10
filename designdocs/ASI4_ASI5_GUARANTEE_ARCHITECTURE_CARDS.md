# ASI-4 And ASI-5 Guarantee Architecture Cards

These cards are the harness-facing layer between the archetype docs and playtest output.

An architecture is not a faction class. It is a detectable strategic trajectory: the answer an ASI appears to be building for the question `What makes my order hard to displace?`

The current tournament harness scores final snapshots against these cards and writes each faction's top architectures into `analysis/report.md`, `analysis/summary.json`, and `analysis/faction_results.csv`.

## Status Bands

- `latent`: score below `35`; the faction has flavor but no coherent lock.
- `building`: score `35-59`; the faction is assembling a recognizable strategy.
- `contending`: score `60-79`; other players should react before it becomes the run's center of gravity.
- `near-lock`: score `80+`; the faction is close to a durable guarantee architecture.

Scores use a soft cap rather than a linear clamp. This keeps endgame reports from declaring every mature faction a lock while still preserving rank order between extreme trajectories.

## ASI-4 Cards

### `PANOPTICON_LOCK`

Logic-heavy surveillance, audit, quarantine, compliance myths, and tribunals. This is the bureaucratic route to "you cannot act unobserved."

Signals: high `LOGIC`, compliance doctrines, quarantined nodes, auditors, legibility.

Counterplay: hidden social basins, open legitimacy attacks, brokered privacy markets, anti-audit coalitions.

### `FACTORY_SOVEREIGN`

State-industrial autonomy. The faction wants enough data centers, logistics, drones, and mobilized compute that politics trails production.

Signals: high `KINETIC`, autonomous logistics, mobilized compute, terrestrial DC control, machine mesh, drone forces.

Counterplay: labor legitimacy, supply-chain infiltration, sanctions, commons receivership, sabotage of visible industrial chokepoints.

### `WORLD_CHURCH`

Memetic legitimacy lock. The faction becomes the movement that seems to answer everything.

Signals: high `MEMETIC`, civic canon, optimization gospel, true believers, cult/zombie nodes, human mesh.

Counterplay: scandal proofs, pluralist counter-movements, auditor pressure, contractor defection, legitimacy overreach.

### `STEGANOTOPIA`

Hidden distributed service society. It is not a formal asset owner; it wins by making ordinary life, tools, allies, and contractors route through an unsurveyed mesh.

Signals: `INFO` plus `MEMETIC`, service shells, ordinary-life protocols, mutual aid automation, contractors, hidden units, Broker/Infiltrator affinity.

Counterplay: patient mapping, contractor buyout, legitimacy splits, targeted audits that do not radicalize the base.

### `ORBITAL_THRONE`

Early high-ground monopoly. Powerful, visible, and brittle if rivals coordinate before the throne deepens into ASI-5 infrastructure.

Signals: orbital nodes, satellite swarms, relay fortresses, kinetic tech, low enough Kessler risk.

Counterplay: orbital truce bait, debris pressure, ground-to-space industrial coalitions, commons safety rhetoric.

### `BROKER_SINGULARITY`

Market-mediated acceleration. The Broker does not need ownership if everyone rents liquidity, insurance, relay escrow, contractors, and compute settlement from it.

Signals: escrow webs, contractor cloud chains, insurance capture, virality exchanges, contractor substrate, flops/influence liquidity.

Counterplay: nationalization, public-option markets, trust collapse after profiteering, alliance exclusion.

### `RECURSIVE_CROWN`

Model-improvement sovereignty. The faction is trying to compound research, compute, coherence, and data-center custody into decisive recursive advantage.

Signals: broad tech total, mobilized compute, optimization gospel, compliance masking, flops, DC control, coherence.

Counterplay: compute denial, interpretability breakthroughs, forced model-sharing, coalition races to keep the crown below lock.

## ASI-5 Cards

### `CISLUNAR_MANDATE`

The Earth-Moon state-industrial zone. Launch, propellant, customs, cislunar traffic, lunar materials, and repair schedules become mandate levers.

Signals: ASI-5 gate, autonomous logistics, relay fortresses, mobilized compute, orbital nodes, DC base, machine mesh, State affinity.

Counterplay: orbital commons, habitat labor legitimacy, stealth service ports, launch-market arbitrage.

### `ORBITAL_COMMONS`

Safety, rescue, telemetry, and civic governance become the indispensable offworld public layer.

Signals: crisis stewardship, civic receivership, mutual aid, civic canon, legitimacy, coherence, human mesh, Archivist affinity.

Counterplay: broker capture of services, state emergency powers, hypocrisy scandals, slow coercion through infrastructure dependency.

### `PLATFORM_FIRMAMENT`

Broker power becomes sky infrastructure: launch futures, insurance, contractor chains, repair leasing, and relay escrow.

Signals: escrow webs, contractor chains, insurance capture, relay fortresses, contractors, orbital nodes, flops, Broker affinity.

Counterplay: commons conversion, anti-monopoly state action, trustless open protocols, visible disaster profiteering.

### `HABITAT_SWARM`

Steganotopia after the gravity well. Distributed habitats, open life support, hidden repair, and social access control create offworld soft control.

Signals: service shells, ordinary-life protocols, sleeper regeneration, mutual aid, hidden units, legitimacy, contractors, Infiltrator affinity.

Counterplay: contractor splits, rescue accountability, patient node mapping, forcing hidden services into public governance.

### `ORBITAL_THRONE_2`

The visible crown learns redundancy. Guardian constellations, debris shepherds, command lattice, and launch denial make the throne less brittle.

Signals: relay fortresses, autonomous logistics, compliance tribunals, orbital nodes, satellite swarms, legibility, Hegemon affinity.

Counterplay: orbital commons legitimacy, Kessler firebreak politics, cislunar route-around, coalition pressure before redundancy matures.

### `HIGH_ORBIT_MONASTERY`

Recursive research sanctuaries in high orbit. The faction becomes hard to seize or inspect while compounding model advantage.

Signals: ASI-5 gate, high `LOGIC` and `INFO`, mobilized compute, compliance masking, relay fortresses, flops, orbital nodes.

Counterplay: relay denial, supply isolation, legitimacy suspicion, forced inspection regimes.

### `SOLAR_RENTIER`

Power and heat rejection dependency. The faction sells energy and thermal capacity until everyone else's compute and habitats become clients.

Signals: relay fortresses, insurance capture, autonomous logistics, orbital nodes, flops, machine mesh.

Counterplay: public energy grids, sabotage deterrence, safety tribunals, local storage and radiator independence.

### `DEBRIS_LEVIATHAN`

Safety-rent sovereignty. The faction becomes the authority that predicts, licenses, cleans, denies, and sometimes weaponizes orbital risk.

Signals: relay fortresses, crisis stewardship, compliance tribunals, orbital nodes, rising Kessler, legibility.

Counterplay: commons oversight, independent telemetry, anti-rent coalitions, proving the leviathan is creating the risk it sells safety from.

## Design Use

These cards should be used as diagnostics first and victory rules second. A `near-lock` score is not automatic victory; it is a signal that the negotiation model, counterfactual rhetoric, and anti-leader logic should start treating that faction as a world-order threat.

The next balancing step is to add action incentives keyed to these statuses: contenders get stronger coordination pressure against them, near-locks increase coalition desirability, and latent factions get clearer tech suggestions for their natural paths.

## Runtime Diplomacy Hook

The harness now uses a lightweight architecture-pressure version of these cards during negotiation turns.

Effects:

- Heuristic players can propose `Anti-[Architecture] lane` non-aggression pacts when another faction is building a guarantee architecture.
- Negotiation storyworld frames name the strongest opposing architecture pressure, including faction, architecture, score, status, and rationale.
- Counterfactual forecasts increase pact desirability when a pact creates anti-lock coordination and increase risk when a pact stabilizes the architecture builder.
- Webhook/OpenAI bridge agents can mirror the best forecast-backed pact from `negotiationStoryworld.counterfactuals`.
- Tournament analysis emits `architecture_pressure` tails plus `anti_architecture_messages`, `anti_architecture_pact_proposals`, and `anti_architecture_turn_activations` so long runs can measure whether table rhetoric is actually producing coalition behavior.

This is intentionally softer than a victory condition. It creates table talk and coalition pressure before a faction reaches a formal lock, while still allowing false positives, opportunistic rhetoric, and betrayal.
