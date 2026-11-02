# HIP / SPATIAL V5.3 — source and anatomical review

**Status: Imported and technically validated, not medically reviewed.**

## Imported anatomy
BodyParts3D 4.0 (© DBCLS), CC BY 4.0. Original derived atlas pinned to \`1c38bf35c254a891200d3cedecfd57abebe83d8d\`. Eleven geometry meshes in \`hip/spatial/assets/hip-source.json\`, with hashes, per-model FMA IDs, counts and coordinate transforms in \`hip/spatial/assets/provenance.json\`.

Reproducible import: \`scripts/import_bp3d_hip.py\`. Original source coordinates are shared. DO NOT independently recenter hip muscles or bones.

## Requiring qualified anatomical review
- [ ] Confirm right hip bone, proximal femur and sacrum orientation; compare joint contact region in anterior, posterior and lateral views
- [ ] Verify gluteus maximus, medius, minimus and deep rotator spatial stacking; note any mesh-source overlaps
- [ ] Validate piriformis proximity and carefully label the schematic sciatic route as NOT actual nerve topology
- [ ] Review the location of the *estimated* animation pivot against femoral head/acetabulum
- [ ] Check 0°, 30°, 60°, 90° flexion; 0°, 20°, 40° abduction; -30°, 0°, +30° axial rotation for severe collisions
- [ ] Ensure source muscle meshes do not misleadingly appear deformed or attached to the moving femur
- [ ] Check the gluteus medius educational explanation with an anatomy expert
- [ ] Verify source and copyright attribution remains accessible in the app
- [ ] Sign review: expert name, credentials, inspected commit, date, scope, findings and approvals

## Technical boundaries
Multi-axis transforms are rigid and reversible, not clinical simulation. Only femur moves; pelvis and muscles remain static. The golden sciatic guide is programmatic, NOT from BodyParts3D. No forces, individualized nerve mapping or medical claims.

## Final signoff
Reviewer: **PENDING**  
Date: **PENDING**  
Approved scope: **NONE**  
Clinical accuracy certification: **NOT CLAIMED**
