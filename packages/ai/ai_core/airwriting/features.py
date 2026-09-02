import numpy as np
from typing import List, Dict, Any

def extract_features(points: List[Dict[str, Any]]) -> np.ndarray:
  """
  Extracts 8-dimensional spatial-dynamic features for each resampled point:
  [x, y, vx, vy, ax, ay, direction, curvature].
  Returns a numpy array of shape (N, 8).
  """
  N = len(points)
  features = np.zeros((N, 8))
  
  if N == 0:
    return features

  # 1. Store X and Y coordinates
  for i in range(N):
    features[i, 0] = points[i]["x"]
    features[i, 1] = points[i]["y"]

  # 2. Velocity (vx, vy)
  for i in range(1, N):
    dt = (points[i]["t"] - points[i - 1]["t"]) / 1000.0  # seconds
    if dt < 1e-5:
      dt = 0.033  # Default 30 FPS interval fallback
    features[i, 2] = (points[i]["x"] - points[i - 1]["x"]) / dt
    features[i, 3] = (points[i]["y"] - points[i - 1]["y"]) / dt
  
  if N > 1:
    features[0, 2] = features[1, 2]
    features[0, 3] = features[1, 3]

  # 3. Acceleration (ax, ay)
  for i in range(1, N):
    dt = (points[i]["t"] - points[i - 1]["t"]) / 1000.0
    if dt < 1e-5:
      dt = 0.033
    features[i, 4] = (features[i, 2] - features[i - 1, 2]) / dt
    features[i, 5] = (features[i, 3] - features[i - 1, 3]) / dt

  if N > 1:
    features[0, 4] = features[1, 4]
    features[0, 5] = features[1, 5]

  # 4. Movement Angle/Direction
  for i in range(N):
    vx = features[i, 2]
    vy = features[i, 3]
    features[i, 6] = np.arctan2(vy, vx)

  # 5. Trajectory Curvature
  for i in range(1, N):
    dx = points[i]["x"] - points[i - 1]["x"]
    dy = points[i]["y"] - points[i - 1]["y"]
    ds = np.sqrt(dx*dx + dy*dy)
    if ds < 1e-6:
      ds = 1e-3

    dtheta = features[i, 6] - features[i - 1, 6]
    # Keep normalized within [-pi, pi]
    dtheta = (dtheta + np.pi) % (2 * np.pi) - np.pi
    features[i, 7] = dtheta / ds

  if N > 1:
    features[0, 7] = features[1, 7]

  return features
