import React, { useEffect, useRef } from "react";
import { DetectedHand } from "../../types/spatial";

interface CameraOverlayProps {
  hands: DetectedHand[];
  active: boolean;
}

// MediaPipe standard 21 joints connections
const HAND_CONNECTIONS = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [0, 9], [9, 10], [10, 11], [11, 12],
  // Ring
  [0, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Knuckles base links
  [5, 9], [9, 13], [13, 17]
];

export function CameraOverlay({ hands, active }: CameraOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high-DPI scaling
    const rect = canvas.parentElement?.getBoundingClientRect();
    const width = rect?.width ?? 640;
    const height = rect?.height ?? 360;
    
    // Set display size
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    
    // Set buffer size
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (!active || hands.length === 0) return;

    hands.forEach((hand) => {
      const isRight = hand.handedness === "Right";
      // Mirror-friendly theme: Green for Right hand, Blue for Left hand
      const colorJoint = isRight ? "#22c55e" : "#3b82f6";
      const colorLine = isRight ? "rgba(34, 197, 150, 0.4)" : "rgba(59, 130, 246, 0.4)";

      // 1. Draw connections
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = colorLine;
      
      HAND_CONNECTIONS.forEach(([startIdx, endIdx]) => {
        const start = hand.landmarks[startIdx];
        const end = hand.landmarks[endIdx];

        if (start && end) {
          ctx.beginPath();
          ctx.moveTo(start.x * width, start.y * height);
          ctx.lineTo(end.x * width, end.y * height);
          ctx.stroke();
        }
      });

      // 2. Draw joints
      hand.landmarks.forEach((landmark, idx) => {
        ctx.beginPath();
        const x = landmark.x * width;
        const y = landmark.y * height;

        // Make critical control tips larger (Thumb tip 4, Index tip 8)
        if (idx === 4 || idx === 8) {
          ctx.arc(x, y, 6, 0, 2 * Math.PI);
          ctx.fillStyle = idx === 8 ? "#eab308" : "#a855f7"; // Yellow for index tip, purple for thumb
        } else {
          ctx.arc(x, y, 4, 0, 2 * Math.PI);
          ctx.fillStyle = colorJoint;
        }
        ctx.fill();

        // Add a subtle outer glow around fingertips
        if (idx === 4 || idx === 8) {
          ctx.beginPath();
          ctx.arc(x, y, 10, 0, 2 * Math.PI);
          ctx.strokeStyle = idx === 8 ? "rgba(234, 179, 8, 0.3)" : "rgba(168, 85, 247, 0.3)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });
    });
  }, [hands, active]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full transform -scale-x-100 pointer-events-none z-15 ${
        active ? "block" : "hidden"
      }`}
    />
  );
}
export type CameraOverlayPropsType = CameraOverlayProps;
