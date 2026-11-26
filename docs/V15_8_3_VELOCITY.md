# V15.8.3 VELOCITY — experimental startup optimization

Physical feedback: CONTINUUM initially laggy, smooth after loading. This supports prioritizing startup CPU and GPU submission, not a steady-state renderer redesign. It does not establish measured causation.

## Changes
- Separate same-origin classic Worker decodes validated source GLBs and packs the existing area-weighted normals. Transfers three ArrayBuffers rather than copying them.
- Two independent priority request lanes; no batch barrier behind a slow structure. Existing hash/count checks remain. Worker infrastructure failures fall back on the existing main-thread decoder on retry; explicit `velocity=legacy` disables worker and chunk uploads.
- GPU vertex/index data uploads in <=1 MiB submissions, staged until both buffers are complete. The initial allocation may still stall; chunk time is CPU submission only, not GPU completion. Prepared arrays are released after successful upload. Evicted buffers may still require synchronous repacking; offscreen prepared arrays may remain in RAM until drawn. No hard CPU/GPU memory guarantee.
- Stream-triggered rendering is coalesced per animation frame. Original controller logic, source topology, transforms, rendering materials and Denver boundary are unchanged.

## Measurements
The same 59 structures, 3,915,232 triangles and 70,516,044 GLB bytes are retained. No startup speedup is claimed until browser/physical evidence exists. Diagnostics record first decoded geometry, first draw submission, stream duration, per-asset fetch/decode/pack timing and worker/fallback mode, upload chunks, maximum chunk CPU submission time, staged buffer bytes and prepared CPU bytes. Existing frame-time percentiles and long-task support remain.

## Verification
Unit check compares actual C1 worker-produced coordinates, indices and packed normals to existing exact parser. Browser suite asserts all 59 assets use worker on normal path, chunk uploads occurred, packed arrays released at full overview, and controller input changes camera during a deliberately delayed skull request. Captures diagnostic JSON and screenshots. Existing region and failed geometry checks retained; full-draw assertion waits for upload completion.

## Release gates
CI, screenshot inspection, actual comparative frame pacing and physical iPhone/TV/controller acceptance remain required. `source=axis&velocity=legacy` is a same-version comparison with worker/chunk path disabled (request scheduling/coalescing changes remain). A true three-tier offline LOD hierarchy and independently quantified simplification error remain a separate next gate. No production release or cross-dataset fusion.
