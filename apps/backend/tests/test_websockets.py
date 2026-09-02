import time
import pytest
from fastapi.testclient import TestClient
from main import app
from app.core.database import SessionLocal
from app.models.workspace import SessionModel, GestureEvent, AnalyticsEvent

# ==============================================================================
# Helper Mock Messages
# ==============================================================================

def make_mock_coord_stream(pose: str = "OPEN_PALM", ts: int = 0) -> dict:
    """
    Generates a mock Client JSON payload matching CoordinateStreamMsg structures.
    """
    # 21 nodes list
    landmarks = [{"x": 0.5, "y": 0.5, "z": 0.0} for _ in range(21)]
    landmarks[0] = {"x": 0.5, "y": 0.9, "z": 0.0}   # Wrist
    landmarks[9] = {"x": 0.5, "y": 0.5, "z": 0.0}   # Middle MCP (palm size reference = 0.4)

    # Folded defaults
    for pip, dip, tip in [(6, 7, 8), (10, 11, 12), (14, 15, 16), (18, 19, 20)]:
        landmarks[pip] = {"x": landmarks[pip - 1]["x"], "y": 0.45, "z": 0.0}
        landmarks[dip] = {"x": landmarks[pip - 1]["x"], "y": 0.48, "z": 0.0}
        landmarks[tip] = {"x": landmarks[pip - 1]["x"], "y": 0.50, "z": 0.0}

    # Thumb folded
    landmarks[4] = {"x": 0.44, "y": 0.55, "z": 0.0}

    if pose == "OPEN_PALM":
        # All extended
        landmarks[4] = {"x": 0.2, "y": 0.7, "z": 0.0} # Thumb tip
        
        # Extend Index
        landmarks[6] = {"x": 0.4, "y": 0.4, "z": 0.0}
        landmarks[8] = {"x": 0.4, "y": 0.2, "z": 0.0}
        # Extend Middle
        landmarks[10] = {"x": 0.5, "y": 0.4, "z": 0.0}
        landmarks[12] = {"x": 0.5, "y": 0.2, "z": 0.0}
        # Extend Ring
        landmarks[14] = {"x": 0.6, "y": 0.4, "z": 0.0}
        landmarks[16] = {"x": 0.6, "y": 0.2, "z": 0.0}
        # Extend Pinky
        landmarks[18] = {"x": 0.7, "y": 0.4, "z": 0.0}
        landmarks[20] = {"x": 0.7, "y": 0.2, "z": 0.0}

    elif pose == "PINCH":
        # Thumb and Index tip touching
        landmarks[4] = {"x": 0.45, "y": 0.40, "z": 0.0}
        landmarks[8] = {"x": 0.46, "y": 0.41, "z": 0.0}

    return {
        "type": "COORDINATE_STREAM",
        "payload": {
            "hands": [
                {
                    "handedness": "Right",
                    "score": 0.95,
                    "landmarks": landmarks
                }
            ],
            "timestamp": ts or int(time.time() * 1000)
        }
    }


# ==============================================================================
# Integration Tests
# ==============================================================================

def test_websocket_connection_handshake():
    client = TestClient(app)
    with client.websocket_connect("/ws/spatial") as websocket:
        # First message must be SESSION_START
        data = websocket.receive_json()
        assert data["type"] == "SESSION_START"
        assert "session_id" in data["payload"]
        assert "db_session_id" in data["payload"]
        
        # Verify Session model was created in DB
        db = SessionLocal()
        try:
            db_session = db.query(SessionModel).filter(SessionModel.id == data["payload"]["db_session_id"]).first()
            assert db_session is not None
            assert db_session.status == "active"
            assert db_session.session_uuid == data["payload"]["session_id"]
        finally:
            db.close()


def test_websocket_ping_pong():
    client = TestClient(app)
    with client.websocket_connect("/ws/spatial") as websocket:
        websocket.receive_json() # Consume SESSION_START
        
        # Send PING
        websocket.send_json({"type": "PING"})
        
        # Consume PONG
        data = websocket.receive_json()
        assert data["type"] == "PONG"
        assert "timestamp" in data["payload"]
        assert data["payload"]["status"] == "alive"


def test_websocket_invalid_message_validation():
    client = TestClient(app)
    with client.websocket_connect("/ws/spatial") as websocket:
        websocket.receive_json() # Consume SESSION_START
        
        # Send malformed coordinates stream (e.g. wrong type or fields)
        websocket.send_json({"type": "COORDINATE_STREAM", "payload": {}})
        
        # Server must respond with validation ERROR
        data = websocket.receive_json()
        assert data["type"] == "ERROR"
        assert data["payload"]["code"] == "VALIDATION_ERROR"

        # Send invalid JSON syntax text
        websocket.send_text("mangled_json_format")
        data = websocket.receive_json()
        assert data["type"] == "ERROR"
        assert data["payload"]["code"] == "PARSE_ERROR"


def test_websocket_coordinate_processing_and_persistence():
    client = TestClient(app)
    db_sess_id = None
    
    with client.websocket_connect("/ws/spatial") as websocket:
        start_payload = websocket.receive_json() # Consume SESSION_START
        db_sess_id = start_payload["payload"]["db_session_id"]

        # Send 2 frames of PINCH (state machine debounce is 3 frames)
        for i in range(2):
            msg = make_mock_coord_stream("PINCH", ts=1000 + (i * 33))
            websocket.send_json(msg)
            resp = websocket.receive_json()
            assert resp["type"] == "GESTURE_EVENT"
            assert resp["payload"]["state"] == "HOVER"  # Debouncing, still Hovering

        # 3rd Frame: Debounce triggers PINCH_START event!
        msg = make_mock_coord_stream("PINCH", ts=1066)
        websocket.send_json(msg)
        resp = websocket.receive_json()
        
        assert resp["type"] == "GESTURE_EVENT"
        assert resp["payload"]["gesture"] == "PINCH"
        assert resp["payload"]["state"] == "PINCH_START"

        # Verify that the gesture event was persisted to SQLite on the 3rd frame
        db = SessionLocal()
        try:
            # Check gesture event row
            events = db.query(GestureEvent).filter(GestureEvent.session_id == db_sess_id).all()
            assert len(events) == 1
            assert events[0].gesture == "PINCH"
            assert events[0].state == "PINCH_START"
            
            # Check analytics event row
            analytics = db.query(AnalyticsEvent).filter(AnalyticsEvent.session_id == db_sess_id).all()
            # Contains "session_started" + "gesture_detected" (2 total)
            assert len(analytics) >= 2
            assert any(a.event_type == "gesture_detected" for a in analytics)
        finally:
            db.close()

        # Send 4th Frame: Holds the pinch -> PINCH_HOLD
        msg = make_mock_coord_stream("PINCH", ts=1100)
        websocket.send_json(msg)
        resp = websocket.receive_json()
        assert resp["type"] == "GESTURE_EVENT"
        assert resp["payload"]["state"] == "PINCH_HOLD"

        # Verify that PINCH_HOLD (continuous state) did not write a new GestureEvent row
        db = SessionLocal()
        try:
            events = db.query(GestureEvent).filter(GestureEvent.session_id == db_sess_id).all()
            assert len(events) == 1  # Still only the PINCH_START row exists!
        finally:
            db.close()

    # Verify connection teardown updates Session table status to "completed"
    db = SessionLocal()
    try:
        db_session = db.query(SessionModel).filter(SessionModel.id == db_sess_id).first()
        assert db_session.status == "completed"
        assert db_session.duration > 0.0
        assert db_session.gesture_count == 1
    finally:
        db.close()


def test_session_isolation_multiple_clients():
    client = TestClient(app)
    
    # Establish Client A
    with client.websocket_connect("/ws/spatial") as ws_a:
        payload_a = ws_a.receive_json() # SESSION_START A
        
        # Establish Client B
        with client.websocket_connect("/ws/spatial") as ws_b:
            payload_b = ws_b.receive_json() # SESSION_START B
            
            assert payload_a["payload"]["session_id"] != payload_b["payload"]["session_id"]
            
            # Client A performs a pinch stream
            for i in range(3):
                ws_a.send_json(make_mock_coord_stream("PINCH", ts=1000 + (i * 33)))
                ws_a.receive_json() # Consume GESTURE_EVENT for client A

            # Client B sends an open palm coordinate stream
            ws_b.send_json(make_mock_coord_stream("OPEN_PALM", ts=1100))
            resp_b = ws_b.receive_json()
            
            # Verify B state is HOVER and gesture is OPEN_PALM (unaffected by A's pinch)
            assert resp_b["type"] == "GESTURE_EVENT"
            assert resp_b["payload"]["gesture"] == "OPEN_PALM"
            assert resp_b["payload"]["state"] == "HOVER"
            
            # Verify database count isolation
            db = SessionLocal()
            try:
                db_a = db.query(SessionModel).filter(SessionModel.id == payload_a["payload"]["db_session_id"]).first()
                # A still active inside context, we close ws_a now to complete it
            finally:
                db.close()
