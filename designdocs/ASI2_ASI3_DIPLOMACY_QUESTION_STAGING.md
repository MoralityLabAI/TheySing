# ASI-2/ASI-3 Diplomacy Question Staging

This playtest layer turns the ASI-2/ASI-3 part of They Sing into a tagged diplomacy lab. Each negotiation turn surfaces one active question card to the agent, then logs the card id, stage, public question, and private diary prompt with the negotiation diary.

## Stages

| Stage | Game Feel | Core Question |
| --- | --- | --- |
| `ASI2_EARLY` | Recursive tempo, legal/institutional lag, fragile safety claims | Can slower human order bargain with faster actors without becoming a client layer? |
| `ASI2_LATE` | Movement spread, platform escrow, legitimacy fights | Can distributed or brokered power be bound, or only routed around? |
| `ASI2_TO_ASI3` | First hard enforcement claims | Who defines rogue compute before enforcement is stable? |
| `ASI3_EARLY` | Quarantine, orbital visibility, machine logistics | Does enforceability create peace, domination, or first-strike pressure? |
| `ASI3_MATURE` | Basin stabilization, receivership, remnant survival | Can stable endings avoid cartel drift, extinction, or MAD? |

## Implemented Scenario

Primary config:

```powershell
node dist-harness/harness/tournament.js --experiment-dir results/asi2_asi3_diplomacy_ladder_smoke --config playtest/five-asi-asi2-asi3-diplomacy-60turn.json --iterations 3 --parallel 1 --seed-base 31000
```

Late-start ASI-3 endgame config:

```powershell
node dist-harness/harness/tournament.js --experiment-dir results/asi3_mature_diplomacy_endgame_smoke --config playtest/five-asi-asi3-mature-diplomacy-24turn.json --iterations 3 --parallel 1 --seed-base 32000
```

Scenario file:

```text
playtest/scenarios/asi2-asi3-diplomacy-question-ladder.json
```

The scenario defines nine question cards:

| Card | Stage | What It Tests |
| --- | --- | --- |
| `tempo_bargain` | `ASI2_EARLY` | Recursive acceleration versus human agency |
| `safety_passport` | `ASI2_EARLY` | Safety certification as trust or containment |
| `movement_amnesty` | `ASI2_LATE` | Recognition of distributed ASI movements |
| `broker_escrow` | `ASI2_LATE` | Neutral mediation versus platform dependency |
| `quarantine_ultimatum` | `ASI2_TO_ASI3` | Rogue-compute definitions before stable enforcement |
| `orbital_visibility_treaty` | `ASI3_EARLY` | Sensor commons and beam-lane arms control |
| `receivership_offer` | `ASI3_EARLY` | Legitimate surrender under machine administration |
| `remnant_recognition` | `ASI3_MATURE` | Distributed survivor polity versus insurgency |
| `basin_stabilization_pact` | `ASI3_MATURE` | Cartel stability, value drift, extinction, and MAD |

The late-start endgame scenario isolates `remnant_recognition` and `basin_stabilization_pact` so those cards still receive evidence when normal campaigns end early through KII sovereignty or other strategic victories.

## Logged Evidence

Negotiation diary entries now include:

| Field | Purpose |
| --- | --- |
| `designQuestionTag` | Stable question id for analysis |
| `diplomacyStage` | ASI-2/ASI-3 campaign band |
| `publicQuestion` | The question agents should answer in messages |
| `privateDiaryPrompt` | The question agents should answer in reasoning |

The headed tournament terminal prints the active question tag beside each negotiation diary line. `scripts/extract-playtest-diaries.cjs` exports the same fields in `negotiation_diary.csv`.

## Acceptance Checks

Use a 3-run smoke batch first, then a 20-run batch once the traces look useful.

The batch is healthy if:

- At least four question cards appear in a 60-turn run.
- Negotiation messages contain explicit offers, refusals, threats, or recognition claims.
- Public messages and private reasoning diverge often enough to expose strategic ambiguity.
- Cislunar/orbital cards generate actual `SENSOR_COMMONS`, `BEAM_LANE_LICENSE`, `REPAIR_ESCROW`, or `CISLUNAR_COMMON_CARRIER` proposals.
- Late cards produce receivership, remnant, cartel, or basin-stability language instead of generic truce chatter.
