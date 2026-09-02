import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.core.database import get_db
from app.models.workspace import Drawing, SessionModel

logger = logging.getLogger("airspace-api-canvas")
router = APIRouter(prefix="/api/canvas", tags=["canvas"])

# ==============================================================================
# Pydantic Schema Declarations
# ==============================================================================

from ai_core.aircanvas.shape_recognizer import recognize_shape

class SaveDrawingRequest(BaseModel):
  db_session_id: int = Field(..., description="The WebSocket parent session database PK")
  name: Optional[str] = Field("Untitled Drawing", description="The label name of the drawing")
  data: List[Dict[str, Any]] = Field(..., description="JSON array of canvas stroke/shape vector objects")


class DrawingResponse(BaseModel):
  id: int
  name: str
  data: List[Dict[str, Any]]
  updated_at: datetime


class PointSchema(BaseModel):
  x: float
  y: float
  t: Optional[int] = Field(0, alias="timestamp")

  class Config:
    populate_by_name = True


class RecognizeShapeRequest(BaseModel):
  points: List[PointSchema] = Field(..., description="Strokes trajectory points to classify shape")


# ==============================================================================
# Router Route Endpoints
# ==============================================================================

@router.post("/save")
def save_canvas_drawing(req: SaveDrawingRequest, db: Session = Depends(get_db)):
  """
  Saves or updates drawing stroke layers in the database for the active session.
  """
  # 1. Verify parent connection session exists, or fallback gracefully
  parent_session_id = req.db_session_id
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

  # 2. Check if a drawing already exists for this session
  drawing = db.query(Drawing).filter(Drawing.session_id == parent_session_id).first()

  try:
    import json
    if drawing:
      # Update existing drawing
      drawing.svg_data = json.dumps(req.data)
      db.commit()
      db.refresh(drawing)
      logger.info(f"Updated drawing ID {drawing.id} for session {parent_session_id}.")
    else:
      # Create new drawing
      drawing = Drawing(
        session_id=parent_session_id,
        svg_data=json.dumps(req.data)
      )
      db.add(drawing)
      db.commit()
      db.refresh(drawing)
      logger.info(f"Created new drawing ID {drawing.id} for session {parent_session_id}.")
  except Exception as e:
    logger.error(f"Failed to save drawing layers: {e}")
    db.rollback()
    raise HTTPException(status_code=500, detail="Database save failed.")

  return {
    "status": "success",
    "id": drawing.id,
    "name": req.name
  }


@router.get("/load/{db_session_id}", response_model=Dict[str, Any])
def load_canvas_drawing(db_session_id: int, db: Session = Depends(get_db)):
  """
  Loads the drawing vector layer for the specified database session ID.
  """
  target_id = db_session_id
  if target_id == 0:
    fallback = db.query(SessionModel).filter(SessionModel.session_uuid == "default-session").first()
    if fallback:
      target_id = fallback.id

  drawing = db.query(Drawing).filter(Drawing.session_id == target_id).first()
  if not drawing:
    return {"status": "not_found", "data": []}

  import json
  data_list = []
  if drawing.svg_data:
    try:
      data_list = json.loads(drawing.svg_data)
    except Exception:
      pass

  return {
    "status": "success",
    "id": drawing.id,
    "name": "AIR Canvas Drawing",
    "data": data_list,
    "updated_at": drawing.created_at
  }


@router.delete("/{drawing_id}")
def delete_canvas_drawing(drawing_id: int, db: Session = Depends(get_db)):
  """
  Deletes the specified drawing vector layer by ID.
  """
  drawing = db.query(Drawing).filter(Drawing.id == drawing_id).first()
  if not drawing:
    raise HTTPException(status_code=404, detail="Drawing record not found.")

  try:
    db.delete(drawing)
    db.commit()
    logger.info(f"Deleted drawing ID {drawing_id}.")
  except Exception as e:
    logger.error(f"Failed to delete drawing: {e}")
    db.rollback()
    raise HTTPException(status_code=500, detail="Database deletion failed.")

  return {"status": "success", "message": "Drawing successfully deleted."}


@router.post("/recognize-shape")
def recognize_canvas_shape(req: RecognizeShapeRequest):
  """
  Analyzes coordinates trajectory, simplifies corners, and classifies shapes (LINE, CIRCLE, RECTANGLE, TRIANGLE, ARROW).
  """
  try:
    pts = [{"x": pt.x, "y": pt.y, "t": pt.t} for pt in req.points]
    shape, confidence, bbox = recognize_shape(pts)
    return {
      "status": "success",
      "shape": shape,
      "confidence": confidence,
      "boundingBox": bbox
    }
  except Exception as e:
    logger.error(f"Shape recognition runtime failure: {e}")
    raise HTTPException(status_code=500, detail=str(e))
