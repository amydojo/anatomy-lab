# V14 intelligent mobile touch selection (issue #41)

Status: implemented, CI-validated on synthetic viewports. **Not validated on a physical iPhone. Issue #41 stays open until that check is done** (acceptance steps at the end).

## Problem
Connective structures project to a few CSS pixels on a phone. Picking is exact-triangle, so a finger that lands 2 px off selects nothing. Measured exact zones at 390x844 (all Studio layers): MCL 108 px², LCL 57, medial meniscus 94, patellar ligament 112, quadriceps tendon 34. At 320x568: 9-27 px². ACL and PCL have **no visible pixels** in the default front view (hidden behind femur, patella and the patellar ligament).

## What changed
- `assets/atlas/atlas-renderer.js`: `hitTest` is split into a shared `pickSet` (eligibility, filtering, isolation, projection) and the same exact loop. Exact picking output is **byte-identical** (see Evidence). New read-only `touchCandidates`: every pickable structure whose projected geometry lies within a radius, with screen-space distance, interpolated depth at its nearest point, the structure hiding that point (if any) and its on-screen footprint.
- `assets/atlas/touch-pick.js` (new, pure, no DOM): radius and decision policy.
- `assets/atlas/atlas-unified.js`: `pickAt(x, y, opts)`, read-only `touchPlanAt`/`touchCandidatesAt`, and the compact UI.
- `assets/spatial-core.js`: forwards `{pointerType, contact}` to `pick` (extra argument; other pages ignore it).

## Algorithm
1. **Exact triangle first.** Unchanged. A tap that lands on any structure selects exactly what it selected before, in every pointer type.
2. Only a **touch that misses** continues. Mouse and pen never get tolerance (desktop precision unchanged).
3. **Radius** (CSS px): 16 by default (iOS Safari reports no contact size); with a reported contact size `c > 1`, `10 + c/2`; always clamped to 12-24.
4. **Candidates**: structures eligible for exact picking right now (current layer, filter, isolation and visibility rules), with projected distance <= radius. Distance is point-to-projected-triangle in CSS px, never 3-D.
5. **Occlusion**: a candidate whose nearest point is covered by a nearer surface of another structure (interpolated depth, 0.002 tolerance) is dropped. Hidden, filtered or isolated-out structures are never in the set.
6. **Small targets only**: a structure gets tolerance only if its on-screen footprint is under 44 CSS px in some axis. Grazing a large bone is an empty tap.
7. **Decision** (`BodyTouchPick.decide`):
   - none within radius, or nearest is not a small target: behaves as an empty tap (clears an existing selection, as before).
   - one visible candidate, or the nearest is **at least 8 px and at least 1.75x** closer than the runner-up: **select**.
   - otherwise **ambiguous: never auto-select**. Show a chooser of the nearest candidates (within max(14 px, 0.75 x nearest distance), at most 4, nearest first). If every plausible candidate is large, treat as empty (no popup).

## Interaction
- One natural tap; the camera never moves on a tap (asserted).
- Snap confirmation: the structure highlights as usual, plus a brief ring at the snapped point. When other candidates were nearby, a small "Not it?" pill lets the user switch; it expires after about 4 s.
- Chooser: compact list in the existing chip style, placed beside/above the finger and inside the model canvas (never over the bottom sheet or panels). Dense layout on short stages. Escape closes it first (before Studio's own Escape). Tapping elsewhere, orbiting, zooming or changing region dismisses it.
- The browser's follow-up click after a tap is ignored for 350 ms so it cannot land on the freshly shown chooser (found and fixed during testing).

## Evidence (Chromium, synthetic viewports)
**Exact picking unchanged.** 15 grids (5 mobile viewports x default/rotated/zoomed camera, about 170k points) hashed before and after the refactor: all identical. Exact-hit cost 2.1-2.8 ms before and after.

**Touch zones**, 16 px radius, px² (exact now -> exact + auto-select -> + chooser reach). ACL/PCL show 0 until isolated.

| structure (390x844, all layers) | exact | + auto-select | + chooser |
|---|---|---|---|
| MCL | 108 | 384 | 1176 |
| LCL | 57 | 57 | 449 |
| Medial meniscus | 94 | 94 | 594 |
| Lateral meniscus | 67 | 67 | 131 |
| Patellar ligament | 112 | 112 | 236 |
| Quadriceps tendon | 34 | 34 | 34 |

With muscles hidden (ligament view), LCL auto-select rises to 261 and the quadriceps tendon reaches 547. With the Studio "isolate" action the cruciates go from 90 / 119 px² (ACL / PCL) to 1850 / 1991 px² at 16 px (17-61x across viewports).

Radius sweep (390x844): auto-select added 400 / 480 / 532 / 592 px² for 12 / 16 / 20 / 24 px, while the chooser region grows 1044 -> 1564 -> 2180 -> 2904 px². 16 px is the default: most of the gain with a bounded chooser footprint.

Selection cost for a miss: about 7.5-9 ms per decision on this runner (one per tap).

## Known limits (stated, not hidden)
- **Exact-first means a larger neighbour wins.** Where a muscle or bone covers the area around a small structure (quadriceps tendon in the default view), tolerance cannot help; use layers or Isolate. Making a small structure win over a large one on an exact hit is a product decision and is not done here.
- ACL/PCL are not selectable in the default front view because they are hidden; that is anatomy/occlusion, not picking.
- Measurements are 2 px-grid samples for the "after" columns, so differences under about 10% are noise.
- Touch coordinates in WebKit are integer-snapped; tests tap robust integer points.
- No scientific or anatomical claim changes. Mesh geometry and provenance are untouched.

## Physical iPhone acceptance (required to close #41)
On a real iPhone (Safari), `/atlas/?studio=connective`, portrait and landscape:
1. Tap each of the eight structures with the right index finger and the thumb, 10 times each. Record the first-tap success rate and any wrong-structure selection (must be zero).
2. Tap 6-10 px beside MCL, LCL, patellar ligament: expect the right structure or the chooser, never a different single structure.
3. Tap clearly empty space: nothing selected, no popup.
4. Open a chooser: confirm it sits beside the finger, is readable, and that choosing, dismissing and "Not it?" all work with one thumb.
5. Repeat after pinch-zoom and rotate; repeat with the sheet in its default and expanded positions.
6. Confirm no accidental camera movement on taps and no lag you can feel.
