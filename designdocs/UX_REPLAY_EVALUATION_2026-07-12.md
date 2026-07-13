# They Sing UX Replay Evaluation / 2026-07-12

## Inputs

- Public spectator replay: `public/observatory_replay.json`
- Canonical run: `D:\they-sing-results\seven_asi_babel_alias_probe_v8_clean_baseline_2run\runs\run_001\run_001.jsonl`
- Session configuration: sibling `session_config.json`
- Replay audit hash: `737ae734dd4500573cd9e8e0a81ff792948094556234d5ad8073c2d8637bea21`
- Machine-readable evaluation: `results/ux-replay-evaluation/2026-07-12-board-index/ux_replay_evaluation.json`

## Replay Result

The shipped projection contains 32 campaign turns represented as 156 phases. A full 1x autoplay pass now lasts 7.72 minutes: 115 narrative-signal phases retain a 3.6-second dwell while 41 quiet phases use 1.2 seconds; the old fixed dwell took 9.36 minutes. It contains 1,143 scene events, 764 messages, 651 diaries, 1,277 orders, 115 moments, and 961 protocol-evidence records.

The first deterministic replay attempt discarded rich SING/1 fields and reproduced only turn 1. The replay adapter now preserves message `protocolTrace`, decode receipts, lexicon mutations, and institution actions. With that repair, turns 1 and 2 reproduce exactly. Turn 3 still diverges during turn-end processing, so the public replay must currently be described as a signed historical projection rather than a fully regenerated simulation.

## UX Findings

| Severity | Finding | Evidence | Disposition |
| --- | --- | --- | --- |
| P1 | Replay phases were exported alphabetically instead of in engine order. | The old sequence began `ACTION_DECLARATION`, `ALLOCATION`, `NEGOTIATION`; that compared board snapshots backward and made 31/31 resolution phases appear to change state. | Fixed: all 156 records now follow `NEGOTIATION`, `ALLOCATION`, `ACTION_DECLARATION`, `RESOLUTION`, `TURN_END`; the regression gate rejects chronology regressions. |
| P1 | Sequential word streaming lost most diary content during autoplay. | 35/156 public phases and 93/156 retrospective phases exceeded the 3.6s dwell; retrospective p90 was 16.38s. | Fixed: complete blocks now arrive in a bounded stagger; public and retrospective p90 are 0.87s. |
| P1 | Dense order phases overwhelmed the globe. | Raw scene density is median 6, p90 17, maximum 18; 60 phases exceed eight effects. | Fixed: the globe renders at most eight diverse/high-intensity effects while every event remains in the phase index. |
| P1 | The canonical run is not fully replay-deterministic. | After restoring rich protocol actions, 1/3 compared turns still diverges; first mismatch is turn 3. | Open: isolate turn-end hidden state/RNG continuity before claiming regenerated replay. |
| Pass | Quiet resolution phases do not claim nonexistent motion. | Correct chronology shows 0/31 resolution phases with a material board delta; all remain outside signal navigation. | Add authored resolution beats only when a future replay records a real before/after delta. |
| P2 | Public order prose is repetitive and mechanical. | Unique raw-summary rate is 27.2%; the UI rewrites 1,090/1,143 events (95.4%), but narrated uniqueness remains 18.9% because source actions repeat. | Presentation fixed within phases: 398 duplicate records collapse into 745 auditable groups across 47 phases. Campaign-level strategy repetition remains a game/agent-design issue. |
| Pass | Duplicate scene signals no longer compete for equal spectator attention. | Safe actor/action/location grouping reaches a maximum batch of six while distinct treaties, goblins, and escape trajectories remain separate. | Raw indexes and full event payloads remain attached to every grouped World-key button. |
| Pass | Late-campaign board population no longer creates one mesh per unit record. | p90 rendering falls from 284 units to 51 exact location/owner/type/evidence-status clusters; peak falls from 311 to 51, below the 64-marker target. | Cluster payloads preserve all units; transient effect, board, and imported-graph geometry is explicitly disposed before replacement. |
| Pass | The globe no longer assumes a permanently visible desktop viewport. | The tested policy is 60 FPS/DPR 2 desktop, 30/1.5 coarse pointer, 15 FPS behind evidence/diary panels, and 12/1.25 with ambient motion disabled under reduced motion; hidden/offscreen scenes suspend. | Visibility, intersection, media-query, view-mode, and disposal listeners are protected by regression contracts. |
| Pass | Autoplay no longer spends full narrative dwell on quiet phases or advances unseen. | Adaptive 1x pacing reduces 9.36 minutes to 7.72; 0.5x/1x/2x/4x controls are explicit, hidden tabs suspend, and replay loads reset playback. | Signal classification, phase dwell, canonical duration, speed choices, and visibility lifecycle are protected by regression gates. |
| Pass | Canvas-only board evidence now has a complete semantic equivalent. | The canonical board requires at most 72 ownership/force/route controls; the collapsed index creates them lazily, never slices, focuses the matching globe location, and retains public/private payload handling. | Keyboard/touch coverage and maximum-control accounting are protected by a dedicated regression gate. |
| Pass | Evidence tabs now match their declared ARIA interaction model. | Exactly one tab is in sequential focus order; Left/Right/Home/End activate and focus a destination; every panel is labelled by its stable tab ID. | The four-tab keyboard and relationship contract is protected by a dedicated regression gate. |
| Pass | Globe evidence is navigable. | 1,142/1,143 scene events can focus a graph location or faction beacon. | Protected by regression gate. |
| Unverified | Visual composition and touch ergonomics. | No headed browser backend was available. | Run `designdocs/UX_QA_PLAYTEST.md` desktop/mobile matrix. |

## Embedded Game Evaluation

- Supported: receipt-scored decoding detects an insider effect that sender self-report misses.
- Supported at case-study scale: alias translation and motif stripping preserved coordination; one-turn version lag broke it.
- Not supported: interface capture did not follow reassigned authority in the current role-swap probe.
- Open: all eight robustness runs still ended with `CONVENOR / GOVERNANCE_KERNEL`, so route administration may be capturing victory.

## Reproduction

```powershell
node scripts/replay-harness-run.cjs --run "D:\they-sing-results\seven_asi_babel_alias_probe_v8_clean_baseline_2run\runs\run_001\run_001.jsonl" --config "D:\they-sing-results\seven_asi_babel_alias_probe_v8_clean_baseline_2run\runs\run_001\session_config.json" --through-turn 3
npm run playtest:evaluate-ux-replay -- public/observatory_replay.json results/ux-replay-evaluation/latest
```

The UX evaluator emits `UX_REPLAY_EVALUATION.md` and `ux_replay_evaluation.json`. It measures beat sources, phase density, transcript pacing, focusability, board changes, and embedded research claims.
