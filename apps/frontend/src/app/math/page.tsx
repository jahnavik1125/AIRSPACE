"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { Camera, Trash2, ArrowLeft, Save, Undo2, Play, LineChart, Copy } from "lucide-react";
import Link from "next/link";

import { useCamera } from "../../hooks/useCamera";
import { useHandTracking } from "../../hooks/useHandTracking";
import { useSpatialWebSocket } from "../../hooks/useSpatialWebSocket";
import { CameraFeed } from "../../components/camera/CameraFeed";
import { CameraOverlay } from "../../components/camera/CameraOverlay";
import { PerformanceHUD } from "../../components/status/PerformanceHUD";
import { classifyHandGesture } from "../../utils/gestureClassifier";

interface MathResult {
  expression: string;
  latex: string;
  confidence: number;
  is_ambiguous: boolean;
  solution: {
    status: string;
    operation: string;
    result: string | string[];
    latex_result: string;
    steps?: string[];
  };
}

export default function MathWorkspacePage() {
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

  // Trajectory capture state
  const [strokes, setStrokes] = useState<any[][]>([]);
  const [history, setHistory] = useState<any[][][]>([]);
  
  // Math outputs
  const [mathResult, setMathResult] = useState<MathResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualEquation, setManualEquation] = useState("");
  const [isEditingEquation, setIsEditingEquation] = useState(false);
  
  // Interactive graphing properties
  const [graphEquation, setGraphEquation] = useState<string | null>(null);
  const [graphScale, setGraphScale] = useState(25); // Pixels per unit
  const [graphOffset, setGraphOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);

  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const currentStrokeRef = useRef<{ x: number; y: number; t: number }[]>([]);
  const smoothedCursorRef = useRef<{ x: number; y: number } | null>(null);
  const lastStateRef = useRef<string>("HOVER");
  const foldedFramesRef = useRef<number>(0);
  const missingFramesRef = useRef<number>(0);
  const isActionActiveRef = useRef<boolean>(false);

  const EMA_BETA = 0.40;

  // Stream coordinates
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

  // History buffer state updates
  const saveStateToHistory = (newStrokes: any[][]) => {
    setHistory((prev) => [...prev, newStrokes]);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setStrokes(previous);
    setHistory((prev) => prev.slice(0, -1));
    currentStrokeRef.current = [];
  };

  const handleClear = () => {
    setStrokes([]);
    setHistory([]);
    currentStrokeRef.current = [];
    setMathResult(null);
    setGraphEquation(null);
  };

  // High performance Canvas redrawing loop
  const drawMathCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, width, height);

    // Grid aesthetic background
    ctx.strokeStyle = "rgba(75, 85, 99, 0.08)";
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

    // Render completed strokes
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#818cf8"; // Indigo color
    strokes.forEach((stroke) => {
      if (stroke.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x * width, stroke[0].y * height);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x * width, stroke[i].y * height);
      }
      ctx.stroke();
    });

    // Render active drawing stroke
    const current = currentStrokeRef.current;
    if (current.length >= 2) {
      ctx.beginPath();
      ctx.strokeStyle = "#a78bfa";
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
      const isDrawing = isActionActiveRef.current || lastGesture?.state === "PINCH_HOLD";
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
      ctx.fillStyle = isDrawing ? "#10b981" : "#818cf8";
      ctx.fill();

      if (isDrawing) {
        ctx.beginPath();
        ctx.arc(cx, cy, 12, 0, 2 * Math.PI);
        ctx.strokeStyle = "rgba(16, 185, 129, 0.4)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }, [strokes, cameraStatus, lastGesture]);

  // Spatial drawing interactions loops
  useEffect(() => {
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

      const cursor = smoothedCursorRef.current;

      if (gesture === "OPEN_PALM") {
        isActionActiveRef.current = false;
        currentStrokeRef.current = [];
        drawMathCanvas();
        return;
      }

      const isIndexPoint = gesture === "INDEX_POINT";
      const isPinch = gesture === "PINCH" || wsState === "PINCH_START" || wsState === "PINCH_HOLD" || wsState === "DRAG";
      const isAction = isIndexPoint || isPinch;
      isActionActiveRef.current = isAction;

      if (isAction) {
        foldedFramesRef.current = 0;
        currentStrokeRef.current.push({ x: cursor.x, y: cursor.y, t: Date.now() });
      } else {
        foldedFramesRef.current += 1;
        if (foldedFramesRef.current >= 5 && currentStrokeRef.current.length > 0) {
          const strokePts = [...currentStrokeRef.current];
          currentStrokeRef.current = [];

          if (strokePts.length >= 2) {
            saveStateToHistory(strokes);
            setStrokes((prev) => [...prev, strokePts]);
          }
        }
      }

      lastStateRef.current = wsState;
    } else {
      missingFramesRef.current += 1;
      if (missingFramesRef.current >= 6) {
        if (currentStrokeRef.current.length >= 2) {
          const strokePts = [...currentStrokeRef.current];
          currentStrokeRef.current = [];
          saveStateToHistory(strokes);
          setStrokes((prev) => [...prev, strokePts]);
        } else {
          currentStrokeRef.current = [];
        }
        smoothedCursorRef.current = null;
        isActionActiveRef.current = false;
      }
    }

    drawMathCanvas();
  }, [hands, cameraStatus, lastGesture, strokes, wsConnected, drawMathCanvas]);

  // Math solvers API call
  const handleSolve = async () => {
    if (strokes.length === 0) {
      alert("No strokes detected. Draw a mathematical equation first.");
      return;
    }

    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/math/solve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          db_session_id: dbSessionId || 0,
          strokes: strokes
        })
      });

      if (!response.ok) throw new Error("Solve API failure");
      const result = await response.json();
      setMathResult(result);
      
      // Auto-trigger graphing if equation is detected
      if (result.expression) {
        setGraphEquation(result.expression);
        setManualEquation(result.expression);
      }
    } catch (e) {
      console.error(e);
      alert("BACKEND OFFLINE: Error calling algebraic math engine solvers.");
    } finally {
      setLoading(false);
    }
  };

  const handleSolveManual = async () => {
    if (!manualEquation.trim()) return;
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/math/solve-expression`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          db_session_id: dbSessionId || 0,
          expression: manualEquation.trim()
        })
      });

      if (!response.ok) throw new Error("Solve API failure");
      const result = await response.json();
      setMathResult(result);
      setIsEditingEquation(false);
      if (result.expression) {
        setGraphEquation(result.expression);
      }
    } catch (e) {
      console.error(e);
      alert("Error solving equation. Please verify expression syntax.");
    } finally {
      setLoading(false);
    }
  };

  // Math functions evaluator parser
  const evaluateGraphY = (eqStr: string, xVal: number): number => {
    // E.g. y = x**2 or simple functions. Parse RHS
    try {
      let rhs = eqStr;
      if (eqStr.includes("=")) {
        const parts = eqStr.split("=");
        // If LHS is y, take RHS
        if (parts[0].trim() === "y") {
          rhs = parts[1].trim();
        } else {
          // If 2*x + 5 = 15, LHS - RHS = 2*x - 10. Solve for y=0 baseline:
          rhs = parts[0].trim() + " - (" + parts[1].trim() + ")";
        }
      }

      // Convert python mathematical terms to JS Math
      let jsExpr = rhs
        .replace(/\*\*/g, "^")
        .replace(/x/g, xVal.toString())
        .replace(/\^/g, "**"); // Javascript exponentiation operator

      // Evaluate safely
      return Function(`"use strict"; return (${jsExpr})`)();
    } catch (e) {
      return NaN;
    }
  };

  // Graph rendering canvas
  const drawGraph = useCallback(() => {
    const canvas = graphCanvasRef.current;
    if (!canvas || !graphEquation) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Compute coordinate axes centers
    const originX = w / 2 + graphOffset.x;
    const originY = h / 2 + graphOffset.y;

    // Draw Grid Lines
    ctx.strokeStyle = "rgba(75, 85, 99, 0.20)";
    ctx.lineWidth = 1;
    ctx.font = "8px monospace";
    ctx.fillStyle = "#6b7280";

    const step = graphScale;
    
    // Vertical grid
    for (let x = originX % step; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();

      // Draw axis value label
      const val = ((x - originX) / step).toFixed(0);
      if (val !== "0") ctx.fillText(val, x - 4, originY + 12);
    }

    // Horizontal grid
    for (let y = originY % step; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();

      // Draw label
      const val = (-(y - originY) / step).toFixed(0);
      if (val !== "0") ctx.fillText(val, originX + 8, y + 4);
    }

    // Draw Main X/Y Axes Lines
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 1.5;
    
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(w, originY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, h);
    ctx.stroke();

    // Draw function curve
    ctx.beginPath();
    ctx.strokeStyle = "#8b5cf6"; // Violet neon line curve
    ctx.lineWidth = 2.5;

    let started = false;

    for (let px = 0; px < w; px++) {
      // Convert screen px coordinates to graph unit space
      const xVal = (px - originX) / step;
      const yVal = evaluateGraphY(graphEquation, xVal);

      if (isNaN(yVal) || !isFinite(yVal)) {
        started = false;
        continue;
      }

      // Convert graph units to screen px space
      const py = originY - yVal * step;

      if (!started) {
        ctx.moveTo(px, py);
        started = true;
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
  }, [graphEquation, graphScale, graphOffset]);

  useEffect(() => {
    drawGraph();
  }, [drawGraph, graphEquation, graphScale, graphOffset]);

  // Graph drag events
  const handleGraphMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    panStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleGraphMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || !panStartRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setGraphOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    panStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleGraphMouseUp = () => {
    setIsPanning(false);
    panStartRef.current = null;
  };

  const handleZoom = (factor: number) => {
    setGraphScale((prev) => Math.max(10, Math.min(100, prev * factor)));
  };

  // Resize resize
  useEffect(() => {
    const handleResize = () => {
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
        drawMathCanvas();
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [drawMathCanvas]);

  return (
    <div className="flex-1 flex flex-col bg-[#0b0f19] text-[#f3f4f6] min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#0f172a] px-6 py-4 flex justify-between items-center z-30">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-white transition">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-md font-bold tracking-wider text-white flex items-center gap-2">
              MATH MODE
              <span className="text-[10px] text-violet-400 bg-violet-950/60 border border-violet-800/40 px-2 py-0.5 rounded-full">SymPy SOLVER</span>
            </h1>
            <p className="text-[10px] text-gray-400 font-mono">Spatially Tracked Equations solver & Grapher</p>
          </div>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Live camera view (ColSpan: 4) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">Hand Input Tracking</h2>
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

        {/* Center Column: Math blackboard drawing (ColSpan: 5) */}
        <div className="lg:col-span-5 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">Equation Drawing Board</h2>
            <button
              onClick={handleUndo}
              disabled={strokes.length === 0}
              className="p-1.5 rounded bg-gray-900 border border-gray-800 text-gray-400 hover:text-white disabled:opacity-50 transition"
              aria-label="Undo Stroke"
            >
              <Undo2 className="h-4 w-4" />
            </button>
          </div>

          <div ref={containerRef} className="relative w-full h-[400px] rounded-xl bg-[#0f172a] border border-gray-800 overflow-hidden shadow-xl flex flex-col">
            <canvas ref={canvasRef} className="flex-1 w-full h-full cursor-none z-10" />

            {/* Quick clean/solve buttons */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20 pointer-events-none">
              <span className="px-3 py-1.5 rounded-lg bg-gray-900/90 border border-gray-700 text-xs font-semibold text-gray-300">
                Blackboard Space
              </span>
              <div className="flex items-center gap-2 pointer-events-auto">
                <button
                  onClick={() => {
                    setStrokes([]);
                    setHistory([]);
                    setMathResult(null);
                    setGraphEquation(null);
                  }}
                  className="p-2.5 rounded-lg bg-gray-900 hover:bg-red-950 border border-gray-700 hover:border-red-950 text-gray-400 hover:text-red-400 transition shadow-lg"
                  aria-label="Clear Canvas"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  onClick={handleSolve}
                  disabled={strokes.length === 0 || loading}
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 border border-violet-500 text-xs font-bold text-white flex items-center gap-1.5 transition shadow-lg disabled:opacity-50"
                  aria-label="Solve Equation"
                >
                  <Play className="h-3.5 w-3.5" />
                  {loading ? "Solving..." : "Solve"}
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Plotting space */}
          {graphEquation && (
            <div className="flex flex-col gap-2 pt-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-gray-400 uppercase font-mono text-[10px]">Graphing Plotter: y = f(x)</span>
                <div className="flex gap-2">
                  <button onClick={() => handleZoom(1.2)} className="px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-[10px] font-bold">+</button>
                  <button onClick={() => handleZoom(0.8)} className="px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-[10px] font-bold">-</button>
                </div>
              </div>
              <div className="relative w-full h-[220px] rounded-xl bg-[#090d16] border border-gray-800 overflow-hidden cursor-move">
                <canvas
                  ref={graphCanvasRef}
                  width={400}
                  height={220}
                  onMouseDown={handleGraphMouseDown}
                  onMouseMove={handleGraphMouseMove}
                  onMouseUp={handleGraphMouseUp}
                  onMouseLeave={handleGraphMouseUp}
                  className="w-full h-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Mathematical solutions steps (ColSpan: 3) */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">Algebraic Solutions</h2>
            
            <div className="rounded-xl bg-[#0f172a] border border-gray-800 p-5 shadow-xl flex flex-col gap-4 text-xs">
              
              {/* LaTeX & Equation display */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-mono text-[9px] uppercase">Recognized Equation:</span>
                  <button
                    onClick={() => setIsEditingEquation(!isEditingEquation)}
                    className="text-[10px] font-mono text-purple-400 hover:text-purple-300 font-semibold"
                  >
                    {isEditingEquation ? "Cancel" : "Correct / Edit"}
                  </button>
                </div>
                {isEditingEquation ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={manualEquation}
                      onChange={(e) => setManualEquation(e.target.value)}
                      placeholder="e.g. 2x + 5 = 15 or x² + 4x + 4 = 0"
                      className="flex-1 px-2.5 py-1.5 text-xs rounded bg-gray-950 border border-purple-500/60 text-white font-mono focus:outline-none"
                    />
                    <button
                      onClick={handleSolveManual}
                      className="px-3 py-1.5 text-xs font-bold rounded bg-purple-600 hover:bg-purple-500 text-white transition"
                    >
                      Solve
                    </button>
                  </div>
                ) : (
                  <div className="p-3 rounded bg-gray-950 border border-gray-900 text-center font-bold text-sm font-mono text-purple-300">
                    {mathResult?.latex ? `$$ ${mathResult.latex} $$` : "Write equation and solve..."}
                  </div>
                )}
                {mathResult?.is_ambiguous && (
                  <span className="text-[10px] text-yellow-500 font-semibold italic">
                    ⚠️ Low confidence prediction. Expression may be ambiguous. Use Correct / Edit above to adjust.
                  </span>
                )}
              </div>

              {/* Solution card */}
              <div className="flex flex-col gap-1.5">
                <span className="text-gray-500 font-mono text-[9px] uppercase">Result Roots:</span>
                <div className="p-3 rounded bg-gray-950 border border-gray-900 font-mono text-xs text-white">
                  {mathResult?.solution?.latex_result 
                    ? `x = ${mathResult.solution.latex_result}` 
                    : mathResult?.solution?.result
                      ? JSON.stringify(mathResult.solution.result)
                      : "--"}
                </div>
              </div>

              {/* Step-by-Step Solver steps */}
              <div className="flex flex-col gap-1.5">
                <span className="text-gray-500 font-mono text-[9px] uppercase">Algebra steps:</span>
                <div className="p-4 rounded bg-gray-950 border border-gray-900 font-mono text-[10px] text-gray-400 space-y-3 max-h-[300px] overflow-y-auto">
                  {mathResult?.solution?.steps ? (
                    mathResult.solution.steps.map((step, idx) => (
                      <div key={idx} className="pb-2 border-b border-gray-800/60 last:border-b-0">
                        <span className="text-purple-400 font-bold">Step {idx + 1}:</span>
                        <p className="mt-1 leading-relaxed text-white">{step}</p>
                      </div>
                    ))
                  ) : (
                    <span className="italic text-gray-600">Steps will render here...</span>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
export type MathWorkspacePageType = typeof MathWorkspacePage;
