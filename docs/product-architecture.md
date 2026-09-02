# AIRSPACE Product Architecture & Integration Design

This document details the Information Architecture, Design System styling guidelines, unified App Shell navigation, and session lifecycles driving the integrated **AIRSPACE Platform**.

---

## 1. Product Information Architecture

AIRSPACE organizes touchless computer vision workspaces, settings interfaces, and server stats under a singular navigation console:

```
AIRSPACE Root Route (/) [Futuristic Landing Page]
  └─► App Dashboard (/app) [Central Launch & Connection Feeds Cockpit]
        ├─► Air Write (/air-write) [Touchless Handwriting Recognizer]
        ├─► Air Canvas (/canvas) [Intelligent Vector Sketchpad]
        ├─► Math Mode (/math) [Formula Solver & Graphing Plotter]
        ├─► AI Lab (/ai-lab) [Context LLM Interaction Hub]
        ├─► Analytics (/analytics) [Overview Metrics Dashboard]
        └─► Settings (/settings) [Guided Calibration Studio & Privacy Purger]
```

---

## 2. Reusable App Shell Design System

To ensure styling uniformity, we avoid duplication by conforming to the following variables:
* **Backgrounds**: Obsidian Slate (`#0b0f19`) for secondary panel surfaces; Deep Space Black (`#05070c`) for view canvases.
* **Typography**: Monospace typography font styles for stats metrics; system-sans for headings and controls.
* **Badges**:
  * `Active/Connected/Online`: Emerald Green text and backgrounds (`bg-emerald-950/40 border-emerald-900/40 text-emerald-400`).
  * `Inactive/Disconnected/Offline`: Red warnings (`bg-red-950/40 border-red-900/40 text-red-400`).
* **Hover states**: Glow transformations and borders highlights (`hover:border-blue-700/60 transition`).

---

## 3. Sidebar Navigation & Layout Wrapper

The **`AppLayoutWrapper`** monitors Next.js routing parameters:
* **Root Casing (`/`)**: Excluded from App Shell wrappers, rendering raw landing pages directly.
* **Product Workspaces**: Automatically nests Sidebar navigators on the left side, allocating the remaining area to the active product route.
* **Toast Notification Feeds**: Spawns floating success/error panels in the bottom-right corner.

---

## 4. Connection & Session Lifecycles

1. **WebSocket Handshakes**: Triggered when any workspace loads, updating WebSocket state status.
2. **Camera Streams**: Initialized via browser MediaStream constraints, updating tracking statuses.
3. **Data Science Integrity**: The dashboard measures actual database event entries, showing FPS frame rates and gesture classifications. Purge commands trigger cascaded SQL deletes, instantly returning dashboard metrics to their default configurations.
