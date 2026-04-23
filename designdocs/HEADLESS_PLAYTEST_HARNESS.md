# Headless Playtest Harness

This harness runs `TheySingEngine` without the UI and supports three agent modes:

- `heuristic`: built-in policy for quick local smoke tests
- `webhook`: external HTTP decision endpoint per faction
- `openai`: direct OpenAI-compatible endpoint per faction

Default faction mapping for the abstract three-way playtest:

- `HEGEMON` -> `US Frontier ASI`
- `STATE` -> `Chinese State ASI`
- `INFILTRATOR` -> `Rogue Swarm ASI`

## Run

Build and start the harness server:

```powershell
npm run playtest:harness -- --config playtest/sample-codex-session.json --port 8787
```

For a no-webhook local match:

```powershell
npm run playtest:harness -- --config playtest/sample-heuristic-session.json --port 8787
```

## HTTP API

- `GET /health`
- `GET /contract/agent-webhook`
- `GET /sessions`
- `POST /sessions`
- `GET /sessions/:id`
- `POST /sessions/:id/step`
- `POST /sessions/:id/run-turn`
- `POST /sessions/:id/run`

Example:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/sessions
Invoke-RestMethod -Method Post http://127.0.0.1:8787/sessions/<sessionId>/run-turn
Invoke-RestMethod -Method Post http://127.0.0.1:8787/sessions/<sessionId>/run -ContentType 'application/json' -Body '{"turns":5}'
```

## Webhook Contract

The harness sends `POST` requests to each configured webhook during:

- `NEGOTIATION`
- `ALLOCATION`
- `ACTION_DECLARATION`

Request body includes:

- session and faction ids
- current turn and phase
- serialized state
- legal hints
- visible recent negotiation messages
- active pacts
- trust matrix
- JSON response instructions

Expected response:

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

For negotiation phases:

```json
{
  "reasoning": "optional",
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

For action phases:

```json
{
  "reasoning": "optional",
  "orders": [
    {
      "type": "FILTER",
      "unitId": "H_AUDITOR_1",
      "targetEdgeId": "CABLE_EU_LONDON"
    },
    {
      "type": "ATTACK",
      "unitId": "S_DRONE_1",
      "targetNodeId": "HUB_TOKYO"
    }
  ]
}
```

Notes:

- `unitId` may be omitted for `BUILD` and `RESEARCH`.
- The harness injects ids, priorities, and faction ownership.
- Invalid orders are rejected individually and logged.
- Pact-violating orders are blocked before they reach the engine, and the violating faction loses trust and a small amount of influence.
- A pact activates only if every named party returns the same pact commitment during the same `NEGOTIATION` phase.
- Honored pacts apply small de-escalation benefits at `TURN_END`, then expire when their duration runs out.

## Logs

Every session writes JSONL under `playtest-logs/<sessionId>.jsonl`.

Entries include:

- `session_created`
- `engine_event`
- `agent_request`
- `agent_response`
- `negotiation_messages`
- `pacts_activated`
- `pact_breach_blocked`
- `pact_honored`
- `pact_expired`
- `orders_submitted`
- `phase_advanced`
- `session_completed`
