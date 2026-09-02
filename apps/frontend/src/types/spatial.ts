export interface NormalizedLandmark {
  x: number; // Normalized coordinate (0.0 to 1.0)
  y: number; // Normalized coordinate (0.0 to 1.0)
  z: number; // Depth coordinate
}

export interface DetectedHand {
  handedness: "Left" | "Right";
  score: number; // Confidence score (0.0 to 1.0)
  landmarks: NormalizedLandmark[]; // Expecting exactly 21 landmarks
}

export type CameraStatus = "OFF" | "REQUESTING" | "ACTIVE" | "ERROR";

export interface DrawingPoint {
  x: number;
  y: number;
  t: number; // Timestamp
}

export interface DrawingStroke {
  id: string;
  points: DrawingPoint[];
  color: string;
  width: number;
}
