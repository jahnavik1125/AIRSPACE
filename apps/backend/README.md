# AIRSPACE Core Backend Service (`backend`)

This FastAPI application orchestrates WebSocket coordinate processing, database session logs, and spatial interaction API routes.

---

## 📡 WebSockets Channel

* **Endpoint**: `/ws/spatial`
* **Protocol Schema Contracts**: Validated using Pydantic schemas mapped from `packages/shared/protocols/messages.json`.
* **State Isolation**: Each connection instantiates a unique `ClientSession` holding independent coordinate history, smoothing filters, and `GestureStateMachine` states.

### WebSocket Communication Lifecycle

1. **Connection Handshake**:
   * Client establishes socket connection to `/ws/spatial`.
   * Server creates a new session row in the database, generating a primary key `db_session_id`.
   * Server sends `SESSION_START` protocol frame:
     ```json
     {
       "type": "SESSION_START",
       "payload": {
         "session_id": "uuid-string-identifier",
         "db_session_id": 42,
         "message": "Session started successfully"
       }
     }
     ```
2. **Interactive coordinate feed**:
   * Client transmits 21 hand landmarks at ~30 FPS:
     ```json
     {
       "type": "COORDINATE_STREAM",
       "payload": {
         "hands": [
           {
             "handedness": "Right",
             "score": 0.98,
             "landmarks": [{"x": 0.5, "y": 0.5, "z": 0.0}, ...]
           }
         ],
         "timestamp": 1690000000000
       }
     }
     ```
   * Server filters, smooths coordinates, and drives state machines.
   * Server replies to the client on every frame with current coordinates, action state, and posture classifications to support real-time cursor updates:
     ```json
     {
       "type": "GESTURE_EVENT",
       "payload": {
         "gesture": "PINCH",
         "coordinates": {"x": 0.45, "y": 0.42},
         "state": "PINCH_HOLD"
       }
     }
     ```
3. **Database Logging (Throttled)**:
   * Real-time coordinates are NOT persisted to save disk usage and minimize DB write bottlenecks.
   * Database writes are triggered strictly when state changes occur (i.e. `update.event` is not null, e.g. `PINCH_START`, `PINCH_END`, or `SWIPE`).
4. **Heartbeat and Termination**:
   * Client can send `PING` messages, and the server replies with `PONG`.
   * Connection terminates gracefully if the client sends `SESSION_END` or breaks the WebSocket connection.
   * Server computes session duration and updates the database session status to `"completed"`.

---

## 🗄️ Database Schema & Models

SQLAlchemy models are defined in `app/models/workspace.py`:

* **`users`**: Simple user table (baseline framework for auth).
* **`sessions`**: Tracks connection metadata, durations, status, and gesture totals.
* **`gesture_events`**: Stores meaningful gesture coordinate and state changes.
* **`air_writing_sessions` & `air_writing_samples`**: Prepares coordinate storage tables for the OCR engine.
* **`drawings`**: Stores canvas drawings as SVG text.
* **`analytics_events`**: Relational event log tracking user interaction benchmarks.

---

## 🚀 Database Migrations (Alembic)

We use Alembic to manage schemas. Migration commands are executed from `apps/backend/` directory:

```powershell
# Create an auto-generated migration script comparing models against active DB
alembic revision --autogenerate -m "description_of_changes"

# Execute all pending migrations (upgrades DB to latest revision)
alembic upgrade head

# Rollback last executed migration
alembic downgrade -1

# Show migration version history logs
alembic history --verbose

# Check current database revision status
alembic current
```

---

## 💻 Local Development Commands

Ensure you run these scripts from the workspace **root directory**:

```powershell
# 1. Start local database service
./scripts/dev.ps1 -Service Db

# 2. Launch FastAPI API server (starts on http://localhost:8000)
./scripts/dev.ps1 -Service Backend
```
