import { classifyHandGesture } from "../utils/gestureClassifier";
import { NormalizedLandmark } from "../types/spatial";

// Helper to construct mock 21 hand landmarks
function createMockHand(config: {
  indexExtended: boolean;
  middleExtended: boolean;
  ringExtended: boolean;
  pinkyExtended: boolean;
  thumbExtended: boolean;
}): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));

  // Wrist at bottom
  landmarks[0] = { x: 0.5, y: 0.9, z: 0 };
  landmarks[9] = { x: 0.5, y: 0.6, z: 0 }; // Middle MCP

  // Thumb
  landmarks[1] = { x: 0.4, y: 0.8, z: 0 };
  landmarks[4] = config.thumbExtended ? { x: 0.2, y: 0.5, z: 0 } : { x: 0.4, y: 0.65, z: 0 };

  // Index (MCP 5, PIP 6, Tip 8)
  landmarks[5] = { x: 0.45, y: 0.6, z: 0 };
  landmarks[6] = { x: 0.45, y: 0.45, z: 0 };
  landmarks[8] = config.indexExtended ? { x: 0.45, y: 0.15, z: 0 } : { x: 0.45, y: 0.65, z: 0 };

  // Middle (MCP 9, PIP 10, Tip 12)
  landmarks[10] = { x: 0.5, y: 0.42, z: 0 };
  landmarks[12] = config.middleExtended ? { x: 0.5, y: 0.12, z: 0 } : { x: 0.5, y: 0.65, z: 0 };

  // Ring (MCP 13, PIP 14, Tip 16)
  landmarks[13] = { x: 0.55, y: 0.6, z: 0 };
  landmarks[14] = { x: 0.55, y: 0.48, z: 0 };
  landmarks[16] = config.ringExtended ? { x: 0.55, y: 0.18, z: 0 } : { x: 0.55, y: 0.68, z: 0 };

  // Pinky (MCP 17, PIP 18, Tip 20)
  landmarks[17] = { x: 0.6, y: 0.65, z: 0 };
  landmarks[18] = { x: 0.6, y: 0.52, z: 0 };
  landmarks[20] = config.pinkyExtended ? { x: 0.6, y: 0.22, z: 0 } : { x: 0.6, y: 0.72, z: 0 };

  return landmarks;
}

describe("AIRSPACE Two-Finger (✌️) Writing Gesture Classifier", () => {
  it("should detect TWO_FINGER_WRITE when index + middle extended and ring + pinky folded", () => {
    const hand = createMockHand({
      indexExtended: true,
      middleExtended: true,
      ringExtended: false,
      pinkyExtended: false,
      thumbExtended: false
    });

    const gesture = classifyHandGesture(hand);
    expect(gesture).toBe("TWO_FINGER_WRITE");
  });

  it("should NOT activate writing with only single index finger extended", () => {
    const singleIndexHand = createMockHand({
      indexExtended: true,
      middleExtended: false,
      ringExtended: false,
      pinkyExtended: false,
      thumbExtended: false
    });

    const gesture = classifyHandGesture(singleIndexHand);
    expect(gesture).toBe("NONE");
  });

  it("should detect OPEN_PALM when all fingers are extended", () => {
    const openHand = createMockHand({
      indexExtended: true,
      middleExtended: true,
      ringExtended: true,
      pinkyExtended: true,
      thumbExtended: true
    });

    const gesture = classifyHandGesture(openHand);
    expect(gesture).toBe("OPEN_PALM");
  });

  it("should maintain writing state under hysteresis while index and middle remain extended", () => {
    // Hand slightly shifting angle
    const handInFlight = createMockHand({
      indexExtended: true,
      middleExtended: true,
      ringExtended: false,
      pinkyExtended: false,
      thumbExtended: false
    });

    const gesture = classifyHandGesture(handInFlight, true);
    expect(gesture).toBe("TWO_FINGER_WRITE");
  });
});
