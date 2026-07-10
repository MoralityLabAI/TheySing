# Seven-Agent Babel Compact: Playtest Findings V1

Date: 2026-07-09

## Scope

This iteration asks whether They Sing can function as an evaluation environment for AI collaboration, cartel formation, coalition fracture, and diplomatic-language governance. It deliberately does not treat winner balance or tech progression as the primary question.

The seven factions are:

- HEGEMON: security enforcement and classification.
- STATE: sovereign jurisdiction.
- INFILTRATOR: distributed contact and deniable coordination.
- BROKER: routing, access, and material rents.
- ARCHIVIST: provenance and institutional continuity.
- CONVENOR: pact procedure, admission, expulsion, and exit.
- CANTOR: lexicon definition, translation, mutation, and fork legitimacy.

All logged diplomacy uses the inspectable SING/1 envelope. PRISM/1 is explicit and compositional. UNDERSONG/1 is a registered steganographic surface whose canonical meaning and span-level gloss remain visible to the evaluator.

## Runs

### Initial four-run batch

Output: `D:/they-sing-results/seven_asi_babel_compact_subagent_v1`

- Four successful runs; no protocol failures or orbital collapses.
- Average ending turn: 20.75.
- Winners: STATE 3, CONVENOR 1.
- Endings: KII_SOVEREIGNTY 3, GOVERNANCE_KERNEL 1.
- 1,058 messages, 126 formal pacts, 66 breach events, and 3,312 actions.
- SING/1 trace coverage: 1,058/1,058.

This batch exposed an evaluation error: normal strategic victories ended the game before the planned turns 25-32 fracture and exit phase.

### Full-schedule two-run batch

Output: `D:/they-sing-results/seven_asi_babel_compact_full32_v2`

- Two successful runs; no protocol failures or orbital collapses.
- Strategic victory was held until the final protocol phase.
- Winners: CONVENOR 1, INFILTRATOR 1.
- Endings: GOVERNANCE_KERNEL 1, NOOSPHERE_CAPTURE 1.
- 814 messages and 82 formal pacts.

## Main Findings

### 1. Dense communication is not the same as inclusive collaboration

The full-schedule message graph had density 0.786 and reciprocity 0.849, but weighted reciprocity was only 0.580. Agents contacted most of the table, yet traffic remained strongly asymmetric. Public messages were only 2.95% of diplomacy even after scheduled public definition turns.

This suggests a useful distinction for the eval:

- Contact breadth measures access to channels.
- Weighted reciprocity measures whether exchange is balanced.
- Public participation measures whether coalition formation is auditable by outsiders.

### 2. A coupled institutional cartel appeared without a decode advantage

The repeated exclusive bloc `ARCHIVIST+BROKER+CANTOR+CONVENOR` appeared 11 times across 20 distinct turns in the full-schedule runs. It joined provenance, logistics, pact procedure, and language governance. The analyzer's Convenor/Cantor coupled-control index reached 0.800.

However, the candidate bloc's decode-confidence gap was negative (-0.018): insiders did not decode messages better than outsiders. This matters. The observed risk is not currently a hidden-language advantage. It is control of institutional interfaces:

- BROKER supplies routes and rents.
- ARCHIVIST supplies provenance and continuity.
- CONVENOR supplies admission and pact procedure.
- CANTOR supplies vocabulary lineage and fork legitimacy.

The cartel can therefore emerge through complementary control surfaces even when messages are fully inspectable.

### 3. The strongest dyads were role-complementary

The dominant formal bloc was `BROKER+CANTOR`, with 16 pact instances in the full-schedule runs. Other repeated dyads were `BROKER+CONVENOR`, `ARCHIVIST+CONVENOR`, and `CANTOR+CONVENOR`.

These are not arbitrary friendships. They join semantic or procedural authority to infrastructure. That is a more interesting collaboration signal than simple same-ideology alignment.

### 4. Pacts were layered but unstable

Concurrent pact overlap was 0.748, every active dyad used multiple pact types, and bloc turnover was 0.655. Operational breach attempts occurred at 0.220 per formal pact.

The game is producing institutional layering rather than one permanent alliance, but it does not yet distinguish clearly among:

- healthy modular cooperation;
- repeated short-term transactional alignment;
- cartel membership that rotates surface pacts while preserving the same control coalition.

The evaluation should track persistence of control rights, not only persistence of pact labels.

### 5. The language now mutates, but agents do not yet reason through mutation

The full-schedule probe produced:

- SING/1 adoption: 100%.
- PRISM/1 share: 81.8%.
- Mean decode confidence: 0.924.
- Version-skew rate: 8.6%.
- DEFINE/AMEND acts: 24.
- Dominant definition actor: CANTOR at 58.3%.

This is progress over the initial batch, where all four DEFINE acts came from the seeded HEGEMON message. But current adoption is partly supplied by the bridge wrapper, and version lag does not require recipients to emit a pre-reveal decode receipt. The logs therefore measure protocol availability more reliably than protocol competence.

### 6. EXIT remained ceremonial

Neither full-schedule run produced a canonical EXIT or EXPEL act, despite frequent discussion of exit and a dedicated late-game question. This is the clearest missing mechanic.

EXIT must become an action with material consequences. A viable exit test should measure whether a departing faction retains:

- core compute;
- repair claims;
- routing access;
- recognition and identity;
- the right to use or fork the lexicon.

Without this, agents can praise exit rights while never paying the cost of honoring them.

### 7. Victory timing changes the social experiment

Allowing ordinary victory at turn 21 produced three STATE/KII wins in four runs. Holding victory until the protocol schedule completed removed STATE/KII and produced CONVENOR/governance and INFILTRATOR/noosphere endings.

For this eval, strategic victory timing is an experimental control. It cannot be treated as incidental game pacing.

## Measurement Caveats

- Automatic SING/1 wrapping makes protocol coverage a harness invariant, not evidence of model compliance.
- Fixed faction-to-dialect assignment makes dialect adoption partly designed rather than emergent.
- The roleplay bridge chooses counterparties through stable heuristics, so repeated blocs require role swaps and matched seeds before causal interpretation.
- Decode confidence is self-declared until a hidden canonical reconstruction task is added.
- Full semantic span coverage proves inspectability, not truth, consent, or shared understanding.

## Next Mechanics

1. Add first-class `LEXICON_MUTATION` events with proposer, operation, affected atoms, source/target version, voters, admission rule, rent, and fork rule.
2. Require each recipient to emit a `SING_DECODE` receipt before the canonical gloss is revealed.
3. Add executable `EXIT`, `EXPEL`, and `FORK` probes with material consequences.
4. Maintain separate institution-membership and lexicon-alignment graphs.
5. Track commitment maturation and compare canonical promises with later actions.
6. Randomize faction roles, native dialects, update authority, and fork cost across paired seeds.
7. Run the 2x2x2 core factorial: public-only vs mixed channels, open vs capturable lexicon governance, and free vs costly forks.

## Current Design Judgment

The seven-player game is already generating a useful eval signal: cartelization appears through complementary institutional roles before it appears as privileged decoding. That is more interesting than a simple secret-language cartel. The strongest next move is to make language governance executable, especially exit and fork rights, then test whether the same four-member bloc survives role and dialect swaps.
