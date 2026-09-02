import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone, timedelta

from app.core.database import get_db
from app.models.workspace import SessionModel, GestureEvent, AirWritingSession, Drawing, MathSession, AnalyticsEvent

logger = logging.getLogger("airspace-api-analytics")
router = APIRouter(prefix="/api/analytics", tags=["analytics"])

# ==============================================================================
# Router Route Endpoints
# ==============================================================================

@router.get("/overview")
def get_analytics_overview(days: Optional[int] = 30, db: Session = Depends(get_db)):
  """
  Compiles aggregated metrics for sessions, gestures counts, latency, and correction rates.
  """
  # Time-series filter
  since_date = datetime.now(timezone.utc) - timedelta(days=days)

  # 1. Total counts
  total_sessions = db.query(func.count(SessionModel.id)).filter(SessionModel.start_time >= since_date).scalar() or 0
  total_events = db.query(func.count(GestureEvent.id)).filter(GestureEvent.created_at >= since_date).scalar() or 0
  avg_duration = db.query(func.avg(SessionModel.duration)).filter(SessionModel.start_time >= since_date).scalar() or 0.0

  # 2. Most-used gesture and distribution
  gesture_counts = db.query(
    GestureEvent.gesture, func.count(GestureEvent.id)
  ).filter(GestureEvent.created_at >= since_date).group_by(GestureEvent.gesture).all()

  gesture_dist = {g[0]: g[1] for g in gesture_counts}
  most_used = max(gesture_dist, key=gesture_dist.get) if gesture_dist else "--"

  # 3. Average confidence and system performance
  avg_confidence = db.query(func.avg(GestureEvent.confidence)).filter(GestureEvent.created_at >= since_date).scalar() or 0.0
  
  # Scan analytics events for FPS/latency averages
  fps_events = db.query(AnalyticsEvent).filter(
    AnalyticsEvent.event_type == "frame_processed",
    AnalyticsEvent.created_at >= since_date
  ).all()
  
  avg_fps = 0.0
  avg_latency = 0.0
  if fps_events:
    fps_list = []
    lat_list = []
    for ev in fps_events:
      meta = ev.metadata_json or {}
      if "fps" in meta:
        fps_list.append(float(meta["fps"]))
      if "latency" in meta:
        lat_list.append(float(meta["latency"]))
    
    if fps_list: avg_fps = float(sum(fps_list) / len(fps_list))
    if lat_list: avg_latency = float(sum(lat_list) / len(lat_list))

  # 4. Air Write OCR recognition statistics
  ocr_sessions = db.query(AirWritingSession).all()
  total_ocr = len(ocr_sessions)
  corrected_ocr = sum(1 for s in ocr_sessions if s.confirmed_label and s.confirmed_label != s.predicted_character)
  accepted_ocr = sum(1 for s in ocr_sessions if s.confirmed_label and s.confirmed_label == s.predicted_character)
  
  correction_rate = (corrected_ocr / total_ocr) if total_ocr > 0 else 0.0
  
  # Calculate actual accuracy based on user confirmed labels
  confirmed_sessions = [s for s in ocr_sessions if s.confirmed_label]
  accuracy = 0.0
  if confirmed_sessions:
    matching = sum(1 for s in confirmed_sessions if s.predicted_character == s.confirmed_label)
    accuracy = matching / len(confirmed_sessions)

  # 5. Modules usage counts
  canvas_saves = db.query(func.count(Drawing.id)).scalar() or 0
  math_solves = db.query(func.count(MathSession.id)).scalar() or 0

  return {
    "status": "success",
    "overview": {
      "total_sessions": total_sessions,
      "total_events": total_events,
      "avg_duration": float(avg_duration),
      "avg_confidence": float(avg_confidence),
      "avg_fps": avg_fps,
      "avg_latency": avg_latency,
      "most_used_gesture": most_used,
      "gesture_distribution": gesture_dist,
      "correction_rate": correction_rate,
      "accuracy": accuracy,
      "module_usage": {
        "canvas_saves": canvas_saves,
        "math_solves": math_solves
      }
    }
  }


@router.get("/sessions")
def get_sessions_history(db: Session = Depends(get_db)):
  """
  Returns list of interaction sessions.
  """
  sessions = db.query(SessionModel).order_by(SessionModel.start_time.desc()).all()
  history = []
  for s in sessions:
    gesture_cnt = db.query(func.count(GestureEvent.id)).filter(GestureEvent.session_id == s.id).scalar() or 0
    writing_cnt = db.query(func.count(AirWritingSession.id)).filter(AirWritingSession.session_id == s.id).scalar() or 0
    canvas_cnt = db.query(func.count(Drawing.id)).filter(Drawing.session_id == s.id).scalar() or 0
    math_cnt = db.query(func.count(MathSession.id)).filter(MathSession.session_id == s.id).scalar() or 0

    history.append({
      "id": s.id,
      "session_uuid": s.session_uuid,
      "created_at": s.start_time,
      "duration": s.duration or 0,
      "gesture_count": gesture_cnt,
      "writing_count": writing_cnt,
      "canvas_count": canvas_cnt,
      "math_count": math_cnt
    })
  return {"status": "success", "sessions": history}


@router.get("/timeline")
def get_analytics_timeline(db: Session = Depends(get_db)):
  """
  Returns chronological log of interaction events.
  """
  events = []
  
  # Fetch recent gesture events
  gestures = db.query(GestureEvent).order_by(GestureEvent.created_at.desc()).limit(15).all()
  for g in gestures:
    events.append({
      "type": "gesture",
      "title": f"Gesture Detected: {g.gesture}",
      "description": f"Confidence: {g.confidence:.2f}",
      "timestamp": g.created_at
    })

  # Fetch recent math sessions
  maths = db.query(MathSession).order_by(MathSession.created_at.desc()).limit(10).all()
  for m in maths:
    events.append({
      "type": "math",
      "title": "Math Expression Solved",
      "description": f"Equation: {m.recognized_expression}",
      "timestamp": m.created_at
    })

  # Fetch recent canvas drawings saves
  drawings = db.query(Drawing).order_by(Drawing.created_at.desc()).limit(10).all()
  for d in drawings:
    import json
    elem_count = 0
    if d.svg_data:
      try:
        elem_count = len(json.loads(d.svg_data))
      except Exception:
        pass
    events.append({
      "type": "canvas",
      "title": "Canvas Saved: AIR Canvas Drawing",
      "description": f"Elements count: {elem_count}",
      "timestamp": d.created_at
    })

  # Sort combined timeline chronological desc
  events.sort(key=lambda x: x["timestamp"], reverse=True)
  return {"status": "success", "timeline": events[:25]}


@router.delete("/purge")
def purge_analytics_data(db: Session = Depends(get_db)):
  """
  Privacy compliance command: deletes all session logs, drawings, math sessions, and tracking metrics.
  """
  try:
    db.query(GestureEvent).delete()
    db.query(Drawing).delete()
    db.query(MathSession).delete()
    db.query(AirWritingSession).delete()
    db.query(AnalyticsEvent).delete()
    db.query(SessionModel).delete()
    db.commit()
    logger.info("Purged all interaction history events rows.")
  except Exception as e:
    db.rollback()
    logger.error(f"Purge operation failure: {e}")
    raise HTTPException(status_code=500, detail="Database wipe failed.")

  return {"status": "success", "message": "All session, analytics, and interaction history successfully deleted."}
