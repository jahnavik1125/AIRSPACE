# AIRSPACE Analytics: Metrics & Session Aggregations

This document describes the data sources, database query strategies, performance measurements, and user-privacy commands driving the **Analytics Dashboard**.

---

## 1. Data Sources & Privacy Boundaries

To monitor platform performance without storing personal identifiers:
1. **Sessions Table** (`SessionModel`): Stores WebSocket cycle duration logs, status, and UUIDs.
2. **Gesture Events Table** (`GestureEvent`): Records spatial actions (clicks, drags, swipes), confidence ratings, and coordinates.
3. **Analytics Events Table** (`AnalyticsEvent`): Tracks framerate (FPS) and tracking processing latency records.
4. **Drawing & Math Sessions**: Counts element counts and solve logs.

We store derived coordinates and event tallies. Webcam video frames are never processed or persisted in any database.

---

## 2. Dynamic DB Aggregation Queries

Rather than loading large event sequences in Next.js, calculations occur server-side using SQLAlchemy query metrics:
* **Gesture Distribution**: Aggregated using grouping clauses:
  ```python
  db.query(GestureEvent.gesture, func.count(GestureEvent.id)).group_by(GestureEvent.gesture).all()
  ```
* **Performance Metrics**: Averages FPS and latency from the JSON metadata columns of process logs.

---

## 3. Important Metric Boundaries: Correction Ratios vs. Accuracy

To preserve scientific boundaries, we distinguish:

### A. Confidence
A probability score calculated by classifiers (e.g. template distance matching) estimating how closely a gesture matches baseline reference anchors.

### B. Correction Rate
Calculated for handwriting inputs by checking how often a user edits character predictions:
$$\text{Correction Rate} = \frac{\text{Corrected Sessions}}{\text{Total OCR Sessions}}$$

### C. Accuracy (Ground-Truth)
Computed only for sessions containing confirmed labels:
$$\text{Accuracy} = \frac{\text{Predicted Character} == \text{Confirmed Label}}{\text{Total Confirmed Sessions}}$$

---

## 4. Privacy Controls & Purge Commands

Users can purge all interaction history at any time:
* **Purge API (`DELETE /api/analytics/purge`)**: Executes a cascaded table wipe across session tables. Falls back to default state parameters instantly.
