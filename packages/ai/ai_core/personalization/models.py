import numpy as np
from typing import List, Dict, Any, Tuple

class PersonalizedGestureModel:
  """
  Statistical model calculating user gesture centroids, variances,
  adaptive boundaries thresholds, and calibration consistency ratings.
  """
  def __init__(self, target_samples: int = 5):
    self.target_samples = target_samples

  def compute_profile_statistics(
    self, samples_features: List[Dict[str, float]]
  ) -> Tuple[Dict[str, float], Dict[str, float], float, float]:
    """
    Computes features means, variances, adaptive thresholds, and consistency.
    Returns: (means, variances, personalized_threshold, consistency_score)
    """
    N = len(samples_features)
    if N == 0:
      return {}, {}, 0.0, 0.0

    # Group feature keys
    keys = ["pinch_distance", "finger_extension_ratio", "palm_openness"]
    means = {}
    variances = {}

    for key in keys:
      vals = [s.get(key, 0.0) for s in samples_features]
      means[key] = float(np.mean(vals))
      variances[key] = float(np.var(vals))

    # Calculate user-specific pinch threshold (mean + 2 * std)
    pinch_mean = means["pinch_distance"]
    pinch_std = float(np.sqrt(variances["pinch_distance"]))
    
    # Adaptive threshold fallback to global defaults if std is zero
    adaptive_pinch_threshold = float(pinch_mean + 2.0 * pinch_std) if pinch_std > 1e-6 else float(pinch_mean)

    # Consistency rating = 1.0 - mean coefficient of variation across features
    cv_list = []
    for key in keys:
      m = means[key]
      std = float(np.sqrt(variances[key]))
      if m > 1e-5:
        cv_list.append(std / m)
      else:
        cv_list.append(0.0)
        
    avg_cv = float(np.mean(cv_list))
    consistency = float(max(0.0, 1.0 - avg_cv))

    return means, variances, adaptive_pinch_threshold, consistency
