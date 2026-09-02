import numpy as np
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Tuple
from ai_core.airwriting.preprocessing import preprocess_trajectory
from ai_core.airwriting.templates import generate_default_templates

# ==============================================================================
# Abstract Recognizer Interface
# ==============================================================================

class HandwritingRecognizer(ABC):
  """
  Abstract class defining handwriting recognition prediction interfaces.
  """
  @abstractmethod
  def predict(
    self, 
    trajectory: List[List[Dict[str, Any]]]
  ) -> Tuple[str, float, List[Tuple[str, float]]]:
    """
    Receives raw hand trajectory strokes, performs predictions, and returns:
    (predicted_character, confidence, top_predictions_list)
    """
    pass


# ==============================================================================
# Baseline Recognizer (DTW Dynamic Time Warping)
# ==============================================================================

def dtw_distance(seq1: List[Dict[str, Any]], seq2: List[Dict[str, Any]]) -> float:
  """
  Calculates the normalized Dynamic Time Warping distance between two coordinate series.
  """
  N = len(seq1)
  M = len(seq2)
  
  if N == 0 or M == 0:
    return 999.0

  # 1. Calculate pairwise Euclidean distance squared matrix
  cost = np.zeros((N, M))
  for i in range(N):
    for j in range(M):
      dx = seq1[i]["x"] - seq2[j]["x"]
      dy = seq1[i]["y"] - seq2[j]["y"]
      # Use Euclidean distance squared
      cost[i, j] = dx*dx + dy*dy

  # 2. Dynamic programming matrix accumulation
  accum = np.zeros((N, M))
  accum[0, 0] = cost[0, 0]
  
  for i in range(1, N):
    accum[i, 0] = accum[i - 1, 0] + cost[i, 0]
  for j in range(1, M):
    accum[0, j] = accum[0, j - 1] + cost[0, j]

  for i in range(1, N):
    for j in range(1, M):
      accum[i, j] = cost[i, j] + min(
        accum[i - 1, j],       # Insertion
        accum[i, j - 1],       # Deletion
        accum[i - 1, j - 1]    # Match
      )

  # Normalize by path length
  return float(accum[-1, -1] / (N + M))


class DTWRecognizer(HandwritingRecognizer):
  """
  Baseline handwriting recognizer using Dynamic Time Warping (DTW) distance
  comparison against programmatic template letters.
  """
  def __init__(self, confidence_threshold: float = 0.20):
    self.templates = generate_default_templates()
    self.confidence_threshold = confidence_threshold

  def predict(
    self, 
    trajectory: List[List[Dict[str, Any]]]
  ) -> Tuple[str, float, List[Tuple[str, float]]]:
    """
    Runs DTW template-matching prediction on raw strokes trajectories.
    """
    if not trajectory or all(len(stroke) == 0 for stroke in trajectory):
      return "UNKNOWN", 0.0, [("UNKNOWN", 0.0)]

    # 1. Run coordinates preprocessing pipeline
    preprocessed = preprocess_trajectory(trajectory, target_len=50)

    # 2. Compare against all 36 template patterns
    predictions = []
    for char, template in self.templates.items():
      dist = dtw_distance(preprocessed, template)
      
      # Convert distance to exponential confidence: exp(-dist * scale)
      # Perfect match dist=0 -> confidence=1.0. Large distance -> drops to 0
      confidence = float(np.exp(-dist * 4.0))
      predictions.append((char, confidence))

    # 3. Sort predictions by confidence in descending order
    predictions.sort(key=lambda x: x[1], reverse=True)
    
    top_char, top_conf = predictions[0]

    # 4. Check confidence against threshold limits
    if top_conf < self.confidence_threshold:
      return "UNKNOWN", top_conf, predictions[:3]

    return top_char, top_conf, predictions[:3]
