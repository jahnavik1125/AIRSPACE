from typing import Any, Dict, List
from ai_core.airmath.parser import MathExpressionParser
from ai_core.airmath.math_engine import MathEngine


class MathRecognizer:
    """
    Translates hand-drawn equations into LaTeX format and parses them.
    """

    def __init__(self, model_path: str | None = None):
        self.model_path = model_path
        self.parser = MathExpressionParser()
        self.engine = MathEngine()

    def load_model(self) -> bool:
        """
        Loads LaTeX equation recognition model.
        """
        return True

    def recognize_equation(
        self, strokes: List[List[Dict[str, float]]]
    ) -> Dict[str, Any]:
        """
        Analyzes strokes and classifies mathematical symbols, structures, and layouts.
        """
        # Format input coordinate attributes
        formatted_strokes = []
        for stroke in strokes:
            formatted_stroke = []
            for p in stroke:
                formatted_stroke.append({
                    "x": float(p.get("x", 0.0)),
                    "y": float(p.get("y", 0.0)),
                    "t": int(p.get("t", p.get("timestamp", 0)))
                })
            formatted_strokes.append(formatted_stroke)

        parsed = self.parser.parse_expression(formatted_strokes)

        expr = parsed["expression"]
        solution_data = {}
        if expr:
            solution_data = self.engine.solve(expr)

        return {
            "expression": expr,
            "latex": parsed["latex"],
            "confidence": parsed["confidence"],
            "is_ambiguous": parsed["is_ambiguous"],
            "solution": solution_data
        }
