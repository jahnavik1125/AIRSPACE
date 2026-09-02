"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useCamera } from "../../hooks/useCamera";
import { useHandTracking } from "../../hooks/useHandTracking";
import { useAirspaceRecorder } from "../../hooks/useAirspaceRecorder";
import { classifyHandGesture } from "../../utils/gestureClassifier";
import { StrokePoint, StrokeFilter, PenSettings, PenStyle, PenEffect, renderStroke } from "../../utils/strokeRenderer";
import {
  extractFingertips,
  renderFingertipGeometry,
  renderConfirmedShapes,
  ConfirmedShape
} from "../../utils/spatialShapes";
import { InteractiveAirspaceDemo } from "../demo/InteractiveAirspaceDemo";
import {
  PenTool,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Camera,
  Settings,
  Maximize2,
  Minimize2,
  Sparkles,
  Pause,
  Play,
  Square as StopSquare,
  Home,
  Sun,
  Moon,
  Palette,
  HelpCircle,
  CheckCircle2,
  Sliders,
  Layers,
  Check
} from "lucide-react";

export interface CompletedStroke {
  id: string;
  points: StrokePoint[];
  settings: PenSettings;
}

const PALETTE_COLORS = [
  "#ffffff", // Pure White
  "#facc15", // Bright Yellow
  "#fb923c", // Neon Orange
  "#f43f5e", // Coral Red
  "#ec4899", // Neon Magenta
  "#a855f7", // Electric Violet
  "#3b82f6", // Cyber Blue
  "#06b6d4", // Electric Cyan
  "#22c55e", // Lime Green
  "#10b981"  // Emerald Green
];

interface AirspaceWorkspaceProps {
  onExit?: () => void;
}

export function AirspaceWorkspace({ onExit }: AirspaceWorkspaceProps) {
  // 1. Theme State (Light vs Dark Mode)
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("airspace_theme");
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("airspace_theme", next);
  };

  // 2. Camera & Tracking
  const { status: cameraStatus, devices, activeDeviceId, videoRef, startCamera, stopCamera, switchCamera } = useCamera();
  const { hands, isModelLoading, fps } = useHandTracking(videoRef, cameraStatus === "ACTIVE");

  // 3. Recorder
  const {
    status: recordingStatus,
    formattedTime: recordingTime,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    takeSnapshot
  } = useAirspaceRecorder();

  // 4. Primary Mode: "write" vs "shapes"
  const [activeMode, setActiveMode] = useState<"write" | "shapes">("write");

  // 5. Pen & Creative Tools
  const [activeTool, setActiveTool] = useState<"pen" | "eraser">("pen");
  const [penColor, setPenColor] = useState<string>("#a855f7"); // Electric violet default
  const [penSize, setPenSize] = useState<number>(12); // 12px default
  const [penOpacity, setPenOpacity] = useState<number>(1.0);
  const [penStyle, setPenStyle] = useState<PenStyle>("marker");
  const [penEffect, setPenEffect] = useState<PenEffect>("glow");

  // 6. Compact Vertical Floating Toolbar Popover State
  const [activePopover, setActivePopover] = useState<"style" | "color" | "size" | "opacity" | "effects" | null>(null);

  // 7. Persistent State (Strokes and Confirmed Shapes)
  const [completedStrokes, setCompletedStrokes] = useState<CompletedStroke[]>([]);
  const [strokeHistory, setStrokeHistory] = useState<CompletedStroke[][]>([]);
  const [strokeFuture, setStrokeFuture] = useState<CompletedStroke[][]>([]);

  const [confirmedShapes, setConfirmedShapes] = useState<ConfirmedShape[]>([]);
  const [shapesHistory, setShapesHistory] = useState<ConfirmedShape[][]>([]);

  // 8. Modals & Settings
  const [isDemoOpen, setIsDemoOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [mirrorCamera, setMirrorCamera] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Canvas Refs
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const compositeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const livePreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Two-Finger Air Writing State with Hysteresis (Left & Right Hand)
  const isWritingLeftRef = useRef<boolean>(false);
  const isWritingRightRef = useRef<boolean>(false);
  const leftLostFramesRef = useRef<number>(0);
  const rightLostFramesRef = useRef<number>(0);

  const leftFilterRef = useRef<StrokeFilter>(new StrokeFilter());
  const rightFilterRef = useRef<StrokeFilter>(new StrokeFilter());
  const leftStrokeRef = useRef<StrokePoint[]>([]);
  const rightStrokeRef = useRef<StrokePoint[]>([]);

  // Animation and Live Shape Candidate Ref
  const animTimeRef = useRef<number>(0);
  const liveCandidateRef = useRef<ConfirmedShape | null>(null);

  // Start camera on mount
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Mode Switcher: Strictly isolates Write and Shapes
  const handleModeSwitch = (mode: "write" | "shapes") => {
    setActiveMode(mode);
    leftStrokeRef.current = [];
    rightStrokeRef.current = [];
    leftFilterRef.current.reset();
    rightFilterRef.current.reset();
    isWritingLeftRef.current = false;
    isWritingRightRef.current = false;
    leftLostFramesRef.current = 0;
    rightLostFramesRef.current = 0;
    liveCandidateRef.current = null;
    setActivePopover(null);
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Resize canvas to viewport
  const updateCanvasSize = useCallback(() => {
    const overlay = overlayCanvasRef.current;
    const composite = compositeCanvasRef.current;
    const container = containerRef.current;
    if (!overlay || !composite || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    overlay.width = rect.width * dpr;
    overlay.height = rect.height * dpr;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;

    composite.width = rect.width * dpr;
    composite.height = rect.height * dpr;

    const overlayCtx = overlay.getContext("2d");
    if (overlayCtx) overlayCtx.scale(dpr, dpr);

    const compCtx = composite.getContext("2d");
    if (compCtx) compCtx.scale(dpr, dpr);
  }, []);

  useEffect(() => {
    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);
    return () => window.removeEventListener("resize", updateCanvasSize);
  }, [updateCanvasSize]);

  // Undo / Redo
  const handleUndo = useCallback(() => {
    if (activeMode === "write") {
      if (completedStrokes.length === 0) return;
      const prev = strokeHistory.length > 0 ? strokeHistory[strokeHistory.length - 1] : [];
      setStrokeFuture((f) => [completedStrokes, ...f]);
      setStrokeHistory((h) => h.slice(0, -1));
      setCompletedStrokes(prev);
    } else {
      if (confirmedShapes.length === 0) return;
      const prev = shapesHistory.length > 0 ? shapesHistory[shapesHistory.length - 1] : [];
      setShapesHistory((h) => h.slice(0, -1));
      setConfirmedShapes(prev);
    }
  }, [activeMode, completedStrokes, strokeHistory, confirmedShapes, shapesHistory]);

  const handleRedo = useCallback(() => {
    if (activeMode === "write") {
      if (strokeFuture.length === 0) return;
      const next = strokeFuture[0];
      setStrokeHistory((h) => [...h, completedStrokes]);
      setStrokeFuture((f) => f.slice(1));
      setCompletedStrokes(next);
    }
  }, [activeMode, strokeFuture, completedStrokes]);

  // Clear current mode content
  const handleClear = useCallback(() => {
    if (activeMode === "write") {
      if (completedStrokes.length === 0) return;
      setStrokeHistory((h) => [...h, completedStrokes]);
      setStrokeFuture([]);
      setCompletedStrokes([]);
    } else {
      if (confirmedShapes.length === 0) return;
      setShapesHistory((h) => [...h, confirmedShapes]);
      setConfirmedShapes([]);
    }
  }, [activeMode, completedStrokes, confirmedShapes]);

  // Keyboard Shortcuts (Ctrl+Z, Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        handleRedo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Commit stroke to permanent storage (preserved when hands lower or leave camera)
  const commitStroke = useCallback(
    (points: StrokePoint[]) => {
      if (points.length < 2) return;

      const newStroke: CompletedStroke = {
        id: `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        points: [...points],
        settings: {
          color: penColor,
          size: penSize,
          opacity: penOpacity,
          style: penStyle,
          effect: penEffect
        }
      };

      setStrokeHistory((h) => [...h.slice(-25), completedStrokes]);
      setStrokeFuture([]);
      setCompletedStrokes((prev) => [...prev, newStroke]);
    },
    [completedStrokes, penColor, penSize, penOpacity, penStyle, penEffect]
  );

  // Erase strokes near palm center (Open Palm Gesture)
  const eraseNearPoint = useCallback((pt: { x: number; y: number }, radius: number = 75) => {
    setCompletedStrokes((prev) => {
      let modified = false;
      const remaining = prev.filter((s) => {
        const hasCollision = s.points.some((p) => Math.hypot(p.x - pt.x, p.y - pt.y) < radius);
        if (hasCollision) {
          modified = true;
          return false;
        }
        return true;
      });

      if (modified) {
        setStrokeHistory((h) => [...h.slice(-20), prev]);
        return remaining;
      }
      return prev;
    });
  }, []);

  // Live S-Curve Preview in Size Popover
  useEffect(() => {
    const canvas = livePreviewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const wavePoints: StrokePoint[] = [];
    const steps = 36;
    const w = canvas.width;
    const h = canvas.height;
    for (let i = 0; i <= steps; i++) {
      const x = 12 + (i / steps) * (w - 24);
      const y = h / 2 + Math.sin((i / steps) * Math.PI * 2) * (h * 0.28);
      wavePoints.push({ x, y, t: i * 20, width: penSize });
    }

    renderStroke(ctx, wavePoints, {
      color: penColor,
      size: penSize,
      opacity: penOpacity,
      style: penStyle,
      effect: penEffect
    });
  }, [penColor, penSize, penOpacity, penStyle, penEffect, activePopover]);

  // Optional manual shape confirmation
  const confirmLiveShape = () => {
    if (liveCandidateRef.current) {
      setShapesHistory((h) => [...h, confirmedShapes]);
      setConfirmedShapes((prev) => [...prev, liveCandidateRef.current!]);
      liveCandidateRef.current = null;
    }
  };

  // Two-Finger Hand Tracking & Processing Loop
  useEffect(() => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;

    const rect = overlay.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const now = Date.now();

    // =========================================================================
    // WRITE MODE: Two-Finger Writing (✌️) & Open Palm Erasing
    // =========================================================================
    if (activeMode === "write") {
      if (hands && hands.length > 0) {
        hands.forEach((hand, idx) => {
          const isLeft = hand.handedness === "Left" || idx === 1;
          const isWritingRef = isLeft ? isWritingLeftRef : isWritingRightRef;
          const lostFramesRef = isLeft ? leftLostFramesRef : rightLostFramesRef;
          const strokeRef = isLeft ? leftStrokeRef : rightStrokeRef;
          const filterRef = isLeft ? leftFilterRef : rightFilterRef;

          const gesture = classifyHandGesture(hand.landmarks, isWritingRef.current);
          const indexTip = hand.landmarks[8];
          const middleTip = hand.landmarks[12];
          const palmCenter = hand.landmarks[9];

          // TWO-FINGER MIDPOINT: ((index_tip + middle_tip) / 2)
          const midX = ((indexTip.x + middleTip.x) / 2);
          const midY = ((indexTip.y + middleTip.y) / 2);

          // Mirrored screen coordinates
          const screenMidX = (1 - midX) * w;
          const screenMidY = midY * h;
          const screenPalmX = (1 - palmCenter.x) * w;
          const screenPalmY = palmCenter.y * h;

          // GESTURE 1: FULL OPEN PALM = ERASER
          if (gesture === "OPEN_PALM" || activeTool === "eraser") {
            if (isWritingRef.current && strokeRef.current.length > 0) {
              commitStroke(strokeRef.current);
              strokeRef.current = [];
              filterRef.current.reset();
            }
            isWritingRef.current = false;
            lostFramesRef.current = 0;
            eraseNearPoint({ x: screenPalmX, y: screenPalmY }, 75);
          }
          // GESTURE 2: TWO FINGERS EXTENDED (✌️) = WRITE VIA MIDPOINT
          else if (gesture === "TWO_FINGER_WRITE" && activeTool === "pen") {
            isWritingRef.current = true;
            lostFramesRef.current = 0;

            const filteredPoints = filterRef.current.filter(screenMidX, screenMidY, now, penSize);
            filteredPoints.forEach((pt) => strokeRef.current.push(pt));
          }
          // GESTURE 3: FINGERS FOLDED OR TEMPORARY TRACKING DROP
          else {
            if (isWritingRef.current) {
              lostFramesRef.current += 1;
              // Hysteresis grace period: 12 frames (~400ms) prevents premature stroke breaks
              if (lostFramesRef.current >= 12) {
                if (strokeRef.current.length > 0) {
                  commitStroke(strokeRef.current);
                  strokeRef.current = [];
                  filterRef.current.reset();
                }
                isWritingRef.current = false;
                lostFramesRef.current = 0;
              }
            }
          }
        });
      } else {
        // Hands left camera: finalize in-flight strokes so existing writing stays permanently
        if (isWritingLeftRef.current && leftStrokeRef.current.length > 0) {
          commitStroke(leftStrokeRef.current);
          leftStrokeRef.current = [];
          leftFilterRef.current.reset();
        }
        if (isWritingRightRef.current && rightStrokeRef.current.length > 0) {
          commitStroke(rightStrokeRef.current);
          rightStrokeRef.current = [];
          rightFilterRef.current.reset();
        }
        isWritingLeftRef.current = false;
        isWritingRightRef.current = false;
        leftLostFramesRef.current = 0;
        rightLostFramesRef.current = 0;
      }
    }
    // =========================================================================
    // SHAPES MODE: Clear writing buffers immediately
    // =========================================================================
    else {
      leftStrokeRef.current = [];
      rightStrokeRef.current = [];
      leftFilterRef.current.reset();
      rightFilterRef.current.reset();
      isWritingLeftRef.current = false;
      isWritingRightRef.current = false;
    }
  }, [hands, activeMode, activeTool, penSize, commitStroke, eraseNearPoint]);

  // Unified 60 FPS Render & Composite Loop
  useEffect(() => {
    let animId: number;

    const render = () => {
      const overlay = overlayCanvasRef.current;
      const composite = compositeCanvasRef.current;
      const video = videoRef.current;
      if (!overlay || !composite) return;

      const overlayCtx = overlay.getContext("2d");
      const compCtx = composite.getContext("2d");
      if (!overlayCtx || !compCtx) return;

      const rect = overlay.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      animTimeRef.current += 0.04;
      const animTime = animTimeRef.current;

      overlayCtx.clearRect(0, 0, w, h);
      compCtx.clearRect(0, 0, w, h);

      // 1. Mirrored Camera Frame on composite canvas (for recording & snapshot)
      if (video && video.readyState >= 2) {
        compCtx.save();
        if (mirrorCamera) {
          compCtx.translate(w, 0);
          compCtx.scale(-1, 1);
        }
        compCtx.drawImage(video, 0, 0, w, h);
        compCtx.restore();
      } else {
        compCtx.fillStyle = theme === "dark" ? "#030509" : "#f1f5f9";
        compCtx.fillRect(0, 0, w, h);
      }

      // Shared Scene Renderer
      const drawScene = (ctx: CanvasRenderingContext2D) => {
        // A. Render all completed persistent strokes
        completedStrokes.forEach((stroke) => {
          renderStroke(ctx, stroke.points, stroke.settings);
        });

        // B. Render live active strokes (In Write Mode)
        if (activeMode === "write") {
          const currentSettings: PenSettings = {
            color: penColor,
            size: penSize,
            opacity: penOpacity,
            style: penStyle,
            effect: penEffect
          };
          if (rightStrokeRef.current.length > 1) {
            renderStroke(ctx, rightStrokeRef.current, currentSettings, true);
          }
          if (leftStrokeRef.current.length > 1) {
            renderStroke(ctx, leftStrokeRef.current, currentSettings, true);
          }
        }

        // C. Render confirmed persistent shapes
        renderConfirmedShapes(ctx, confirmedShapes);

        // D. Render Shapes Mode: Fingertip Vertices & Exact Laser Edges
        if (activeMode === "shapes" && hands && hands.length > 0) {
          const { all, byHand } = extractFingertips(hands, w, h);
          const candidate = renderFingertipGeometry(ctx, all, byHand, animTime);
          liveCandidateRef.current = candidate;
        } else if (activeMode === "shapes") {
          liveCandidateRef.current = null;
        }

        // E. Render Two-Finger Midpoint Cursor or Palm Eraser Halo (Write Mode)
        if (activeMode === "write" && hands && hands.length > 0) {
          hands.forEach((hand) => {
            const gesture = classifyHandGesture(hand.landmarks, true);
            const indexTip = hand.landmarks[8];
            const middleTip = hand.landmarks[12];
            const palmCenter = hand.landmarks[9];

            const screenPalmX = (1 - palmCenter.x) * w;
            const screenPalmY = palmCenter.y * h;

            // Two-finger midpoint calculation
            const midX = (indexTip.x + middleTip.x) / 2;
            const midY = (indexTip.y + middleTip.y) / 2;
            const screenMidX = (1 - midX) * w;
            const screenMidY = midY * h;

            const screenIndexX = (1 - indexTip.x) * w;
            const screenIndexY = indexTip.y * h;
            const screenMiddleX = (1 - middleTip.x) * w;
            const screenMiddleY = middleTip.y * h;

            ctx.save();
            if (gesture === "OPEN_PALM" || activeTool === "eraser") {
              // Palm Eraser Halo
              ctx.beginPath();
              ctx.arc(screenPalmX, screenPalmY, 75, 0, Math.PI * 2);
              ctx.fillStyle = "rgba(239, 68, 68, 0.16)";
              ctx.fill();
              ctx.lineWidth = 2;
              ctx.strokeStyle = "rgba(239, 68, 68, 0.85)";
              ctx.setLineDash([6, 6]);
              ctx.stroke();

              ctx.fillStyle = "#f87171";
              ctx.font = "bold 11px monospace";
              ctx.textAlign = "center";
              ctx.fillText("ERASER", screenPalmX, screenPalmY - 85);
            } else if (gesture === "TWO_FINGER_WRITE" && activeTool === "pen") {
              // Show subtle node indicators at the two extended fingertips
              ctx.beginPath();
              ctx.arc(screenIndexX, screenIndexY, 4, 0, Math.PI * 2);
              ctx.fillStyle = "#06b6d4";
              ctx.fill();

              ctx.beginPath();
              ctx.arc(screenMiddleX, screenMiddleY, 4, 0, Math.PI * 2);
              ctx.fillStyle = "#22c55e";
              ctx.fill();

              // Subtle bridge between index and middle tips
              ctx.beginPath();
              ctx.moveTo(screenIndexX, screenIndexY);
              ctx.lineTo(screenMiddleX, screenMiddleY);
              ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
              ctx.lineWidth = 1;
              ctx.stroke();

              // Two-Finger Glowing Midpoint Pen Cursor (Writing Point)
              const grad = ctx.createRadialGradient(screenMidX, screenMidY, 2, screenMidX, screenMidY, penSize * 2.5);
              grad.addColorStop(0, penColor);
              grad.addColorStop(1, "transparent");

              ctx.beginPath();
              ctx.arc(screenMidX, screenMidY, penSize * 2.5, 0, Math.PI * 2);
              ctx.fillStyle = grad;
              ctx.globalAlpha = 0.70;
              ctx.fill();
              ctx.globalAlpha = 1.0;

              // Solid white core at the midpoint
              ctx.beginPath();
              ctx.arc(screenMidX, screenMidY, Math.max(3, penSize * 0.45), 0, Math.PI * 2);
              ctx.fillStyle = "#ffffff";
              ctx.shadowColor = penColor;
              ctx.shadowBlur = 14;
              ctx.fill();
            }
            ctx.restore();
          });
        }
      };

      // Draw overlay
      drawScene(overlayCtx);

      // Draw composited frame
      drawScene(compCtx);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    completedStrokes,
    confirmedShapes,
    activeMode,
    activeTool,
    penColor,
    penSize,
    penOpacity,
    penStyle,
    penEffect,
    hands,
    videoRef,
    mirrorCamera,
    theme
  ]);

  // Snapshot handler
  const handleSnapshot = () => {
    if (compositeCanvasRef.current) {
      takeSnapshot(compositeCanvasRef.current, "airspace-capture");
    }
  };

  // Record handler
  const handleToggleRecord = async () => {
    if (recordingStatus === "IDLE") {
      if (compositeCanvasRef.current) {
        await startRecording(compositeCanvasRef.current);
      }
    } else if (recordingStatus === "RECORDING") {
      pauseRecording();
    } else if (recordingStatus === "PAUSED") {
      resumeRecording();
    }
  };

  const handleStopRecord = async () => {
    await stopRecording();
  };

  const isLight = theme === "light";

  return (
    <div
      ref={containerRef}
      className={`relative w-screen h-screen flex flex-col overflow-hidden select-none font-sans transition-colors duration-500 ${
        isLight ? "bg-[#f8fafc] text-slate-900" : "bg-[#030509] text-white"
      }`}
    >
      {/* 1. LIVE WEBCAM FEED (Mirrored selfie camera) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-700 ${
          mirrorCamera ? "scale-x-[-1]" : ""
        } ${cameraStatus === "ACTIVE" ? "opacity-100" : "opacity-0"}`}
      />

      {/* Hidden Composite Canvas for Video Recording & Snapshot Capture */}
      <canvas ref={compositeCanvasRef} className="hidden" />

      {/* 2. TRANSPARENT HIGH-DPI OVERLAY CANVAS */}
      <canvas ref={overlayCanvasRef} className="absolute inset-0 w-full h-full z-10 pointer-events-none" />

      {/* Camera Inactive Prompt */}
      {cameraStatus !== "ACTIVE" && (
        <div className={`absolute inset-0 z-0 flex flex-col items-center justify-center p-6 ${isLight ? "bg-slate-100" : "bg-[#04070e]"}`}>
          <div className="w-16 h-16 rounded-2xl bg-purple-600/10 border border-purple-500/30 flex items-center justify-center mb-4 text-purple-400 shadow-[0_0_30px_rgba(168,85,247,0.3)]">
            <Camera className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-black font-mono tracking-tight mb-2">
            {isModelLoading ? "Initializing MediaPipe Vision..." : "Camera Access Required"}
          </h2>
          <p className="text-xs text-slate-500 max-w-sm text-center mb-6 leading-relaxed">
            AIRSPACE creates smooth two-finger marker handwriting and multi-fingertip spatial geometry directly over your live camera feed.
          </p>
          <button
            onClick={() => startCamera()}
            className="px-6 py-3 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-mono text-xs font-bold transition flex items-center gap-2 shadow-[0_0_25px_rgba(168,85,247,0.5)]"
          >
            <Camera className="h-4 w-4" />
            <span>Enable Camera</span>
          </button>
        </div>
      )}

      {/* 3. TOP BAR */}
      <header className="absolute top-0 left-0 right-0 z-30 h-16 px-6 flex items-center justify-between pointer-events-auto">
        {/* Left: Branding & Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono font-black text-sm tracking-widest uppercase">AIRSPACE</span>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-mono backdrop-blur-xl ${
              isLight ? "bg-white/80 border-slate-300 text-slate-700" : "bg-slate-950/70 border-white/[0.1] text-slate-300"
            }`}>
              <div className={`w-2 h-2 rounded-full ${cameraStatus === "ACTIVE" ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" : "bg-amber-400"}`} />
              <span className="font-semibold">{cameraStatus === "ACTIVE" ? "Camera On" : "Offline"}</span>
            </div>
          </div>

          {onExit && (
            <button
              onClick={onExit}
              className={`p-2 rounded-xl border text-xs font-mono transition flex items-center gap-1.5 ${
                isLight ? "bg-white/80 border-slate-300 text-slate-700 hover:bg-slate-200" : "bg-slate-950/70 border-white/[0.1] text-slate-400 hover:text-white"
              }`}
              title="Return to Landing Overview"
            >
              <Home className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Home</span>
            </button>
          )}
        </div>

        {/* Right Controls: Theme Toggle, 3D Demo, Timer, Settings, Fullscreen */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-xl border transition ${
              isLight ? "bg-white/80 border-slate-300 text-slate-700 hover:bg-slate-100" : "bg-slate-950/70 border-white/[0.1] text-slate-300 hover:text-white"
            }`}
            title={`Switch to ${isLight ? "Dark" : "Light"} Mode`}
          >
            {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4 text-amber-400" />}
          </button>

          <button
            onClick={() => setIsDemoOpen(true)}
            className={`p-2 rounded-xl border transition ${
              isLight ? "bg-white/80 border-slate-300 text-slate-700 hover:bg-slate-100" : "bg-slate-950/70 border-white/[0.1] text-slate-300 hover:text-white"
            }`}
            title="How It Works (3D Interactive Demo)"
          >
            <HelpCircle className="h-4 w-4 text-purple-400" />
          </button>

          {/* Recording Timer Pill */}
          <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border backdrop-blur-xl text-xs font-mono ${
            isLight ? "bg-white/80 border-slate-300 text-slate-800" : "bg-slate-950/70 border-white/[0.1] text-slate-200"
          }`}>
            <div className={`w-2 h-2 rounded-full ${recordingStatus === "RECORDING" ? "bg-red-500 animate-ping" : "bg-red-500/80"}`} />
            <span className="font-bold tracking-wider">{recordingTime}</span>
          </div>

          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={`p-2 rounded-xl border transition ${
              isLight ? "bg-white/80 border-slate-300 text-slate-700 hover:bg-slate-100" : "bg-slate-950/70 border-white/[0.1] text-slate-300 hover:text-white"
            }`}
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>

          <button
            onClick={toggleFullscreen}
            className={`p-2 rounded-xl border transition ${
              isLight ? "bg-white/80 border-slate-300 text-slate-700 hover:bg-slate-100" : "bg-slate-950/70 border-white/[0.1] text-slate-300 hover:text-white"
            }`}
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className={`absolute top-20 right-6 z-40 p-5 rounded-3xl border backdrop-blur-2xl shadow-2xl flex flex-col gap-4 w-80 animate-in fade-in slide-in-from-top-2 duration-150 ${
          isLight ? "bg-white/95 border-slate-300 text-slate-800" : "bg-slate-950/95 border-white/[0.12] text-white"
        }`}>
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-purple-400">Settings</span>
            <button onClick={() => setIsSettingsOpen(false)} className="text-xs text-slate-400 hover:text-white">Done</button>
          </div>

          <div className="flex items-center justify-between text-xs font-mono">
            <span>Mirror Camera</span>
            <input
              type="checkbox"
              checked={mirrorCamera}
              onChange={(e) => setMirrorCamera(e.target.checked)}
              className="accent-purple-500 cursor-pointer w-4 h-4"
            />
          </div>

          {devices.length > 1 && (
            <div className="flex flex-col gap-1 text-xs font-mono">
              <span className="text-slate-400">Camera Device</span>
              <select
                value={activeDeviceId || ""}
                onChange={(e) => switchCamera(e.target.value)}
                className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white text-xs font-mono"
              >
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || "Camera"}</option>
                ))}
              </select>
            </div>
          )}

          <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between pt-2 border-t border-white/[0.06]">
            <span>MediaPipe Hand Tracking</span>
            <span className="text-emerald-400 font-bold">{fps} FPS</span>
          </div>
        </div>
      )}

      {/* 4. COMPACT VERTICAL FLOATING TOOLBAR (Side-docked, Non-intrusive) */}
      <div className={`absolute left-5 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-2 p-2 rounded-2xl border backdrop-blur-2xl shadow-[0_15px_40px_rgba(0,0,0,0.8)] pointer-events-auto ${
        isLight ? "bg-white/90 border-slate-300" : "bg-slate-950/80 border-white/[0.12]"
      }`}>
        {/* Pen Tool Button */}
        <button
          onClick={() => {
            setActiveTool("pen");
            setActivePopover(null);
          }}
          className={`p-3 rounded-xl transition ${
            activeTool === "pen"
              ? "bg-gradient-to-tr from-purple-600 to-indigo-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]"
              : isLight ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100" : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
          }`}
          title="Pen Tool (Two fingers extended ✌️ writes via midpoint)"
        >
          <PenTool className="h-5 w-5" />
        </button>

        {/* Eraser Tool Button */}
        <button
          onClick={() => {
            setActiveTool("eraser");
            setActivePopover(null);
          }}
          className={`p-3 rounded-xl transition ${
            activeTool === "eraser"
              ? "bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]"
              : isLight ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100" : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
          }`}
          title="Eraser (Open full palm in air to erase)"
        >
          <Eraser className="h-5 w-5" />
        </button>

        <div className={`w-6 h-px my-1 ${isLight ? "bg-slate-200" : "bg-slate-800"}`} />

        {/* Style Popover Button */}
        <button
          onClick={() => setActivePopover(activePopover === "style" ? null : "style")}
          className={`p-3 rounded-xl transition ${
            activePopover === "style"
              ? "bg-purple-600/30 border border-purple-500 text-purple-300"
              : isLight ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100" : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
          }`}
          title="Pen Style (Marker, Brush, Neon, Glow, etc.)"
        >
          <Layers className="h-5 w-5" />
        </button>

        {/* Color Popover Button */}
        <button
          onClick={() => setActivePopover(activePopover === "color" ? null : "color")}
          className="p-3 rounded-xl transition hover:scale-105 flex items-center justify-center"
          title="Color Palette & Picker"
        >
          <div className="w-5 h-5 rounded-full ring-2 ring-white/60 shadow-[0_0_10px_rgba(168,85,247,0.5)]" style={{ backgroundColor: penColor }} />
        </button>

        {/* Size Popover Button */}
        <button
          onClick={() => setActivePopover(activePopover === "size" ? null : "size")}
          className={`p-3 rounded-xl transition ${
            activePopover === "size"
              ? "bg-purple-600/30 border border-purple-500 text-purple-300"
              : isLight ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100" : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
          }`}
          title="Stroke Size & Width"
        >
          <Sliders className="h-5 w-5" />
        </button>

        {/* Effects Popover Button */}
        <button
          onClick={() => setActivePopover(activePopover === "effects" ? null : "effects")}
          className={`p-3 rounded-xl transition ${
            activePopover === "effects"
              ? "bg-purple-600/30 border border-purple-500 text-purple-300"
              : isLight ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100" : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
          }`}
          title="Visual Ink Effects (Glow, Neon, Spark, Flow)"
        >
          <Sparkles className="h-5 w-5" />
        </button>

        <div className={`w-6 h-px my-1 ${isLight ? "bg-slate-200" : "bg-slate-800"}`} />

        {/* Undo */}
        <button
          onClick={handleUndo}
          disabled={activeMode === "write" ? completedStrokes.length === 0 : confirmedShapes.length === 0}
          className="p-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.05] disabled:opacity-30 transition"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="h-5 w-5" />
        </button>

        {/* Redo */}
        <button
          onClick={handleRedo}
          disabled={strokeFuture.length === 0}
          className="p-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.05] disabled:opacity-30 transition"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="h-5 w-5" />
        </button>

        {/* Clear */}
        <button
          onClick={handleClear}
          disabled={activeMode === "write" ? completedStrokes.length === 0 : confirmedShapes.length === 0}
          className="p-3 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 transition"
          title="Clear Board"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>

      {/* COMPACT FLOATING POPOVERS (Anchored to the right of the vertical toolbar) */}
      {activePopover === "style" && (
        <div className={`absolute left-20 top-1/2 -translate-y-1/2 z-40 p-4 rounded-2xl border backdrop-blur-2xl shadow-2xl flex flex-col gap-2 w-56 animate-in fade-in slide-in-from-left-2 duration-150 ${
          isLight ? "bg-white/95 border-slate-300 text-slate-800" : "bg-slate-950/95 border-white/[0.12] text-white"
        }`}>
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-1.5">
            <span className="text-xs font-mono font-bold uppercase text-purple-400">Pen Style</span>
            <button onClick={() => setActivePopover(null)} className="text-xs text-slate-400 hover:text-white">Close</button>
          </div>
          {[
            { id: "marker", label: "Marker" },
            { id: "brush", label: "Brush" },
            { id: "neon", label: "Neon Ink" },
            { id: "glow", label: "Glow Pen" },
            { id: "highlighter", label: "Highlighter" },
            { id: "precision", label: "Precision Pen" }
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => {
                setPenStyle(st.id as any);
                setActiveTool("pen");
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center justify-between transition ${
                penStyle === st.id
                  ? "bg-purple-600 text-white shadow-[0_0_12px_rgba(168,85,247,0.5)]"
                  : "hover:bg-white/[0.08] text-slate-300"
              }`}
            >
              <span>{st.label}</span>
              {penStyle === st.id && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      )}

      {activePopover === "color" && (
        <div className={`absolute left-20 top-1/2 -translate-y-1/2 z-40 p-4 rounded-2xl border backdrop-blur-2xl shadow-2xl flex flex-col gap-3 w-64 animate-in fade-in slide-in-from-left-2 duration-150 ${
          isLight ? "bg-white/95 border-slate-300 text-slate-800" : "bg-slate-950/95 border-white/[0.12] text-white"
        }`}>
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-1.5">
            <span className="text-xs font-mono font-bold uppercase text-purple-400">Curated Colors</span>
            <button onClick={() => setActivePopover(null)} className="text-xs text-slate-400 hover:text-white">Close</button>
          </div>
          <div className="grid grid-cols-5 gap-2.5">
            {PALETTE_COLORS.map((hex) => (
              <button
                key={hex}
                onClick={() => {
                  setPenColor(hex);
                  setActiveTool("pen");
                }}
                className={`w-8 h-8 rounded-xl transition-transform ${
                  penColor === hex ? "scale-115 ring-2 ring-white ring-offset-2 ring-offset-slate-950 shadow-[0_0_12px_rgba(255,255,255,0.4)]" : "hover:scale-105"
                }`}
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
          <div className="flex items-center justify-between text-xs font-mono pt-1 border-t border-white/[0.06]">
            <span className="text-slate-400">Custom Hex:</span>
            <input
              type="text"
              value={penColor}
              onChange={(e) => setPenColor(e.target.value)}
              className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-mono text-xs w-24 text-center"
            />
          </div>
        </div>
      )}

      {activePopover === "size" && (
        <div className={`absolute left-20 top-1/2 -translate-y-1/2 z-40 p-4 rounded-2xl border backdrop-blur-2xl shadow-2xl flex flex-col gap-3 w-64 animate-in fade-in slide-in-from-left-2 duration-150 ${
          isLight ? "bg-white/95 border-slate-300 text-slate-800" : "bg-slate-950/95 border-white/[0.12] text-white"
        }`}>
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-1.5">
            <span className="text-xs font-mono font-bold uppercase text-purple-400">Stroke Size</span>
            <span className="text-xs font-mono font-bold text-white">{penSize}px</span>
          </div>
          <input
            type="range"
            min="2"
            max="36"
            value={penSize}
            onChange={(e) => setPenSize(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
          {/* Live Preview Wave Canvas */}
          <div className="w-full h-14 rounded-xl bg-slate-900 border border-white/[0.1] overflow-hidden flex items-center justify-center">
            <canvas ref={livePreviewCanvasRef} width={220} height={56} className="w-full h-full block" />
          </div>
          <div className="flex items-center justify-between text-xs font-mono pt-1 border-t border-white/[0.06]">
            <span className="text-slate-400">Opacity</span>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={penOpacity}
              onChange={(e) => setPenOpacity(Number(e.target.value))}
              className="w-28 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
            <span className="font-bold">{Math.round(penOpacity * 100)}%</span>
          </div>
        </div>
      )}

      {activePopover === "effects" && (
        <div className={`absolute left-20 top-1/2 -translate-y-1/2 z-40 p-4 rounded-2xl border backdrop-blur-2xl shadow-2xl flex flex-col gap-2 w-56 animate-in fade-in slide-in-from-left-2 duration-150 ${
          isLight ? "bg-white/95 border-slate-300 text-slate-800" : "bg-slate-950/95 border-white/[0.12] text-white"
        }`}>
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-1.5">
            <span className="text-xs font-mono font-bold uppercase text-purple-400">Visual Effects</span>
            <button onClick={() => setActivePopover(null)} className="text-xs text-slate-400 hover:text-white">Close</button>
          </div>
          {[
            { id: "none", label: "None" },
            { id: "glow", label: "Glow" },
            { id: "neon", label: "Neon Core" },
            { id: "smooth", label: "Smooth Filter" },
            { id: "spark", label: "Sparkle Accent" },
            { id: "flow", label: "Velocity Flow" }
          ].map((ef) => (
            <button
              key={ef.id}
              onClick={() => setPenEffect(ef.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center justify-between transition ${
                penEffect === ef.id
                  ? "bg-purple-600 text-white shadow-[0_0_12px_rgba(168,85,247,0.5)]"
                  : "hover:bg-white/[0.08] text-slate-300"
              }`}
            >
              <span>{ef.label}</span>
              {penEffect === ef.id && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      )}

      {/* 5. MINIMAL BOTTOM FLOATING ACTION BAR */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 pointer-events-auto">
        <div className={`px-4 py-2 rounded-full border backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] flex items-center gap-3 ${
          isLight ? "bg-white/95 border-slate-300 text-slate-800" : "bg-slate-950/85 border-white/[0.12] text-white"
        }`}>
          
          {/* Mode Switch: [ Write ] [ Shapes ] */}
          <div className="flex items-center bg-slate-900/80 rounded-full p-1 border border-white/[0.08]">
            <button
              onClick={() => handleModeSwitch("write")}
              className={`px-4 py-1 rounded-full text-xs font-bold transition ${
                activeMode === "write"
                  ? "bg-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.6)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Write
            </button>
            <button
              onClick={() => handleModeSwitch("shapes")}
              className={`px-4 py-1 rounded-full text-xs font-bold transition ${
                activeMode === "shapes"
                  ? "bg-cyan-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.6)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Shapes
            </button>
          </div>

          {/* Confirm Shape Button in Shapes Mode */}
          {activeMode === "shapes" && (
            <button
              onClick={confirmLiveShape}
              className="px-3 py-1 rounded-full bg-cyan-600/20 hover:bg-cyan-600/40 border border-cyan-500/50 text-cyan-300 text-xs font-mono font-bold transition flex items-center gap-1.5"
              title="Confirm current live geometry into permanent scene"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Confirm Shape</span>
            </button>
          )}

          <div className="w-px h-5 bg-slate-800" />

          {/* Snapshot Button */}
          <button
            onClick={handleSnapshot}
            className="p-2 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition"
            title="Take Snapshot (Camera + Overlays)"
          >
            <Camera className="h-4 w-4" />
          </button>

          {/* Record / Stop Button */}
          <button
            onClick={recordingStatus === "IDLE" ? handleToggleRecord : handleStopRecord}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-mono text-xs font-bold transition ${
              recordingStatus === "IDLE"
                ? "bg-red-600 hover:bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                : "bg-red-700 hover:bg-red-600 text-white"
            }`}
            title={recordingStatus === "IDLE" ? "Start Recording" : "Stop and Save Recording"}
          >
            {recordingStatus === "IDLE" ? (
              <>
                <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                <span>Record</span>
              </>
            ) : (
              <>
                <StopSquare className="h-3.5 w-3.5 fill-white" />
                <span>Stop</span>
              </>
            )}
          </button>

          {/* Pause Button */}
          <button
            onClick={handleToggleRecord}
            disabled={recordingStatus === "IDLE"}
            className={`p-2 rounded-full transition ${
              recordingStatus === "RECORDING"
                ? "bg-amber-600/40 border border-amber-500 text-amber-300"
                : recordingStatus === "PAUSED"
                ? "bg-emerald-600/40 border border-emerald-500 text-emerald-300"
                : "text-slate-600 opacity-40 cursor-not-allowed"
            }`}
            title={recordingStatus === "PAUSED" ? "Resume Recording" : "Pause Recording"}
          >
            {recordingStatus === "RECORDING" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* 6. INTERACTIVE 3D DEMO MODAL */}
      {isDemoOpen && <InteractiveAirspaceDemo onClose={() => setIsDemoOpen(false)} />}
    </div>
  );
}
export default AirspaceWorkspace;
