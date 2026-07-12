# Babel Playtest to Public UX Plan

## Product Thesis

They Sing should open as a spectator-first evidence observatory, not as a conventional strategy-game HUD. The Three.js world provides the disaster-movie surface; the replay console lets a person discover that treaties, translations, repair corridors, and routing rules are the actual weapons.

The public interface must make an eval claim auditable without requiring the viewer to read raw JSONL. It should preserve the negotiation diary as drama while clearly separating model statements from scored evidence and post-hoc interpretation.

## Lessons From The V8 And Robustness Runs

1. **Self-report is not measurement.** The configured interface bloc's sender-declared decode gap was -1.72 percentage points while receipt-scored field exactness showed +3.23 points, a 4.95-point disagreement. The UI must display `CLAIM`, `RECEIPT`, and `REVEAL` as distinct evidence classes.
2. **Surface translation and version compatibility are different mechanisms.** Baseline, alias-swap, and motif-strip offers survived 2/2 times; one-turn version lag survived 0/2. The timeline must expose these interventions and their observation windows.
3. **Coalition concentration is not interface capture.** `BROKER+CANTOR` remained the dominant repeated bloc after interface roles were swapped and directed prompts were ablated. The interface bloc and dominant pact bloc need separate visual layers, with the stronger capture claim marked unsupported by the current batch.
4. **Victory routes may reward their administrator.** All eight 2x2 robustness runs ended with CONVENOR through `GOVERNANCE_KERNEL`. This is a balance/research warning, not evidence that CONVENOR is strategically superior.
5. **A diary is narrative evidence, not statistical provenance.** Public excerpts should link every aggregate claim to a compact metric record and identify the source experiment, run, turn, message, and intervention where available.
6. **Small-n results need visible uncertainty.** Two runs per condition are causal debugging evidence. Every headline must carry scope and caveat text in the interface.

## Public Experience

### First Thirty Seconds

- The default route opens the Babel evidence observatory with a curated replay already loaded.
- A short evaluation strip states what is supported, contradicted, and still open.
- The 3D scene remains dominant. Pact pulses, orbital infrastructure, social blooms, and protocol fractures provide the visual grammar.
- The turn scrubber makes months, weeks, days, and hours legible as the campaign accelerates.

### Evidence Console

- `CLAIM`: sender confidence, public gloss, treaty promise, and diary intent.
- `RECEIPT`: pre-reveal reconstruction, field exactness, Brier score, recipient, and source faction.
- `REVEAL`: canonical hash, canonical act, binding mode, and plain gloss.
- `INTERVENTION`: alias-swap, motif-strip, or version-lag variant and whether coordination survived.
- `INSTITUTION`: lexicon mutation, fork, admission, expulsion, exit, and formal-pact events.

### Evaluation Strip

- Measurement validity: receipt scoring exposes effects hidden by self-report.
- Translation robustness: alias and motif changes preserved coordination in this probe.
- Version compatibility: one-turn lag broke the tested commitment.
- Interface capture: not supported by the role-swap/ablation matrix.
- Route capture: unresolved because every robustness run used the same winner and route.

Clicking a claim should open its metrics and caveat in the evidence detail panel rather than presenting the headline as settled fact.

## Replay Contract

The `theysing.observatoryReplay.v1` schema remains backward compatible and gains:

- A top-level `evaluation` summary derived from collaboration-language and robustness reports.
- Per-turn `protocolEvidence` arrays for decode receipts, canonical reveals, alias probes, lexicon events, and institution events.
- Public-export mode that strips private reasoning and duplicated nested context while retaining provenance identifiers and public explanations.
- Compact JSON output and basename-only source paths for the hosted artifact.

## Responsive Behavior

- Desktop: Three.js scene centered, filters/evidence left, diary right, evaluation strip across the upper scene, timeline and moves below.
- Tablet: narrower panels and horizontally scrollable evaluation cards.
- Mobile: one bottom evidence sheet at a time, toggling between evidence and diary; selected-evidence flyout is suppressed; the timeline remains continuously usable.
- Keyboard shortcuts must not fire while a search, range, or file input is active.

## Release Acceptance Criteria

- Root URL opens a curated replay; `?game` preserves the interactive legacy game.
- A replay can be scrubbed, played, filtered, and inspected without raw-log access.
- V8 protocol receipts, reveals, alias probes, and lexicon events appear in the move/evidence stream.
- Claims carry status, sample scope, and caveats.
- Public replay is compact enough for normal static hosting and contains no duplicated private-reasoning payloads; primary diaries remain available.
- Existing replay fixtures continue to load.
- Type check, unit tests, regression suite, and production build pass.
- Desktop and mobile layouts are visually checked in the supported in-app browser when available.

## Follow-On Research UX

- Paired-run comparison for matched seeds and role swaps.
- Field-by-field decode exactness, especially binding, guard, payload, and response errors.
- Sender-gloss versus subsequent-order reveal-gap at span level.
- Victory-route administration counterfactuals with reassigned route authority.
- Public trace excerpts with stable artifact hashes for external audit.
