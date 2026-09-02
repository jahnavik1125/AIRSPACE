import numpy as np
from typing import List, Dict, Any

def extract_calibration_features(landmarks: List[Dict[str, float]]) -> Dict[str, float]:
  """
  Extracts normalized distance, angles, and palm openness ratio features
  from a list of 21 hand joints landmarks coordinates.
  """
  if not landmarks or len(landmarks) < 21:
    return {
      "pinch_distance": 0.0,
      "finger_extension_ratio": 0.0,
      "palm_openness": 0.0
    }

  # 1. Helper to compute Euclidean distance
  def dist(p1, p2):
    return float(np.sqrt((p1["x"] - p2["x"])**2 + (p1["y"] - p2["y"])**2 + (p1["z"] - p2["z"])**2))

  # Index joints positions:
  # Wrist: 0, Thumb tip: 4, Index tip: 8, Middle tip: 12, Ring tip: 16, Pinky tip: 20
  # Index base: 5, Pinky base: 17
  w = landmarks[0]
  t_tip = landmarks[4]
  i_tip = landmarks[8]
  m_tip = landmarks[12]
  r_tip = landmarks[16]
  p_tip = landmarks[20]
  
  i_base = landmarks[5]
  p_base = landmarks[17]

  # 2. Extract features
  # Pinch distance between index and thumb tip
  pinch_dist = dist(t_tip, i_tip)

  # Palm width approximation
  palm_width = dist(i_base, p_base)
  if palm_width < 1e-5:
    palm_width = 1.0

  # Extension ratios (tip to wrist normalized by palm width)
  ext_index = dist(i_tip, w) / palm_width
  ext_middle = dist(m_tip, w) / palm_width
  ext_ring = dist(r_tip, w) / palm_width
  ext_pinky = dist(p_tip, w) / palm_width
  
  avg_extension_ratio = float((ext_index + ext_middle + ext_ring + ext_pinky) / 4.0)

  # Palm openness sum
  palm_open = float(dist(t_tip, w) + dist(i_tip, w) + dist(m_tip, w) + dist(r_tip, w) + dist(p_tip, w))

  return {
    "pinch_distance": pinch_dist,
    "finger_extension_ratio": avg_extension_ratio,
    "palm_openness": palm_open
  }
