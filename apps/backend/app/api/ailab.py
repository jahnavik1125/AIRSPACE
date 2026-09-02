import os
import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.workspace import SessionModel
from ai_core.intent import IntentParser
from ai_core.llm_agent import LLMAgentConnector

logger = logging.getLogger("airspace-api-ailab")
router = APIRouter(prefix="/api/ai-lab", tags=["ai-lab"])

intent_parser = IntentParser()

# ==============================================================================
# Pydantic Schema Declarations
# ==============================================================================

class ContextSchema(BaseModel):
  current_module: str = Field("SETTINGS", description="Active platform workspace route (e.g. CANVAS, MATH)")
  selected_object: Optional[Dict[str, Any]] = Field(None, description="The properties of the selected canvas entity")
  canvas_objects: Optional[List[Dict[str, Any]]] = Field(None, description="Active vector shapes elements catalog")


class AIQueryRequest(BaseModel):
  db_session_id: Optional[int] = Field(0, description="Active SQLite/PostgreSQL connection PK")
  query: str = Field(..., description="Voice transcript or text prompt query input")
  context: Optional[ContextSchema] = Field(default_factory=lambda: ContextSchema(current_module="SETTINGS"), description="Aggregated interaction properties boundaries")


# ==============================================================================
# Router Route Endpoints
# ==============================================================================

@router.post("/query")
def process_ai_lab_query(req: AIQueryRequest, db: Session = Depends(get_db)):
  """
  Processes natural language prompts, matches intents deterministically,
  and returns LLM responses or action triggers.
  """
  # 1. Fallback parent session resolution
  active_session = None
  try:
    if req.db_session_id and req.db_session_id > 0:
      active_session = db.query(SessionModel).filter(SessionModel.id == req.db_session_id).first()
    if not active_session:
      active_session = db.query(SessionModel).order_by(SessionModel.id.desc()).first()
      if not active_session:
        active_session = SessionModel(client_ip="127.0.0.1", user_agent="AIRSPACE-Local")
        db.add(active_session)
        db.commit()
        db.refresh(active_session)
  except Exception as e:
    logger.warning(f"Database session query bypassed (database offline/disconnected): {e}")

  # 2. Parse intent
  intent_res = intent_parser.parse_intent(gesture_sequence=[], recognized_text=req.query)
  intent = intent_res.get("intent", "UNKNOWN")
  params = intent_res.get("parameters", {})

  # 3. Check for deterministic commands overrides
  if intent in ["CLEAR", "SAVE"]:
    return {
      "status": "success",
      "intent": intent,
      "action": "execute_command",
      "command": intent,
      "response": f"Executing deterministic command: {intent}."
    }

  # 4. Check for Explain intent with selected object
  if intent == "EXPLAIN":
    selected = req.context.selected_object if req.context else None
    if selected:
      obj_type = selected.get("type", "SHAPE")
      color = selected.get("color", "#3b82f6")
      width = selected.get("width", 2)
      return {
        "status": "success",
        "intent": "EXPLAIN",
        "action": "execute_tool",
        "tool": "CanvasExplainerTool",
        "parameters": {"selected_object": selected},
        "response": f"Selected Canvas Object: {obj_type} (Color: {color}, Width: {width}). This object is an active spatial vector layer on your canvas."
      }

  # 5. Check if mathematical intent can be processed locally
  if intent in ["PLOT", "SOLVE"]:
    eq = params.get("equation", "").strip() or ("2x + 5 = 15" if intent == "SOLVE" else "y = x^2")
    return {
      "status": "success",
      "intent": intent,
      "action": "execute_tool",
      "tool": "MathTool" if intent == "SOLVE" else "GraphTool",
      "parameters": {"equation": eq},
      "response": f"Routing query to local mathematical tool: {intent} with equation '{eq}'."
    }

  # 6. Check external LLM provider configuration
  # 6. LLM query delegation
  api_key = os.getenv("AIRSPACE_AI_API_KEY") or os.getenv("OPENAI_API_KEY") or os.getenv("GEMINI_API_KEY")
  if api_key:
    connector = LLMAgentConnector(api_key=api_key, provider="openai")
  else:
    connector = LLMAgentConnector(provider="mock")

  context_dict = {
    "current_module": req.context.current_module if req.context else "UNKNOWN",
    "selected_object": req.context.selected_object if req.context else None,
    "canvas_objects": req.context.canvas_objects if req.context else []
  }

  ai_res = connector.run_query(req.query, context_dict)
  response_text = ai_res.get("response", "No response received.")
  llm_status = "configured" if api_key else "not_configured"
  if not api_key:
    response_text += " [AI Provider API key configuration required for live LLM]"

  return {
    "status": "success",
    "intent": intent,
    "action": "llm_agent",
    "response": response_text,
    "llm_status": llm_status
  }
