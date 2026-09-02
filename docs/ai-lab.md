# AI Lab: Central Multimodal Reasoning Workspace

This document describes the intent parsers, context engine, and LLM abstractions powering the **AI Lab** reasoning workspace.

---

## 1. Intent Classification Architecture

To ensure high performance and reliability, the Intent Engine uses a hybrid routing system:

```
User Query / Transcript
  ↓
Deterministic RegEx/Keyword Rules
  ↓
  ├─► Match CLEAR/SAVE/PLOT/SOLVE ──► Execute Tool directly
  └─► No Match (UNKNOWN) ───────────► Delegate to LLM provider
```

### Deterministic Intents
* **`CLEAR`**: Triggered by keywords `clear`, `wipe`. Wipes the drawing canvas.
* **`SAVE`**: Triggered by keywords `save`, `persist`. Commits layers to SQLite.
* **`PLOT`**: Runs local math plotter on matching equations.
* **`SOLVE`**: Runs local SymPy math solver.

---

## 2. Context Engine (`InteractionContext`)

LLM queries are context-aware. Before dispatching queries, the system aggregates the workspace states:
* `current_module`: `"CANVAS"` | `"MATH"`
* `selected_object`: Geometry of currently hovered/selected shape.
* `canvas_objects`: The list of all active drawing vector layers.

This enables users to give index point gesture selections combined with voice queries (e.g. pointing to a circle and saying "Explain this shape").

---

## 3. Modular AI Provider Interface

We isolate provider-specific logic by defining a unified abstract class:

```python
class AIProvider:
    def query(self, prompt: str, context_summary: str) -> str:
        raise NotImplementedError()
```

Concrete implementations:
* **`MockAIProvider`**: Fallback provider for tests and local setups.
* **`OpenAIProvider` / `GeminiProvider`**: Custom implementations that load API keys server-side (never exposed to client Next.js bundles).

If no keys are configured, the system reports `"AI provider not configured."` instead of crashing.

---

## 4. Speech Input (Web Speech API)

Voice input utilizes the browser-native Web Speech API `webkitSpeechRecognition`:
* **State logs**: Displays `LISTENING`, `ERROR`, or `IDLE` statuses.
* **Permissions**: Prompts users for microphone access.
* **Auto-triggers**: Dictating commands (e.g. "Clear the canvas") automatically triggers intent resolution.
* **Safety Confirmation**: For destructive operations (like clearing canvas objects), the page presents a confirmation overlay modal before execution.
