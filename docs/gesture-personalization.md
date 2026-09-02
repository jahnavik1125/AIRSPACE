# Gesture Personalization & Adaptive Calibration

This document outlines the feature extraction methods, adaptive threshold statistics, and consistency algorithms powering the **Personalized Gesture Profile** system.

---

## 1. Feature Extraction Pipeline

For each calibration sample, we extract spatial feature matrices from the 21 coordinate joints:

### A. Normalized Pinch Distance
Distance between the thumb tip (Landmark 4) and index tip (Landmark 8) normalized by palm width ($W_{\text{palm}}$):
$$d_{\text{pinch}} = \frac{\sqrt{(x_4 - x_8)^2 + (y_4 - y_8)^2 + (z_4 - z_8)^2}}{W_{\text{palm}}}$$

### B. Palm Width Approximation
Distance between the index base (Landmark 5) and pinky base (Landmark 17):
$$W_{\text{palm}} = \sqrt{(x_5 - x_{17})^2 + (y_5 - y_{17})^2 + (z_5 - z_{17})^2}$$

### C. Finger Extension Ratios
Mean distance from finger tips (8, 12, 16, 20) to the wrist base (Landmark 0) divided by the palm width:
$$R_{\text{extension}} = \frac{1}{4} \sum_{i \in \{8, 12, 16, 20\}} \frac{d(i, 0)}{W_{\text{palm}}}$$

---

## 2. Adaptive Calibration Threshold Model

Rather than relying on static global triggers (which fail for users with different hand shapes), we compute adaptive ranges:
1. **Pinch Threshold**: Estimates the user's natural pinch distance. A pinch gesture triggers when the current distance is within:
   $$\text{Threshold}_{\text{pinch}} = \mu_{\text{pinch}} + 2 \times \sigma_{\text{pinch}}$$
2. **Consistency Score**: Evaluates user calibration stability by measuring the Coefficient of Variation (CV) across samples:
   $$\text{Consistency} = 1.0 - \frac{1}{M}\sum_{j=1}^M \frac{\sigma_j}{\mu_j}$$
   *(Values close to $1.0$ indicate high stability; values below $0.75$ trigger a "Collect more samples" warning).*

---

## 3. Profile Schema & Persistence

Adaptive statistics are saved in the `GestureProfile` table:

```json
{
  "gesture_name": "PINCH",
  "sample_count": 5,
  "mean_features": {
    "pinch_distance": 0.045,
    "finger_extension_ratio": 1.25,
    "palm_openness": 5.2
  },
  "var_features": {
    "pinch_distance": 0.0002,
    "finger_extension_ratio": 0.015,
    "palm_openness": 0.08
  },
  "personalized_threshold": 0.073,
  "updated_at": "2026-08-30T10:00:00Z"
}
```

---

## 4. Reset & Fallbacks

* **Global Default Fallbacks**: If no profile exists for the user session, the CV engine falls back to standard hardcoded triggers.
* **Profile Reset API (`DELETE /api/gestures/calibration`)**: Removes profiles and calibrations, restoring system defaults immediately.
