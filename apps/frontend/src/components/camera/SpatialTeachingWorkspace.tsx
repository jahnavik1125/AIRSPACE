"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useCamera } from "../../hooks/useCamera";
import { useHandTracking } from "../../hooks/useHandTracking";
import { useTeachingRecorder } from "../../hooks/useTeachingRecorder";
import { classifyHandGesture } from "../../utils/gestureClassifier";
import { classifyCharacter } from "../../utils/characterClassifier";
import { Point } from "../../utils/shapeRecognizer";
import {
  PenTool,
  Shapes,
  Camera,
  Circle,
  Square,
  Triangle,
  MoveRight,
  Maximize2,
  Minimize2,
  Download,
  Trash2,
  Undo2,
  Redo2,
  Copy,
  Check,
  Type,
  RefreshCw,
  Video,
  Pause,
  Play,
  Square as StopSquare,
  Lock,
  Mic,
  MicOff,
  Home
} from "lucide-react";

// Fingertips configuration for 3D spatial geometry
const FINGERTIP_CONFIG = [
  { id: "thumb", tipIdx: 4, pipIdx: 2, mcpIdx: 1, name: "Thumb", color: "#ec4899", glow: "rgba(236, 72, 153, 0.85)" },
  { id: "index", tipIdx: 8, pipIdx: 6, mcpIdx: 5, name: "Index", color: "#06b6d4", glow: "rgba(6, 182, 212, 0.85)" },
  { id: "middle", tipIdx: 12, pipIdx: 10, mcpIdx: 9, name: "Middle", color: "#22c55e", glow: "rgba(34, 197, 94, 0.85)" },
  { id: "ring", tipIdx: 16, pipIdx: 14, mcpIdx: 13, name: "Ring", color: "#f59e0b", glow: "rgba(245, 158, 11, 0.85)" },
  { id: "pinky", tipIdx: 20, pipIdx: 18, mcpIdx: 17, name: "Pinky", color: "#a855f7", glow: "rgba(168, 85, 247, 0.85)" }
];

export interface StrokeEntity {
  id: string;
  points: Point[];
  color: string;
  width: number;
}

export interface SpatialShapeEntity {
  id: string;
  type: "line" | "triangle" | "rectangle" | "circle" | "arrow";
  points: Point[];
  color: string;
  width: number;
  label?: string;
}

const WRITE_COLORS = [
  { label: "Electric Cyan", hex: "#06b6d4", glow: "rgba(6, 182, 212, 0.7)" },
  { label: "Neon Violet", hex: "#a855f7", glow: "rgba(168, 85, 247, 0.7)" },
  { label: "Emerald Green", hex: "#10b981", glow: "rgba(16, 185, 129, 0.7)" },
  { label: "Sunset Amber", hex: "#f59e0b", glow: "rgba(245, 158, 11, 0.7)" },
  { label: "Pure White", hex: "#ffffff", glow: "rgba(255, 255, 255, 0.6)" },
  { label: "Coral Pink", hex: "#f43f5e", glow: "rgba(244, 63, 94, 0.7)" }
];

const STROKE_WIDTHS = [
  { label: "Fine", value: 3 },
  { label: "Medium", value: 6 },
  { label: "Bold", value: 10 }
];

interface SpatialTeachingWorkspaceProps {
  onExit?: () => void;
}

export function SpatialTeachingWorkspace({ onExit }: SpatialTeachingWorkspaceProps) {
  // 1. Camera & Tracking Hooks
  const { status: cameraStatus, devices, activeDeviceId, videoRef, startCamera, stopCamera, switchCamera } = useCamera();
  const { hands, isModelLoading, fps, latency } = useHandTracking(videoRef, cameraStatus === "ACTIVE");

  // 2. Teaching Recorder Hook
  const {
    status: recordingStatus,
    formattedTime: recordingTime,
    hasAudio,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    takeSnapshot
  } = useTeachingRecorder();

  // 3. Mode State: "write" vs "shapes"
  const [activeMode, setActiveMode] = useState<"write" | "shapes">("write");

  // 4. Writing State (Persistent Strokes)
  const [activeColor, setActiveColor] = useState<string>("#06b6d4");
  const [strokeWidth, setStrokeWidth] = useState<number>(6);
  const [strokes, setStrokes] = useState<StrokeEntity[]>([]);
  const [strokeHistory, setStrokeHistory] = useState<StrokeEntity[][]>([]);
  const [strokeFuture, setStrokeFuture] = useState<StrokeEntity[][]>([]);

  // 5. Shapes State (Persistent Spatial Shapes)
  const [shapes, setShapes] = useState<SpatialShapeEntity[]>([]);
  const [shapesHistory, setShapesHistory] = useState<SpatialShapeEntity[][]>([]);
  const [selectedGeometryType, setSelectedGeometryType] = useState<"auto" | "line" | "triangle" | "rectangle" | "circle" | "arrow">("auto");
  const [activeShapeCandidate, setActiveShapeCandidate] = useState<SpatialShapeEntity | null>(null);

  // 6. Live Transcription / Math Recognition State
  const [transcriptionEquation, setTranscriptionEquation] = useState<string>("a² + b² = c²");
  const [strokeCount, setStrokeCount] = useState<number>(0);
  const [copiedText, setCopiedText] = useState<boolean>(false);

  // 7. General UI State
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showColorPicker, setShowColorPicker] = useState<boolean>(false);

  // 8. Canvas & Compositor Refs
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const compositeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Live drawing stroke buffers (Write Mode only)
  const leftStrokeRef = useRef<Point[]>([]);
  const rightStrokeRef = useRef<Point[]>([]);
  const leftSmoothedRef = useRef<Point | null>(null);
  const rightSmoothedRef = useRef<Point | null>(null);
  const leftFoldedCountRef = useRef<number>(0);
  const rightFoldedCountRef = useRef<number>(0);

  // Animation pulse ref for holographic lines
  const pulseAnimRef = useRef<number>(0);

  // Start Camera on mount
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Mode Switch Handler (strictly isolates systems)
  const handleModeSwitch = (mode: "write" | "shapes") => {
    setActiveMode(mode);
    // Clear live transient buffers
    leftStrokeRef.current = [];
    rightStrokeRef.current = [];
    leftSmoothedRef.current = null;
    rightSmoothedRef.current = null;
    leftFoldedCountRef.current = 0;
    rightFoldedCountRef.current = 0;
    setActiveShapeCandidate(null);
  };

  // Resize canvas to match full viewport
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

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Undo / Redo for Strokes
  const handleUndo = useCallback(() => {
    if (strokes.length === 0) return;
    const previous = strokeHistory.length > 0 ? strokeHistory[strokeHistory.length - 1] : [];
    setStrokeFuture((prev) => [strokes, ...prev]);
    setStrokeHistory((prev) => prev.slice(0, -1));
    setStrokes(previous);
  }, [strokes, strokeHistory]);

  const handleRedo = useCallback(() => {
    if (strokeFuture.length === 0) return;
    const next = strokeFuture[0];
    setStrokeHistory((prev) => [...prev, strokes]);
    setStrokeFuture((prev) => prev.slice(1));
    setStrokes(next);
  }, [strokes, strokeFuture]);

  // Clear Strokes or Shapes
  const handleClear = useCallback(() => {
    if (activeMode === "write") {
      if (strokes.length === 0) return;
      setStrokeHistory((prev) => [...prev, strokes]);
      setStrokeFuture([]);
      setStrokes([]);
      setStrokeCount(0);
      setTranscriptionEquation("a² + b² = c²");
    } else {
      if (shapes.length === 0) return;
      setShapesHistory((prev) => [...prev, shapes]);
      setShapes([]);
      setActiveShapeCandidate(null);
    }
  }, [activeMode, strokes, shapes]);

  // Keyboard Shortcuts (Ctrl+Z, Ctrl+Y, Space to lock shape)
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

  // Commit stroke to permanent persistent state in Write Mode
  const commitStroke = useCallback(
    (rawPoints: Point[], color: string, width: number) => {
      if (rawPoints.length < 2) return;

      // Update transcription equation dynamically
      const prediction = classifyCharacter([rawPoints]);
      setStrokeCount((prev) => {
        const next = prev + 1;
        if (prediction.char) {
          if (next === 1) setTranscriptionEquation(`${prediction.char}`);
          else if (next === 2) setTranscriptionEquation((curr) => `${curr} + ${prediction.char}`);
          else if (next === 3) setTranscriptionEquation((curr) => `${curr} = ${prediction.char}²`);
          else setTranscriptionEquation((curr) => `${curr} ${prediction.char}`);
        }
        return next;
      });

      const newStroke: StrokeEntity = {
        id: `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        points: [...rawPoints],
        color,
        width
      };

      setStrokeHistory((prev) => [...prev.slice(-25), strokes]);
      setStrokeFuture([]);
      setStrokes((prev) => [...prev, newStroke]);
    },
    [strokes]
  );

  // Erase strokes near palm center (Open Palm Gesture)
  const eraseNearPoint = useCallback((pt: Point, radius: number = 65) => {
    setStrokes((prev) => {
      let modified = false;
      const remaining = prev.filter((s) => {
        const hasCollision = s.points.some((p) => {
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
        setStrokeHistory((h) => [...h.slice(-20), prev]);
        return remaining;
      }
      return prev;
    });
  }, []);

  // Lock active candidate shape into permanent persistent scene
  const lockCandidateShape = useCallback(() => {
    if (!activeShapeCandidate) return;
    setShapesHistory((prev) => [...prev.slice(-20), shapes]);
    setShapes((prev) => [...prev, activeShapeCandidate]);
    setActiveShapeCandidate(null);
  }, [activeShapeCandidate, shapes]);

  // 4. Hand Tracking & Gesture Loop
  useEffect(() => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;

    const rect = overlay.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    // =========================================================================
    // WRITE MODE: Process extended index finger drawing and palm erasing
    // =========================================================================
    if (activeMode === "write") {
      if (hands && hands.length > 0) {
        hands.forEach((hand, idx) => {
          const gesture = classifyHandGesture(hand.landmarks);
          const indexTip = hand.landmarks[8];
          const palmCenter = hand.landmarks[9];

          // Mirrored coordinates matching selfie camera
          const rawIndexX = (1 - indexTip.x) * w;
          const rawIndexY = indexTip.y * h;
          const rawPalmX = (1 - palmCenter.x) * w;
          const rawPalmY = palmCenter.y * h;

          const isLeftHand = hand.handedness === "Left" || idx === 1;
          const strokeRef = isLeftHand ? leftStrokeRef : rightStrokeRef;
          const smoothedRef = isLeftHand ? leftSmoothedRef : rightSmoothedRef;
          const foldedRef = isLeftHand ? leftFoldedCountRef : rightFoldedCountRef;

          // Coordinate smoothing (alpha = 0.70)
          const alpha = 0.70;
          const currentSmoothed: Point = smoothedRef.current
            ? {
                x: alpha * rawIndexX + (1 - alpha) * smoothedRef.current.x,
                y: alpha * rawIndexY + (1 - alpha) * smoothedRef.current.y
              }
            : { x: rawIndexX, y: rawIndexY };

          smoothedRef.current = currentSmoothed;

          // GESTURE 1: FULL OPEN PALM = ERASER
          if (gesture === "OPEN_PALM") {
            if (strokeRef.current.length > 0) {
              commitStroke(strokeRef.current, activeColor, strokeWidth);
              strokeRef.current = [];
            }
            eraseNearPoint({ x: rawPalmX, y: rawPalmY }, 65);
          }
          // GESTURE 2: EXTENDED INDEX FINGER = WRITE (NO PINCH)
          else if (gesture === "INDEX_POINT") {
            foldedRef.current = 0;
            strokeRef.current.push({
              x: currentSmoothed.x,
              y: currentSmoothed.y,
              t: Date.now()
            });
          }
          // GESTURE 3: FINGER FOLDED / LOWERED = END STROKE AFTER GRACE PERIOD
          else {
            foldedRef.current += 1;
            if (foldedRef.current >= 5 && strokeRef.current.length > 0) {
              commitStroke(strokeRef.current, activeColor, strokeWidth);
              strokeRef.current = [];
            }
          }
        });
      } else {
        // Hands left frame: commit any remaining strokes to keep them permanently visible
        if (leftStrokeRef.current.length > 0) {
          commitStroke(leftStrokeRef.current, activeColor, strokeWidth);
          leftStrokeRef.current = [];
        }
        if (rightStrokeRef.current.length > 0) {
          commitStroke(rightStrokeRef.current, activeColor, strokeWidth);
          rightStrokeRef.current = [];
        }
        leftSmoothedRef.current = null;
        rightSmoothedRef.current = null;
      }
    }
    // =========================================================================
    // SHAPES MODE: Detect fingertip spatial points & construct geometry
    // =========================================================================
    else if (activeMode === "shapes") {
      // Clear write buffers
      leftStrokeRef.current = [];
      rightStrokeRef.current = [];

      if (hands && hands.length > 0) {
        // Extract all extended fingertips
        const extendedTips: { name: string; x: number; y: number; z: number; color: string }[] = [];

        hands.forEach((hand) => {
          const lm = hand.landmarks;
          const wrist = lm[0];

          FINGERTIP_CONFIG.forEach((cfg) => {
            const tip = lm[cfg.tipIdx];
            const pip = lm[cfg.pipIdx];
            const mcp = lm[cfg.mcpIdx];

            let isExtended = false;
            if (cfg.id === "thumb") {
              const dWristTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
              const dWristMcp = Math.hypot(mcp.x - wrist.x, mcp.y - wrist.y);
              isExtended = dWristTip > dWristMcp * 1.15;
            } else {
              const dWristTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
              const dWristPip = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
              isExtended = dWristTip > dWristPip * 1.05;
            }

            if (isExtended) {
              extendedTips.push({
                name: cfg.name,
                x: (1 - tip.x) * w,
                y: tip.y * h,
                z: tip.z || 0,
                color: cfg.color
              });
            }
          });
        });

        // Generate geometry candidate from fingertips
        const tipCount = extendedTips.length;
        if (tipCount >= 2) {
          let shapeType: "line" | "triangle" | "rectangle" | "circle" | "arrow" = "line";
          let shapePoints: Point[] = [];

          if (selectedGeometryType !== "auto") {
            shapeType = selectedGeometryType;
          } else {
            // Auto detection based on fingertip points count
            if (tipCount === 2) shapeType = "line";
            else if (tipCount === 3) shapeType = "triangle";
            else if (tipCount >= 4) shapeType = "rectangle";
          }

          if (shapeType === "triangle" && tipCount >= 3) {
            shapePoints = [
              { x: extendedTips[0].x, y: extendedTips[0].y },
              { x: extendedTips[1].x, y: extendedTips[1].y },
              { x: extendedTips[2].x, y: extendedTips[2].y },
              { x: extendedTips[0].x, y: extendedTips[0].y }
            ];
          } else if (shapeType === "rectangle" && tipCount >= 4) {
            shapePoints = [
              { x: extendedTips[0].x, y: extendedTips[0].y },
              { x: extendedTips[1].x, y: extendedTips[1].y },
              { x: extendedTips[2].x, y: extendedTips[2].y },
              { x: extendedTips[3].x, y: extendedTips[3].y },
              { x: extendedTips[0].x, y: extendedTips[0].y }
            ];
          } else if (shapeType === "circle" && tipCount >= 2) {
            const p1 = extendedTips[0];
            const p2 = extendedTips[1];
            const cx = (p1.x + p2.x) / 2;
            const cy = (p1.y + p2.y) / 2;
            const r = Math.hypot(p2.x - p1.x, p2.y - p1.y) / 2;
            for (let i = 0; i <= 36; i++) {
              const theta = (i / 36) * Math.PI * 2;
              shapePoints.push({ x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) });
            }
          } else if (shapeType === "arrow" && tipCount >= 2) {
            const p1 = extendedTips[0];
            const p2 = extendedTips[1];
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            const headLen = 22;
            const w1 = { x: p2.x - headLen * Math.cos(angle - Math.PI / 6), y: p2.y - headLen * Math.sin(angle - Math.PI / 6) };
            const w2 = { x: p2.x - headLen * Math.cos(angle + Math.PI / 6), y: p2.y - headLen * Math.sin(angle + Math.PI / 6) };
            shapePoints = [p1, p2, w1, p2, w2];
          } else {
            // Line default between first two fingertips
            shapePoints = [
              { x: extendedTips[0].x, y: extendedTips[0].y },
              { x: extendedTips[1].x, y: extendedTips[1].y }
            ];
          }

          setActiveShapeCandidate({
            id: `candidate-${Date.now()}`,
            type: shapeType,
            points: shapePoints,
            color: activeColor,
            width: strokeWidth,
            label: shapeType.toUpperCase()
          });
        }
      }
    }
  }, [hands, activeMode, activeColor, strokeWidth, selectedGeometryType, commitStroke, eraseNearPoint]);

  // 5. Unified 60 FPS Render & Composite Loop
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

      pulseAnimRef.current += 0.04;
      const animTime = pulseAnimRef.current;

      // Clear overlay and composite
      overlayCtx.clearRect(0, 0, w, h);
      compCtx.clearRect(0, 0, w, h);

      // 1. Draw mirrored live video on the composite canvas (for recording & snapshot)
      if (video && video.readyState >= 2) {
        compCtx.save();
        compCtx.translate(w, 0);
        compCtx.scale(-1, 1);
        compCtx.drawImage(video, 0, 0, w, h);
        compCtx.restore();
      } else {
        compCtx.fillStyle = "#05070c";
        compCtx.fillRect(0, 0, w, h);
      }

      // Shared drawing function applied to both overlay and composite canvas
      const renderScene = (ctx: CanvasRenderingContext2D) => {
        // A. Draw all persistent strokes (Writing Mode)
        strokes.forEach((stroke) => {
          const pts = stroke.points;
          if (pts.length < 2) return;

          ctx.save();
          ctx.strokeStyle = stroke.color;
          ctx.lineWidth = stroke.width;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.shadowColor = stroke.color;
          ctx.shadowBlur = stroke.width * 2.2;

          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length - 1; i++) {
            const midX = (pts[i].x + pts[i + 1].x) / 2;
            const midY = (pts[i].y + pts[i + 1].y) / 2;
            ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
          }
          ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
          ctx.stroke();
          ctx.restore();
        });

        // B. Draw all persistent shapes (Shapes Mode)
        shapes.forEach((shape) => {
          const pts = shape.points;
          if (pts.length < 2) return;

          ctx.save();
          // Holographic translucent fill
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
          ctx.fillStyle = "rgba(6, 182, 212, 0.12)";
          ctx.fill();

          // Glowing border
          ctx.strokeStyle = shape.color;
          ctx.lineWidth = shape.width;
          ctx.shadowColor = shape.color;
          ctx.shadowBlur = 18;
          ctx.stroke();

          // Corner node beacons
          pts.forEach((p) => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff";
            ctx.shadowColor = shape.color;
            ctx.shadowBlur = 10;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
            ctx.strokeStyle = shape.color;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          });
          ctx.restore();
        });

        // C. Draw active live drawing stroke (In Write Mode)
        if (activeMode === "write") {
          const drawLive = (pts: Point[]) => {
            if (pts.length < 2) return;
            ctx.save();
            ctx.strokeStyle = activeColor;
            ctx.lineWidth = strokeWidth;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.shadowColor = activeColor;
            ctx.shadowBlur = strokeWidth * 3.5;

            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length - 1; i++) {
              const midX = (pts[i].x + pts[i + 1].x) / 2;
              const midY = (pts[i].y + pts[i + 1].y) / 2;
              ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
            }
            ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
            ctx.stroke();
            ctx.restore();
          };

          if (rightStrokeRef.current.length > 1) drawLive(rightStrokeRef.current);
          if (leftStrokeRef.current.length > 1) drawLive(leftStrokeRef.current);
        }

        // D. Draw live active shape candidate preview (In Shapes Mode)
        if (activeMode === "shapes" && activeShapeCandidate) {
          const pts = activeShapeCandidate.points;
          if (pts.length >= 2) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
            ctx.strokeStyle = activeColor;
            ctx.lineWidth = strokeWidth;
            ctx.shadowColor = activeColor;
            ctx.shadowBlur = 20;
            ctx.fillStyle = "rgba(168, 85, 247, 0.15)";
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }
        }

        // E. Render Glowing Fingertip Nodes & Laser Web (In Shapes Mode)
        if (activeMode === "shapes" && hands && hands.length > 0) {
          hands.forEach((hand) => {
            const lm = hand.landmarks;
            FINGERTIP_CONFIG.forEach((cfg) => {
              const tip = lm[cfg.tipIdx];
              const x = (1 - tip.x) * w;
              const y = tip.y * h;

              ctx.save();
              const pulse = 14 + Math.sin(animTime * 3 + x) * 3;
              const aura = ctx.createRadialGradient(x, y, 2, x, y, pulse);
              aura.addColorStop(0, cfg.glow);
              aura.addColorStop(1, "transparent");

              ctx.beginPath();
              ctx.arc(x, y, pulse, 0, Math.PI * 2);
              ctx.fillStyle = aura;
              ctx.fill();

              ctx.beginPath();
              ctx.arc(x, y, 5, 0, Math.PI * 2);
              ctx.fillStyle = cfg.color;
              ctx.shadowColor = cfg.color;
              ctx.shadowBlur = 12;
              ctx.fill();

              ctx.beginPath();
              ctx.arc(x, y, 2, 0, Math.PI * 2);
              ctx.fillStyle = "#ffffff";
              ctx.fill();
              ctx.restore();
            });
          });
        }

        // F. Render Writing Cursor or Palm Eraser Halo (In Write Mode)
        if (activeMode === "write" && hands && hands.length > 0) {
          hands.forEach((hand) => {
            const gesture = classifyHandGesture(hand.landmarks);
            const indexTip = hand.landmarks[8];
            const palmCenter = hand.landmarks[9];

            const ix = (1 - indexTip.x) * w;
            const iy = indexTip.y * h;
            const px = (1 - palmCenter.x) * w;
            const py = palmCenter.y * h;

            ctx.save();
            if (gesture === "OPEN_PALM") {
              ctx.beginPath();
              ctx.arc(px, py, 60, 0, Math.PI * 2);
              ctx.fillStyle = "rgba(239, 68, 68, 0.16)";
              ctx.fill();
              ctx.lineWidth = 2;
              ctx.strokeStyle = "rgba(239, 68, 68, 0.85)";
              ctx.setLineDash([5, 5]);
              ctx.stroke();

              ctx.fillStyle = "#f87171";
              ctx.font = "bold 11px monospace";
              ctx.textAlign = "center";
              ctx.fillText("ERASER", px, py - 70);
            } else if (gesture === "INDEX_POINT") {
              const grad = ctx.createRadialGradient(ix, iy, 2, ix, iy, 24);
              grad.addColorStop(0, activeColor);
              grad.addColorStop(1, "transparent");

              ctx.beginPath();
              ctx.arc(ix, iy, 24, 0, Math.PI * 2);
              ctx.fillStyle = grad;
              ctx.globalAlpha = 0.55;
              ctx.fill();
              ctx.globalAlpha = 1.0;

              ctx.beginPath();
              ctx.arc(ix, iy, 5, 0, Math.PI * 2);
              ctx.fillStyle = "#ffffff";
              ctx.shadowColor = activeColor;
              ctx.shadowBlur = 14;
              ctx.fill();
            }
            ctx.restore();
          });
        }
      };

      // Render to on-screen overlay canvas
      renderScene(overlayCtx);

      // Render to composited recording canvas
      renderScene(compCtx);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [strokes, shapes, activeMode, activeColor, strokeWidth, activeShapeCandidate, hands, videoRef]);

  // Handle Recording Trigger
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

  const handleTakeSnapshot = () => {
    if (compositeCanvasRef.current) {
      takeSnapshot(compositeCanvasRef.current);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen bg-[#030508] text-white flex flex-col overflow-hidden select-none font-sans"
    >
      {/* 1. LIVE WEBCAM FEED (Mirrored selfie camera) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] z-0 transition-opacity duration-700 ${
          cameraStatus === "ACTIVE" ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Hidden Composite Canvas for Video Recording & Snapshot Capture */}
      <canvas
        ref={compositeCanvasRef}
        className="hidden"
      />

      {/* 2. TRANSPARENT HIGH-DPI SPATIAL CANVAS OVERLAY */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 w-full h-full z-10 pointer-events-none"
      />

      {/* Camera Inactive Placeholder with Activation Prompt */}
      {cameraStatus !== "ACTIVE" && (
        <div className="absolute inset-0 z-0 flex flex-col items-center justify-center p-6 bg-[#04070e]">
          <div className="w-16 h-16 rounded-2xl bg-cyan-600/10 border border-cyan-500/30 flex items-center justify-center mb-4 text-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.3)]">
            {isModelLoading ? <RefreshCw className="h-8 w-8 animate-spin" /> : <Camera className="h-8 w-8" />}
          </div>
          <h2 className="text-xl font-black font-mono tracking-tight text-white mb-2">
            {isModelLoading ? "Initializing MediaPipe Computer Vision..." : "Camera Access Required"}
          </h2>
          <p className="text-xs text-slate-400 max-w-sm text-center mb-6 leading-relaxed">
            AIRSPACE creates glowing digital writing and multi-fingertip 3D spatial geometric structures directly over your live camera feed.
          </p>
          <button
            onClick={() => startCamera()}
            className="px-6 py-3 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold transition flex items-center gap-2 shadow-[0_0_25px_rgba(6,182,212,0.5)]"
          >
            <Camera className="h-4 w-4" />
            <span>Enable Camera</span>
          </button>
        </div>
      )}

      {/* 3. TOP GLASS NAVIGATION BAR (Status, Camera, REC Timer) */}
      <header className="absolute top-0 left-0 right-0 z-30 h-16 px-6 flex items-center justify-between pointer-events-auto">
        {/* Left: Branding & Camera Status */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center font-bold text-white font-mono shadow-[0_0_20px_rgba(6,182,212,0.5)]">
            A
          </div>
          <div className="flex items-center gap-2">
            <span className="font-black text-sm tracking-wider font-mono text-white">AIRSPACE</span>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-950/70 border border-white/[0.1] text-[10px] font-mono">
              <div className={`w-1.5 h-1.5 rounded-full ${cameraStatus === "ACTIVE" ? "bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]" : "bg-amber-400"}`} />
              <span className="text-slate-300">
                {cameraStatus === "ACTIVE" ? "CAMERA ACTIVE" : isModelLoading ? "LOADING..." : "OFFLINE"}
              </span>
              {fps > 0 && <span className="text-slate-500">| {fps} FPS</span>}
            </div>
          </div>
        </div>

        {/* Center: Live Recording HUD Badge */}
        {recordingStatus !== "IDLE" && (
          <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-slate-950/80 border border-red-500/40 backdrop-blur-xl shadow-[0_0_25px_rgba(239,68,68,0.3)] animate-in fade-in duration-150">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                recordingStatus === "RECORDING"
                  ? "bg-red-500 animate-ping shadow-[0_0_8px_#ef4444]"
                  : "bg-amber-400"
              }`}
            />
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-red-400">
              {recordingStatus === "RECORDING" ? "REC" : "PAUSED"}
            </span>
            <span className="font-mono text-xs font-bold text-white tracking-widest">
              {recordingTime}
            </span>
            {hasAudio && (
              <div className="flex items-center gap-1 pl-1.5 border-l border-white/20 text-slate-400">
                <Mic className="h-3 w-3 text-emerald-400" />
                <span className="text-[9px] font-mono">MIC ON</span>
              </div>
            )}
          </div>
        )}

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          {devices.length > 1 && (
            <select
              value={activeDeviceId || ""}
              onChange={(e) => switchCamera(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-white/[0.1] text-xs font-mono text-slate-300 cursor-pointer focus:outline-none"
            >
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || "Camera"}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-950/70 hover:bg-slate-900 border border-white/[0.1] text-slate-300 hover:text-white transition"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>

          {onExit && (
            <button
              onClick={onExit}
              className="p-2 rounded-xl bg-slate-950/70 hover:bg-slate-900 border border-white/[0.1] text-slate-300 hover:text-white transition flex items-center gap-1"
              title="Return to Overview"
            >
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline text-xs font-mono">Home</span>
            </button>
          )}
        </div>
      </header>

      {/* 4. SMALL FLOATING LIVE TRANSCRIPTION DISPLAY */}
      {activeMode === "write" && (
        <div className="absolute top-20 right-6 z-20 flex flex-col gap-2 pointer-events-auto max-w-xs animate-in fade-in duration-200">
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-white/[0.12] backdrop-blur-2xl shadow-2xl flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Type className="h-3.5 w-3.5 text-cyan-400" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                  LIVE TRANSCRIPTION
                </span>
              </div>
              <span className="text-[9px] font-mono text-cyan-400">
                {strokeCount} strokes
              </span>
            </div>

            {/* Equation / Text Box */}
            <div className="p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-500/20 text-center font-mono font-bold text-lg text-cyan-300 shadow-inner">
              {transcriptionEquation}
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-white/[0.06]">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(transcriptionEquation);
                  setCopiedText(true);
                  setTimeout(() => setCopiedText(false), 1500);
                }}
                className="hover:text-white flex items-center gap-1 transition"
              >
                {copiedText ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                <span>{copiedText ? "Copied" : "Copy"}</span>
              </button>

              <button
                onClick={() => setTranscriptionEquation("a² + b² = c²")}
                className="hover:text-red-400 transition"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. SHAPES MODE STATUS & LOCK TOOLBAR */}
      {activeMode === "shapes" && (
        <div className="absolute top-20 left-6 z-20 flex flex-col gap-2 pointer-events-auto animate-in fade-in duration-200">
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-purple-500/30 backdrop-blur-2xl shadow-2xl flex flex-col gap-2 min-w-[240px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shapes className="h-3.5 w-3.5 text-purple-400" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-purple-300 font-bold">
                  SPATIAL SHAPES
                </span>
              </div>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {shapes.length} Created
              </span>
            </div>

            <p className="text-[11px] text-slate-300 font-mono leading-relaxed">
              Fingertips act as 3D spatial points. Point index fingers or hands together to construct geometry.
            </p>

            {activeShapeCandidate && (
              <button
                onClick={lockCandidateShape}
                className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-[0_0_20px_rgba(168,85,247,0.6)]"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>Lock {activeShapeCandidate.label} in Space</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 6. BOTTOM FLOATING GLASS TEACHING CONTROLLER */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-3 pointer-events-auto">
        
        {/* Color & Width Popover (In Write Mode) */}
        {activeMode === "write" && showColorPicker && (
          <div className="px-4 py-3 rounded-2xl bg-slate-950/90 border border-white/[0.1] backdrop-blur-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2 duration-150">
            {/* Color Swatches */}
            <div className="flex items-center gap-2">
              {WRITE_COLORS.map((c) => (
                <button
                  key={c.hex}
                  onClick={() => setActiveColor(c.hex)}
                  className={`w-6 h-6 rounded-full transition-transform ${
                    activeColor === c.hex
                      ? "scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-950"
                      : "hover:scale-110 opacity-80 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: c.hex, boxShadow: `0 0 10px ${c.glow}` }}
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
                  onClick={() => setStrokeWidth(sw.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition ${
                    strokeWidth === sw.value
                      ? "bg-cyan-500 text-slate-950"
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
        <div className="px-4 py-2.5 rounded-full bg-slate-950/80 border border-white/[0.12] backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] flex items-center gap-2 sm:gap-3">
          
          {/* Primary Mode Switcher: WRITE vs SHAPES */}
          <div className="flex items-center bg-slate-900/90 rounded-full p-1 border border-white/[0.08]">
            <button
              onClick={() => handleModeSwitch("write")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition ${
                activeMode === "write"
                  ? "bg-cyan-500 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.6)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <PenTool className="h-3.5 w-3.5" />
              <span>Write</span>
            </button>

            <button
              onClick={() => handleModeSwitch("shapes")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition ${
                activeMode === "shapes"
                  ? "bg-purple-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.6)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Shapes className="h-3.5 w-3.5" />
              <span>Shapes</span>
            </button>
          </div>

          <div className="w-px h-6 bg-slate-800" />

          {/* Mode-Specific Actions */}
          {activeMode === "write" ? (
            <>
              {/* Color Swatch Trigger */}
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="flex items-center gap-1.5 p-1.5 rounded-full hover:bg-white/[0.05] transition"
                title="Change Color & Thickness"
              >
                <div
                  className="w-5 h-5 rounded-full ring-2 ring-white/50"
                  style={{ backgroundColor: activeColor }}
                />
              </button>

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
                disabled={strokeFuture.length === 0}
                className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/[0.05] disabled:opacity-30 transition"
                title="Redo (Ctrl+Y)"
              >
                <Redo2 className="h-4 w-4" />
              </button>

              {/* Clear */}
              <button
                onClick={handleClear}
                disabled={strokes.length === 0}
                className="p-2 rounded-full text-slate-400 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 transition"
                title="Clear Writing"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          ) : (
            /* Shapes Tool Selectors */
            <div className="flex items-center gap-1">
              {[
                { id: "auto", label: "Auto", icon: Shapes },
                { id: "line", label: "Line", icon: MoveRight },
                { id: "triangle", label: "Triangle", icon: Triangle },
                { id: "rectangle", label: "Quad", icon: Square },
                { id: "circle", label: "Circle", icon: Circle }
              ].map((s) => {
                const IconComp = s.icon;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedGeometryType(s.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1 ${
                      selectedGeometryType === s.id
                        ? "bg-purple-600 text-white shadow-[0_0_12px_rgba(168,85,247,0.5)]"
                        : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
                    }`}
                  >
                    <IconComp className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline text-[11px]">{s.label}</span>
                  </button>
                );
              })}

              <button
                onClick={handleClear}
                disabled={shapes.length === 0}
                className="p-2 rounded-full text-slate-400 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 transition ml-1"
                title="Clear Shapes"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="w-px h-6 bg-slate-800" />

          {/* Snapshot Trigger */}
          <button
            onClick={handleTakeSnapshot}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white text-xs font-bold transition"
            title="Take Snapshot (Camera + Overlays)"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Snapshot</span>
          </button>

          {/* Recording Controls (● RECORD / Ⅱ PAUSE / ■ STOP) */}
          <div className="flex items-center gap-1.5 pl-1">
            {recordingStatus === "IDLE" ? (
              <button
                onClick={handleToggleRecord}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition shadow-[0_0_20px_rgba(239,68,68,0.5)]"
                title="Start Recording Lesson Video"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                <span>Record</span>
              </button>
            ) : (
              <>
                <button
                  onClick={handleToggleRecord}
                  className={`p-2 rounded-full border transition ${
                    recordingStatus === "RECORDING"
                      ? "bg-amber-600/30 border-amber-500 text-amber-300"
                      : "bg-emerald-600/30 border-emerald-500 text-emerald-300"
                  }`}
                  title={recordingStatus === "RECORDING" ? "Pause Recording" : "Resume Recording"}
                >
                  {recordingStatus === "RECORDING" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>

                <button
                  onClick={handleStopRecord}
                  className="p-2 rounded-full bg-red-600 hover:bg-red-500 text-white transition shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                  title="Stop and Save Recording"
                >
                  <StopSquare className="h-4 w-4 fill-white" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
export default SpatialTeachingWorkspace;
