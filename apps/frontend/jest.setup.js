import '@testing-library/jest-dom';

// ==============================================================================
// Mock browser MediaDevices API
// ==============================================================================
const mockStream = {
  getTracks: () => [
    {
      stop: jest.fn(),
      enabled: true,
    }
  ]
};

const mockMediaDevices = {
  getUserMedia: jest.fn().mockResolvedValue(mockStream),
  enumerateDevices: jest.fn().mockResolvedValue([
    { kind: 'videoinput', label: 'Webcam 1', deviceId: 'cam-1' },
    { kind: 'videoinput', label: 'FaceTime HD Camera', deviceId: 'cam-2' }
  ]),
};

Object.defineProperty(navigator, 'mediaDevices', {
  value: mockMediaDevices,
  writable: true,
  configurable: true
});

// ==============================================================================
// Mock ResizeObserver
// ==============================================================================
class MockResizeObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}
global.ResizeObserver = MockResizeObserver;

// ==============================================================================
// Mock Canvas 2D Context
// ==============================================================================
HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
  clearRect: jest.fn(),
  scale: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  stroke: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn(),
  drawImage: jest.fn(),
  fillText: jest.fn(),
});

// ==============================================================================
// Mock WebSocket Client
// ==============================================================================
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  onopen = null;
  onclose = null;
  onerror = null;
  onmessage = null;
  readyState = 0; // CONNECTING

  constructor(url) {
    this.url = url;
    MockWebSocket.lastInstance = this;
    
    // Simulate async connection handshake
    setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) {
        this.onopen({});
      }
      
      // Emit initial SESSION_START
      if (this.onmessage) {
        this.onmessage({
          data: JSON.stringify({
            type: "SESSION_START",
            payload: {
              session_id: "test-uuid-123",
              db_session_id: 101,
              message: "Mock session active"
            }
          })
        });
      }
    }, 10);
  }

  send(data) {
    try {
      const msg = JSON.parse(data);
      if (msg.type === "PING") {
        setTimeout(() => {
          if (this.onmessage) {
            this.onmessage({
              data: JSON.stringify({
                type: "PONG",
                payload: { timestamp: Date.now(), status: "alive" }
              })
            });
          }
        }, 5);
      }
    } catch (e) {}
  }

  close() {
    this.readyState = 3; // CLOSED
    setTimeout(() => {
      if (this.onclose) {
        this.onclose({});
      }
    }, 5);
  }
}

global.WebSocket = MockWebSocket;
