import pytest
import numpy as np
from ai_core.aircanvas.shape_recognizer import (
  perpendicular_distance,
  rdp_simplify,
  recognize_shape
)

def test_perpendicular_distance():
  # Point (0.5, 0.5) from line (0.0, 0.0) -> (1.0, 0.0)
  # The perpendicular distance should be 0.5 (distance along Y axis)
  pt = np.array([0.5, 0.5])
  start = np.array([0.0, 0.0])
  end = np.array([1.0, 0.0])
  
  d = perpendicular_distance(pt, start, end)
  assert np.allclose(d, 0.5)


def test_rdp_simplify():
  # Straight line with a slight deviation in the middle
  pts = np.array([
    [0.0, 0.0],
    [0.5, 0.01],
    [1.0, 0.0]
  ])
  # If epsilon is 0.05, the deviation 0.01 is smaller than 0.05,
  # so it should simplify to just start and end (2 vertices)
  simplified = rdp_simplify(pts, epsilon=0.05)
  assert len(simplified) == 2
  assert np.allclose(simplified[0], [0.0, 0.0])
  assert np.allclose(simplified[-1], [1.0, 0.0])


def test_recognize_shape_line():
  # Draw a straight line from (0.0, 0.0) to (1.0, 1.0)
  pts = [{"x": float(i)/10.0, "y": float(i)/10.0, "t": i * 33} for i in range(10)]
  shape, confidence, _ = recognize_shape(pts)
  assert shape == "LINE"
  assert confidence > 0.80


def test_recognize_shape_circle():
  # Draw a perfect circle of radius 0.2 centered at (0.5, 0.5)
  theta = np.linspace(0, 2*np.pi, 30)
  pts = [{"x": 0.5 + 0.2*np.cos(t), "y": 0.5 + 0.2*np.sin(t), "t": idx * 33} for idx, t in enumerate(theta)]
  shape, confidence, _ = recognize_shape(pts)
  assert shape == "CIRCLE"
  assert confidence > 0.80


def test_recognize_shape_rectangle():
  # Draw a closed rectangle with intermediate points
  pts = [
    {"x": 0.2, "y": 0.2}, {"x": 0.4, "y": 0.2}, {"x": 0.6, "y": 0.2},
    {"x": 0.6, "y": 0.5}, {"x": 0.6, "y": 0.8},
    {"x": 0.4, "y": 0.8}, {"x": 0.2, "y": 0.8},
    {"x": 0.2, "y": 0.5}, {"x": 0.2, "y": 0.2}
  ]
  shape, _, _ = recognize_shape(pts)
  assert shape == "RECTANGLE"


def test_recognize_shape_triangle():
  # Draw a closed triangle with intermediate points
  pts = [
    {"x": 0.5, "y": 0.2},
    {"x": 0.65, "y": 0.5},
    {"x": 0.8, "y": 0.8},
    {"x": 0.5, "y": 0.8},
    {"x": 0.2, "y": 0.8},
    {"x": 0.35, "y": 0.5},
    {"x": 0.5, "y": 0.2}
  ]
  shape, _, _ = recognize_shape(pts)
  assert shape == "TRIANGLE"


def test_recognize_shape_unknown():
  # Random noise
  pts = [
    {"x": 0.1, "y": 0.2},
    {"x": 0.9, "y": 0.1},
    {"x": 0.4, "y": 0.8},
    {"x": 0.8, "y": 0.3}
  ]
  shape, confidence, _ = recognize_shape(pts)
  assert shape == "UNKNOWN"
  assert confidence == 0.0
