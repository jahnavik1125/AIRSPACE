import os
import glob
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from main import app
from app.models.workspace import SessionModel, AirWritingSession, AirWritingSample
from app.core.database import SessionLocal

client = TestClient(app)

@pytest.fixture(scope="module")
def db_session():
  db = SessionLocal()
  try:
    yield db
  finally:
    db.close()


def test_airwrite_api_flow(db_session: Session):
  # 1. Create a parent connection session row
  test_session = SessionModel(
    session_uuid="test-ws-session-uuid-999",
    status="active"
  )
  db_session.add(test_session)
  db_session.commit()
  db_session.refresh(test_session)

  db_session_id = test_session.id

  # 2. Call recognize endpoint with a simple horizontal stroke
  stroke = [{"x": float(i)/10.0, "y": 0.5, "z": 0.0, "timestamp": i * 33} for i in range(10)]
  payload = {
    "db_session_id": db_session_id,
    "strokes": [stroke]
  }

  response = client.post("/api/air-write/recognize", json=payload)
  assert response.status_code == 200
  data = response.json()
  
  assert "db_writing_session_id" in data
  assert "predicted_character" in data
  assert "confidence" in data
  assert "top_predictions" in data

  db_writing_session_id = data["db_writing_session_id"]

  # Assert data rows were created in DB
  assert db_session.query(AirWritingSession).filter(AirWritingSession.id == db_writing_session_id).first() is not None
  samples_count = db_session.query(AirWritingSample).filter(AirWritingSample.writing_session_id == db_writing_session_id).count()
  assert samples_count == 1  # 1 stroke was sent

  # 3. Confirm prediction corrected label
  confirm_payload = {
    "db_writing_session_id": db_writing_session_id,
    "confirmed_label": "H"
  }
  confirm_resp = client.post("/api/air-write/confirm", json=confirm_payload)
  assert confirm_resp.status_code == 200
  
  # Verify label is stored
  updated_session = db_session.query(AirWritingSession).filter(AirWritingSession.id == db_writing_session_id).first()
  assert updated_session.confirmed_label == "H"

  # 4. Save sample to datasets
  sample_payload = {
    "label": "Z",
    "strokes": [stroke]
  }
  sample_resp = client.post("/api/air-write/sample", json=sample_payload)
  assert sample_resp.status_code == 200
  sample_data = sample_resp.json()
  assert sample_data["status"] == "success"
  file_path = sample_data["file_path"]

  # 5. Check dataset stats includes the saved Z sample
  stats_resp = client.get("/api/air-write/dataset/stats")
  assert stats_resp.status_code == 200
  stats_data = stats_resp.json()
  assert stats_data["total_samples"] >= 1
  assert stats_data["samples_per_class"]["Z"] >= 1

  # Cleanup exported files so we don't pollute local directories
  if os.path.exists(file_path):
    os.remove(file_path)
