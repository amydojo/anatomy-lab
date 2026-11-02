# V14 · Connective Anatomical Intelligence (Operator C)

## Interface / zero changes to V13 renderer

The **canonical IDs are imported unchanged from Operator A's 26-record `atlas/assets/connective-coverage.json` inventory** (PR #34). This branch creates no aliases that compete with those IDs, and it does not modify V13 inspector, renderer, loader or registry.

- Data: `atlas/assets/v14-connective-knowledge.json`
- Schema: `atlas/assets/v14-connective-knowledge.schema.json`
- Browser adapter: `assets/atlas/connective-intelligence.js`
- Validation: `node scripts/validate_v14_connective.mjs`
- Optional inventory cross-check after Operator A lands: `node scripts/validate_v14_connective.mjs --coverage atlas/assets/connective-coverage.json`
- Unit tests: `node --test tests/v14-connective-intelligence.test.mjs`
- Python: `python -m unittest scripts.tests.test_v14_connective_knowledge`

### Browser consumption

Include `<script src="/assets/atlas/connective-intelligence.js"></script>`, then:

```js
const intel = await window.BodyConnectiveIntelligence.load({
  knowledgeUrl: '/atlas/assets/v14-connective-knowledge.json',
  // Supply only after Operator A's inventory has landed or is accessible:
  // coverageUrl: '/atlas/assets/connective-coverage.json'
});
const r = intel.getAdapter('anterior-cruciate-ligament');
// r = {structureId, record, relationships, evidence, geometry}
// Record exposes explanation.overview/detail and attachments.
// Not-found returns null, not a fabricated placeholder.
intel.getStructuresByRegion('knee');
intel.getStructuresByFunction('knee-stability');
intel.getRelatedStructures('medial-meniscus');
intel.getEvidence('medial-meniscus');
intel.getGeometryStatus('anterior-cruciate-ligament');
intel.listExplorations();          // stability / movement / load-distribution
intel.getExploration('movement');  // structured 2-level educational copy
intel.getCoverageReport();
```

Alternatively `BodyConnectiveIntelligence.create(parsedKnowledge, parsedCoverage?)` works synchronously and can be imported into tests via VM without fetching. No ES modules/bundler needed.

### Provenance and evidence policy

`knowledgeEvidence` means **written anatomical claims have associated NCBI Bookshelf references and named sections**. It is *not* a clinician review, source-quotation audit, or independent 3D verification. The offline validator checks HTTPS publisher URLs, reference IDs, section metadata, scientific shape/consistency, and relation targets. It does **not** fetch live articles or prove each claim. A later expert editorial review should confirm each passage/fine landmark.

`geometry.status` stays unverified by default. The adapter may display `source-linked-unverified` if a matching mesh and provenance fields appear in Operator A's inventory. It cannot return `verified` unless the inventory explicitly provides source/mesh IDs, license, provenance hash, same-coordinate proof, attachment review, kinematics review, and anatomist review. Do not turn a medical citation into a mesh-quality badge.

All records are anatomical templates: `bilateral-template` means side-neutral descriptions, **not two validated left/right meshes**. `axial-segmental` represents repeated spinal segments, not a single long mesh. The spine has no C1–C2 intervertebral disc.

### Intentionally unresolved

1. There is no verified structure-to-mesh correspondence yet. Side-specific geometry and attachments must be assigned by Operator A and reviewed.
2. The 26-item inventory covers three cuff tendons, not teres minor; only iliofemoral and ischiofemoral of the three major hip capsular ligaments (pubofemoral omitted); and ATFL/CFL and deltoid complex, but not posterior talofibular ligament as an independent record. Do not claim exhaustive coverage.
3. No fine fiber-by-fiber bundle positions, numerical ligament strain, patellar tracking, contact forces, disc deformation, meniscus pressure, or validated movement are claimed.
4. The TFCC and deltoid ligament are complexes; the spine structures repeat by segment; neither is represented as a single validated physical cord.
5. References are textbook-level evidence with source sections, not per-claim expert adjudication.

### Integration overlap

Files added on isolated Operator C branch: data, schema, adapter, validator, JS tests, Python test, documentation. No modifications to `assets/atlas/atlas-unified.js`, `assets/atlas/atlas-loader.js`, `assets/atlas/atlas-renderer.js`, `assets/atlas/v13-anatomy-info.js`, `atlas/assets/connective-coverage.json` (owned by Operator A) or shared inspector files (owned by Operator B).
