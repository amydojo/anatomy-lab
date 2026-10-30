# V13 release candidate — NOT RELEASE READY

Audit date: 2026-10-30. Starting checkpoint: 4238b3c07d166ff6fb37acd25f68d495677cb2d4.

## Integration map

main (2d52a27) and the feature stack diverge at a0863916. main has one documentation commit absent from the feature stack. Do not replace main with the feature branch.

V11 feat/v11-pelvis-temporal-registration (1e37e81) → PR29 V12 (d0cf80a) → PR30 V12.1 (99fb007) → PR31 V13 (4238b3c) → release/v13-rc.

The V13 checkpoint contains 454 commits absent from main. PR29 is draft and targets the unmerged V11 branch; PR31 is draft. Do not squash the three named PRs independently without accounting for their ancestry. Resolve and verify the older feature stack and main documentation before producing a final integration PR.

## Changes in this stabilization branch

- Region-specific short-head biceps identity prevents the knee's biceps femoris record overwriting shoulder biceps brachii.
- Removed text-based muscle classification from the mobile fallback. Unmapped records remain Anatomical structure rather than guessing from words in descriptions.
- Motion action explicitly describes regional teaching motion; it does not imply a verified selected-muscle action.
- Playwright pinned to 1.56.0 with lockfile to match CI browser image. Added complete regression workflow for this release branch and V13.
- Added browser regression cases for colliding regional structure IDs.

## Evidence and limitations

Before edits: JavaScript source suite 32 passed, 0 failed; Python suite 18 passed, 0 failed.

Local browser attempt at checkpoint: 334 Chromium cases discovered, 80 browser launch failures, 254 not run, 0 passed. System Chromium failed socket() with Operation not permitted before app execution. Downloaded browser archives were invalid/truncated. This is infrastructure failure, not an application failure diagnosis. WebKit was not executed. No physical iPhone or remote device session was available.

No npm build script exists; this is a static HTML/JS application. A production build/deployment has not been validated for the candidate.

Vercel API reports production READY at 2d52a27bc9a99edc67580a6d66a0fe264758afac, URL https://anatomy-86sv9xglp-amy-dos-projects.vercel.app. Latest listed preview is 11e6b88420748b2450f4afa7e27b8805893acaa7, URL https://anatomy-24fbh67q3-amy-dos-projects.vercel.app. Neither is the V13 checkpoint. URLs not browser-verified.

## Anatomy evidence gate

Seven V13 seeded records exist. Zero claim-level verifications were completed in this audit: reference retrieval returned tool errors. Broad chapter citations do not satisfy the release gate. Do not expand or claim verified coverage until each claim has an inspected section/table and explicit source locator. Existing legacy descriptions also require review. Geometry/source integrity tests are distinct from factual claim verification.

Not completed: verified relationship highlighting, supported attachment highlighting, selected-structure motion mapping, desktop progressive inspector parity, full performance profiling, real touch WebKit regression. Mobile wheel test remains skipped; synthetic pointer tests are not physical touch validation. Direct Move handling needs multi-pointer conflict verification: the primary joint drag currently persists when a second touch arrives.

## Real iPhone manual QA

Use the exact candidate SHA preview; record model, iOS/Safari version and URL.

- Open all ten regions directly and via picker; Back/Forward and region switching preserve selection and labels.
- Sciatic direct link reaches a visible interactive nerve source viewer; leave and return repeatedly.
- Overview Move opens picker; joint Move changes angle, respects limits and resets neutral.
- Start joint drag, add a second finger, pinch/pan, then lift either finger; no simultaneous orbit/joint change or stuck drag.
- Select bone and muscle, open/close/expand inspector, clear and switch regions; verify title, fallback and source references.
- Test 375px-class and short landscape screens, safe areas, keyboard focus, scrolling and navigation overlap.
- Repeat navigation for 10 minutes; background/foreground Safari; inspect WebGL loss, loading errors and resource stability.

## Release recommendation

HOLD. Leave all existing PRs open. Complete claim-level audit, remaining spatial/desktop features, full browser CI and verified candidate preview before considering merge. Physical-device QA must remain explicitly unverified unless performed. Branch protections and required approvals have not yet been verified; no bypass is authorized.
