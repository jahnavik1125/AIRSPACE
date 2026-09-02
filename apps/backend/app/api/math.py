import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.core.database import get_db
from app.models.workspace import MathSession, SessionModel
from ai_core.math_ocr import MathRecognizer

logger = logging.getLogger("airspace-api-math")
router = APIRouter(prefix="/api/math", tags=["math"])
math_recognizer = MathRecognizer()

# ==============================================================================
# Pydantic Schema Declarations
# ==============================================================================

class PointSchema(BaseModel):
  x: float
  y: float
  t: Optional[int] = Field(0, alias="timestamp")

  class Config:
    populate_by_name = True


class SolveMathRequest(BaseModel):
  db_session_id: int = Field(..., description="The parent connection session database PK")
  strokes: List[List[PointSchema]] = Field(..., description="Array of strokes coordinate trajectories")


# ==============================================================================
# Router Route Endpoints
# ==============================================================================

@router.post("/solve")
def solve_math_equation(req: SolveMathRequest, db: Session = Depends(get_db)):
  """
  Analyzes coordinates, groups strokes, runs SymPy solves, and persists solutions in SQLite/PostgreSQL.
  """
  # 1. Verify parent connection session exists, or fallback gracefully
  parent_session_id = req.db_session_id
  try:
    session_exists = db.query(SessionModel).filter(SessionModel.id == parent_session_id).first() if parent_session_id else None
    if not session_exists:
      fallback_session = db.query(SessionModel).filter(SessionModel.session_uuid == "default-session").first()
      if not fallback_session:
        fallback_session = SessionModel(
          session_uuid="default-session",
          status="active"
        )
        db.add(fallback_session)
        db.commit()
        db.refresh(fallback_session)
      parent_session_id = fallback_session.id
  except Exception as e:
    logger.warning(f"Database session lookup skipped (database offline): {e}")

  # 2. Format stroke dictionaries
  strokes_list = []
  for stroke in req.strokes:
    stroke_pts = []
    for p in stroke:
      stroke_pts.append({"x": p.x, "y": p.y, "t": p.t})
    strokes_list.append(stroke_pts)

  # 3. Solve equation
  try:
    result = math_recognizer.recognize_equation(strokes_list)
  except Exception as e:
    logger.error(f"Failed to parse equation trajectory: {e}")
    raise HTTPException(status_code=500, detail="Algebra recognition parser failure.")

  # 4. Save results to DB
  try:
    if parent_session_id:
      math_session = MathSession(
        session_id=parent_session_id,
        raw_strokes=strokes_list,
        recognized_expression=result.get("expression", ""),
        latex=result.get("latex", ""),
        solution=result.get("solution", {})
      )
      db.add(math_session)
      db.commit()
      db.refresh(math_session)
      logger.info(f"Saved math session ID {math_session.id} for session {parent_session_id}.")
  except Exception as e:
    logger.warning(f"Math persistence DB save skipped (database offline): {e}")
    db.rollback()

  return {
    "status": "success",
    "id": math_session.id,
    "expression": math_session.recognized_expression,
    "latex": math_session.latex,
    "confidence": result.get("confidence", 0.0),
    "is_ambiguous": result.get("is_ambiguous", False),
    "solution": math_session.solution
  }


class SolveExpressionRequest(BaseModel):
  db_session_id: Optional[int] = Field(0, description="Parent session database PK")
  expression: str = Field(..., description="Equation or expression string to solve")


@router.post("/solve-expression")
def solve_math_expression(req: SolveExpressionRequest, db: Session = Depends(get_db)):
  """
  Directly solves an algebraic or calculus expression string using SymPy.
  """
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
    logger.warning(f"Database session query bypassed (database offline): {e}")

  try:
    solution = math_recognizer.engine.solve(req.expression)
  except Exception as e:
    logger.error(f"Failed to solve expression '{req.expression}': {e}")
    raise HTTPException(status_code=400, detail=f"Failed to solve equation: {str(e)}")

  try:
    if active_session:
      math_session = MathSession(
        session_id=active_session.id,
        raw_strokes=[],
        recognized_expression=req.expression,
        latex=req.expression,
        solution=solution
      )
      db.add(math_session)
      db.commit()
      db.refresh(math_session)
  except Exception as e:
    logger.warning(f"Math persistence DB save skipped (database offline): {e}")
    db.rollback()

  return {
    "status": "success",
    "expression": req.expression,
    "latex": req.expression,
    "confidence": 1.0,
    "is_ambiguous": False,
    "solution": solution
  }
