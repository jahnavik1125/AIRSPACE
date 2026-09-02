import { useState, useEffect, useRef } from "react";
import { DetectedHand } from "../types/spatial";

// Cache the hand landmarker instance at the module level so we only load WASM once
let landmarkerInstance: any = null;
let loadingPromise: Promise<any> | null = null;

async function loadHandLandmarker() {
  if (landmarkerInstance) return landmarkerInstance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      // Dynamic import to prevent Next.js SSR build errors
      const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
      
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm"
      );
      
      landmarkerInstance = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      
      return landmarkerInstance;
    } catch (err) {
      loadingPromise = null; // Clear cache on error so we can retry
      throw err;
    }
  })();

  return loadingPromise;
}

export function useHandTracking(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  cameraActive: boolean
) {
  const [hands, setHands] = useState<DetectedHand[]>([]);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [modelError, setModelError] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const [latency, setLatency] = useState(0);

  const [landmarker, setLandmarker] = useState<any>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const animationFrameIdRef = useRef<number | null>(null);

  // 1. Load the MediaPipe Landmarker once on mount
  useEffect(() => {
    let active = true;
    
    if (typeof window === "undefined" || typeof document === "undefined" || !document.createElement || process.env.NODE_ENV === "test") {
      setIsModelLoading(false);
      return;
    }
    
    loadHandLandmarker()
      .then((instance) => {
        if (active) {
          setLandmarker(instance);
          setIsModelLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load Hand Landmarker model:", err);
        if (active) {
          setModelError("Failed to initialize MediaPipe WASM model. Check internet connectivity.");
          setIsModelLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  // 2. Start high-frequency frame capture animation frame loop
  useEffect(() => {
    if (!cameraActive || !landmarker || !videoRef.current) {
      setHands([]);
      setFps(0);
      setLatency(0);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      return;
    }

    const video = videoRef.current;
    let frameCount = 0;
    let lastFpsUpdateTime = performance.now();

    const processFrame = () => {
      if (video.paused || video.ended) {
        animationFrameIdRef.current = requestAnimationFrame(processFrame);
        return;
      }

      const now = performance.now();
      const currentVideoTime = video.currentTime;

      // Check if a new video frame is actually ready
      if (currentVideoTime !== lastVideoTimeRef.current && video.readyState >= 3) {
        lastVideoTimeRef.current = currentVideoTime;

        try {
          const startTime = performance.now();
          const results = landmarker.detectForVideo(video, now);
          const endTime = performance.now();

          setLatency(Math.round(endTime - startTime));

          // Map landmarks from MediaPipe format to our typed DetectedHand structure
          const detected: DetectedHand[] = [];
          if (results.landmarks && results.landmarks.length > 0) {
            for (let i = 0; i < results.landmarks.length; i++) {
              const score = results.handedness[i]?.[0]?.score ?? 0.8;
              const rawHandedness = results.handedness[i]?.[0]?.categoryName ?? "Right";
              // Note: MediaPipe might label Left/Right relative to webcam mirroring.
              const handedness = rawHandedness === "Left" || rawHandedness === "Right" 
                ? rawHandedness 
                : "Right";
              
              detected.push({
                handedness,
                score,
                landmarks: results.landmarks[i]
              });
            }
          }
          setHands(detected);
        } catch (err) {
          console.error("Frame landmark processing error:", err);
        }

        frameCount++;
        if (now - lastFpsUpdateTime >= 1000) {
          setFps(Math.round((frameCount * 1000) / (now - lastFpsUpdateTime)));
          frameCount = 0;
          lastFpsUpdateTime = now;
        }
      }

      animationFrameIdRef.current = requestAnimationFrame(processFrame);
    };

    animationFrameIdRef.current = requestAnimationFrame(processFrame);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [cameraActive, landmarker, videoRef]);

  return {
    hands,
    isModelLoading,
    modelError,
    fps,
    latency
  };
}
export type UseHandTrackingReturn = ReturnType<typeof useHandTracking>;
