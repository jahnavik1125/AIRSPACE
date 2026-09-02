import { renderHook, act } from "@testing-library/react";
import { useSpatialWebSocket } from "../hooks/useSpatialWebSocket";

describe("useSpatialWebSocket Hook", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should assert WebSocket initial disconnected states", () => {
    const { result } = renderHook(() => useSpatialWebSocket("ws://localhost:8000/ws/spatial"));
    
    // Initially connecting
    expect(result.current.connected).toBe(false);
    expect(result.current.sessionId).toBeNull();
    expect(result.current.dbSessionId).toBeNull();
  });

  it("should handle connection handshake and update session states", async () => {
    const { result } = renderHook(() => useSpatialWebSocket("ws://localhost:8000/ws/spatial"));

    // Fast-forward timers to trigger mock WebSocket handshake callbacks
    await act(async () => {
      jest.advanceTimersByTime(20);
    });

    // Check states populated by SESSION_START message in jest.setup.js
    expect(result.current.connected).toBe(true);
    expect(result.current.sessionId).toBe("test-uuid-123");
    expect(result.current.dbSessionId).toBe(101);
  });

  it("should handle explicit disconnection", async () => {
    const { result } = renderHook(() => useSpatialWebSocket("ws://localhost:8000/ws/spatial"));

    await act(async () => {
      jest.advanceTimersByTime(20);
    });

    expect(result.current.connected).toBe(true);

    // Call disconnect
    await act(async () => {
      result.current.disconnect();
      jest.advanceTimersByTime(20);
    });

    expect(result.current.connected).toBe(false);
    expect(result.current.sessionId).toBeNull();
    expect(result.current.dbSessionId).toBeNull();
  });

  it("should transmit and validate messages", async () => {
    const sendSpy = jest.spyOn(WebSocket.prototype, 'send').mockImplementation(() => {});
    const { result } = renderHook(() => useSpatialWebSocket("ws://localhost:8000/ws/spatial"));

    await act(async () => {
      jest.advanceTimersByTime(20);
    });

    act(() => {
      result.current.sendMessage({ type: "PING" });
    });

    expect(sendSpy).toHaveBeenCalledWith(JSON.stringify({ type: "PING" }));
  });
});
