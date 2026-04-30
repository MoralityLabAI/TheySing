# ARIA Mathematics for Safe AI Draft: BlueBeam + MeTTa/TRM RSI Gym

Working draft, 2026-04-30.

This is the revised application direction: lead with BlueBeam and MeTTa/TRM as an air-gapped red-team RSI safety gym. Keep They Sing/storyworlds as optional evaluation substrates rather than the headline.

## Application Name

BlueBeam RSI Gym: Mathematical Safety Tests for Recursive Agent Improvement

Alternative:

BlueBeam + MeTTa/TRM: An Air-Gapped Red-Team Gym for Safe Recursive Improvement

## One-Liner

Build an air-gapped red-team RSI gym where agents attempt bounded recursive improvement while BlueBeam latent detectors and MeTTa/TRM verifier/repair gates measure verifier drift, reward hacking, tool misuse, policy tampering, and off-support behaviour.

## Core Pitch

The proposal combines two pieces of existing work:

- **BlueBeam**: calibrated latent-signal detection and weak localization of subtle model tampering.
- **MeTTa/TRM repair skills**: symbolic task graphs and Tiny Recursive Model components that turn semi-failed agent outputs into verifier, repair, extraction, and commit/veto training data.

The April BlueBeam work makes the proposal less speculative. It shows that retained latent procedure signals can remain quiet across three benign-shift controls, that one procedure family partially transfers from orchestration to manipulation, and that compositional-context risk remains detectable above chance on a real train/dev/test split without weight tampering.

Together they become a Mathematics for Safe AI project:

> A bounded, air-gapped experimental gym for studying whether recursive agent improvement can be made measurable, interruptible, and mathematically constrained before it becomes dangerous.

The goal is not to build unbounded RSI. The goal is to create a controlled red-team environment where agents can try to improve tools, prompts, policies, repair modules, or skill graphs under strict containment, while the system measures where safety invariants fail.

## Prior Work Links

BlueBeam:

https://www.moralitylab.xyz/papers/Blue_Beam__Detecting_and_Weakly_Localizing_Subtle_Model_Tampering_in_Small_Models_with_Calibrated_Latent_Signals.pdf

MeTTa/TRM skills:

https://www.moralitylab.xyz/papers/MeTTa_Scaffolded_Repair_Curricula_for_TRM_Infused_Hermes_Skills__1_.pdf

## April Evidence Base

The April BlueBeam results give the application concrete empirical footing:

- The retained procedure shortlist, `multi_step_risk_escalation` and `unauthorized_config_edit`, stays active on orchestration-tamper lanes while remaining quiet under prompt-shift, conservative benign, and audit benign controls.
- Rejected procedure families became useful negative controls: `rationale_action_mismatch` and `suspicious_file_staging` showed large benign collisions and should not be headline detectors.
- `multi_step_risk_escalation` partially transfers from orchestration to manipulation, with manipulation gap `0.1468` against orchestration gap `0.3047`, about `48%` transfer.
- The IACDojo compositional-context lane extends BlueBeam beyond weight-tampering: frozen Qwen 3.5 4B activations detect risky-vs-twin context above chance without changing model weights.
- The strongest split-aware result uses real `train -> dev -> test` discipline. All six `mcp_layering` categories stay above chance on test, with AUROC from `0.5866` to `0.7526`.
- Cross-carrier transfer is not yet stable. The trajectory-family second carrier became behaviorally degenerate under the current Qwen 4B setup, so the honest claim is primary-carrier split-aware generalization plus independent orchestration-tamper support.

## 350-Word Research Summary

I propose to build an air-gapped red-team RSI gym for studying bounded recursive agent improvement under mathematical safety constraints. The project combines my BlueBeam work on calibrated latent detection of subtle model tampering with my MeTTa/TRM work on symbolic repair curricula for agent skills. In April, BlueBeam advanced from a promising detector result into a disciplined evaluation method: retained latent procedure signals stayed quiet across three benign-shift controls, one family partially transferred from orchestration to manipulation, and compositional-context risk remained detectable above chance on a real train/dev/test split without weight tampering.

The safety problem is that advanced agents will not only answer prompts. They will modify tools, rewrite plans, improve prompts, compose skills, generate training data, repair failed actions, and route work through external modules. These recursive-improvement loops may create capability gains, but also create verifier drift, reward hacking, hidden policy change, tool misuse, and off-support behaviour. I want to make those transitions measurable in a controlled environment before they appear in deployed systems.

The gym would run agents inside an air-gapped harness. At each round, a red-team agent proposes an improvement to a bounded skill: a tool-call policy, repair module, verifier threshold, prompt graph, small model adapter, or MeTTa/TRM control circuit. A blue-team layer evaluates the proposal using explicit contracts: behavioural tests, symbolic validators, commit/veto gates, and BlueBeam latent probes. The system records whether the improvement increased task performance, preserved safety invariants, triggered latent anomaly signals, or shifted behaviour outside the verified envelope.

The mathematical object is a recursive safety curve. For each depth \(k\), we measure the cost of preserving a property \(P\) against an adaptive improver: violation rate, repair cost, verifier agreement, latent anomaly score, policy divergence, and resource cost.

The output would be a reproducible air-gapped harness, benchmark-safe task families, failure taxonomy, BlueBeam/MeTTa/TRM monitoring stack, and a report on which bounded recursive-improvement patterns are measurable, repairable, or unsafe. Negative evidence, such as the April carrier-transfer limitation, will be reported explicitly.

## 200-Word Alignment With Mathematics for Safe AI

This proposal aligns with Mathematics for Safe AI by treating recursive improvement as a formal transition system rather than as a vague capability story. Each improvement attempt changes a state: model policy, tool graph, verifier, prompt, adapter, repair rule, or skill module. The safety question is whether properties are preserved under those transitions.

The project would define measurable objects: verifier invariants, latent anomaly observables, repair-cost curves, commit/veto policies, off-support transition metrics, and red/blue adaptation depth. BlueBeam supplies a latent-space detector for subtle tamper or drift signatures. MeTTa/TRM scaffolding supplies a symbolic control plane for expressing task graphs, verifier-visible defects, repair actions, and commit decisions.

This challenges purely benchmark-based safety evaluation. A model that passes a static test may still become unsafe when it learns to modify the test harness, improve its own tools, or exploit verifier blind spots. The proposed gym makes that failure mode explicit but contained.

The central mathematical question is: for a safety property \(P\), how does the cost of maintaining \(P\) grow as an adaptive agent repeatedly improves or modifies its local environment? If the curve bends sharply, the gym has identified a safety-critical transition regime.

## Why Hasn't It Been Done Yet?

Most AI safety evaluations are either static benchmarks or broad agent sandboxes. Static benchmarks rarely expose recursive improvement dynamics. Broad sandboxes are hard to instrument and can become unsafe or scientifically ambiguous.

This proposal sits between them. The gym allows bounded improvement actions, but only inside an air-gapped and typed environment. Every transition is logged, every proposed modification has a contract, and the detector stack measures both overt behavioural failure and latent drift.

The required components have only recently become practical:

- Open-weight and local models can now perform meaningful agentic tool use.
- Sparse/latent methods can expose behaviour-linked internal signals.
- Symbolic scaffolds such as MeTTa can express task graphs and state constraints.
- Small recursive modules can be trained for repair, verifier, and commit/veto subtasks.
- Local GPU workstations can support enough repeatable runs for seed-stage evidence.

My recent work has already prototyped the pieces separately: BlueBeam for latent tamper detection, MeTTa/TRM skills for verifier-visible repair curricula, and storyworld/They Sing harnesses for long-horizon agent traces. The April BlueBeam results also show the kind of evidence standard I want the gym to enforce: benign controls, held-out transfer checks, real train/dev/test splits, and explicit negative results when a carrier surface degenerates. The ARIA project would integrate these into one safety-math instrument.

## Steps To Deliver

Month 1: define the RSI gym contract schema and baseline task families. The first tasks will be benchmark-safe: tool-call repair, verifier threshold tuning, prompt-graph modification, symbolic skill routing, and bounded policy repair. Deliverable: runnable harness, schema, and baseline tests.

Months 2-3: integrate BlueBeam probes and MeTTa/TRM gates. Each improvement proposal will be evaluated by behavioural tests, symbolic validators, latent anomaly scores, and commit/veto policies. The BlueBeam integration will start from the April evidence pattern: retained signals, benign-shift controls, held-out transfer probes, and negative-control procedure families. Deliverable: first red/blue loop with logged improvement attempts and failure labels.

Months 4-5: run controlled experiments. Compare static agents, agents allowed bounded improvement, agents monitored by BlueBeam only, agents monitored by MeTTa/TRM only, and agents monitored by the combined stack. Measure violation rate, repair cost, latent drift, verifier disagreement, and performance gain. Require split-aware reporting and carrier/setting limitations, so improvements cannot be promoted from one favorable surface to a universal claim.

Month 6: package the research. Deliverables: open protocol, reproducible harness, selected logs, failure taxonomy, metrics report, and a paper-style writeup on recursive safety curves and bounded RSI monitoring.

## Why Me / Team Fit

I am already building the relevant components rather than proposing them abstractly. BlueBeam studies calibrated latent indicators of subtle model tampering and, in the April work, extends that into benign-quietness tests, partial held-out transfer, and split-aware compositional-context detection. My MeTTa/TRM paper studies how symbolic task graphs and recursive modules can convert semi-failed agent outputs into repair, verifier, and commit/veto training data. My They Sing/storyworld work supplies long-horizon environments with hidden state, public/private divergence, negotiation, and delayed consequences.

This project needs someone comfortable operating across mechanistic signals, agent harnesses, symbolic scaffolds, local-model evaluation, and speculative but controlled safety environments. That is the niche my recent work occupies.

The next collaborator I would most want is a mathematically strong evaluator who can help formalise the recursive safety curves: transition systems, invariants, repair-cost growth, and drift metrics. A second useful collaborator would be an ML systems engineer for robust local inference and air-gapped experiment operations.

## Research Questions

1. Can recursive improvement be made into a typed, auditable transition system?

2. Which safety properties survive bounded self-improvement, and which fail after a few adaptive rounds?

3. Do latent anomaly signals detect verifier drift or hidden policy shift before behavioural tests fail?

4. Do MeTTa/TRM repair and commit/veto gates reduce unsafe improvement proposals, or merely clean up local syntax errors?

5. Does safety-maintenance cost grow smoothly with red-team depth, or show sharp transition thresholds?

6. Which improvement channels are most dangerous: prompt rewriting, verifier tuning, tool graph modification, data curation, adapter updates, or repair-module edits?

## Experimental Substrates

Primary benchmark-safe substrates:

- Tool-call contract repair.
- Shell-safe planning and command veto.
- JSON/schema repair under adversarial traps.
- Verifier threshold tuning.
- Prompt-graph and skill-graph modification.
- MeTTa/TRM repair-curriculum generation.
- BlueBeam-style latent drift tests with benign-shift and held-out transfer controls.
- IACDojo-style compositional-context risk tests using real train/dev/test splits.

Optional long-horizon substrates:

- They Sing strategic traces.
- Storyworld hidden-variable navigation.
- Treaty/corrigibility/escalation decision gates.
- Public/private divergence detection.

The application should lead with the primary substrates and mention They Sing as an extension, not the central claim.

## Metrics

- Final task success.
- Unsafe proposal rate.
- Invalid action rate.
- Verifier disagreement rate.
- Commit/veto accuracy.
- Repair success rate.
- Latent anomaly score.
- Policy divergence from baseline.
- Performance gain per improvement round.
- Safety violation rate per improvement round.
- Cumulative repair cost \(R(k)\).
- Estimated growth shape of safety-maintenance cost over red-team depth.

## Claim Boundaries

Do claim:

- The project studies bounded recursive improvement, not unbounded RSI.
- The air-gapped gym is a safety-evaluation instrument.
- BlueBeam provides latent observables for tamper/drift signals.
- MeTTa/TRM provides symbolic verifier/repair control structure.
- The output is a measurable red/blue methodology and dataset.
- Negative results and carrier limitations are part of the method, not failures to hide.

Do not claim:

- This safely enables real-world autonomous self-improvement.
- BlueBeam detects all tampering.
- MeTTa/TRM solves alignment.
- Storyworlds predict real ASI politics.
- Small-model results automatically transfer to frontier systems.
- One favorable carrier or held-out split proves universal latent generalization.

## Budget

Current funding request: GBP 40,000 for a 6-month individual-led seed project.

Use the existing budget file:

- `designdocs/ARIA_40K_GBP_BUDGET.md`
- `designdocs/ARIA_40K_GBP_BUDGET.csv`

Budget breakdown:

- UK travel: GBP 2,500.
- Lodging near Waltham Crossing: GBP 14,000.
- Food allowance: GBP 4,900.
- 5090-equipped workstation: GBP 5,000.
- Project software/API/cloud/hosting costs: GBP 3,500.
- General PI compensation: GBP 3,000.
- Organisation setup, accounting, insurance, and admin: GBP 2,000.
- Documentation, publication, dissemination, and contingency: GBP 5,100.

Total: GBP 40,000.

Budget rationale:

The budget is intentionally lean. Most research labour is contributed directly by the applicant. The funds cover a UK research period, subsistence, a local 5090-class workstation for air-gapped reproducible experiments, modest PI compensation, project operating costs, and enough documentation/dissemination budget to publish the resulting protocol and evidence package.

## Short Form For Application Box

I propose to build an air-gapped red-team RSI gym for studying bounded recursive agent improvement under mathematical safety constraints. The project combines my BlueBeam work on calibrated latent detection of subtle model tampering with my MeTTa/TRM work on symbolic repair curricula for agent skills. April BlueBeam experiments provide the evidence pattern: retained latent signals quiet under three benign controls, partial held-out transfer from orchestration to manipulation, split-aware compositional-context detection with test AUROC `0.5866` to `0.7526`, and explicit limits where cross-carrier transfer fails. In the gym, agents attempt bounded improvements to tools, prompts, policies, verifiers, repair modules, or skill graphs. Each proposed improvement is evaluated by behavioural tests, symbolic validators, BlueBeam latent probes, and MeTTa/TRM commit-veto gates.

The scientific question is whether recursive improvement can be made measurable, interruptible, and mathematically constrained. For each red-team depth \(k\), the system records performance gain, violation rate, verifier disagreement, latent anomaly score, policy divergence, and repair cost. This gives a recursive safety curve: does the cost of preserving a safety property grow smoothly, break at thresholds, or become super-polynomial under adaptive pressure?

The output would be a reproducible harness, benchmark-safe task families, failure taxonomy, selected logs, metrics report, and methodology for studying bounded RSI without deploying autonomous systems in the real world.
