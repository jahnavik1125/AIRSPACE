import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from main import app
from app.models.workspace import SessionModel, MathSession
from app.core.database import SessionLocal

client = TestClient(app)

@pytest.fixture(scope="module")
def db_session():
  db = SessionLocal()
  try:
    yield db
  finally:
    db.close()


def test_math_api_solve_and_persistence(db_session: Session):
  # 1. Create a parent connection session
  test_session = SessionModel(
    session_uuid="test-math-session-uuid-111",
    status="active"
  )
  db_session.add(test_session)
  db_session.commit()
  db_session.refresh(test_session)

  db_session_id = test_session.id

  # 2. Call /solve equation endpoint (e.g. 2*x + 5 = 15)
  # Mock strokes corresponding to symbols
  solve_payload = {
    "db_session_id": db_session_id,
    "strokes": [
      # Stroke 1: straight vertical line (representing '1')
      [{"x": 0.5, "y": 0.2, "t": 10}, {"x": 0.5, "y": 0.8, "t": 40}]
    ]
  }

  resp = client.post("/api/math/solve", json=solve_payload)
  assert resp.status_code == 200
  data = resp.json()
  assert data["status"] == "success"
  math_id = data["id"]
  assert "1" in data["expression"] # Recognized symbol should match '1'

  # Check SQLite row created
  math_row = db_session.query(MathSession).filter(MathSession.id == math_id).first()
  assert math_row is not None
  assert "1" in math_row.recognized_expression


def test_ai_lab_api_queries(db_session: Session):
  # 1. Fetch active session ID
  sess = db_session.query(SessionModel).filter(SessionModel.session_uuid == "test-math-session-uuid-111").first()
  assert sess is not None

  # 2. Test deterministic command CLEAR
  query_payload = {
    "db_session_id": sess.id,
    "query": "Clear my drawing board workspace",
    "context": {
      "current_module": "CANVAS",
      "canvas_objects": []
    }
  }

  resp = client.post("/api/ai-lab/query", json=query_payload)
  assert resp.status_code == 200
  data = resp.json()
  assert data["status"] == "success"
  assert data["intent"] == "CLEAR"
  assert data["action"] == "execute_command"

  # 3. Test LLM query fallback
  query_payload_llm = {
    "db_session_id": sess.id,
    "query": "What does this drawing look like?",
    "context": {
      "current_module": "CANVAS",
      "selected_object": {"type": "CIRCLE"},
      "canvas_objects": [{"type": "CIRCLE"}]
    }
  }

  resp_llm = client.post("/api/ai-lab/query", json=query_payload_llm)
  assert resp_llm.status_code == 200
  data_llm = resp_llm.json()
  assert data_llm["status"] == "success"
  assert data_llm["action"] == "llm_agent"
  assert "Processing query" in data_llm["response"]
