from typing import List, Optional, Tuple

import cv2
import numpy as np
from cv_core.detector import DetectionResult, Hand, Landmark
from cv_core.gestures import GestureStateUpdate

# Define MediaPipe Hand connection indices for visual skeletons
HAND_CONNECTIONS = [
    # Thumb
    (0, 1),
    (1, 2),
    (2, 3),
    (3, 4),
    # Index Finger
    (0, 5),
    (5, 6),
    (6, 7),
    (7, 8),
    # Middle Finger
    (9, 10),
    (10, 11),
    (11, 12),
    # Ring Finger
    (13, 14),
    (14, 15),
    (15, 16),
    # Pinky
    (0, 17),
    (17, 18),
    (18, 19),
    (19, 20),
    # Palm Knuckles
    (5, 9),
    (9, 13),
    (13, 17),
]


def draw_landmarks_on_frame(
    frame: np.ndarray,
    detection: DetectionResult,
    state_update: Optional[GestureStateUpdate] = None,
) -> np.ndarray:
    """
    Renders hand landmarks, skeleton connections, and overlays status HUD.
    Args:
        frame (np.ndarray): Source BGR image.
        detection (DetectionResult): Output from HandDetector.
        state_update (Optional[GestureStateUpdate]): State machine updates.
    Returns:
        np.ndarray: Modified BGR image with drawn HUD and skeleton overlay.
    """
    if frame is None or frame.size == 0:
        return frame

    h, w, c = frame.shape
    out_frame = frame.copy()

    # 1. Draw skeletons for each detected hand
    for hand in detection.hands:
        # Convert landmarks to pixel positions
        pixel_landmarks: List[Tuple[int, int]] = []
        for lm in hand.landmarks:
            px = int(lm.x * w)
            py = int(lm.y * h)
            pixel_landmarks.append((px, py))

        # Draw connection lines
        for start_idx, end_idx in HAND_CONNECTIONS:
            if start_idx < len(pixel_landmarks) and end_idx < len(pixel_landmarks):
                cv2.line(
                    out_frame,
                    pixel_landmarks[start_idx],
                    pixel_landmarks[end_idx],
                    (100, 240, 100) if hand.handedness == "Right" else (240, 100, 100),
                    2,
                )

        # Draw landmark nodes
        for idx, (px, py) in enumerate(pixel_landmarks):
            # Highlight fingertips
            if idx in [4, 8, 12, 16, 20]:
                cv2.circle(out_frame, (px, py), 6, (0, 0, 255), -1)
            else:
                cv2.circle(out_frame, (px, py), 4, (255, 255, 255), -1)

    # 2. Draw active cursor glow (from state machine)
    if state_update and state_update.state != "IDLE":
        cx = int(state_update.cursor[0] * w)
        cy = int(state_update.cursor[1] * h)

        # Select color based on action state
        color = (0, 0, 255)  # Default Red
        if state_update.state == "HOVER":
            color = (255, 120, 0)  # Cyan-blue
        elif state_update.state in ["PINCH_START", "PINCH_HOLD"]:
            color = (0, 255, 255)  # Yellow
        elif state_update.state == "DRAG":
            color = (0, 255, 0)  # Green

        # Draw tracking target crosshair & outer ring
        cv2.circle(out_frame, (cx, cy), 12, color, 2)
        cv2.circle(out_frame, (cx, cy), 3, color, -1)

    # 3. Render Status HUD Panel (Top-Left)
    # Create semi-transparent background block for HUD readability
    hud_h, hud_w = 120, 230
    overlay = out_frame.copy()
    cv2.rectangle(overlay, (10, 10), (10 + hud_w, 10 + hud_h), (15, 15, 25), -1)
    # Apply alpha blending
    cv2.addWeighted(overlay, 0.75, out_frame, 0.25, 0, out_frame)

    # Draw HUD Border
    cv2.rectangle(out_frame, (10, 10), (10 + hud_w, 10 + hud_h), (80, 80, 90), 1)

    # Calculate FPS and latency metrics
    latency_ms = detection.processing_time_ms
    fps = 1000.0 / latency_ms if latency_ms > 0 else 0.0

    # Draw text stats
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.45
    line_spacing = 20
    text_color = (240, 240, 240)

    # Info rows
    state_str = state_update.state if state_update else "IDLE"
    gesture_str = state_update.gesture if state_update else "NONE"

    cv2.putText(
        out_frame,
        "AIRSPACE Debug HUD",
        (20, 30),
        font,
        0.45,
        (80, 160, 255),
        1,
        cv2.LINE_AA,
    )
    cv2.putText(
        out_frame,
        f"State:   {state_str}",
        (20, 30 + line_spacing),
        font,
        font_scale,
        text_color,
        1,
        cv2.LINE_AA,
    )
    cv2.putText(
        out_frame,
        f"Gesture: {gesture_str}",
        (20, 30 + (2 * line_spacing)),
        font,
        font_scale,
        text_color,
        1,
        cv2.LINE_AA,
    )
    cv2.putText(
        out_frame,
        f"Latency: {latency_ms:.1f} ms",
        (20, 30 + (3 * line_spacing)),
        font,
        font_scale,
        text_color,
        1,
        cv2.LINE_AA,
    )
    cv2.putText(
        out_frame,
        f"Calc FPS: {fps:.1f}",
        (20, 30 + (4 * line_spacing)),
        font,
        font_scale,
        text_color,
        1,
        cv2.LINE_AA,
    )

    # 4. Display One-time Gesture Events in Green (Bottom-Left)
    if state_update and state_update.event:
        overlay_evt = out_frame.copy()
        cv2.rectangle(overlay_evt, (10, h - 45), (280, h - 15), (10, 40, 10), -1)
        cv2.addWeighted(overlay_evt, 0.7, out_frame, 0.3, 0, out_frame)
        cv2.rectangle(out_frame, (10, h - 45), (280, h - 15), (0, 150, 0), 1)
        cv2.putText(
            out_frame,
            f"EVENT TRIGGERED: {state_update.event}",
            (20, h - 25),
            font,
            0.45,
            (0, 255, 0),
            1,
            cv2.LINE_AA,
        )

    return out_frame
