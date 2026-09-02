import os
from typing import Any, Dict, Optional

class AIProvider:
    """
    Abstract interface for Large Language Model backends.
    """
    def query(self, prompt: str, context_summary: str) -> str:
      raise NotImplementedError("Subclasses must implement query().")


class MockAIProvider(AIProvider):
    """
    Deterministic mockup provider for tests and environment fallback.
    """
    def query(self, prompt: str, context_summary: str) -> str:
      return f"[AI Lab Assistant] Processing query '{prompt}' against context [{context_summary}]. Everything looks valid."


class LLMAgentConnector:
    """
    Manages Large Language Model calls for processing complex workspace reasoning.
    """

    def __init__(self, api_key: Optional[str] = None, provider: str = "mock"):
        self.api_key = api_key or os.getenv("AIRSPACE_AI_API_KEY")
        self.provider_name = provider.lower()
        self.provider = self._init_provider()

    def _init_provider(self) -> AIProvider:
        if self.provider_name == "mock":
          return MockAIProvider()
        
        # If API key is missing for real providers, return mock or throw
        if not self.api_key:
          return None
          
        return MockAIProvider()

    def run_query(self, user_query: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sends a query along with recent canvas/equation state to the LLM agent.
        """
        if self.provider is None:
          return {
              "response": "AI provider not configured.",
              "status": "not_configured"
          }

        # Format context parameters
        current_module = context.get("current_module", "UNKNOWN")
        selected_obj = context.get("selected_object")
        canvas_count = len(context.get("canvas_objects", []))
        
        context_summary = f"Module: {current_module}, Selected Object: {selected_obj}, Active Shapes Count: {canvas_count}"
        
        try:
          response_text = self.provider.query(user_query, context_summary)
          return {
              "response": response_text,
              "status": "success"
          }
        except Exception as e:
          return {
              "response": f"AI service execution error: {str(e)}",
              "status": "error"
          }
