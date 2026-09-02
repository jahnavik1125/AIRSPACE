import os
import pytest
from app.core.database import Base, engine
import app.models

@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """
    Automatically creates all table schemas in the SQLite database before
    tests run and drops them upon completion.
    """
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    
    # Clean up test database file
    try:
        # Check both local and parent directories depending on pytest cwd
        for path in ["test_temp.db", "apps/backend/test_temp.db"]:
            if os.path.exists(path):
                os.remove(path)
    except Exception:
        pass
