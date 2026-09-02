"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useCamera } from "../../hooks/useCamera";
import { useHandTracking } from "../../hooks/useHandTracking";
import { classifyHandGesture } from "../../utils/gestureClassifier";
import { classifyCharacter } from "../../utils/characterClassifier";
import { Point } from "../../utils/shapeRecognizer";
import {
  PenTool,
  Shapes,
  Camera,
  Maximize2,
  Minimize2,
  Download,
  Trash2,
  Undo2,
  Redo2,
  Copy,
  Check,
  Type,
  RefreshCw
} from "lucide-react";

// Tip indices in MediaPipe Hands
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

const WRITE_COLORS = [
  { label: "Electric Cyan", hex: "#06b6d4", glow: "rgba(6, 182, 212, 0.7)" },
  { label: "Neon Purple", hex: "#a855f7", glow: "rgba(168, 85, 247, 0.7)" },
  { label: "Cyber Blue", hex: "#3b82f6", glow: "rgba(59, 130, 246, 0.7)" },
  { label: "Emerald Green", hex: "#10b981", glow: "rgba(16, 185, 129, 0.7)" },
  { label: "Sunset Amber", hex: "#f59e0b", glow: "rgba(245, 158, 11, 0.7)" },
  { label: "Pure White", hex: "#ffffff", glow: "rgba(255, 255, 255, 0.6)" }
];

export function SpatialCameraWorkspace() {
  // 1. Camera & Hand Tracking Hooks
  const { status: cameraStatus, devices, activeDeviceId, videoRef, startCamera, stopCamera, switchCamera } = useCamera();
  const { hands, isModelLoading, fps, latency } = useHandTracking(videoRef, cameraStatus === "ACTIVE");

  // 2. Strict Mode Separation: "write" vs "shapes"
  const [activeMode, setActiveMode] = useState<"write" | "shapes">("write");

  // Write Mode State
  const [activeColor, setActiveColor] = useState<string>("#06b6d4");
  const [strokeWidth, setStrokeWidth] = useState<number>(5);
  const [strokes, setStrokes] = useState<StrokeEntity[]>([]);
  const [history, setHistory] = useState<StrokeEntity[][]>([]);
  const [future, setFuture] = useState<StrokeEntity[][]>([]);

  // Floating Writing Recognition Panel State
  const [recognizedChar, setRecognizedChar] = useState<string>("");
  const [recognitionConfidence, setRecognitionConfidence] = useState<number>(0);
  const [accumulatedText, setAccumulatedText] = useState<string>("");
  const [copiedText, setCopiedText] = useState<boolean>(false);

  // Common UI State
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Canvas and Container Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Live drawing stroke buffers (Write Mode only)
  const leftStrokeRef = useRef<Point[]>([]);
  const rightStrokeRef = useRef<Point[]>([]);
  const leftSmoothedRef = useRef<Point | null>(null);
  const rightSmoothedRef = useRef<Point | null>(null);
  const leftFoldedCountRef = useRef<number>(0);
  const rightFoldedCountRef = useRef<number>(0);

  // Animation frame tracker for energy pulse effects on laser lines
  const pulseAnimRef = useRef<number>(0);

  // Start camera automatically on mount
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Mode Switch Handler: strictly clears drawing buffers when entering Shapes mode
  const handleModeChange = (mode: "write" | "shapes") => {
    setActiveMode(mode);
    // When switching to shapes, completely disable/clear any active writing strokes
    leftStrokeRef.current = [];
    rightStrokeRef.current = [];
    leftSmoothedRef.current = null;
    rightSmoothedRef.current = null;
    leftFoldedCountRef.current = 0;
    rightFoldedCountRef.current = 0;
  };

  // Resize canvas to match full viewport dimensions
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

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Undo / Redo (Write Mode only)
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

  // Commit stroke to permanent list in Write Mode
  const commitStroke = useCallback((rawPoints: Point[], color: string, width: number) => {
    if (rawPoints.length < 2) return;

    // Run client-side character recognition
    const prediction = classifyCharacter([rawPoints]);
    if (prediction.char && prediction.confidence >= 0.70) {
      setRecognizedChar(prediction.char);
      setRecognitionConfidence(Math.round(prediction.confidence * 100));
      setAccumulatedText((prev) => prev + prediction.char);
    }

    const newStroke: StrokeEntity = {
      id: `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      points: [...rawPoints],
      color,
      width
    };

    setHistory((prev) => [...prev.slice(-25), strokes]);
    setFuture([]);
    setStrokes((prev) => [...prev, newStroke]);
  }, [strokes]);

  // Erase strokes near palm center in Write Mode
  const eraseNearPoint = useCallback((pt: Point, radius: number = 60) => {
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
        setHistory((h) => [...h.slice(-20), prev]);
        return remaining;
      }
      return prev;
    });
  }, []);

  // Snapshot Tool: Composites live video frame + canvas overlays to PNG
  const handleSnapshot = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const snapCanvas = document.createElement("canvas");
    snapCanvas.width = canvas.width;
    snapCanvas.height = canvas.height;
    const ctx = snapCanvas.getContext("2d");
    if (!ctx) return;

    // 1. Draw mirrored camera frame
    ctx.save();
    ctx.translate(snapCanvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);
    ctx.restore();

    // 2. Composite overlays
    ctx.drawImage(canvas, 0, 0);

    // 3. Watermark
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = `bold ${14 * (window.devicePixelRatio || 1)}px monospace`;
    ctx.fillText("AIRSPACE — Spatial Camera Workspace", 24, snapCanvas.height - 24);

    const link = document.createElement("a");
    link.download = `airspace-spatial-${activeMode}-${Date.now()}.png`;
    link.href = snapCanvas.toDataURL("image/png");
    link.click();
  }, [videoRef, activeMode]);

  // 3. Computer Vision Frame Processing & Mode Segregation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    // -------------------------------------------------------------
    // WRITE MODE ONLY: Process Index Writing and Palm Erasing
    // -------------------------------------------------------------
    if (activeMode === "write") {
      if (hands && hands.length > 0) {
        hands.forEach((hand, idx) => {
          const gesture = classifyHandGesture(hand.landmarks);
          const indexTip = hand.landmarks[8];
          const palmCenter = hand.landmarks[9];

          // Mirrored coordinate mapping matching scale-x-[-1] video
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

          // Palm Gesture: Full open palm = Erase mode
          if (gesture === "OPEN_PALM") {
            if (strokeRef.current.length > 0) {
              commitStroke(strokeRef.current, activeColor, strokeWidth);
              strokeRef.current = [];
            }
            eraseNearPoint({ x: rawPalmX, y: rawPalmY }, 65);
          }
          // Index Point Gesture: Draw smooth continuous ink (No Pinch)
          else if (gesture === "INDEX_POINT") {
            foldedRef.current = 0;
            strokeRef.current.push({
              x: currentSmoothed.x,
              y: currentSmoothed.y,
              t: Date.now()
            });
          }
          // Other / Folded gesture: End stroke after 5-frame grace period
          else {
            foldedRef.current += 1;
            if (foldedRef.current >= 5 && strokeRef.current.length > 0) {
              commitStroke(strokeRef.current, activeColor, strokeWidth);
              strokeRef.current = [];
            }
          }
        });
      } else {
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
    // -------------------------------------------------------------
    // SHAPES MODE ONLY: Ensure writing buffers stay completely clear
    // -------------------------------------------------------------
    else {
      leftStrokeRef.current = [];
      rightStrokeRef.current = [];
      leftSmoothedRef.current = null;
      rightSmoothedRef.current = null;
    }
  }, [hands, activeMode, activeColor, strokeWidth, commitStroke, eraseNearPoint]);

  // 4. Main 60 FPS Render Loop (Over Live Camera)
  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      // Advance pulse animation time
      pulseAnimRef.current += 0.04;
      const animTime = pulseAnimRef.current;

      ctx.clearRect(0, 0, w, h);

      // =========================================================================
      // MODE A: WRITE MODE (Render Digital Ink Trails and Palm Eraser)
      // =========================================================================
      if (activeMode === "write") {
        // Draw committed ink strokes
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

        // Draw live active stroke (Right hand & Left hand)
        const renderLiveStroke = (pts: Point[]) => {
          if (pts.length < 2) return;
          ctx.save();
          ctx.strokeStyle = activeColor;
          ctx.lineWidth = strokeWidth;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.shadowColor = activeColor;
          ctx.shadowBlur = strokeWidth * 3.2;

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

        if (rightStrokeRef.current.length > 1) renderLiveStroke(rightStrokeRef.current);
        if (leftStrokeRef.current.length > 1) renderLiveStroke(leftStrokeRef.current);

        // Render index cursor / open palm indicator
        if (hands && hands.length > 0) {
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
              // Open Palm Eraser Halo
              ctx.beginPath();
              ctx.arc(px, py, 60, 0, Math.PI * 2);
              ctx.fillStyle = "rgba(239, 68, 68, 0.16)";
              ctx.fill();
              ctx.lineWidth = 2;
              ctx.strokeStyle = "rgba(239, 68, 68, 0.85)";
              ctx.setLineDash([5, 5]);
              ctx.stroke();

              ctx.beginPath();
              ctx.arc(px, py, 5, 0, Math.PI * 2);
              ctx.fillStyle = "#ef4444";
              ctx.fill();

              ctx.fillStyle = "#f87171";
              ctx.font = "bold 11px monospace";
              ctx.textAlign = "center";
              ctx.fillText("ERASER", px, py - 70);
            } else if (gesture === "INDEX_POINT") {
              // Glowing Writing Fingertip Halo
              const grad = ctx.createRadialGradient(ix, iy, 2, ix, iy, 26);
              grad.addColorStop(0, activeColor);
              grad.addColorStop(1, "transparent");

              ctx.beginPath();
              ctx.arc(ix, iy, 26, 0, Math.PI * 2);
              ctx.fillStyle = grad;
              ctx.globalAlpha = 0.55;
              ctx.fill();
              ctx.globalAlpha = 1.0;

              ctx.beginPath();
              ctx.arc(ix, iy, 6, 0, Math.PI * 2);
              ctx.fillStyle = "#ffffff";
              ctx.shadowColor = activeColor;
              ctx.shadowBlur = 14;
              ctx.fill();

              ctx.beginPath();
              ctx.arc(ix, iy, 14, 0, Math.PI * 2);
              ctx.lineWidth = 1.5;
              ctx.strokeStyle = activeColor;
              ctx.stroke();
            }
            ctx.restore();
          });
        }
      }

      // =========================================================================
      // MODE B: SHAPES MODE — 3D SPATIAL FINGERTIP GEOMETRIC CONSTELLATION
      // EXACTLY MATCHING THE USER'S REFERENCE IMAGE
      // (No ink, no writing trails, no text buffers)
      // =========================================================================
      else if (activeMode === "shapes") {
        if (hands && hands.length > 0) {
          // Extract extended fingertips for each hand
          interface DetectedFingertip {
            id: string;
            name: string;
            handIdx: number;
            handedness: string;
            x: number;
            y: number;
            z: number;
            color: string;
            glow: string;
          }

          const allTips: DetectedFingertip[] = [];
          const handsTipsMap: DetectedFingertip[][] = [];

          hands.forEach((hand, hIdx) => {
            const handTips: DetectedFingertip[] = [];
            const lm = hand.landmarks;
            const wrist = lm[0];

            FINGERTIP_CONFIG.forEach((cfg) => {
              const tip = lm[cfg.tipIdx];
              const pip = lm[cfg.pipIdx];
              const mcp = lm[cfg.mcpIdx];

              // Check if finger is extended
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
                // Mirrored coordinate mapping
                const x = (1 - tip.x) * w;
                const y = tip.y * h;
                const z = tip.z || 0;

                const node: DetectedFingertip = {
                  id: `${hand.handedness || hIdx}-${cfg.id}`,
                  name: cfg.name,
                  handIdx: hIdx,
                  handedness: hand.handedness || (hIdx === 0 ? "Right" : "Left"),
                  x,
                  y,
                  z,
                  color: cfg.color,
                  glow: cfg.glow
                };
                handTips.push(node);
                allTips.push(node);
              }
            });
            handsTipsMap.push(handTips);
          });

          // -------------------------------------------------------------
          // 1. Two-Hand Spatial Mesh & Laser Connections (Reference Image)
          // -------------------------------------------------------------
          if (handsTipsMap.length >= 2) {
            const h1Tips = handsTipsMap[0];
            const h2Tips = handsTipsMap[1];

            // A. Detect polygon / closed structures between hands (e.g. index-thumb quadrilateral)
            const h1Index = h1Tips.find((t) => t.name === "Index");
            const h1Thumb = h1Tips.find((t) => t.name === "Thumb");
            const h2Index = h2Tips.find((t) => t.name === "Index");
            const h2Thumb = h2Tips.find((t) => t.name === "Thumb");

            if (h1Index && h1Thumb && h2Index && h2Thumb) {
              // Fill translucent holographic polygon face
              ctx.save();
              ctx.beginPath();
              ctx.moveTo(h1Thumb.x, h1Thumb.y);
              ctx.lineTo(h1Index.x, h1Index.y);
              ctx.lineTo(h2Index.x, h2Index.y);
              ctx.lineTo(h2Thumb.x, h2Thumb.y);
              ctx.closePath();

              const faceGrad = ctx.createLinearGradient(h1Thumb.x, h1Thumb.y, h2Index.x, h2Index.y);
              faceGrad.addColorStop(0, "rgba(6, 182, 212, 0.12)");
              faceGrad.addColorStop(0.5, "rgba(168, 85, 247, 0.10)");
              faceGrad.addColorStop(1, "rgba(236, 72, 153, 0.12)");

              ctx.fillStyle = faceGrad;
              ctx.fill();

              // Border glow
              ctx.strokeStyle = "rgba(6, 182, 212, 0.4)";
              ctx.lineWidth = 1.5;
              ctx.stroke();
              ctx.restore();
            }

            // B. Draw cross-hand laser beams between corresponding & interacting fingertips
            h1Tips.forEach((t1) => {
              h2Tips.forEach((t2) => {
                // Connect same fingers (Thumb-Thumb, Index-Index, Middle-Middle, Ring-Ring, Pinky-Pinky)
                // Plus cross-connections between adjacent fingers (like the reference image!)
                const isSameFinger = t1.name === t2.name;
                const isAdjacent = Math.abs(
                  FINGERTIP_CONFIG.findIndex((c) => c.name === t1.name) -
                  FINGERTIP_CONFIG.findIndex((c) => c.name === t2.name)
                ) <= 1;

                if (isSameFinger || isAdjacent) {
                  ctx.save();

                  // Dynamic multi-color gradient line
                  const lineGrad = ctx.createLinearGradient(t1.x, t1.y, t2.x, t2.y);
                  lineGrad.addColorStop(0, t1.color);
                  lineGrad.addColorStop(1, t2.color);

                  // Parallax depth offset line (3D spatial depth effect)
                  const depthOffset = (t1.z + t2.z) * 12;
                  ctx.beginPath();
                  ctx.moveTo(t1.x + depthOffset, t1.y + depthOffset);
                  ctx.lineTo(t2.x + depthOffset, t2.y + depthOffset);
                  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
                  ctx.lineWidth = 1;
                  ctx.stroke();

                  // Main laser beam
                  ctx.beginPath();
                  ctx.moveTo(t1.x, t1.y);
                  ctx.lineTo(t2.x, t2.y);
                  ctx.strokeStyle = lineGrad;
                  ctx.lineWidth = isSameFinger ? 3 : 1.8;
                  ctx.shadowColor = t1.color;
                  ctx.shadowBlur = isSameFinger ? 16 : 10;
                  ctx.stroke();

                  // Energy pulse particle traveling along the beam
                  const pulsePos = (animTime * 0.8 + (t1.x + t2.y) * 0.005) % 1.0;
                  const px = t1.x + (t2.x - t1.x) * pulsePos;
                  const py = t1.y + (t2.y - t1.y) * pulsePos;

                  ctx.beginPath();
                  ctx.arc(px, py, 2.5, 0, Math.PI * 2);
                  ctx.fillStyle = "#ffffff";
                  ctx.shadowColor = "#ffffff";
                  ctx.shadowBlur = 8;
                  ctx.fill();

                  ctx.restore();
                }
              });
            });
          }

          // -------------------------------------------------------------
          // 2. Intra-hand Perimeter Constellation Lines (within each hand)
          // -------------------------------------------------------------
          handsTipsMap.forEach((handTips) => {
            if (handTips.length >= 2) {
              ctx.save();
              for (let i = 0; i < handTips.length - 1; i++) {
                const p1 = handTips[i];
                const p2 = handTips[i + 1];

                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);

                const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
                grad.addColorStop(0, p1.color);
                grad.addColorStop(1, p2.color);

                ctx.strokeStyle = grad;
                ctx.lineWidth = 2;
                ctx.shadowColor = p1.color;
                ctx.shadowBlur = 10;
                ctx.stroke();
              }
              ctx.restore();
            }
          });

          // -------------------------------------------------------------
          // 3. Render Luminous Fingertip Nodes (Spheres with Glowing Rings)
          // -------------------------------------------------------------
          allTips.forEach((tip) => {
            ctx.save();

            // Outer pulse aura
            const pulseRadius = 14 + Math.sin(animTime * 3 + tip.x) * 3;
            const auraGrad = ctx.createRadialGradient(tip.x, tip.y, 2, tip.x, tip.y, pulseRadius);
            auraGrad.addColorStop(0, tip.glow);
            auraGrad.addColorStop(1, "transparent");

            ctx.beginPath();
            ctx.arc(tip.x, tip.y, pulseRadius, 0, Math.PI * 2);
            ctx.fillStyle = auraGrad;
            ctx.fill();

            // Solid neon node
            ctx.beginPath();
            ctx.arc(tip.x, tip.y, 6, 0, Math.PI * 2);
            ctx.fillStyle = tip.color;
            ctx.shadowColor = tip.color;
            ctx.shadowBlur = 14;
            ctx.fill();

            // Luminous white core center
            ctx.beginPath();
            ctx.arc(tip.x, tip.y, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff";
            ctx.fill();

            // Coordinate anchor ring
            ctx.beginPath();
            ctx.arc(tip.x, tip.y, 9, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.restore();
          });
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [activeMode, strokes, activeColor, strokeWidth, hands]);

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen bg-[#030508] text-white flex flex-col overflow-hidden select-none font-sans"
    >
      {/* 1. LIVE CAMERA FEED (The Central Visual Focus) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] z-0 transition-opacity duration-700 ${
          cameraStatus === "ACTIVE" ? "opacity-100" : "opacity-0"
        }`}
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

      {/* 2. TRANSPARENT HIGH-DPI SPATIAL CANVAS OVERLAY */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full z-10 pointer-events-none"
      />

      {/* 3. MINIMAL TOP GLASS HEADER */}
      <header className="absolute top-0 left-0 right-0 z-30 h-16 px-6 flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center font-bold text-white font-mono shadow-[0_0_20px_rgba(6,182,212,0.5)]">
            A
          </div>
          <div className="flex items-center gap-2">
            <span className="font-black text-sm tracking-wider font-mono text-white">AIRSPACE</span>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-950/70 border border-white/[0.1] text-[10px] font-mono">
              <div className={`w-1.5 h-1.5 rounded-full ${cameraStatus === "ACTIVE" ? "bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]" : "bg-amber-400"}`} />
              <span className="text-slate-300">
                {cameraStatus === "ACTIVE" ? "Camera Active" : isModelLoading ? "Loading..." : "Offline"}
              </span>
              {fps > 0 && <span className="text-slate-500">| {fps} FPS</span>}
            </div>
          </div>
        </div>

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
        </div>
      </header>

      {/* 4. FLOATING WRITING RECOGNITION PANEL (Active in Write Mode Only) */}
      {activeMode === "write" && (
        <div className="absolute top-20 left-6 z-20 flex flex-col gap-2 pointer-events-auto max-w-xs animate-in fade-in duration-200">
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-white/[0.12] backdrop-blur-2xl shadow-2xl flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Type className="h-3.5 w-3.5 text-cyan-400" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                  Writing Recognition
                </span>
              </div>
              {recognizedChar && (
                <span className="text-[10px] font-mono text-cyan-400 font-semibold">
                  {recognitionConfidence}% Conf
                </span>
              )}
            </div>

            {/* Recognized Character Preview */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center font-mono text-2xl font-black text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                {recognizedChar || "--"}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[9px] text-slate-500 uppercase font-mono block">Accumulated Text</span>
                <p className="text-xs font-mono font-bold text-white truncate">
                  {accumulatedText || "Point index in air to write..."}
                </p>
              </div>
            </div>

            {/* Text Action Buttons */}
            {accumulatedText && (
              <div className="flex items-center gap-2 pt-1 border-t border-white/[0.06]">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(accumulatedText);
                    setCopiedText(true);
                    setTimeout(() => setCopiedText(false), 2000);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-300 hover:text-white flex items-center gap-1.5 transition"
                >
                  {copiedText ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedText ? "Copied" : "Copy"}</span>
                </button>
                <button
                  onClick={() => {
                    setAccumulatedText("");
                    setRecognizedChar("");
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-400 hover:text-red-400 transition"
                >
                  Clear Text
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. FLOATING SHAPES STATUS BADGE (Active in Shapes Mode Only) */}
      {activeMode === "shapes" && (
        <div className="absolute top-20 left-6 z-20 flex flex-col gap-2 pointer-events-auto animate-in fade-in duration-200">
          <div className="px-4 py-2.5 rounded-2xl bg-slate-950/80 border border-purple-500/30 backdrop-blur-2xl shadow-2xl flex items-center gap-2.5 font-mono text-xs">
            <Shapes className="h-4 w-4 text-purple-400 animate-pulse" />
            <div>
              <span className="text-white font-bold block text-[11px]">Spatial Hand Geometry</span>
              <span className="text-slate-400 text-[9px] block">
                {hands.length >= 2 ? "2 Hands Interacting — Laser Web Active" : "Bring both hands into view"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 6. BOTTOM FLOATING GLASS CONTROLLER (Minimal, Futuristic, Focused) */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-3 pointer-events-auto">
        <div className="px-4 py-2.5 rounded-full bg-slate-950/80 border border-white/[0.12] backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] flex items-center gap-3">
          
          {/* Primary Mode Switcher: WRITE vs SHAPES */}
          <div className="flex items-center bg-slate-900/90 rounded-full p-1 border border-white/[0.08]">
            <button
              onClick={() => handleModeChange("write")}
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
              onClick={() => handleModeChange("shapes")}
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

          {/* Controls visible in Write Mode */}
          {activeMode === "write" ? (
            <>
              {/* Color Swatches */}
              <div className="flex items-center gap-2">
                {WRITE_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    onClick={() => setActiveColor(c.hex)}
                    className={`w-5 h-5 rounded-full transition-transform ${
                      activeColor === c.hex
                        ? "scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-950"
                        : "hover:scale-110 opacity-70 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: c.hex, boxShadow: `0 0 10px ${c.glow}` }}
                    title={c.label}
                  />
                ))}
              </div>

              <div className="w-px h-6 bg-slate-800" />

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
            /* Controls visible in Shapes Mode */
            <div className="flex items-center gap-2 text-xs font-mono text-purple-300">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
              <span>Multi-Fingertip Laser Web</span>
            </div>
          )}

          <div className="w-px h-6 bg-slate-800" />

          {/* Snapshot Button (Captures current live camera frame + overlays) */}
          <button
            onClick={handleSnapshot}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white text-xs font-bold transition shadow-lg"
            title="Save Snapshot PNG"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Snapshot</span>
          </button>
        </div>
      </div>
    </div>
  );
}
export default SpatialCameraWorkspace;
