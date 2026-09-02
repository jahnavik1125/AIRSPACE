import React, { useEffect, useRef, useState, useCallback } from "react";
import { Trash2, Edit } from "lucide-react";
import { DrawingStroke, DrawingPoint } from "../../types/spatial";

interface SpatialCanvasProps {
  lastGesture: {
    gesture: string;
    coordinates: { x: number; y: number };
    state: string;
  } | null;
  connected: boolean;
}

export function SpatialCanvas({ lastGesture, connected }: SpatialCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [brushColor, setBrushColor] = useState("#3b82f6");
  const [brushWidth, setBrushWidth] = useState(4);
  
  // High-frequency refs to prevent React state trigger lag
  const activeStrokeRef = useRef<DrawingStroke | null>(null);
  const smoothedCursorRef = useRef<{ x: number; y: number } | null>(null);

  // Exponential moving average smoothing factor
  const EMA_BETA = 0.40;

  // Clear canvas
  const handleClear = useCallback(() => {
    setStrokes([]);
    activeStrokeRef.current = null;
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, []);

  // Sync canvas size with high-DPI support
  const resizeCanvas = useCallback(() => {
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
      // Trigger redraw
      drawAll(ctx, rect.width, rect.height);
    }
  }, [strokes]);

  // Draw helper
  const drawAll = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.clearRect(0, 0, width, height);

    // 1. Draw static grid patterns for modern engineering UI theme
    ctx.strokeStyle = "rgba(75, 85, 99, 0.08)";
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 2. Draw all completed strokes
    strokes.forEach((stroke) => {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.moveTo(stroke.points[0].x * width, stroke.points[0].y * height);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x * width, stroke.points[i].y * height);
      }
      ctx.stroke();
    });

    // 3. Draw active stroke in progress
    const active = activeStrokeRef.current;
    if (active && active.points.length >= 2) {
      ctx.beginPath();
      ctx.strokeStyle = active.color;
      ctx.lineWidth = active.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.moveTo(active.points[0].x * width, active.points[0].y * height);
      for (let i = 1; i < active.points.length; i++) {
        ctx.lineTo(active.points[i].x * width, active.points[i].y * height);
      }
      ctx.stroke();
    }

    // 4. Draw pointer/cursor details (if last gesture coordinate is active)
    const cursor = smoothedCursorRef.current;
    if (cursor && connected) {
      const cx = cursor.x * width;
      const cy = cursor.y * height;
      const state = lastGesture?.state || "HOVER";

      // Select pointer color based on state boundaries
      let pointerColor = "#3b82f6"; // Blue hover
      let pointerRadius = 6;
      
      if (state === "PINCH_START") {
        pointerColor = "#eab308"; // Yellow click
        pointerRadius = 8;
      } else if (state === "PINCH_HOLD" || state === "DRAG") {
        pointerColor = "#22c55e"; // Green draw
        pointerRadius = 8;
      }

      // Outer ripple glow
      ctx.beginPath();
      ctx.arc(cx, cy, pointerRadius + 6, 0, 2 * Math.PI);
      ctx.strokeStyle = `${pointerColor}33`; // alpha 20%
      ctx.lineWidth = 2;
      ctx.stroke();

      // Inner solid point
      ctx.beginPath();
      ctx.arc(cx, cy, pointerRadius, 0, 2 * Math.PI);
      ctx.fillStyle = pointerColor;
      ctx.fill();

      // Mirror-friendly pointer HUD indicator text
      ctx.font = "10px monospace";
      ctx.fillStyle = "#9ca3af";
      ctx.fillText(
        `X: ${cursor.x.toFixed(2)} Y: ${cursor.y.toFixed(2)}`,
        cx + 12,
        cy - 4
      );
    }
  };

  // Listen to container resizing
  useEffect(() => {
    resizeCanvas();
    const observer = new ResizeObserver(() => resizeCanvas());
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, [resizeCanvas]);

  // Redraw loops driven by gesture stream updates
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !connected) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);

    if (lastGesture) {
      const rawX = lastGesture.coordinates.x;
      const rawY = lastGesture.coordinates.y;
      const state = lastGesture.state;

      // 1. Mirror coordinates horizontally: x = 1.0 - x
      // MediaPipe tracks raw coordinates, but since video mirrors, canvas coordinates must flip
      const mirroredX = 1.0 - rawX;

      // 2. Exponential Moving Average pointer smoothing
      if (!smoothedCursorRef.current) {
        smoothedCursorRef.current = { x: mirroredX, y: rawY };
      } else {
        smoothedCursorRef.current = {
          x: EMA_BETA * mirroredX + (1 - EMA_BETA) * smoothedCursorRef.current.x,
          y: EMA_BETA * rawY + (1 - EMA_BETA) * smoothedCursorRef.current.y
        };
      }

      const smoothed = smoothedCursorRef.current;
      const newPoint: DrawingPoint = {
        x: smoothed.x,
        y: smoothed.y,
        t: Date.now()
      };

      // 3. Drive canvas state transitions
      const isPointing = lastGesture.gesture === "INDEX_POINT" || state === "POINT_START" || state === "POINT_HOLD";
      const isPinch = state === "PINCH_START" || state === "PINCH_HOLD" || state === "DRAG";
      const isDrawing = isPointing || isPinch;

      if (state === "PINCH_START" || (isPointing && !activeStrokeRef.current)) {
        activeStrokeRef.current = {
          id: `stroke-${Date.now()}`,
          points: [newPoint],
          color: brushColor,
          width: brushWidth
        };
      } else if ((state === "PINCH_HOLD" || state === "DRAG" || isPointing) && activeStrokeRef.current) {
        activeStrokeRef.current.points.push(newPoint);
      } else if ((state === "PINCH_END" || state === "POINT_END" || (!isDrawing && activeStrokeRef.current)) && activeStrokeRef.current) {
        // Complete the stroke
        setStrokes((prev) => [...prev, activeStrokeRef.current!]);
        activeStrokeRef.current = null;
      }
    } else {
      smoothedCursorRef.current = null;
      activeStrokeRef.current = null;
    }

    drawAll(ctx, width, height);
  }, [lastGesture, connected, brushColor, brushWidth]);

  return (
    <div ref={containerRef} className="relative w-full h-[500px] md:h-[600px] rounded-xl bg-[#0f172a] border border-gray-800 overflow-hidden shadow-2xl flex flex-col">
      {/* 1. Draw Canvas */}
      <canvas ref={canvasRef} className="flex-1 w-full h-full cursor-none z-10" />

      {/* 2. Top bar HUD controls overlay */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20 pointer-events-none">
        <div className="px-3 py-1.5 rounded-lg bg-gray-900/90 border border-gray-700 text-xs font-semibold text-gray-300 flex items-center gap-2">
          <Edit className="h-3.5 w-3.5 text-blue-500" />
          AIR CANVAS
        </div>
        
        {/* Colors and brush configurations */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {["#3b82f6", "#22c55e", "#ef4444", "#eab308", "#ec4899", "#ffffff"].map((color) => (
            <button
              key={color}
              onClick={() => setBrushColor(color)}
              className={`h-5 w-5 rounded-full border transition-all ${
                brushColor === color ? "scale-125 border-white" : "border-gray-700 hover:scale-110"
              }`}
              style={{ backgroundColor: color }}
              aria-label={`Select Brush Color ${color}`}
            />
          ))}
          <div className="w-px h-5 bg-gray-700 mx-1" />
          <button
            onClick={handleClear}
            className="p-2 rounded-lg bg-gray-900 hover:bg-red-950 border border-gray-700 hover:border-red-950 text-gray-400 hover:text-red-400 transition focus:ring-2 focus:ring-red-400 focus:outline-none"
            aria-label="Clear Canvas Drawings"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 3. Disconnected workspace fallback overlay */}
      {!connected && (
        <div className="absolute inset-0 bg-[#0b0f19]/70 flex flex-col items-center justify-center p-6 text-center z-15 backdrop-blur-[1px]">
          <h3 className="text-md font-semibold text-gray-400 mb-1">Canvas Offline</h3>
          <p className="text-xs text-gray-500 max-w-xs">
            Connect backend WebSockets to enable touchless drawing capabilities.
          </p>
        </div>
      )}
    </div>
  );
}
