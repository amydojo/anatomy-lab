# BODY / LIVE — X-RAY Experiment 001

Route: /experiments/xray/  
Branch: experiment/ar-xray-elbow, isolated from V14.  
Status: experimental. Requires a physical iPhone validation pass.

## Usage — V2
Serve over HTTPS and open /experiments/xray/. **Close-up / Tap** is the default: activate the rear camera, tap a textured edge near your elbow, then one near your wrist. Image-feature patch matching follows these manual visual anchors; it does not detect real bones or joints. Low contrast, rapid motion or camera viewpoint changes cause tracking to stop. Use Reset anchors and tap again. Close-up reveals only schematic forearm structures; an elbow angle is deliberately not reported. The user can also pause a frame even when tracking is lost, and set anchors on the frozen image while camera hardware is off.

Select **Full arm / Auto** to load MediaPipe Pose Landmarker. Keep the shoulder, elbow and wrist in frame. The engine must observe multiple plausible, consistent frames before acquiring an arm lock. Select left/right arm and anatomy layers. Pause releases the camera; Resume reopens it.

## Architecture
- xray-core.mjs: MediaPipe indices for shoulder/elbow/wrist, conservative full-arm plausibility and multi-frame stable-lock gates, EMA, tracking state, 2D angle, registered illustrative full-arm and elbow-to-wrist-only geometry.
- xray-tracker.mjs: grayscale patch matching near two user-tapped visual anchors with a reject-on-loss policy. **Not anatomical detection, optical-flow segmentation, or validated tracking.**
- xray.mjs: getUserMedia lifecycle, direct image-feature tracking in close-up and optional on-device MediaPipe Pose Landmarker (GPU then CPU) in full-arm mode. Persistent SVG interaction, layer inspection, tracking loss and camera release.
- index.html/xray.css: independent mobile-first instrument layout; does not load or modify the production atlas renderer.
- tests/xray-core.test.mjs and tests/xray.spec.mjs: math checks and **mocked** browser camera and inference checks.
- xray-experiment.yml: automated test workflow targeting mobile Chromium, WebKit, and desktop Chromium.

## Anatomy provenance and limitations
The production atlas contains BodyParts3D sourced elbow bones with CC BY 4.0 and external provenance records. This prototype **does not render or register those source meshes over a person**. It deliberately draws a labeled illustrative 2D rig to the estimated shoulder–elbow–wrist points. Biceps, brachialis, brachioradialis, triceps, bones, tendon and collateral ligament silhouettes are schematic, **not measured tissue**. Humerus, radius and ulna link to their corresponding Atlas entries; this does not validate the overlay's anatomical positioning.

In full-arm mode, the elbow angle is a 2D projected angle; it is not clinically measured joint ROM. In close-up mode, joint flexion is unavailable and the UI displays N/A. Image-plane pose fails under rotation, occlusion, low contrast, cropped joints, or foreshortening. The prototype cannot identify injuries, muscle size, actual tendons, pathology or medical findings.

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

## V2 implementation / known gaps
- The close-up matcher is an experimental grayscale patch matching baseline, not a learned elbow detector. It requires nearby texture or a visible edge and may lose lock on smooth skin, lighting change or arm rotation.
- Manual anchors only support the elbow-to-wrist image segment. No upper-arm muscle or joint-angle claims in close-up mode.
- P0 next improvement: camera test clips with **separately consented** material and real iPhone Safari validation for tapping behavior, image tracking, thermal/FPS, orientation and camera resume. No user screen recordings are committed as fixtures.
- Future: world-landmark depth, person segmentation and occlusion, accurate camera calibration, medically reviewed skinned 3D geometry. This prototype is not ready for a clinical interpretation or a production release.