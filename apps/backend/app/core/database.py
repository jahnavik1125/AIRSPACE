from app.core.config import settings
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

import sys

# Create DB Engine using our settings
SQLALCHEMY_DATABASE_URL = settings.get_db_url()

# Auto-detect testing context or SQLite URL fallback
is_testing = "pytest" in sys.modules or SQLALCHEMY_DATABASE_URL.startswith("sqlite")

if is_testing:
    SQLALCHEMY_DATABASE_URL = "sqlite:///test_temp.db"
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        pool_pre_ping=True,  # Liveness test on connection retrieval
        pool_size=5,
        max_overflow=10,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """
    FastAPI dependency yielding a database session and closing it on request completion.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
