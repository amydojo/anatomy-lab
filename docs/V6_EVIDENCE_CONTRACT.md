# BODY / LIVE V6 — Evidence Lens Data Contract
**Proposed schema v0.1. This is an architecture specification, not a present-tense claim of implemented evidence validation.**

The visualization has *two separate sources of uncertainty*:
1. **Where a surface/path originates** (source mesh, composite transformation, derived path, illustration).
2. **What has been independently verified** (nothing yet, expert-reviewed for a defined scope, or flagged for revision).

Never encode anatomical validity in just a color, glTF material, confidence percentage, or licensed-source badge. Licensed source material is not automatically accurate for our new use, or patient-specific.

## Required per-structure record

```ts
type OriginKind =
  | 'sourced-surface'
  | 'registered-composite'
  | 'source-derived-estimate'
  | 'illustrative'
  | 'unavailable';

type ReviewKind =
  | 'unreviewed'
  | 'needs-revision'
  | 'expert-reviewed-for-scope';

type RelationKind =
  | 'same-reference-frame'
  | 'registered-cross-reference'
  | 'estimated-spatial-relation'
  | 'unsupported';

interface EvidenceRecord {
  structureId: string;                 // e.g. right.hip.femur
  regionId: string;                    // hip | knee | nerve | shoulder
  displayName: string;
  laterality: 'left'|'right'|'midline'|'not-applicable';
  originKind: OriginKind;
  reviewKind: ReviewKind;
  source: {
    dataset: string;                   // BodyParts3D, Z-Anatomy...
    release: string;                   // e.g. 4.0
    authorCredit: string;
    sourceUrl: string;                 // audited URL, not a user-supplied one
    assetId: string;                   // FMA ID / glTF node name as applicable
    contentSha256: string;             // immutable content hash, verified on import
    licenseId: string;                 // e.g. CC-BY-4.0 / CC-BY-SA-4.0
    licenseUrl: string;
    modifications: string[];           // import, decimation, registration, etc.
  } | null;
  transform: {
    referenceFrame: string;            // concrete frame ID
    matrix4x4: number[];               // 16 finite values
    method: string;                    // shared source transform / rigid ICP ...
    verifiedFor: string[];             // only claims whose tests support it
    errorMeasures: Array<{
      name: string; value: number; unit: string; evaluates: string;
    }>;
  } | null;
  sampledPath?: {method: string; measurement: 'not-directly-measured'};
  reviewer?: {
    reviewerId: string; credentials: string; reviewedCommit: string;
    reviewedAssetSha256: string; reviewedAt: string;
    scope: string[]; findings: string[]; decision: ReviewKind;
  };
  limitations: string[];
}

interface EvidenceRelation {
  id: string;
  fromStructureId: string; toStructureId: string;
  relationKind: RelationKind;
  continuityVerified: boolean;
  sourceEvidenceIds: string[];
  junctionGap?: {value: number; unit: string; basis: string};
  transitionUi: 'shared-camera' | 'context-change';
  userFacingExplanation: string;
}
```

### Illustrative entries grounded in existing V5 sources
The example values below summarize existing source identity and flags. They are *proposed manifest entries*, not canonical assembled source records; implementation must pull hashes/transforms directly from checked-in provenance JSON and validate them.

```json
{
  "structureId": "right.hip.femur",
  "regionId": "hip",
  "displayName": "Right femur",
  "laterality": "right",
  "originKind": "sourced-surface",
  "reviewKind": "unreviewed",
  "source": {
    "dataset": "BodyParts3D",
    "release": "4.0",
    "authorCredit": "Database Center for Life Science",
    "sourceUrl": "https://github.com/ashemag/human-atlas",
    "assetId": "FMA24474",
    "contentSha256": "RESOLVE_FROM_PINNED_MANIFEST",
    "licenseId": "CC-BY-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
    "modifications": ["mesh import", "uniform scene coordinate transform"]
  },
  "transform": {
    "referenceFrame": "bodyparts3d-4.0-source-frame",
    "matrix4x4": [],
    "method": "shared verified source-coordinate affine transform",
    "verifiedFor": ["corresponding femur vertex identity across hip/knee"],
    "errorMeasures": []
  },
  "limitations": ["medical/anatomical review not completed"]
}
```

The empty transform matrix above is an explicit **draft placeholder, NOT valid runtime data**. The manifest generation/validation must reject empty matrices and any placeholder source SHA.

Another example relation:
```json
{
  "id": "right.sciatic.to.right.knee.reference",
  "fromStructureId": "right.nerve.sciatic",
  "toStructureId": "right.knee.skeleton",
  "relationKind": "registered-cross-reference",
  "continuityVerified": false,
  "sourceEvidenceIds": [
    "bodyparts3d-4.0-hip-knee-femur-bridge",
    "z-anatomy-femur-icp-registration"
  ],
  "transitionUi": "context-change",
  "userFacingExplanation": "Continuing in knee reference anatomy; the nerve has not been reconstructed continuously across this transition."
}
```

## Source model interpretation
- **BodyParts3D 4.0 Hip/Knee:** Shared source release; `assets/hip-knee-bridge.js` checks 480 corresponding femur vertices within source-rounding precision. It proves a **source-frame mapping**, not correct biomechanics or nerve position.
- **Z-Anatomy right sciatic/tibial/common fibular:** Real source-derived **atlas** triangles, CC BY-SA 4.0 isolated derivative; cross-reference registration with BodyParts3D 4.0 via femur ICP, **not verified same donor**. Source surfaces are visually solid, but marked as `registered-composite` in the combined Hip view.
- **Nerve line within a sourced mesh:** V5.5 arc-length path from surface sample points, not observed imaging centreline. Its origin is `source-derived-estimate`.
- **Branch transition:** named parent/child relationship with quantified sampled endpoint gap. It must not be promoted to continuous anatomical geometry because a graph edge exists.
- **Shoulder and legacy SVG views:** source and validity type must be identified separately; no 'source-verified' badge simply because the shapes are interactive.

## Renderer-to-evidence API
```ts
interface EvidenceLens {
  getByStructure(structureId: string): EvidenceRecord | null;
  getRelation(from: string, to: string): EvidenceRelation | null;
  setMode(mode: 'clean' | 'evidence'): void;
  describeSelection(structureId: string): string; // screen-reader friendly
  canPresentSharedCamera(from: string, to: string): boolean;
  canStateClaim(claim: string, structureIds: string[]): boolean;
}
```

The renderer **must not override** evidence categories. Unreviewed or composite model identity must remain visible in the inspector even in `clean` mode. Evidence mode adds granular labels and spatial overlays; clean mode removes secondary ornamentation, not scientific disclaimers.

Design treatments must remain comprehensible without color vision:
- `sourced-surface`: solid bounded surface, text label **Source geometry**.
- `registered-composite`: solid surface + alignment seam/registered marker, label **Registered composite** and plain-language frame caveat.
- `source-derived-estimate`: thin dashed/segmented line, label **Estimated path from surface samples**.
- `illustrative`: lighter wire/flat line, label **Illustration**.
- `unavailable`: no fabricated source mesh, label **Data unavailable** and a safe navigation fallback.

## The reviewer record is a gate, not decoration
An expert review must identify reviewer credentials, **exact commit and source hash**, laterality, anatomical structures and relationships inspected, study/reference material, limitations, unresolved findings, and the precise statement being approved. Reviewer availability and clinical intended use are external decisions. There is no universal `isMedicalGrade` boolean.

On any hash mismatch, undeclared model ID, missing licensing, stale review SHA, inconsistent frame or unsupported relation, **fail closed**: omit the derived anatomical claim, show the structure's last safe rendering or no mesh, and surface a text explanation.

## Automated checks before any data-heavy release
1. Schema parser rejects missing SHA/license/frame/review status and infinite/non-rigid matrices.
2. Signed verified source files map to declared metadata, and per-asset geometry hashes match imported objects.
3. The Hip→Knee corresponding 480 femur vertices still align after any exporter/LOD change, with a separate tolerance for LOD vs canonical meshes.
4. Nerve branch gaps remain detectable and correctly represented as discontinuities.
5. Visual screenshot regression includes clean/evidence views on 320, 390, 430px; screen-reader text contains identical uncertainty classifications.
6. Changing user controls, selecting structures and cinematic transitions cannot silently flip `unreviewed` into `expert-reviewed-for-scope`.
7. All derived asset attributions and share-alike notices remain accessible and exportable independent of the web app bundle.

**Out of scope:** diagnosis, nerve compression detection, clinical interpretation of symptoms, patient MRI ingestion or claims of model precision beyond measured evidence.
