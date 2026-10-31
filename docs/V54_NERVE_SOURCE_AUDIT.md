# V5.4 — Nerve Truth Foundation | Evidence, licensing, release gates

**Status:** Three actual Z-Anatomy-derived right sciatic/peripheral nerve surface meshes imported and mathematically registered to a separately sourced BodyParts3D 4.0 Hip model. **Not patient-specific, not imaging-derived, and NOT clinically validated.**

## Source audit (2026-10-27)

| Candidate | Evidence | Reuse decision |
| --- | --- | --- |
| BodyParts3D 4.0 atlas | CC BY 4.0; same right-sided hip, gluteal/deep-rotator anatomy as V5.3. The reduced source subset does not include the sciatic nerve mesh. | Keep as bone and muscle reference only. |
| BodyParts3D 4.3 full atlas | Licence and API differ from 4.0. The independently indexed 4.3 mesh set did not list sciatic nerve in its manifest. | Not suitable for a full sciatic surface by itself. |
| Z-Anatomy | Contains actual right sciatic, tibial and common fibular nerve geometry. Z-Anatomy adapted BodyParts3D and its nerve curves are surfaced by atlas export. Models generally CC BY-SA 4.0 with per-component exceptions. | Select ONLY the relevant right peripheral-nerve components. |
| nqwrc/3d-anatomy export | Pinned Git SHA 8ca3b7421bcfbe88b85859eb1983d5cf79f21749. Nervous.glb SHA-256 and Git blob hashes verified; exact glTF node identities Sciatic nerve.r (533), Tibial nerve.r (532) and Common fibular nerve.r (523). Full nervous.glb includes noncommercial cochlea/vestibule; distributing the whole GLB is NOT permitted under isolated CC BY-SA-only terms. | Hash-download, isolate only those three meshes, transform node hierarchy, export derivative JSON with its own source notice. Exclude rest of source archive. Require legal review before a public/commercial release. |
| Pennsieve dataset 692, DOI 10.26275/1jdc-qiiv | Six approximately 9 cm excised sciatic segments (three left, three right) from one donor, micro-CT at 11.4 micron voxels, fascicle morphology and connectivity graphs. CC BY 4.0. | Excellent candidate for future microstructure feature but NOT the anatomic course in the pelvis; NOT integrated. |
| Open-access lumbosacral MRI nerve-root study (2024) | Patient imagery for spinal roots around L1–S2, not a validated in-situ pelvis-to-thigh sciatic reconstruction matching our hip. | Research reference only, not imported. |

## Registration contract
- The source 4.0 BodyParts3D femur (hip/spatial/assets/hip-source.json) is the reference.
- The right femur in Z-Anatomy's skeletal GLB is decoded as a separate registration benchmark. The complete reference sources may not be from the same specimen.
- A rigid orientation-preserving ICP transform minimizes source/target femur surface differences. Exact matrix, error statistics, sample sizes, SHA-256 and code are recorded in `hip/spatial/assets/sciatic-provenance.json`. **These are bone-surface fit residuals, not nerve localization errors.**
- The SAME calculated transform is applied to sciatic, tibial and common-fibular surfaces. No per-nerve visual hand alignment is allowed.
- The graph links sciatic -> [tibial, commonFibular] according to named Z-Anatomy mesh hierarchy; it does not claim complete nerve branching or fascicular topology.
- Golden Trace centerline is a median-of-surface-slices visual estimate and **not a manually/imaging-segmented centerline**.

## Legal notices
Original: **Z-Anatomy — The libre 3D atlas of anatomy, CC BY-SA 4.0**; **BodyParts3D — The Database Center for Life Science, CC BY-SA 2.1 Japan**; model conversion by **nqwrc/3d-anatomy**. Selected isolated peripheral nerve derivative under **CC BY-SA 4.0** with attribution, modification record and share-alike. The project code and independently sourced BodyParts3D 4.0 meshes have separate licenses. Excluded noncommercial inner-ear material must never be copied. This component scope/compatibility still warrants qualified legal review before a broader release.

## Anatomical reviewer checklist

- [ ] **Verify identity and laterality** of the source nodes against Z-Anatomy's anatomical hierarchy and expert references.
- [ ] **Validate femoral registration**, checking acetabulum and muscle relations independently. Residuals alone do not validate nerve placement.
- [ ] **Examine proximal sciatic course** relative to the inferior piriformis border, greater sciatic foramen, deep gluteal structures and femur in at least three views.
- [ ] **Confirm branching continuity and course** at sciatic/tibial/common fibular junction; atlas source may simplify variants.
- [ ] **Confirm uncertainty language** on mobile and desktop, distinguishing source geometry, registration error, estimated centreline, and medical imaging.
- [ ] **Review copyright and share-alike compliance** for derivative model files and attribution in viewer and export.
- [ ] **Re-run source-integrity tests, Chromium/WebKit mobile tests** and 320/390/430px screenshots. Record reviewer and exact commit.

Until these gates are complete: **V5.4 is an educational composite preview. No anatomical validation claim, patient-specific nerve segmentation, symptom/entrapment diagnosis, force/strain metric or treatment decision support.**

## Optional future segmentation research track

A genuine clinical workflow would require proper patient imaging (for example dedicated MR neurography), an expert-annotated segmentation reference, quantitative evaluation (Dice, surface distance, centreline and branch identification), documented image-to-bone registration, inter-rater agreement, privacy controls and review of intended medical-device use. None are part of this release.
