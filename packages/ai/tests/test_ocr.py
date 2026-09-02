import pytest
import numpy as np
from ai_core.airwriting.preprocessing import (
  filter_noise,
  smooth_trajectory,
  center_trajectory,
  scale_trajectory,
  resample_trajectory,
  preprocess_trajectory
)
from ai_core.airwriting.features import extract_features
from ai_core.airwriting.recognizer import dtw_distance, DTWRecognizer
from ai_core.airwriting.templates import generate_default_templates

def test_filter_noise():
  pts = [
    {"x": 0.1, "y": 0.1, "t": 100},
    {"x": 0.1, "y": 0.1, "t": 200},  # Duplicate
    {"x": 0.5, "y": 0.5, "t": 300}
  ]
  filtered = filter_noise(pts)
  assert len(filtered) == 2
  assert filtered[0]["x"] == 0.1
  assert filtered[1]["x"] == 0.5


def test_center_trajectory():
  pts = [
    {"x": 10.0, "y": 20.0},
    {"x": 20.0, "y": 40.0}
  ]
  centered = center_trajectory(pts)
  xs = [p["x"] for p in centered]
  ys = [p["y"] for p in centered]
  assert np.allclose(np.mean(xs), 0.0)
  assert np.allclose(np.mean(ys), 0.0)


def test_scale_trajectory():
  pts = [
    {"x": 0.0, "y": 0.0},
    {"x": 1.0, "y": 2.0} # width = 1.0, height = 2.0, max_dim = 2.0, scale = 1.0
  ]
  scaled = scale_trajectory(pts)
  # Scale factor is 2.0 / max_dim = 2.0 / 2.0 = 1.0
  assert scaled[0]["x"] == 0.0
  assert scaled[1]["x"] == 1.0
  assert scaled[1]["y"] == 2.0


def test_resample_trajectory():
  pts = [
    {"x": 0.0, "y": 0.0, "t": 0},
    {"x": 1.0, "y": 1.0, "t": 100}
  ]
  resampled = resample_trajectory(pts, target_len=50)
  assert len(resampled) == 50
  assert resampled[0]["x"] == 0.0
  assert resampled[-1]["x"] == 1.0


def test_preprocess_trajectory_multi_stroke():
  strokes = [
    [{"x": 0.0, "y": 0.0, "t": 0}, {"x": 0.1, "y": 0.1, "t": 50}],
    [{"x": 0.2, "y": 0.2, "t": 100}, {"x": 0.3, "y": 0.3, "t": 150}]
  ]
  preprocessed = preprocess_trajectory(strokes, target_len=50)
  assert len(preprocessed) == 50


def test_extract_features():
  pts = [{"x": float(i), "y": float(i*2), "t": i * 33} for i in range(50)]
  features = extract_features(pts)
  assert features.shape == (50, 8)


def test_dtw_distance():
  seq1 = [{"x": float(i)/50.0, "y": float(i)/50.0} for i in range(50)]
  seq2 = [{"x": float(i)/50.0, "y": float(i)/50.0} for i in range(50)]
  dist = dtw_distance(seq1, seq2)
  assert dist == 0.0


def test_dtw_recognizer_prediction():
  recognizer = DTWRecognizer(confidence_threshold=0.15)
  
  # Predict using raw strokes of letter 'A'
  raw_a = [
    [{"x": 0.3, "y": 0.8, "t": 0}, {"x": 0.5, "y": 0.2, "t": 33}, {"x": 0.7, "y": 0.8, "t": 66}],
    [{"x": 0.4, "y": 0.5, "t": 99}, {"x": 0.6, "y": 0.5, "t": 132}]
  ]
  
  char, confidence, top_preds = recognizer.predict(raw_a)
  assert char == "A"
  assert confidence > 0.90
  assert top_preds[0][0] == "A"


def test_dtw_recognizer_unknown_threshold():
  recognizer = DTWRecognizer(confidence_threshold=0.95)
  
  # Random line representing unrecognizable noise
  raw_noise = [
    [{"x": 0.0, "y": 0.0, "t": 0}, {"x": 0.9, "y": 0.9, "t": 33}]
  ]
  
  char, confidence, _ = recognizer.predict(raw_noise)
  assert char == "UNKNOWN"


def test_dtw_synthetic_and_perturbed_recognition():
  recognizer = DTWRecognizer(confidence_threshold=0.15)
  
  # A (perturbed)
  raw_a_perturbed = [
    [{"x": 0.31, "y": 0.79, "t": 0}, {"x": 0.49, "y": 0.22, "t": 30}, {"x": 0.68, "y": 0.81, "t": 60}],
    [{"x": 0.42, "y": 0.51, "t": 90}, {"x": 0.58, "y": 0.49, "t": 120}]
  ]
  char_a, conf_a, _ = recognizer.predict(raw_a_perturbed)
  assert char_a == "A"
  assert conf_a > 0.80

  # B (exact)
  raw_b = [
    [{"x": 0.3, "y": 0.2, "t": 0}, {"x": 0.3, "y": 0.8, "t": 33}],
    [{"x": 0.3, "y": 0.2, "t": 66}, {"x": 0.6, "y": 0.2, "t": 99}, {"x": 0.6, "y": 0.5, "t": 132}, {"x": 0.3, "y": 0.5, "t": 165}],
    [{"x": 0.3, "y": 0.5, "t": 198}, {"x": 0.6, "y": 0.5, "t": 231}, {"x": 0.6, "y": 0.8, "t": 264}, {"x": 0.3, "y": 0.8, "t": 297}]
  ]
  char_b, conf_b, _ = recognizer.predict(raw_b)
  assert char_b == "B"
  assert conf_b > 0.90

  # C (perturbed circle equation)
  theta_c = np.linspace(np.pi/4, 7*np.pi/4, 25)
  c_pts = [[0.51 + 0.19*np.cos(t), 0.49 + 0.29*np.sin(t)] for t in theta_c]
  raw_c = [[{"x": p[0], "y": p[1], "t": idx * 30} for idx, p in enumerate(c_pts)]]
  char_c, conf_c, _ = recognizer.predict(raw_c)
  assert char_c == "C"
  assert conf_c > 0.80

  # D (exact)
  raw_d = [
    [{"x": 0.3, "y": 0.2, "t": 0}, {"x": 0.3, "y": 0.8, "t": 33}],
    [{"x": 0.3, "y": 0.2, "t": 66}, {"x": 0.6, "y": 0.2, "t": 99}, {"x": 0.6, "y": 0.8, "t": 132}, {"x": 0.3, "y": 0.8, "t": 165}]
  ]
  char_d, _, _ = recognizer.predict(raw_d)
  assert char_d == "D"

  # E (exact)
  raw_e = [
    [{"x": 0.3, "y": 0.2, "t": 0}, {"x": 0.3, "y": 0.8, "t": 33}],
    [{"x": 0.3, "y": 0.2, "t": 66}, {"x": 0.6, "y": 0.2, "t": 99}],
    [{"x": 0.3, "y": 0.5, "t": 132}, {"x": 0.5, "y": 0.5, "t": 165}],
    [{"x": 0.3, "y": 0.8, "t": 198}, {"x": 0.6, "y": 0.8, "t": 231}]
  ]
  char_e, _, _ = recognizer.predict(raw_e)
  assert char_e == "E"

  # 0 (exact circle)
  theta_o = np.linspace(0, 2*np.pi, 30)
  o_pts = [[0.5 + 0.2*np.cos(t), 0.5 + 0.3*np.sin(t)] for t in theta_o]
  raw_0 = [[{"x": p[0], "y": p[1], "t": idx * 30} for idx, p in enumerate(o_pts)]]
  char_0, _, _ = recognizer.predict(raw_0)
  assert char_0 in ["0", "O"]

  # 1 (perturbed)
  raw_1 = [
    [{"x": 0.41, "y": 0.31, "t": 0}, {"x": 0.51, "y": 0.21, "t": 33}, {"x": 0.5, "y": 0.79, "t": 66}, {"x": 0.39, "y": 0.81, "t": 99}, {"x": 0.61, "y": 0.79, "t": 132}]
  ]
  char_1, _, _ = recognizer.predict(raw_1)
  assert char_1 == "1"

  # 2 (perturbed)
  raw_2 = [
    [{"x": 0.36, "y": 0.29, "t": 0}, {"x": 0.51, "y": 0.21, "t": 33}, {"x": 0.64, "y": 0.31, "t": 66}, {"x": 0.31, "y": 0.79, "t": 99}, {"x": 0.69, "y": 0.81, "t": 132}]
  ]
  char_2, _, _ = recognizer.predict(raw_2)
  assert char_2 == "2"
