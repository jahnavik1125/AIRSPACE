import time
from typing import Any, Dict, List, Tuple

import cv2
import numpy as np
from pydantic import BaseModel, Field

# ==============================================================================
# Structured and Validated Hand Landmark Data Models
# ==============================================================================


class Landmark(BaseModel):
    x: float = Field(
        ..., description="Normalized X coordinate (0.0 to 1.0), relative to image width"
    )
    y: float = Field(
        ...,
        description="Normalized Y coordinate (0.0 to 1.0), relative to image height",
    )
    z: float = Field(
        ..., description="Normalized Z coordinate, relative to wrist depth"
    )


class Hand(BaseModel):
    handedness: str = Field(
        ..., description="Classification of the hand: 'Left' or 'Right'"
    )
    score: float = Field(
        ..., description="Detection confidence score returned by MediaPipe (0.0 to 1.0)"
    )
    landmarks: List[Landmark] = Field(
        ..., description="List of 21 standardized hand landmarks"
    )

    @property
    def wrist(self) -> Landmark:
        return self.landmarks[0]

    @property
    def thumb_tip(self) -> Landmark:
        return self.landmarks[4]

    @property
    def index_tip(self) -> Landmark:
        return self.landmarks[8]

    @property
    def middle_tip(self) -> Landmark:
        return self.landmarks[12]

    @property
    def ring_tip(self) -> Landmark:
        return self.landmarks[16]

    @property
    def pinky_tip(self) -> Landmark:
        return self.landmarks[20]


class DetectionResult(BaseModel):
    timestamp: int = Field(
        ..., description="Unix timestamp of the frame in milliseconds"
    )
    hands: List[Hand] = Field(
        default_factory=list, description="List of detected hands in the frame"
    )
    processing_time_ms: float = Field(
        0.0, description="Time taken to process the frame in milliseconds"
    )


# ==============================================================================
# MediaPipe Hand Landmark Detector
# ==============================================================================


class HandDetector:
    """
    Wrapper for MediaPipe Hands API. Processes raw images to detect hand skeletons,
    classify handedness, and output validated data structures.
    """

    def __init__(
        self,
        max_num_hands: int = 2,
        min_detection_confidence: float = 0.7,
        min_tracking_confidence: float = 0.5,
    ):
        self.max_num_hands = max_num_hands
        self.min_detection_confidence = min_detection_confidence
        self.min_tracking_confidence = min_tracking_confidence
        self.mp_hands = None
        self.hands = None
        self.initialized = False

    def initialize(self) -> bool:
        """
        Initializes the MediaPipe solutions hands module.
        Returns:
            bool: True if initialization was successful, False otherwise.
        """
        if self.initialized:
            return True

        try:
            import mediapipe as mp

            self.mp_hands = mp.solutions.hands
            # Load Hands model
            self.hands = self.mp_hands.Hands(
                static_image_mode=False,
                max_num_hands=self.max_num_hands,
                model_complexity=1,
                min_detection_confidence=self.min_detection_confidence,
                min_tracking_confidence=self.min_tracking_confidence,
            )
            self.initialized = True
            return True
        except Exception as e:
            print(f"Error initializing MediaPipe Hands: {e}")
            self.initialized = False
            return False

    def process_frame(self, frame: np.ndarray) -> DetectionResult:
        """
        Processes a raw frame (BGR from OpenCV) to detect hands and extract keypoints.
        Args:
            frame (np.ndarray): Input image in BGR format.
        Returns:
            DetectionResult: Structured Pydantic model with timestamps, hands, and performance metrics.
        """
        start_time = time.perf_counter()
        timestamp_ms = int(time.time() * 1000)

        if not self.initialized:
            # Attempt lazy initialization if not already done
            if not self.initialize():
                return DetectionResult(
                    timestamp=timestamp_ms,
                    hands=[],
                    processing_time_ms=(time.perf_counter() - start_time) * 1000,
                )

        if frame is None or frame.size == 0:
            return DetectionResult(
                timestamp=timestamp_ms,
                hands=[],
                processing_time_ms=(time.perf_counter() - start_time) * 1000,
            )

        # Convert the frame to RGB as required by MediaPipe
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        # Run MediaPipe hand tracking inference
        results = self.hands.process(rgb_frame)

        detected_hands: List[Hand] = []

        if results.multi_hand_landmarks and results.multi_handedness:
            for idx, hand_landmarks in enumerate(results.multi_hand_landmarks):
                # Extract classification (handedness and confidence score)
                classification = results.multi_handedness[idx].classification[0]
                # Note: MediaPipe can mirror handedness relative to the screen.
                # We return raw MediaPipe classification labels: "Left" or "Right".
                label = classification.label
                score = classification.score

                # Extract 21 coordinates
                landmarks_list: List[Landmark] = []
                for lm in hand_landmarks.landmark:
                    landmarks_list.append(Landmark(x=lm.x, y=lm.y, z=lm.z))

                # Wrap in validated Hand schema
                if len(landmarks_list) == 21:
                    detected_hands.append(
                        Hand(handedness=label, score=score, landmarks=landmarks_list)
                    )

        end_time = time.perf_counter()
        processing_time_ms = (end_time - start_time) * 1000

        return DetectionResult(
            timestamp=timestamp_ms,
            hands=detected_hands,
            processing_time_ms=processing_time_ms,
        )

    def close(self):
        """
        Cleans up and releases MediaPipe resources.
        """
        if self.hands is not None:
            try:
                self.hands.close()
            except Exception as e:
                print(f"Error during HandDetector cleanup: {e}")
            finally:
                self.hands = None
                self.initialized = False

    def __del__(self):
        """
        Ensure resources are closed when destructor is called.
        """
        self.close()
