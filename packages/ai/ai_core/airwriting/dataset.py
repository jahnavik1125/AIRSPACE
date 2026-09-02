import os
import json
import logging
from typing import List, Dict, Any, Tuple

try:
  import torch
  from torch.utils.data import Dataset
  from ai_core.airwriting.preprocessing import preprocess_trajectory
  from ai_core.airwriting.features import extract_features
  TORCH_AVAILABLE = True
except ImportError:
  TORCH_AVAILABLE = False
  torch = None
  Dataset = object

logger = logging.getLogger("airspace-dataset")

# Standard character labeling classes mapping
CLASSES = [chr(c) for c in range(ord('A'), ord('Z') + 1)] + [str(i) for i in range(10)]
CHAR_TO_IDX = {char: idx for idx, char in enumerate(CLASSES)}

if TORCH_AVAILABLE and torch is not None:
  class AirWritingDataset(Dataset):
    """
    Parses collected raw spatial drawing JSON files, runs preprocessing pipelines,
    extracts derivative features, and yields input-target tensor pairs.
    """
    def __init__(self, data_dir: str = "datasets/air-writing/raw", target_len: int = 50):
      self.data_dir = data_dir
      self.target_len = target_len
      self.samples: List[Tuple[str, str]] = []  # List of (file_path, label)

      if not os.path.exists(data_dir):
        logger.warning(f"Data directory '{data_dir}' does not exist.")
        return

      # Scan data directory for JSON samples files
      for filename in os.listdir(data_dir):
        if filename.endswith(".json"):
          file_path = os.path.join(data_dir, filename)
          try:
            with open(file_path, "r") as f:
              data = json.load(f)
              label = data.get("label")
              if label in CHAR_TO_IDX:
                self.samples.append((file_path, label))
          except Exception as e:
            logger.error(f"Error parsing sample file {filename}: {e}")

      logger.info(f"Loaded {len(self.samples)} valid samples from {data_dir}.")

    def __len__(self) -> int:
      return len(self.samples)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, int]:
      file_path, label = self.samples[idx]
      
      with open(file_path, "r") as f:
        data = json.load(f)

      # 1. Parse strokes (list of list of point dicts)
      # Some saved formats might save points as flat lists. Ensure we structure as list of list
      raw_points = data.get("points", [])
      
      # Handle flat list fallback
      if raw_points and isinstance(raw_points[0], dict):
        strokes = [raw_points]
      else:
        strokes = raw_points

      # 2. Preprocess sequence coordinates
      preprocessed = preprocess_trajectory(strokes, target_len=self.target_len)
      
      # 3. Extract 8-dimensional feature vectors: shape (50, 8)
      features = extract_features(preprocessed)
      
      # Convert to float tensor
      x_tensor = torch.tensor(features, dtype=torch.float32)
      y_label = CHAR_TO_IDX[label]
      
      return x_tensor, y_label
else:
  class AirWritingDataset:
    def __init__(self, *args, **kwargs):
      logger.warning("AirWritingDataset class loaded but PyTorch is not available.")
