import { useState, useEffect, useRef, useCallback } from "react";
import { ClientMessage, ServerMessage, GestureEventMsg } from "../types/websocket";

const RECONNECT_INITIAL_DELAY = 1000;
const RECONNECT_MAX_DELAY = 10000;
const HEARTBEAT_INTERVAL = 5000;

const getWebSocketUrl = (): string => {
  if (typeof window === "undefined") {
    return "ws://localhost:8000/ws/spatial";
  }

  let configuredUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/spatial";
  
  // Dynamic replacement for secure protocol if window is loaded on HTTPS
  if (window.location.protocol === "https:") {
    configuredUrl = configuredUrl.replace(/^ws:\/\//i, "wss://");
  }

  // Ensure path ends with /spatial
  if (!configuredUrl.endsWith("/spatial")) {
    if (configuredUrl.endsWith("/ws")) {
      configuredUrl = `${configuredUrl}/spatial`;
    } else {
      configuredUrl = configuredUrl.endsWith("/") 
        ? `${configuredUrl}ws/spatial` 
        : `${configuredUrl}/ws/spatial`;
    }
  }

  return configuredUrl;
};

const defaultWsUrl = getWebSocketUrl();

export function useSpatialWebSocket(url = defaultWsUrl) {
  const [connected, setConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [dbSessionId, setDbSessionId] = useState<number | null>(null);
  const [lastGesture, setLastGesture] = useState<GestureEventMsg["payload"] | null>(null);
  
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef(RECONNECT_INITIAL_DELAY);
  const heartbeatTimerRef = useRef<any>(null);
  const explicitCloseRef = useRef(false);

  const sendMessage = useCallback((msg: ClientMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const connect = useCallback(() => {
    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.CONNECTING ||
        socketRef.current.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    explicitCloseRef.current = false;
    
    try {
      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log("WebSocket connection established to:", url);
        setConnected(true);
        reconnectDelayRef.current = RECONNECT_INITIAL_DELAY; // Reset backoff delay

        // Start heartbeat ping loop
        if (heartbeatTimerRef.current) {
          clearInterval(heartbeatTimerRef.current);
        }
        heartbeatTimerRef.current = setInterval(() => {
          sendMessage({ type: "PING" });
        }, HEARTBEAT_INTERVAL);
      };

      socket.onmessage = (event) => {
        try {
          const data: ServerMessage = JSON.parse(event.data);
          
          switch (data.type) {
            case "SESSION_START":
              setSessionId(data.payload.session_id);
              setDbSessionId(data.payload.db_session_id);
              break;
              
            case "GESTURE_EVENT":
              setLastGesture(data.payload);
              break;
              
            case "SESSION_END":
              console.log("Session complete metadata returned:", data.payload);
              break;
              
            case "ERROR":
              console.error("Server error frame received:", data.payload.message);
              break;
              
            case "PONG":
              // Heartbeat check acknowledged by server
              break;
          }
        } catch (err) {
          console.error("Failed to parse server websocket payload:", err);
        }
      };

      socket.onerror = (err) => {
        console.error("WebSocket transport error:", err);
        setConnected(false);
      };

      socket.onclose = (event) => {
        setConnected(false);
        setSessionId(null);
        setDbSessionId(null);

        if (heartbeatTimerRef.current) {
          clearInterval(heartbeatTimerRef.current);
          heartbeatTimerRef.current = null;
        }

        // Auto-reconnect with backoff unless connection was explicitly closed
        if (!explicitCloseRef.current) {
          console.log(`WebSocket disconnected. Retrying in ${reconnectDelayRef.current}ms...`);
          setTimeout(() => {
            reconnectDelayRef.current = Math.min(
              reconnectDelayRef.current * 1.5,
              RECONNECT_MAX_DELAY
            );
            connect();
          }, reconnectDelayRef.current);
        }
      };
    } catch (err) {
      console.error("Failed to initiate WebSocket connection:", err);
    }
  }, [url, sendMessage]);

  const disconnect = useCallback(() => {
    explicitCloseRef.current = true;
    if (socketRef.current) {
      if (socketRef.current.readyState === WebSocket.OPEN) {
        sendMessage({ type: "SESSION_END" });
      }
      socketRef.current.close();
      socketRef.current = null;
    }
    setConnected(false);
    setSessionId(null);
    setDbSessionId(null);
    setLastGesture(null);
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, [sendMessage]);

  // Connect on initialization
  useEffect(() => {
    connect();

    return () => {
      // Cleanup on unmount
      if (socketRef.current) {
        if (socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: "SESSION_END" }));
        }
        socketRef.current.close();
      }
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
      }
    };
  }, [connect]);

  return {
    connected,
    sessionId,
    dbSessionId,
    lastGesture,
    sendMessage,
    connect,
    disconnect
  };
}
export type UseSpatialWebSocketReturn = ReturnType<typeof useSpatialWebSocket>;
