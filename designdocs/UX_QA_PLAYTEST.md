# They Sing UX QA Playtest

## Current Release

- Production: <https://they-sing.vercel.app>
- UX fix commit: `880fb99`
- Default route: evidence observatory
- Legacy playable route: `?game`

## Confirmed Findings And Fixes

| Severity | Finding | Resolution | Evidence |
| --- | --- | --- | --- |
| P1 | The loading screen disappeared on a timer before the 5.8 MB replay was fetched and parsed. | Readiness now follows `theysing:ready`; streamed fetch progress updates the loading state. | Production HTML contract, TypeScript build, live replay fetch. |
| P1 | Tablet/mobile evidence cards wrote details into a panel hidden by responsive CSS. | Evidence opens a dismissible responsive detail sheet at both breakpoints. | CSS/DOM UX contract and build. Headed visual confirmation remains pending. |
| P2 | Space or arrow keys on a focused button could trigger both the button and a global replay shortcut. | Global shortcuts now ignore buttons, links, labels, inputs, selects, text areas, content-editable elements, and button roles. | Static UX regression contract and TypeScript build. |
| P2 | The mobile panel button described the current panel rather than the action. | Labels now read `Show diary` and `Show evidence`, with `aria-pressed` state. | Static UX regression contract. |
| P2 | Stateful controls and custom visual buttons lacked consistent keyboard feedback. | Added `aria-pressed`, range value text, live status/evidence regions, and visible `:focus-visible` treatment. | Static UX regression contract and build. |
| P1 | The legacy `?game` route placed six fixed-width panels around the map with no responsive breakpoint, causing unavoidable overlap below desktop width. | Added a mobile command deck with single-sheet `STATUS`, `SELECT`, `ORDERS`, and `LOG` views; phase and observer context remain visible. | Static legacy UX contract and TypeScript build. Headed visual confirmation remains pending. |
| P2 | Legacy global shortcuts could advance the phase behind focused controls, the tutorial, or a decision modal. | Shortcuts now ignore interactive descendants and halt while a blocking overlay is open. | Static legacy UX contract and TypeScript build. |
| P2 | Legacy dialogs, event narration, panel state, focus, and motion preferences were not exposed consistently. | Added modal/live-region semantics, focus transfer/restore, pressed panel state, visible focus, and reduced-motion handling. | Static legacy UX contract and TypeScript build. |

## Automated Gates

- `npm run ci`: 16/16 checks pass.
- Production build: passes TypeScript and Vite compilation.
- Root live check: HTTP 200; readiness and loading listeners present.
- Replay live check: HTTP 200; correct cache policy; schema and evidence payload parse.
- Current connection sample: root TTFB 0.46s; replay TTFB 0.37s; replay transfer 0.68s.

## Headed Playtest Matrix

These flows require an actual browser viewport and remain the completion gate.

### Desktop

1. Load from a cold cache and confirm progress remains visible through scene readiness.
2. Scrub the full campaign and confirm moves, scene, diary, evidence, and campaign tempo stay synchronized.
3. Play/pause, then operate every focused button with Space/Enter and confirm no double activation.
4. Exercise every scene, faction, phase, moment, protocol, and reveal-gap filter.
5. Open aggregate claims, research lenses, protocol receipts, events, diffs, and anomalies; inspect and close details.
6. Toggle public/private reveal and confirm the distinction is legible rather than merely changing text density.
7. Orbit, zoom, reset, and use subgenre camera focus without losing the selected turn.
8. Load a replay file and export a spectator clip.

### Tablet And Mobile

1. Confirm the title, evaluation strip, 3D scene, evidence sheet, timeline, moves, and controls do not overlap.
2. Horizontally inspect evaluation cards and moves; verify scroll affordances are apparent.
3. Switch between evidence and diary using the action-labelled control.
4. Open details from claims, research lenses, protocol evidence, events, and anomalies; confirm the detail sheet is readable and dismissible.
5. Scrub while a detail is open and confirm stale evidence closes.
6. Rotate portrait/landscape and confirm the active panel remains usable.
7. Test reduced-motion and keyboard navigation where supported.

### Legacy Game

1. Open `?game` and verify faction switching, order submission, phase advance, camera controls, and auto-play.
2. At tablet/mobile widths, switch among `STATUS`, `SELECT`, `ORDERS`, and `LOG`; confirm one readable sheet is visible and the map remains operable.
3. Select map nodes and units and confirm the `SELECT` sheet opens automatically.
4. Walk the tutorial and confirm each referenced mobile sheet opens, focus starts on `NEXT`, Escape closes the tutorial, and focus returns to its trigger.
5. Open a build/research modal and confirm global Space/number/camera shortcuts do not run behind it.
6. Confirm the legacy route signals readiness and does not retain observatory overlays.

## Remaining Risks

- No browser surface was exposed during this QA pass, so canvas composition, text clipping, viewport overlap, and touch ergonomics are not visually proven.
- There is no automated Three.js screenshot baseline or canvas interaction test.
- The replay is 5.79 MB uncompressed. Current delivery is fast and now reports progress, but slower mobile networks still need a cold-cache playtest.
- Vercel reports legacy transitive dependency audit warnings; they are not caused by these UX changes but remain a separate maintenance issue.
