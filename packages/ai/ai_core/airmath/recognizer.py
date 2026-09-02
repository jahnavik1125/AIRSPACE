import numpy as np
from typing import List, Dict, Any, Tuple

from ai_core.airwriting.preprocessing import preprocess_trajectory
from ai_core.airmath.templates import generate_math_templates
from ai_core.airwriting.recognizer import dtw_distance

class MathSymbolRecognizer:
  """
  Classifies hand-drawn mathematical symbols using Dynamic Time Warping (DTW)
  alignment against reference stroke templates.
  """
  def __init__(self, confidence_threshold: float = 0.20):
    self.templates = generate_math_templates()
    self.confidence_threshold = confidence_threshold

  def predict(self, raw_strokes: List[List[Dict[str, Any]]]) -> Tuple[str, float]:
    """
    Predicts mathematical symbol (0-9, x, y, +, -, =, etc.) for the input strokes.
    Returns: (symbol_string, confidence_score)
    """
    if not raw_strokes or len(raw_strokes) == 0:
      return "UNKNOWN", 0.0

    # 1. Preprocess test coordinates
    try:
      prep_test = preprocess_trajectory(raw_strokes)
    except Exception:
      return "UNKNOWN", 0.0

    best_symbol = "UNKNOWN"
    min_dist = float("inf")

    # 2. Warp alignment calculations
    for symbol, template_pts in self.templates.items():
      dist = dtw_distance(prep_test, template_pts)
      if dist < min_dist:
        min_dist = dist
        best_symbol = symbol

    # 3. Calculate exponential confidence score
    confidence = float(np.exp(-min_dist * 4.0))

    if confidence < self.confidence_threshold:
      return "UNKNOWN", 0.0

    return best_symbol, confidence
