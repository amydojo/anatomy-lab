# BODY / LIVE V12 — QA repair matrix

Source: independent read-only BODY / LIVE report, 29 October 2026, Chrome/Linux cloud GPU and emulated mobile. **This file records implementation, not an independently verified pass.** Preview build-rate limitations and real-device gaps remain.

| ID | Original finding | V12 change | Verification |
| --- | --- | --- | --- |
| D1 | WebGL program error/blank canvas on resize | Guard invalid WebGL programs; uniform location cache; frame-deferred restoration; context-loss reconstruction; BFCache-safe pagehide | JS syntax checks pass; V12 resize test added, CI required |
| D2 | Sciatic nerve invisible, camera inside pelvis | Start sourced follow camera 30% along sciatic trunk with wider field of view | Source viewer screenshot/manual review still required |
| D3 | Camera zooms inside model and becomes off-frame | Bounds-informed max zoom; clamp pan and focal-point motion; existing Recenter retained | Regression added; desktop/mobile QA required |
| D4 | Region header stale on returning to body | Whole Body wins over stale transition region in mobile/desktop presentation; emit completion synchronization | Browser navigation test added |
| D5 | Right-edge button overlaps region sheet | V11 micro controls hidden when mobile region dialog is active | Mobile touch checks required |
| D6 | Explore mode click ignores structures | Existing hit testing is mode independent; selected source now deep-linkable; pointer-hit testing remains a QA priority | NOT VERIFIED, needs direct hit-test case |
| D7 | Skull obstructed by muscles on entry | Default sourced facial and regional muscles made translucent; dedicated muscle layer remains visible | Visual skull pass required |
| D8 | Unknown/alias URL silently fails | Ribs/sciatic and related aliases canonicalized; invalid region gets informative message | Deep-link regression/manual alias check |
| D9 | Neck vs cervical spine inconsistent | Shared primary label standardized to NECK; anatomical name remains in descriptive text | DOM review |
| D10 | Layer/tool/structure missing from URL | Serialize useful state; verify and restore selected sourced structure after detailed geometry loads | Deep-link regression added |
| D11 | Short viewport sheet footer clipped | Scrollable picker with safer max height and bottom scroll space | 375x667 regression added |
| D12 | Missing favicon | SVG favicon and explicit document link | Validate HTTP 200 in deployed preview |
| S1 | Canvas blank after Back | Preserve resources in BFCache and restore; deterministic popstate + state sync | Browser-history regression added |
| S2 | Muscles control unresponsive on mobile | Functional muscle emphasis for knee/hip/shoulder; extended regions use existing source-muscle depth | UI regression still required |
| S3 | GPU stall/ReadPixels | Repeated shader uniform lookup removed; no assumption that screenshot-driver ReadPixels is app picking | GPU profiling on real and virtual hardware REQUIRED |
| S4 | Phone overlays cover anatomy | Shader gets vertical camera anchor; mobile panel changes anchor without resizing canvas | Visual QA required |
| S5 | Sparse connective layer | Source-limited; no absent anatomy fabricated | Content/evidence labeling still needs product review |
| S6 | Browser history odd | Route pushState, filtered replaceState, popstate navigation and asynchronous transition suppression | Browser history regression added |

## Source integrity and delivery
- Base: `feat/v11-pelvis-temporal-registration` (PR #28); V12 branch contains only stabilization changes.
- V9–V11 mesh inventories, geometry provenance, licenses, registration constraints and unreviewed biomechanics remain unchanged.
- Favicon is newly authored vector artwork; no externally sourced assets were imported.
- The branch is **not approved for production merge** until workflow and independent visual inspection pass.

## Follow-up validation
1. Run `npm test` (source integrity/attribution); inspect results.
2. Run `npx playwright test tests/v12-stabilization.spec.mjs --reporter=line` for Chromium mobile/Desktop and WebKit mobile.
3. Run `npm run test:e2e` to catch V6–V11 regressions.
4. Repeat exact D1 manual resize route at 1280×800 → 390×844, and browser Back from three regions.
5. Visually inspect Sciatic, Skull, muscle layer, and obstructed touch targets.
6. Repeat pinch and BFCache tests on real iOS Safari and Android Chrome.
7. Profile long tasks and GPU stalls, differentiating app draw/picking from screenshot capture.

### Release gate
Never report a defect as **verified fixed** until its test passes on the target commit. Preserve any failures in the issue/PR until resolved.
