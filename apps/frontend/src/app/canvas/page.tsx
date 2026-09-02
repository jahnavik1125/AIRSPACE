"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { Camera, RefreshCw, Trash2, Check, X, ArrowLeft, Download, Save, Undo2, Redo2, MousePointer, Edit2, Eraser, Move, Shapes, Copy } from "lucide-react";
import Link from "next/link";

import { useCamera } from "../../hooks/useCamera";
import { useHandTracking } from "../../hooks/useHandTracking";
import { useSpatialWebSocket } from "../../hooks/useSpatialWebSocket";
import { CameraFeed } from "../../components/camera/CameraFeed";
import { CameraOverlay } from "../../components/camera/CameraOverlay";
import { PerformanceHUD } from "../../components/status/PerformanceHUD";
import { exportToSVG, CanvasObject } from "../../utils/svgExport";
import { classifyHandGesture } from "../../utils/gestureClassifier";

type ToolType = "PEN" | "ERASER" | "SELECT" | "PAN";

export default function CanvasPage() {
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

  // Drawing states
  const [activeTool, setActiveTool] = useState<ToolType>("PEN");
  const [objects, setObjects] = useState<CanvasObject[]>([]);
  const [history, setHistory] = useState<CanvasObject[][]>([]);
  const [redoList, setRedoList] = useState<CanvasObject[][]>([]);
  
  // Selection/Drag states
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const initialObjPosRef = useRef<{ x: number; y: number } | null>(null);

  // Brush settings
  const [brushColor, setBrushColor] = useState("#3b82f6"); // Neon blue default
  const [brushWidth, setBrushWidth] = useState(4);
  const [brushOpacity, setBrushOpacity] = useState(1.0);
  const [eraserWidth, setEraserWidth] = useState(20);

  // Shape conversion temp state
  const [lastDrawnStrokeId, setLastDrawnStrokeId] = useState<string | null>(null);
  const [pendingConversion, setPendingConversion] = useState<{
    originalStroke: CanvasObject;
    recognizedShape: CanvasObject;
    confidence: number;
  } | null>(null);

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const currentStrokeRef = useRef<{ x: number; y: number; t: number }[]>([]);
  const smoothedCursorRef = useRef<{ x: number; y: number } | null>(null);
  const lastStateRef = useRef<string>("HOVER");
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

  // Undo / Redo helpers
  const saveStateToHistory = (newObjects: CanvasObject[]) => {
    setHistory((prev) => [...prev, newObjects]);
    setRedoList([]);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setRedoList((prev) => [objects, ...prev]);
    setObjects(previous);
    setHistory((prev) => prev.slice(0, -1));
    setSelectedObjectId(null);
  };

  const handleRedo = () => {
    if (redoList.length === 0) return;
    const next = redoList[0];
    setHistory((prev) => [...prev, objects]);
    setObjects(next);
    setRedoList((prev) => prev.slice(1));
    setSelectedObjectId(null);
  };

  // Draw Canvas contents
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, width, height);

    // Draw grid
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

    // Draw all objects
    objects.forEach((obj) => {
      ctx.save();
      ctx.strokeStyle = obj.color || "#3b82f6";
      ctx.lineWidth = obj.width || 4;
      ctx.globalAlpha = obj.opacity !== undefined ? obj.opacity : 1.0;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Translate coordinates relative to position displacement
      const dx = obj.position.x * width;
      const dy = obj.position.y * height;

      const pts = obj.points.map((p) => ({
        x: p.x * width + dx,
        y: p.y * height + dy
      }));

      if (pts.length === 0) {
        ctx.restore();
        return;
      }

      if (obj.type === "STROKE") {
        if (pts.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
          }
          ctx.stroke();
        }
      } 
      else if (obj.type === "LINE") {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();
      } 
      else if (obj.type === "CIRCLE") {
        const minX = obj.boundingBox.minX * width + dx;
        const maxX = obj.boundingBox.maxX * width + dx;
        const minY = obj.boundingBox.minY * height + dy;
        const maxY = obj.boundingBox.maxY * height + dy;
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const r = Math.max(maxX - minX, maxY - minY) / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 2 * Math.PI);
        ctx.stroke();
      } 
      else if (obj.type === "RECTANGLE") {
        const minX = obj.boundingBox.minX * width + dx;
        const maxX = obj.boundingBox.maxX * width + dx;
        const minY = obj.boundingBox.minY * height + dy;
        const maxY = obj.boundingBox.maxY * height + dy;
        ctx.beginPath();
        ctx.rect(minX, minY, maxX - minX, maxY - minY);
        ctx.stroke();
      } 
      else if (obj.type === "TRIANGLE") {
        const minX = obj.boundingBox.minX * width + dx;
        const maxX = obj.boundingBox.maxX * width + dx;
        const minY = obj.boundingBox.minY * height + dy;
        const maxY = obj.boundingBox.maxY * height + dy;
        ctx.beginPath();
        ctx.moveTo((minX + maxX) / 2, minY);
        ctx.lineTo(maxX, maxY);
        ctx.lineTo(minX, maxY);
        ctx.closePath();
        ctx.stroke();
      } 
      else if (obj.type === "ARROW") {
        const pStart = pts[0];
        const pEnd = pts[pts.length - 1];
        
        ctx.beginPath();
        ctx.moveTo(pStart.x, pStart.y);
        ctx.lineTo(pEnd.x, pEnd.y);
        ctx.stroke();

        // Arrow head
        const angle = Math.atan2(pEnd.y - pStart.y, pEnd.x - pStart.x);
        const headLength = 15;
        ctx.beginPath();
        ctx.moveTo(pEnd.x, pEnd.y);
        ctx.lineTo(pEnd.x - headLength * Math.cos(angle - Math.PI / 6), pEnd.y - headLength * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(pEnd.x, pEnd.y);
        ctx.lineTo(pEnd.x - headLength * Math.cos(angle + Math.PI / 6), pEnd.y - headLength * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      }

      // Draw Selection Outline border
      if (selectedObjectId === obj.id) {
        const borderPadding = 6;
        const minX = obj.boundingBox.minX * width + dx - borderPadding;
        const maxX = obj.boundingBox.maxX * width + dx + borderPadding;
        const minY = obj.boundingBox.minY * height + dy - borderPadding;
        const maxY = obj.boundingBox.maxY * height + dy + borderPadding;

        ctx.strokeStyle = "#38bdf8"; // Neon light blue selector border
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.rect(minX, minY, maxX - minX, maxY - minY);
        ctx.stroke();
        ctx.setLineDash([]); // Reset
      }

      ctx.restore();
    });

    // Draw active drawing stroke (uncompleted vector path)
    const current = currentStrokeRef.current;
    if (activeTool === "PEN" && current.length >= 2) {
      ctx.beginPath();
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushWidth;
      ctx.globalAlpha = brushOpacity;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
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
      
      let pointerColor = "#60a5fa";
      let radius = 6;
      
      if (activeTool === "ERASER") {
        pointerColor = "#f87171";
        radius = eraserWidth / 2;
      } else if (lastGesture?.state === "PINCH_START" || lastGesture?.state === "PINCH_HOLD" || lastGesture?.state === "DRAG") {
        pointerColor = "#10b981";
        radius = 8;
      }

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      ctx.fillStyle = pointerColor;
      ctx.fill();
    }
  }, [objects, activeTool, brushColor, brushWidth, brushOpacity, eraserWidth, cameraStatus, lastGesture, selectedObjectId]);

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

  // Main Spatial tracking interaction loop
  useEffect(() => {
    const hand = hands[0];
    const hasHand = Boolean(hand && cameraStatus === "ACTIVE");

    if (hasHand || (lastGesture && wsConnected)) {
      missingFramesRef.current = 0;
      const rawX = hasHand ? hand.landmarks[8].x : lastGesture!.coordinates.x;
      const rawY = hasHand ? hand.landmarks[8].y : lastGesture!.coordinates.y;
      const gesture = hasHand ? classifyHandGesture(hand.landmarks) : (lastGesture?.gesture || "NONE");
      const wsState = lastGesture?.state || "HOVER";

      // 1. Mirror coordinates
      const mirroredX = 1.0 - rawX;

      // 2. Exponential Moving Average Cursor smoothing
      if (!smoothedCursorRef.current) {
        smoothedCursorRef.current = { x: mirroredX, y: rawY };
      } else {
        smoothedCursorRef.current = {
          x: EMA_BETA * mirroredX + (1 - EMA_BETA) * smoothedCursorRef.current.x,
          y: EMA_BETA * rawY + (1 - EMA_BETA) * smoothedCursorRef.current.y
        };
      }

      const cursor = smoothedCursorRef.current;

      // Check Pause gesture (OPEN_PALM)
      if (gesture === "OPEN_PALM") {
        isActionActiveRef.current = false;
        currentStrokeRef.current = [];
        drawCanvas();
        return;
      }

      // Action active when index pointing OR pinching
      const isIndexPoint = gesture === "INDEX_POINT";
      const isPinch = gesture === "PINCH" || wsState === "PINCH_START" || wsState === "PINCH_HOLD" || wsState === "DRAG";
      const isAction = isIndexPoint || isPinch;
      isActionActiveRef.current = isAction;

      // 3. Drive tools executions
      if (activeTool === "PEN") {
        if (isAction) {
          foldedFramesRef.current = 0;
          currentStrokeRef.current.push({ x: cursor.x, y: cursor.y, t: Date.now() });
        } else {
          foldedFramesRef.current += 1;
          if (foldedFramesRef.current >= 5 && currentStrokeRef.current.length > 0) {
            // Finish stroke
            const strokePts = [...currentStrokeRef.current];
            currentStrokeRef.current = [];

            if (strokePts.length >= 2) {
              const xs = strokePts.map((p) => p.x);
              const ys = strokePts.map((p) => p.y);
              const minX = Math.min(...xs);
              const maxX = Math.max(...xs);
              const minY = Math.min(...ys);
              const maxY = Math.max(...ys);

              const newStroke: CanvasObject = {
                id: `stroke-${Date.now()}`,
                type: "STROKE",
                points: strokePts,
                position: { x: 0, y: 0 },
                boundingBox: { minX, minY, maxX, maxY },
                color: brushColor,
                width: brushWidth,
                opacity: brushOpacity
              };

              const updatedObjects = [...objects, newStroke];
              saveStateToHistory(updatedObjects);
              setObjects(updatedObjects);
              setLastDrawnStrokeId(newStroke.id);
              setPendingConversion(null);
            }
          }
        }
      } 
      else if (activeTool === "ERASER") {
        if (isAction) {
          // Erase intersecting strokes/shapes
          const eRadius = (eraserWidth / 2) / 800; // Normalized approximation
          const initialLen = objects.length;
          
          const filtered = objects.filter((obj) => {
            const dx = obj.position.x;
            const dy = obj.position.y;
            const obx = obj.boundingBox;
            
            const isNearBox = (
              cursor.x >= obx.minX + dx - eRadius &&
              cursor.x <= obx.maxX + dx + eRadius &&
              cursor.y >= obx.minY + dy - eRadius &&
              cursor.y <= obx.maxY + dy + eRadius
            );
            return !isNearBox;
          });

          if (filtered.length !== initialLen) {
            saveStateToHistory(filtered);
            setObjects(filtered);
            setSelectedObjectId(null);
          }
        }
      } 
      else if (activeTool === "SELECT") {
        if (isAction && !isDragging) {
          // Raycast select object
          const clicked = objects.find((obj) => {
            const dx = obj.position.x;
            const dy = obj.position.y;
            const obx = obj.boundingBox;
            return (
              cursor.x >= obx.minX + dx &&
              cursor.x <= obx.maxX + dx &&
              cursor.y >= obx.minY + dy &&
              cursor.y <= obx.maxY + dy
            );
          });

          if (clicked) {
            setSelectedObjectId(clicked.id);
            setIsDragging(true);
            dragStartRef.current = { x: cursor.x, y: cursor.y };
            initialObjPosRef.current = { x: clicked.position.x, y: clicked.position.y };
          } else {
            setSelectedObjectId(null);
          }
        } 
        else if (isAction && isDragging && selectedObjectId) {
          // Drag object displacement
          const ds = dragStartRef.current;
          const initPos = initialObjPosRef.current;
          if (ds && initPos) {
            const dx = cursor.x - ds.x;
            const dy = cursor.y - ds.y;

            setObjects((prev) =>
              prev.map((obj) =>
                obj.id === selectedObjectId
                  ? { ...obj, position: { x: initPos.x + dx, y: initPos.y + dy } }
                  : obj
              )
            );
          }
        } 
        else if (!isAction && isDragging) {
          if (selectedObjectId) {
            saveStateToHistory(objects);
          }
          setIsDragging(false);
          dragStartRef.current = null;
          initialObjPosRef.current = null;
        }
      }
      
      lastStateRef.current = wsState;
    } else {
      missingFramesRef.current += 1;
      if (missingFramesRef.current >= 6) {
        if (currentStrokeRef.current.length >= 2) {
          const strokePts = [...currentStrokeRef.current];
          currentStrokeRef.current = [];
          const xs = strokePts.map((p) => p.x);
          const ys = strokePts.map((p) => p.y);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);

          const newStroke: CanvasObject = {
            id: `stroke-${Date.now()}`,
            type: "STROKE",
            points: strokePts,
            position: { x: 0, y: 0 },
            boundingBox: { minX, minY, maxX, maxY },
            color: brushColor,
            width: brushWidth,
            opacity: brushOpacity
          };

          const updatedObjects = [...objects, newStroke];
          saveStateToHistory(updatedObjects);
          setObjects(updatedObjects);
          setLastDrawnStrokeId(newStroke.id);
          setPendingConversion(null);
        } else {
          currentStrokeRef.current = [];
        }
        smoothedCursorRef.current = null;
        isActionActiveRef.current = false;
      }
    }

    drawCanvas();
  }, [hands, cameraStatus, lastGesture, activeTool, objects, brushColor, brushWidth, brushOpacity, eraserWidth, isDragging, selectedObjectId, wsConnected, drawCanvas]);

  // REST API functions
  const handleRecognizeShape = async () => {
    if (!lastDrawnStrokeId) return;

    const stroke = objects.find((obj) => obj.id === lastDrawnStrokeId);
    if (!stroke || stroke.type !== "STROKE") return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/canvas/recognize-shape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          points: stroke.points.map((p) => ({
            x: p.x,
            y: p.y,
            timestamp: p.t || 0
          }))
        })
      });

      if (!response.ok) throw new Error("Failed to recognize shape");
      const result = await response.json();

      if (result.shape === "UNKNOWN") {
        alert("Shape could not be confidently classified. Try drawing a cleaner Line, Circle, Rectangle, Triangle, or Arrow.");
        return;
      }

      // Compile perfect geometric representation object
      const cleanShape: CanvasObject = {
        id: `shape-${Date.now()}`,
        type: result.shape,
        points: [...stroke.points],
        position: { x: 0, y: 0 },
        boundingBox: { ...result.boundingBox },
        color: stroke.color,
        width: stroke.width,
        opacity: stroke.opacity
      };

      setPendingConversion({
        originalStroke: stroke,
        recognizedShape: cleanShape,
        confidence: result.confidence
      });
    } catch (e) {
      console.error(e);
      alert("Error calling shape recognition service. Check backend connection.");
    }
  };

  const handleConvertShape = () => {
    if (!pendingConversion) return;
    const { originalStroke, recognizedShape } = pendingConversion;

    // Swap original rough stroke with perfect shape vector object
    const updated = objects.map((obj) =>
      obj.id === originalStroke.id ? recognizedShape : obj
    );
    saveStateToHistory(updated);
    setObjects(updated);
    setPendingConversion(null);
    setLastDrawnStrokeId(recognizedShape.id);
  };

  const handleSave = async () => {
    if (objects.length === 0) {
      alert("Canvas is empty. Draw strokes or shapes before saving.");
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/canvas/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          db_session_id: dbSessionId || 0,
          name: "AIR Canvas Drawing",
          data: objects
        })
      });

      if (response.ok) {
        alert("Canvas layers successfully saved to database!");
      } else {
        alert("Failed to save drawing layers: Server returned error.");
      }
    } catch (e) {
      console.error(e);
      alert("BACKEND OFFLINE: Could not connect to canvas save API.");
    }
  };

  const handleLoad = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/canvas/load/${dbSessionId || 0}`);
      if (!response.ok) {
        alert("Failed to load canvas: Server error.");
        return;
      }
      const result = await response.json();
      
      if (result.status === "success" && result.data && result.data.length > 0) {
        saveStateToHistory(result.data);
        setObjects(result.data);
        alert("Canvas layers successfully loaded!");
      } else {
        alert("No drawing layers found for this session.");
      }
    } catch (e) {
      console.error(e);
      alert("BACKEND OFFLINE: Could not connect to canvas load API.");
    }
  };

  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = "airspace_canvas_export.png";
    link.click();
  };

  const handleExportSVG = () => {
    const svgStr = exportToSVG(objects);
    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "airspace_canvas_export.svg";
    link.click();
  };

  // Node-link Diagram interpretation parser (軽度 Node Connection node)
  const getInterpretedDiagram = () => {
    const nodes = objects.filter((obj) => ["RECTANGLE", "CIRCLE", "TRIANGLE"].includes(obj.type));
    const connections = objects.filter((obj) => obj.type === "ARROW");

    const flow: string[] = [];

    // Simple heuristic: sequence objects by createdAt timestamp
    const allDiagramObjs = [...nodes, ...connections].sort((a, b) => 
      a.id.localeCompare(b.id)
    );

    allDiagramObjs.forEach((obj) => {
      if (obj.type === "ARROW") {
        flow.push(` ---> [Arrow] ---> `);
      } else {
        flow.push(`[${obj.type} Node: ${obj.id.slice(-4)}]`);
      }
    });

    return flow.join("") || "No diagram structure traced yet. Draw Rectangle -> Arrow -> Circle.";
  };

  const selectedObj = objects.find((obj) => obj.id === selectedObjectId);

  return (
    <div className="flex-1 flex flex-col bg-[#0b0f19] text-[#f3f4f6] min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#0f172a] px-6 py-4 flex justify-between items-center z-30">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-white transition">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-md font-bold tracking-wider text-white">AIR CANVAS</h1>
            <p className="text-[10px] text-gray-400 font-mono">Intelligent Vector-Based Spatial Sketchboard</p>
          </div>
        </div>

        {/* Persistence triggers */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleLoad}
            className="px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 text-xs font-semibold text-gray-300 transition flex items-center gap-1.5"
          >
            Load Canvas
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 rounded-lg bg-blue-950/60 hover:bg-blue-900 border border-blue-800/30 text-xs font-semibold text-blue-400 hover:text-blue-300 transition flex items-center gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            Save Canvas
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
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

        {/* Center Column: Spatial Canvas area (ColSpan: 5) */}
        <div className="lg:col-span-5 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">Interactive Canvas</h2>
            
            {/* Undo/Redo tools */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleUndo}
                disabled={history.length === 0}
                className="p-1.5 rounded bg-gray-900 border border-gray-800 text-gray-400 hover:text-white disabled:opacity-50 transition"
                aria-label="Undo Stroke"
              >
                <Undo2 className="h-4 w-4" />
              </button>
              <button
                onClick={handleRedo}
                disabled={redoList.length === 0}
                className="p-1.5 rounded bg-gray-900 border border-gray-800 text-gray-400 hover:text-white disabled:opacity-50 transition"
                aria-label="Redo Stroke"
              >
                <Redo2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div ref={containerRef} className="relative w-full h-[450px] md:h-[500px] rounded-xl bg-[#0f172a] border border-gray-800 overflow-hidden shadow-2xl flex flex-col">
            <canvas ref={canvasRef} className="flex-1 w-full h-full cursor-none z-10" />

            {/* Quick action buttons */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20 pointer-events-none">
              <div className="px-3 py-1.5 rounded-lg bg-gray-900/90 border border-gray-700 text-xs font-semibold text-gray-300 flex items-center gap-2">
                <Edit2 className="h-3.5 w-3.5 text-blue-500" />
                Air Ink
              </div>
              <button
                onClick={() => {
                  setObjects([]);
                  setHistory([]);
                  setRedoList([]);
                  setSelectedObjectId(null);
                  setPendingConversion(null);
                }}
                className="p-2.5 rounded-lg bg-gray-900 hover:bg-red-950 border border-gray-700 hover:border-red-950 text-gray-400 hover:text-red-400 transition pointer-events-auto shadow-lg"
                aria-label="Clear Canvas content"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Export commands */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleExportPNG}
              className="py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-xs font-semibold text-gray-300 flex items-center justify-center gap-1.5 transition"
            >
              <Download className="h-4 w-4" />
              Export PNG
            </button>
            <button
              onClick={handleExportSVG}
              className="py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-xs font-semibold text-gray-300 flex items-center justify-center gap-1.5 transition"
            >
              <Download className="h-4 w-4" />
              Export SVG
            </button>
          </div>
        </div>

        {/* Right Column: Spatial Toolbar & Properties Inspector (ColSpan: 3) */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">Toolbar & Properties</h2>
            
            {/* 1. Spatial Toolbar selectors */}
            <div className="rounded-xl bg-[#0f172a] border border-gray-800 p-5 shadow-xl flex flex-col gap-4">
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => {
                    setActiveTool("PEN");
                    setSelectedObjectId(null);
                  }}
                  className={`p-2.5 rounded-lg flex flex-col items-center justify-center gap-1 text-[10px] font-bold border transition ${
                    activeTool === "PEN"
                      ? "bg-blue-600/90 border-blue-500 text-white"
                      : "bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700"
                  }`}
                  aria-label="Select Pen Tool"
                >
                  <Edit2 className="h-4 w-4" />
                  Pen
                </button>
                <button
                  onClick={() => {
                    setActiveTool("ERASER");
                    setSelectedObjectId(null);
                  }}
                  className={`p-2.5 rounded-lg flex flex-col items-center justify-center gap-1 text-[10px] font-bold border transition ${
                    activeTool === "ERASER"
                      ? "bg-red-600/90 border-red-500 text-white"
                      : "bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700"
                  }`}
                  aria-label="Select Eraser Tool"
                >
                  <Eraser className="h-4 w-4" />
                  Erase
                </button>
                <button
                  onClick={() => setActiveTool("SELECT")}
                  className={`p-2.5 rounded-lg flex flex-col items-center justify-center gap-1 text-[10px] font-bold border transition ${
                    activeTool === "SELECT"
                      ? "bg-emerald-600/90 border-emerald-500 text-white"
                      : "bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700"
                  }`}
                  aria-label="Select Selection Tool"
                >
                  <MousePointer className="h-4 w-4" />
                  Select
                </button>
                <button
                  onClick={() => {
                    setActiveTool("PAN");
                    setSelectedObjectId(null);
                  }}
                  className={`p-2.5 rounded-lg flex flex-col items-center justify-center gap-1 text-[10px] font-bold border transition ${
                    activeTool === "PAN"
                      ? "bg-amber-600/90 border-amber-500 text-white"
                      : "bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700"
                  }`}
                  aria-label="Select Pan Tool"
                >
                  <Move className="h-4 w-4" />
                  Pan
                </button>
              </div>

              {/* Adjust properties sliders based on active tool */}
              {activeTool === "PEN" && (
                <div className="flex flex-col gap-3 pt-2 border-t border-gray-800/80 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-mono uppercase text-[10px]">Brush Size:</span>
                    <span className="font-bold font-mono">{brushWidth}px</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={brushWidth}
                    onChange={(e) => setBrushWidth(Number(e.target.value))}
                    className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    aria-label="Adjust Brush Width"
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-mono uppercase text-[10px]">Color:</span>
                    <input
                      type="color"
                      value={brushColor}
                      onChange={(e) => setBrushColor(e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer border border-gray-800 bg-transparent"
                      aria-label="Adjust Brush Color"
                    />
                  </div>
                </div>
              )}

              {activeTool === "ERASER" && (
                <div className="flex flex-col gap-3 pt-2 border-t border-gray-800/80 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-mono uppercase text-[10px]">Eraser size:</span>
                    <span className="font-bold font-mono">{eraserWidth}px</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="80"
                    value={eraserWidth}
                    onChange={(e) => setEraserWidth(Number(e.target.value))}
                    className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                    aria-label="Adjust Eraser Width"
                  />
                </div>
              )}
            </div>
          </div>

          {/* 2. Shape Conversion & Object properties Inspector */}
          <div className="flex-1 flex flex-col gap-6">
            
            {/* Shape recognition conversion card */}
            {lastDrawnStrokeId && activeTool === "PEN" && (
              <div className="rounded-xl bg-[#0f172a] border border-gray-800 p-5 shadow-xl flex flex-col gap-3 text-xs">
                <h3 className="font-bold text-gray-400 uppercase font-mono text-[10px] tracking-wider pb-1.5 border-b border-gray-800">
                  SHAPE RECOGNITION ASSIST
                </h3>
                {!pendingConversion ? (
                  <button
                    onClick={handleRecognizeShape}
                    className="w-full py-2 rounded-lg bg-gray-900 hover:bg-gray-850 border border-gray-700 text-xs font-semibold text-gray-300 flex items-center justify-center gap-1.5 transition"
                  >
                    <Shapes className="h-4 w-4 text-blue-400" />
                    Detect Shape
                  </button>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center font-mono text-[10px]">
                      <span className="text-gray-500">Detected:</span>
                      <span className="text-green-400 font-bold">{pendingConversion.recognizedShape.type} ({(pendingConversion.confidence * 100).toFixed(0)}%)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleConvertShape}
                        className="py-1.5 rounded bg-green-950 hover:bg-green-900 border border-green-800 text-[10px] font-semibold text-green-400 transition"
                      >
                        Convert
                      </button>
                      <button
                        onClick={() => setPendingConversion(null)}
                        className="py-1.5 rounded bg-red-950/40 hover:bg-red-900/40 border border-red-900/30 text-[10px] font-semibold text-red-400 transition"
                      >
                        Keep Rough
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Object Inspector */}
            <div className="rounded-xl bg-[#0f172a] border border-gray-800 p-5 shadow-xl flex flex-col gap-3 text-xs min-h-[160px]">
              <h3 className="font-bold text-gray-400 uppercase font-mono text-[10px] tracking-wider pb-1.5 border-b border-gray-800">
                OBJECT INSPECTOR
              </h3>
              {!selectedObj ? (
                <div className="text-gray-500 italic py-4 text-center">
                  Hover & Pinch click an object in SELECT mode...
                </div>
              ) : (
                <div className="space-y-2 font-mono text-[10px] text-gray-400">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className="text-white font-bold">{selectedObj.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pos X/Y:</span>
                    <span>{selectedObj.position.x.toFixed(2)}, {selectedObj.position.y.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Points:</span>
                    <span>{selectedObj.points.length} pts</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Color:</span>
                    <span style={{ color: selectedObj.color }} className="font-bold">{selectedObj.color}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Size (W x H):</span>
                    <span>
                      {((selectedObj.boundingBox.maxX - selectedObj.boundingBox.minX) * 100).toFixed(0)} x {((selectedObj.boundingBox.maxY - selectedObj.boundingBox.minY) * 100).toFixed(0)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Diagram Interpretation panel */}
            <div className="rounded-xl bg-[#0f172a] border border-gray-800 p-5 shadow-xl flex flex-col gap-3 text-xs">
              <h3 className="font-bold text-gray-400 uppercase font-mono text-[10px] tracking-wider pb-1.5 border-b border-gray-800">
                DIAGRAM RELATIONSHIPS FEED
              </h3>
              <div className="p-3 rounded bg-gray-950/60 border border-gray-900 font-mono text-[9px] text-gray-400 whitespace-pre-wrap leading-relaxed">
                {getInterpretedDiagram()}
              </div>
            </div>

          </div>
        </div>

      </main>
    </div>
  );
}
export type CanvasPageType = typeof CanvasPage;
