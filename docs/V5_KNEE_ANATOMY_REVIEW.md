# V5 KNEE / SPATIAL — anatomy review dossier

**Status:** technical asset import completed; **qualified anatomical review pending**. Keep V5 a draft experiment until the medical-illustration/anatomist or orthopedic reviewer approves the static anatomy and motion disclosures.

## What is sourced

Four right-knee skeletal meshes: femur (`FMA24474`), tibia (`FMA24477`), fibula (`FMA24480`), patella (`FMA24486`). The common reference pose and all mesh IDs originate from **BodyParts3D 4.0**, © Database Center for Life Science, CC BY 4.0. The pinned intermediate distribution is [ashemag/human-atlas, commit 1c38bf35c](https://github.com/ashemag/human-atlas/tree/1c38bf35c254a891200d3cedecfd57abebe83d8d). It applies documented axis conversion and mesh processing. The V5 importer verifies both upstream files' Git blob hashes and SHA-256 values. The four meshes are uniformly transformed into the local scene frame—not independently aligned.

See: `knee/spatial/assets/provenance.json`; reproducible import `scripts/import_bp3d_right_knee.py`.

## What is illustrative

Menisci, ACL, PCL, collateral ligaments, and extensor mechanism are **procedural teaching proxies**—their exact attachments, shapes, paths, contact surfaces and motion are not verified. The flexion is an educational single-axis rotation, not clinically measured joint kinematics. The patella path is an approximation. No tissue forces, ligament strain, meniscal deformation, diagnosis or surgical assessment are computed.

## Required human checks

- [ ] **Source identity:** Verify labels, right laterality, and bone geometry against BodyParts3D source identifiers and independent anatomical references
- [ ] **Articulation:** Verify distal femur and tibial plateau orientations, posterior condyles, patellar trochlea, fibular head and joint alignment in the **neutral reference pose**
- [ ] **Camera convention:** Establish and validate anatomical anterior/posterior, medial/lateral, proximal/distal labels when camera orbit changes
- [ ] **Kinematics:** Review flexion visualization, bone-to-bone intersections, axis location and patellar motion; explicitly reject physically misleading depictions
- [ ] **Soft tissues:** Review or replace the schematic ligaments, tendons and menisci before any fidelity claim; place attachment points on reviewed anatomical landmarks
- [ ] **Illustration disclosures:** Confirm that source-vs-schematic labels and attribution remain visible and not misleading on mobile
- [ ] **Source compliance:** Confirm attribution and 4.0 source terms, including intermediary transformations, are presented wherever adapted geometry is distributed
- [ ] **Signoff:** Record reviewer name, professional capacity, date, screenshots/build commit reviewed, concerns and approval scope

**Software QA is not anatomy review.** The automated checks confirm that bone meshes exist, share coordinates, match pinned FMA identifiers, have valid triangle indices and load at mobile widths. They cannot validate their clinical anatomical accuracy.

## Reviewer decision

Reviewer: _pending_  
Reviewed commit: _pending_  
Date: _pending_  
Approval scope: _pending_  
Remaining inaccuracies: _pending_

Until this section is complete, **V5 stays a draft/preview and V4 stays the published default**.
