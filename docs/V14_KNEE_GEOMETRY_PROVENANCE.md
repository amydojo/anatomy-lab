# V14 Operator C — knee geometry provenance

**Current outcome: a working, auditable import path and honest evidence UI, with a source-acquisition blocker for the eight target knee connective structures.** No ACL/PCL replacement, clinical validation, or motion simulation is claimed.

## Source audit

- The right femur, tibia, fibula and patella in knee/spatial/assets/bp3d-right-knee-4.0.json are BodyParts3D 4.0 sourced bones. Original IDs FJ3365 / FJ3387 / FJ3366 / FJ3381 and corresponding FMA identities, upstream commit and hashes are recorded in knee/spatial/assets/provenance.json.
- The 48 V9 connective surfaces are source-derived, but their inclusion in an atlas is not proof of valid knee attachment, coordinate registration or tissue verification. Re-run scripts/audit_v14_connective_sources.cjs to enumerate source identities and mesh topology.
- The eight currently selectable knee tissue surfaces are original procedural illustrations made using bone-bounding-box heuristics. They have no original mesh file hash, measured landmark residual or anatomist review.
- The 26 anatomy knowledge records are educational reference citations, not surface morphology or coordinate validation.

The structured catalog at atlas/assets/v14-knee-geometry-evidence.json gives all eight target source IDs, transforms, registration errors and review flags as unavailable or false. The Connective Studio inspector exposes this fact alongside the educational sources.

## License verification as of 2026-11-03

Official database license: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html. The current BodyParts3D database notice is CC BY 4.0 with required attribution: BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International.

Archive: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html. Pinned intermediate archive: https://github.com/ashemag/human-atlas/tree/1c38bf35c254a891200d3cedecfd57abebe83d8d.

Z-Anatomy and other independently adapted 3D models may impose share-alike and asset-specific noncommercial restrictions. Review the exact object/license chain and spatial relationship before any import, rather than assuming BodyParts3D licensing automatically governs unrelated derivatives.

## Four-bone geometry reference proof

Command: node scripts/verify_knee_bone_reference.mjs --out artifacts/v14-knee-bone-reference-audit.json

The script verifies all four source bone IDs, FMA identities, topology, right-sided naming, source import hashes and a shared transform. It reconstructs original-source bounding-box extrema from the serialized scene vertices to measure export transform-fidelity discrepancy (mm). It separately calculates the local exported file hash and reports that upstream binary bytes were not freshly downloaded and hashed.

This residual is a rounding/transform-fidelity check, **NOT** clinically meaningful landmark registration error, attachment verification or ACL/PCL alignment. Do not report these independent concepts as interchangeable.

## Guarded source-mesh import

The reusable library is scripts/geometry/registration.mjs; CLI entry point scripts/register_connective_source.mjs.

    node scripts/register_connective_source.mjs \
      --source /absolute/path/original-mesh.json \
      --provenance /absolute/path/source-evidence.json \
      --out /absolute/path/registered-unreviewed.json

Original mesh JSON contains vertices and triangular faces. The evidence JSON requires source_uri, source_asset_id, license, license_url, attribution, original_sha256, source_coordinate_system, source_units, laterality, target_frame, target_units, bone_reference_ids, and landmarks.fit plus landmarks.holdout.

Every named landmark supplies an ID and finite three-component source and target positions. Three noncollinear fit landmarks and two independent holdouts are required. Input must use explicit units (m or mm, or a target scene scale with a metres-per-unit conversion). The importer verifies raw source SHA-256, topology, laterality and proper rigid registration, then saves a 4x4 transform, landmark IDs, fit RMS and holdout RMS in millimetres. It **always outputs source-registered-unreviewed**, never source-verified.

The evaluateVerification evidence policy requires source/license/hash/coordinate identity, registration, independent held-out measurements, reviewed attachments, spatial clearance and a referenced independent qualified anatomy review before even eligibility for verified classification. Review metadata is auditable, not proof of the reviewer’s real-world credentials. Motion remains unvalidated.

## Scientific and visual release blockers

1. Identify and license the exact knee ACL, PCL, MCL, LCL, menisci, quadriceps tendon and patellar ligament source objects. No eight-object replacement was established from the pinned BodyParts3D source.
2. Derive and review source-versus-bone attachment landmarks against the femur/tibia/fibula/patella shared reference, with independently measured fit and holdout residuals.
3. Review actual ACL/PCL crossing, meniscal laterality, cartilage placement, ligament endpoints, bone penetration, orientation and surface artifacts. Do not infer these from current illustrative geometry.
4. Review calibrated anterior, posterior, medial, lateral and genuine sagittal sectional views. Current automated screenshots sample five generic camera orbits; **they are not scientifically calibrated views and no sagittal clipping plane has been implemented**.
5. Confirm camera focus, tap selection and isolation on all required devices; obtain qualified reviewer sign-off and a written error-tolerance protocol.

## Reproducible QA

    node scripts/validate_connective_coverage.cjs
    node scripts/validate_v14_connective.mjs --coverage atlas/assets/connective-coverage.json
    node scripts/audit_v14_connective_sources.cjs
    node scripts/verify_knee_bone_reference.mjs
    node --test tests/v14-geometry-registration.test.mjs
    npm test
    python3 -m unittest discover -s scripts/tests
    npm run test:e2e -- --project=desktop-chromium tests/v14-geometry-evidence.spec.mjs

The dedicated GitHub workflow runs source checks plus desktop Chromium, mobile Chromium and mobile WebKit regressions and stores output audit JSON and illustrative orbit screenshots as artifacts. CI pass means software integrity, not final anatomical approval. No merge or deploy is authorized.
