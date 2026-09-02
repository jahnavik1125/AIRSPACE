import math

import pytest
from cv_core.detector import DetectionResult, Hand, Landmark
from cv_core.gestures import (GestureClassifier, GestureConfig,
                              GestureStateMachine, GestureStateUpdate,
                              calculate_angle, calculate_distance,
                              detect_finger_extensions)

# ==============================================================================
# Helper Mock Hand Generators
# ==============================================================================


def create_mock_hand(pose: str = "OPEN_PALM", score: float = 0.95) -> Hand:
    """
    Generates a mock Hand object with 21 coordinates representing a specific posture.
    """
    landmarks = [Landmark(x=0.5, y=0.5, z=0.0) for _ in range(21)]

    # Set Wrist (0) and Middle MCP (9) to establish scale palm size = 0.4
    landmarks[0] = Landmark(x=0.5, y=0.9, z=0.0)  # Wrist
    landmarks[9] = Landmark(x=0.5, y=0.5, z=0.0)  # Middle MCP

    # Palm knuckles (MCPs)
    landmarks[5] = Landmark(x=0.4, y=0.5, z=0.0)  # Index MCP
    landmarks[13] = Landmark(x=0.6, y=0.5, z=0.0)  # Ring MCP
    landmarks[17] = Landmark(x=0.7, y=0.5, z=0.0)  # Pinky MCP

    # Default folded coordinates (closer to knuckles or wrist than knuckles/PIPs)
    for pip, dip, tip in [(6, 7, 8), (10, 11, 12), (14, 15, 16), (18, 19, 20)]:
        landmarks[pip] = Landmark(x=landmarks[pip - 1].x, y=0.45, z=0.0)
        landmarks[dip] = Landmark(x=landmarks[pip - 1].x, y=0.48, z=0.0)
        landmarks[tip] = Landmark(x=landmarks[pip - 1].x, y=0.50, z=0.0)

    # Default folded thumb
    landmarks[1] = Landmark(x=0.45, y=0.8, z=0.0)  # CMC
    landmarks[2] = Landmark(x=0.42, y=0.7, z=0.0)  # MCP
    landmarks[3] = Landmark(x=0.43, y=0.6, z=0.0)  # IP
    landmarks[4] = Landmark(x=0.44, y=0.55, z=0.0)  # Tip (close to index knuckle 5)

    if pose == "OPEN_PALM":
        # All fingers extended upward (tip.y < pip.y in camera space where Y goes down)
        # Thumb extended outward horizontally
        landmarks[4] = Landmark(x=0.2, y=0.7, z=0.0)  # Thumb Tip

        # Extend Index
        landmarks[6] = Landmark(x=0.4, y=0.4, z=0.0)
        landmarks[8] = Landmark(x=0.4, y=0.2, z=0.0)  # Index Tip
        # Extend Middle
        landmarks[10] = Landmark(x=0.5, y=0.4, z=0.0)
        landmarks[12] = Landmark(x=0.5, y=0.2, z=0.0)  # Middle Tip
        # Extend Ring
        landmarks[14] = Landmark(x=0.6, y=0.4, z=0.0)
        landmarks[16] = Landmark(x=0.6, y=0.2, z=0.0)  # Ring Tip
        # Extend Pinky
        landmarks[18] = Landmark(x=0.7, y=0.4, z=0.0)
        landmarks[20] = Landmark(x=0.7, y=0.2, z=0.0)  # Pinky Tip

    elif pose == "FIST":
        # Keep everything folded (default state)
        pass

    elif pose == "INDEX_POINT":
        # Only Index extended
        landmarks[6] = Landmark(x=0.4, y=0.4, z=0.0)
        landmarks[8] = Landmark(x=0.4, y=0.2, z=0.0)  # Index Tip extended

    elif pose == "TWO_FINGER":
        # Index and Middle extended
        landmarks[6] = Landmark(x=0.4, y=0.4, z=0.0)
        landmarks[8] = Landmark(x=0.4, y=0.2, z=0.0)
        landmarks[10] = Landmark(x=0.5, y=0.4, z=0.0)
        landmarks[12] = Landmark(x=0.5, y=0.2, z=0.0)

    elif pose == "PINCH":
        # Thumb and Index tips close to each other
        landmarks[4] = Landmark(x=0.45, y=0.40, z=0.0)  # Thumb Tip
        landmarks[8] = Landmark(x=0.46, y=0.41, z=0.0)  # Index Tip (very close)

    return Hand(handedness="Right", score=score, landmarks=landmarks)


# ==============================================================================
# Unit Test Cases
# ==============================================================================


def test_distance_calculation():
    p1 = Landmark(x=0.0, y=0.0, z=0.0)
    p2 = Landmark(x=3.0, y=4.0, z=0.0)
    assert calculate_distance(p1, p2) == pytest.approx(5.0)

    p3 = Landmark(x=1.0, y=1.0, z=1.0)
    p4 = Landmark(x=2.0, y=3.0, z=3.0)
    # distance = sqrt(1 + 4 + 4) = 3
    assert calculate_distance(p3, p4) == pytest.approx(3.0)
    assert calculate_distance(p3, p4, use_2d=True) == pytest.approx(math.sqrt(5))


def test_angle_calculation():
    # 90 Degree Angle Check
    p1 = Landmark(x=1.0, y=0.0, z=0.0)  # Vector p2->p1 = (1, 0)
    p2 = Landmark(x=0.0, y=0.0, z=0.0)
    p3 = Landmark(x=0.0, y=1.0, z=0.0)  # Vector p2->p3 = (0, 1)

    assert calculate_angle(p1, p2, p3, use_2d=True) == pytest.approx(90.0)

    # Straight line angle (180 degrees)
    p4 = Landmark(x=-1.0, y=0.0, z=0.0)
    assert calculate_angle(p1, p2, p4, use_2d=True) == pytest.approx(180.0)


def test_finger_extension_heuristics():
    config = GestureConfig()

    # Test open palm extensions
    hand_open = create_mock_hand("OPEN_PALM")
    ext_open = detect_finger_extensions(hand_open, config)
    assert ext_open["index"] is True
    assert ext_open["middle"] is True
    assert ext_open["ring"] is True
    assert ext_open["pinky"] is True
    assert ext_open["thumb"] is True

    # Test fist (all folded)
    hand_fist = create_mock_hand("FIST")
    ext_fist = detect_finger_extensions(hand_fist, config)
    assert ext_fist["index"] is False
    assert ext_fist["middle"] is False
    assert ext_fist["ring"] is False
    assert ext_fist["pinky"] is False


def test_static_gesture_classifications():
    classifier = GestureClassifier()

    # Open Palm
    assert classifier.classify_gesture(create_mock_hand("OPEN_PALM"))[0] == "OPEN_PALM"

    # Fist
    assert classifier.classify_gesture(create_mock_hand("FIST"))[0] == "FIST"

    # Index Point
    assert (
        classifier.classify_gesture(create_mock_hand("INDEX_POINT"))[0] == "INDEX_POINT"
    )

    # Two Finger
    assert (
        classifier.classify_gesture(create_mock_hand("TWO_FINGER"))[0] == "TWO_FINGER"
    )

    # Pinch
    assert classifier.classify_gesture(create_mock_hand("PINCH"))[0] == "PINCH"


def test_state_machine_initialization():
    state_machine = GestureStateMachine()
    assert state_machine.state == "IDLE"
    assert state_machine.smoothed_cursor == (0.5, 0.5)


def test_state_machine_hover_transition():
    state_machine = GestureStateMachine()

    # Feed an open palm frame
    hand = create_mock_hand("OPEN_PALM")
    detection = DetectionResult(timestamp=1000, hands=[hand])

    update = state_machine.update(detection)
    assert update.state == "HOVER"
    assert update.gesture == "OPEN_PALM"
    assert update.event is None


def test_state_machine_pinch_debounce_rules():
    config = GestureConfig(debounce_frames=3)
    state_machine = GestureStateMachine(config)

    # Initial frame
    hand_pinch = create_mock_hand("PINCH")

    # Frame 1: Pinch detected, debounce starts, state goes Hover (from IDLE first step goes Hover)
    update = state_machine.update(DetectionResult(timestamp=1000, hands=[hand_pinch]))
    assert update.state == "HOVER"
    assert state_machine.pinch_debounce_counter == 1

    # Frame 2: Still Pinching
    update = state_machine.update(DetectionResult(timestamp=1033, hands=[hand_pinch]))
    assert update.state == "HOVER"
    assert state_machine.pinch_debounce_counter == 2

    # Frame 3: Debounce threshold (3 frames) hit -> Transition to PINCH_START
    update = state_machine.update(DetectionResult(timestamp=1066, hands=[hand_pinch]))
    assert update.state == "PINCH_START"
    assert update.event == "PINCH_START"
    assert state_machine.pinch_debounce_counter == 3

    # Frame 4: Next frame -> PINCH_HOLD
    update = state_machine.update(DetectionResult(timestamp=1100, hands=[hand_pinch]))
    assert update.state == "PINCH_HOLD"
    assert update.event is None


def test_state_machine_drag_transition():
    config = GestureConfig(debounce_frames=1, drag_threshold=0.05, smoothing_factor=1.0)
    state_machine = GestureStateMachine(config)

    # Pinch at (0.4, 0.4)
    hand = create_mock_hand("PINCH")
    hand.landmarks[8] = Landmark(x=0.4, y=0.4, z=0.0)  # Index
    hand.landmarks[4] = Landmark(x=0.4, y=0.4, z=0.0)  # Thumb

    # Frame 1: PINCH_START
    update = state_machine.update(DetectionResult(timestamp=1000, hands=[hand]))
    assert update.state == "PINCH_START"

    # Frame 2: PINCH_HOLD (same position)
    update = state_machine.update(DetectionResult(timestamp=1033, hands=[hand]))
    assert update.state == "PINCH_HOLD"

    # Frame 3: Move slightly under threshold (0.02 units shift)
    hand_move_small = create_mock_hand("PINCH")
    hand_move_small.landmarks[8] = Landmark(x=0.42, y=0.4, z=0.0)
    hand_move_small.landmarks[4] = Landmark(x=0.42, y=0.4, z=0.0)

    update = state_machine.update(
        DetectionResult(timestamp=1066, hands=[hand_move_small])
    )
    assert update.state == "PINCH_HOLD"

    # Frame 4: Move past threshold (0.07 units shift from start (0.4, 0.4))
    hand_move_large = create_mock_hand("PINCH")
    hand_move_large.landmarks[8] = Landmark(x=0.48, y=0.4, z=0.0)
    hand_move_large.landmarks[4] = Landmark(x=0.48, y=0.4, z=0.0)

    update = state_machine.update(
        DetectionResult(timestamp=1100, hands=[hand_move_large])
    )
    assert update.state == "DRAG"


def test_state_machine_release_transition():
    config = GestureConfig(debounce_frames=1)
    state_machine = GestureStateMachine(config)

    # Frame 1: Pinch Start
    hand_pinch = create_mock_hand("PINCH")
    update = state_machine.update(DetectionResult(timestamp=1000, hands=[hand_pinch]))
    assert update.state == "PINCH_START"

    # Frame 2: Release pinch -> Open Palm -> PINCH_END
    hand_open = create_mock_hand("OPEN_PALM")
    update = state_machine.update(DetectionResult(timestamp=1033, hands=[hand_open]))
    assert update.state == "PINCH_END"
    assert update.event == "PINCH_END"

    # Frame 3: Next frame open palm -> HOVER
    update = state_machine.update(DetectionResult(timestamp=1066, hands=[hand_open]))
    assert update.state == "HOVER"


def test_state_machine_hand_lost_transition():
    config = GestureConfig(debounce_frames=1)
    state_machine = GestureStateMachine(config)

    # Frame 1: Pinch Start
    hand_pinch = create_mock_hand("PINCH")
    update = state_machine.update(DetectionResult(timestamp=1000, hands=[hand_pinch]))
    assert update.state == "PINCH_START"

    # Frame 2: Hand is lost (empty list) -> PINCH_END
    update = state_machine.update(DetectionResult(timestamp=1033, hands=[]))
    assert update.state == "PINCH_END"
    assert update.event == "PINCH_END"

    # Frame 3: Hand still lost -> IDLE
    update = state_machine.update(DetectionResult(timestamp=1066, hands=[]))
    assert update.state == "IDLE"


def test_horizontal_swipe_detection():
    config = GestureConfig(
        swipe_distance_threshold=0.10,
        swipe_velocity_threshold=0.30,
        swipe_cooldown_seconds=0.5,
    )
    state_machine = GestureStateMachine(config)

    # Run horizontal swipe right: coordinate goes from 0.2 to 0.4 over 100ms
    # Velocity = (0.4 - 0.2) / 0.1 = 2.0 units/sec (exceeds 0.3 threshold)
    steps = [0.2, 0.25, 0.3, 0.35, 0.4]
    timestamps = [1000, 1025, 1050, 1075, 1100]

    update = None
    for x, ts in zip(steps, timestamps):
        hand = create_mock_hand("OPEN_PALM")
        # Override index tip position
        hand.landmarks[8] = Landmark(x=x, y=0.5, z=0.0)
        update = state_machine.update(DetectionResult(timestamp=ts, hands=[hand]))

    # Last step should trigger SWIPE_RIGHT
    assert update.event == "SWIPE_RIGHT"

    # Verify Cooldown: attempting to swipe again immediately fails
    hand2 = create_mock_hand("OPEN_PALM")
    hand2.landmarks[8] = Landmark(x=0.55, y=0.5, z=0.0)
    update = state_machine.update(DetectionResult(timestamp=1125, hands=[hand2]))
    assert update.event is None


def test_coordinate_smoothing_filter():
    config = GestureConfig(smoothing_factor=0.3)  # EMA alpha
    state_machine = GestureStateMachine(config)

    # Frame 1: First hand position at (0.3, 0.3)
    hand1 = create_mock_hand("OPEN_PALM")
    hand1.landmarks[8] = Landmark(x=0.3, y=0.3, z=0.0)
    update = state_machine.update(DetectionResult(timestamp=1000, hands=[hand1]))
    # First frame smoothed cursor equals coordinate input
    assert update.cursor == pytest.approx((0.3, 0.3))

    # Frame 2: Shift to (0.5, 0.5)
    # EMA: 0.3 * 0.5 + 0.7 * 0.3 = 0.15 + 0.21 = 0.36
    hand2 = create_mock_hand("OPEN_PALM")
    hand2.landmarks[8] = Landmark(x=0.5, y=0.5, z=0.0)
    update = state_machine.update(DetectionResult(timestamp=1033, hands=[hand2]))
    assert update.cursor[0] == pytest.approx(0.36)
    assert update.cursor[1] == pytest.approx(0.36)


def test_low_confidence_hand_filtering():
    # If the score is extremely low, does it filter?
    # Actually detector returns the list, state machine selects the hand.
    # We can write test verifying it handles multiple hands by picking highest score
    state_machine = GestureStateMachine()

    hand_low = create_mock_hand("FIST", score=0.4)
    hand_high = create_mock_hand("OPEN_PALM", score=0.9)

    detection = DetectionResult(timestamp=1000, hands=[hand_low, hand_high])

    # State machine should select hand_high and cursor should be at (0.4, 0.2)
    update = state_machine.update(detection)
    assert update.gesture == "OPEN_PALM"
    assert update.cursor == pytest.approx((0.4, 0.2))
