import pytest
from ai_core.personalization.features import extract_calibration_features
from ai_core.personalization.models import PersonalizedGestureModel

def test_extract_calibration_features():
  # Mock 21 hand landmarks coordinates
  # All points at origin except thumb tip (4) and index tip (8)
  mock_landmarks = [{"x": 0.0, "y": 0.0, "z": 0.0} for _ in range(21)]
  
  # Thumb tip (4) at (0.2, 0.0, 0.0)
  mock_landmarks[4] = {"x": 0.2, "y": 0.0, "z": 0.0}
  # Index tip (8) at (0.5, 0.0, 0.0)
  mock_landmarks[8] = {"x": 0.5, "y": 0.0, "z": 0.0}
  # Wrist (0) is at origin (0.0, 0.0, 0.0)
  # Index base (5) at (0.2, 0.1, 0.0)
  mock_landmarks[5] = {"x": 0.2, "y": 0.1, "z": 0.0}
  # Pinky base (17) at (0.4, 0.1, 0.0)
  mock_landmarks[17] = {"x": 0.4, "y": 0.1, "z": 0.0}

  features = extract_calibration_features(mock_landmarks)
  assert "pinch_distance" in features
  # Pinch distance between index (0.5) and thumb (0.2) is 0.3
  assert abs(features["pinch_distance"] - 0.3) < 1e-4
  assert "finger_extension_ratio" in features


def test_personalized_gesture_model():
  model = PersonalizedGestureModel()
  
  # Create list of mock features maps
  samples_features = [
    {"pinch_distance": 0.05, "finger_extension_ratio": 1.2, "palm_openness": 5.0},
    {"pinch_distance": 0.06, "finger_extension_ratio": 1.3, "palm_openness": 5.2},
    {"pinch_distance": 0.07, "finger_extension_ratio": 1.1, "palm_openness": 4.8}
  ]

  means, variances, threshold, consistency = model.compute_profile_statistics(samples_features)
  
  # Mean of pinch distances [0.05, 0.06, 0.07] is 0.06
  assert abs(means["pinch_distance"] - 0.06) < 1e-4
  # Variance is non-zero
  assert variances["pinch_distance"] > 0.0
  # Adaptive threshold should be greater than the mean (mean + 2 * std)
  assert threshold > 0.06
  assert consistency > 0.80 # Values are close, so consistency should be high
