import os
import uuid
import json
import logging
from typing import List, Dict, Any, Tuple, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db, SessionLocal
from app.models.workspace import AirWritingSession, AirWritingSample, SessionModel
from ai_core.airwriting.inference import NeuralRecognizer
from ai_core.airwriting.dataset import CLASSES

logger = logging.getLogger("airspace-api-airwrite")
router = APIRouter(prefix="/api/air-write", tags=["airwrite"])
recognizer = NeuralRecognizer()

# ==============================================================================
# Pydantic Schema Declarations
# ==============================================================================

class PointSchema(BaseModel):
  x: float
  y: float
  z: Optional[float] = 0.0
  t: Optional[int] = Field(0, alias="timestamp")

  class Config:
    populate_by_name = True


class RecognizeRequest(BaseModel):
  db_session_id: int = Field(..., description="WebSocket Session database PK")
  strokes: List[List[PointSchema]] = Field(..., description="List of strokes, each being a list of points")


class RecognizeResponse(BaseModel):
  db_writing_session_id: int
  predicted_character: str
  confidence: float
  top_predictions: List[Tuple[str, float]]


class ConfirmRequest(BaseModel):
  db_writing_session_id: int = Field(..., description="Primary key of AirWritingSession")
  confirmed_label: str = Field(..., description="The verified character confirmed by the user")


class ExportSampleRequest(BaseModel):
  label: str = Field(..., description="Target character class being collected")
  strokes: List[List[PointSchema]] = Field(..., description="Raw coordinate strokes data")


# ==============================================================================
# Router Route Endpoints
# ==============================================================================

@router.post("/recognize", response_model=RecognizeResponse)
def recognize_trajectory(req: RecognizeRequest, db: Session = Depends(get_db)):
  """
  Processes coordinate strokes, runs predictions, logs strokes to database tables,
  and returns characters.
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

  # 2. Run preprocessing and DTW/neural inference
  try:
    # Convert points schema to list of point dicts
    strokes_data = []
    for stroke in req.strokes:
      stroke_pts = []
      for pt in stroke:
        stroke_pts.append({
          "x": pt.x,
          "y": pt.y,
          "z": pt.z,
          "t": pt.t
        })
      strokes_data.append(stroke_pts)

    predicted_char, confidence, top_preds = recognizer.predict(strokes_data)
  except Exception as e:
    logger.error(f"Handwriting prediction failure: {e}")
    raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

  # 3. Create persistent AirWritingSession record in database
  db_writing_session = AirWritingSession(
    session_id=parent_session_id,
    predicted_character=predicted_char,
    confidence=confidence
  )
  db.add(db_writing_session)
  db.commit()

  # 4. Insert AirWritingSample strokes
  try:
    for idx, stroke_pts in enumerate(strokes_data):
      db_sample = AirWritingSample(
        writing_session_id=db_writing_session.id,
        stroke_index=idx,
        points=stroke_pts
      )
      db.add(db_sample)
    db.commit()
  except Exception as e:
    logger.error(f"Failed to record writing samples strokes: {e}")
    db.rollback()

  return RecognizeResponse(
    db_writing_session_id=db_writing_session.id,
    predicted_character=predicted_char,
    confidence=confidence,
    top_predictions=top_preds
  )


@router.post("/confirm")
def confirm_character_prediction(req: ConfirmRequest, db: Session = Depends(get_db)):
  """
  Updates the database record with the verified corrected label confirmed by the user.
  """
  writing_session = db.query(AirWritingSession).filter(AirWritingSession.id == req.db_writing_session_id).first()
  if not writing_session:
    raise HTTPException(status_code=404, detail="AirWritingSession record not found.")

  if req.confirmed_label != "UNKNOWN" and req.confirmed_label not in CLASSES:
    raise HTTPException(status_code=400, detail=f"Label '{req.confirmed_label}' is not supported.")

  try:
    writing_session.confirmed_label = req.confirmed_label
    db.commit()
  except Exception as e:
    logger.error(f"Failed to write confirmed label: {e}")
    db.rollback()
    raise HTTPException(status_code=500, detail="Database write failed.")

  return {"status": "success", "message": f"Confirmed label updated to: {req.confirmed_label}"}


@router.post("/sample")
def save_collected_sample(req: ExportSampleRequest):
  """
  Writes a raw trajectory sample to the datasets directory for custom training.
  """
  if req.label not in CLASSES:
    raise HTTPException(status_code=400, detail=f"Label '{req.label}' is not supported.")

  raw_dir = "datasets/air-writing/raw"
  os.makedirs(raw_dir, exist_ok=True)

  # Convert schema coordinates list
  strokes_data = []
  for stroke in req.strokes:
    stroke_pts = []
    for pt in stroke:
      stroke_pts.append({
        "x": pt.x,
        "y": pt.y,
        "z": pt.z,
        "t": pt.t
      })
    strokes_data.append(stroke_pts)

  # Compile dataset sample structure
  sample_id = str(uuid.uuid4())
  sample = {
    "sample_id": sample_id,
    "label": req.label,
    "points": strokes_data,
    "timestamp": int(uuid.uuid4().time / 10000) # approximate time
  }

  file_path = os.path.join(raw_dir, f"sample_{req.label}_{sample_id}.json")
  try:
    with open(file_path, "w") as f:
      json.dump(sample, f, indent=2)
  except Exception as e:
    logger.error(f"Failed to save dataset sample: {e}")
    raise HTTPException(status_code=500, detail=f"Failed to write file: {str(e)}")

  return {
    "status": "success",
    "sample_id": sample_id,
    "file_path": file_path
  }


@router.get("/dataset/stats")
def get_dataset_statistics():
  """
  Scans datasets directories and reports counts of collected samples per class.
  """
  raw_dir = "datasets/air-writing/raw"
  stats = {char: 0 for char in CLASSES}
  total = 0

  if os.path.exists(raw_dir):
    for filename in os.listdir(raw_dir):
      if filename.endswith(".json"):
        # File name format: sample_LABEL_UUID.json
        parts = filename.split("_")
        if len(parts) >= 2:
          label = parts[1]
          if label in stats:
            stats[label] += 1
            total += 1

  return {
    "total_samples": total,
    "samples_per_class": stats
  }
