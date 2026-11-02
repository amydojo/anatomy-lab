# V10 · Facial-muscle source download, coordinate registration, and validation

## Implemented and verified source pathway

BODY / LIVE now imports **47 genuine facial-expression and mastication muscle surfaces** (not procedural stand-ins), recovered from the official BodyParts3D **3.0** 95% polygon-reduction archive by the open OMFAtlas project. OMFAtlas's published registered derivative is fetched by the V10 generator at an **exact Git commit** and by exact manifest/binary Git blob hashes. The original 47 OBJ SHA-256 hashes accompany each source mesh.

- Original anatomy: BodyParts3D 3.0 (2011), Database Center for Life Science, [archive and part list](https://dbarchive.biosciencedbc.jp/data/bodyparts3d/20110915/), [terms](https://dbarchive.biosciencedbc.jp/data/bodyparts3d/20110915/README_e.html).
- Registered derivative and alignment methodology: [OMFAtlas](https://github.com/choxos/OMFAtlas), pinned commit `c835665a9ade09ee0b993cee6eee1b25b7f7311b`, `documentation/qa/FACIAL-SOURCE.md`.
- Source assets: `public/models/facial/atlas.json` and `facial.bin`; original source metadata, FMA identities, packed binary and the upstream source transform are preserved.
- Newly emitted BODY / LIVE assets: `atlas/assets/v10-facial-reference.json` and `v10-facial-provenance.json`; generator `scripts/import_v10_facial.py` and GitHub workflow `v10-facial-source.yml`.
- **Per-asset license:** CC BY-SA 2.1 Japan, with source attribution: *BodyParts3D, Copyright© The Database Center for Life Science licensed by CC Attribution-Share Alike 2.1 Japan*. The distinct v4.0 base retains CC BY 4.0. The mixed viewer's code license is separate. Facial adaptations are redistributed under the original share-alike terms; do not relicense them under CC BY 4.0.

### Alignment — transparent evidence and its limits

OMFAtlas fitted a similarity transform (scale/rotation/translation) from BodyParts3D 3.0 OBJ millimetres to 4.0 head models using shared **mandible, frontal bone and right maxilla** controls. The **left maxilla** was held out; published upstream nearest-surface RMS was **0.258 mm** (source to reference) and **0.089 mm** (reverse), as recorded in its pinned metadata. We reuse that transformation, *not* a hand-placed mesh.

The registered derivative is in BodyParts3D 4.0 metre/Y-up coordinates. BODY / LIVE's canonical uniform transformation is:

```
localX = registeredX_metres * 5
localY = (registeredY_metres - 0.9) * 5
localZ = registeredZ_metres * 5
```

The build verifies the binary/manifest against their exact upstream Git blob IDs, original per-OBJ SHA256 provenance, source FMA uniqueness against all V8/V9 meshes, finite vertices, valid triangle topology, and original source face/head scope. In particular, jaw muscle bounds are checked against the **actual V9 source mandible** rather than only a generic world-space crop. It rejects mm/metre confusion and gross left/right/height mistakes.

**Limit:** The held-out control registration was performed *upstream*, not independently re-fitted from the four unreduced original 3.0/4.0 control bones within this repository. The current local check is a shape-bounds/proximity sanity test, not an independent millimetre-scale surface RMS measurement. The source models are simplified for web display. Browser tests verify rendering and identity, not microscopic precision or patient anatomy.

### Integration / anatomy coverage

- Existing V9 overview: **201 skeletal mesh surfaces** corresponding to **199 conventional adult bones**, **386 muscle mesh surfaces**, and **48 static connective/cartilage mesh surfaces**.
- V10 adds **47 identifiable licensed facial muscle mesh surfaces**, bringing the overview to **433 muscle meshes**. These are not necessarily 433 distinct muscles under every anatomical counting convention.
- V10 facial surfaces appear in the existing Bones/Muscles/Combined view and as reference anatomy in the **skull and jaw** detail scene. The 47 structures are registered separately by FMA identity and source license, with genuine source geometry for selection.
- **No jaw musculature motion** was added: muscle muscles are displayed reference-static even if the jaw opening teaching control is moved. The prior jaw motion remains *illustrative*, not a validated muscle/tendon function.
- The skeleton remains **199/206**. The coccyx and paired malleus/incus/stapes remain unresolved; no fake geometry was inserted.

### Remaining additional-source candidates

1. **Six middle-ear ossicles:** the OpenEar dataset offers triangulated, segmented temporal-bone structures, but a published index can be publicly visible even if its large underlying files are restricted. The University of Antwerp's downloadable human ossicle models explicitly permit *non-commercial scientific use* and require consent for other uses, so these cannot be silently treated as generally redistributable commercial open assets. A usable model requires compatible licensing, documented specimen/side, verified original units, and an anchored transformation onto the BodyParts3D temporal bones. No data has been imported from those sources.
2. **Coccyx:** a Z-Anatomy coccyx reference is available under CC BY-SA 4.0, but the geometry is from a different model/specimen. Before import, isolate the original mesh, preserve its license and identity, derive a registration from the adjoining sacrum/pelvis using true shared landmarks or surfaces, check handedness/scale/intersection, and retain separate provenance. The BodyParts3D 4.3 community "spine" selector regex mentions coccyx but its actual canonical 4.3 MANIFEST.csv does **not** include a coccyx mesh; never infer availability from a group label alone.
3. **Clinical/joint validation:** no independently named, credentialed anatomist or biomechanics specialist has signed off on the current geometry or motion models. No claim of expert-approved, anatomically validated, patient-specific or clinically accurate biomechanics is permitted. Independent specialist review and software regression are separate release gates.

### Decisions
- Correctly licensed, attributable facial source download: **completed**.
- Facial cross-version registration for **experimental visual reference**: **implemented**, source transform inherited from upstream, local sanity checks; independent source-control re-fit **not completed**.
- Geometry and source-ID checks: **automated**; source and browser QA gate required.
- Remaining seven bones: **not imported**, due to missing compatible, independently registered source geometry.
- Anatomical expert validation: **pending**, not implied by this work.
- Merge to production: **blocked pending tests and visual review**.

See `atlas/assets/v10-facial-provenance.json` for exact hashes, per-part original source IDs, license and held-out registration metadata.
