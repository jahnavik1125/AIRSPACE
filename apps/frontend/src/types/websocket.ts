import { DetectedHand } from "./spatial";

// ==============================================================================
// Client -> Server Protocol Types
// ==============================================================================

export interface CoordinateStreamMsg {
  type: "COORDINATE_STREAM";
  payload: {
    hands: DetectedHand[];
    timestamp: number;
  };
}

export interface PingMsg {
  type: "PING";
  payload?: Record<string, any>;
}

export interface SessionEndMsg {
  type: "SESSION_END";
  payload?: Record<string, any>;
}

export type ClientMessage = CoordinateStreamMsg | PingMsg | SessionEndMsg;


// ==============================================================================
// Server -> Client Protocol Types
// ==============================================================================

export interface SessionStartMsg {
  type: "SESSION_START";
  payload: {
    session_id: string;
    db_session_id: number;
    message: string;
  };
}

export interface PongMsg {
  type: "PONG";
  payload: {
    timestamp: number;
    status: string;
  };
}

export interface GestureEventMsg {
  type: "GESTURE_EVENT";
  payload: {
    gesture: string;
    coordinates: { x: number; y: number };
    state: string; // e.g. "HOVER", "PINCH_START", "DRAG", "PINCH_END"
  };
}

export interface ErrorMsg {
  type: "ERROR";
  payload: {
    message: string;
    code: string;
  };
}

export interface SessionEndServerMsg {
  type: "SESSION_END";
  payload: {
    duration_seconds: number;
    gesture_count: number;
    status: string;
  };
}

export type ServerMessage =
  | SessionStartMsg
  | PongMsg
  | GestureEventMsg
  | ErrorMsg
  | SessionEndServerMsg;
