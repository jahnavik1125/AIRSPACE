# AIRSPACE: Touchless Spatial Human-Computer Interaction Platform

AIRSPACE is a portfolio-grade, full-stack monorepo application that transforms a standard webcam feed into a touchless human-computer interface.

---

## 🚀 Feature Overview

1. **Air Write (`/air-write`)**: Captures fingertip writing trajectories, segments stroke paths, and classifies characters using a Dynamic Time Warping (DTW) recognition baseline.
2. **Air Canvas (`/canvas`)**: Interactive spatial sketching board supporting brush tools, vector selections, drag/drop adjustments, and geometric shape classification.
3. **Math Mode (`/math`)**: Spatial handwriting formula solver that evaluates math equations and displays interactive graph curves.
4. **AI Lab (`/ai-lab`)**: Context-aware chat hub incorporating canvas objects and hand-tracking metadata to parse natural language instructions.
5. **Analytics Dashboard (`/analytics`)**: Aggregates interaction telemetry charts including gesture distributions, FPS performance, latency, and canvas operations.
6. **Guided Calibration (`/settings`)**: Custom profile builder matching users' hand size and joint thresholds.

---

## 🎨 Screenshot Placeholders
*(Include visual previews of spatial gestures tracking and interactive canvases here)*

---

## 🏢 Technology Stack & Architecture

- **Frontend**: Next.js 14, React 18, Tailwind CSS, Lucide icons, Chart.js, HTML5 Canvas.
- **Client Hand Tracking**: MediaPipe JS Hands (WASM core executed client-side).
- **Backend API**: FastAPI, Uvicorn, Python 3.10+, WebSockets.
- **ORM & Migrations**: SQLAlchemy, Alembic.
- **Database**: PostgreSQL 15 (Docker containerized).
- **CV/AI Engines**: Custom packages (`packages/cv` and `packages/ai`) incorporating NumPy, SciPy, and PyTorch skeletons.

---

## 📂 Project Structure

```
AIRSPACE/
  ├── apps/
  │   ├── frontend/             # Next.js frontend application
  │   └── backend/              # FastAPI backend API & WebSockets server
  ├── packages/
  │   ├── cv/                   # Computer Vision Core landmarks engines
  │   ├── ai/                   # AI algorithms, DTW recognizer, & OCR
  │   └── shared/               # Shared communication message schemas
  ├── docs/                     # Product, Architecture, & Security docs
  ├── scripts/                  # Setup, testing, and dev environment runners
  ├── docker-compose.prod.yml   # Production Compose orchestration
  └── README.md                 # Main workspace documentation
```

---

## ⚙️ Environment Variables

Copy `.env.example` at the root directory to `.env` and fill in parameters:

```ini
# Backend host & Port configuration
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
BACKEND_CORS_ORIGINS=["http://localhost:3000"]
ENVIRONMENT=production

# Database Credentials
POSTGRES_USER=postgres
POSTGRES_PASSWORD=replace_with_secure_production_password
POSTGRES_DB=airspace
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# Frontend Endpoint Hooks
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws/spatial
```

---

## 🛠️ Local Development Setup

### 1. Prerequisite Installations
Ensure Node.js (v18+) and Python (v3.10+) are installed.

### 2. System Initialization
Run the setup script to establish Python virtual environment, link CV/AI packages, and install Node modules:
```powershell
./scripts/setup.ps1
```

### 3. Database Bootstrap
Run Alembic database migrations:
```powershell
cd apps/backend
alembic upgrade head
```

### 4. Running the Dev Stack
To run backend APIs, frontend servers, and databases concurrently:
```powershell
./scripts/dev.ps1 -Service All
```

---

## 🐳 Production Docker Orchestration

Build and boot the entire platform (Next.js production bundle, FastAPI server, and PostgreSQL volumes) using Docker Compose:

```powershell
docker compose -f docker-compose.prod.yml up --build
```

---

## 🧪 Monorepo Test Commands

To execute Backend, CV, AI, and Frontend test suites concurrently:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test.ps1
```

---

## ⚙️ AI Provider Configurations
By default, AIRSPACE uses localized DTW models and custom mathematical scripts for classification. To connect advanced handwriting OCR engines and LLM resolvers, inject:
`AIRSPACE_AI_API_KEY=your_key` into the environment configuration. If omitted, the system falls back to its local rule-based pipelines.

---

## 🔒 Privacy & Data Policy
AIRSPACE processes video inputs strictly client-side inside the user's browser using MediaPipe WASM. No webcam images, audio streams, or raw frames are sent to the backend or saved to database storage. Personalization calibrations and metric logs can be permanently deleted under **Settings -> Purge History**.

---

## ⚠️ Limitations & Future Work
- **Handwriting recognition**: Current DTW algorithm maps single character strokes. Deep Learning models (CNN-BiGRU) are experimental.
- **Hardware constraints**: Optimal performance requires 30 FPS camera capture and adequate ambient lighting.

---

## 🤝 Contributing
Contributions are welcome! Please follow formatting conventions and ensure all test suites pass.

---

## 📄 License
This project is released under the MIT License placeholder.
