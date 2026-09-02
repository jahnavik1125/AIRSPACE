from typing import Any, Dict, List
from ai_core.airwriting.inference import NeuralRecognizer

class HandwritingRecognizer:
  """
  Recognizes hand-drawn letters and words from spatial canvas strokes.
  Delegates execution to the new neural recognizer interface.
  """
  def __init__(self, model_path: str | None = None):
    # Initializes neural recognizer (which falls back automatically to DTW)
    self.recognizer = NeuralRecognizer()

  def load_model(self) -> bool:
    """
    Loads pre-trained or custom handwriting recognition models.
    """
    return True

  def recognize_strokes(
    self, strokes: List[List[Dict[str, Any]]]
  ) -> Dict[str, Any]:
    """
    Analyzes lists of lines, each line containing coordinates: [{x, y, timestamp}, ...]
    Returns:
        Dict[str, Any]: Recognized character and confidence rating.
    """
    if not strokes or all(len(stroke) == 0 for stroke in strokes):
      return {
        "text": "",
        "confidence": 0.0,
        "top_predictions": [],
        "error": "No strokes provided"
      }

    try:
      # Map float keys and formats to standard dict structures
      mapped_strokes = []
      for stroke in strokes:
        mapped_stroke = []
        for pt in stroke:
          mapped_stroke.append({
            "x": float(pt.get("x", 0.0)),
            "y": float(pt.get("y", 0.0)),
            "z": float(pt.get("z", 0.0)),
            "t": int(pt.get("t", pt.get("timestamp", 0)))
          })
        mapped_strokes.append(mapped_stroke)

      char, conf, top_preds = self.recognizer.predict(mapped_strokes)
      
      return {
        "text": char,
        "confidence": conf,
        "top_predictions": top_preds
      }
    except Exception as e:
      return {
        "text": "UNKNOWN",
        "confidence": 0.0,
        "error": str(e)
      }
