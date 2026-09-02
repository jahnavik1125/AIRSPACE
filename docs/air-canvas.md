# AIR CANVAS: Intelligent Spatial Drawing Module

This document outlines the architecture, stroke representations, Ramer-Douglas-Peucker shape classifiers, and object transformation layers powering the **AIR CANVAS** workspace.

---

## 1. System Architecture

The drawing workspace follows the same spatial interaction pipeline as the core system:

```
WEBCAM 
  ↓ (2D frame frames)
MEDIA PIPE (WASM) 
  ↓ (21 joints landmarks coordinates)
GESTURE STATE MACHINE 
  ↓ (Pinch / Hover gestures classifications)
EMA CURSOR SMOOTHER 
  ↓ (Tremor-free spatial pointer coordinates)
AIR CANVAS ENGINE 
  ↓ (Vector stroke recording / select selection raycasts)
GEOMETRIC SHAPE RECOGNIZER
  ↓ (RDP simplification & conversions)
CANVAS OBJECTS REGISTRY
```

---

## 2. Stroke & Bounding Box Data Model

All drawn paths are stored as vector coordinates, preserving source details. The coordinates are scaled relative to the canvas aspect ratio and normalized between $0.0$ and $1.0$:

```typescript
interface CanvasObject {
  id: string;
  type: "STROKE" | "LINE" | "CIRCLE" | "RECTANGLE" | "TRIANGLE" | "ARROW";
  points: { x: number; y: number; t: number }[];
  position: { x: number; y: number }; // Offset position displacement
  boundingBox: { minX: number; minY: number; maxX: number; maxY: number };
  color: string;
  width: number;
  opacity: number;
}
```

---

## 3. Stroke Smoothing

To eliminate hand tremors during real-time drawing, we implement two layers of smoothing:
1. **Live Smoothing**: A client-side Exponential Moving Average (EMA) filter smoothing the current pointer tip:
   $$P_{\text{smooth}, t} = \beta \cdot P_{\text{raw}, t} + (1 - \beta) \cdot P_{\text{smooth}, t-1}$$
   *(Default client-side $\beta = 0.40$).*
2. **Completed Curves**: Spline curve rendering on completed strokes to ensure continuous drawing lines.

---

## 4. Geometric Shape Recognition

We run a purely geometric shape classifier in `shape_recognizer.py` rather than training heavy neural networks:

### Step A: Trajectory Simplification (Ramer-Douglas-Peucker)
Simplifies coordinate lines by removing collinear points within an epsilon distance threshold ($\epsilon = 0.08$ on normalized $[-1.0, 1.0]$ bounds). The simplified vertex count ($V$) categorizes shapes:
* $V = 2$ vertices $\rightarrow$ **LINE**
* $V = 4$ vertices (closed) $\rightarrow$ **TRIANGLE**
* $V = 5$ vertices (closed) $\rightarrow$ **RECTANGLE**

### Step B: Centroid Checks
* **CIRCLE**: If path is closed and distance of all points to centroid $(\bar{x}, \bar{y})$ is uniform (Coefficient of Variation $< 0.12$).
* **ARROW**: If path is open and features a sharp turnaround turnaround angle change ($> 110^\circ$) near the end segment representing an arrowhead tip.

---

## 5. Bounding Box Selection & Drag Translation

Selection uses the spatial pointer under `SELECT` mode:
* **Hover Intersection**: Raycasts the finger cursor against all objects' bounding boxes.
* **Selection Outline**: Renders a neon-blue dashed rectangle border around the selected object.
* **Drag displacement**: On `PINCH_HOLD + movement`, we shift the position coordinate displacement of the selected object:
  $$x_t = x_{\text{initial}} + (x_{\text{cursor}} - x_{\text{pinch\_start}})$$

---

## 6. Persistence & Vector Export

* **Database Persistence**: Canvas drawings are serialized to JSON vector arrays and stored in the PostgreSQL `drawings` table matching the session ID.
* **SVG Vector Export**: Serializes the `CanvasObject` list to XML vector markup:
  * STROKE $\rightarrow$ `<path d="..." stroke="..." fill="none" />`
  * CIRCLE $\rightarrow$ `<circle cx="..." cy="..." r="..." />`
  * RECTANGLE $\rightarrow$ `<rect x="..." y="..." width="..." height="..." />`
  Preserves vector geometry at infinite resolution.
