# They Sing UX QA Playtest

## Current Release

- Production: <https://they-sing.vercel.app>
- Current UX baseline: `main` (globe-first observatory and responsive legacy command deck)
- Default route: evidence observatory
- Legacy playable route: `?game`

## Confirmed Findings And Fixes

| Severity | Finding | Resolution | Evidence |
| --- | --- | --- | --- |
| P1 | The loading screen disappeared on a timer before the 5.8 MB replay was fetched and parsed. | Readiness now follows `theysing:ready`; streamed fetch progress updates the loading state. | Production HTML contract, TypeScript build, live replay fetch. |
| P1 | Tablet/mobile evidence cards wrote details into a panel hidden by responsive CSS. | Evidence opens a dismissible responsive detail sheet at both breakpoints. | CSS/DOM UX contract, build, and Chrome mobile detail capture. |
| P2 | Space or arrow keys on a focused button could trigger both the button and a global replay shortcut. | Global shortcuts now ignore buttons, links, labels, inputs, selects, text areas, content-editable elements, and button roles. | Static UX regression contract and TypeScript build. |
| P2 | The mobile panel button described the current panel rather than the action. | Labels now read `Show diary` and `Show evidence`, with `aria-pressed` state. | Static UX regression contract. |
| P2 | Stateful controls and custom visual buttons lacked consistent keyboard feedback. | Added `aria-pressed`, range value text, live status/evidence regions, and visible `:focus-visible` treatment. | Static UX regression contract and build. |
| P1 | The legacy `?game` route placed six fixed-width panels around the map with no responsive breakpoint, causing unavoidable overlap below desktop width. | Added a mobile command deck with single-sheet `STATUS`, `SELECT`, `ORDERS`, and `LOG` views; phase and observer context remain visible. | Static legacy UX contract and TypeScript build. Headed visual confirmation remains pending. |
| P2 | Legacy global shortcuts could advance the phase behind focused controls, the tutorial, or a decision modal. | Shortcuts now ignore interactive descendants and halt while a blocking overlay is open. | Static legacy UX contract and TypeScript build. |
| P2 | Legacy dialogs, event narration, panel state, focus, and motion preferences were not exposed consistently. | Added modal/live-region semantics, focus transfer/restore, pressed panel state, visible focus, and reduced-motion handling. | Static legacy UX contract and TypeScript build. |
| P1 | The observatory treated the 3D globe as background behind two permanent side panels, an aggregate claim rail, a detail placeholder, and a three-column footer. | The observatory now opens in `Globe` mode with a plain-language current beat; `Evidence`, `Diary`, and desktop `All` are explicit modes. | Static globe-first contract, TypeScript build, and desktop/mobile Chrome captures. |
| P1 | Evidence mixed filters, protocol traces, research, events, board changes, and the anomaly archive into one continuous technical scroll. | The evidence drawer now uses `Now`, `Protocol`, `Research`, and `Archive` tabs with proper tab semantics. | Static progressive-disclosure contract and TypeScript build. |
| P2 | Mobile offered one ambiguous evidence/diary toggle and had no way to reclaim the full globe. | Mobile uses the same explicit `Globe`, `Evidence`, and `Diary` modes; reset camera remains available beside replay controls. | Static responsive UX contract. |
| P1 | The globe's colors, persistent beacons, effects, and logged locations were not explained or connected to the current-beat prose. | Current beats now show colored actors, signal progress, and location labels; selecting one focuses its logged node or edge. A compact key identifies all seven ASIs and four scene-signal forms: beacons, arcs, rings, and clusters. | Static globe-comprehension contract and TypeScript build. Headed visual confirmation remains pending. |
| P1 | Scene-event effects had no hover affordance, contextual label, or keyboard/touch equivalent. | Mouse hover now changes the cursor and presents a bounded evidence tooltip. The bounded World key lists every logged scene-event effect on the current turn as an ordinary locate-and-inspect button, while the canvas is hidden from accessibility APIs as a duplicate visual surface. | Static pointer/accessibility contract, production-replay coverage audit, and TypeScript build. Headed visual confirmation remains pending. |
| P1 | Sequential word animation could not finish before 3.6-second autoplay advanced the phase. | The diary now renders complete blocks immediately with a bounded 55ms stagger; p90 completion is 0.87s for both public and retrospective views. | Automated UX replay evaluator and TypeScript build. |
| P1 | Raw phases placed up to 18 equally salient effects on the globe. | Three.js now selects at most eight high-intensity/diverse effects while the World key retains the complete phase index. | Automated UX replay evaluator and static scene-budget contract. Headed composition confirmation remains pending. |
| P1 | The spectator replay sorted phase names alphabetically, placing action and allocation before negotiation and manufacturing resolution-board churn. | Export now uses the engine's cognitive-clock order and unique inferred build identities; stationary type/owner changes cannot be labeled as movement. | Public replay audit, automated chronology/identity regression checks, and UX evaluator. |
| P2 | Same-actor actions at the same location repeated as separate beat copy, World-key buttons, and globe effects. | Current beat, keyboard/touch index, and Three.js selector now share conservative signal grouping; 398/1,143 raw signals collapse into 745 groups while raw indexes and payloads remain available. | Replay-derived grouping tests, UX evaluator, static payload/index contract, and TypeScript build. |
| P1 | Late turns rendered up to 311 overlapping unit meshes and detached transient geometry without disposing GPU resources. | Units now cluster exactly by location, owner, type, and evidence status, reducing the peak to 51 markers; markers spread locally, scale by count, retain every unit payload, and transient groups dispose resources before replacement. | 64-cluster publication gate, replay-derived accounting test, static lifecycle contract, evaluator, and TypeScript build. |
| P1 | The globe rendered continuously at DPR 2 regardless of mobile input, reduced-motion preference, hidden tabs, offscreen state, or evidence-only views. | Rendering now pauses while hidden/offscreen, uses 60/30/15/12 FPS desktop/mobile/background/reduced policies, caps DPR at 2/1.5/1.25, and disables ambient motion under reduced motion. | Pure render-policy regression, visibility/observer lifecycle contract, view-mode integration, and TypeScript build. |
| P2 | Every phase consumed 3.6 seconds and autoplay continued in hidden tabs, making a 156-phase pass take 9.36 minutes and letting users return to an unexpected turn. | Signals retain 3.6 seconds, 41 quiet phases use 1.2 seconds, playback exposes 0.5x/1x/2x/4x, hidden tabs suspend, and loading a replay resets playback. | Pure pacing regression, canonical 7.72-minute duration gate, evaluator, visibility lifecycle contract, and TypeScript build. |
| P1 | Ownership halos, unit clusters, and route state were interactive only inside an `aria-hidden` canvas, leaving no keyboard/touch evidence equivalent. | Evidence/Now now includes a collapsed, lazy Board State index with every node, exact force cluster, and route as a locate-and-inspect button; the canonical peak is 72 controls with no slicing. | Dataset accounting, source contract, focus/payload checks, bounded presentation, evaluator, and TypeScript build. |
| P2 | Evidence used ARIA tab roles without implementing the associated keyboard pattern or panel labels. | The four-tab set now has one roving tab stop, Left/Right/Home/End automatic activation, stable tab IDs, and matching `aria-labelledby` panels. | Dedicated keyboard/relationship regression and TypeScript build. |
| P1 | Autoplay could replace focused controls, close details, and advance away while a user inspected evidence; exact node/edge shots were then overwritten by generic subgenre cameras. | Manual step/jump/scrub, evidence/diary views, tabs, filters, archive search, World/Board expansion, and detail opening now pause autoplay; scheduler steps bypass the pause, and location-aware evidence preserves its camera target. | Dedicated inspection/focus lifecycle regression and TypeScript build. |
| P2 | Selected Evidence opened visually without receiving focus, interactive controls swallowed Escape, and closing the sheet did not return keyboard users to their origin. | The sheet is now a labelled non-modal dialog; opening focuses Close, Escape dismisses before the interactive-control guard, and dismissal restores a still-connected origin control. | Dedicated dialog focus-lifecycle regression and TypeScript build. Headed keyboard confirmation remains pending. |
| P1 | The unavailable app browser left Three.js composition, responsive panels, and focus presentation uninspected. | Added an installed-Chrome CDP bridge with isolated profiles, full and quick screenshot matrices, content-specific replay stress phases, layout/runtime/focus receipts, and canvas-size enforcement. | `scripts/capture-observatory-ux.cjs`, dedicated regression contract, and visual manifests under `D:\they-sing-results\ux-visual-captures`. |
| P1 | Desktop drawers and Selected Evidence extended 28px behind the footer, while a low-value status block displaced move cards and the evaluation rail clipped the brand deck. | Drawers/details now stop above the footer, status remains an accessible live region without occupying the visual grid, move evidence gains the released width, and evaluation starts below the header. | Before/after desktop Chrome captures and zero-overlap geometry receipts. |
| P1 | Mobile Globe inherited the desktop footer grid because of selector specificity, exposing only Prev/Play beside move cards. | The mobile breakpoint now explicitly stacks timeline, moves, and controls; all five primary controls remain visible, with centered `390x844` Three.js canvas and drawer clearance. | Mobile Chrome capture, canvas/viewport receipt, and static regression contract. |

## Automated Gates

- `npm run ci`: 29/29 checks pass.
- Installed-Chrome visual bridge: five-state quick and ten-state full matrices; PNG, layout, runtime, focus, and replay-selection receipts.
- Default replay scene-accessibility gate: 1,142/1,143 signals can focus a valid graph location or faction beacon; the index supports the observed maximum of 18 signals in one phase.
- Production build: passes TypeScript and Vite compilation.
- Root live check: HTTP 200; readiness and loading listeners present.
- Replay live check: HTTP 200; correct cache policy; schema and evidence payload parse.
- Current connection sample: root TTFB 0.46s; replay TTFB 0.37s; replay transfer 0.68s.

## Browser Playtest Matrix

The Chrome bridge now covers the core desktop/mobile visual states. Pointer, hover, physical touch, real-GPU performance, and free-form interaction steps below remain manual completion gates.

### Desktop

1. Load from a cold cache and confirm progress remains visible through scene readiness.
2. Confirm the first usable state is the unobstructed globe plus one current-beat card, not open evidence drawers.
3. Switch among `Globe`, `Evidence`, `Diary`, and `All`; confirm the globe remains spatially continuous and drawer state is obvious.
4. In Evidence, switch among `Now`, `Protocol`, `Research`, and `Archive` without losing the selected campaign phase.
5. Scrub the full campaign and confirm current beat, moves, scene, diary, evidence, and campaign tempo stay synchronized.
6. Play/pause, then operate every focused button with Space/Enter and confirm no double activation.
7. Exercise every scene, faction, phase, moment, protocol, and reveal-gap filter.
8. Open aggregate claims, research lenses, protocol receipts, events, diffs, and anomalies; inspect and close details.
9. Toggle public/private reveal and confirm the distinction is legible rather than merely changing text density.
10. Orbit, zoom, reset, and use subgenre camera focus without losing the selected turn.
11. Load a replay file and export a spectator clip.
12. Open the World key, locate each ASI, and verify the matching beacon pulses without changing the replay turn.
13. Select beats with node, edge, and orbital locations; confirm the camera visibly targets the corresponding scene signal.
14. Hover beacons, arcs, rings, units, and anomalies; confirm the cursor and tooltip update without flicker, clipping, or stale content after dragging.
15. Open the World key and operate every Visible now signal with keyboard only; confirm each targets the same object available through the canvas.

### Tablet And Mobile

1. Confirm Globe mode leaves the 3D scene operable and the current-beat card, timeline, moves, and controls do not overlap.
2. Horizontally inspect evaluation cards and moves; verify scroll affordances are apparent.
3. Switch among `Globe`, `Evidence`, and `Diary`; verify the selected mode remains visibly pressed.
4. Open details from claims, research lenses, protocol evidence, events, and anomalies; confirm the detail sheet is readable and dismissible.
5. Scrub while a detail is open and confirm stale evidence closes.
6. Rotate portrait/landscape and confirm the active panel remains usable.
7. Test reduced-motion and keyboard navigation where supported.
8. Open the World key and confirm it remains bounded, tappable, and does not trap access to the timeline or Globe mode.
9. Tap each Visible now signal and confirm it focuses the scene and opens a dismissible evidence sheet without requiring hover.

### Legacy Game

1. Open `?game` and verify faction switching, order submission, phase advance, camera controls, and auto-play.
2. At tablet/mobile widths, switch among `STATUS`, `SELECT`, `ORDERS`, and `LOG`; confirm one readable sheet is visible and the map remains operable.
3. Select map nodes and units and confirm the `SELECT` sheet opens automatically.
4. Walk the tutorial and confirm each referenced mobile sheet opens, focus starts on `NEXT`, Escape closes the tutorial, and focus returns to its trigger.
5. Open a build/research modal and confirm global Space/number/camera shortcuts do not run behind it.
6. Confirm the legacy route signals readiness and does not retain observatory overlays.

## Remaining Risks

- The screenshot bridge uses software-rendered Chrome and emulated touch dimensions; physical touch, real-GPU performance, hover, rotation, and cold-cache behavior remain manual checks.
- The bridge captures deterministic PNG evidence but does not yet perform pixel-diff baselining or direct pointer interaction against Three.js objects.
- The corrected replay is 7.12 MB uncompressed and approximately 655 KB gzip. Current delivery reports progress, but parsing and scene setup on slower mobile devices still need a cold-cache playtest.
- The canonical long replay now preserves rich protocol actions and matches turns 1-2, but diverges at turn 3 during turn-end processing. Do not claim full regenerated replay determinism yet.
- Grouping removes within-phase visual repetition, but the 27.2% unique raw-summary rate still reflects repetitive strategy across campaign turns; that requires agent/gameplay variation rather than more paraphrasing.
- Vercel reports legacy transitive dependency audit warnings; they are not caused by these UX changes but remain a separate maintenance issue.
