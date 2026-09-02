import time
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from app.websockets.connection import ConnectionManager
from app.schemas.protocols import ClientMessage, PongMsg, PongPayload, GestureEventMsg, GestureEventPayload
from app.core.database import SessionLocal
from app.models.workspace import GestureEvent, AnalyticsEvent

logger = logging.getLogger("airspace-router")
router = APIRouter()
manager = ConnectionManager()

# Message size limit to prevent oversized data flooding (128 KB is generous for coordinate payloads)
MAX_MESSAGE_BYTES = 128 * 1024

@router.websocket("/ws/spatial")
async def websocket_spatial_endpoint(websocket: WebSocket):
    """
    Real-time spatial interaction WebSocket channel. Pipes coordinate landmarks to the
    CV engine, responds with gesture events, and registers session details.
    """
    # Initialize client context and log session database row
    session = await manager.connect(websocket)
    
    try:
        while True:
            # Receive frame as text to check length bounds before decoding
            data_text = await websocket.receive_text()
            
            if len(data_text.encode("utf-8")) > MAX_MESSAGE_BYTES:
                await manager.send_error("Message size exceeds maximum limit", "MESSAGE_TOO_LARGE", websocket)
                continue

            # Validate structure against defined contracts
            import json
            from app.schemas.protocols import PingMsg, SessionEndMsg, CoordinateStreamMsg
            
            try:
                data = json.loads(data_text)
                msg_type = data.get("type")
                if msg_type == "PING":
                    msg = PingMsg.model_validate(data)
                elif msg_type == "SESSION_END":
                    msg = SessionEndMsg.model_validate(data)
                elif msg_type == "COORDINATE_STREAM":
                    msg = CoordinateStreamMsg.model_validate(data)
                else:
                    raise ValueError(f"Unsupported message type: {msg_type}")
            except ValidationError as ve:
                logger.warning(f"Protocol validation failed: {ve.errors()}")
                await manager.send_error(f"Validation failed: {ve.json()}", "VALIDATION_ERROR", websocket)
                continue
            except Exception as e:
                logger.warning(f"Failed parsing websocket JSON payload: {e}")
                await manager.send_error(f"Invalid JSON format or message type: {str(e)}", "PARSE_ERROR", websocket)
                continue

            # Route message by type
            if msg.type == "PING":
                # Heartbeat pong pingback response
                pong = PongMsg(payload=PongPayload(timestamp=int(time.time() * 1000)))
                await manager.send_message(pong, websocket)
                
            elif msg.type == "SESSION_END":
                # Graceful termination request from client
                logger.info("Graceful teardown requested by client")
                break
                
            elif msg.type == "COORDINATE_STREAM":
                # Pipe coordinates directly into state machine
                update = session.process_landmarks(msg)
                
                # Emit current gesture and cursor position immediately to enable smooth UI cursors
                evt_msg = GestureEventMsg(
                    payload=GestureEventPayload(
                        gesture=update.gesture,
                        coordinates={"x": update.cursor[0], "y": update.cursor[1]},
                        state=update.state
                    )
                )
                await manager.send_message(evt_msg, websocket)

                # Persist to database ONLY on meaningful boundary transitions
                if update.event is not None:
                    session.gesture_count += 1
                    
                    db = SessionLocal()
                    try:
                        db_event = GestureEvent(
                            session_id=session.db_session_id,
                            gesture=update.gesture,
                            state=update.state,
                            confidence=1.0,  # Core gesture classifier output confidence
                            x=update.cursor[0],
                            y=update.cursor[1],
                            timestamp=update.timestamp
                        )
                        db.add(db_event)
                        
                        db_analytics = AnalyticsEvent(
                            session_id=session.db_session_id,
                            event_type="gesture_detected",
                            metadata_json={
                                "gesture": update.gesture,
                                "state": update.state,
                                "event": update.event
                            }
                        )
                        db.add(db_analytics)
                        db.commit()
                    except Exception as e:
                        logger.error(f"Failed to persist gesture event: {e}")
                        db.rollback()
                    finally:
                        db.close()

    except WebSocketDisconnect:
        logger.info("Client disconnected from spatial socket channel")
    except Exception as e:
        logger.error(f"Websocket router error: {e}")
    finally:
        # Update session status, compute durations and teardown
        await manager.disconnect(websocket)
