import { NormalizedLandmark } from "../types/spatial";

export function calculateDistance(
  p1: { x: number; y: number; z?: number },
  p2: { x: number; y: number; z?: number }
): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = (p1.z ?? 0) - (p2.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export type GestureType = "TWO_FINGER_WRITE" | "INDEX_POINT" | "OPEN_PALM" | "NONE" | string;

/**
 * AIRSPACE Two-Finger Writing Gesture Classifier
 * Primary Writing Gesture: INDEX + MIDDLE EXTENDED, RING + PINKY FOLDED (✌️)
 * Primary Eraser Gesture: FULL OPEN PALM
 * Single index finger does NOT trigger writing.
 */
export function classifyHandGesture(
  landmarks: NormalizedLandmark[],
  isCurrentlyWriting: boolean = false
): GestureType {
  if (!landmarks || landmarks.length < 21) return "NONE";

  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const indexMcp = landmarks[5];
  const indexPip = landmarks[6];
  const indexTip = landmarks[8];
  const middleMcp = landmarks[9];
  const middlePip = landmarks[10];
  const middleTip = landmarks[12];
  const ringMcp = landmarks[13];
  const ringPip = landmarks[14];
  const ringTip = landmarks[16];
  const pinkyMcp = landmarks[17];
  const pinkyPip = landmarks[18];
  const pinkyTip = landmarks[20];

  const palmScale = calculateDistance(wrist, middleMcp) || 0.001;

  // Distances to wrist
  const dWristIndex = calculateDistance(wrist, indexTip);
  const dWristIndexPip = calculateDistance(wrist, indexPip) || 0.001;
  const dWristIndexMcp = calculateDistance(wrist, indexMcp) || 0.001;

  const dWristMiddle = calculateDistance(wrist, middleTip);
  const dWristMiddlePip = calculateDistance(wrist, middlePip) || 0.001;
  const dWristMiddleMcp = calculateDistance(wrist, middleMcp) || 0.001;

  const dWristRing = calculateDistance(wrist, ringTip);
  const dWristRingPip = calculateDistance(wrist, ringPip) || 0.001;

  const dWristPinky = calculateDistance(wrist, pinkyTip);
  const dWristPinkyPip = calculateDistance(wrist, pinkyPip) || 0.001;

  // Individual finger extension calculations
  const indexExtended = dWristIndex / dWristIndexPip > 1.03 && dWristIndex / dWristIndexMcp > 1.12;
  const middleExtended = dWristMiddle / dWristMiddlePip > 1.03 && dWristMiddle / dWristMiddleMcp > 1.12;
  const ringExtended = dWristRing / dWristRingPip > 1.04;
  const pinkyExtended = dWristPinky / dWristPinkyPip > 1.04;

  const thumbSeparation = calculateDistance(thumbTip, indexMcp);
  const thumbExtended = thumbSeparation > 0.65 * palmScale;

  // 1. OPEN PALM CHECK (Eraser Mode)
  // At least 4 fingers extended including ring and pinky
  const openCount = (thumbExtended ? 1 : 0) + (indexExtended ? 1 : 0) +
                    (middleExtended ? 1 : 0) + (ringExtended ? 1 : 0) + (pinkyExtended ? 1 : 0);
  if (openCount >= 4 && ringExtended && pinkyExtended) {
    return "OPEN_PALM";
  }

  // 2. TWO-FINGER WRITING DETECTION WITH HYSTERESIS (✌️)
  if (isCurrentlyWriting) {
    // If ALREADY writing: maintain active writing state as long as index & middle have not folded into a fist
    // and hand has not opened into full palm
    const indexStillOut = dWristIndex > dWristIndexMcp * 0.96;
    const middleStillOut = dWristMiddle > dWristMiddleMcp * 0.96;
    const notFullPalm = !(ringExtended && pinkyExtended);

    if (indexStillOut && middleStillOut && notFullPalm) {
      return "TWO_FINGER_WRITE";
    }
  }

  // To START new writing stroke:
  // MUST have BOTH index and middle extended
  // AND ring and pinky MUST be folded
  // SINGLE index finger MUST NOT trigger writing!
  const ringFolded = !ringExtended || dWristRing < dWristIndex * 0.82;
  const pinkyFolded = !pinkyExtended || dWristPinky < dWristMiddle * 0.80;

  if (indexExtended && middleExtended && ringFolded && pinkyFolded) {
    return "TWO_FINGER_WRITE";
  }

  return "NONE";
}
