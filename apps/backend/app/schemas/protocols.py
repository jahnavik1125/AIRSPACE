from pydantic import BaseModel, Field
from typing import List, Dict, Any, Literal, Optional, Union

# ==============================================================================
# Shared Protocol Structures (Landmarks and Coordinates)
# ==============================================================================

class CoordinateSchema(BaseModel):
    x: float = Field(..., description="Normalized X coordinate (0.0 to 1.0)")
    y: float = Field(..., description="Normalized Y coordinate (0.0 to 1.0)")
    z: float = Field(..., description="Normalized Z depth coordinate")


class HandDataSchema(BaseModel):
    handedness: Literal["Left", "Right"] = Field(..., description="Classification of the hand")
    score: float = Field(..., description="Confidence score from MediaPipe (0.0 to 1.0)")
    landmarks: List[CoordinateSchema] = Field(..., min_length=21, max_length=21, description="21 landmarks list")


# ==============================================================================
# Client -> Server Websocket Payload Specifications
# ==============================================================================

class CoordinateStreamPayload(BaseModel):
    hands: List[HandDataSchema] = Field(..., description="List of detected hands")
    timestamp: int = Field(..., description="Client epoch millisecond timestamp")


class CoordinateStreamMsg(BaseModel):
    type: Literal["COORDINATE_STREAM"] = "COORDINATE_STREAM"
    payload: CoordinateStreamPayload


class PingMsg(BaseModel):
    type: Literal["PING"] = "PING"
    payload: Optional[Dict[str, Any]] = None


class SessionEndMsg(BaseModel):
    type: Literal["SESSION_END"] = "SESSION_END"
    payload: Optional[Dict[str, Any]] = None


# Union type for incoming client message router
ClientMessage = Union[CoordinateStreamMsg, PingMsg, SessionEndMsg]


# ==============================================================================
# Server -> Client Websocket Payload Specifications
# ==============================================================================

class SessionStartPayload(BaseModel):
    session_id: str = Field(..., description="Temporal UUID string mapping the WebSocket session")
    db_session_id: int = Field(..., description="Database row ID of the SessionModel")
    message: str = Field("Session started successfully", description="Informational message")


class SessionStartMsg(BaseModel):
    type: Literal["SESSION_START"] = "SESSION_START"
    payload: SessionStartPayload


class PongPayload(BaseModel):
    timestamp: int = Field(..., description="Server timestamp milliseconds")
    status: str = Field("alive", description="Liveness check status")


class PongMsg(BaseModel):
    type: Literal["PONG"] = "PONG"
    payload: PongPayload


class GestureEventPayload(BaseModel):
    gesture: str = Field(..., description="Primary static gesture name (e.g. PINCH, INDEX_POINT)")
    coordinates: Dict[str, float] = Field(..., description="2D coordinates of cursor: {'x': float, 'y': float}")
    state: str = Field(..., description="Active transition state (e.g. PINCH_START, DRAG)")


class GestureEventMsg(BaseModel):
    type: Literal["GESTURE_EVENT"] = "GESTURE_EVENT"
    payload: GestureEventPayload


class AiOcrResultPayload(BaseModel):
    mode: Literal["HANDWRITING", "MATH_EXPRESSION"] = Field(..., description="OCR classification Mode")
    raw_text: str = Field(..., description="OCR raw text resolution")
    latex: str = Field(..., description="LaTeX formatted string representation")
    confidence: float = Field(..., description="Prediction confidence score")
    canvas_object_id: str = Field(..., description="Client-side canvas object tracker ID")


class AiOcrResultMsg(BaseModel):
    type: Literal["AI_OCR_RESULT"] = "AI_OCR_RESULT"
    payload: AiOcrResultPayload


class ErrorPayload(BaseModel):
    message: str = Field(..., description="Details regarding the server validation error")
    code: str = Field("VALIDATION_ERROR", description="Identifier code of error type")


class ErrorMsg(BaseModel):
    type: Literal["ERROR"] = "ERROR"
    payload: ErrorPayload


class SessionEndServerPayload(BaseModel):
    duration_seconds: float = Field(..., description="Total elapsed seconds of the WebSocket connection")
    gesture_count: int = Field(..., description="Total meaningful gestures saved during session")
    status: str = Field("completed", description="Closing status")


class SessionEndServerMsg(BaseModel):
    type: Literal["SESSION_END"] = "SESSION_END"
    payload: SessionEndServerPayload
