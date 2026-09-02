# AIRSPACE Computer Vision Core (`cv_core`)

This package manages the real-time touchless human-computer interface tracking pipeline. It operates independently of the web frontend, allowing standard Python development, integration, and mock testing.

---

## 🏗️ Core Architecture & Pipeline

```
[Webcam Feed] 
      ↓ (OpenCV BGR Frame)
[HandDetector] (MediaPipe Hands Solutions)
      ↓ (Landmark & Score Datastructs)
[GestureClassifier] (Scale-Invariant Angle & Distance Rules)
      ↓ (Static Gestures e.g., PINCH, INDEX_POINT)
[GestureStateMachine] (Exponential Smoothing, Swipe History & State Debouncing)
      ↓ (Continuous Interaction States e.g., DRAG, HOVER + Triggered Events)
[Visualizer / Application websocket]
```

---

## 📄 Data Structures

We use strongly typed Pydantic models to encapsulate the output of each pipeline step:

1. **`Landmark`**: Normalized 3D point (`x`, `y`, `z` relative to camera dimensions).
2. **`Hand`**: Exposes hand side (`handedness`: "Left" or "Right"), confidence (`score`), and 21 standard hand keypoints (`landmarks`). Provides getters for fingertips (e.g., `index_tip`, `thumb_tip`).
3. **`DetectionResult`**: Framerate analysis output wrapping timestamp, active hands list, and processing execution speed metrics.
4. **`GestureStateUpdate`**: Encapsulates continuous tracker coordinates and actions:
   * `state`: Active state (`IDLE`, `HOVER`, `PINCH_START`, `PINCH_HOLD`, `PINCH_END`, `DRAG`).
   * `gesture`: Posture shape (`NONE`, `INDEX_POINT`, `PINCH`, `FIST`, `OPEN_PALM`, `TWO_FINGER`).
   * `cursor`: Smoothed 2D coordinates `(x, y)` representing the pointing finger.
   * `event`: Trigger boundary flag (`PINCH_START`, `PINCH_END`, `SWIPE_LEFT`, `SWIPE_RIGHT`, or `None`).

---

## 🧮 Gesture Algorithms

### Scale Invariance
To support different distances between the user's hand and the webcam, all spatial rules are normalized using `palm_size` (Euclidean distance between Wrist (0) and Middle MCP (9)).

### Static Postures
* **`FIST`**: Checked first. Triggered when all 5 finger extensions are False.
* **`PINCH`**: Checked when the Euclidean distance between Thumb Tip (4) and Index Tip (8) is less than `pinch_distance_threshold` (normalized by palm size).
* **`OPEN_PALM`**: Triggered when all 5 finger extensions are True.
* **`INDEX_POINT`**: Triggered when only the Index finger is extended while Middle, Ring, and Pinky are folded.
* **`TWO_FINGER`**: Triggered when both Index and Middle are extended while others are folded.

### Finger Extension Heuristic
For Index, Middle, Ring, and Pinky, extension is true if:
$$\frac{\text{Distance(Wrist, Tip)}}{\text{Distance(Wrist, PIP)}} > \text{finger\_extension\_ratio}$$
This ratio remains constant regardless of the hand's rotation, scaling, or orientation.

### Swipe Detection
* Tracks the index fingertip coordinates over a sliding historical window (up to `0.5` seconds).
* If the horizontal displacement exceeds `swipe_distance_threshold`, horizontal speed exceeds `swipe_velocity_threshold`, and the vertical travel is minimal, it triggers a `SWIPE_LEFT` or `SWIPE_RIGHT` event.
* Emits once and enters a cooldown period to avoid duplicate signals.

---

## 🚦 Gesture State Machine

Transition parameters protect client-side UI actions from coordinate jitter and accidental clicks:

```
          [ IDLE ] 
             │ Hand Detected
             ▼
          [ HOVER ] ◀────────────────────────┐
             │                               │
             │ Pinch Detected                │ Pinch Released /
             │ (for N debounce frames)       │ Hand Lost
             ▼                               │
      [ PINCH_START ] ──┐                    │
             │          │                    │
             │          │ (Next frame)       │
             ▼          │                    │
      [ PINCH_HOLD ] ◀──┘                    │
             │                               │
             │ Move distance                 │
             │ > drag_threshold              │
             ▼                               │
          [ DRAG ] ──────────────────────────┘
```

EMA Coordinate Smoothing:
$$\text{Smoothed}_t = \alpha \cdot \text{Current} + (1 - \alpha) \cdot \text{Smoothed}_{t-1}$$
*(Configurable via `smoothing_factor` $\alpha$.)*

---

## ⚙️ Configuration Thresholds

Tunable values are stored inside `GestureConfig`:
* `pinch_distance_threshold` = `0.20`
* `drag_threshold` = `0.04` (normalized coordinate distance)
* `smoothing_factor` = `0.35` (EMA alpha weight)
* `swipe_distance_threshold` = `0.15`
* `swipe_velocity_threshold` = `0.40`
* `swipe_cooldown_seconds` = `0.8`
* `debounce_frames` = `3`
* `finger_extension_ratio` = `1.05`

---

## 🧪 Unit Testing

All algorithms, edge cases, coordinate calculations, and state machine transitions are tested without requiring a physical camera. We generate mock landmark vectors mimicking hand motions:
```powershell
# Run the CV test suite
./scripts/test.ps1
```

---

## 💻 How to Run the Webcam Debug Demo

You can test the entire pipeline locally on your computer with a visual debug window:

```powershell
# Run standalone webcam visualizer
python packages/cv/demo_webcam.py
```
* **HUD Overlay**: Shows active state, static gesture, calculation latency (ms), and frame processing FPS.
* **Skeleton Color**: Green for Right hands, Blue for Left hands.
* **Glow Cursor**: Red crosshair for Hovering, Yellow ring for Clicking, Green circle for Dragging.
* Press the **`q`** key in the webcam video display to safely release the camera resources and close the application.
