# V13 stabilization — release held

No merge or production deployment is authorized. All existing PR bases remain intact.

## Verified baseline

PR #32 head: `0371af182f8310af21ae80f25762aec06ad35dab`.
GitHub tested its synthetic merge commit `99c60975a0d6bfb9594a4b4e1a22e478322c9b17` into V13 checkpoint `4238b3c07d166ff6fb37acd25f68d495677cb2d4`.
[Completed run 41086354295](https://github.com/amydojo/anatomy-lab/actions/runs/41086354295): 436 passed, 52 failed, 19 skipped, 40.9 minutes. Source suite: 32/32; Python suite: 18/18.

| Browser | Passed | Failed | Skipped |
|---|---:|---:|---:|
| Mobile Chromium | 145 | 15 | 9 |
| Mobile WebKit | 143 | 16 | 10 |
| Desktop Chromium | 148 | 21 | 0 |

Exact baseline preview: https://anatomy-d8nubxi2i-amy-dos-projects.vercel.app/atlas/ (Vercel READY metadata at `0371af1`, previously confirmed; hosted interactive QA not completed).

## Every failure accounted for

| Failure group | Cases | Diagnosis and action |
|---|---:|---|
| V8/V9/V10/V11 readiness | 27 | Actual defect: V11 verifier receives null optional facial data, then dereferences v10.parts. Fix accepts an absent optional facial inventory while preserving checksum, source, license, geometry and duplicate checks. New executable VM regression reproduces the runtime call and tests negative cases. Browser rerun required. |
| Ten-region nerve state | 3 | Test queries unified.region for the intentionally separate nerve source, whose state owner is top-level region. Correct state-owner assertion; also require visible source opener, explicit handoff, detail state and loaded nerve source. |
| Knee Trace availability | 3 | Legacy test expects muscle mode disabled despite V12 explicitly enabling it. Replace with enabled assertion and verify trace rendering state, retaining isolation assertions. |
| Mobile direct selection | 2 | Inspector automatically opens on selection; test clicks the active toggle and closes it. Assert automatic activation and visible identity rather than toggling twice. |
| Shoulder motion label | 3 | Legacy label says abduction; current coordinated profile says elevation. Assert exact current label; preserve motion and geometry checks. |
| Shoulder rig diagnostics | 3 | Actual UI regression: legacy diagnostic tools are hidden by both mobile and desktop rebuild CSS. Place original controls in existing Move tray; no duplicate controls. Test accesses them through Move. |
| Mobile secondary motion after switch | 3 | Move resets to Explore during a transitional loading state. Preserve Move intent across region transfer, disable controls until eligible, require detail completion before layout assertions. |
| Desktop neutral screenshot | 7 | Suspected resource-loading race: rest screenshot precedes optional overview additions. Wait for complete facial/osteology loading before motion comparisons; retain pixel equality and motion-reset assertions. Root cause not yet browser-confirmed. |
| WebKit camera continuity | 1 | Still unresolved. Timing/render profiling needed. Keep original continuity assertion unchanged. |

These are diagnoses, not a claim that all 52 tests now pass.

## Other stabilization work

- Camera pointer handling respects a joint-owned prevented move while keeping coordinates current. A second finger relinquishes joint ownership and initializes camera pinch at the current centroid. Pointer cancel/lost capture cleans up joint state. Executable core test checks no orbit during joint drag, focal handoff, no release selection, and recovery.
- Desktop progressive anatomy disclosure now lives inside the existing inspector; expand/collapse, clear, fallback and regional teaching-motion action are covered by a new browser case.
- Mobile WebKit bounds/recenter test now uses explicitly labeled pointer simulation instead of skipping mouse-wheel assertions. This is not physical touch or iPhone testing.
- Full CI is split into independent browser projects, with JSON results and per-browser evidence. BASE_URL support permits exact-preview checks without starting the local server. No assertion thresholds were relaxed.

## Seven-record anatomy audit

The original broad chapter citations were insufficient. Revised facts were read directly from OpenStax pages on 2026-10-30. Only the narrower supported claim set ships; unsupported original innervation, precise attachment and action claims were removed. This verifies educational text, not anatomy geometry or biomechanics.

| Record | Inspected passage | Supported facts retained |
|---|---|---|
| Patella | [8.4, Patella; Figure 8.16](https://openstax.org/books/anatomy-and-physiology-2e/pages/8-4-bones-of-the-lower-limb) | Sesamoid bone; in quadriceps tendon; distal femur articulation. |
| Femur | Same section, Femur; Figure 8.16 | Thigh bone; hip-bone and tibial articulations. |
| Tibia | Same section, introductory paragraph and Tibia | Medial, larger weight-bearing leg bone; femur/fibula relationships. |
| Scapula | [8.1, Scapula](https://openstax.org/books/anatomy-and-physiology-2e/pages/8-1-the-pectoral-girdle); [8.2, Humerus](https://openstax.org/books/anatomy-and-physiology-2e/pages/8-2-bones-of-the-upper-limb) | Shoulder blade; glenoid cavity articulation with humeral head. |
| Humerus | 8.2, Humerus; Figure 8.5 | Upper-arm bone; head articulates with scapular glenoid cavity. |
| Supraspinatus | [11.5, Muscles That Move the Humerus](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs) | Above scapular spine; abduction; tendon participates in scapula-to-humerus rotator cuff. |
| Gastrocnemius | [11.6, posterior leg compartment paragraph](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs) | Superficial calf muscle; soleus deeper. No head-specific attachments/actions claimed. |

Executable identity checks read the actual knee bone, shoulder and ankle muscle source inventories. Gastrocnemius uses exact medial/lateral right-head selection IDs, mapped to whole-muscle context; left-head aliases correspond to overview IDs. Exact matching replaces punctuation-stripping. Unknown IDs return null, never an inferred tissue class. Each record contains its section URL and passage locator.

## Remaining gates

- Await the new browser matrix. Do not treat source tests as interaction validation.
- Resolve WebKit camera continuity and investigate any remaining screenshot/reset failures from new evidence.
- Verify exact updated preview SHA and run hosted browser checks; BASE_URL alone is not proof this happened.
- Real iPhone Safari remains unverified. Check small-screen safe areas, direct joint drag → second finger → lift either finger, neutral reset, selection, scrolling, ten-region Back/Forward, sciatic handoff and repeated background/resume.
- Do not claim verified spatial attachment highlighting, biomechanical accuracy or expert review. Those remain source/review-limited.
- Integration remains unmerged V11 → #29 → #30 → #31 → #32. Main has separate documentation work; preserve it when integration is eventually authorized.

Recommendation: HOLD. No squash, merge, branch-protection bypass or production action.

## Source retrieval fingerprints

SHA-256 of retrieved HTML (direct HTTPS, 2026-10-30; dynamic site pages may change):

- openstax: `90d7a09613c700ad439427b26172965e27e57098803a4c9ba3ace048c47fc1f8`
- 8-1-the-pectoral-girdle: `f248fa1d0848aead70d501fdb23828b1dd66cfbb48ca8bd0728fd3f3ea823558`
- 8-2-bones-of-the-upper-limb: `ab3b7c0e7abb93ed11464c24fec7b1fd57abf7e10f19f58ceb4bdff3a2e7e79a`
- 11-5-muscles-of-the-pectoral-girdle-and-upper-limbs: `34cd301c269c74935cc58a548336578b3300d2a612ce876f091f828a4f5e3400`
- 11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs: `73ff220bc8d37f813613c9a0f30c90bf9634a5abbac9b445ca8dc167a5d2ec89`

## Completed stabilization rerun at 861f532

[Run 41098234215](https://github.com/amydojo/anatomy-lab/actions/runs/41098234215) tested application head `861f532bf5f0e0806ea419d696f0b2f84089c02b` (PR synthetic merge `0659282de7f93d04d713d5d854506353ed6dbd35`). Source suites passed in all browser jobs.

| Browser | Passed | Failed | Flaky | Skipped |
|---|---:|---:|---:|---:|
| Mobile Chromium | 160 | 1 | 0 | 9 |
| Mobile WebKit | 159 | 1 | 1 | 9 |
| Desktop Chromium | 162 | 8 | 0 | 0 |
| Total | 481 | 10 | 1 | 18 |

All former V11 loading, nerve-state, Trace, shoulder label, rig access and mobile-secondary cases passed. The remaining three inspector failures exposed a separate first-selection race: a synchronous sync caches the selected ID before the observer can auto-open Inspect. The sync function itself now opens the first selection; runtime fix commit `60caedde3b9246d782df58df136800f34d031806` also adds a mixed-pointer release/cancel regression and tolerates unavailable pointer capture during pointer simulation.

The seven desktop reset-image comparisons still failed after waiting for optional source loading. That hypothesis was disproven. Raw trace artifacts were retrieved and visually inspected; no verified anatomy drift diagnosis is asserted. The next test compares every decoded RGBA pixel exactly (zero tolerance), rather than PNG compression bytes, and retains both images plus camera/UI state if it fails. This is a test-environment correction/diagnostic change, not a claim that the rendering failure is repaired.

The WebKit camera-continuity case passed on retry and is still an unresolved flaky gate. Its original movement bound remains unchanged.

## Exact hosted-preview browser evidence

Immutable application URL: https://anatomy-2109ubix5-amy-dos-projects.vercel.app/atlas/
Application SHA: `861f532bf5f0e0806ea419d696f0b2f84089c02b`.
[Hosted run 41099493428](https://github.com/amydojo/anatomy-lab/actions/runs/41099493428), QA harness commit `75be6b91759d743b0e522dcddfea10b221855815`:

| Browser | Passed | Failed | Skipped |
|---|---:|---:|---:|
| Desktop Chromium | 27 | 1 | 0 |
| Mobile WebKit | 19 | 1 | 8 |

These are genuine browser automation runs against Vercel, not physical-device tests. Both failures are the same first-selection inspector race. The eight WebKit skips are desktop-specific suite cases, not skipped touch or inspector assertions.

The container Git ownership check initially blocked the QA job; it was fixed with a per-command safe-directory value scoped to the runner checkout. A second identity gate detected 163 extra bytes in the HTML. Independent diagnostic output proved they are the single `https://vercel.live/_next-live/feedback/feedback.js` script, and that removing exactly that identified platform script leaves byte-identical application HTML. The successful identity gate permits only this one host addition and still requires exact application payload equality, plus raw equality for five application JavaScript files. Actual browser tests use the hosted page with the toolbar present.

Post-861 runtime fixes and new reset-image diagnostics require a fresh browser run. The 861 preview is evidence for that commit only. No production deployment, merge or ancestry retarget occurred.

## Desktop artifact diagnosis at ab1a87d

Completed run [41100464666](https://github.com/amydojo/anatomy-lab/actions/runs/41100464666) at `ab1a87ddc8d2f924293806db56964626126094a7`:

| Browser | Passed | Failed | Flaky | Skipped |
|---|---:|---:|---:|---:|
| Mobile Chromium | 162 | 0 | 0 | 9 |
| Mobile WebKit | 162 | 0 | 0 | 9 |
| Desktop Chromium | 164 | 7 | 0 | 0 |

The desktop artifact `12997763345` was downloaded and all seven `neutral-before`, `neutral-after` and `neutral-state` attachments were decoded and compared. The before/after camera and UI states are exactly equal in every case. All changed pixels are confined to the same native primary-range thumb edge: bounds `(304,687)-(308,695)` for neck, hip, knee, elbow, wrist and ankle; `(304,630)-(308,638)` for shoulder (whose tray is taller). Color differences are only native-control edge antialiasing. No anatomy pixels differ.

Classification: seven screenshot failures caused by browser-native range-control painting after a programmatic value round trip. These are not anatomical reset defects, not stale golden baselines (each expected image is captured in the same test), and not PNG compression differences (decoded pixels differ).

Repair: explicit desktop range track/thumb appearance replaces native accent-color shading, with a 44px input target and visible keyboard focus. The exact decoded-pixel equality assertions are unchanged: no masks, tolerances, baseline updates or skips. Full regression must validate the repair.

CI push and PR jobs now share the same head-branch concurrency key, so redundant runs do not consume runner capacity in parallel. This scheduling repair is separate from the slider-rendering change.

The hosted ab1a87d run [41100529521](https://github.com/amydojo/anatomy-lab/actions/runs/41100529521) passed 29 desktop Chromium tests and 21 mobile WebKit tests (8 desktop-only cases skipped), including inspector and mixed-pointer tests. This is automation, not physical iPhone QA.
