import numpy as np
from typing import List, Dict, Any
from ai_core.airwriting.preprocessing import preprocess_trajectory

def generate_math_templates() -> Dict[str, List[Dict[str, Any]]]:
  """
  Programmatically compiles reference template trajectories for digits 0-9,
  variables x, y, and operations +, -, =, *, /, (, ), ., ^, \sqrt.
  """
  templates = {}
  
  def make_stroke(pts_list: List[List[float]]) -> List[Dict[str, Any]]:
    return [{"x": p[0], "y": p[1], "t": idx * 33} for idx, p in enumerate(pts_list)]

  # Digits 0-9
  for d in range(10):
    # Simple straight line for 1
    if d == 1:
      templates["1"] = preprocess_trajectory([
        make_stroke([[0.5, 0.2], [0.5, 0.8]])
      ])
    elif d == 0:
      theta = np.linspace(0, 2*np.pi, 25)
      pts = [[0.5 + 0.2*np.cos(t), 0.5 + 0.3*np.sin(t)] for t in theta]
      templates["0"] = preprocess_trajectory([make_stroke(pts)])
    elif d == 2:
      templates["2"] = preprocess_trajectory([
        make_stroke([[0.35, 0.3], [0.5, 0.2], [0.65, 0.3], [0.3, 0.8], [0.7, 0.8]])
      ])
    elif d == 3:
      templates["3"] = preprocess_trajectory([
        make_stroke([[0.3, 0.25], [0.6, 0.2], [0.35, 0.5], [0.6, 0.5], [0.3, 0.8]])
      ])
    elif d == 4:
      templates["4"] = preprocess_trajectory([
        make_stroke([[0.55, 0.8], [0.55, 0.2]]),
        make_stroke([[0.55, 0.2], [0.3, 0.6], [0.65, 0.6]])
      ])
    elif d == 5:
      templates["5"] = preprocess_trajectory([
        make_stroke([[0.6, 0.2], [0.35, 0.2], [0.35, 0.45], [0.6, 0.55], [0.35, 0.8]])
      ])
    elif d == 6:
      templates["6"] = preprocess_trajectory([
        make_stroke([[0.6, 0.2], [0.35, 0.5], [0.35, 0.8], [0.6, 0.8], [0.6, 0.5], [0.35, 0.5]])
      ])
    elif d == 7:
      templates["7"] = preprocess_trajectory([
        make_stroke([[0.3, 0.2], [0.65, 0.2], [0.45, 0.8]])
      ])
    elif d == 8:
      theta = np.linspace(0, 2*np.pi, 25)
      t8 = [[0.5 + 0.15*np.cos(t), 0.35 + 0.15*np.sin(t)] for t in theta]
      b8 = [[0.5 + 0.2*np.cos(t), 0.65 - 0.2*np.sin(t)] for t in theta]
      templates["8"] = preprocess_trajectory([make_stroke(t8), make_stroke(b8)])
    elif d == 9:
      templates["9"] = preprocess_trajectory([
        make_stroke([[0.6, 0.5], [0.35, 0.5], [0.35, 0.2], [0.6, 0.2], [0.6, 0.8]])
      ])

  # Variables x, y
  templates["x"] = preprocess_trajectory([
    make_stroke([[0.3, 0.3], [0.7, 0.7]]),
    make_stroke([[0.7, 0.3], [0.3, 0.7]])
  ])
  templates["y"] = preprocess_trajectory([
    make_stroke([[0.3, 0.2], [0.5, 0.5], [0.7, 0.2]]),
    make_stroke([[0.5, 0.5], [0.3, 0.8]])
  ])

  # Operators
  templates["+"] = preprocess_trajectory([
    make_stroke([[0.3, 0.5], [0.7, 0.5]]),
    make_stroke([[0.5, 0.3], [0.5, 0.7]])
  ])
  templates["-"] = preprocess_trajectory([
    make_stroke([[0.3, 0.5], [0.7, 0.5]])
  ])
  templates["="] = preprocess_trajectory([
    make_stroke([[0.3, 0.4], [0.7, 0.4]]),
    make_stroke([[0.3, 0.6], [0.7, 0.6]])
  ])
  templates["*"] = preprocess_trajectory([
    make_stroke([[0.3, 0.3], [0.7, 0.7]]),
    make_stroke([[0.7, 0.3], [0.3, 0.7]]),
    make_stroke([[0.3, 0.5], [0.7, 0.5]])
  ])
  templates["/"] = preprocess_trajectory([
    make_stroke([[0.7, 0.2], [0.3, 0.8]])
  ])
  
  # Parentheses & Dot
  theta_p1 = np.linspace(np.pi/2, 3*np.pi/2, 20)
  templates["("] = preprocess_trajectory([
    make_stroke([[0.6 + 0.15*np.cos(t), 0.5 + 0.3*np.sin(t)] for t in theta_p1])
  ])
  theta_p2 = np.linspace(-np.pi/2, np.pi/2, 20)
  templates[")"] = preprocess_trajectory([
    make_stroke([[0.4 + 0.15*np.cos(t), 0.5 + 0.3*np.sin(t)] for t in theta_p2])
  ])
  templates["."] = preprocess_trajectory([
    make_stroke([[0.5, 0.85], [0.5, 0.86]])
  ])
  
  # Caret & Square Root
  templates["^"] = preprocess_trajectory([
    make_stroke([[0.3, 0.7], [0.5, 0.3], [0.7, 0.7]])
  ])
  templates["\sqrt"] = preprocess_trajectory([
    make_stroke([[0.2, 0.5], [0.3, 0.8], [0.45, 0.2], [0.8, 0.2]])
  ])

  return templates
