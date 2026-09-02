import pytest
from ai_core.intent import IntentParser
from ai_core.llm_agent import LLMAgentConnector

def test_intent_parser_rules():
  parser = IntentParser()

  # 1. Deterministic CLEAR
  res_clear = parser.parse_intent(gesture_sequence=[], recognized_text="Please clear the blackboard canvas")
  assert res_clear["intent"] == "CLEAR"
  assert res_clear["confidence"] > 0.90

  # 2. Deterministic PLOT
  res_plot = parser.parse_intent(gesture_sequence=[], recognized_text="Plot y = x**2")
  assert res_plot["intent"] == "PLOT"
  assert res_plot["parameters"]["equation"] == "y = x**2"

  # 3. Low-risk query falls back to UNKNOWN or EXPLAIN
  res_exp = parser.parse_intent(gesture_sequence=[], recognized_text="Explain this flow diagram")
  assert res_exp["intent"] == "EXPLAIN"


def test_llm_agent_connector():
  connector = LLMAgentConnector(provider="mock")
  context = {
    "current_module": "CANVAS",
    "selected_object": {"type": "CIRCLE"},
    "canvas_objects": [{"type": "CIRCLE"}, {"type": "LINE"}]
  }

  # Querying without key (using mock provider) should succeed
  res = connector.run_query("Describe this shape", context)
  assert res["status"] == "success"
  assert "[AI Lab Assistant]" in res["response"]
  assert "Module: CANVAS" in res["response"]


def test_llm_agent_connector_missing_key():
  # When setting a real provider but missing key, it should fall back to None/Not Configured
  connector = LLMAgentConnector(api_key=None, provider="openai")
  res = connector.run_query("Describe this shape", {})
  assert res["status"] == "not_configured"
  assert "provider not configured" in res["response"].lower()
