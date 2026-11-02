# BODY / LIVE — X-RAY Experiment 001

Route: /experiments/xray/  
Branch: experiment/ar-xray-elbow, isolated from V14.  
Status: experimental. Requires a physical iPhone validation pass.

## Usage
Serve the static repository over HTTPS. Open /experiments/xray/, tap Activate X-RAY and allow video. With the rear camera, include the subject's shoulder, elbow and wrist; you may need another person to hold the phone. Select the subject's left or right arm. Bend the elbow and tap a colored silhouette. Toggle muscle, bone or connective layers, opacity and manual alignment controls. Pause holds one image in tab memory and stops the camera; Resume requests a fresh camera stream.

## Architecture
- xray-core.mjs: MediaPipe indices for shoulder/elbow/wrist, per-landmark quality gates, EMA smoothing, tracking state, image-plane elbow angle, object-fit cover mapping, joint-anchored geometry.
- xray.mjs: browser getUserMedia lifecycle, on-device MediaPipe Pose Landmarker (GPU, then CPU fallback), SVG rendering and selection, source-linked bone inspector, tracking-loss UI.
- index.html/xray.css: independent mobile-first instrument layout; does not load or modify the production atlas renderer.
- tests/xray-core.test.mjs and tests/xray.spec.mjs: math checks and **mocked** browser camera and inference checks.
- xray-experiment.yml: automated test workflow targeting mobile Chromium, WebKit, and desktop Chromium.

## Anatomy provenance and limitations
The production atlas contains BodyParts3D sourced elbow bones with CC BY 4.0 and external provenance records. This prototype **does not render or register those source meshes over a person**. It deliberately draws a labeled illustrative 2D rig to the estimated shoulder–elbow–wrist points. Biceps, brachialis, brachioradialis, triceps, bones, tendon and collateral ligament silhouettes are schematic, **not measured tissue**. Humerus, radius and ulna link to their corresponding Atlas entries; this does not validate the overlay's anatomical positioning.

The elbow angle is a 2D projected angle; it is not clinically measured joint ROM. Image-plane pose fails under rotation, occlusion, low contrast, cropped joints, or foreshortening. The prototype cannot identify injuries, muscle size, actual tendons, pathology or medical findings.

## Camera privacy
Video only, never microphone. No video upload, recording, file storage, localStorage, screenshots or analytics are implemented by the experiment. Model inference runs in the browser. Third-party package, WASM and model resource requests may expose network metadata; MediaPipe documents use of task performance metrics and a privacy policy, so disclose those dependencies before public use. A user-initiated paused image is temporarily held only in canvas memory. Stop, navigation and page backgrounding terminate camera tracks and clear the paused frame.

## Performance and fallbacks
Detection uses requestAnimationFrame, bounds inference to approximately 29 iterations/second, reports measured inference FPS, and chooses GPU then CPU. This does not guarantee 30 FPS or a particular thermal profile. No made-up tracking is shown when the model fails. HTTPS and camera permission are required.

## Real-device acceptance — not yet verified
- iPhone Safari rear-camera permission and true environment camera selection
- Both arm landmark confidence and recovery in changing lighting
- Geometry translates and flexes with the live arm and does not persist on tracking loss
- Selection, layers, opacity, manual registration and pause/resume
- Portrait, rotation, page backgrounding and extended-session stability
- No production atlas regressions

## V2
Add world-landmark depth estimates, person segmentation for realistic occlusion, camera calibration and user-guided origin alignment; only then consider skinned BodyParts3D source meshes with medically reviewed joint constraints. Move inference off the UI thread where platform support allows and build a real-device Safari performance/accuracy matrix.