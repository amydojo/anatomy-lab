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
