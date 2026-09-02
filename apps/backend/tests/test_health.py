from main import app


def test_app_instance_configuration():
    """
    Verifies that the FastAPI application metadata is loaded correctly.
    """
    assert app.title == "AIRSPACE API"
    assert app.version == "0.1.0"
    assert (
        app.description == "Backend API for the AI-Powered Spatial Interaction Platform"
    )
