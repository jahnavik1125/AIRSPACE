import re
from typing import Any, Dict, List

class IntentParser:
    """
    Parses user actions, spatial sequences, and transcripts to classify high-level dashboard command intents.
    """

    def __init__(self):
        pass

    def parse_intent(
        self, gesture_sequence: List[Dict[str, Any]], recognized_text: str = ""
    ) -> Dict[str, Any]:
        """
        Maps a history of gestures and text to high-level dashboard events.
        """
        text_lower = recognized_text.lower().strip()

        # 1. Deterministic intents overrides
        if not text_lower:
            return {"intent": "UNKNOWN", "parameters": {}, "confidence": 0.0}

        if "clear" in text_lower or "wipe" in text_lower:
            return {"intent": "CLEAR", "parameters": {}, "confidence": 0.98}

        if "save" in text_lower or "persist" in text_lower:
            return {"intent": "SAVE", "parameters": {}, "confidence": 0.98}

        if "plot" in text_lower or "graph" in text_lower:
            # Try to extract equation following keyword, e.g. "plot y = x^2"
            eq = text_lower.replace("plot", "").replace("graph", "").strip()
            return {"intent": "PLOT", "parameters": {"equation": eq}, "confidence": 0.95}

        if "solve" in text_lower:
            eq = text_lower.replace("solve", "").strip()
            return {"intent": "SOLVE", "parameters": {"equation": eq}, "confidence": 0.95}

        if "explain" in text_lower:
            return {"intent": "EXPLAIN", "parameters": {}, "confidence": 0.90}

        if "analyze" in text_lower:
            return {"intent": "ANALYZE", "parameters": {}, "confidence": 0.90}

        if "summarize" in text_lower:
            return {"intent": "SUMMARIZE", "parameters": {}, "confidence": 0.90}

        if "transform" in text_lower:
            return {"intent": "TRANSFORM", "parameters": {}, "confidence": 0.90}

        if "generate" in text_lower:
            return {"intent": "GENERATE", "parameters": {}, "confidence": 0.90}

        return {"intent": "UNKNOWN", "parameters": {"query": recognized_text}, "confidence": 0.50}
