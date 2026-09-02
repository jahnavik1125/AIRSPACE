from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey, Text, JSON, BigInteger
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

class User(Base):
    """
    User account credentials and profiles.
    """
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    
    sessions = relationship("SessionModel", back_populates="user")


class SessionModel(Base):
    """
    Tracks independent WebSocket interaction connection cycles.
    """
    __tablename__ = "sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    session_uuid = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    start_time = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    end_time = Column(DateTime, nullable=True)
    duration = Column(Float, nullable=True)  # in seconds
    gesture_count = Column(Integer, default=0, nullable=False)
    status = Column(String, default="active", nullable=False)  # "active", "completed"
    
    user = relationship("User", back_populates="sessions")
    gesture_events = relationship("GestureEvent", back_populates="session", cascade="all, delete-orphan")
    analytics_events = relationship("AnalyticsEvent", back_populates="session", cascade="all, delete-orphan")
    drawings = relationship("Drawing", back_populates="session", cascade="all, delete-orphan")
    air_writing_sessions = relationship("AirWritingSession", back_populates="session", cascade="all, delete-orphan")
    math_sessions = relationship("MathSession", back_populates="session", cascade="all, delete-orphan")
    gesture_profiles = relationship("GestureProfile", back_populates="session", cascade="all, delete-orphan")


class GestureEvent(Base):
    """
    Stores meaningful gesture boundaries (clicks, swipes, drags) recognized by the CV engine.
    """
    __tablename__ = "gesture_events"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    gesture = Column(String, nullable=False)  # e.g., "PINCH", "SWIPE_LEFT"
    state = Column(String, nullable=False)    # e.g., "PINCH_START", "DRAG"
    confidence = Column(Float, nullable=False)
    x = Column(Float, nullable=False)
    y = Column(Float, nullable=False)
    timestamp = Column(BigInteger, nullable=False)  # Unix epoch in milliseconds
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    
    session = relationship("SessionModel", back_populates="gesture_events")


class AirWritingSession(Base):
    """
    Represents a drawing sequence meant to be translated into handwriting text.
    """
    __tablename__ = "air_writing_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    text = Column(Text, nullable=True)  # The resolved OCR handwriting text
    predicted_character = Column(String, nullable=True)
    confidence = Column(Float, nullable=True)
    confirmed_label = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    
    session = relationship("SessionModel", back_populates="air_writing_sessions")
    samples = relationship("AirWritingSample", back_populates="writing_session", cascade="all, delete-orphan")


class AirWritingSample(Base):
    """
    Coordinates and timestamp series representing air writing strokes.
    """
    __tablename__ = "air_writing_samples"
    
    id = Column(Integer, primary_key=True, index=True)
    writing_session_id = Column(Integer, ForeignKey("air_writing_sessions.id"), nullable=False)
    stroke_index = Column(Integer, nullable=False)
    points = Column(JSON, nullable=False)  # Array of points: [{"x": 0.5, "y": 0.5, "t": 16900...}]
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    
    writing_session = relationship("AirWritingSession", back_populates="samples")


class Drawing(Base):
    """
    Stores vector drawings drawn on the AIR CANVAS workspace.
    """
    __tablename__ = "drawings"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    svg_data = Column(Text, nullable=True)  # Serialized SVG paths
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    
    session = relationship("SessionModel", back_populates="drawings")


class AnalyticsEvent(Base):
    """
    Stores session triggers and metrics separate from raw tracking frames.
    """
    __tablename__ = "analytics_events"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=True)
    event_type = Column(String, nullable=False)  # e.g., "module_opened", "recognition_completed"
    metadata_json = Column(JSON, nullable=True)  # Generic structured payload details
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    
    session = relationship("SessionModel", back_populates="analytics_events")


class MathSession(Base):
    """
    Persisted algebraic computation coordinates and LaTeX explanations.
    """
    __tablename__ = "math_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    raw_strokes = Column(JSON, nullable=False)
    recognized_expression = Column(String, nullable=False)
    latex = Column(String, nullable=False)
    solution = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    
    session = relationship("SessionModel", back_populates="math_sessions")


class GestureProfile(Base):
    """
    Personalized gesture statistics and calculated adaptive thresholds.
    """
    __tablename__ = "gesture_profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    gesture_name = Column(String, nullable=False)
    sample_count = Column(Integer, default=0, nullable=False)
    mean_features = Column(JSON, nullable=True)
    var_features = Column(JSON, nullable=True)
    personalized_threshold = Column(Float, nullable=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    
    session = relationship("SessionModel", back_populates="gesture_profiles")
    samples = relationship("GestureCalibrationSample", back_populates="profile", cascade="all, delete-orphan")


class GestureCalibrationSample(Base):
    """
    Individually collected calibration points and feature derivations.
    """
    __tablename__ = "gesture_calibration_samples"
    
    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("gesture_profiles.id"), nullable=False)
    raw_landmarks = Column(JSON, nullable=False)
    extracted_features = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    
    profile = relationship("GestureProfile", back_populates="samples")
