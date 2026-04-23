# Codex 5.2 Web-Auth Handoff

This repo already has a headless playtest harness for `TheySingEngine`. The goal is to run three real Codex-driven factions:

- `HEGEMON` = `US Frontier ASI`
- `STATE` = `Chinese State ASI`
- `INFILTRATOR` = `Rogue Swarm ASI`

The current blocker is not game logic. It is authentication. The stock OpenAI API path is not the right fit if the model access lives behind web auth.

## What The Harness Can Already Do

The harness supports two integration patterns:

1. `openai`
   - Expects an OpenAI-compatible endpoint at `POST /v1/chat/completions`
   - Works with a local base URL
   - Can omit bearer auth if the base URL is local and no API key is configured
   - Can send static extra headers if needed

2. `webhook`
   - Expects a faction-specific `POST /decide`
   - Receives the full game state and returns JSON orders/messages/pacts
   - Best option if the external agent already has its own browser-auth/session logic

Relevant files:

- [src/harness/HeadlessPlaytestSession.ts](/C:/projects/TheySing/TheySing/src/harness/HeadlessPlaytestSession.ts:1065)
- [src/harness/server.ts](/C:/projects/TheySing/TheySing/src/harness/server.ts:171)
- [designdocs/HEADLESS_PLAYTEST_HARNESS.md](/C:/projects/TheySing/TheySing/designdocs/HEADLESS_PLAYTEST_HARNESS.md:47)

## Recommended Integration

Do not put browser cookies or fragile web auth logic inside the game harness itself.

Instead, run a local bridge process that:

1. owns the authenticated web session
2. talks to the web-auth-backed Codex/GPT-5.2 system
3. exposes a stable local interface to this repo

Two good patterns:

### Option A: Local OpenAI-Compatible Bridge

Expose a local endpoint like:

- `http://127.0.0.1:8000/v1/chat/completions`

The bridge should:

- accept standard OpenAI chat-completions payloads
- translate them into the web-auth-backed model workflow
- return a normal chat-completions response with assistant content

Use this if the other agent can make its web-auth stack look OpenAI-compatible.

### Option B: Local Webhook Agents

Expose three local endpoints like:

- `http://127.0.0.1:9101/decide`
- `http://127.0.0.1:9102/decide`
- `http://127.0.0.1:9103/decide`

Each endpoint can use the same underlying web-auth session or separate ones. The harness does not care as long as each endpoint returns the expected JSON.

Use this if the other agent already has a browser/session orchestration layer and it is easier to implement a custom handler than an OpenAI-compatible shim.

## Preferred Choice

If the other plan already has a clean web-auth session abstraction, use `webhook`.

Reason:

- simplest contract
- no need to emulate OpenAI response envelopes
- easier to debug role-specific behavior
- easier to rotate session state without touching harness code

Use `openai` only if the bridge already speaks `/v1/chat/completions`.

## Required Request And Response Contract

The harness sends:

- session metadata
- faction id and label
- current phase
- serialized state
- legal hints
- visible negotiation transcript
- active pacts
- trust matrix
- instructions telling the agent to return JSON only

Negotiation responses may include:

```json
{
  "reasoning": "optional",
  "notes": "optional",
  "messages": [
    {
      "recipientId": "STATE",
      "content": "Two-turn orbital truce proposal."
    }
  ],
  "pacts": [
    {
      "type": "ORBITAL_TRUCE",
      "counterpartyIds": ["STATE"],
      "durationTurns": 2
    }
  ],
  "orders": []
}
```

Action/allocation responses may include:

```json
{
  "reasoning": "optional",
  "notes": "optional",
  "orders": [
    {
      "type": "RESEARCH",
      "techDomain": "LOGIC"
    },
    {
      "type": "BUILD",
      "unitTypeToBuild": "AUDITOR",
      "targetNodeId": "DC_US_EAST"
    }
  ]
}
```

Important:

- return JSON only
- `BUILD` and `RESEARCH` do not need `unitId`
- negotiation pacts only activate if every named party submits the same pact that turn
- pact-violating orders are blocked by the harness

## Suggested Local Config

### If Using `webhook`

Create a config like:

```json
{
  "name": "codex-web-auth-triangle",
  "maxTurns": 6,
  "logDir": "playtest-logs",
  "factionLabels": {
    "HEGEMON": "US Frontier ASI",
    "STATE": "Chinese State ASI",
    "INFILTRATOR": "Rogue Swarm ASI"
  },
  "agents": {
    "HEGEMON": {
      "type": "webhook",
      "url": "http://127.0.0.1:9101/decide",
      "timeoutMs": 120000
    },
    "STATE": {
      "type": "webhook",
      "url": "http://127.0.0.1:9102/decide",
      "timeoutMs": 120000
    },
    "INFILTRATOR": {
      "type": "webhook",
      "url": "http://127.0.0.1:9103/decide",
      "timeoutMs": 120000
    }
  }
}
```

### If Using A Local OpenAI-Compatible Bridge

Create a config like:

```json
{
  "name": "codex-web-auth-openai-bridge",
  "maxTurns": 6,
  "logDir": "playtest-logs",
  "factionLabels": {
    "HEGEMON": "US Frontier ASI",
    "STATE": "Chinese State ASI",
    "INFILTRATOR": "Rogue Swarm ASI"
  },
  "agents": {
    "HEGEMON": {
      "type": "openai",
      "model": "gpt-5.2-codex",
      "baseUrl": "http://127.0.0.1:8000/v1",
      "timeoutMs": 120000
    },
    "STATE": {
      "type": "openai",
      "model": "gpt-5.2-codex",
      "baseUrl": "http://127.0.0.1:8000/v1",
      "timeoutMs": 120000
    },
    "INFILTRATOR": {
      "type": "openai",
      "model": "gpt-5.2-codex",
      "baseUrl": "http://127.0.0.1:8000/v1",
      "timeoutMs": 120000
    }
  }
}
```

If the bridge requires a static local header, use the `headers` field in the `openai` config.

## Recommended Bring-Up Sequence

1. Start the local bridge or webhook agent service.
2. Verify it answers one test request before running the game.
3. Run the harness with a 2-turn or 3-turn match first.
4. Check the JSONL log for:
   - `agent_response`
   - absence of `agent_response_error`
   - negotiation messages and pact activations
5. Only then run a longer 6-turn or 10-turn session.

## Minimal Verification Targets

The other agent should verify:

1. No `401`, `403`, or browser-auth redirect errors.
2. No `agent_response_error` log entries during the short run.
3. At least one real `agent_response` entry exists.
4. The response body is parseable JSON and not markdown prose.
5. The harness does not fall back to heuristics.

## Run Commands

Build and run harness server:

```powershell
npm run playtest:harness -- --config playtest/your-session.json --port 8787
```

Direct HTTP checks:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/health
Invoke-RestMethod http://127.0.0.1:8787/sessions
Invoke-RestMethod -Method Post http://127.0.0.1:8787/sessions/<sessionId>/run-turn
```

## Known Pitfalls

- Do not aim the harness at a browser-only page. It must hit a machine API or local bridge.
- Do not rely on the current remote `OPENAI_API_KEY` path here. It already failed with `401 invalid_api_key`.
- Do not expose rotating browser cookies directly in repo config files.
- Keep the web-auth logic outside the harness and behind loopback if possible.
- If using `openai`, the base URL must be rooted at `/v1`.

## What Success Looks Like

A successful run will produce:

- `agent_response` entries in `playtest-logs/*.jsonl`
- faction-specific negotiation messages generated by the external agents
- pacts that are not obviously heuristic defaults
- no fallback notes like `Webhook failed for ...; heuristic fallback applied.`

Once the bridge works, rerun a 6-turn match and summarize:

- final control by faction
- TAS, Kessler, and pressure levels
- which pacts activated
- whether the coalition structure was stable or brittle
