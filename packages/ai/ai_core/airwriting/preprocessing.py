import numpy as np
from typing import List, Dict, Any

def filter_noise(points: List[Dict[str, Any]], min_dist: float = 0.001) -> List[Dict[str, Any]]:
  """
  Removes duplicate or consecutive points that are spatially too close.
  """
  if len(points) < 2:
    return points

  filtered = [points[0]]
  for p in points[1:]:
    last = filtered[-1]
    dx = p["x"] - last["x"]
    dy = p["y"] - last["y"]
    dist = np.sqrt(dx*dx + dy*dy)
    if dist >= min_dist:
      filtered.append(p)
  return filtered


def smooth_trajectory(points: List[Dict[str, Any]], alpha: float = 0.3) -> List[Dict[str, Any]]:
  """
  Applies an Exponential Moving Average (EMA) filter to smooth out hand tremors.
  """
  if len(points) < 2:
    return points

  smoothed = [points[0].copy()]
  for p in points[1:]:
    last = smoothed[-1]
    smoothed.append({
      "x": alpha * p["x"] + (1 - alpha) * last["x"],
      "y": alpha * p["y"] + (1 - alpha) * last["y"],
      "z": alpha * p.get("z", 0.0) + (1 - alpha) * last.get("z", 0.0),
      "t": p.get("t", p.get("timestamp", 0)),
      "stroke_id": p.get("stroke_id", 0)
    })
  return smoothed


def center_trajectory(points: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
  """
  Centers the trajectory by translating its centroid to the origin (0, 0).
  """
  if not points:
    return points

  xs = [p["x"] for p in points]
  ys = [p["y"] for p in points]

  centroid_x = np.mean(xs)
  centroid_y = np.mean(ys)

  centered = []
  for p in points:
    centered_p = p.copy()
    centered_p["x"] = p["x"] - centroid_x
    centered_p["y"] = p["y"] - centroid_y
    centered.append(centered_p)
  return centered


def scale_trajectory(points: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
  """
  Scales the trajectory so that the coordinates fit within a [-1.0, 1.0] bounding box,
  preserving the aspect ratio of the drawing.
  """
  if not points:
    return points

  xs = [p["x"] for p in points]
  ys = [p["y"] for p in points]

  min_x, max_x = min(xs), max(xs)
  min_y, max_y = min(ys), max(ys)

  width = max_x - min_x
  height = max_y - min_y
  max_dim = max(width, height)

  if max_dim < 1e-6:
    return points

  scale_factor = 2.0 / max_dim

  scaled = []
  for p in points:
    scaled_p = p.copy()
    # Centered and scaled coordinates
    scaled_p["x"] = p["x"] * scale_factor
    scaled_p["y"] = p["y"] * scale_factor
    if "z" in p:
      scaled_p["z"] = p["z"] * scale_factor
    scaled.append(scaled_p)
  return scaled


def resample_trajectory(points: List[Dict[str, Any]], target_len: int = 50) -> List[Dict[str, Any]]:
  """
  Interpolates trajectory points to return a fixed sequence length, removing writing speed variation.
  """
  if len(points) < 2:
    if not points:
      return [{"x": 0.0, "y": 0.0, "z": 0.0, "t": 0, "stroke_id": 0} for _ in range(target_len)]
    p = points[0]
    return [{
      "x": p["x"],
      "y": p["y"],
      "z": p.get("z", 0.0),
      "t": p.get("t", p.get("timestamp", 0)),
      "stroke_id": p.get("stroke_id", 0)
    } for _ in range(target_len)]

  coords = np.array([[p["x"], p["y"], p.get("z", 0.0)] for p in points])
  diffs = np.diff(coords, axis=0)
  dists = np.sqrt(np.sum(diffs * diffs, axis=1))
  cum_dist = np.insert(np.cumsum(dists), 0, 0.0)

  total_dist = cum_dist[-1]
  if total_dist < 1e-6:
    p = points[0]
    return [{
      "x": p["x"],
      "y": p["y"],
      "z": p.get("z", 0.0),
      "t": p.get("t", p.get("timestamp", 0)),
      "stroke_id": p.get("stroke_id", 0)
    } for _ in range(target_len)]

  # Resample distances uniformly
  target_dists = np.linspace(0, total_dist, target_len)
  
  new_x = np.interp(target_dists, cum_dist, coords[:, 0])
  new_y = np.interp(target_dists, cum_dist, coords[:, 1])
  new_z = np.interp(target_dists, cum_dist, coords[:, 2])

  timestamps = np.array([p.get("t", p.get("timestamp", 0)) for p in points])
  new_t = np.interp(target_dists, cum_dist, timestamps)

  stroke_ids = np.array([p.get("stroke_id", 0) for p in points])
  new_stroke_ids = np.interp(target_dists, cum_dist, stroke_ids).astype(int)

  resampled = []
  for i in range(target_len):
    resampled.append({
      "x": float(new_x[i]),
      "y": float(new_y[i]),
      "z": float(new_z[i]),
      "t": int(new_t[i]),
      "stroke_id": int(new_stroke_ids[i])
    })
  return resampled


def preprocess_trajectory(strokes: List[List[Dict[str, Any]]], target_len: int = 50) -> List[Dict[str, Any]]:
  """
  Complete preprocessing pipeline: flattens multi-stroke points, filters noise,
  centers, scales, and resamples to target length.
  """
  flat_points = []
  for stroke_idx, stroke in enumerate(strokes):
    for pt in stroke:
      pt_copy = pt.copy()
      pt_copy["stroke_id"] = stroke_idx
      flat_points.append(pt_copy)

  if not flat_points:
    return resample_trajectory([], target_len)

  filtered = filter_noise(flat_points)
  smoothed = smooth_trajectory(filtered)
  centered = center_trajectory(smoothed)
  scaled = scale_trajectory(centered)
  resampled = resample_trajectory(scaled, target_len)
  return resampled
