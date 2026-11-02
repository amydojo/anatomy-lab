# V14 Connective Studio · parallel integration

Branch: feat/v14-connective-interaction-studio (from main ca9d26f).
Geometry work is owned by PR #34. This PR does NOT create or verify anatomy meshes.

## Public structure data

{id, name, region, tissueType, relationships, geometryStatus, source, selectable,
 visible, location, attachments, significance}

Regions: knee, shoulder, hip, ankle, wrist, spine.
Tissue categories: bones, muscles, ligaments, tendons, fibrocartilage.
Geometry status: unavailable | illustrative | source-derived | verified.

The eight knee structure summaries are editorial reference notes, not passage-
audited source findings. They are text-only until real geometry registers.
Source-derived is not equivalent to expert-verified.

To integrate PR #34, install window.BodyConnectiveGeometryProvider before calling
window.dispatchEvent(new Event('body:connective-geometry-ready')).
It must implement:
- listStructures(): registered exact structure records, including geometryStatus,
  selectable and source.
- selectStructure(id), focusStructure(id): select/focus exact registered mesh IDs.
- Optional setTissueVisibility(type,visible), isolateStructure(id),
  compareStructures(ids), showAll(), setContext(ghost), resetView(),
  setCameraOrientation({yaw,pitch}).

Only mark selectable=true for a real registered, renderable mesh; never invent
positions or report text verification as mesh verification. Missing geometry is
visible in the inspector but cannot be selected/focused in the viewport.

V14 adapter falls back to window.__BODY_ATLAS__.connectiveStructure(region,id),
connectiveSelect(id), connectiveFocus(id) for an exact mesh ID. Other names require
an explicitly justified mapping from PR #34. No fuzzy matching.

## Three minimal V13 shared-file touches

- atlas/index.html: add two new JS links and one CSS link.
- assets/atlas/atlas-controller.js: expose connectiveFilter, connectiveFocus,
  connectiveOrientation, connectiveSelect, connectiveStructure and connectiveReset.
- assets/atlas/atlas-renderer.js: opt-in draw/hit-test filter and mesh-bounds query.

When Studio closes, renderer filter is null, preserving V13 defaults.
The V9 connective fragments are broad, mixed geometry; do not imply they are
specific ligaments, tendons or menisci, or that category filtering has precise
per-mesh classification before PR #34 registers it.

## QA

npm test
python3 -m unittest discover -s scripts/tests
npm run test:e2e -- --project=desktop-chromium
npm run test:e2e -- --project=chromium-mobile
npm run test:e2e -- --project=webkit-mobile

V14 Playwright screenshots: artifacts/v14-mobile-*.png, v14-desktop-*.png.
The complete V13 tests are deliberately included in every browser run.
