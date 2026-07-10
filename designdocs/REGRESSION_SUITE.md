# They Sing Regression Suite

Run:

```powershell
npm test
```

Equivalent:

```powershell
npm run test:regression
```

Full local CI gate:

```powershell
npm run ci
```

The suite builds the harness, then runs `scripts/run-regression-suite.cjs`.

## Coverage

- Compiled harness artifacts exist.
- Deterministic engine replay is stable for the same seed.
- Engine invariants stay bounded across deterministic phase advancement.
- Forced goblin incidents remain bounded, emit `GOBLIN_INCIDENT`, and export to observatory replay as `GOBLIN_GLITCH`.
- A short five-faction heuristic harness session emits JSONL with session, turn, negotiation diary, and phase diary records.
- The observatory exporter turns harness JSONL into a strict replay with graph metadata, per-turn arrays, board state, and board diffs.
- The public sample observatory replay remains loadable.

## Outputs

Each run writes:

```text
results/regression/<timestamp>/regression_summary.json
```

Harness logs and exported replay smoke files are kept under the same timestamped directory so another agent can inspect failures.

## Intent

This is an alpha regression gate, not a full balance test. It catches broken mechanics, invalid replay exports, missing logs, schema drift, and obvious state-bound violations before longer Monte Carlo batches.

GitHub Actions runs `npm run ci` on push to `main`/`master` and on pull requests.
