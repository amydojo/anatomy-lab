# BODY / LIVE V6 — ATLAS / PORTAL
**Status: architecture / implementation plan only — not an implemented atlas, not an anatomical approval.**

**Planning baseline:** 2026-10-27. Source of truth: [release readiness](./V6_RELEASE_READINESS.md) and [evidence contract](./V6_EVIDENCE_CONTRACT.md). Production remains on `main` at `a0863916c4569bcac32c9a238d9b57d640f746b1`. V5.3, V5.4, V5.5 are separate draft pull requests, not production code.

## The product
A single premium, mobile-first anatomical instrument that lets a person **see → select → enter → peel → move → trace → return** without losing location or mistaking an illustrative representation for verified anatomy.

The hero is the **body and the relationship between structures**, not a carousel of disconnected anatomical demonstrations. A continuous *interface* is possible before a continuous *anatomical specimen* is verified; never conflate the two.

### The north-star acceptance demonstration
1. Open `/atlas/` on iPhone. A restrained full-body contextual figure is visible without vertical page scrolling. Body regions are discoverable with a one-tap alternative to gestures.
2. Tap **Right Hip**. The spatial camera frames the pelvis. The contextual panel identifies the sourced hip meshes and review state. In staging only, enter the V5.3 hip lab.
3. Peel superficial gluteal muscle layers. Select **Sciatic nerve**. The layer becomes translucent and a **Trace** action appears.
4. Scrub along the source-sampled sciatic trunk and choose **Tibial** or **Common fibular**. Junction gaps and composite registration are labeled in the scene and accessible as text.
5. Select **Continue toward Knee**. Preserve laterality and reference orientation. If there is *no continuous, reviewed nerve geometry*, use a visibly labeled **context change** (not an animated, imaginary nerve segment) into the source-matched knee skeleton. Do **not** suggest the complete sciatic nerve has been imaged or reconstructed through the transition.
6. Tap **Evidence** at any point. See provenance, registration, inference, source release and review; change how data origins are rendered; return to full body with the same location and modality.
7. Under `prefers-reduced-motion`, each movement is an immediate semantic transition rather than forced camera animation.

## Art direction and mobile layout
Visual language: warm espresso-black background, muted ivory bone, clay/terracotta musculature, restrained warm-gold nerve accents. Physically legible surfaces, controlled depth, *no floating decorative rings, forced neon glow, or template-like animated labels*. Use existing BODY / LIVE typography and hierarchy; avoid a new unrelated visual system.

One-screen mobile composition:
- Top bar: BODY / LIVE + compact region breadcrumb, not stacked page titles.
- Centre: dominant specimen canvas with a minimal on-stage region locator and a small proof-of-origin marker.
- On stage contextual actions: one primary action (**Explore**, **Peel**, **Trace**, or **Return**, according to context). Do not make the user choose among four permanent modes.
- Bottom edge: one compact scrubber or layer control; a drag handle expands a short explanation/evidence sheet. Keep the model visible during interaction.
- Persistent **Back to body** affordance and accessible region list. The 3D canvas is not the only navigation interface.
- No automatic camera spin; meaningful movement responds to a user's action.
- At 320px width and 650px height, avoid horizontal scrolling and inspector controls obscuring the entire anatomical focus. Touch targets at least 44 CSS px (design target).

Navigation / motion:
- Enter-region cinematic motion target: 450–700 ms on capable devices with a single eased camera path; shorter transitions for region changes and no simultaneous peeling/rotation distractions. These are design **targets**, not measured performance.
- At low frame rate or reduced motion, cut directly to a readable new composition; avoid slow interstitial animations.
- Maintain an anatomical orientation glyph (right/left, anterior/posterior) where geometry is available. Never use screen-right as a stand-in for anatomical right.

## Architecture — separate domain meaning from graphics
The codebase is currently a lightweight static site with Canvas2D triangle rendering for Hip/Knee and a shared `assets/spatial-core.js` camera. It is **not** yet a scalable whole-body GPU scene. Avoid copying another independent 3D laboratory or prematurely replacing the existing stable renderer.

Proposed static-site modules (illustrative file layout, **not yet created**):

```text
/atlas/index.html                          # V6 preview route; do not replace / at first
/assets/atlas/atlas-state.js               # navigation state machine + location restoration
/assets/atlas/atlas-controller.js          # gestures, buttons, lifecycle, event dispatch
/assets/atlas/atlas-manifest.json          # source-reviewed regions and discoverability
/assets/atlas/atlas-loader.js              # prioritized LOD loads, cancellation, cache, disposal
/assets/atlas/atlas-renderer.js            # render interface (2D context / WebGL2)
 /assets/atlas/atlas-camera.js             # optional camera target/orientation and eased travel
/assets/atlas/atlas-transitions.js         # supported geometric bridge vs disclosed context change
/assets/atlas/atlas-evidence.js            # label policy + shading + provenance inspection
/assets/atlas/atlas-regions.js             # typed adapters: hip, nerve, knee, shoulder
/assets/atlas/model-packs/                # hash-pinned models with per-pack license manifest
/tests/v6-atlas.spec.mjs
/scripts/tests/test_atlas_coordinate_frames.py
/docs/V6_RELEASE_READINESS.md
/docs/V6_EVIDENCE_CONTRACT.md
```

Do not build on React/Next.js just to ship V6: maintain the existing static deployment and use ES modules or a small build step only where justified by measured bundle/performance costs. Only the atlas shell may need a GPU renderer.

**Contract boundaries:**
- `atlas-state` stores region, selected structure, layer, camera orientation, inspect mode, evidence mode, and previous focus. The anatomy content model has no DOM dependencies.
- `atlas-renderer` receives camera + immutable scene packets, producing pixels and hit-test IDs. Implement a WebGL2 adapter only after a 2D proof and frame-time measurement. Keep Canvas2D and a semantic list fallback for device/context loss.
- `atlas-regions` exposes `regionId`, `sourceFrame`, `geometryPack`, `focusBounds`, `structures`, `layers`, `actions`, `evidenceIds`, `reviewStatus`, and entry/exit anchors. Region handlers may wrap existing Hip/Knee logic instead of duplicating it.
- `atlas-loader` fetches only the initial body LOD and current region. It must stop/dispose pending loads when the user selects another region. No eager simultaneous loading of every organ/nerve mesh.
- `atlas-camera` uses `camera.target` from the existing spatial core for responsive focus tracking; independent camera rotations are orthogonal to the anatomy's original geometry frame.
- `atlas-evidence` is a domain layer, not just tinted polygons. A source label must always be backed by a released manifest record.

### State machine
```text
BODY_OVERVIEW
   -> REGION_ENTERING -> REGION_FOCUSED
   -> STRUCTURE_SELECTED -> LAYER_EXPOSED
   -> NERVE_TRACING -> BRANCH_SELECTED
   -> CONTEXT_TRANSFER -> REGION_FOCUSED (knee)
   -> BODY_OVERVIEW
Any state -> EVIDENCE_OPEN (overlay, does not replace current navigation state)
Any scene state -> ERROR_FALLBACK (semantic region list and source disclosure)
```

Transitions should carry a single serializable snapshot:
```json
{
  "region": "hip",
  "laterality": "right",
  "structure": "sciatic",
  "layer": 3,
  "navigation": "nerve-tracing",
  "branch": "tibial",
  "progress": 0.63,
  "evidenceMode": "registered-composite",
  "camera": { "target": [0, 0, 0], "yaw": 0, "pitch": 0, "zoom": 1 }
}
```
Snapshot is schematic type guidance only. Validate all incoming URL/deep-link values; do not allow user-controlled data to inject arbitrary asset URLs or untrusted markup.

## Full-body navigator: begin with honest, lightweight context
The initial overview is **not** a claim of one medically scanned specimen. Prefer a curated reference-pose skeletal overview sourced from a single licensed release (evaluate the pinned BodyParts3D 4.0 atlas first), with a low-poly or simplified outer body silhouette labeled as a **contextual silhouette** where appropriate.

Asset sourcing checklist before implementation:
1. Audit coverage and license for skull/spine/thorax/pelvis/limbs in the already pinned BodyParts3D 4.0 derived dataset; do not assert models exist without checking.
2. Choose source-aligned region proxies, write geometry hashes, anatomical laterality, source model identifiers and transforms.
3. Generate mobile-friendly LODs while retaining a source/master asset; document simplification tolerance.
4. Prefer compact binary geometry (glTF/GLB where supported, potentially Draco or meshopt, only with measured decoder/browser compatibility). glTF packages scene nodes and transform hierarchies but is not itself a streaming scene system; use application-level prioritized loading.
5. Atlas offers tap targets for Hip, Knee, Shoulder (legacy SVG/illustrative, labeled as such), and future Thorax (locked/coming later). Never fake detailed anatomy for an unsupported region.

Use an intentionally quiet overview: enough anatomical information to pick a location, with detailed geometry loading **after entering** that location.

## Hip → Sciatic → Knee continuity — strict evidence boundaries
Current evidence:
- Hip and Knee meshes derive from the same pinned BodyParts3D 4.0 release.
- `assets/hip-knee-bridge.js` maps reference coordinates between two translation/scale frames and confirms all 480 corresponding femur vertices match within source rounding. This establishes **a skeletal reference-frame bridge**, not a completed anatomical nerve reconstruction.
- V5.4 nerve surfaces come from a different Z-Anatomy derivative and were rigidly ICP-registered by femoral surfaces. Reported median residual **0.062219 hip scene units (~6.22 mm)** and P95 **0.143454 (~14.35 mm)** measure *femur-fit discrepancy*, NOT measured sciatic nerve error.
- V5.5 sciatic/tibial/common fibular branch gaps are classified as source gaps/close estimates; the nerve graph samples geometry-derived **visual** centerlines, not imaged fascicular paths.

Therefore define two different navigation transitions:
- **Geometrically anchored**: two structures from the same reviewed source with tested corresponding frame transforms; camera can travel with a shared spatial anchor. Hip → Knee skeletal context qualifies for the coordinate-frame proof, still awaiting anatomy approval.
- **Context transfer (editorial)**: crosses donor/atlas, inferred nerve gaps, unsupported anatomy, or missing review. Fade/hold on the last sourced path, show an explicit seam marker like **"Continuing in knee reference anatomy · nerve not reconstructed in this region"**, then focus the knee scene. No interpolated bright nerve strand bridging unknown space.

Camera travel is a navigation effect and not evidence of continuous biological surface. A tester must be able to locate the seam and open an explanation in no more than one tap.

## Evidence Lens — essential product functionality
See [V6_EVIDENCE_CONTRACT.md](./V6_EVIDENCE_CONTRACT.md) for a typed, per-part and per-relationship source manifest and example entries. Require two orthogonal dimensions:
1. **Representation origin:** `sourced-surface`, `registered-composite`, `source-derived-estimate`, `illustrative`, or `unavailable`.
2. **Review:** `unreviewed`, `needs-revision`, `expert-reviewed-for-scope`; no default `clinical-grade`.

On toggle: sourced surface stays ivory; separately registered surface receives restrained gold with a dashed seam/offset marker; source-derived estimate gets a thin dotted trace; illustrative stays muted clay; missing elements display no anatomical mesh and a textual placeholder. **Never use color as the only distinction**—include labels, icons, readable legend and screen-reader descriptions.

The inspector exposes dataset + release, original creators, model ID, license and share-alike notice, immutable model SHA, coordinate transform, whether models are same donor/source, registration method and measured residuals, anatomical continuity status, review scope/person/date and any unresolved flags. Deep-links should preserve evidence mode.

## Renderer / performance plan
Current Canvas2D path recomputes projections and painter-sorts triangles during interaction. A full-body atlas will likely overwhelm that approach; **measure, do not assume**. Stage a WebGL2 renderer proof with indexed meshes and per-region GPU resources, depth buffer, selection picking and transparency handling. Retain a low-detail/static Canvas fallback and an always-functional semantic region list.

**Provisional performance budgets — must be benchmarked on real devices:**
- First useful body overview: aim <=2.5 s on a representative mid-tier iPhone with a constrained network; the critical text/region controls must work before 3D loads.
- Interaction: sustained >=30 fps on the chosen baseline mobile device; aim ~60 fps on modern phones when idle/rotating. No long main-thread work >50 ms during primary gestures.
- Memory: target <=150 MB estimated live GPU+geometry working set after detailed-region loading (validate with device tooling; revise budgets from measurements).
- Reduced motion: non-animated equivalent for all camera transitions, 2D region list and controls.
- Background/hidden tab: stop RAF and playback; dispose far-region assets after transitions; handle context-loss recovery without deleting navigation state.
- Prefetch only adjacent destination geometry after intent, cancel and free when navigating elsewhere; compress and cache source LODs separately from the canonical originals.
- Measure cold/warm load, decoded bytes, frame-time P50/P95, initial interaction delay, GPU memory proxy and power/thermal behavior on Safari WebKit and Chrome. No performance claim until measured.

## Staged implementation slices
**Slice 0 — prerequisite review, no new anatomy:** Confirm PR #4 144 passes, #5 162, #6 189, with exact hashes; source code approvals and release-state decision; explicit qualified anatomical/registration review and license signoff. Do not merge drafts solely because CI is green. Record who signed which structures and usage claims.

**Slice 1 — V6A shell, safe to build from main:** Add `/atlas/` full-body silhouette and tap/keyboard region navigation. Use no unapproved anatomy source in public runtime. Prove mobile hierarchy, a working 2D fallback, and accessible region navigation. Existing home page remains the default.

**Slice 2 — V6B data/renderer proof, preview only:** Audit/capture pin-and-hash whole-body subset. Render LODs and compare Canvas2D vs WebGL2 on actual devices; define the scene adapter interface. Refuse unlicensed or uncertain meshes.

**Slice 3 — V6C region adapters, preview only:** Integrate Hip/Knee through one navigation state without rewriting lessons. Exercise camera orientation and deterministic hip→knee transform checks; allow Hip and nerve adapters from stacked draft branches in a separate integration preview, not the production shell.

**Slice 4 — V6D evidence + seam behavior:** Implement Evidence Lens schema and display, source vs composite comparison, explicit nerve continuity gaps, cross-region context transfer, scope-aware reviewer labels.

**Slice 5 — V6E polish, verification and controlled release:** Device/gesture/keyboard QA, accessibility labels, real Safari stress tests, performance profiling, complete provenance, visual inspection. Publish the shell or region adapters only when their own gating approvals are satisfied; a shell-only release must not unexpectedly expose the unapproved labs.

Implementation slices should be independent PRs with one responsibility each; do not create one huge PR that simultaneously changes all V5.3–V5.5 data and V6 shell.

## Verification and acceptance matrix
- Navigation: body→right hip→piriformis→sciatic→tibial branch→context-transfer→knee→return, with clear active-region label and no context loss.
- Geometry: source release IDs and per-vertex frame check; end-to-end world transforms, inverse round-trips, bounded camera destinations and screenshot overlays at anterior/posterior/lateral.
- Honesty: intentionally introduce missing mesh, wrong hash, unreviewed registration, unexpected nerve gap and mismatched source frame; require explicit fallbacks/seams, no false `sourced` label.
- Licensing: source files segregated by license; attribution always reachable; legal review of Z-Anatomy derivative/CC BY-SA and mixed-license upstream audit before any commercial/public nerve promotion.
- Usability: 320, 375, 390, 430 px mobile; short 650 px height; iOS Safari WebKit, Chromium mobile and desktop; scroll/viewport invariants, touch+keyboard+single-tap alternate camera controls.
- Accessibility: keyboard traversable regions/structures, screen-reader explanation of selection and transitions, logical focus when opening/closing sheets, visible focus ring; WCAG 2.2 pointer and dragging alternatives.
- Stability: network offline/slow, GPU context loss, reduced-motion, rapid route switching, background tab, failed geometry decode, and stale/corrupt cache.
- Regression: all current `tests/v53-hip.spec.mjs`, `v54-nerve.spec.mjs`, `v55-nerve-follow.spec.mjs` and Knee suite remain passing after any renderer/shared-camera changes.
- Expert: identify reviewer, qualification, inspected commit+asset hash, structures/relations reviewed, findings, whether edits were resolved, and intended educational scope.

### Go/no-go definitions
- **Internal preview GO:** accurate source labeling and visible warning about unreviewed/composite anatomy; page/controls work; CI passed; no prohibited licenses included.
- **Atlas shell-only production GO:** no draft anatomy imported, performance & accessibility goals measured/accepted, static fallback and region list functional, isolated feature flag paths; owner authorizes release.
- **Hip/Knee integrated educational production GO:** full code/reviewer/attribution gating, navigation provenance, accepted source-alignment scope, legal approval, and no implied validated nerve course where there is none.
- **Medical-grade or patient-specific claims:** NOT part of V6. Require independently specified clinical intended use, image-derived ground truth, expert validation and applicable regulatory process.

## Decisions to defer, not silently assume
- Target device and network budget: record measurements before making renderer and asset pack irreversible.
- Full-body source asset coverage: audit actual pins/mesh rights and decide whether a skeletal-only overview is enough.
- GPU runtime choice: native WebGL2 vs small graphics library, chosen by prototype profiling and deployment complexity.
- Anatomical reviewer availability and licensing acceptance: unresolved blockers for data-heavy release, not reasons to fabricate missing landmarks.
- Should the body overview be exposed on `/`? Default **no** until it beats the existing home UX in mobile QA.

**No changes to V5.3–V5.5 drafts or the production alias are authorized by this planning document.**
