# V14 integration gate (not release approval)

Source PRs: #34 geometry, #35 interaction, #36 intelligence. Integration base: V13 main ca9d26fe3f072e2e34c0401cb545a017c2fe7697.

## Conflicts requiring manual reconciliation
- assets/atlas/atlas-controller.js: preserve #34 BodyConnectiveMode mount and #35 __BODY_ATLAS__ connective bridge.
- assets/atlas/atlas-renderer.js: preserve #34 illustrative knee mesh buffers, state and drawing; incorporate #35 filtering/ghosting without suppressing illustrated mesh visibility. Tissue taxonomy differs: #34 singular ligament/tendon/fibrocartilage vs #35 plural ligaments/tendons/fibrocartilage.
- atlas/index.html: load atlas-connective.js before renderer, and connective-studio.css/core/ui in valid dependency order. Include intelligence adapter script before consuming it.

## Required checks before approval
1. Merge each source branch into this branch, resolving conflicts with source-specific tests. No source branch rewrites.
2. Ensure 8 illustrated knee structures are addressable and remain explicitly marked ILLUSTRATIVE, not verified geometry.
3. Wire #36 intelligence records and evidence graph into #35 inspector, preserving canonical IDs and graceful fallback.
4. Execute source, JS, Python, desktop Chromium, mobile Chromium, mobile WebKit, hosted preview regressions; record exact counts and artifacts.
5. Inspect actual knee on iPhone and desktop: select ACL/PCL/MCL/LCL, quadriceps tendon/patellar ligament and both menisci; isolate, compare, reset, gestures, overlays and source disclosures.
6. No production merge/deploy until full gates pass.

This document is a coordination artifact only; presence of this file does NOT mean integration or testing completed.
