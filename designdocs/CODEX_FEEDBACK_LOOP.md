# Codex Feedback Loop

This is the burn-the-plan loop for `They Sing`.

It uses five roles per cycle:

- `HEGEMON` player: local roleplay bridge on `9101`
- `STATE` player: local roleplay bridge on `9102`
- `INFILTRATOR` player: local roleplay bridge on `9103`
- `BALANCE_CRITIC`: generated from tournament metrics after each batch
- `SYSTEMS_DESIGNER`: generated from the same metrics as a concrete rebalance / tech queue

## Bring-Up

Start the local roleplay bridge:

```powershell
$env:THEYSING_BRIDGE_MODE='roleplay'
npm run playtest:codex-bridge
```

Then run the loop:

```powershell
npm run playtest:feedback-loop -- --cycles 5 --iterations 12 --parallel 3 --seed-base 2400 --config playtest/sample-codex-webhook-tournament.json --experiment-root results/codex_feedback_loop
```

If you already built the harness in the current shell and want a faster relaunch:

```powershell
npm run playtest:feedback-loop -- --skip-build --cycles 5 --iterations 12 --parallel 3 --seed-base 2400
```

## Outputs

For each cycle, the runner writes:

- `analysis/summary.json`: tournament summary from the harness
- `analysis/report.md`: existing tournament report
- `analysis/feedback.json`: machine-readable critic/designer verdict
- `analysis/feedback.md`: operator-facing balance/design brief

The root loop directory also gets:

- `loop_index.md`: one-line summary of each completed cycle

## How To Use It

1. Run a batch.
2. Read the newest `analysis/feedback.md`.
3. Implement the top one or two items from `Next Codex Patch Queue`.
4. Run another cycle.
5. Compare `loop_index.md` and winner rates to see if the game is getting less degenerate.

## Current Intent

Right now the loop is tuned to detect:

- `HEGEMON` fortress bias
- underperforming `STATE` terrestrial follow-through
- `INFILTRATOR` failure to persist on the board
- negotiation that stabilizes the leader more than it destabilizes them
- global heat that is still too high even after recent cooling passes

It also proposes new tech/mechanic hooks when those patterns recur, so future Codex passes have a ready-made design queue instead of starting from a blank page.
