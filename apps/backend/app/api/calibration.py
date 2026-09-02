import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.core.database import get_db
from app.models.workspace import SessionModel, GestureProfile, GestureCalibrationSample
from ai_core.personalization.features import extract_calibration_features
from ai_core.personalization.models import PersonalizedGestureModel

logger = logging.getLogger("airspace-api-calibration")
router = APIRouter(prefix="/api/gestures", tags=["calibration"])
personalization_model = PersonalizedGestureModel()

# ==============================================================================
# Pydantic Schema Declarations
# ==============================================================================

class LandmarkSchema(BaseModel):
  x: float
  y: float
  z: float


class CalibrationSampleRequest(BaseModel):
  db_session_id: int = Field(..., description="Active session database PK")
  gesture_name: str = Field(..., description="Name of targeted gesture (e.g. PINCH, FIST)")
  raw_landmarks: List[LandmarkSchema] = Field(..., description="Array of 21 hand landmarks joints coordinates")


# ==============================================================================
# Router Route Endpoints
# ==============================================================================

@router.post("/calibration")
def add_calibration_sample(req: CalibrationSampleRequest, db: Session = Depends(get_db)):
  """
  Processes landmark features, appends calibration samples, and recalculates adaptive thresholds.
  """
  # 1. Verify parent session with fallback
  active_session = None
  if req.db_session_id and req.db_session_id > 0:
    active_session = db.query(SessionModel).filter(SessionModel.id == req.db_session_id).first()
  if not active_session:
    active_session = db.query(SessionModel).order_by(SessionModel.id.desc()).first()
    if not active_session:
      active_session = SessionModel(client_ip="127.0.0.1", user_agent="AIRSPACE-Local")
      db.add(active_session)
      db.commit()
      db.refresh(active_session)
  actual_session_id = active_session.id

  # 2. Extract features
  landmarks_dict = [{"x": l.x, "y": l.y, "z": l.z} for l in req.raw_landmarks]
  features = extract_calibration_features(landmarks_dict)

  # 3. Find or create profile
  profile = db.query(GestureProfile).filter(
    GestureProfile.session_id == actual_session_id,
    GestureProfile.gesture_name == req.gesture_name
  ).first()

  try:
    if not profile:
      profile = GestureProfile(
        session_id=actual_session_id,
        gesture_name=req.gesture_name,
        sample_count=0
      )
      db.add(profile)
      db.commit()
      db.refresh(profile)

    # 4. Save sample
    sample = GestureCalibrationSample(
      profile_id=profile.id,
      raw_landmarks=landmarks_dict,
      extracted_features=features
    )
    db.add(sample)
    db.commit()

    # 5. Load all samples to re-calculate stats
    samples = db.query(GestureCalibrationSample).filter(GestureCalibrationSample.profile_id == profile.id).all()
    samples_features = [s.extracted_features for s in samples]

    means, variances, threshold, consistency = personalization_model.compute_profile_statistics(samples_features)

    # Update profile fields
    profile.sample_count = len(samples)
    profile.mean_features = means
    profile.var_features = variances
    profile.personalized_threshold = threshold
    profile.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(profile)

  except Exception as e:
    db.rollback()
    logger.error(f"Failed to record calibration sample: {e}")
    raise HTTPException(status_code=500, detail="Database write error during calibration.")

  return {
    "status": "success",
    "sample_count": profile.sample_count,
    "consistency": consistency,
    "personalized_threshold": profile.personalized_threshold
  }


@router.get("/calibration")
def get_calibration_profiles(db_session_id: Optional[int] = 0, db: Session = Depends(get_db)):
  """
  Fetches all active calibration profile statistics for the current connection session ID.
  """
  query = db.query(GestureProfile)
  if db_session_id and db_session_id > 0:
    query = query.filter(GestureProfile.session_id == db_session_id)
  profiles = query.all()
  results = []
  
  for p in profiles:
    samples = db.query(GestureCalibrationSample).filter(GestureCalibrationSample.profile_id == p.id).all()
    samples_features = [s.extracted_features for s in samples]
    _, _, _, consistency = personalization_model.compute_profile_statistics(samples_features)

    results.append({
      "gesture_name": p.gesture_name,
      "sample_count": p.sample_count,
      "personalized_threshold": p.personalized_threshold,
      "consistency": consistency,
      "updated_at": p.updated_at
    })

  return {"status": "success", "profiles": results}


@router.delete("/calibration")
def reset_gesture_profile(db_session_id: Optional[int] = None, db: Session = Depends(get_db)):
  """
  Wipes all calibration data, resetting thresholds to global defaults.
  """
  if db_session_id is not None:
    profiles = db.query(GestureProfile).filter(GestureProfile.session_id == db_session_id).all()
  else:
    profiles = db.query(GestureProfile).all()

  try:
    for p in profiles:
      db.delete(p)
    db.commit()
    logger.info(f"Reset calibration gesture profile for session {db_session_id}.")
  except Exception as e:
    db.rollback()
    logger.error(f"Reset profiles failure: {e}")
    raise HTTPException(status_code=500, detail="Profile reset failed.")

  return {"status": "success", "message": "Gesture profile successfully reset to defaults."}
