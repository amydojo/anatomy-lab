# V11 · Sacral landmark + temporal-bone registration
Source data and technical geometric validation, **not clinical review**.

## Outcome

The full-body reference now has **208 bone mesh surfaces representing the standard 206 adult bones**, subject to the usual adult bone-count conventions (the manubrium, sternal body and xiphoid are three separate meshes of a single sternum). The seven source additions are:
- **Coccyx**, matched to BODY / LIVE's source-identified sacrum and its inferior/caudal landmark;
- **Left and right malleus, incus and stapes**, matched together using source-identified left and right temporal bones.

These are **seven independent 3D source meshes**, not shapes invented by the renderer or mirrors made by our script. The source itself has distinct left/right objects, which may share a common upstream modeling history. The ossicles are reference-static; no vibration, tympanic attachment, or biomechanical occlusion is simulated.

## Original source and exact reproductions

- Pin: [LluisV/Z-Anatomy, PC-Version, commit `6c7f9016bd5899ac8edafd31b9900c151df42ed6`](https://github.com/LluisV/Z-Anatomy/tree/6c7f9016bd5899ac8edafd31b9900c151df42ed6)
- Asset: `Resources/Models/FBX/SkeletalSystem100.fbx`, SHA-256 `294a649765cd060a62a4095da52b9c8ef2d97769aa447e196448aa5f7d596dea` (41,339,660 bytes).
- License: **CC BY-SA 4.0**, attribution **Z-Anatomy, the open source atlas of anatomy, and contributors**, plus underlying BodyParts3D © The Database Center for Life Science, **CC BY-SA 2.1 Japan**. The source repository includes *separately* adapted University of Dundee inner-ear material under **CC BY-NC-SA 4.0**; no separately identifiable inner-ear models are included in these seven skeletal objects. Per-object provenance must be reconfirmed before commercial redistribution.
- Source component names: `Coccyx`; `Malleus.l/.r`, `Incus.l/.r`, `Stapes.l/.r`; and control objects `Sacrum`, `Temporal bone.l/.r`, `Hip bone.l/.r`, `Frontal bone`, `Vertebra L5`. Annotation-only objects (tiny 8-vertex marker cubes) are not imported as bones.
- Original source inventory: `docs/v11-z-skeletal-inventory.json`; pinned Blender extraction `scripts/extract_v11_z_controls.py`; independent geometry solver `scripts/fit_v11_source_bones.py`. GH workflow `v11-register-source.yml` regenerates the release assets. Each generated mesh retains its original source name and license.

## Fitting method

Our existing source model is pinned BodyParts3D 4.0. Z-Anatomy uses metre-based, Z-up original skeletal coordinates; BODY / LIVE uses Y-up coordinates shifted by 0.9 m then scaled ×5. The initial rotation was the source-axis permutation `[x,z,-y]` and the initial similarity scale was 5.

Rather than accepting the initial coordinates, we fit **source geometry to actual existing meshes** with surface-area-uniform barycentric sampling and trimmed, repeated nearest-surface similarity ICP, based on the Umeyama/Kabsch solution with a proper rotation determinant. The coccyx is transformed using the **sacrum** fit plus a translation anchored to the actual caudal sacral surface. The ossicles retain their rigid inter-ossicle relationships and use one bilateral **temporal-bone** registration, not six independent free placements.

Checks compare:
- Source sacrum / left/right temporal controls;
- **held-out** left/right hip bones and L5 after sacrum fit;
- **held-out** frontal bone after bilateral temporal fit;
- coccyx below and near the target sacral apex;
- independently source-defined left/right ossicle positions within the appropriate temporal-bone envelopes, original sizes, and coherence of each ossicular chain;
- orientation (proper rotation rather than reflection), plausible scale, complete surface topology, unique source identity and immutable SHA-256.

**Results** (BODY / LIVE world units where 5 units=1 m; multiply values below by 200 to obtain approximate mm):

| Check | Trimmed RMS in atlas units | Approx mm |
|---|---:|---:|
| Source sacrum | 0.012461 | 2.49 |
| Sacrum fit / held-out left hip | 0.025602 | 5.12 |
| Sacrum fit / held-out right hip | 0.021680 | 4.34 |
| Sacrum fit / held-out L5 | 0.010181 | 2.04 |
| Source left temporal bone | 0.007967 | 1.59 |
| Source right temporal bone | 0.008651 | 1.73 |
| Temporal fit / held-out frontal bone | 0.011333 | 2.27 |

The coccyx's closest-point distance from the sacrum was **0.026526** atlas units (~5.3 mm), with an inferior sacral-apex gap of **0.0245** units (~4.9 mm). The separate source sacrum was aligned using near-surface ICP; the caudal apex was aligned with an additional **recorded landmark-derived rigid translation** `[-0.000351, -0.186497, 0.017044]` atlas units. Neither bone shape was artificially deformed to meet the other.

**Important:** 1–5 mm RMS errors are sufficient to reject grossly misplaced bones, but **not clinical-grade** measurements—especially for a stapes approximately 3 mm long. The inner-ear/ossicular spatial microrelationships and tiny articular surfaces are *not* verified by this fit. An ENT/otology specialist review would be needed before teaching fine ear mechanics or claiming surgical accuracy.

## Release and licensing scope

The seven derived meshes are separately named, attributed and licensed under **CC BY-SA 4.0**, consistent with the Z-Anatomy skeletal source's stated terms. Adapted geometry remains share-alike; do not represent it as solely CC BY 4.0 or use it without the upstream notices. Source-specific license chain for the six ear ossicles requires final confirmation before commercial redistribution given the other NC inner-ear content in the upstream project.

The existing 4.0 anatomy and 3.0 facial meshes retain their earlier license terms. No synthetic geometry, anatomy motion-engine replacement, new joint constraint, or clinical claim is introduced.

**Review status:** technical geometry checks passed; independent anatomical/otology and biomechanical validation remains pending; physical-device visual QA and whole-app regression must pass before release; production unchanged.
