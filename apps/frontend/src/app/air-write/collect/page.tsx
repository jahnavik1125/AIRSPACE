"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { ArrowLeft, Trash2, Check, RefreshCw, Layers, Sparkles } from "lucide-react";
import Link from "next/link";

import { useCamera } from "../../../hooks/useCamera";
import { useHandTracking } from "../../../hooks/useHandTracking";
import { useSpatialWebSocket } from "../../../hooks/useSpatialWebSocket";
import { CameraFeed } from "../../../components/camera/CameraFeed";
import { CameraOverlay } from "../../../components/camera/CameraOverlay";
import { PerformanceHUD } from "../../../components/status/PerformanceHUD";
import { classifyHandGesture } from "../../../utils/gestureClassifier";

interface TrajectoryPoint {
  x: number;
  y: number;
  z?: number;
  t: number;
  strokeId: string;
}

export default function DatasetCollectorPage() {
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

  // Dataset states
  const [isWriting, setIsWriting] = useState(true);
  const [strokes, setStrokes] = useState<TrajectoryPoint[][]>([]);
  const [currentTarget, setCurrentTarget] = useState("A");
  const [stats, setStats] = useState<{ total_samples: number; samples_per_class: Record<string, number> } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Canvas drawing structures
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const currentStrokeRef = useRef<TrajectoryPoint[]>([]);
  const smoothedCursorRef = useRef<{ x: number; y: number } | null>(null);
  const foldedFramesRef = useRef<number>(0);
  const missingFramesRef = useRef<number>(0);
  const isActionActiveRef = useRef<boolean>(false);

  const EMA_BETA = 0.40;

  // Stream coordinates to websocket
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

  // Load and refresh stats
  const fetchStats = useCallback(async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/air-write/dataset/stats`);
      const data = await response.json();
      setStats(data);
    } catch (e) {
      console.error("Failed to load dataset statistics:", e);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Select target character
  const classesList = [
    ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)),
    ...Array.from({ length: 10 }, (_, i) => String(i))
  ];

  const rollTarget = useCallback(() => {
    if (!stats) {
      const rand = classesList[Math.floor(Math.random() * classesList.length)];
      setCurrentTarget(rand);
      return;
    }

    // Prioritize letters with fewer samples for collection balance
    const sorted = [...classesList].sort((a, b) => {
      const countA = stats.samples_per_class[a] || 0;
      const countB = stats.samples_per_class[b] || 0;
      return countA - countB;
    });

    // Select from top 5 lowest count classes
    const pool = sorted.slice(0, 5);
    const selected = pool[Math.floor(Math.random() * pool.length)];
    setCurrentTarget(selected);
  }, [stats]);

  // Auto roll target once stats load initially
  useEffect(() => {
    if (stats && currentTarget === "A") {
      rollTarget();
    }
  }, [stats, rollTarget, currentTarget]);

  // Canvas Redraw loop
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, width, height);

    // Draw grid patterns
    ctx.strokeStyle = "rgba(75, 85, 99, 0.05)";
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

    // Draw completed strokes
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#3b82f6"; // Blue lines

    strokes.forEach((stroke) => {
      if (stroke.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x * width, stroke[0].y * height);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x * width, stroke[i].y * height);
      }
      ctx.stroke();
    });

    // Draw current active stroke
    const current = currentStrokeRef.current;
    if (current.length >= 2) {
      ctx.beginPath();
      ctx.strokeStyle = "#eab308"; // Yellow lines
      ctx.moveTo(current[0].x * width, current[0].y * height);
      for (let i = 1; i < current.length; i++) {
        ctx.lineTo(current[i].x * width, current[i].y * height);
      }
      ctx.stroke();
    }

    // Draw pointer
    const cursor = smoothedCursorRef.current;
    if (cursor && cameraStatus === "ACTIVE") {
      const cx = cursor.x * width;
      const cy = cursor.y * height;
      const state = lastGesture?.state || "HOVER";

      let pointerColor = "#60a5fa";
      let radius = 6;
      if (state === "PINCH_START" || state === "PINCH_HOLD" || state === "DRAG") {
        pointerColor = "#eab308";
        radius = 8;
      }

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      ctx.fillStyle = pointerColor;
      ctx.fill();
    }
  }, [strokes, cameraStatus, lastGesture]);

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

  useEffect(() => {
    handleResize();
    const observer = new ResizeObserver(() => handleResize());
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, [handleResize]);

  // Coordinates tracking loop
  useEffect(() => {
    if (!isWriting) return;

    const hand = hands[0];
    const hasHand = Boolean(hand && cameraStatus === "ACTIVE");

    if (hasHand || (lastGesture && wsConnected)) {
      missingFramesRef.current = 0;
      const rawX = hasHand ? hand.landmarks[8].x : lastGesture!.coordinates.x;
      const rawY = hasHand ? hand.landmarks[8].y : lastGesture!.coordinates.y;
      const gesture = hasHand ? classifyHandGesture(hand.landmarks) : (lastGesture?.gesture || "NONE");
      const wsState = lastGesture?.state || "HOVER";

      const mirroredX = 1.0 - rawX;

      if (!smoothedCursorRef.current) {
        smoothedCursorRef.current = { x: mirroredX, y: rawY };
      } else {
        smoothedCursorRef.current = {
          x: EMA_BETA * mirroredX + (1 - EMA_BETA) * smoothedCursorRef.current.x,
          y: EMA_BETA * rawY + (1 - EMA_BETA) * smoothedCursorRef.current.y
        };
      }

      const smoothed = smoothedCursorRef.current;
      const newPt: TrajectoryPoint = {
        x: smoothed.x,
        y: smoothed.y,
        t: Date.now(),
        strokeId: `stroke-${Date.now()}`
      };

      const isIndexPoint = gesture === "INDEX_POINT";
      const isPinch = gesture === "PINCH" || wsState === "PINCH_START" || wsState === "PINCH_HOLD" || wsState === "DRAG";
      const isDrawing = isIndexPoint || isPinch;
      isActionActiveRef.current = isDrawing;

      if (isDrawing) {
        foldedFramesRef.current = 0;
        currentStrokeRef.current.push(newPt);
      } else {
        foldedFramesRef.current += 1;
        if (foldedFramesRef.current >= 5 && currentStrokeRef.current.length > 0) {
          setStrokes((prev) => [...prev, [...currentStrokeRef.current]]);
          currentStrokeRef.current = [];
        }
      }
    } else {
      missingFramesRef.current += 1;
      if (missingFramesRef.current >= 6) {
        if (currentStrokeRef.current.length >= 2) {
          setStrokes((prev) => [...prev, [...currentStrokeRef.current]]);
        }
        smoothedCursorRef.current = null;
        currentStrokeRef.current = [];
        isActionActiveRef.current = false;
      }
    }

    drawCanvas();
  }, [hands, cameraStatus, lastGesture, isWriting, wsConnected, drawCanvas]);

  const handleClear = () => {
    setStrokes([]);
    currentStrokeRef.current = [];
    drawCanvas();
  };

  const handleSave = async () => {
    if (strokes.length === 0) return;
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/air-write/sample`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: currentTarget,
          strokes: strokes.map((stroke) =>
            stroke.map((pt) => ({
              x: pt.x,
              y: pt.y,
              z: pt.z || 0.0,
              timestamp: pt.t
            }))
          )
        })
      });

      if (!response.ok) throw new Error("Failed to save dataset sample");

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 1500);

      // Refresh Stats & Roll next target letter
      await fetchStats();
      handleClear();
    } catch (e) {
      console.error(e);
      alert("Error saving coordinate samples JSON to datasets/ folder.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    rollTarget();
    handleClear();
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0b0f19] text-[#f3f4f6] min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#0f172a] px-6 py-4 flex justify-between items-center z-30">
        <div className="flex items-center gap-3">
          <Link href="/air-write" className="p-2 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-white transition">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-md font-bold tracking-wider text-white">DATASET RECORDER STUDIO</h1>
            <p className="text-[10px] text-gray-400 font-mono">Custom Trajectories Dataset Collection Suite</p>
          </div>
        </div>
      </header>

      {/* Main layout */}
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

          <PerformanceHUD
            handDetected={hands.length > 0}
            gesture={lastGesture?.gesture || "--"}
            confidence={lastGesture ? 1.0 : "--"}
            fps={trackingFps}
            latency={trackingLatency}
            wsStatus={wsConnected ? "CONNECTED" : "DISCONNECTED"}
            sessionId={sessionId}
            dbSessionId={dbSessionId}
          />
        </div>

        {/* Center Column: Draw Target canvas (ColSpan: 5) */}
        <div className="lg:col-span-5 flex flex-col gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">Recording Canvas</h2>
          
          <div ref={containerRef} className="relative w-full h-[450px] md:h-[500px] rounded-xl bg-[#0f172a] border border-gray-800 overflow-hidden shadow-2xl flex flex-col">
            <canvas ref={canvasRef} className="flex-1 w-full h-full cursor-none z-10" />

            {/* Target overlay card */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20 pointer-events-none">
              <div className="px-4 py-2 rounded-xl bg-blue-600/90 text-white font-bold text-lg flex items-center gap-2 border border-blue-500 shadow-lg">
                <Sparkles className="h-5 w-5 text-yellow-300 animate-pulse" />
                Write: {currentTarget}
              </div>
              <button
                onClick={handleClear}
                disabled={strokes.length === 0}
                className="p-2.5 rounded-lg bg-gray-900 hover:bg-red-950 border border-gray-700 hover:border-red-950 text-gray-400 hover:text-red-400 transition pointer-events-auto"
                aria-label="Clear Canvas content"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {/* Success popup notifier */}
            {saveSuccess && (
              <div className="absolute inset-0 bg-[#0f172a]/95 flex flex-col items-center justify-center text-center z-30 animate-fade-in">
                <div className="h-16 w-16 rounded-full bg-green-950 border border-green-500 flex items-center justify-center mb-4">
                  <Check className="h-8 w-8 text-green-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Sample Saved!</h3>
                <p className="text-xs text-gray-500 font-mono mt-1">JSON file written to datasets/air-writing/raw/</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleSave}
              disabled={strokes.length === 0 || isSaving}
              className="py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-bold text-white shadow-xl shadow-blue-500/10 transition disabled:opacity-50"
            >
              {isSaving ? "Saving JSON..." : "Save Sample"}
            </button>
            <button
              onClick={handleSkip}
              className="py-3 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-sm font-bold text-gray-400 hover:text-white transition"
            >
              Skip target
            </button>
          </div>
        </div>

        {/* Right Column: Class statistics stats (ColSpan: 3) */}
        <div className="lg:col-span-3 flex flex-col gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">Dataset Diagnostics</h2>
          <div className="rounded-xl bg-[#0f172a] border border-gray-800 p-5 flex flex-col h-[560px]">
            <div className="flex justify-between items-center pb-3 border-b border-gray-800">
              <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wide">
                Samples Logged
              </h3>
              <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-400 font-mono font-bold text-[10px]">
                Total: {stats?.total_samples || 0}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto mt-4 pr-1 scrollbar-thin scrollbar-thumb-gray-800 grid grid-cols-2 gap-2 text-xs font-mono">
              {classesList.map((char) => {
                const count = stats?.samples_per_class[char] || 0;
                return (
                  <div key={char} className="flex items-center justify-between px-3 py-1.5 rounded bg-gray-950 border border-gray-850">
                    <span className="font-bold text-gray-400">Class {char}:</span>
                    <span className={`font-bold ${count > 0 ? "text-green-400" : "text-gray-600"}`}>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
export type DatasetCollectorPageType = typeof DatasetCollectorPage;
