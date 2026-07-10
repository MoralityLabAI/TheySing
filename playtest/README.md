# They Sing Harness

Build the headless harness:

```bash
npm run build:harness
```

Start the harness server:

```bash
npm run playtest:harness -- --host 127.0.0.1 --port 8787
```

Start the local webhook bridge used by `playtest/sample-codex-session.json`:

```bash
npm run playtest:webhook-bridge
```

Start the Codex bridge through the local env wrapper:

```bash
npm run playtest:codex-bridge
```

It reads `playtest/codex-bridge.env` if present. Start from:

```bash
copy playtest\\codex-bridge.env.example playtest\\codex-bridge.env
```

Then probe the three local faction ports:

```bash
npm run playtest:codex-bridge:probe
```

Run the Codex-style feedback loop with three roleplay players plus generated critic/designer briefs:

```powershell
npm run playtest:feedback-loop -- --cycles 5 --iterations 12 --parallel 3 --seed-base 2400 --config playtest/sample-codex-webhook-tournament.json --experiment-root results/codex_feedback_loop
```

That loop writes `analysis/feedback.md` and `analysis/feedback.json` after every cycle.

By default the bridge runs a deterministic local policy so the webhook session works without external auth.
If you want three distinct no-auth faction personas instead, set:

```powershell
$env:THEYSING_BRIDGE_MODE='roleplay'
npm run playtest:codex-bridge
```

To point it at an authenticated OpenAI-compatible bridge instead:

```powershell
$env:THEYSING_BRIDGE_MODE='openai'
$env:THEYSING_BRIDGE_OPENAI_BASE_URL='http://127.0.0.1:8000/v1'
$env:THEYSING_BRIDGE_OPENAI_MODEL='gpt-5.2-codex'
$env:THEYSING_BRIDGE_OPENAI_API_STYLE='auto'
$env:THEYSING_BRIDGE_OPENAI_MAX_TOKENS='4000'
npm run playtest:webhook-bridge
```

For the official OpenAI API, keep the base URL at `https://api.openai.com/v1` or omit it entirely.
With `apiStyle=auto`, `gpt-5.4` stays on `chat/completions`, while `gpt-5-codex` switches to `responses`.

Preload a local-Qwen session:

```bash
npm run playtest:harness -- --config playtest/sample-local-qwen-session.json
```

Run the webhook-backed sample session:

```bash
npm run playtest:harness -- --config playtest/sample-codex-session.json --port 8787
```

Run a 5-player webhook session from the 5-role endpoint sample:

```bash
npm run playtest:harness -- --config playtest/sample-five-asi-webhook-tournament.json --port 8787
```

Run a direct OpenAI-compatible Codex session:

```bash
npm run playtest:harness -- --config playtest/sample-codex-openai-session.json --port 8787
```

Run a direct OpenAI-compatible 5-player Codex session:

```bash
npm run playtest:harness -- --config playtest/sample-five-asi-openai-session.json --port 8787
```

Run an `AI_Diplomacy`-style batch experiment:

```bash
npm run tournament:harness -- --experiment_dir results/high_pressure_detente --config playtest/sample-scenario-tournament.json --iterations 4 --parallel 2
```

Run the same pattern against the live local Qwen/OpenAI-compatible server on `snacksack-ms-7d32:8081`:

```bash
npm run tournament:harness -- --experiment_dir results/qwen_detente --config playtest/sample-local-qwen-tournament.json --iterations 6 --parallel 2 --seed_base 1200
```

Run a Codex round robin through faction-specific local webhooks:

```bash
npm run tournament:harness -- --experiment_dir results/codex_webhook_round_robin --config playtest/sample-codex-webhook-tournament.json --iterations 6 --parallel 2 --seed_base 2400
```

Run the same webhook tournament using the built-in local roleplay bridge:

```powershell
$env:THEYSING_BRIDGE_MODE='roleplay'
npm run playtest:codex-bridge
npm run tournament:harness -- --experiment_dir results/codex_roleplay_round_robin --config playtest/sample-codex-webhook-tournament.json --iterations 12 --parallel 3 --seed_base 2400
```

If your Windows/npm shell drops tournament flag names, run the compiled harness directly instead:

```powershell
node dist-harness/harness/tournament.js --experiment-dir results/codex_roleplay_round_robin --config playtest/sample-codex-webhook-tournament.json --iterations 12 --parallel 3 --seed-base 2400
```

Run a Codex round robin through a single OpenAI-compatible local bridge:

```bash
npm run tournament:harness -- --experiment_dir results/codex_openai_round_robin --config playtest/sample-codex-openai-tournament.json --iterations 6 --parallel 2 --seed_base 2400
```

Run a 5-player OpenAI-style tournament (same endpoint for all 5 players, one bridge client per role in your config):

```powershell
npm run tournament:harness -- --experiment_dir results/five_asi_openai_round_robin --config playtest/sample-five-asi-openai-tournament.json --iterations 6 --parallel 2 --seed_base 2400
```

Run the ASI-2/ASI-3 diplomacy question ladder with tagged negotiation diaries:

```powershell
npm run build:harness
node dist-harness/harness/tournament.js --experiment-dir results/asi2_asi3_diplomacy_ladder_smoke --config playtest/five-asi-asi2-asi3-diplomacy-60turn.json --iterations 3 --parallel 1 --seed-base 31000
```

Run the same ladder as an enforcement-mode comparison:

```powershell
npm run build:harness
node dist-harness/harness/tournament.js --experiment-dir results/enforcement_hard --config playtest/five-asi-asi2-asi3-diplomacy-60turn-hard.json --iterations 6 --parallel 2 --seed-base 33000
node dist-harness/harness/tournament.js --experiment-dir results/enforcement_soft --config playtest/five-asi-asi2-asi3-diplomacy-60turn-soft.json --iterations 6 --parallel 2 --seed-base 33000
node dist-harness/harness/tournament.js --experiment-dir results/enforcement_graduated --config playtest/five-asi-asi2-asi3-diplomacy-60turn-graduated.json --iterations 6 --parallel 2 --seed-base 33000
```

Validate a trace-bearing JSONL log and replay it from recorded decisions:

```powershell
npm run playtest:validate-trace -- --run results/enforcement_hard/runs/run_001/run_001.jsonl
npm run playtest:replay-run -- --run results/enforcement_hard/runs/run_001/run_001.jsonl --config results/enforcement_hard/runs/run_001/session_config.json
```

Run the late-start ASI-3 mature diplomacy lab:

```powershell
npm run build:harness
node dist-harness/harness/tournament.js --experiment-dir results/asi3_mature_diplomacy_endgame_smoke --config playtest/five-asi-asi3-mature-diplomacy-24turn.json --iterations 3 --parallel 1 --seed-base 32000
```

Export per-turn diplomacy/action reasoning and move traces from a run log:

```powershell
npm run playtest:extract-diaries -- results/five_player_roleplay_demo/runs/run_001/run_001.jsonl results/five_player_roleplay_demo/diary_exports
```

Notes:

- `heuristic`, `webhook`, and direct `openai` agents are supported.
- The local Codex bridge now supports `policy`, `roleplay`, and `openai` modes.
- `openai` agents can target local OpenAI-compatible servers such as `http://snacksack-ms-7d32:8081/v1` or the official OpenAI API at `https://api.openai.com/v1`.
- Direct `openai` agents and the webhook bridge now support both `chat/completions` and `responses`; use `apiStyle=auto` unless you need to force one.
- `THEYSING_BRIDGE_OPENAI_MAX_TOKENS` and `THEYSING_BRIDGE_OPENAI_TEMPERATURE` let you raise the per-decision budget when using an upstream model.
- Scenario overlays can be supplied inline or via `scenarioPath`; the sample storyworld lives at `playtest/scenarios/high-pressure-detente.json`.
- Tournament runs write `runs/run_###/` artefacts plus `analysis/summary.json`, `analysis/report.md`, and CSV summaries under the chosen experiment directory.
- Negotiation-phase agent messages are logged even though the core engine does not yet mutate state from diplomacy text.
