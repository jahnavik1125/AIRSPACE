# AIRSPACE AI & OCR Recognition Engine (`ai_core`)

This library processes drawings and strokes captured from spatial webcam interactions to perform Handwriting recognition, Math OCR, Intent mapping, and optional LLM agents integration.

## Core Modules

* **`handwriting.py`**: Integrates local handwriting OCR classifiers. Tracks lines and converts strokes into standard characters.
* **`math_ocr.py`**: Translates coordinates of drawn equations and shapes into formatted LaTeX strings.
* **`intent.py`**: Parses spatial events and voice interactions to match high-level system intents (e.g. "clear canvas", "solve equation").
* **`llm_agent.py`**: Handles external LLM calls to solve equations, answer questions, or query logs.
