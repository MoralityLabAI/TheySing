# They Sing Visual Capture Bridge

## Purpose

`scripts/capture-observatory-ux.cjs` drives an installed Chrome or Edge binary through the Chrome DevTools Protocol. It exists so visual replay QA does not depend on the in-app browser connector.

The bridge uses an isolated temporary browser profile. It does not read or modify the user's normal browser profile, cookies, or sessions.

## Commands

Full ten-state production matrix:

```powershell
npm run playtest:capture-ux
```

Five-state production iteration matrix:

```powershell
npm run playtest:capture-ux:quick
```

Custom URL or destination:

```powershell
node scripts/capture-observatory-ux.cjs --quick --url http://127.0.0.1:4173/ --output-dir D:\they-sing-results\ux-visual-captures\local-quick
```

Pass `--headed` to show the isolated controlled browser. Pass `--browser PATH` when Chrome or Edge is installed outside the standard Windows locations.

By default, artifacts go to `D:\they-sing-results\ux-visual-captures\<timestamp>` when `D:` exists, otherwise to the ignored repo `results/ux-visual-captures` directory.

## Capture Matrix

The full matrix records:

- Desktop Globe at the replay's densest scene-event phase.
- Desktop Evidence/Now and Selected Evidence at the densest phase.
- Desktop Protocol and All at the phase with the most protocol records.
- Desktop Diary at the phase with the most messages and diaries.
- Mobile Globe, Evidence/Now, Diary, and Selected Evidence at `390x844`.

The quick matrix records desktop Globe, Evidence/Now, Selected Evidence, mobile Globe, and mobile Selected Evidence.

Each device class reloads after applying device metrics. The run fails if the Three.js canvas does not match the emulated viewport.

## Artifacts

Every run emits:

- One PNG per state.
- `visual_capture_manifest.json` with viewport, panel bounds, overflow, overlap, text clipping, control size, canvas size, focus lifecycle, console errors, runtime exceptions, and network failures.
- `visual_capture_report.md` with a compact state table and warnings.

Selected Evidence receipts prove focus moves from the trigger to Close and returns to the same connected trigger after Escape.

The bridge is a deterministic inspection aid, not a replacement for physical touch, hover, real-GPU performance, rotation, cold-cache, or free-form usability testing. It currently records screenshots but does not perform pixel-diff assertions.
