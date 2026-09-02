import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from main import app
from app.models.workspace import SessionModel, GestureProfile
from app.core.database import SessionLocal

client = TestClient(app)

@pytest.fixture(scope="module")
def db_session():
  db = SessionLocal()
  try:
    yield db
  finally:
    db.close()


def test_analytics_endpoints_and_purge(db_session: Session):
  # 1. Create a parent session
  test_session = SessionModel(
    session_uuid="test-analytics-session-uuid-999",
    status="active"
  )
  db_session.add(test_session)
  db_session.commit()
  db_session.refresh(test_session)

  db_session_id = test_session.id

  # 2. Call Overview endpoint
  resp_over = client.get("/api/analytics/overview")
  assert resp_over.status_code == 200
  data_over = resp_over.json()
  assert data_over["status"] == "success"
  assert "overview" in data_over

  # 3. Call Sessions history
  resp_sess = client.get("/api/analytics/sessions")
  assert resp_sess.status_code == 200
  data_sess = resp_sess.json()
  assert len(data_sess["sessions"]) >= 1

  # 4. Call timeline
  resp_time = client.get("/api/analytics/timeline")
  assert resp_time.status_code == 200

  # 5. Call Purge
  resp_purge = client.delete("/api/analytics/purge")
  assert resp_purge.status_code == 200
  assert db_session.query(SessionModel).filter(SessionModel.id == db_session_id).first() is None


def test_gesture_calibration_flow(db_session: Session):
  # 1. Re-create parent session
  test_session = SessionModel(
    session_uuid="test-calib-session-uuid-333",
    status="active"
  )
  db_session.add(test_session)
  db_session.commit()
  db_session.refresh(test_session)

  db_session_id = test_session.id

  # 2. POST calibration sample
  calibration_payload = {
    "db_session_id": db_session_id,
    "gesture_name": "PINCH",
    # Mocks 21 landmarks
    "raw_landmarks": [{"x": float(i)/10.0, "y": float(i)/10.0, "z": 0.0} for i in range(21)]
  }

  resp_post = client.post("/api/gestures/calibration", json=calibration_payload)
  assert resp_post.status_code == 200
  data_post = resp_post.json()
  assert data_post["status"] == "success"
  assert data_post["sample_count"] == 1

  # Assert DB row created
  db_profile = db_session.query(GestureProfile).filter(
    GestureProfile.session_id == db_session_id,
    GestureProfile.gesture_name == "PINCH"
  ).first()
  assert db_profile is not None
  assert db_profile.sample_count == 1

  # 3. GET calibration summaries
  resp_get = client.get(f"/api/gestures/calibration?db_session_id={db_session_id}")
  assert resp_get.status_code == 200
  data_get = resp_get.json()
  assert len(data_get["profiles"]) == 1
  assert data_get["profiles"][0]["gesture_name"] == "PINCH"

  # 4. DELETE reset calibration profile
  resp_del = client.delete(f"/api/gestures/calibration?db_session_id={db_session_id}")
  assert resp_del.status_code == 200
  
  # Assert DB row cleared
  assert db_session.query(GestureProfile).filter(GestureProfile.session_id == db_session_id).first() is None
