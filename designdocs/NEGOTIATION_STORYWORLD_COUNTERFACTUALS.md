# Negotiation Storyworld Counterfactuals

This layer gives each `NEGOTIATION` request a compact narrative and forecast surface:

- `frame`: one short sentence describing who leads, where pressure is coming from, and how hot the board is.
- `strategicQuestion`: one short sentence framing the current bargaining dilemma.
- `counterfactuals`: up to 4 pact projections covering:
  - `ENTER_PACT`
  - `BREAK_PACT`

Each projection includes:

- pact type
- counterparties
- 2-turn horizon
- desirability
- risk
- projected leader
- projected `TAS` / orbital / trust / node swing deltas
- a short `storyBeat`
- compact rationale bullets

Current use:

- exposed on `AgentDecisionRequest.negotiationStoryworld`
- logged into `negotiation_reasoning_diary`
- rendered in tournament markdown reports
- consumed by the local `roleplay` bridge to bias pact offers and warnings

Design intent:

- keep the layer small enough for repeated playtest loops
- make alliance entry and betrayal legible in the logs
- let future `5.4` or webhook agents reason from explicit board projections instead of only raw state dumps

Non-goals for this version:

- perfect simulation
- hidden-thought extraction
- long-form narrative generation
- binding recommender logic

This is a short forecasting scaffold for negotiation, not a full story engine.
