from typing import List, Dict, Any, Tuple
import numpy as np

from ai_core.airmath.recognizer import MathSymbolRecognizer

class MathExpressionParser:
  """
  Groups raw coordinate strokes into horizontal characters, evaluates Y baselines
  for superscripts, and builds parsed strings and LaTeX outputs.
  """
  def __init__(self, confidence_threshold: float = 0.20):
    self.recognizer = MathSymbolRecognizer(confidence_threshold)

  def _group_strokes(self, raw_strokes: List[List[Dict[str, Any]]], gap_threshold: float = 0.08) -> List[List[List[Dict[str, Any]]]]:
    """
    Groups strokes that are horizontally overlapping or separated by less than gap_threshold.
    """
    if not raw_strokes:
      return []

    # 1. Compute bounds for each stroke
    stroke_bounds = []
    for stroke in raw_strokes:
      xs = [p["x"] for p in stroke]
      ys = [p["y"] for p in stroke]
      stroke_bounds.append({
        "stroke": stroke,
        "min_x": min(xs),
        "max_x": max(xs),
        "min_y": min(ys),
        "max_y": max(ys),
        "center_x": sum(xs) / len(xs),
        "center_y": sum(ys) / len(ys),
        "height": max(ys) - min(ys)
      })

    # 2. Sort strokes by left-most X bound
    stroke_bounds.sort(key=lambda box: box["min_x"])

    # 3. Clustering loop
    groups = []
    current_group = [stroke_bounds[0]]

    for box in stroke_bounds[1:]:
      group_min_x = min(b["min_x"] for b in current_group)
      group_max_x = max(b["max_x"] for b in current_group)

      overlap = max(0.0, min(group_max_x, box["max_x"]) - max(group_min_x, box["min_x"]))
      gap = box["min_x"] - group_max_x

      if overlap > 0.0 or gap < gap_threshold:
        current_group.append(box)
      else:
        groups.append(current_group)
        current_group = [box]

    groups.append(current_group)
    
    # Return raw strokes list grouped together
    return [[b["stroke"] for b in group] for group in groups]

  def parse_expression(self, raw_strokes: List[List[Dict[str, Any]]]) -> Dict[str, Any]:
    """
    Parses raw strokes into algebraic expression strings and LaTeX representations.
    """
    grouped = self._group_strokes(raw_strokes)
    if not grouped:
      return {
        "expression": "",
        "latex": "",
        "confidence": 0.0,
        "is_ambiguous": False
      }

    candidates = []
    for group in grouped:
      symbol, confidence = self.recognizer.predict(group)
      
      # Determine bounding box of group
      all_xs = []
      all_ys = []
      for stroke in group:
        all_xs.extend([p["x"] for p in stroke])
        all_ys.extend([p["y"] for p in stroke])

      min_x, max_x = min(all_xs), max(all_xs)
      min_y, max_y = min(all_ys), max(all_ys)
      
      candidates.append({
        "symbol": symbol,
        "confidence": confidence,
        "min_x": min_x,
        "max_x": max_x,
        "min_y": min_y,
        "max_y": max_y,
        "center_x": sum(all_xs) / len(all_xs),
        "center_y": sum(all_ys) / len(all_ys),
        "height": max_y - min_y
      })

    # Sort characters from left to right along the X-axis
    candidates.sort(key=lambda c: c["center_x"])

    # Spatial parsing: check superscripts
    parsed_symbols = []
    avg_confidences = []

    for idx, c in enumerate(candidates):
      if c["symbol"] == "UNKNOWN":
        continue
      
      avg_confidences.append(c["confidence"])
      
      # Superscript check: check if center Y is significantly higher than previous character
      if idx > 0 and len(parsed_symbols) > 0:
        prev = candidates[idx - 1]
        # Y-axis points downwards, so smaller Y value means higher up on screen
        is_high = c["center_y"] < prev["center_y"] - 0.25 * prev["height"]
        if is_high and c["symbol"] in "0123456789xy":
          parsed_symbols.append("^")
          
      parsed_symbols.append(c["symbol"])

    if not parsed_symbols:
      return {
        "expression": "",
        "latex": "",
        "confidence": 0.0,
        "is_ambiguous": False
      }

    # Construct standard algebraic format
    expr_parts = []
    for i, sym in enumerate(parsed_symbols):
      # Insert implicit multiplication, e.g. 2x -> 2*x
      if idx > 0 and sym in "xy" and expr_parts and expr_parts[-1] in "0123456789":
        expr_parts.append("*")
      # Map variables
      expr_parts.append(sym)

    expression_str = "".join(expr_parts)

    # Build LaTeX string
    latex_parts = []
    skip_next = False
    for i, sym in enumerate(parsed_symbols):
      if skip_next:
        skip_next = False
        continue

      if sym == "^" and i + 1 < len(parsed_symbols):
        latex_parts.append(f"^{{{parsed_symbols[i + 1]}}}")
        skip_next = True
      elif sym == "*":
        latex_parts.append(" \\cdot ")
      elif sym == "\sqrt" and i + 1 < len(parsed_symbols):
        latex_parts.append(f"\\sqrt{{{parsed_symbols[i + 1]}}}")
        skip_next = True
      else:
        latex_parts.append(sym)

    latex_str = "".join(latex_parts)
    mean_confidence = float(np.mean(avg_confidences)) if avg_confidences else 0.0

    return {
      "expression": expression_str,
      "latex": latex_str,
      "confidence": mean_confidence,
      "is_ambiguous": mean_confidence < 0.60
    }
