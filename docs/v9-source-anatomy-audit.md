# BODY / LIVE V9 — Verified source anatomy expansion

## Results from the pinned dataset

All geometry in this change is derived from **BodyParts3D 4.0** at pinned commit
`1c38bf35c254a891200d3cedecfd57abebe83d8d`, CC BY 4.0,
in the source frame `(XYZ_metres - [0, .9, 0]) * 5`.
The generator `scripts/build_v9_anatomy.py` records each original chunk hash,
source FMA identity and the SHA-256 of the generated JSON.
No mirroring, procedural tissue invention, patient-derived geometry or manual
vertex manipulation is permitted.

### Phase A — skeleton

- Existing overview: 78 original meshes + 59 additional meshes, corresponding
  to **135 conventionally counted bones** because the manubrium, sternal body and
  xiphoid are separate mesh surfaces for one adult sternum.
- Added all **56 phalanges**: 28 finger and 28 toe bones; 14 per hand and 14 per foot.
- Added **8 facial bones**: ethmoid, vomer, paired lacrimals, paired palatines,
  paired inferior nasal conchae. Two of these are categorized by the upstream
  model as sensory/respiratory, but still represent conventional facial bones.
- Current home specimen: **201 sourced bone meshes, corresponding to 199/206
  conventional bones**. The interactive skull/wrist/ankle scenes incorporate
  the pertinent source meshes; finger and toe groups inherit their existing
  *illustrative* distal hand/foot rigid transform, not individual digit motion.
- **Seven confirmed source blockers**: coccyx, both mallei, both incudes,
  both stapes. The pinned atlas provides no meshes under these names or equivalent
  recognizable skeletal concepts. Do not claim a complete 206-bone model.
  A new suitably licensed and verifiably registered skeletal source is required.

### Phase B — muscle inventory

- Previously represented: 149 selectively sourced muscle meshes.
- Added **237 nonduplicate source muscle meshes**, totaling **386 muscle
  meshes** in the home overview. Selection is by original BodyParts3D source
  concept identity, not guessed attachment or duplicative mirror geometry.
- Source groups among additions: 39 back, 12 core, 20 thigh,
  62 intrinsic hand/foot and nearby muscle surfaces, and
  104 additional source muscle surfaces.
- **Zero** newly sourced primary facial-expression or mastication meshes
  (e.g., masseter, temporalis, orbicularis, pterygoids), and the dataset
  does not include several otherwise prominent core groups. The source must
  be supplemented rather than inventing facial or abdominal anatomy.

### Phase C — verified reference surfaces versus mechanics

- Added **48 static source meshes** representing recorded connective
  surfaces and named costal cartilage. The dedicated Connective display mode
  allows examination without implying these are complete joint systems.
- Six source-backed anatomical association records link tendon/membrane
  surfaces to related skeletal or muscular structures:
  bilateral calcaneal tendons, forearm interosseous membranes, and leg
  interosseous membranes.
- These are anatomical **associations** only. They do **not** provide experimentally
  validated tendon insertion coordinates, tension, constraint dynamics, ligament
  forces or cartilage deformation.
- V8.2 illustrative joint rigs are preserved. There are **no new clinically
  validated joint motions** in V9; independent finger/toe articulation and
  soft-tissue biomechanics require review of the geometry and a suitable
  kinematic/mechanical data source.

### Reliability and release criteria

- SHA-verified pinned index, original binary chunks and emitted JSON manifests.
- FMA and normalized-ID deduplication against existing V8 models.
- Mesh topology, finite-coordinate and reference-frame checks.
- Separate source loading means a corrupt/unavailable V9 file leaves V8 available.
- GPU aggregation by tissue subgroup keeps the new home specimen's draw-call
  count bounded rather than creating hundreds of independent draws.
- Browser checks cover three tissue systems plus an opt-in Connective mode on
  mobile and desktop, source failure fallback, original navigation and neutral motion.
- Expert anatomical/biomechanical validation is **not complete**. No clinical
  use or claims of scientifically validated articulations should be made.

Detailed provenance:
`atlas/assets/v9-source-provenance.json`.
