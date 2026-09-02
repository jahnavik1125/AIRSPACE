import numpy as np
from typing import List, Dict, Any
from ai_core.airwriting.preprocessing import preprocess_trajectory

def generate_default_templates() -> Dict[str, List[Dict[str, Any]]]:
  """
  Programmatically compiles reference template trajectories for characters A-Z and 0-9.
  Every templates undergoes preprocessing to standardize coordinates.
  """
  templates = {}
  
  def make_stroke(pts_list: List[List[float]]) -> List[Dict[str, Any]]:
    return [{"x": p[0], "y": p[1], "t": idx * 33} for idx, p in enumerate(pts_list)]

  # A
  templates["A"] = preprocess_trajectory([
    make_stroke([[0.3, 0.8], [0.5, 0.2], [0.7, 0.8]]),
    make_stroke([[0.4, 0.5], [0.6, 0.5]])
  ])
  
  # B
  templates["B"] = preprocess_trajectory([
    make_stroke([[0.3, 0.2], [0.3, 0.8]]),
    make_stroke([[0.3, 0.2], [0.6, 0.2], [0.6, 0.5], [0.3, 0.5]]),
    make_stroke([[0.3, 0.5], [0.6, 0.5], [0.6, 0.8], [0.3, 0.8]])
  ])
  
  # C
  theta_c = np.linspace(np.pi/4, 7*np.pi/4, 25)
  c_pts = [[0.5 + 0.2*np.cos(t), 0.5 + 0.3*np.sin(t)] for t in theta_c]
  templates["C"] = preprocess_trajectory([make_stroke(c_pts)])
  
  # D
  templates["D"] = preprocess_trajectory([
    make_stroke([[0.3, 0.2], [0.3, 0.8]]),
    make_stroke([[0.3, 0.2], [0.6, 0.2], [0.6, 0.8], [0.3, 0.8]])
  ])
  
  # E
  templates["E"] = preprocess_trajectory([
    make_stroke([[0.3, 0.2], [0.3, 0.8]]),
    make_stroke([[0.3, 0.2], [0.6, 0.2]]),
    make_stroke([[0.3, 0.5], [0.5, 0.5]]),
    make_stroke([[0.3, 0.8], [0.6, 0.8]])
  ])
  
  # F
  templates["F"] = preprocess_trajectory([
    make_stroke([[0.3, 0.2], [0.3, 0.8]]),
    make_stroke([[0.3, 0.2], [0.6, 0.2]]),
    make_stroke([[0.3, 0.5], [0.5, 0.5]])
  ])
  
  # G
  theta_g = np.linspace(np.pi/4, 7*np.pi/4, 25)
  g_pts = [[0.5 + 0.2*np.cos(t), 0.5 + 0.3*np.sin(t)] for t in theta_g]
  templates["G"] = preprocess_trajectory([
    make_stroke(g_pts),
    make_stroke([[0.5, 0.5], [0.6, 0.5], [0.6, 0.8]])
  ])
  
  # H
  templates["H"] = preprocess_trajectory([
    make_stroke([[0.3, 0.2], [0.3, 0.8]]),
    make_stroke([[0.7, 0.2], [0.7, 0.8]]),
    make_stroke([[0.3, 0.5], [0.7, 0.5]])
  ])
  
  # I
  templates["I"] = preprocess_trajectory([
    make_stroke([[0.5, 0.2], [0.5, 0.8]])
  ])
  
  # J
  templates["J"] = preprocess_trajectory([
    make_stroke([[0.6, 0.2], [0.6, 0.7], [0.5, 0.8], [0.4, 0.7]])
  ])
  
  # K
  templates["K"] = preprocess_trajectory([
    make_stroke([[0.3, 0.2], [0.3, 0.8]]),
    make_stroke([[0.6, 0.2], [0.3, 0.5], [0.6, 0.8]])
  ])
  
  # L
  templates["L"] = preprocess_trajectory([
    make_stroke([[0.3, 0.2], [0.3, 0.8], [0.6, 0.8]])
  ])
  
  # M
  templates["M"] = preprocess_trajectory([
    make_stroke([[0.3, 0.8], [0.3, 0.2], [0.5, 0.5], [0.7, 0.2], [0.7, 0.8]])
  ])
  
  # N
  templates["N"] = preprocess_trajectory([
    make_stroke([[0.3, 0.8], [0.3, 0.2], [0.7, 0.8], [0.7, 0.2]])
  ])
  
  # O
  theta_o = np.linspace(0, 2*np.pi, 30)
  o_pts = [[0.5 + 0.2*np.cos(t), 0.5 + 0.3*np.sin(t)] for t in theta_o]
  templates["O"] = preprocess_trajectory([make_stroke(o_pts)])
  
  # P
  templates["P"] = preprocess_trajectory([
    make_stroke([[0.3, 0.2], [0.3, 0.8]]),
    make_stroke([[0.3, 0.2], [0.6, 0.2], [0.6, 0.5], [0.3, 0.5]])
  ])
  
  # Q
  templates["Q"] = preprocess_trajectory([
    make_stroke(o_pts),
    make_stroke([[0.55, 0.65], [0.75, 0.85]])
  ])
  
  # R
  templates["R"] = preprocess_trajectory([
    make_stroke([[0.3, 0.2], [0.3, 0.8]]),
    make_stroke([[0.3, 0.2], [0.6, 0.2], [0.6, 0.5], [0.3, 0.5]]),
    make_stroke([[0.3, 0.5], [0.6, 0.8]])
  ])
  
  # S
  templates["S"] = preprocess_trajectory([
    make_stroke([[0.6, 0.3], [0.45, 0.25], [0.35, 0.35], [0.5, 0.5], [0.6, 0.65], [0.5, 0.75], [0.35, 0.7]])
  ])
  
  # T
  templates["T"] = preprocess_trajectory([
    make_stroke([[0.3, 0.2], [0.7, 0.2]]),
    make_stroke([[0.5, 0.2], [0.5, 0.8]])
  ])
  
  # U
  templates["U"] = preprocess_trajectory([
    make_stroke([[0.3, 0.2], [0.3, 0.7], [0.5, 0.8], [0.7, 0.7], [0.7, 0.2]])
  ])
  
  # V
  templates["V"] = preprocess_trajectory([
    make_stroke([[0.3, 0.2], [0.5, 0.8], [0.7, 0.2]])
  ])
  
  # W
  templates["W"] = preprocess_trajectory([
    make_stroke([[0.3, 0.2], [0.4, 0.8], [0.5, 0.5], [0.6, 0.8], [0.7, 0.2]])
  ])
  
  # X
  templates["X"] = preprocess_trajectory([
    make_stroke([[0.3, 0.2], [0.7, 0.8]]),
    make_stroke([[0.7, 0.2], [0.3, 0.8]])
  ])
  
  # Y
  templates["Y"] = preprocess_trajectory([
    make_stroke([[0.3, 0.2], [0.5, 0.5], [0.7, 0.2]]),
    make_stroke([[0.5, 0.5], [0.5, 0.8]])
  ])
  
  # Z
  templates["Z"] = preprocess_trajectory([
    make_stroke([[0.3, 0.2], [0.7, 0.2], [0.3, 0.8], [0.7, 0.8]])
  ])
  
  # 0
  templates["0"] = templates["O"]
  
  # 1
  templates["1"] = preprocess_trajectory([
    make_stroke([[0.4, 0.3], [0.5, 0.2], [0.5, 0.8], [0.4, 0.8], [0.6, 0.8]])
  ])
  
  # 2
  templates["2"] = preprocess_trajectory([
    make_stroke([[0.35, 0.3], [0.5, 0.2], [0.65, 0.3], [0.3, 0.8], [0.7, 0.8]])
  ])
  
  # 3
  templates["3"] = preprocess_trajectory([
    make_stroke([[0.3, 0.25], [0.6, 0.2], [0.35, 0.5], [0.6, 0.5], [0.3, 0.8]])
  ])
  
  # 4
  templates["4"] = preprocess_trajectory([
    make_stroke([[0.55, 0.8], [0.55, 0.2]]),
    make_stroke([[0.55, 0.2], [0.3, 0.6], [0.65, 0.6]])
  ])
  
  # 5
  templates["5"] = preprocess_trajectory([
    make_stroke([[0.6, 0.2], [0.35, 0.2], [0.35, 0.45], [0.6, 0.55], [0.35, 0.8]])
  ])
  
  # 6
  templates["6"] = preprocess_trajectory([
    make_stroke([[0.6, 0.2], [0.35, 0.5], [0.35, 0.8], [0.6, 0.8], [0.6, 0.5], [0.35, 0.5]])
  ])
  
  # 7
  templates["7"] = preprocess_trajectory([
    make_stroke([[0.3, 0.2], [0.65, 0.2], [0.45, 0.8]])
  ])
  
  # 8
  theta_8 = np.linspace(0, 2*np.pi, 25)
  t8_pts = [[0.5 + 0.15*np.cos(t), 0.35 + 0.15*np.sin(t)] for t in theta_8]
  b8_pts = [[0.5 + 0.2*np.cos(t), 0.65 - 0.2*np.sin(t)] for t in theta_8]
  templates["8"] = preprocess_trajectory([
    make_stroke(t8_pts),
    make_stroke(b8_pts)
  ])
  
  # 9
  templates["9"] = preprocess_trajectory([
    make_stroke([[0.6, 0.5], [0.35, 0.5], [0.35, 0.2], [0.6, 0.2], [0.6, 0.8]])
  ])
  
  return templates
