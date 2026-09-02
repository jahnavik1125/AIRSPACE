import os
import sys
import time

import cv2

# Ensure packages path is in sys.path to run directly from folder
sys.path.append(os.path.join(os.path.dirname(__file__), "cv_core"))
sys.path.append(os.path.dirname(__file__))

try:
    from cv_core.detector import HandDetector
    from cv_core.gestures import GestureConfig, GestureStateMachine
    from cv_core.visualizer import draw_landmarks_on_frame
except ImportError as e:
    print(f"Failed to import core modules. Make sure setup.ps1 has run. Detail: {e}")
    sys.exit(1)


def main():
    print("=================================================")
    print("    AIRSPACE Local CV Webcam Debug Demo")
    print("=================================================")
    print("Initializing Hand tracking detector...")

    # Configure and launch detector
    config = GestureConfig()
    detector = HandDetector(max_num_hands=2)

    if not detector.initialize():
        print("Error: Could not initialize MediaPipe Hand Solutions.")
        sys.exit(1)

    state_machine = GestureStateMachine(config)

    # Open local webcam capture (default device 0)
    print("Opening webcam. Make sure no other apps are using it...")
    cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        print("Error: Could not access the webcam device.")
        detector.close()
        sys.exit(1)

    print("\n-------------------------------------------------")
    print("Success! Webcam feed is online.")
    print("Instructions:")
    print("  - Perform static poses: Fist, Open Palm, Index Point, Two Fingers.")
    print("  - Pinch thumb and index tips together to click/drag.")
    print("  - Move hand rapidly left/right to trigger horizontal swipes.")
    print("  - Press 'q' key in the video window to EXIT.")
    print("-------------------------------------------------\n")

    # Set frame dimensions for fast pipeline execution
    cap.set(
        (
            cv2.cv2.CAP_PROP_FRAME_WIDTH
            if hasattr(cv2, "cv2")
            else cv2.CAP_PROP_FRAME_WIDTH
        ),
        640,
    )
    cap.set(
        (
            cv2.cv2.CAP_PROP_FRAME_HEIGHT
            if hasattr(cv2, "cv2")
            else cv2.CAP_PROP_FRAME_HEIGHT
        ),
        480,
    )

    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                print("Failed to grab video frame.")
                break

            # Mirror the frame horizontally for natural gesture interaction
            frame = cv2.flip(frame, 1)

            # 1. Process hand detection
            detection = detector.process_frame(frame)

            # 2. Drive the state machine transitions
            state_update = state_machine.update(detection)

            # 3. Draw diagnostic overlays
            annotated_frame = draw_landmarks_on_frame(frame, detection, state_update)

            # 4. Show the rendering window
            cv2.imshow("AIRSPACE CV Debug window", annotated_frame)

            # Check key press for exit
            if cv2.waitKey(1) & 0xFF == ord("q"):
                print("Exiting demo loop...")
                break

    except KeyboardInterrupt:
        print("\nKeyboard Interrupt detected.")
    finally:
        # Resource cleanup
        print("Releasing capture resources...")
        cap.release()
        cv2.destroyAllWindows()
        detector.close()
        print("AIRSPACE session finished. Goodbye!")


if __name__ == "__main__":
    main()
