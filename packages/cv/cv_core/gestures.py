import math
import time
from typing import Any, Dict, List, Optional, Tuple

from cv_core.detector import DetectionResult, Hand, Landmark
from pydantic import BaseModel, Field

# ==============================================================================
# Gesture Configuration Settings
# ==============================================================================


class GestureConfig(BaseModel):
    pinch_distance_threshold: float = Field(
        0.20,
        description="Scale-invariant distance between thumb and index tips to detect a pinch",
    )
    drag_threshold: float = Field(
        0.04,
        description="Normalized movement distance from pinch start to trigger a DRAG state",
    )
    smoothing_factor: float = Field(
        0.35,
        description="Exponential moving average alpha (0.0 to 1.0) for coordinate tracking. Higher is faster, lower is smoother.",
    )
    swipe_distance_threshold: float = Field(
        0.15,
        description="Minimum horizontal distance traveled to detect a swipe gesture",
    )
    swipe_velocity_threshold: float = Field(
        0.40,
        description="Minimum horizontal speed (coordinates per second) to trigger a swipe",
    )
    swipe_cooldown_seconds: float = Field(
        0.8, description="Time in seconds to wait before another swipe can be triggered"
    )
    debounce_frames: int = Field(
        3, description="Consecutive frames required to confirm a pinch state transition"
    )
    finger_extension_ratio: float = Field(
        1.05,
        description="Ratio threshold to classify if a finger is extended (Tip to Wrist vs PIP to Wrist)",
    )


# ==============================================================================
# Output Data Structures
# ==============================================================================


class GestureStateUpdate(BaseModel):
    state: str = Field(
        ...,
        description="Active state: 'IDLE', 'HOVER', 'PINCH_START', 'PINCH_HOLD', 'PINCH_END', 'DRAG'",
    )
    gesture: str = Field(
        ...,
        description="Static gesture: 'NONE', 'INDEX_POINT', 'PINCH', 'FIST', 'OPEN_PALM', 'TWO_FINGER'",
    )
    cursor: Tuple[float, float] = Field(
        ...,
        description="Smoothed 2D coordinates (x, y) of the primary active fingertip",
    )
    event: Optional[str] = Field(
        None,
        description="One-time triggered event: 'PINCH_START', 'PINCH_END', 'SWIPE_LEFT', 'SWIPE_RIGHT', or None",
    )
    timestamp: int = Field(..., description="Unix epoch timestamp in milliseconds")


# ==============================================================================
# Helper Geometry Calculations
# ==============================================================================


def calculate_distance(p1: Landmark, p2: Landmark, use_2d: bool = False) -> float:
    """
    Computes Euclidean distance between two landmarks.
    """
    dx = p1.x - p2.x
    dy = p1.y - p2.y
    if use_2d:
        return math.sqrt(dx * dx + dy * dy)
    dz = p1.z - p2.z
    return math.sqrt(dx * dx + dy * dy + dz * dz)


def calculate_angle(
    p1: Landmark, p2: Landmark, p3: Landmark, use_2d: bool = False
) -> float:
    """
    Computes the angle in degrees at vertex p2 formed by vectors p2->p1 and p2->p3.
    """
    # Vector v1: p2 -> p1
    v1 = (
        (p1.x - p2.x, p1.y - p2.y)
        if use_2d
        else (p1.x - p2.x, p1.y - p2.y, p1.z - p2.z)
    )
    # Vector v2: p2 -> p3
    v2 = (
        (p3.x - p2.x, p3.y - p2.y)
        if use_2d
        else (p3.x - p2.x, p3.y - p2.y, p3.z - p2.z)
    )

    # Dot product
    dot = sum(a * b for a, b in zip(v1, v2))

    # Magnitudes
    m1 = math.sqrt(sum(a * a for a in v1))
    m2 = math.sqrt(sum(b * b for b in v2))

    if m1 * m2 == 0:
        return 0.0

    # Clip cos_val to avoid floating point errors out of arccos bounds [-1.0, 1.0]
    cos_val = max(-1.0, min(1.0, dot / (m1 * m2)))
    return math.degrees(math.acos(cos_val))


def detect_finger_extensions(hand: Hand, config: GestureConfig) -> Dict[str, bool]:
    """
    Analyzes hand landmarks and returns a map of extended fingers (True/False).
    Uses a scale-invariant comparison of distances relative to the wrist.
    """
    wrist = hand.wrist

    # Scale reference (palm size): distance from Wrist to Middle MCP (landmark 9)
    palm_size = calculate_distance(wrist, hand.landmarks[9])
    if palm_size == 0:
        palm_size = 0.001

    extensions = {}

    # 1. Thumb Check: Scale-invariant tip-to-index-knuckle separation
    # When thumb is folded, tip (4) is close to the index MCP joint (5).
    thumb_separation = calculate_distance(hand.thumb_tip, hand.landmarks[5])
    extensions["thumb"] = thumb_separation > (0.65 * palm_size)

    # 2. Key Fingers check: Index, Middle, Ring, Pinky
    # We compare the distance of Wrist -> Tip vs Wrist -> PIP.
    # If the hand is extended, the Tip is further away than the PIP knuckle.
    fingers = {
        "index": (hand.index_tip, hand.landmarks[6]),  # Tip (8), PIP (6)
        "middle": (hand.middle_tip, hand.landmarks[10]),  # Tip (12), PIP (10)
        "ring": (hand.ring_tip, hand.landmarks[14]),  # Tip (16), PIP (14)
        "pinky": (hand.pinky_tip, hand.landmarks[18]),  # Tip (20), PIP (18)
    }

    for name, (tip, pip) in fingers.items():
        dist_tip = calculate_distance(wrist, tip)
        dist_pip = calculate_distance(wrist, pip)

        # Scale ratio check
        extensions[name] = (dist_tip / dist_pip) > config.finger_extension_ratio

    return extensions


# ==============================================================================
# Gesture Classifier
# ==============================================================================


class GestureClassifier:
    """
    Classifies hand postures based on landmark geometry and scale-invariant calculations.
    """

    def __init__(self, config: Optional[GestureConfig] = None):
        self.config = config or GestureConfig()

    def classify_gesture(self, hand: Hand) -> Tuple[str, float]:
        """
        Runs geometric rules to identify the primary static posture.
        Returns:
            Tuple[str, float]: Gesture label, and confidence score.
        """
        # Determine finger extension statuses
        ext = detect_finger_extensions(hand, self.config)

        # Scale size reference
        wrist = hand.wrist
        middle_mcp = hand.landmarks[9]
        palm_size = calculate_distance(wrist, middle_mcp)
        if palm_size == 0:
            palm_size = 0.001

        # 1. Fist Check: All fingers folded
        if not any(ext.values()):
            return "FIST", 0.95

        # 2. Pinch Check: Compare distance between Thumb Tip (4) and Index Tip (8)
        thumb_index_dist = calculate_distance(hand.thumb_tip, hand.index_tip)
        normalized_pinch_dist = thumb_index_dist / palm_size

        if normalized_pinch_dist < self.config.pinch_distance_threshold:
            # We classify it as a PINCH
            return "PINCH", max(
                0.0,
                min(
                    1.0,
                    1.0
                    - (normalized_pinch_dist / self.config.pinch_distance_threshold),
                ),
            )

        # 3. Open Palm Check: All fingers extended
        if all(ext.values()):
            return "OPEN_PALM", 0.95

        # 4. Index Point Check: Index extended, other fingers folded or index distinctly dominant
        dist_index = calculate_distance(wrist, hand.index_tip)
        dist_middle = calculate_distance(wrist, hand.middle_tip)
        dist_ring = calculate_distance(wrist, hand.ring_tip)
        dist_pinky = calculate_distance(wrist, hand.pinky_tip)

        index_clearly_dominant = (
            dist_index > dist_middle * 1.08
            and dist_index > dist_ring * 1.12
            and dist_index > dist_pinky * 1.12
        )
        other_fingers_folded = (
            not ext["middle"] and not ext["ring"] and not ext["pinky"]
        )

        if ext["index"] and (other_fingers_folded or index_clearly_dominant):
            return "INDEX_POINT", 0.90

        # 5. Two Finger Check: Index and Middle extended, others folded
        if (
            ext["index"]
            and ext["middle"]
            and not ext["ring"]
            and not ext["pinky"]
            and not ext["thumb"]
        ):
            return "TWO_FINGER", 0.90

        return "NONE", 0.0


# ==============================================================================
# Gesture State Machine & Tracker
# ==============================================================================


class GestureStateMachine:
    """
    Handles temporal coordinate smoothing, debounces state transitions,
    and manages active gesture states (IDLE, HOVER, PINCH_START/HOLD/END, DRAG).
    """

    def __init__(self, config: Optional[GestureConfig] = None):
        self.config = config or GestureConfig()
        self.classifier = GestureClassifier(self.config)

        # State tracking variables
        self.state = "IDLE"
        self.smoothed_cursor: Tuple[float, float] = (0.5, 0.5)
        self.pinch_start_pos: Tuple[float, float] = (0.5, 0.5)

        # Debounce/Cooldown variables
        self.pinch_debounce_counter = 0
        self.last_swipe_timestamp = 0.0

        # History queue for swipe gesture tracking (stores tuples of (x, y, timestamp))
        self.swipe_history: List[Tuple[float, float, float]] = []

    def reset(self):
        """
        Resets internal tracker state.
        """
        self.state = "IDLE"
        self.smoothed_cursor = (0.5, 0.5)
        self.pinch_debounce_counter = 0
        self.swipe_history.clear()

    def _update_swipe_history(
        self, pos: Tuple[float, float], now: float
    ) -> Optional[str]:
        """
        Pipes coordinates to history queue and triggers horizontal swipes.
        Returns:
            str: "SWIPE_LEFT" or "SWIPE_RIGHT" if a swipe is detected, otherwise None.
        """
        # Append current position
        self.swipe_history.append((pos[0], pos[1], now))

        # Remove elements older than 0.5 seconds
        while self.swipe_history and (now - self.swipe_history[0][2]) > 0.5:
            self.swipe_history.pop(0)

        # Enforce cooldown check
        if (now - self.last_swipe_timestamp) < self.config.swipe_cooldown_seconds:
            return None

        # Check swipe conditions (requires at least 5 frames of history)
        if len(self.swipe_history) >= 5:
            start_x, start_y, start_time = self.swipe_history[0]
            end_x, end_y, end_time = self.swipe_history[-1]

            dx = end_x - start_x
            dy = end_y - start_y
            dt = end_time - start_time

            if dt > 0:
                vx = dx / dt

                # Check horizontal travel & speed, making sure vertical deviation is low
                if (
                    abs(dx) > self.config.swipe_distance_threshold
                    and abs(vx) > self.config.swipe_velocity_threshold
                ):
                    if abs(dy) < 0.6 * abs(dx):
                        self.last_swipe_timestamp = now
                        self.swipe_history.clear()
                        return "SWIPE_RIGHT" if dx > 0 else "SWIPE_LEFT"

        return None

    def update(self, detection: DetectionResult) -> GestureStateUpdate:
        """
        Processes a new frame detection and drives the state machine.
        Args:
            detection (DetectionResult): Frame results with detected hands.
        Returns:
            GestureStateUpdate: Event update details.
        """
        now_sec = detection.timestamp / 1000.0

        # Handle hand absence
        if not detection.hands:
            previous_state = self.state
            self.pinch_debounce_counter = 0
            self.swipe_history.clear()

            if previous_state in ["PINCH_START", "PINCH_HOLD", "DRAG"]:
                self.state = "PINCH_END"
                return GestureStateUpdate(
                    state=self.state,
                    gesture="NONE",
                    cursor=self.smoothed_cursor,
                    event="PINCH_END",
                    timestamp=detection.timestamp,
                )
            elif previous_state == "PINCH_END":
                self.state = "IDLE"
            elif previous_state == "HOVER":
                self.state = "IDLE"

            return GestureStateUpdate(
                state=self.state,
                gesture="NONE",
                cursor=self.smoothed_cursor,
                event=None,
                timestamp=detection.timestamp,
            )

        # Select primary hand (largest score or first hand)
        primary_hand = max(detection.hands, key=lambda h: h.score)

        # Calculate static gesture
        gesture, confidence = self.classifier.classify_gesture(primary_hand)

        # Track active fingertip (Index tip for pointing, midpoint of Index/Thumb for Pinching)
        current_x = primary_hand.index_tip.x
        current_y = primary_hand.index_tip.y
        if gesture == "PINCH":
            current_x = (primary_hand.index_tip.x + primary_hand.thumb_tip.x) / 2.0
            current_y = (primary_hand.index_tip.y + primary_hand.thumb_tip.y) / 2.0

        # Temporal coordinate smoothing (EMA filter)
        if self.state == "IDLE":
            self.smoothed_cursor = (current_x, current_y)
            self.state = "HOVER"
        else:
            alpha = self.config.smoothing_factor
            self.smoothed_cursor = (
                alpha * current_x + (1 - alpha) * self.smoothed_cursor[0],
                alpha * current_y + (1 - alpha) * self.smoothed_cursor[1],
            )

        # Check swipe gesture
        swipe_event = self._update_swipe_history(self.smoothed_cursor, now_sec)

        # State transition driving
        event_emitted = swipe_event

        if gesture == "PINCH":
            self.pinch_debounce_counter += 1
            if self.pinch_debounce_counter >= self.config.debounce_frames:
                # Transition trigger
                if self.state in ["HOVER", "PINCH_END", "POINT_END"]:
                    self.state = "PINCH_START"
                    self.pinch_start_pos = self.smoothed_cursor
                    event_emitted = "PINCH_START"
                elif self.state == "PINCH_START":
                    self.state = "PINCH_HOLD"
                elif self.state == "PINCH_HOLD":
                    # Transition to DRAG if coordinates shifted far enough from start point
                    dx = self.smoothed_cursor[0] - self.pinch_start_pos[0]
                    dy = self.smoothed_cursor[1] - self.pinch_start_pos[1]
                    dist_from_start = math.sqrt(dx * dx + dy * dy)
                    if dist_from_start > self.config.drag_threshold:
                        self.state = "DRAG"
        elif gesture == "INDEX_POINT":
            self.pinch_debounce_counter = 0
            if self.state in ["HOVER", "PINCH_END", "POINT_END", "IDLE"]:
                self.state = "POINT_START"
                event_emitted = "POINT_START"
            elif self.state == "POINT_START":
                self.state = "POINT_HOLD"
            elif self.state == "POINT_HOLD":
                self.state = "POINT_HOLD"
        else:
            # Pinch or Point released
            self.pinch_debounce_counter = 0
            if self.state in ["PINCH_START", "PINCH_HOLD", "DRAG"]:
                self.state = "PINCH_END"
                event_emitted = "PINCH_END"
            elif self.state in ["POINT_START", "POINT_HOLD"]:
                self.state = "POINT_END"
                event_emitted = "POINT_END"
            elif self.state in ["PINCH_END", "POINT_END"]:
                self.state = "HOVER"
            elif self.state == "IDLE":
                self.state = "HOVER"

        return GestureStateUpdate(
            state=self.state,
            gesture=gesture,
            cursor=self.smoothed_cursor,
            event=event_emitted,
            timestamp=detection.timestamp,
        )
