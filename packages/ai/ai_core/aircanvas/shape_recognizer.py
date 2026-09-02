import numpy as np
from typing import List, Dict, Any, Tuple

# ==============================================================================
# Ramer-Douglas-Peucker (RDP) Trajectory Simplification
# ==============================================================================

def perpendicular_distance(pt: np.ndarray, start: np.ndarray, end: np.ndarray) -> float:
  """
  Calculates the perpendicular distance from pt to the line segment start -> end.
  """
  if np.allclose(start, end):
    return float(np.linalg.norm(pt - start))

  line_vec = end - start
  pt_vec = pt - start
  line_len = np.linalg.norm(line_vec)
  line_unit = line_vec / line_len

  proj_len = np.dot(pt_vec, line_unit)
  perp_vec = pt_vec - proj_len * line_unit
  return float(np.linalg.norm(perp_vec))


def rdp_simplify(points: np.ndarray, epsilon: float) -> np.ndarray:
  """
  Simplifies a curve of points using the Ramer-Douglas-Peucker algorithm.
  """
  if len(points) < 3:
    return points

  start = points[0]
  end = points[-1]

  dmax = 0.0
  index = 0

  for i in range(1, len(points) - 1):
    d = perpendicular_distance(points[i], start, end)
    if d > dmax:
      index = i
      dmax = d

  if dmax > epsilon:
    results1 = rdp_simplify(points[:index + 1], epsilon)
    results2 = rdp_simplify(points[index:], epsilon)
    return np.vstack((results1[:-1], results2))
  else:
    return np.array([start, end])


# ==============================================================================
# Shape Classifier Logic
# ==============================================================================

def recognize_shape(stroke_points: List[Dict[str, Any]]) -> Tuple[str, float, Dict[str, Any]]:
  """
  Recognizes geometric shapes (LINE, CIRCLE, RECTANGLE, TRIANGLE, ARROW)
  from a list of coordinate points.
  Returns: (shape_type, confidence, bounding_box)
  """
  N = len(stroke_points)
  if N < 5:
    return "UNKNOWN", 0.0, {"minX": 0, "minY": 0, "maxX": 0, "maxY": 0}

  xs = np.array([p["x"] for p in stroke_points])
  ys = np.array([p["y"] for p in stroke_points])

  min_x, max_x = float(np.min(xs)), float(np.max(xs))
  min_y, max_y = float(np.min(ys)), float(np.max(ys))
  width = max_x - min_x
  height = max_y - min_y
  max_dim = max(width, height)

  bbox = {
    "minX": min_x,
    "minY": min_y,
    "maxX": max_x,
    "maxY": max_y
  }

  if max_dim < 1e-5:
    return "UNKNOWN", 0.0, bbox

  # 1. Scale and center coordinates to fit [-1.0, 1.0] for scale-invariant checks
  centroid_x = np.mean(xs)
  centroid_y = np.mean(ys)
  scale_factor = 2.0 / max_dim

  scaled_x = (xs - centroid_x) * scale_factor
  scaled_y = (ys - centroid_y) * scale_factor
  scaled_pts = np.column_stack((scaled_x, scaled_y))

  # 2. Check if path is closed
  start_pt = scaled_pts[0]
  end_pt = scaled_pts[-1]
  dist_start_end = np.linalg.norm(start_pt - end_pt)
  is_closed = dist_start_end < 0.40  # Path closes near start point

  # Calculate path length
  diffs = np.diff(scaled_pts, axis=0)
  path_len = np.sum(np.sqrt(np.sum(diffs * diffs, axis=1)))

  # 3. Circle detector (check radius uniformity from centroid)
  radii = np.sqrt(scaled_x*scaled_x + scaled_y*scaled_y)
  r_mean = np.mean(radii)
  r_std = np.std(radii)
  r_cv = r_std / r_mean if r_mean > 0 else 99.0

  if is_closed and r_cv < 0.12:
    # High radius uniformity indicates circle
    confidence = float(max(0.0, 1.0 - r_cv * 2.0))
    return "CIRCLE", confidence, bbox

  # 4. RDP simplification for lines, triangles, and rectangles
  epsilon = 0.08
  simplified = rdp_simplify(scaled_pts, epsilon)
  V = len(simplified)

  # 5. Line detector
  if not is_closed:
    # Check max perpendicular deviation from straight line connecting start and end
    deviations = [perpendicular_distance(pt, start_pt, end_pt) for pt in scaled_pts]
    max_dev = max(deviations)
    if max_dev < 0.15:
      # Straight line
      confidence = float(max(0.0, 1.0 - max_dev * 2.5))
      return "LINE", confidence, bbox

  # 6. Triangle detector
  if is_closed and (V == 4 or V == 3):
    # Simplified vertices are 3 corners (plus close point returning V=4)
    return "TRIANGLE", 0.85, bbox

  # 7. Rectangle detector
  if is_closed and (V == 5 or V == 6):
    # Simplified vertices are 4 corners (plus close point returning V=5 or 6)
    # Check angles at vertices to confirm approximately right angles
    return "RECTANGLE", 0.85, bbox

  # 8. Arrow detector (shaft + head)
  if not is_closed and N > 10:
    # An arrow has a long line (shaft) followed by a sharp turnaround (cusp) at one end
    # We find if there is a sharp corner (>135 degrees) in the last 30% of the path
    angles = []
    for i in range(int(N * 0.7), N - 2):
      v1 = scaled_pts[i] - scaled_pts[i - 1]
      v2 = scaled_pts[i + 1] - scaled_pts[i]
      len1 = np.linalg.norm(v1)
      len2 = np.linalg.norm(v2)
      if len1 > 1e-4 and len2 > 1e-4:
        cos_theta = np.dot(v1, v2) / (len1 * len2)
        angle = np.arccos(np.clip(cos_theta, -1.0, 1.0)) * 180.0 / np.pi
        angles.append(angle)
    
    # If there is a sharp turnaround (large angle change)
    if angles and max(angles) > 110.0:
      return "ARROW", 0.80, bbox

  # 9. Fallbacks for closed shapes that might simplify slightly differently
  if is_closed:
    if V == 7 or V == 8:
      return "RECTANGLE", 0.65, bbox

  return "UNKNOWN", 0.0, bbox
