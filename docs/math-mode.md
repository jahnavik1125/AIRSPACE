# Math Mode: Spatially Tracked Algebraic Computations

This document describes the algebraic equations recognition and symbolic solving pipelines utilized in the **Math Mode** workspace.

---

## 1. Interaction Pipeline

```
Math Strokes 
  ↓ (Pinch gesture coordinates capture)
Horizontal Segmentation
  ↓ (Grouping of adjacent/overlapping strokes)
Symbol Classifier
  ↓ (DTW template matching for 16 symbols)
Superscript Checker
  ↓ (Checks Y centroid baseline offset offsets)
LaTeX & SymPy Parser
  ↓ (Algebra solver engine)
Solution output steps
```

---

## 2. Supported Symbols & DTW Templates

The symbol classifier handles a focused math vocabulary:
* **Digits**: `0-9`
* **Variables**: `x`, `y`
* **Operators**: `+`, `-`, `=`, `*`, `/`
* **Parentheses & Carets**: `(`, `)`, `^`, `\sqrt`

We construct reference trajectories for each symbol class. Preprocessed user strokes are compared against these models using the Dynamic Time Warping (DTW) distance metric.

---

## 3. Spatial Segmentation & Baselines

1. **Horizontal Clustering**: Adjacent strokes are grouped into character cells if they overlap horizontally or the gap between them is smaller than $8\%$ of the screen width:
   $$\Delta x = x_{\text{min}, i} - x_{\text{max}, i-1} < 0.08$$
2. **Superscript Detection**: If the center $Y$ coordinate of a character is significantly higher than the predecessor (smaller pixel value):
   $$y_{\text{center}} < y_{\text{baseline}} - 0.25 \times \text{height}_{\text{baseline}}$$
   This character is parsed as a superscript (e.g. `x^2`).

---

## 4. SymPy Algebra Engine & Steps

We wrap Python's `sympy` library to solve:
* **Linear Equations** ($ax + b = 0$): Isolates terms and divides.
* **Quadratic Equations** ($ax^2 + bx + c = 0$): Calculates discriminant $\Delta = b^2 - 4ac$ and applies the quadratic formula.
* **Calculus (Experimental)**: Triggers symbolic differentiation (`diff`) or integration (`int`).
* **Simplification**: Simplifies and factors polynomials (e.g. $x^2 - 9 \rightarrow (x-3)(x+3)$).

---

## 5. Interactive Graphing

If the resolved equation corresponds to a function of $x$, the frontend React graphing plotter maps coordinates to screen pixels. It supports:
* **Interactive Pan/Zoom**: Translates offsets and scales the grid view.
* **Grid Lines & Axis Labels**: Renders unit dimensions on screen.
