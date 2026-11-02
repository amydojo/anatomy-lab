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

## V14 interactive illustrated knee (development branch only)
Eight separately generated, GPU-rendered and hit-testable educational surfaces are shown in the V13 licensed knee bone coordinate space. Select Connective anatomy in the right-knee detail view to toggle bones/muscles/ligaments/tendons/fibrocartilage and isolate a structure. The source bones retain BodyParts3D 4.0 CC BY 4.0 attribution; the extra surfaces are original illustrative artwork, not BodyParts3D data. They have **no measured registration error** and **no validated insertion coordinates or biomechanics**. Do not treat position, thickness, apparent contact or crossing as anatomical proof.

Source-backed relationship texts: [OpenStax 9.6 — Anatomy of Selected Synovial Joints](https://openstax.org/books/anatomy-and-physiology-2e/pages/9-6-anatomy-of-selected-synovial-joints); [NCBI Bookshelf — Knee anatomy](https://www.ncbi.nlm.nih.gov/books/NBK500017/). Separate anatomical education from geometry validation.

### Source acquisition blockers
* Official [BodyParts3D 4.0 archive](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html) has broad musculoskeletal assets, but eight named right-knee surfaces and matching attachment coordinate metadata have not been confirmed in the pinned release. **Do not transplant unrelated source identities.**
* Z-Anatomy is a prospective richer connective dataset, but its precise commercial/share-alike license revision must be checked for each asset and its external coordinate frame must be nonrigidly or landmark-registered to this specimen. No such migration is complete.
* The six-region target inventory is not six completed interactive labs. Knee illustrates eight educational shapes; the shoulder, hip, ankle, wrist, and spine targets remain unrendered pending evidence.
* Require registered source geometry, numerical distance-to-landmark registration metrics, nonintersection reports, laterality and qualified anatomy review before marking any geometry source-verified.
