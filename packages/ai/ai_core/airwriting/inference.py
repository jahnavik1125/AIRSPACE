import os
import logging
from typing import List, Dict, Any, Tuple
from ai_core.airwriting.recognizer import HandwritingRecognizer, DTWRecognizer

try:
  import torch
  from ai_core.airwriting.models import AirWritingNet
  from ai_core.airwriting.preprocessing import preprocess_trajectory
  from ai_core.airwriting.features import extract_features
  from ai_core.airwriting.dataset import CLASSES
  TORCH_AVAILABLE = True
except ImportError:
  TORCH_AVAILABLE = False
  torch = None

logger = logging.getLogger("airspace-inference")

class NeuralRecognizer(HandwritingRecognizer):
  """
  Inference wrapper loading trained weights. Falls back automatically to
  DTW template matchers if custom weights do not exist yet.
  """
  def __init__(self, weights_path: str = "packages/ai/ai_core/airwriting/weights/airwriting_latest.pt", fallback_to_dtw: bool = True):
    self.weights_path = weights_path
    self.fallback_to_dtw = fallback_to_dtw
    self.dtw_recognizer = DTWRecognizer()
    self.model = None

    if TORCH_AVAILABLE and os.path.exists(weights_path):
      try:
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = AirWritingNet(num_classes=len(CLASSES)).to(self.device)
        self.model.load_state_dict(torch.load(weights_path, map_location=self.device))
        self.model.eval()
        logger.info(f"Custom PyTorch neural model loaded successfully from {weights_path}.")
      except Exception as e:
        logger.error(f"Failed to load PyTorch model weights: {e}")
        self.model = None

  def predict(self, trajectory: List[List[Dict[str, Any]]]) -> Tuple[str, float, List[Tuple[str, float]]]:
    """
    Classifies a trajectory using the neural network, falling back to DTW if necessary.
    """
    # 1. Fallback to DTW if PyTorch model is missing
    if self.model is None:
      if self.fallback_to_dtw:
        return self.dtw_recognizer.predict(trajectory)
      else:
        raise RuntimeError("Neural model weights not found and DTW fallback is disabled.")

    # 2. Execute PyTorch sequence forward pass
    try:
      preprocessed = preprocess_trajectory(trajectory, target_len=50)
      features = extract_features(preprocessed)  # shape (50, 8)
      
      # Convert features to float tensor and add batch dim: shape (1, 50, 8)
      input_tensor = torch.tensor(features, dtype=torch.float32).unsqueeze(0).to(self.device)
      
      with torch.no_grad():
        logits = self.model(input_tensor)
        probabilities = torch.softmax(logits, dim=1).squeeze(0).cpu().numpy()

      preds = [(CLASSES[i], float(probabilities[i])) for i in range(len(CLASSES))]
      preds.sort(key=lambda x: x[1], reverse=True)

      top_char, top_conf = preds[0]

      # Confidence threshold checks
      if top_conf < 0.20:
        return "UNKNOWN", top_conf, preds[:3]

      return top_char, top_conf, preds[:3]
    except Exception as e:
      logger.error(f"Neural inference runtime error: {e}")
      if self.fallback_to_dtw:
        return self.dtw_recognizer.predict(trajectory)
      raise e
