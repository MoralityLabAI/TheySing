# They Sing UX Replay Evaluation / 2026-07-12

## Inputs

- Public spectator replay: `public/observatory_replay.json`
- Canonical run: `D:\they-sing-results\seven_asi_babel_alias_probe_v8_clean_baseline_2run\runs\run_001\run_001.jsonl`
- Session configuration: sibling `session_config.json`
- Replay audit hash: `737ae734dd4500573cd9e8e0a81ff792948094556234d5ad8073c2d8637bea21`
- Machine-readable evaluation: `results/ux-replay-evaluation/2026-07-12-postfix/ux_replay_evaluation.json`

## Replay Result

The shipped projection contains 32 campaign turns represented as 156 phases. A full autoplay pass lasts 9.36 minutes at the current 3.6-second dwell. It contains 1,143 scene events, 764 messages, 651 diaries, 1,277 orders, 115 moments, and 961 protocol-evidence records.

The first deterministic replay attempt discarded rich SING/1 fields and reproduced only turn 1. The replay adapter now preserves message `protocolTrace`, decode receipts, lexicon mutations, and institution actions. With that repair, turns 1 and 2 reproduce exactly. Turn 3 still diverges during turn-end processing, so the public replay must currently be described as a signed historical projection rather than a fully regenerated simulation.

## UX Findings

| Severity | Finding | Evidence | Disposition |
| --- | --- | --- | --- |
| P1 | Sequential word streaming lost most diary content during autoplay. | 35/156 public phases and 93/156 retrospective phases exceeded the 3.6s dwell; retrospective p90 was 16.38s. | Fixed: complete blocks now arrive in a bounded stagger; public and retrospective p90 are 0.87s. |
| P1 | Dense order phases overwhelmed the globe. | Raw scene density is median 6, p90 17, maximum 18; 60 phases exceed eight effects. | Fixed: the globe renders at most eight diverse/high-intensity effects while every event remains in the phase index. |
| P1 | The canonical run is not fully replay-deterministic. | After restoring rich protocol actions, 1/3 compared turns still diverges; first mismatch is turn 3. | Open: isolate turn-end hidden state/RNG continuity before claiming regenerated replay. |
| P2 | Resolution has material changes but no authored scene events. | 41 phases use board-diff fallback; all 31 resolution phases change state. | Current signal navigation skips these; retain as concise before/after beats. |
| P2 | Public order prose is repetitive and mechanical. | Unique raw-summary rate is 27.2%; the UI rewrites 1,090/1,143 events (95.4%), but narrated uniqueness remains 18.9% because source actions repeat. | Partially fixed: retain the readable actor/action/location prose, then aggregate repeated effects during export and diversify agent action selection separately. |
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
