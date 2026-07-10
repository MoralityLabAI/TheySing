# Harness Math-Model Audit

Status: implementation-grounded audit for `designdocs/mathModel.md`.

## Current Engine Semantics

`They Sing` currently implements a finite-horizon, turn-structured multi-agent game with a fixed within-turn event clock:

```text
NEGOTIATION -> ALLOCATION -> ACTION_DECLARATION -> RESOLUTION -> TURN_END
```

This is a clock, not a state-space stratum. Routine phase changes should be represented as event coordinates. Meaningful strata are regime coordinates such as active pact set, doctrine unlocks, memetic alignment commitments, enforcement mode, and systemic-risk bands.

## Resolution Semantics

Current resolution is mixed rather than purely simultaneous or initiative-driven.

All factions submit allocation/action orders before resolution, but the engine then sorts the combined order list by type and priority:

1. `BUILD` and `RESEARCH`.
2. Special actions such as `FILTER`, `AUDIT`, `ANTI_SAT`, `SABOTAGE`, `CONVERT`, treaty-use actions, recruitment, and broker leverage.
3. Movement/combat orders such as `MOVE`, `ATTACK`, `SUPPORT`, and `HOLD`.

There is no implemented class-, technology-, or diplomacy-driven initiative sequence. Future initiative variants should be described as solution-concept experiments, not as current engine behavior.

## Pact Enforcement Semantics

The historical/default behavior is hard enforcement:

- Pact-violating orders are rejected by the harness before reaching the engine.
- Violations are logged as blocked breach attempts.
- Breaching factions lose trust and influence.
- Some orbital/institutional breaches increase orbital pressure or Pax/Jenkins authority.

The harness now exposes `enforcementMode` as an experimental axis:

- `hard`: preserve historical hard-blocking behavior.
- `soft`: allow otherwise legal pact-breaking orders to execute, then sanction and mark the pact breached for turn-end benefits.
- `graduated`: allow bilateral/non-institutional breaches, but hard-block destructive cislunar institutional breaches.

This makes enforcement semantics explicit enough for commitment-conservation metrics.

## Trace Semantics

Harness JSONL entries now carry a `trace` object using `theysing.traceEvent.v1`.

The trace layer records:

- event channel;
- binding status;
- execution status;
- attempted/accepted/executed/blocked flags;
- state hashes;
- active-pact/doctrine/alignment/risk/enforcement regime coordinates.

The legacy log fields remain intact for existing scripts.

## Replay Determinism

The engine should be treated as Markovian only relative to serialized sufficient state, seeded RNG, and the ordered action trace. The implemented replay check reconstructs recorded manual decisions from JSONL, reruns them under the same seed/config/session id, and compares per-turn state hashes.

This validates deterministic transition behavior for logged harness runs. It does not claim that arbitrary LLM agent policy is Markovian unless the prompt-construction function supplies a complete observation state.

