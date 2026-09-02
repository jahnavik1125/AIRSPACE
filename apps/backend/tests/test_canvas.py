import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from main import app
from app.models.workspace import SessionModel, Drawing
from app.core.database import SessionLocal

client = TestClient(app)

@pytest.fixture(scope="module")
def db_session():
  db = SessionLocal()
  try:
    yield db
  finally:
    db.close()


def test_canvas_api_flow(db_session: Session):
  # 1. Create a parent connection session row
  test_session = SessionModel(
    session_uuid="test-canvas-session-uuid-777",
    status="active"
  )
  db_session.add(test_session)
  db_session.commit()
  db_session.refresh(test_session)

  db_session_id = test_session.id

  # 2. Call Save Drawing layers
  save_payload = {
    "db_session_id": db_session_id,
    "name": "Spatial Room Diagram",
    "data": [
      {
        "id": "stroke-1",
        "type": "RECTANGLE",
        "points": [{"x": 0.2, "y": 0.2, "t": 100}, {"x": 0.5, "y": 0.5, "t": 200}],
        "position": {"x": 0, "y": 0},
        "boundingBox": {"minX": 0.2, "minY": 0.2, "maxX": 0.5, "maxY": 0.5},
        "color": "#3b82f6",
        "width": 4,
        "opacity": 1.0
      }
    ]
  }

  save_resp = client.post("/api/canvas/save", json=save_payload)
  assert save_resp.status_code == 200
  save_data = save_resp.json()
  assert save_data["status"] == "success"
  drawing_id = save_data["id"]

  # Check DB row created
  db_drawing = db_session.query(Drawing).filter(Drawing.id == drawing_id).first()
  assert db_drawing is not None
  assert db_drawing.svg_data is not None

  # 3. Call Load Drawing
  load_resp = client.get(f"/api/canvas/load/{db_session_id}")
  assert load_resp.status_code == 200
  load_data = load_resp.json()
  assert load_data["status"] == "success"
  assert len(load_data["data"]) == 1
  assert load_data["data"][0]["type"] == "RECTANGLE"

  # 4. Test recognize-shape API endpoint
  recognize_payload = {
    "points": [{"x": float(i)/10.0, "y": float(i)/10.0, "timestamp": i * 33} for i in range(10)]
  }
  rec_resp = client.post("/api/canvas/recognize-shape", json=recognize_payload)
  assert rec_resp.status_code == 200
  rec_data = rec_resp.json()
  assert rec_data["status"] == "success"
  assert rec_data["shape"] == "LINE"

  # 5. Call Delete drawing
  del_resp = client.delete(f"/api/canvas/{drawing_id}")
  assert del_resp.status_code == 200
  
  # Assert DB row deleted
  assert db_session.query(Drawing).filter(Drawing.id == drawing_id).first() is None
