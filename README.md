# BODY / LIVE — Interactive Anatomy Laboratory

**Mission:** see → touch → move → understand.

Production baseline: https://anatomy-lab-ten.vercel.app/  
Repository: https://github.com/amydojo/anatomy-lab

## Available regions

| Route | Experience | Implemented visual motion |
| --- | --- | --- |
| `/` | Body atlas (front/back navigator, search, continue learning) | N/A |
| `/hip/` | Hip / Live V3 | Posterior schematic abduction |
| `/hip/dissection/` | Hip / Exposed (original preserved) | Five-depth dissection, no joint motion |
| `/knee/` | Knee / Live V3 | Schematic flexion / extension |
| `/shoulder/` | Shoulder / Live V3 | Posterior-oblique arm elevation with simplified scapular motion |
| `/references/` | Sources, provenance and model limitations | N/A |

## Shared V3 interaction system

The original SVG models are preserved, and V3 provides a consistent progressive-enhancement experience around them:

- **Explore:** layer selector, structure search, isolation/highlight, relationships and educational details.
- **Move:** direct original-model drag handles, shared angle scrubber, play/pause, reset, and a simplified motion explanation.
- **Trace:** highlighted visible nerve routes, written proximal/distal pathways and approximate territories, cross-region navigation.
- **Learn:** 12 guided Observe → Predict → Manipulate → Reveal experiments (four per available joint).
- Mobile-first stage, context inspector with collapsible/expanded states, persistent mode dock, pinch zoom/pan, structure selection.
- Local-only progress and last explored structure, without an account or personal health data.

### Implementation files

```
index.html                        # V3 body atlas
hip/index.html                    # original SVG + V3 bootstrap
hip/dissection/index.html         # preserved deep dissection
knee/index.html                   # original knee SVG + V3 bootstrap
shoulder/index.html               # original shoulder SVG + V3 bootstrap
references/index.html             # scholarly background / caveats
assets/v3-data.js                 # region data and 12 experiments
assets/v3.js                      # shared controls, gestures, state and lesson engine
assets/v3.css                     # unified responsive visual system
assets/v3-home.js                 # atlas orientation, search, local progress
assets/knee-v2.*                  # preserved V2 source, not loaded on V3 knee
tests/source.test.mjs             # static code/integrity checks
tests/v3.spec.mjs                 # Playwright browser interaction tests
playwright.config.mjs
.github/workflows/quality.yml
```

## Run locally

No build pipeline is necessary for normal runtime:

```bash
python3 -m http.server 4173
```

Open http://localhost:4173 . File URLs are not recommended because absolute route links assume a static web server.

For automated tests:

```bash
npm install
npm test
npx playwright install chromium webkit
npm run test:e2e
```

The CI workflow runs Node source tests and desktop Chromium/mobile Chromium/mobile WebKit interaction tests, saving screenshot artifacts. CI is not a substitute for physical iPhone testing.

## Adding a joint

1. Prepare a reviewed anatomical SVG model, preserving fixed landmark relationships.
2. Implement the native layer, selection and movement controls (or adapt the shared scene API).
3. Add region data and lessons to `assets/v3-data.js`.
4. Add a mapped body hotspot and search destination to the atlas.
5. Add tests for visible structures, motion, tracing and lessons.
6. Verify sources/asset licensing and test on mobile before deployment.

## Scope & safety

This is **educational anatomy**. SVG geometry is artistic and schematic, not a real body scan, validated 3D anatomical dataset, a clinically exact biomechanics model, or a diagnosis. The knee model is sagittal-inspired with exaggerated ligament movement; the shoulder model approximates scapular motion during elevation; the hip model shows posterior abduction only. It does not simulate other shoulder or hip planes. The trace mode currently highlights a representative regional nerve path and provides text descriptions; it is **not** a full continuous 3D branching tracer. Nerve territories and pain patterns vary and overlap.

Content draws on general educational anatomy resources listed at `/references/`. Independent specialist anatomical review remains recommended prior to claiming clinical-grade accuracy. Body awareness prompts are optional; stop if painful or if neurological symptoms worsen.

## Future improvements

- Reviewed multi-view or registered 3D anatomical assets, licensed and documented.
- Full multi-axis movement and coupled biomechanics for hip and shoulder.
- More granular, illustrated peripheral-nerve branches and carefully differentiated sensory maps.

Maintained in public on GitHub; deployed from `main` via the linked Vercel project.


## V4 — Invisible Interface

V4 replaces the four always-visible interaction modes with a single responsive anatomy scene and a contextual inspector. The interaction is built around **select → understand → manipulate**. The existing V3 data, original SVG models, and deep hip dissection are preserved.

- Touch structures to focus and see a short explanation.
- Peel the model using one persistent anatomical depth slider.
- Move joint geometry using the native handle (Knee and Shoulder) or drag the virtual femur (Hip), with an accessible movement slider.
- Select a nerve to see a contextual *Trace nerve* action and an approximate pathway description.
- Tap **Why?** to begin a related interactive experiment; complete its model action before the explanation is revealed.
- Search the whole atlas and navigate to highlighted structures via stable deep links.
- Progress saves locally using \`bodylive-v4-progress\`; V3 progress is accepted as a read-only migration fallback.

### Files and architecture

\`assets/v4.js\`: one user-facing selection/depth/movement state, renderer adapters, responsive inspector, gesture input, contextual lessons, and modal navigation. The original native HTML scripts remain as rendering adapters, not competing navigation systems.

\`assets/v4.css\`: premium mobile-first responsive design without a permanent mode dock.

\`assets/v3-data.js\`: retained shared region and lesson knowledge graph; no duplication.

\`tests/v4.spec.mjs\`: browser tests for mobile, WebKit, desktop, search, anatomy manipulation, nerve exploration and real lesson actions.

**Known limits:** Visual models remain illustrative 2D/2.5D SVG art, not validated physics or anatomical imaging. The legacy SVG render functions are bridged through a small adapter; fully eliminating all model-internal state requires a later rewrite of model geometry. Trace currently highlights an illustrative nerve representation and explains branches in prose rather than rendering every branch continuously. This is an educational product, not a diagnostic tool.

Preserve the public routes and deploy through the existing Vercel project. Do not merge a feature branch until mobile and desktop browser checks pass.


## V5 Experiment 01 — KNEE / SPATIAL (feature branch)

Route: `/knee/spatial/` (kept separate from the stable `/knee/` lab).

V5's first spatial prototype introduces a dependency-free **3D perspective mesh engine** with a shared camera and joint-pose state. It provides orbit, two-finger pinch zoom, selection and isolation, progressive tissue peeling, virtual flexion, animation, accessible sliders, touch-friendly anatomy information and a structured source dossier.

**Accuracy: transparent milestone.** The four skeletal meshes are **real BodyParts3D 4.0-derived geometry**, imported together from one pinned reference dataset, with validated SHA-256 checks, recorded FMA IDs, and an unchanged shared coordinate frame. Ligaments, menisci and tendons remain original schematic geometry. The model is not a patient scan, clinically validated reconstruction or measured biomechanical simulator. The fixed flexion axis, meniscus proxies, ligament routes and patellar tracking are teaching approximations. See `/knee/spatial/sources/` for the licensed asset review and import gates. Do not label it anatomical accuracy verified until official sourced geometry and qualified review are completed.

The BodyParts3D 4.0 CC BY 4.0 right-knee skeletal subset (femur, tibia, fibula, patella) has been imported by scripts/import_bp3d_right_knee.py using a pinned 4.0 geometry distribution; upstream file hashes and FMA identity checks are recorded in knee/spatial/assets/provenance.json. Menisci and ligaments require separately reviewed geometry, as BodyParts3D's skeletal collection does not itself supply the complete structures. Avoid mixing Z-Anatomy CC BY-SA and third-party noncommercial material without checking and satisfying licenses.

Regression suite: `tests/v5-spatial.spec.mjs`, automated through the existing Playwright CI matrix, with visual screenshots and source integrity assertions. Production remains on V4 until the new experiment is reviewed and explicitly promoted.

### Reproducible sourced-geometry preflight

For a future direct original-OBJ import or replacement, obtain all **four right-side** bones from the same official release in the shared whole-body coordinate frame. The current committed JSON has been extracted from a pinned, documented 4.0-derived distribution. The current reference FMA identifiers are 24474 (right femur), 24477 (right tibia), 24480 (right fibula), and 24486 (right patella); recheck them against the exact release manifest.

Use the new local-only geometry preflight to emit a hash-bound, review-required manifest:

```bash
python3 scripts/validate_spatial_assets.py \\
  --release 'BodyParts3D official / verified version' \\
  --license-url 'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html' \\
  --mesh femur=path/to/FMA24474.stl \\
  --mesh tibia=path/to/FMA24477.stl \\
  --mesh fibula=path/to/FMA24480.stl \\
  --mesh patella=path/to/FMA24486.stl \\
  --out artifacts/right-knee-mesh-manifest.json
```

This produces SHA-256 hashes, size, bounding boxes, coordinate spans, an approximate alignment check, and mandatory review warnings. It does **not** validate anatomical identity, articular congruence, entheses, kinematic constraints, or specialist clinical suitability. The four right-knee skeletal meshes have now been added to the preview through the pinned import pipeline; separate sourced ligament and cartilage meshes are not included. Tests run with `python3 -m unittest discover -s scripts/tests` and CI.

Spatial camera orbit, pinch and projection now live in the joint-independent `assets/spatial-core.js`; Knee-specific geometry and pose constraints remain in `knee/spatial/spatial.js`. The shared controller has a disposal API for later Hip and Shoulder spatial scenes.

### V5 sourced skeletal geometry · completed import

- **Four aligned source-derived bones**: `knee/spatial/assets/bp3d-right-knee-4.0.json` (femur FMA24474, tibia FMA24477, fibula FMA24480, patella FMA24486). The source atlas has a unified coordinate frame; the export uses the **same transform for all four bones**.
- **Attribution and proof**: `knee/spatial/assets/provenance.json` contains the pinned upstream commit, source URLs, original metadata SHA-256, packed source chunk SHA-256, FMA identifiers, vertex and triangle counts, shared transform and explicit review limitations.
- **Reproducible importer**: `scripts/import_bp3d_right_knee.py`; GitHub Actions `import-bp3d-knee.yml` verifies hashes, geometry and identity before committing derived assets to the V5 feature branch.
- **Runtime**: KNEE / SPATIAL loads the actual 4.0-derived bone triangles and keeps annotated, schematic menisci/ligaments/tendons. If geometry retrieval fails the prior original sketch remains as fallback.
- **Static checks**: `scripts/tests/test_sourced_knee.py`. Interaction QA: `tests/v5-spatial.spec.mjs` tests sourced loading in Chromium/WebKit and at multiple mobile sizes.

The actual data originates from BodyParts3D 4.0, © The Database Center for Life Science, available under CC Attribution 4.0 International (https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html). The intermediate distribution `ashemag/human-atlas` converted the official OBJ into metres/Y-up and packed/simplified the geometry. Source coordinates were shifted and scaled uniformly for this specimen viewer, without separate bone-by-bone repositioning. **No specialist anatomical review of this rendered interactive reconstruction has been performed**, and simulated flexion/patellar travel/soft-tissue attachments remain illustrative.
