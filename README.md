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
