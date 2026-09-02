import time
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, Optional, Tuple
from fastapi import WebSocket
from pydantic import ValidationError

from cv_core.detector import DetectionResult, Hand, Landmark
from cv_core.gestures import GestureStateMachine, GestureStateUpdate
from app.core.database import SessionLocal
from app.models.workspace import SessionModel, GestureEvent, AnalyticsEvent
from app.schemas.protocols import (
    CoordinateStreamMsg,
    ClientMessage,
    SessionStartMsg,
    SessionStartPayload,
    PongMsg,
    PongPayload,
    ErrorMsg,
    ErrorPayload,
    GestureEventMsg,
    GestureEventPayload,
    SessionEndServerMsg,
    SessionEndServerPayload
)

logger = logging.getLogger("airspace-websockets")

# ==============================================================================
# Isolated Client Session Tracker
# ==============================================================================

class ClientSession:
    """
    Tracks coordinate smoothing and gesture state machines in isolation for a single client connection.
    """
    def __init__(self, db_session_id: int):
        self.session_uuid = str(uuid.uuid4())
        self.db_session_id = db_session_id
        self.state_machine = GestureStateMachine()
        self.start_time = time.time()
        self.gesture_count = 0

    def process_landmarks(self, msg: CoordinateStreamMsg) -> GestureStateUpdate:
        """
        Converts client landmark schemas into detector frames and runs the gesture state machine.
        """
        hands_list = []
        for hand_data in msg.payload.hands:
            landmarks = [Landmark(x=lm.x, y=lm.y, z=lm.z) for lm in hand_data.landmarks]
            hands_list.append(Hand(
                handedness=hand_data.handedness,
                score=hand_data.score,
                landmarks=landmarks
            ))

        detection = DetectionResult(
            timestamp=msg.payload.timestamp,
            hands=hands_list,
            processing_time_ms=0.0  # Backend processing time check
        )

        # Drive state machine
        update = self.state_machine.update(detection)
        return update


# ==============================================================================
# WebSocket Connection & Persistence Manager
# ==============================================================================

class ConnectionManager:
    """
    Tracks and manages live WebSockets, validating client frames and persisting session records.
    """
    def __init__(self):
        # Maps raw socket connections to their isolated ClientSession context
        self.active_sessions: Dict[WebSocket, ClientSession] = {}

    async def connect(self, websocket: WebSocket) -> ClientSession:
        """
        Accepts connection, registers a new session row in DB, and responds with start payload.
        """
        await websocket.accept()
        
        # 1. Create a persistent SessionModel in PostgreSQL
        session_uuid = str(uuid.uuid4())
        db = SessionLocal()
        db_session_id = None
        try:
            db_session = SessionModel(
                session_uuid=session_uuid,
                start_time=datetime.now(timezone.utc),
                status="active"
            )
            db.add(db_session)
            
            # Log session start analytics event
            db_analytics = AnalyticsEvent(
                session_id=None,  # Will link after commit
                event_type="session_started",
                metadata_json={"uuid": session_uuid}
            )
            db.add(db_analytics)
            db.commit()
            
            db_session_id = db_session.id
            db_analytics.session_id = db_session_id
            db.commit()
        except Exception as e:
            logger.error(f"Failed to record session startup: {e}")
            db.rollback()
        finally:
            db.close()

        # 2. Bind WebSocket connection to the ClientSession instance
        client_session = ClientSession(db_session_id=db_session_id or 0)
        client_session.session_uuid = session_uuid
        self.active_sessions[websocket] = client_session
        
        # 3. Respond with SESSION_START protocol validation schema
        start_msg = SessionStartMsg(
            payload=SessionStartPayload(
                session_id=session_uuid,
                db_session_id=db_session_id or 0
            )
        )
        await self.send_message(start_msg, websocket)
        logger.info(f"Spatial session successfully registered: UUID={session_uuid}, ID={db_session_id}")
        
        return client_session

    async def disconnect(self, websocket: WebSocket):
        """
        Cleans up connection session, updating duration and counts in the DB.
        """
        if websocket not in self.active_sessions:
            return

        session = self.active_sessions[websocket]
        duration = time.time() - session.start_time
        
        # Update session completion statistics in DB
        db = SessionLocal()
        try:
            db_session = db.query(SessionModel).filter(SessionModel.id == session.db_session_id).first()
            if db_session:
                db_session.end_time = datetime.now(timezone.utc)
                db_session.duration = duration
                db_session.gesture_count = session.gesture_count
                db_session.status = "completed"
                
                # Add session ended analytics
                db_analytics = AnalyticsEvent(
                    session_id=session.db_session_id,
                    event_type="session_ended",
                    metadata_json={"duration_sec": duration, "gestures": session.gesture_count}
                )
                db.add(db_analytics)
                db.commit()
        except Exception as e:
            logger.error(f"Failed to record session shutdown statistics: {e}")
            db.rollback()
        finally:
            db.close()

        # Send closing payload (try/catch to handle sockets that disconnected abruptly)
        try:
            close_msg = SessionEndServerMsg(
                payload=SessionEndServerPayload(
                    duration_seconds=duration,
                    gesture_count=session.gesture_count,
                    status="completed"
                )
            )
            await websocket.send_json(close_msg.model_dump())
        except Exception:
            pass

        # Cleanup dictionary key
        del self.active_sessions[websocket]
        logger.info(f"Closed spatial session: UUID={session.session_uuid}")

    async def send_message(self, message: BaseModel, websocket: WebSocket):
        """
        Serializes and transmits Pydantic model payloads.
        """
        try:
            # model_dump() is standard Pydantic v2 syntax
            await websocket.send_json(message.model_dump())
        except Exception as e:
            logger.error(f"Failed to transmit websocket frame: {e}")

    async def send_error(self, message: str, code: str, websocket: WebSocket):
        """
        Transmits a protocol error frame.
        """
        err = ErrorMsg(payload=ErrorPayload(message=message, code=code))
        await self.send_message(err, websocket)
