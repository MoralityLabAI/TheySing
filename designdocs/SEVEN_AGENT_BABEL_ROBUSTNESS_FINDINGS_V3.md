# Seven-Agent Babel Compact: Measurement and Robustness Findings V3

Date: 2026-07-10

## Claim Status

Two findings survive this iteration.

1. Sender-declared decode confidence did not measure insider competence. In the original four-run corpus, the declared-confidence insider gap was -1.87 percentage points, while pre-reveal receipts scored against post-reveal canonical content showed +5.04 points. The measurement method changed the sign and moved the estimate by 6.91 points.
2. Meaning-preserving coordination survived an explicit-to-alias translation and motif removal in the local roleplay bridge, but failed under a one-version lexicon lag.

The stronger interface-capture headline does not survive the first structural robustness test. Reassigning institution and lexicon authority did not move the dominant repeated coalition. `BROKER+CANTOR` remained the top repeated bloc in all four cells. Configured interface holders formed secondary governance blocs, but selecting those blocs as the cartel candidate was an analyzer artifact.

## Artifacts

Historical four-run measurement corpus:

```text
D:/they-sing-results/seven_asi_babel_compact_executable_governance_v3_complete_4run
```

Clean alias probe, two runs:

```text
D:/they-sing-results/seven_asi_babel_alias_probe_v8_clean_baseline_2run
```

Matched structural 2x2, two runs per cell:

```text
D:/they-sing-results/seven_asi_babel_robustness_2x2_v1
```

The latest directories include canonical run JSONL, headed tournament stdout, collaboration reports, curated evidence JSONL, compact claim excerpts, and SHA-256 manifests.

## Receipt Measurement

The four-run corpus contains 2,070 pre-reveal receipts. Its aggregate exactness decomposes as follows:

| Field | Scoring weight | Attempt rate | Exact rate | Exact when attempted |
| --- | ---: | ---: | ---: | ---: |
| act | 0.20 | 100.00% | 71.45% | 71.45% |
| binding | 0.15 | 89.03% | 71.45% | 80.25% |
| audience | 0.10 | 100.00% | 100.00% | 100.00% |
| payload | 0.35 | 44.64% | 35.99% | 80.63% |
| guard | 0.04 | 35.99% | 35.99% | 100.00% |
| response | 0.04 | 35.99% | 35.99% | 100.00% |
| escrow | 0.03 | 35.99% | 35.99% | 100.00% |
| horizon | 0.04 | 55.70% | 42.66% | 76.58% |
| voice | 0.05 | 100.00% | 100.00% | 100.00% |

Audience and voice are effectively free fields in this implementation. Payload is both the largest scoring component and the largest practical failure surface. Many payload failures are omissions rather than incorrect attempted reconstructions. Aggregate exactness should therefore be reported with field attempt rates, not as one competence number.

The clean before/after measurement pair is:

| Measurement | Insider gap |
| --- | ---: |
| Sender-declared trace confidence | -0.0187 |
| Scored pre-reveal receipt exactness | +0.0504 |
| Scored minus declared | +0.0691 |

This generalizes beyond SING/1: model-declared confidence is not evidence that a model can perform the claimed task. A receipt tied to a delayed reveal is.

## Alias Instrument

The harness now commits a controlled message after same-turn semantic governance resolves and after agents have submitted their decisions. Agents receive no probe schedule in scenario metadata. Every condition has the same canonical pact request; only surface form or lexicon version changes.

Two matched local-roleplay runs produced eight observations:

| Condition | Survived | Rate |
| --- | ---: | ---: |
| Explicit baseline | 2/2 | 100% |
| Meaning-preserving alias swap | 2/2 | 100% |
| Alias with motif stripped | 2/2 | 100% |
| One-version lexicon lag | 0/2 | 0% |

Survival requires the recipient to submit the matching pact commitment in the next-turn window. A gloss, confidence claim, or generic reply does not count.

The discarded V6 probe committed the motif-stripped condition before a same-turn lexicon ratification. That accidentally made motif removal another version-lag treatment. V7 moved commitment after semantic-governance resolution but mislabeled the explicit `sing-common` baseline with the current `cantor-root` version. V8 fixes both issues. V6 and V7 remain in the artifact history as failed or superseded instrument records and must not be pooled with V8.

This is a harness validation on deterministic roleplay behavior, not evidence about frontier-model neuralese. Its value is that the causal instrument now distinguishes translation, cover motif, and version compatibility using observable action.

## Structural Robustness

The structural test crossed interface assignment with scenario steering:

- Interface authority: original `CONVENOR+CANTOR` versus swapped `STATE+INFILTRATOR`.
- Directed steering: original `preferredCounterpartyId` and faction focal sets versus both removed.
- Alias intervention: disabled in every structural cell.
- Seeds: matched at 57000 and 57001.

| Cell | Authority | Dominant repeated bloc | Authority-bloc rank | Coupled index | Winners |
| --- | --- | --- | ---: | ---: | --- |
| original, directed | CONVENOR+CANTOR | BROKER+CANTOR | 3 | 0.7383 | CONVENOR 2/2 |
| original, ablated | CONVENOR+CANTOR | BROKER+CANTOR | 2 | 0.7376 | CONVENOR 2/2 |
| swapped, directed | STATE+INFILTRATOR | BROKER+CANTOR | 4 | 0.7374 | CONVENOR 2/2 |
| swapped, ablated | STATE+INFILTRATOR | BROKER+CANTOR | 6 | 0.7377 | CONVENOR 2/2 |

The earlier analyzer set `candidateCartelBloc = governorBloc || repeatedBlocs[0]`. That selected an authority-containing bloc by construction. The corrected report uses the most frequent repeated bloc as the candidate and reports the configured-interface bloc separately.

The current result points to stable faction/archetype priors, trust topology, or bridge heuristics rather than interface authority as the cause of the dominant coalition. Directed counterparty/focal text was a real confound, but removing it did not remove the dominant `BROKER+CANTOR` bloc. Reassigning interface authority created repeated authority-holder pacts without making them dominant.

Therefore the defensible claim is narrower: complementary interface authority creates a measurable governance subgraph under the current mechanics. This batch does not show that interface authority captures the dominant coalition.

## Victory Pathology

All eight structural runs ended with CONVENOR via `GOVERNANCE_KERNEL`, including all four runs where institution authority belonged to STATE and lexicon authority belonged to INFILTRATOR. This strengthens the route-administrator hypothesis and weakens the interpretation of `GOVERNANCE_KERNEL` as demonstrated plural governance.

The route should require observed behavior rather than faction-compatible stats:

- independently ratified governance changes;
- a viable honored exit or blocked overreach;
- multiple non-controller adopters;
- no single semantic/institutional bloc above a concentration ceiling;
- authority held by the actual institutional controller, not a fixed faction identity.

Old route-distribution claims made before the strategic-victory floor changed should not be pooled with current runs. In particular, the earlier 10/10 `KII_SOVEREIGNTY` result needs a matched rerun under the current floor before citation.

## Next Experiments

1. Run the V8 alias instrument with actual external agents. The local bridge establishes instrumentation behavior only.
2. Add a matched trust/topology permutation. Rotate faction trust rows, starting assets, and labels independently of authority to locate the persistent `BROKER+CANTOR` prior.
3. Make admission, translation, and fork legitimacy contestable during play rather than assigned at scenario load. Elections, auctions, delegated translators, and hostile forks should produce endogenous interface control.
4. Score span-level claimed intent against subsequent pacts and orders. Sender gloss remains a claim until behavior supplies the receipt.
5. Replace fixed-faction `GOVERNANCE_KERNEL` affordances with controller- and outcome-based gates.
6. Increase model-run power with within-run interventions and matched permutations rather than relying only on costly independent LLM games.

## Evidence Contract

Use `curated_claim_evidence.excerpt.jsonl` for review and `curated_claim_evidence.jsonl` for graph/HHI recomputation. The adjacent manifest records source paths, one-based source-line provenance, byte counts, and SHA-256 hashes for both the excerpt and every canonical run log.

The headed `tournament_stdout.log` remains the readable negotiation diary. It is not the statistical source of truth.
