"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { Camera, RefreshCw, Edit, Trash2, Check, X, ArrowLeft, Space, Delete, ChevronRight, Play } from "lucide-react";
import Link from "next/link";

import { useCamera } from "../../hooks/useCamera";
import { useHandTracking } from "../../hooks/useHandTracking";
import { useSpatialWebSocket } from "../../hooks/useSpatialWebSocket";
import { CameraFeed } from "../../components/camera/CameraFeed";
import { CameraOverlay } from "../../components/camera/CameraOverlay";
import { PerformanceHUD } from "../../components/status/PerformanceHUD";
import { classifyHandGesture } from "../../utils/gestureClassifier";

// Ordered coordinate mapping types for ocr
interface TrajectoryPoint {
  x: number;
  y: number;
  z?: number;
  t: number;
  strokeId: string;
}

export default function AirWritePage() {
  const {
    status: cameraStatus,
    devices,
    activeDeviceId,
    error: cameraError,
    videoRef,
    startCamera,
    stopCamera,
    switchCamera
  } = useCamera();

  const {
    hands,
    fps: trackingFps,
    latency: trackingLatency
  } = useHandTracking(videoRef, cameraStatus === "ACTIVE");

  const {
    connected: wsConnected,
    sessionId,
    dbSessionId,
    lastGesture,
    sendMessage
  } = useSpatialWebSocket();

  // Handwriting states
  const [isWriting, setIsWriting] = useState(false);
  const [strokes, setStrokes] = useState<TrajectoryPoint[][]>([]);
  const [leftStrokes, setLeftStrokes] = useState<TrajectoryPoint[][]>([]);
  const [rightStrokes, setRightStrokes] = useState<TrajectoryPoint[][]>([]);
  const [autoRecognize, setAutoRecognize] = useState(false);
  const [activeHandMode, setActiveHandMode] = useState<"LEFT" | "RIGHT" | "BOTH">("BOTH");
  const [accumulatedText, setAccumulatedText] = useState("");
  
  // OCR prediction state
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [predictionResult, setPredictionResult] = useState<{
    db_writing_session_id: number;
    predicted_character: string;
    confidence: number;
    top_predictions: [string, number][];
  } | null>(null);
  const [leftPredictionResult, setLeftPredictionResult] = useState<{
    db_writing_session_id: number;
    predicted_character: string;
    confidence: number;
    top_predictions: [string, number][];
  } | null>(null);
  const [rightPredictionResult, setRightPredictionResult] = useState<{
    db_writing_session_id: number;
    predicted_character: string;
    confidence: number;
    top_predictions: [string, number][];
  } | null>(null);
  
  const [correctionMode, setCorrectionMode] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);

  // Canvas refs for high-frequency tracking redraws
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const currentStrokeRef = useRef<TrajectoryPoint[]>([]);
  const smoothedCursorRef = useRef<{ x: number; y: number } | null>(null);

  const leftCurrentStrokeRef = useRef<TrajectoryPoint[]>([]);
  const rightCurrentStrokeRef = useRef<TrajectoryPoint[]>([]);
  const leftSmoothedCursorRef = useRef<{ x: number; y: number } | null>(null);
  const rightSmoothedCursorRef = useRef<{ x: number; y: number } | null>(null);

  const leftMissingFramesRef = useRef<number>(0);
  const rightMissingFramesRef = useRef<number>(0);
  const leftFoldedFramesRef = useRef<number>(0);
  const rightFoldedFramesRef = useRef<number>(0);
  const leftLastPointTimeRef = useRef<number>(0);
  const rightLastPointTimeRef = useRef<number>(0);
  const lastAutoRecognizeTimeRef = useRef<number>(0);

  const EMA_BETA = 0.40;

  // Stream coordinates to websocket at high frequency (mirroring active pointer)
  useEffect(() => {
    if (wsConnected && cameraStatus === "ACTIVE" && hands.length > 0) {
      sendMessage({
        type: "COORDINATE_STREAM",
        payload: {
          hands: hands.map((hand) => ({
            handedness: hand.handedness,
            score: hand.score,
            landmarks: hand.landmarks.map((lm) => ({
              x: lm.x,
              y: lm.y,
              z: lm.z
            }))
          })),
          timestamp: Date.now()
        }
      });
    }
  }, [hands, wsConnected, cameraStatus, sendMessage]);

  // Redraw canvas loop
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, width, height);

    // Draw grid patterns
    ctx.strokeStyle = "rgba(75, 85, 99, 0.06)";
    ctx.lineWidth = 1;
    const grid = 40;
    for (let x = 0; x < width; x += grid) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += grid) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 1. Draw Left Hand Strokes (Blue)
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#3b82f6";
    leftStrokes.forEach((stroke) => {
      if (stroke.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x * width, stroke[0].y * height);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x * width, stroke[i].y * height);
      }
      ctx.stroke();
    });

    // Draw Left Hand Active Stroke (Cyan)
    const leftCurrent = leftCurrentStrokeRef.current;
    if (leftCurrent.length >= 2) {
      ctx.beginPath();
      ctx.strokeStyle = "#06b6d4";
      ctx.moveTo(leftCurrent[0].x * width, leftCurrent[0].y * height);
      for (let i = 1; i < leftCurrent.length; i++) {
        ctx.lineTo(leftCurrent[i].x * width, leftCurrent[i].y * height);
      }
      ctx.stroke();
    }

    // 2. Draw Right Hand Strokes (Emerald)
    ctx.strokeStyle = "#10b981";
    rightStrokes.forEach((stroke) => {
      if (stroke.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x * width, stroke[0].y * height);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x * width, stroke[i].y * height);
      }
      ctx.stroke();
    });

    // Draw Right Hand Active Stroke (Neon Green)
    const rightCurrent = rightCurrentStrokeRef.current;
    if (rightCurrent.length >= 2) {
      ctx.beginPath();
      ctx.strokeStyle = "#22c55e";
      ctx.moveTo(rightCurrent[0].x * width, rightCurrent[0].y * height);
      for (let i = 1; i < rightCurrent.length; i++) {
        ctx.lineTo(rightCurrent[i].x * width, rightCurrent[i].y * height);
      }
      ctx.stroke();
    }

    // 3. Draw Left Hand Cursor (Blue)
    const leftCursor = leftSmoothedCursorRef.current;
    if (leftCursor && cameraStatus === "ACTIVE") {
      const cx = leftCursor.x * width;
      const cy = leftCursor.y * height;
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
      ctx.fillStyle = "#60a5fa";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 11, 0, 2 * Math.PI);
      ctx.strokeStyle = "rgba(96, 165, 250, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 4. Draw Right Hand Cursor (Green)
    const rightCursor = rightSmoothedCursorRef.current;
    if (rightCursor && cameraStatus === "ACTIVE") {
      const cx = rightCursor.x * width;
      const cy = rightCursor.y * height;
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
      ctx.fillStyle = "#4ade80";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 11, 0, 2 * Math.PI);
      ctx.strokeStyle = "rgba(74, 222, 128, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }, [leftStrokes, rightStrokes, cameraStatus]);

  // Handle Resize scaling
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      drawCanvas();
    }
  }, [drawCanvas]);

  // Bind resize observer
  useEffect(() => {
    handleResize();
    const observer = new ResizeObserver(() => handleResize());
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, [handleResize]);

  // Local gesture-driven two-hand trajectory recorder loop
  useEffect(() => {
    if (!isWriting) {
      leftSmoothedCursorRef.current = null;
      rightSmoothedCursorRef.current = null;
      leftCurrentStrokeRef.current = [];
      rightCurrentStrokeRef.current = [];
      leftMissingFramesRef.current = 0;
      rightMissingFramesRef.current = 0;
      drawCanvas();
      return;
    }

    const now = Date.now();
    const leftHand = hands.find((h) => h.handedness === "Left");
    const rightHand = hands.find((h) => h.handedness === "Right");

    // 1. Process Left Hand
    if (leftHand && (activeHandMode === "LEFT" || activeHandMode === "BOTH")) {
      leftMissingFramesRef.current = 0;
      const indexTip = leftHand.landmarks[8];
      const mirroredX = 1.0 - indexTip.x;
      const rawY = indexTip.y;

      if (!leftSmoothedCursorRef.current) {
        leftSmoothedCursorRef.current = { x: mirroredX, y: rawY };
      } else {
        leftSmoothedCursorRef.current = {
          x: EMA_BETA * mirroredX + (1 - EMA_BETA) * leftSmoothedCursorRef.current.x,
          y: EMA_BETA * rawY + (1 - EMA_BETA) * leftSmoothedCursorRef.current.y
        };
      }

      const smoothed = leftSmoothedCursorRef.current;
      const newPt: TrajectoryPoint = {
        x: smoothed.x,
        y: smoothed.y,
        t: now,
        strokeId: `l-stroke-${now}`
      };

      const gesture = classifyHandGesture(leftHand.landmarks);
      if (gesture === "INDEX_POINT") {
        leftFoldedFramesRef.current = 0;
        leftCurrentStrokeRef.current.push(newPt);
        leftLastPointTimeRef.current = now;
      } else {
        leftFoldedFramesRef.current += 1;
        if (leftFoldedFramesRef.current >= 5) {
          if (leftCurrentStrokeRef.current.length >= 2) {
            setLeftStrokes((prev) => [...prev, [...leftCurrentStrokeRef.current]]);
          }
          leftCurrentStrokeRef.current = [];
        }
      }
    } else {
      leftMissingFramesRef.current += 1;
      leftFoldedFramesRef.current = 0;
      if (leftMissingFramesRef.current >= 6) { // 6 frames grace period
        if (leftCurrentStrokeRef.current.length >= 2) {
          setLeftStrokes((prev) => [...prev, [...leftCurrentStrokeRef.current]]);
        }
        leftCurrentStrokeRef.current = [];
        leftSmoothedCursorRef.current = null;
      }
    }

    // 2. Process Right Hand
    if (rightHand && (activeHandMode === "RIGHT" || activeHandMode === "BOTH")) {
      rightMissingFramesRef.current = 0;
      const indexTip = rightHand.landmarks[8];
      const mirroredX = 1.0 - indexTip.x;
      const rawY = indexTip.y;

      if (!rightSmoothedCursorRef.current) {
        rightSmoothedCursorRef.current = { x: mirroredX, y: rawY };
      } else {
        rightSmoothedCursorRef.current = {
          x: EMA_BETA * mirroredX + (1 - EMA_BETA) * rightSmoothedCursorRef.current.x,
          y: EMA_BETA * rawY + (1 - EMA_BETA) * rightSmoothedCursorRef.current.y
        };
      }

      const smoothed = rightSmoothedCursorRef.current;
      const newPt: TrajectoryPoint = {
        x: smoothed.x,
        y: smoothed.y,
        t: now,
        strokeId: `r-stroke-${now}`
      };

      const gesture = classifyHandGesture(rightHand.landmarks);
      if (gesture === "INDEX_POINT") {
        rightFoldedFramesRef.current = 0;
        rightCurrentStrokeRef.current.push(newPt);
        rightLastPointTimeRef.current = now;
      } else {
        rightFoldedFramesRef.current += 1;
        if (rightFoldedFramesRef.current >= 5) {
          if (rightCurrentStrokeRef.current.length >= 2) {
            setRightStrokes((prev) => [...prev, [...rightCurrentStrokeRef.current]]);
          }
          rightCurrentStrokeRef.current = [];
        }
      }
    } else {
      rightMissingFramesRef.current += 1;
      rightFoldedFramesRef.current = 0;
      if (rightMissingFramesRef.current >= 6) { // 6 frames grace period
        if (rightCurrentStrokeRef.current.length >= 2) {
          setRightStrokes((prev) => [...prev, [...rightCurrentStrokeRef.current]]);
        }
        rightCurrentStrokeRef.current = [];
        rightSmoothedCursorRef.current = null;
      }
    }

    drawCanvas();
  }, [hands, isWriting, activeHandMode, drawCanvas]);

  // Auto-recognize checker loop
  useEffect(() => {
    if (!autoRecognize || !isWriting) return;

    const timer = setInterval(() => {
      const now = Date.now();
      
      // Auto-recognize left hand if idle for 1.5s
      if (
        leftStrokes.length > 0 &&
        leftCurrentStrokeRef.current.length === 0 &&
        now - leftLastPointTimeRef.current > 1500 &&
        now - lastAutoRecognizeTimeRef.current > 2000
      ) {
        lastAutoRecognizeTimeRef.current = now;
        triggerLeftRecognition();
      }

      // Auto-recognize right hand if idle for 1.5s
      if (
        rightStrokes.length > 0 &&
        rightCurrentStrokeRef.current.length === 0 &&
        now - rightLastPointTimeRef.current > 1500 &&
        now - lastAutoRecognizeTimeRef.current > 2000
      ) {
        lastAutoRecognizeTimeRef.current = now;
        triggerRightRecognition();
      }
    }, 300);

    return () => clearInterval(timer);
  }, [autoRecognize, isWriting, leftStrokes, rightStrokes]);

  // Left Hand controls functions
  const handleLeftUndo = () => {
    setLeftStrokes((prev) => prev.slice(0, -1));
    leftCurrentStrokeRef.current = [];
    setLeftPredictionResult(null);
  };

  const handleLeftClear = () => {
    setLeftStrokes([]);
    leftCurrentStrokeRef.current = [];
    setLeftPredictionResult(null);
    setOcrError(null);
  };

  const triggerLeftRecognition = async () => {
    if (leftStrokes.length === 0) return;
    setIsRecognizing(true);
    setOcrError(null);
    setLeftPredictionResult(null);
    setCorrectionMode(false);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/air-write/recognize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          db_session_id: dbSessionId || 0,
          strokes: leftStrokes.map((stroke) =>
            stroke.map((pt) => ({
              x: pt.x,
              y: pt.y,
              z: pt.z || 0.0,
              timestamp: pt.t
            }))
          )
        })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      setLeftPredictionResult(data);
      setPredictionResult(data);
    } catch (err: any) {
      console.error("Left recognition call failed:", err);
      setOcrError("Failed to resolve character coordinates. Check backend server.");
    } finally {
      setIsRecognizing(false);
    }
  };

  const handleLeftAccept = async () => {
    if (!leftPredictionResult) return;
    
    const char = leftPredictionResult.predicted_character;
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      await fetch(`${apiUrl}/api/air-write/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          db_writing_session_id: leftPredictionResult.db_writing_session_id,
          confirmed_label: char
        })
      });
    } catch (e) {
      console.warn("Failed to confirm Left character persistence:", e);
    }

    if (char !== "UNKNOWN") {
      setAccumulatedText((prev) => prev + char);
    }
    handleLeftClear();
  };

  const handleLeftCorrect = async (correctChar: string) => {
    if (!leftPredictionResult) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      await fetch(`${apiUrl}/api/air-write/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          db_writing_session_id: leftPredictionResult.db_writing_session_id,
          confirmed_label: correctChar
        })
      });
    } catch (e) {
      console.warn("Failed to write Left manual correction:", e);
    }

    setAccumulatedText((prev) => prev + correctChar);
    setCorrectionMode(false);
    handleLeftClear();
  };

  // Right Hand controls functions
  const handleRightUndo = () => {
    setRightStrokes((prev) => prev.slice(0, -1));
    rightCurrentStrokeRef.current = [];
    setRightPredictionResult(null);
  };

  const handleRightClear = () => {
    setRightStrokes([]);
    rightCurrentStrokeRef.current = [];
    setRightPredictionResult(null);
    setOcrError(null);
  };

  const triggerRightRecognition = async () => {
    if (rightStrokes.length === 0) return;
    setIsRecognizing(true);
    setOcrError(null);
    setRightPredictionResult(null);
    setCorrectionMode(false);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/air-write/recognize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          db_session_id: dbSessionId || 0,
          strokes: rightStrokes.map((stroke) =>
            stroke.map((pt) => ({
              x: pt.x,
              y: pt.y,
              z: pt.z || 0.0,
              timestamp: pt.t
            }))
          )
        })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      setRightPredictionResult(data);
      setPredictionResult(data);
    } catch (err: any) {
      console.error("Right recognition call failed:", err);
      setOcrError("Failed to resolve character coordinates. Check backend server.");
    } finally {
      setIsRecognizing(false);
    }
  };

  const handleRightAccept = async () => {
    if (!rightPredictionResult) return;
    
    const char = rightPredictionResult.predicted_character;
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      await fetch(`${apiUrl}/api/air-write/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          db_writing_session_id: rightPredictionResult.db_writing_session_id,
          confirmed_label: char
        })
      });
    } catch (e) {
      console.warn("Failed to confirm Right character persistence:", e);
    }

    if (char !== "UNKNOWN") {
      setAccumulatedText((prev) => prev + char);
    }
    handleRightClear();
  };

  const handleRightCorrect = async (correctChar: string) => {
    if (!rightPredictionResult) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      await fetch(`${apiUrl}/api/air-write/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          db_writing_session_id: rightPredictionResult.db_writing_session_id,
          confirmed_label: correctChar
        })
      });
    } catch (e) {
      console.warn("Failed to write Right manual correction:", e);
    }

    setAccumulatedText((prev) => prev + correctChar);
    setCorrectionMode(false);
    handleRightClear();
  };

  // Legacy mappings for tests & compatibility
  const handleUndo = handleRightUndo;
  const handleClear = handleRightClear;
  const triggerRecognition = triggerRightRecognition;
  const handleAccept = handleRightAccept;
  const handleCorrect = handleRightCorrect;

  const classesList = [
    ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)),
    ...Array.from({ length: 10 }, (_, i) => String(i))
  ];

  return (
    <div className="flex-1 flex flex-col bg-[#0b0f19] text-[#f3f4f6] min-h-screen">
      {/* Top Header */}
      <header className="border-b border-gray-800 bg-[#0f172a] px-6 py-4 flex justify-between items-center z-30">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-white transition">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-md font-bold tracking-wider text-white">AIR WRITE</h1>
            <p className="text-[10px] text-gray-400 font-mono">Touchless Spatially Tracked OCR Pipeline</p>
          </div>
        </div>
        
        {/* Collection Studio Link */}
        <Link href="/air-write/collect" className="px-3 py-1.5 rounded-lg bg-blue-950/60 hover:bg-blue-900 border border-blue-800/30 text-xs font-semibold text-blue-400 hover:text-blue-300 transition flex items-center gap-1.5">
          <Play className="h-3 w-3" />
          Collect Studio
        </Link>
      </header>

      {/* Main Grid Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Live camera input (ColSpan: 4) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">Tracking Camera</h2>
            <div className="relative">
              <CameraFeed
                videoRef={videoRef}
                status={cameraStatus}
                devices={devices}
                activeDeviceId={activeDeviceId}
                error={cameraError}
                startCamera={() => startCamera()}
                stopCamera={stopCamera}
                switchCamera={switchCamera}
              />
              <CameraOverlay hands={hands} active={cameraStatus === "ACTIVE"} />
            </div>
          </div>

          {/* Core HUD status parameters */}
          <PerformanceHUD
            handDetected={hands.length > 0}
            gesture={hands.length > 0 ? (hands.map(h => `${h.handedness === "Left" ? "LH" : "RH"}: ${classifyHandGesture(h.landmarks)}`).join(" | ")) : "--"}
            confidence={hands.length > 0 ? 1.0 : "--"}
            fps={trackingFps}
            latency={trackingLatency}
            wsStatus={wsConnected ? "CONNECTED" : "DISCONNECTED"}
            sessionId={sessionId}
            dbSessionId={dbSessionId}
          />
        </div>

        {/* Center Column: Writing Board Canvas (ColSpan: 5) */}
        <div className="lg:col-span-5 flex flex-col gap-2">
          <div className="flex justify-between items-center gap-2 flex-wrap">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">Writing Board Area</h2>
            
            <div className="flex items-center gap-2">
              {/* Active Hand Mode selector */}
              <select
                value={activeHandMode}
                onChange={(e) => setActiveHandMode(e.target.value as any)}
                className="bg-gray-900 border border-gray-800 rounded px-2 py-1 text-xs font-bold text-gray-300 focus:outline-none"
              >
                <option value="BOTH">Both Hands</option>
                <option value="LEFT">Left Hand Only</option>
                <option value="RIGHT">Right Hand Only</option>
              </select>

              {/* Start/Stop Writing toggle controls */}
              <button
                onClick={() => setIsWriting(!isWriting)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition focus:ring-2 focus:ring-blue-400 focus:outline-none ${
                  isWriting
                    ? "bg-green-950/80 border-green-700 text-green-400"
                    : "bg-blue-600 hover:bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/10"
                }`}
              >
                {isWriting ? "Writing Active" : "Start Writing"}
              </button>
            </div>
          </div>

          <div ref={containerRef} className="relative w-full h-[400px] md:h-[450px] rounded-xl bg-[#0f172a] border border-gray-800 overflow-hidden shadow-2xl flex flex-col">
            <canvas ref={canvasRef} className="flex-1 w-full h-full cursor-none z-10" />

            {/* Quick Action controls bar for LEFT hand */}
            <div className="absolute top-4 left-4 flex items-center gap-2 z-20 pointer-events-none">
              <div className="px-2 py-1 rounded bg-blue-950/90 border border-blue-800 text-[10px] font-bold text-blue-400 flex items-center gap-1">
                <Edit className="h-3 w-3" />
                Left Hand (Blue)
              </div>
              <div className="flex items-center gap-1.5 pointer-events-auto">
                <button
                  onClick={handleLeftUndo}
                  disabled={leftStrokes.length === 0}
                  className="px-2 py-1 rounded bg-gray-900 border border-gray-800 hover:border-gray-700 text-[10px] font-bold text-gray-300 disabled:opacity-50 transition"
                >
                  Undo
                </button>
                <button
                  onClick={handleLeftClear}
                  disabled={leftStrokes.length === 0}
                  className="p-1 rounded bg-gray-900 border border-gray-800 hover:bg-red-950 hover:border-red-900 text-gray-400 hover:text-red-400 transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Quick Action controls bar for RIGHT hand */}
            <div className="absolute top-4 right-4 flex items-center gap-2 z-20 pointer-events-none">
              <div className="px-2 py-1 rounded bg-emerald-950/90 border border-emerald-800 text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                <Edit className="h-3 w-3" />
                Right Hand (Green)
              </div>
              <div className="flex items-center gap-1.5 pointer-events-auto">
                <button
                  onClick={handleRightUndo}
                  disabled={rightStrokes.length === 0}
                  className="px-2 py-1 rounded bg-gray-900 border border-gray-800 hover:border-gray-700 text-[10px] font-bold text-gray-300 disabled:opacity-50 transition"
                >
                  Undo
                </button>
                <button
                  onClick={handleRightClear}
                  disabled={rightStrokes.length === 0}
                  className="p-1 rounded bg-gray-900 border border-gray-800 hover:bg-red-950 hover:border-red-900 text-gray-400 hover:text-red-400 transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Inactive overlay panel */}
            {!isWriting && (
              <div className="absolute inset-0 bg-[#0b0f19]/70 flex flex-col items-center justify-center p-6 text-center z-15 backdrop-blur-[1px]">
                <h3 className="text-md font-semibold text-gray-400 mb-1">Canvas Locked</h3>
                <p className="text-xs text-gray-500 max-w-xs mb-4">
                  Click &apos;Start Writing&apos; and point either index finger to write without pinching.
                </p>
              </div>
            )}
          </div>

          {/* Auto recognize checkbox */}
          <div className="flex items-center gap-2 px-1">
            <input
              type="checkbox"
              id="auto-recognize-check"
              checked={autoRecognize}
              onChange={(e) => setAutoRecognize(e.target.checked)}
              className="rounded bg-gray-950 border-gray-800 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
            />
            <label htmlFor="auto-recognize-check" className="text-xs font-semibold text-gray-400 select-none">
              Auto Recognize (triggers after 1.5 seconds of hand inactivity)
            </label>
          </div>
        </div>

        {/* Right Column: OCR Results & Notepad (ColSpan: 3) */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">OCR Recognition Output</h2>
            
            {/* 1. Tabbed OCR Results Card */}
            <div className="rounded-xl bg-[#0f172a] border border-gray-800 p-4 shadow-2xl flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-1 bg-gray-950 p-1 rounded-lg border border-gray-850">
                <button
                  onClick={() => setActiveHandMode("LEFT")}
                  className={`py-1 rounded text-2xs font-bold transition ${
                    activeHandMode === "LEFT"
                      ? "bg-blue-900 border border-blue-800 text-blue-300"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  Left Hand
                </button>
                <button
                  onClick={() => setActiveHandMode("RIGHT")}
                  className={`py-1 rounded text-2xs font-bold transition ${
                    activeHandMode === "RIGHT"
                      ? "bg-emerald-900 border border-emerald-800 text-emerald-300"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  Right Hand
                </button>
              </div>

              {/* LEFT HAND WORKSPACE VIEW */}
              {activeHandMode === "LEFT" && (
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center text-xs text-gray-400 font-semibold font-mono pb-2 border-b border-gray-850">
                    <span>LEFT HAND BUFFER</span>
                    <span className="text-blue-400 font-bold">{leftStrokes.length} Strokes</span>
                  </div>

                  <button
                    onClick={triggerLeftRecognition}
                    disabled={leftStrokes.length === 0 || isRecognizing}
                    className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition disabled:opacity-50"
                  >
                    Recognize Left Hand
                  </button>

                  {ocrError && (
                    <div className="text-xs text-red-400 py-2 text-center">{ocrError}</div>
                  )}

                  {!leftPredictionResult && !isRecognizing && !ocrError && (
                    <div className="text-xs text-gray-500 italic py-4 text-center">
                      Point left index to write, then recognize...
                    </div>
                  )}

                  {leftPredictionResult && !isRecognizing && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between bg-gray-900/40 p-2.5 rounded-lg border border-gray-850">
                        <div>
                          <div className="text-[9px] text-gray-500 font-mono">PREDICTED</div>
                          <div className="text-4xl font-extrabold text-blue-400 mt-0.5">
                            {leftPredictionResult.predicted_character}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[9px] text-gray-500 font-mono">CONFIDENCE</div>
                          <div className="text-base font-bold text-green-400 mt-0.5">
                            {(leftPredictionResult.confidence * 100).toFixed(0)}%
                          </div>
                        </div>
                      </div>

                      {/* Debug details HUD */}
                      <div className="p-2.5 rounded-lg bg-gray-950 text-3xs font-mono text-gray-400 space-y-1 border border-gray-850">
                        <div className="text-gray-500 font-bold uppercase tracking-wider text-2xs border-b border-gray-900 pb-1 mb-1">
                          DTW Debug HUD
                        </div>
                        <div>Matched: &apos;{leftPredictionResult.predicted_character}&apos;</div>
                        <div>Confidence: {leftPredictionResult.confidence.toFixed(4)}</div>
                        <div>Template: &apos;{leftPredictionResult.predicted_character}&apos;</div>
                        <div>Strokes: {leftStrokes.length}</div>
                        <div>Points: {leftStrokes.reduce((acc, s) => acc + s.length, 0)}</div>
                      </div>

                      {/* Accept/Correct buttons */}
                      {!correctionMode ? (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={handleLeftAccept}
                            className="py-1.5 rounded-lg bg-green-950 hover:bg-green-900 border border-green-800/40 text-xs font-semibold text-green-400 flex items-center justify-center gap-1 transition"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Accept
                          </button>
                          <button
                            onClick={() => setCorrectionMode(true)}
                            className="py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-700 text-xs font-semibold text-gray-400 flex items-center justify-center gap-1 transition"
                          >
                            Correct
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <div className="text-[10px] text-gray-500 font-mono">SELECT CORRECT CHARACTER:</div>
                          <div className="grid grid-cols-6 gap-1 max-h-[80px] overflow-y-auto p-1 bg-gray-950 rounded border border-gray-850">
                            {classesList.map((char) => (
                              <button
                                key={char}
                                onClick={() => handleLeftCorrect(char)}
                                className="py-1 rounded bg-gray-900 hover:bg-blue-600 border border-gray-800 text-[10px] font-bold text-gray-300 hover:text-white transition"
                              >
                                {char}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => setCorrectionMode(false)}
                            className="py-1 rounded bg-red-950/45 hover:bg-red-900/40 text-[10px] font-semibold text-red-400 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* RIGHT HAND WORKSPACE VIEW */}
              {(activeHandMode === "RIGHT" || activeHandMode === "BOTH") && (
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center text-xs text-gray-400 font-semibold font-mono pb-2 border-b border-gray-850">
                    <span>RIGHT HAND BUFFER</span>
                    <span className="text-emerald-400 font-bold">{rightStrokes.length} Strokes</span>
                  </div>

                  <button
                    onClick={triggerRightRecognition}
                    disabled={rightStrokes.length === 0 || isRecognizing}
                    className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition disabled:opacity-50"
                  >
                    Recognize Right Hand
                  </button>

                  {ocrError && (
                    <div className="text-xs text-red-400 py-2 text-center">{ocrError}</div>
                  )}

                  {!rightPredictionResult && !isRecognizing && !ocrError && (
                    <div className="text-xs text-gray-500 italic py-4 text-center">
                      Point right index to write, then recognize...
                    </div>
                  )}

                  {rightPredictionResult && !isRecognizing && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between bg-gray-900/40 p-2.5 rounded-lg border border-gray-850">
                        <div>
                          <div className="text-[9px] text-gray-500 font-mono">PREDICTED</div>
                          <div className="text-4xl font-extrabold text-emerald-400 mt-0.5">
                            {rightPredictionResult.predicted_character}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[9px] text-gray-500 font-mono">CONFIDENCE</div>
                          <div className="text-base font-bold text-green-400 mt-0.5">
                            {(rightPredictionResult.confidence * 100).toFixed(0)}%
                          </div>
                        </div>
                      </div>

                      {/* Debug details HUD */}
                      <div className="p-2.5 rounded-lg bg-gray-950 text-3xs font-mono text-gray-400 space-y-1 border border-gray-850">
                        <div className="text-gray-500 font-bold uppercase tracking-wider text-2xs border-b border-gray-900 pb-1 mb-1">
                          DTW Debug HUD
                        </div>
                        <div>Matched: &apos;{rightPredictionResult.predicted_character}&apos;</div>
                        <div>Confidence: {rightPredictionResult.confidence.toFixed(4)}</div>
                        <div>Template: &apos;{rightPredictionResult.predicted_character}&apos;</div>
                        <div>Strokes: {rightStrokes.length}</div>
                        <div>Points: {rightStrokes.reduce((acc, s) => acc + s.length, 0)}</div>
                      </div>

                      {/* Accept/Correct buttons */}
                      {!correctionMode ? (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={handleRightAccept}
                            className="py-1.5 rounded-lg bg-green-950 hover:bg-green-900 border border-green-800/40 text-xs font-semibold text-green-400 flex items-center justify-center gap-1 transition"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Accept
                          </button>
                          <button
                            onClick={() => setCorrectionMode(true)}
                            className="py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-700 text-xs font-semibold text-gray-400 flex items-center justify-center gap-1 transition"
                          >
                            Correct
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <div className="text-[10px] text-gray-500 font-mono">SELECT CORRECT CHARACTER:</div>
                          <div className="grid grid-cols-6 gap-1 max-h-[80px] overflow-y-auto p-1 bg-gray-950 rounded border border-gray-850">
                            {classesList.map((char) => (
                              <button
                                key={char}
                                onClick={() => handleRightCorrect(char)}
                                className="py-1 rounded bg-gray-900 hover:bg-blue-600 border border-gray-800 text-[10px] font-bold text-gray-300 hover:text-white transition"
                              >
                                {char}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => setCorrectionMode(false)}
                            className="py-1 rounded bg-red-950/45 hover:bg-red-900/40 text-[10px] font-semibold text-red-400 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 2. Text Accumulator Card */}
          <div className="flex flex-col gap-2 flex-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">Digital Notepad</h2>
            <div className="flex-1 rounded-xl bg-[#0f172a] border border-gray-800 p-5 flex flex-col justify-between gap-4">
              <div className="flex-1 min-h-[100px] rounded-lg bg-gray-950/60 border border-gray-850 p-4 font-mono text-lg text-white break-all select-all">
                {accumulatedText || <span className="text-gray-600 italic">Notepad empty...</span>}
              </div>

              {/* Pad controllers */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setAccumulatedText((prev) => prev + " ")}
                  className="py-2 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-850 text-xs font-semibold text-gray-300 flex items-center justify-center gap-1.5 transition"
                  aria-label="Insert Space"
                >
                  <Space className="h-3.5 w-3.5" />
                  Space
                </button>
                <button
                  onClick={() => setAccumulatedText((prev) => prev.slice(0, -1))}
                  className="py-2 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-850 text-xs font-semibold text-gray-300 flex items-center justify-center gap-1.5 transition"
                  aria-label="Delete Last Character"
                >
                  <Delete className="h-3.5 w-3.5" />
                  Delete
                </button>
                <button
                  onClick={() => setAccumulatedText("")}
                  className="py-2 rounded-lg bg-gray-900 hover:bg-red-950 border border-gray-850 hover:border-red-950/30 text-xs font-semibold text-gray-400 hover:text-red-400 flex items-center justify-center gap-1.5 transition"
                  aria-label="Clear Notepad Content"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
export type AirWritePageType = typeof AirWritePage;
