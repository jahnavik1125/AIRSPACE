import logging

from app.core.config import settings
from app.core.database import get_db
from fastapi import Depends, FastAPI, WebSocket, WebSocketDisconnect, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

# Check internal monorepo packages presence
try:
    import cv_core

    CV_STATUS = "installed"
except ImportError:
    CV_STATUS = "missing"

try:
    import ai_core

    AI_STATUS = "installed"
except ImportError:
    AI_STATUS = "missing"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("airspace-backend")

app = FastAPI(
    title="AIRSPACE API",
    description="Backend API for the AI-Powered Spatial Interaction Platform",
    version="0.1.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
@app.get("/api/health")
def health_check(response: Response, db: Session = Depends(get_db)):
    db_status = "disconnected"
    try:
        # Check database connectivity
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        db_status = f"error: {str(e)}"

    is_healthy = (
        CV_STATUS == "installed"
        and AI_STATUS == "installed"
    )

    return {
        "status": "healthy" if (is_healthy and db_status == "connected") else "degraded",
        "backend": "online",
        "database": db_status,
        "version": "0.1.0",
        "packages": {"cv": CV_STATUS, "ai": AI_STATUS},
    }


from app.websockets.router import router
from app.api.airwrite import router as airwrite_router
from app.api.canvas import router as canvas_router
from app.api.math import router as math_router
from app.api.ailab import router as ailab_router
from app.api.analytics import router as analytics_router
from app.api.calibration import router as calibration_router

app.include_router(router)
app.include_router(airwrite_router)
app.include_router(canvas_router)
app.include_router(math_router)
app.include_router(ailab_router)
app.include_router(analytics_router)
app.include_router(calibration_router)
