import pytest
import numpy as np
from ai_core.airmath.parser import MathExpressionParser
from ai_core.airmath.math_engine import MathEngine

def test_math_strokes_clustering():
  parser = MathExpressionParser()
  # Define two strokes close horizontally (x: 0.1 to 0.15) representing multi-stroke '+'
  stroke1 = [{"x": 0.10, "y": 0.5, "t": 0}, {"x": 0.15, "y": 0.5, "t": 33}]
  stroke2 = [{"x": 0.12, "y": 0.4, "t": 66}, {"x": 0.12, "y": 0.6, "t": 99}]
  
  # Define a third stroke far horizontally (x: 0.4) representing '5'
  stroke3 = [{"x": 0.40, "y": 0.4, "t": 132}, {"x": 0.45, "y": 0.8, "t": 165}]

  grouped = parser._group_strokes([stroke1, stroke2, stroke3])
  # Should cluster stroke1 and stroke2 together, and stroke3 separately (total 2 groups)
  assert len(grouped) == 2
  assert len(grouped[0]) == 2 # stroke 1 & 2
  assert len(grouped[1]) == 1 # stroke 3


def test_superscript_spatial_parsing(monkeypatch):
  parser = MathExpressionParser()
  
  calls = []
  def mock_predict(strokes):
    if not calls:
      calls.append(1)
      return "x", 0.95
    return "2", 0.95
    
  monkeypatch.setattr(parser.recognizer, "predict", mock_predict)

  stroke_x = [{"x": 0.18, "y": 0.5, "t": 0}, {"x": 0.22, "y": 0.5, "t": 33}]
  stroke_2 = [{"x": 0.33, "y": 0.15, "t": 66}, {"x": 0.37, "y": 0.15, "t": 99}]

  parsed = parser.parse_expression([stroke_x, stroke_2])
  assert "^{2}" in parsed["latex"] or "^" in parsed["expression"]


def test_math_engine_solves():
  engine = MathEngine()

  # 1. Test linear equation (standard and natural notation)
  res_linear = engine.solve("2*x + 5 = 15")
  assert res_linear["status"] == "success"
  assert "5" in res_linear["result"]
  assert len(res_linear["steps"]) >= 3

  res_linear_natural = engine.solve("2x + 5 = 15")
  assert res_linear_natural["status"] == "success"
  assert "5" in res_linear_natural["result"]

  # 2. Test quadratic equation (standard and natural superscript notation)
  res_quad = engine.solve("x**2 + 4*x + 4 = 0")
  assert res_quad["status"] == "success"
  assert "-2" in res_quad["result"]

  res_quad_natural = engine.solve("x² + 4x + 4 = 0")
  assert res_quad_natural["status"] == "success"
  assert "-2" in res_quad_natural["result"]

  # 3. Test derivatives integration
  res_diff = engine.solve("diff x**2")
  assert res_diff["status"] == "success"
  assert "2*x" in res_diff["result"]

  # 4. Test factorization
  res_fact = engine.solve("x**2 - 9")
  assert res_fact["status"] == "success"
  assert "factored" in res_fact
