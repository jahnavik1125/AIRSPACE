# AIRSPACE Shared Assets & Protocols (`shared`)

This directory holds common contracts and message format specifications shared between the frontend (TypeScript/Next.js) and backend (Python/FastAPI) environments.

---

## 📡 Message Protocol Specifications

All real-time communication events over WebSockets utilize standardized schemas defined in [`protocols/messages.json`](file:///c:/Users/jahna/OneDrive/Desktop/AIRSPACE/packages/shared/protocols/messages.json):

### Client-to-Server Messages
* **`COORDINATE_STREAM`**: Normalized hand landmarks coords stream transmitted at high frequency.
* **`PING`**: Client-side connection liveness heartbeat checker.
* **`SESSION_END`**: Explicit graceful connection shutdown trigger.

### Server-to-Client Messages
* **`SESSION_START`**: Emitted once on handshake connection success, returning UUIDs and database row mappings.
* **`PONG`**: Heartbeat pong reply from backend.
* **`GESTURE_EVENT`**: Active posture states and coordinates transmitted on every frame.
* **`AI_OCR_RESULT`**: Handwriting and equation recognition resolution returned from OCR engines.
* **`ERROR`**: Server-side validation or parsing error descriptions.
