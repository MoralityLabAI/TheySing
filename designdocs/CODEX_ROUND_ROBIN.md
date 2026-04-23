# Codex Round Robin

This repo now has Codex starter configs for both supported bridge patterns:

- `playtest/sample-codex-webhook-tournament.json`
- `playtest/sample-codex-openai-tournament.json`
- `playtest/sample-codex-openai-session.json`

Use `webhook` if your authenticated Codex setup exposes local `/decide` handlers.
Use `openai` if your upstream exposes an OpenAI-compatible `/v1` root; the harness now supports both `chat/completions` and `responses`.
Use the built-in `roleplay` bridge mode if you just want three distinct local faction personas without external auth.

## Option A: Webhook Round Robin

Start your three local faction bridges:

- `http://127.0.0.1:9101/decide`
- `http://127.0.0.1:9102/decide`
- `http://127.0.0.1:9103/decide`

For a no-auth local run:

```powershell
$env:THEYSING_BRIDGE_MODE='roleplay'
npm run playtest:codex-bridge
```

Then run:

```powershell
npm run tournament:harness -- --experiment_dir results/codex_webhook_round_robin --config playtest/sample-codex-webhook-tournament.json --iterations 6 --parallel 2 --seed_base 2400
```

If your Windows/npm shell strips the flag names, use:

```powershell
node dist-harness/harness/tournament.js --experiment-dir results/codex_webhook_round_robin --config playtest/sample-codex-webhook-tournament.json --iterations 6 --parallel 2 --seed-base 2400
```

## Option B: OpenAI-Compatible Round Robin

Point the config at a local Codex-compatible bridge rooted at `/v1`.

If you want to use the built-in local webhook bridge as the adapter layer, start it like this:

```powershell
$env:THEYSING_BRIDGE_MODE='openai'
$env:THEYSING_BRIDGE_OPENAI_BASE_URL='http://127.0.0.1:8000/v1'
$env:THEYSING_BRIDGE_OPENAI_MODEL='gpt-5.2-codex'
$env:THEYSING_BRIDGE_OPENAI_API_STYLE='auto'
$env:THEYSING_BRIDGE_OPENAI_MAX_TOKENS='4000'
npm run playtest:webhook-bridge
```

If you point the bridge at the official OpenAI API instead of a local shim, `auto` keeps `gpt-5.4` on chat and switches `gpt-5-codex` to Responses automatically.

Then run either:

```powershell
npm run playtest:harness -- --config playtest/sample-codex-openai-session.json --port 8787
```

or the full round robin:

```powershell
npm run tournament:harness -- --experiment_dir results/codex_openai_round_robin --config playtest/sample-codex-openai-tournament.json --iterations 6 --parallel 2 --seed_base 2400
```

## What To Check

- `results/.../analysis/summary.json`
- `results/.../analysis/report.md`
- `runs/run_###/*.jsonl`

Success criteria:

- no `agent_response_error`
- no heuristic fallback notes
- negotiation messages that are not the stock bridge policy
- stable run completion across all iterations

## Current Expectation

The engine is now cooler than before, but `HEGEMON` still has a defensive bias.
The new coalition-synergy tech hooks are live, but real Codex agents should exploit them better than heuristics.
