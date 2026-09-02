"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useCamera } from "../../hooks/useCamera";
import { useHandTracking } from "../../hooks/useHandTracking";
import { classifyHandGesture } from "../../utils/gestureClassifier";
import { recognizeShape, Point, ShapeType } from "../../utils/shapeRecognizer";
import {
  PenTool,
  Eraser,
  Shapes,
  Undo2,
  Redo2,
  Trash2,
  Download,
  Maximize2,
  Minimize2,
  Camera,
  CameraOff,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Home,
  CheckCircle2,
  Layers,
  Palette
} from "lucide-react";

export interface Stroke {
  id: string;
  points: Point[];
  color: string;
  width: number;
  isShape?: boolean;
  shapeType?: ShapeType;
}

const COLOR_PALETTE = [
  { label: "Electric Blue", value: "#3b82f6", glow: "rgba(59, 130, 246, 0.6)" },
  { label: "Neon Cyan", value: "#06b6d4", glow: "rgba(6, 182, 212, 0.6)" },
  { label: "Neon Purple", value: "#a855f7", glow: "rgba(168, 85, 247, 0.6)" },
  { label: "Neon Emerald", value: "#10b981", glow: "rgba(16, 185, 129, 0.6)" },
  { label: "Sunset Amber", value: "#f59e0b", glow: "rgba(245, 158, 11, 0.6)" },
  { label: "Pure White", value: "#ffffff", glow: "rgba(255, 255, 255, 0.5)" }
];

const STROKE_WIDTHS = [
  { label: "Fine", value: 3 },
  { label: "Medium", value: 6 },
  { label: "Bold", value: 10 }
];

interface SpatialWhiteboardProps {
  onExit?: () => void;
}

export function SpatialWhiteboard({ onExit }: SpatialWhiteboardProps) {
  // Camera & Tracking Hooks
  const { status: cameraStatus, videoRef, startCamera, stopCamera } = useCamera();
  const { hands, isModelLoading, fps, latency } = useHandTracking(videoRef, cameraStatus === "ACTIVE");

  // Whiteboard State
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [history, setHistory] = useState<Stroke[][]>([]);
  const [future, setFuture] = useState<Stroke[][]>([]);

  // Tool Controls
  const [selectedTool, setSelectedTool] = useState<"pen" | "eraser">("pen");
  const [selectedColor, setSelectedColor] = useState<string>("#3b82f6");
  const [selectedWidth, setSelectedWidth] = useState<number>(6);
  const [snapShapes, setSnapShapes] = useState<boolean>(true);
  const [showColorPicker, setShowColorPicker] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showCameraPIP, setShowCameraPIP] = useState<boolean>(true);

  // Status & Notification
  const [activeGesture, setActiveGesture] = useState<string>("NONE");
  const [activeMode, setActiveMode] = useState<"Drawing" | "Erasing" | "Idle">("Idle");
  const [shapeNotification, setShapeNotification] = useState<{ type: string; conf: number } | null>(null);

  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Two-hand stroke tracking buffers
  const leftStrokeRef = useRef<Point[]>([]);
  const rightStrokeRef = useRef<Point[]>([]);
  const leftSmoothedRef = useRef<Point | null>(null);
  const rightSmoothedRef = useRef<Point | null>(null);
  const leftFoldedCountRef = useRef<number>(0);
  const rightFoldedCountRef = useRef<number>(0);

  // Mouse / Touch drawing fallback
  const isMouseDownRef = useRef<boolean>(false);
  const mouseStrokeRef = useRef<Point[]>([]);

  // Start Camera automatically on mount
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Handle Window Resize for full-viewport canvas
  const updateCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }, []);

  useEffect(() => {
    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);
    return () => window.removeEventListener("resize", updateCanvasSize);
  }, [updateCanvasSize]);

  // Fullscreen Handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Undo / Redo
  const handleUndo = useCallback(() => {
    if (strokes.length === 0) return;
    const previous = history.length > 0 ? history[history.length - 1] : [];
    setFuture((prev) => [strokes, ...prev]);
    setHistory((prev) => prev.slice(0, -1));
    setStrokes(previous);
  }, [strokes, history]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setHistory((prev) => [...prev, strokes]);
    setFuture((prev) => prev.slice(1));
    setStrokes(next);
  }, [strokes, future]);

  const handleClear = useCallback(() => {
    if (strokes.length === 0) return;
    setHistory((prev) => [...prev, strokes]);
    setFuture([]);
    setStrokes([]);
  }, [strokes]);

  // Export board as PNG
  const handleSave = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create temporary canvas with solid dark background
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const exportCtx = exportCanvas.getContext("2d");
    if (!exportCtx) return;

    // Fill background
    exportCtx.fillStyle = "#07090e";
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // Draw grid pattern on export
    exportCtx.strokeStyle = "#161b26";
    exportCtx.lineWidth = 1;
    const gridSize = 32 * (window.devicePixelRatio || 1);
    for (let x = 0; x < exportCanvas.width; x += gridSize) {
      exportCtx.beginPath();
      exportCtx.moveTo(x, 0);
      exportCtx.lineTo(x, exportCanvas.height);
      exportCtx.stroke();
    }
    for (let y = 0; y < exportCanvas.height; y += gridSize) {
      exportCtx.beginPath();
      exportCtx.moveTo(0, y);
      exportCtx.lineTo(exportCanvas.width, y);
      exportCtx.stroke();
    }

    // Draw main canvas content
    exportCtx.drawImage(canvas, 0, 0);

    // Add AIRSPACE watermark
    exportCtx.fillStyle = "rgba(255, 255, 255, 0.4)";
    exportCtx.font = `600 ${14 * (window.devicePixelRatio || 1)}px monospace`;
    exportCtx.fillText("AIRSPACE — Spatial Whiteboard", 24, exportCanvas.height - 24);

    const link = document.createElement("a");
    link.download = `airspace-whiteboard-${Date.now()}.png`;
    link.href = exportCanvas.toDataURL("image/png");
    link.click();
  }, []);

  // Keyboard Shortcuts (Ctrl+Z, Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        handleRedo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Erase strokes near a point (radius: 45px)
  const eraseNearPoint = useCallback((pt: Point, radius: number = 45) => {
    setStrokes((prev) => {
      let modified = false;
      const remaining = prev.filter((stroke) => {
        // If any point in stroke is within radius, mark for removal
        const hasCollision = stroke.points.some((p) => {
          const dx = p.x - pt.x;
          const dy = p.y - pt.y;
          return Math.sqrt(dx * dx + dy * dy) < radius;
        });
        if (hasCollision) {
          modified = true;
          return false;
        }
        return true;
      });

      if (modified) {
        setHistory((h) => [...h.slice(-20), prev]);
        return remaining;
      }
      return prev;
    });
  }, []);

  // Commit a completed stroke (with optional shape snapping)
  const commitStroke = useCallback((rawPoints: Point[], color: string, width: number) => {
    if (rawPoints.length < 2) return;

    let finalPoints = [...rawPoints];
    let isShape = false;
    let shapeType: ShapeType | undefined;

    if (snapShapes) {
      const shapeResult = recognizeShape(rawPoints);
      if (shapeResult.type !== "UNKNOWN" && shapeResult.confidence >= 0.70 && shapeResult.cleanPoints) {
        finalPoints = shapeResult.cleanPoints;
        isShape = true;
        shapeType = shapeResult.type;

        // Show animated notification
        setShapeNotification({
          type: shapeResult.type,
          conf: Math.round(shapeResult.confidence * 100)
        });
        setTimeout(() => setShapeNotification(null), 2500);
      }
    }

    const newStroke: Stroke = {
      id: `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      points: finalPoints,
      color,
      width,
      isShape,
      shapeType
    };

    setHistory((prev) => [...prev.slice(-25), strokes]);
    setFuture([]);
    setStrokes((prev) => [...prev, newStroke]);
  }, [snapShapes, strokes]);

  // High-performance Spatial Tracking & Gesture Processing Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    let detectedMode: "Drawing" | "Erasing" | "Idle" = "Idle";
    let currentActiveGesture = "NONE";

    if (hands && hands.length > 0) {
      // Process each detected hand independently (up to 2 hands)
      hands.forEach((hand, idx) => {
        const gesture = classifyHandGesture(hand.landmarks);
        currentActiveGesture = gesture;

        // Landmark #8 is index fingertip; Landmark #9 is middle MCP (palm center)
        const indexTip = hand.landmarks[8];
        const palmCenter = hand.landmarks[9];

        // Mirror X naturally like looking into a mirror
        const rawIndexX = (1 - indexTip.x) * w;
        const rawIndexY = indexTip.y * h;

        const rawPalmX = (1 - palmCenter.x) * w;
        const rawPalmY = palmCenter.y * h;

        // Select hand buffer (Hand 0 = right/primary, Hand 1 = left)
        const isLeftHand = hand.handedness === "Left" || idx === 1;
        const strokeBufferRef = isLeftHand ? leftStrokeRef : rightStrokeRef;
        const smoothedRef = isLeftHand ? leftSmoothedRef : rightSmoothedRef;
        const foldedCountRef = isLeftHand ? leftFoldedCountRef : rightFoldedCountRef;

        // EMA coordinate smoothing
        const alpha = 0.68;
        const currentSmoothed: Point = smoothedRef.current
          ? {
              x: alpha * rawIndexX + (1 - alpha) * smoothedRef.current.x,
              y: alpha * rawIndexY + (1 - alpha) * smoothedRef.current.y
            }
          : { x: rawIndexX, y: rawIndexY };

        smoothedRef.current = currentSmoothed;

        // GESTURE 1: OPEN_PALM -> Full Palm Open = ERASE MODE
        if (gesture === "OPEN_PALM" || selectedTool === "eraser") {
          detectedMode = "Erasing";

          // If there was an active stroke, commit it before erasing
          if (strokeBufferRef.current.length > 0) {
            commitStroke(strokeBufferRef.current, selectedColor, selectedWidth);
            strokeBufferRef.current = [];
          }

          // Erase strokes near palm center
          eraseNearPoint({ x: rawPalmX, y: rawPalmY }, 55);
        }
        // GESTURE 2: INDEX_POINT -> Extended Index Finger = DRAW MODE (NO PINCH REQUIRED)
        else if (gesture === "INDEX_POINT" && selectedTool === "pen") {
          detectedMode = "Drawing";
          foldedCountRef.current = 0;

          // Append smoothed point to active continuous stroke trajectory
          strokeBufferRef.current.push({
            x: currentSmoothed.x,
            y: currentSmoothed.y,
            t: Date.now()
          });
        }
        // GESTURE 3: FOLDED / NONE -> Index Lowered or Closed
        else {
          foldedCountRef.current += 1;
          // Grace period debouncing (5 frames) before committing stroke
          if (foldedCountRef.current >= 5 && strokeBufferRef.current.length > 0) {
            commitStroke(strokeBufferRef.current, selectedColor, selectedWidth);
            strokeBufferRef.current = [];
          }
        }
      });
    } else {
      // Hand disappeared: commit remaining strokes if any
      if (leftStrokeRef.current.length > 0) {
        commitStroke(leftStrokeRef.current, selectedColor, selectedWidth);
        leftStrokeRef.current = [];
      }
      if (rightStrokeRef.current.length > 0) {
        commitStroke(rightStrokeRef.current, selectedColor, selectedWidth);
        rightStrokeRef.current = [];
      }
      leftSmoothedRef.current = null;
      rightSmoothedRef.current = null;
    }

    setActiveMode(detectedMode);
    setActiveGesture(currentActiveGesture);
  }, [hands, selectedTool, selectedColor, selectedWidth, eraseNearPoint, commitStroke]);

  // Main Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    // Clear frame
    ctx.clearRect(0, 0, w, h);

    // 1. Draw subtle ambient dot grid
    ctx.fillStyle = "rgba(148, 163, 184, 0.08)";
    const dotSpacing = 32;
    for (let x = dotSpacing / 2; x < w; x += dotSpacing) {
      for (let y = dotSpacing / 2; y < h; y += dotSpacing) {
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    }

    // Helper to draw smooth stroke
    const renderStroke = (points: Point[], color: string, width: number, isPreview = false) => {
      if (points.length < 2) return;

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Glowing stroke effect
      ctx.shadowColor = color;
      ctx.shadowBlur = isPreview ? width * 2.5 : width * 1.5;

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);

      for (let i = 1; i < points.length - 1; i++) {
        const midX = (points[i].x + points[i + 1].x) / 2;
        const midY = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
      }

      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
      ctx.stroke();
      ctx.restore();
    };

    // 2. Render all committed strokes
    strokes.forEach((stroke) => {
      renderStroke(stroke.points, stroke.color, stroke.width);
    });

    // 3. Render active live strokes (Right Hand & Left Hand)
    if (rightStrokeRef.current.length > 1) {
      renderStroke(rightStrokeRef.current, selectedColor, selectedWidth, true);
    }
    if (leftStrokeRef.current.length > 1) {
      renderStroke(leftStrokeRef.current, selectedColor, selectedWidth, true);
    }
    if (mouseStrokeRef.current.length > 1) {
      renderStroke(mouseStrokeRef.current, selectedColor, selectedWidth, true);
    }

    // 4. Render Spatial Cursors (Fingertip Halo & Eraser Aura)
    if (hands && hands.length > 0) {
      hands.forEach((hand, idx) => {
        const gesture = classifyHandGesture(hand.landmarks);
        const indexTip = hand.landmarks[8];
        const palmCenter = hand.landmarks[9];

        const ix = (1 - indexTip.x) * w;
        const iy = indexTip.y * h;
        const px = (1 - palmCenter.x) * w;
        const py = palmCenter.y * h;

        ctx.save();

        if (gesture === "OPEN_PALM" || selectedTool === "eraser") {
          // Open Palm Eraser Halo
          ctx.beginPath();
          ctx.arc(px, py, 50, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(239, 68, 68, 0.12)";
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = "rgba(239, 68, 68, 0.7)";
          ctx.setLineDash([4, 4]);
          ctx.stroke();

          // Center dot & "ERASER" text pill
          ctx.beginPath();
          ctx.arc(px, py, 4, 0, Math.PI * 2);
          ctx.fillStyle = "#ef4444";
          ctx.fill();

          ctx.fillStyle = "#f87171";
          ctx.font = "bold 10px monospace";
          ctx.textAlign = "center";
          ctx.fillText("ERASER", px, py - 60);
        } else {
          // Drawing Fingertip Cursor
          const cursorColor = selectedColor;
          // Outer pulse glow
          const grad = ctx.createRadialGradient(ix, iy, 2, ix, iy, 24);
          grad.addColorStop(0, cursorColor);
          grad.addColorStop(1, "transparent");

          ctx.beginPath();
          ctx.arc(ix, iy, 24, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.globalAlpha = gesture === "INDEX_POINT" ? 0.45 : 0.2;
          ctx.fill();
          ctx.globalAlpha = 1.0;

          // Inner solid core
          ctx.beginPath();
          ctx.arc(ix, iy, gesture === "INDEX_POINT" ? 6 : 4, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.shadowColor = cursorColor;
          ctx.shadowBlur = 12;
          ctx.fill();

          // Subtle indicator ring
          ctx.beginPath();
          ctx.arc(ix, iy, 14, 0, Math.PI * 2);
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = cursorColor;
          ctx.stroke();
        }

        ctx.restore();
      });
    }
  }, [strokes, hands, selectedColor, selectedWidth, selectedTool]);

  // Mouse fallback handlers for desktop drawing
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const pt: Point = { x: e.clientX - rect.left, y: e.clientY - rect.top, t: Date.now() };

    isMouseDownRef.current = true;
    if (selectedTool === "eraser") {
      eraseNearPoint(pt);
    } else {
      mouseStrokeRef.current = [pt];
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isMouseDownRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const pt: Point = { x: e.clientX - rect.left, y: e.clientY - rect.top, t: Date.now() };

    if (selectedTool === "eraser") {
      eraseNearPoint(pt);
    } else {
      mouseStrokeRef.current.push(pt);
    }
  };

  const handleMouseUp = () => {
    if (isMouseDownRef.current && mouseStrokeRef.current.length > 1) {
      commitStroke(mouseStrokeRef.current, selectedColor, selectedWidth);
    }
    isMouseDownRef.current = false;
    mouseStrokeRef.current = [];
  };

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen bg-[#05070c] text-white flex flex-col overflow-hidden select-none font-sans"
    >
      {/* Hidden Live Video Element for MediaPipe Computer Vision Processing */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="hidden"
      />

      {/* TOP HEADER BAR */}
      <header className="absolute top-0 left-0 right-0 z-30 h-16 px-6 flex items-center justify-between border-b border-white/[0.06] bg-[#05070c]/70 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white font-mono shadow-[0_0_20px_rgba(59,130,246,0.5)]">
            A
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm tracking-wider font-mono text-white">AIRSPACE</span>
              <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-mono uppercase tracking-widest font-semibold">
                Whiteboard
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block font-medium">Write, erase and draw in the air</span>
          </div>
        </div>

        {/* Center: Camera Status Badge */}
        <div className="hidden md:flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-900/60 border border-slate-800 text-xs font-mono">
          <div className={`w-2 h-2 rounded-full ${cameraStatus === "ACTIVE" ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" : "bg-amber-400"}`} />
          <span className="text-slate-300 text-[11px]">
            {cameraStatus === "ACTIVE" ? "Camera Active" : isModelLoading ? "Loading MediaPipe..." : "Camera Off"}
          </span>
          {fps > 0 && <span className="text-slate-500 text-[10px]">| {fps} FPS</span>}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          {/* PIP Video Preview Toggle */}
          <button
            onClick={() => setShowCameraPIP(!showCameraPIP)}
            className={`p-2 rounded-xl border text-xs transition flex items-center gap-1.5 ${
              showCameraPIP
                ? "bg-blue-600/20 border-blue-500/40 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                : "bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white"
            }`}
            title="Toggle Camera Feed PIP"
          >
            {showCameraPIP ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
            <span className="hidden sm:inline text-[11px] font-medium">Camera Feed</span>
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>

          {/* Return to Landing Button */}
          {onExit && (
            <button
              onClick={onExit}
              className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition flex items-center gap-1"
              title="Return to Home"
            >
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline text-[11px]">Home</span>
            </button>
          )}
        </div>
      </header>

      {/* WHITEBOARD CANVAS VIEWPORT */}
      <main className="flex-1 w-full h-full relative cursor-crosshair">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="w-full h-full block"
        />

        {/* SHAPE RECOGNIZED ANIMATED TOAST NOTIFICATION */}
        {shapeNotification && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 rounded-full bg-slate-950/90 border border-blue-500/40 backdrop-blur-md text-blue-300 font-mono text-xs shadow-[0_4px_25px_rgba(59,130,246,0.3)] animate-in fade-in zoom-in-95 duration-200">
            <Sparkles className="h-3.5 w-3.5 text-blue-400 animate-spin" />
            <span>Snapped to <strong>{shapeNotification.type}</strong> ({shapeNotification.conf}%)</span>
          </div>
        )}

        {/* TOP RIGHT: HAND TRACKING STATUS HUD */}
        <div className="absolute top-20 right-6 z-20 flex flex-col gap-2 pointer-events-none">
          <div className="p-3 rounded-2xl bg-slate-950/70 border border-white/[0.08] backdrop-blur-xl shadow-2xl flex flex-col gap-2 min-w-[170px]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                Hand Tracking
              </span>
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-2 h-2 rounded-full ${
                    hands.length > 0 ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" : "bg-slate-600"
                  }`}
                />
                <span className="text-[10px] font-mono text-slate-300">
                  {hands.length > 0 ? "Active" : "Scanning"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono pt-1 border-t border-white/[0.06]">
              <div>
                <span className="text-[9px] text-slate-500 uppercase block">Hands</span>
                <span className="text-white font-bold">{hands.length} detected</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 uppercase block">Mode</span>
                <span
                  className={`font-bold ${
                    activeMode === "Drawing"
                      ? "text-blue-400"
                      : activeMode === "Erasing"
                      ? "text-red-400"
                      : "text-slate-400"
                  }`}
                >
                  {activeMode}
                </span>
              </div>
            </div>

            {/* Gesture Cue Pill */}
            <div className="pt-1 text-[10px] font-mono text-slate-400 flex items-center justify-between">
              <span className="text-[9px] text-slate-500">Gesture:</span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-semibold">
                {activeGesture === "INDEX_POINT"
                  ? "☝️ Point (Draw)"
                  : activeGesture === "OPEN_PALM"
                  ? "✋ Open Palm (Erase)"
                  : activeGesture}
              </span>
            </div>
          </div>

          {/* MIRRORED CAMERA PREVIEW PIP */}
          {showCameraPIP && (
            <div className="relative w-44 h-32 rounded-2xl overflow-hidden border border-white/[0.1] bg-black/60 backdrop-blur-md shadow-2xl pointer-events-auto">
              {cameraStatus === "ACTIVE" ? (
                <div className="relative w-full h-full">
                  {/* Mirrored preview canvas */}
                  <video
                    ref={(el) => {
                      if (el && videoRef.current && el.srcObject !== videoRef.current.srcObject) {
                        el.srcObject = videoRef.current.srcObject;
                        try {
                          const p = el.play();
                          if (p && typeof p.catch === "function") {
                            p.catch(() => {});
                          }
                        } catch {}
                      }
                    }}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  <div className="absolute inset-0 border-2 border-blue-500/20 rounded-2xl pointer-events-none" />
                  <div className="absolute bottom-1.5 left-2 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-mono text-slate-300">
                    Mirrored
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-2 text-slate-500 text-xs">
                  <CameraOff className="h-5 w-5 mb-1 text-slate-600" />
                  <span className="text-[10px]">Camera Inactive</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* BOTTOM FLOATING GLASS TOOLBAR */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-3 pointer-events-auto">
          
          {/* Color & Size Sub-panel Popover */}
          {showColorPicker && (
            <div className="px-4 py-3 rounded-2xl bg-slate-950/90 border border-white/[0.1] backdrop-blur-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2 duration-150">
              {/* Color Swatches */}
              <div className="flex items-center gap-2">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => {
                      setSelectedColor(c.value);
                      setSelectedTool("pen");
                    }}
                    className={`w-6 h-6 rounded-full transition-transform ${
                      selectedColor === c.value
                        ? "scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-950"
                        : "hover:scale-110 opacity-80 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: c.value, boxShadow: `0 0 10px ${c.glow}` }}
                    title={c.label}
                  />
                ))}
              </div>

              <div className="w-px h-6 bg-slate-800" />

              {/* Stroke Width Buttons */}
              <div className="flex items-center gap-1.5">
                {STROKE_WIDTHS.map((sw) => (
                  <button
                    key={sw.value}
                    onClick={() => setSelectedWidth(sw.value)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition ${
                      selectedWidth === sw.value
                        ? "bg-blue-600 text-white"
                        : "bg-slate-900 text-slate-400 hover:text-white"
                    }`}
                  >
                    {sw.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Main Floating Glass Island */}
          <div className="px-4 py-2.5 rounded-full bg-slate-950/80 border border-white/[0.12] backdrop-blur-2xl shadow-[0_15px_50px_rgba(0,0,0,0.9)] flex items-center gap-1.5 sm:gap-2">
            
            {/* Pen Tool */}
            <button
              onClick={() => {
                setSelectedTool("pen");
                setShowColorPicker(!showColorPicker);
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-bold transition ${
                selectedTool === "pen"
                  ? "bg-blue-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.5)]"
                  : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
              }`}
              title="Pen Tool (Point index finger in air to draw)"
            >
              <PenTool className="h-4 w-4" />
              <span className="hidden sm:inline">Pen</span>
              <div
                className="w-2.5 h-2.5 rounded-full ring-1 ring-white/50"
                style={{ backgroundColor: selectedColor }}
              />
            </button>

            {/* Eraser Tool */}
            <button
              onClick={() => {
                setSelectedTool("eraser");
                setShowColorPicker(false);
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-bold transition ${
                selectedTool === "eraser"
                  ? "bg-red-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]"
                  : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
              }`}
              title="Eraser (Open palm in air to erase)"
            >
              <Eraser className="h-4 w-4" />
              <span className="hidden sm:inline">Eraser</span>
            </button>

            {/* Geometric Shapes Auto-Snap Toggle */}
            <button
              onClick={() => setSnapShapes(!snapShapes)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition ${
                snapShapes
                  ? "bg-purple-600/30 border border-purple-500/50 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                  : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
              }`}
              title="Snap hand-drawn circles, rectangles, triangles, lines and arrows"
            >
              <Shapes className="h-4 w-4" />
              <span className="hidden md:inline">Shapes</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono ${snapShapes ? "bg-purple-500/30 text-purple-200" : "bg-slate-800 text-slate-500"}`}>
                {snapShapes ? "ON" : "OFF"}
              </span>
            </button>

            <div className="w-px h-6 bg-slate-800 mx-1" />

            {/* Undo */}
            <button
              onClick={handleUndo}
              disabled={strokes.length === 0}
              className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/[0.05] disabled:opacity-30 transition"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="h-4 w-4" />
            </button>

            {/* Redo */}
            <button
              onClick={handleRedo}
              disabled={future.length === 0}
              className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/[0.05] disabled:opacity-30 transition"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="h-4 w-4" />
            </button>

            {/* Clear Board */}
            <button
              onClick={handleClear}
              disabled={strokes.length === 0}
              className="p-2 rounded-full text-slate-400 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 transition"
              title="Clear Whiteboard"
            >
              <Trash2 className="h-4 w-4" />
            </button>

            <div className="w-px h-6 bg-slate-800 mx-1" />

            {/* Save / Download PNG */}
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white text-xs font-bold transition shadow-lg"
              title="Download Whiteboard as PNG"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Save</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
export default SpatialWhiteboard;
