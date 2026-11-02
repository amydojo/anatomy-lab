# BODY / LIVE — Independent source triage and anatomical review record
Review initiated: 2026-10-29. Scope: draft V9 / PR #25. Status: **NOT APPROVED FOR EXPERT-VALIDATED CLAIMS OR MERGE**.

## Review method and status boundary

This is a source-level and software/geometry evidence review performed without an independently retained or credential-verified human anatomist, radiologist, otologist or biomechanist. It is **not a professional anatomical sign-off**. Do not set `anatomist_reviewed`, `kinematics_validated`, or `clinical_use_approved` to true based on this report. Source availability, permissive license, attractive appearance and passing browser tests do not establish anatomical validity.

The V9 expansion's original source is pinned BodyParts3D 4.0, with source FMA identities and hashes. It contains 64 added bones (56 digital phalanges, eight facial bones), 237 added muscle surfaces and 48 static connective/cartilage surfaces. Combined overview totals: 201 distinct bone *meshes*, corresponding to 199 bones under conventional counting after consolidating three sternum meshes; 386 selected muscle *meshes*. Mesh count is not a count of anatomically distinct muscles. These are subject to an independent anatomical inventory sign-off. The source omits coccyx, bilateral mallei, incudes and stapes.

### Candidate source clearance — decision register

| Candidate and primary provenance | Suitable anatomy | Evidence confirmed | Source/registration/rights blocker | Decision |
| --- | --- | --- | --- | --- |
| **BodyParts3D 3.0, official 2011 release** — https://dbarchive.biosciencedbc.jp/data/bodyparts3d/20110915/ ; https://dbarchive.biosciencedbc.jp/data/bodyparts3d/20110915/README_e.html | Facial expression and mastication | Official OBJ archive and part list available; independent OMFAtlas technical report describes 47 recovered facial meshes, with four shared skull control bones | Archive notices say CC BY-SA 2.1 Japan, unlike later 4.0 CC BY 4.0; 3.0 and 4.0 coordinates do **not** directly align; OMFAtlas transform must be independently reproduced on our source and held-out controls; original geometry hashes and source part list must be checked | **Conditional research candidate; NOT approved for redistribution/integration** |
| **OpenEar** — Sieber et al., *Scientific Data* (2019), https://doi.org/10.1038/sdata.2018.297 ; Zenodo https://doi.org/10.5281/zenodo.1473724 | Both-sided malleus, incus, stapes (possible segmentation source) | Research publication and Zenodo describe co-registered temporal bone images and segmented middle-ear ossicles, CC BY 4.0 | Datasets are multiple distinct human specimens (59+ GB in published record); no verified mapping to the BodyParts3D head and no independently selected left/right matched pair; physical dimensions and orientation need cross-validation, especially at sub-millimeter ossicle scale | **Scientifically credible candidate; registration and source extraction NOT complete** |
| **NIH 3D model #3DPX-014841**, https://3d.nih.gov/entries/download/14841/3 | Sacrum/coccyx complex | Public entry supplies a `Sacrum Cocc` mesh, GLB/STL and other formats | Coccyx is not a source-identified *isolated* bone; specimen provenance, license, segmentation boundary and separate registration still need confirmation | **Not accepted as the single missing coccyx** |
| **Z-Anatomy**, https://www.spi-inc.org/projects/z-anatomy/ ; https://github.com/LluisV/Z-Anatomy/blob/PC-Version/Resources/Models/License.txt | Alternative muscles and detailed relationships | Large collaborative anatomy project with model attribution documentation | Adaptations are CC BY-SA 4.0 plus some differently licensed included models. Exact-source per-mesh chain, compatible redistribution rights, FMA map and independent registration to our 4.0 frame are unresolved | **Terminology/reference candidate; no mesh copying** |
| **OpenSim models**, https://opensimconfluence.atlassian.net/wiki/spaces/OpenSim/pages/53090607/Mus | Joint reference motion, tendon pathways, validation comparisons | Published models include limb joints and muscle-tendon actuators, with model-specific uses, limitations and licenses | Generic OpenSim joint frames/forces are not measured on this BodyParts3D specimen. Transferring limits, constraints, attachment sites or motion tracks without frame matching and validation would be misleading | **Benchmark source only; not approval to replace inferred rigs** |

### Independent conclusions and critical issues

**P0 — Expert signoff absent.** No credential-verified human anatomist or biomechanist has assessed the actual current rendered specimen, bone identity/side, bone adjacency, muscle location, digit articulation, tissue layer occlusion, joints, kinematic axes and tissue associations. Current review flags must remain false.

**P0 — Mixed source coordinate risk.** Source frames differ. The 3.0 vs 4.0 skull requires an independently calculated similarity transform from shared skull landmarks/surface matches. Do not apply a convenient hand-tuned transform or transplant the OMFAtlas numbers without independent replication. Use at least three non-collinear registered bone controls plus a wholly held-out control; verify bilateral symmetry, units, surface distances and nonintersection after alignment. Specify per-region tolerances before accepting; ear ossicles need precision appropriate to their imaging scale. Retain the original/source OBJ or triangulated mesh and hash.

**P0 — Source license boundary.** Treat current 4.0 assets (official site CC BY 4.0) and archived 3.0 OBJ (its own CC BY-SA 2.1 Japan notices) as separate license lines. Z-Anatomy also invokes share-alike and some downstream collections include noncommercial assets. Before copying facial meshes into distributable V9, obtain rights review for separate overlay/distribution and derivative requirements, preserve original author/license, and show attributions at asset-level. No legal clearance is implied.

**P0 — Current QA gate red.** Most recent full run #40942980128: 414 browser tests passed, 18 failed; focused suite passed 48. Several V8.2 movement-reset screenshots fail equality, and at least one mobile slider sizing check fails. Need independent root-cause, code correction and rerun (not simply weakening screenshot assertions). Real device testing and performance measurement absent.

**P1 — Counting convention must be independently checked.** 201 meshes != 201 conventional bones, because three sternum pieces represent one standard adult sternum. Current claim is 199/206 **conventional** bones based on 135 pre-expansion plus 64 new meshes. Independently map the full 206 canonical list and check every side, group, fused bone/sesamoid convention, duplicate and missing source mesh before signing the count.

**P1 — Muscle counting and labels.** 386 muscle meshes are not 386 distinct muscles and do not imply broad completeness. The 47 facial meshes from the older source have not been independently ingested, rights-vetted or registered. Do not show an 'all muscles' claim or implied facial coverage.

**P1 — Biomechanical validation.** Existing motion rigs use illustrative/inferred pivots and skinning, not experimental ligament/tendon attachment coordinates. The six source connective associations are *anatomical adjacency* metadata, not force-transfer models. Before scientific validation: document body landmarks and coordinate systems (ISB JCS), neutral pose, continuous ROM, measurement references and joint-specific comparison metrics; validate against suitably measured cadaver, imaging or motion data. See ISB standards https://www.isbweb.org/activities/standards and Hicks et al. 2015 https://pmc.ncbi.nlm.nih.gov/articles/PMC4321112/.

## Independent expert review — deliverables and acceptance requirements

Reviewers should be **named individuals** whose qualifications can be verified, independent of the code-generation work. Recommend at least one anatomy educator/anatomist experienced in osteology, head & neck, and musculoskeletal dissection; one biomechanics specialist familiar with 3D musculoskeletal models and ISB coordinate systems; and, for microscopic ossicles, an otologist or temporal-bone imaging specialist. Copyright/license review is a separate responsibility, not a medical competence.

For each review: reviewer name, verifiable qualification, institution/affiliation, scope, reviewed exact commit SHA, specimen version, date, review media (360° captures and atlas interaction), inspected source list, numbered corrections, severity, evidence refs, acceptance criteria and unambiguous **approved/conditional/rejected** result. A reviewer may approve anatomical appearance without approving clinical inference or biomechanical dynamics. Each dimension requires separate sign-off; never infer one from another.

### Required visual and motion samples
- Head: skull vault, all facial bones, mandible, isolated jaw muscles once legitimately sourced; ears in an enlarged view if/when ossicles imported.
- Spine/torso: cervical/thoracic/lumbar vertebrae, sternum, pelvis, sacrum, coccyx if sourced, superficial and deep posterior musculature.
- Extremities: bilateral shoulder/elbow/wrist/hand, hip/knee/ankle/foot; anterior/posterior/lateral, muscles-on and isolated; each finger/toe with correct proximal/middle/distal distribution.
- Motion: neutral, 25%, 50%, 75%, maximum for **each** existing axis, both signs where supported, plus return to neutral, and evidence that bones stay connected and muscles do not tear or penetrate unrealistically.
- Interaction: coordinate-labeled picked surface, consistent FMA/side, reliable screen-to-mesh mapping with inspector overlaid, accessible desktop and phone controls.
- Sources: each addition's original DOI/URL/version/license/checksum, FMA/other ontology ID, source units and selected registration transform.

### Current decisions

- Data-science provenance review: **completed within inspected software/source scope**.
- External candidate discovery and documentation: **completed**.
- New human ossicle/coccyx/facial meshes brought into the rendered atlas: **NO; not cleared/registered**.
- Independently qualified anatomist review: **PENDING**.
- Independently qualified biomechanical review: **PENDING**.
- Licensing clearance for cross-version and mixed sources: **PENDING**.
- Full QA regression and device/accessibility review: **PENDING**.
- Expert/clinical scientific validation status: **NOT APPROVED**.

Do not update production, merge V9, or advertise 206/206 until all relevant gates have actual evidence.