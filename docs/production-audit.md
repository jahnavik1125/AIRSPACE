# AIRSPACE Production Audit Report

This report identifies configurations, dependencies, ports, and credentials that require hardening for production deployment.

---

## 1. Identified Issues & Severity

| Issue | Severity | Location | Recommended Fix | Status |
| :--- | :--- | :--- | :--- | :--- |
| Hardcoded API URL `http://localhost:8000` | High | Frontend Pages (`ai-lab`, `air-write`, `analytics`, `canvas`, `math`, `settings`, `context`) | Replace with `process.env.NEXT_PUBLIC_API_URL` environment variables fallbacks. | Open |
| Hardcoded WebSocket URL `ws://localhost:8000/ws/spatial` | High | Frontend Hook `useSpatialWebSocket.ts` | Retrieve dynamic URL from `process.env.NEXT_PUBLIC_WS_URL` or window location. | Open |
| Hardcoded Development Password `postgres_secure_pass` | Medium | Backend config `core/config.py` | Overwrite using environment variable `POSTGRES_PASSWORD` injections. | Open |
| CORS Allowed Origins hardcoded in settings default list | Medium | Backend config `core/config.py` | Enforce configuring custom CORS whitelist via `BACKEND_CORS_ORIGINS`. | Open |
| SQLite test database fallback used in dev | Low | Backend database setup `core/database.py` | Ensure production database is strictly PostgreSQL inside Docker. | Open |
| Missing Production Docker / Compose Orchestrations | High | Root directory | Create multi-stage production Dockerfiles and `docker-compose.prod.yml`. | Open |

---

## 2. Environment Variables Mapping

We will establish three configuration levels:
1. **Root**: `.env.example`
2. **Backend**: `apps/backend/.env.example`
3. **Frontend**: `apps/frontend/.env.example`

---

## 3. Audited Components Status
* **Webcam Feed**: Local browser API captures raw data; webcam images are never serialized or sent to backend.
* **Hand Tracking**: MediaPipe WASM model is executed in client threads locally.
* **Alembic Migrations**: Fully configured and imported through environment DB URLs.
