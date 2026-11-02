# Connective tissue expansion — knee first

This branch establishes a **source/geometry verification gate**, not a finished 3D connective layer. Do not mark structures rendered or verified based on this inventory.

## Order of work
1. **Knee:** obtain licensed source meshes for quadriceps tendon, patellar ligament, MCL, LCL, ACL, PCL, and both menisci. Preserve native mesh identifiers, provenance hashes and coordinate frame. Verify anatomical orientation, insertions, articular relationships, left/right laterality and nonintersection against sourced femur/tibia/fibula/patella. Register and render only passing meshes; label unverified motion as illustrative.
2. **Shoulder:** rotator-cuff tendons and glenoid labrum, with scapular/humeral registration.
3. **Hip:** capsular ligaments and acetabular labrum, with pelvis/femur registration.
4. **Ankle:** calcaneal tendon, lateral ligaments and deltoid complex.
5. **Wrist:** flexor retinaculum, scapholunate ligament and TFCC.
6. **Spine:** longitudinal ligaments, ligamenta flava and intervertebral discs, respecting segment-specific anatomy.

## Required release checks
- `node scripts/validate_connective_coverage.cjs` must pass.
- Every rendered connective mesh must have an attributable license, original mesh ID, source URI, SHA-256, explicit coordinate transform and quantified registration error.
- Visual QA must inspect the knee from anterior, posterior, medial, lateral and sagittal-section views; verify ACL/PCL crossing and meniscus side identification.
- Automated tests must cover layer selection, tap hit-testing, evidence disclosure, absent-source fallbacks, touch/desktop rendering and motion restrictions.
- A qualified anatomy reviewer must sign off before claiming clinically validated geometry, insertion coordinates or biomechanics.

## Current gap
The existing V9 overview has 48 source-derived connective meshes, but its provenance lists only six educational associations and explicitly says attachments and motion are not validated. The 26 entries in `atlas/assets/connective-coverage.json` are **targets**, not newly imported meshes. Do not synthesize missing geometry and label it source-verified.
