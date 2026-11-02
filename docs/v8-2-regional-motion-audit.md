# V8.2 — Regional Motion Audit and Scientific Limits

Status: **software prototype / source-derived, unreviewed**. This milestone adds distinct bounded movement controls to each anatomically supported site; it does not establish clinical accuracy. No individual patient's anatomy, measured joint axes, muscle forces, cartilage contact, ligament tension, or nerve stretch has been inferred from the reference meshes.

## Implementation and limitations by region

| Region | Primary motion (teaching preview) | Secondary control | Sourced surfaces and missing validation |
|---|---|---|---|
| Skull / Jaw | Mandible opening around an estimated bilateral temporomandibular contact line (0–22°) | None | Mandible and temporal bones from pinned BodyParts3D. No TMJ disc/contact/condylar sliding measured. Extraocular muscles remain in reference pose. |
| Neck / Cervical | C3–C7, axis and atlas linked in a weighted chain for cervical flexion (0–22°) | Cervical rotation (±25°) | One source reference posture. Discs, segmental neutral zones, facet constraints, hyoid coordination and nerve roots not modeled. |
| Ribs / Thorax | Bilateral source rib rotations (0–9°) | None | A low-amplitude rib motion cue, NOT breathing simulation. Rib cartilage, changing rib-cage volume, diaphragm displacement and lung tissue absent. Intercostal and diaphragm surfaces remain static rather than inventing respiratory muscle mechanics. |
| Shoulder | Existing scapula/clavicle/humerus hierarchy, bounded elevation (0–110°) | Humeral rotation (−35° to +40°) | Approximate source landmark correspondence, 3 rigid transforms and inferred rotator-cuff weights. No labrum, tendon wrap, joint contact or physiologically measured scapulohumeral rhythm. |
| Elbow | Humeroulnar/radioulnar flexion (0–130°) | Radius-only pronation / supination (±70°) | The source ulna, radius and humerus retained as distinct bone surfaces; muscle attachment weights estimated from bone surfaces. No forearm ligament or interosseous-membrane constraints. |
| Wrist / Hand | Carpals/metacarpals flex around estimated wrist pivot (0–65°) | Rigid-group radial / ulnar deviation (±20°) | Source carpals, metacarpals and forearm. NOT independent eight-carpal kinematics or individual digits. |
| Hip | Existing sourced femur/pelvis educational flexion (0–65°) | Femoral abduction/adduction (−25° to +30°) | Origin/insertion gradients remain inferred; no hip contact, acetabular constraints, tendon wrap or validated trajectories. |
| Knee | Existing source-bone lower-leg flexion (0–105°) | Tibial axial rotation (±10°) | Tibia, fibula, patella and selected licensed muscles. No patellofemoral tracking, meniscus, cruciate/collateral ligament constraint or screw-home coupling. |
| Ankle / Foot | Lower foot/tarsal dorsiflexion (0–30°) | Illustrative hindfoot inversion/eversion (±18°) | Real ankle/foot bone surfaces. No separate talocrural/subtalar mechanics, ligament coupling or accurate Achilles tendon path. |
| Sciatic Nerve | No motion control | None | The sciatic atlas is registered from another source. No evidence-backed continuous or dynamically stretched nerve pathway; **do not animate one**. |

**Muscle behavior**: source-derived mesh vertices are never authored or displaced in stored files. WebGL deformations interpolate fixed and moving bone transforms using *estimated* proximity weights; selected muscles remain static when their constraints are unsupported. Surface proximity is not anatomically measured muscle origin, insertion, or tendon excursion. All anatomical layers and IDs retain original FMA/provenance.

**Camera behavior**: one WebGL canvas and shared anatomical reference frame are preserved. Primary and secondary controls have independent, clamped state; the Neutral action resets both. Moving to a different site also zeroes the previous joint angles. Tap picking projects the same posed coordinates the renderer uses.

**Verification**: source/unit tests cover bounded angles, finite transform matrices, source identity and repeated zero-pose stability. Desktop Chromium, mobile Chromium and mobile WebKit tests exercise each moving site, reset, cross-region navigation, sciatic motion suppression, and full-body regression. Software tests do not constitute peer or clinical review.

## Approval required before public scientific claims

A qualified anatomical reviewer should verify right-side skeletal pivot positions, relationship of moving bone surfaces at travel extremes, actual osteokinematic movement axes, muscle origin/insertion attachments, patient-independent range descriptions, reference mesh labeling, and safe educational caveats. A medical/biomechanics validation signoff is **not** present and must not be simulated.
