import React from "react";
import { Activity, Database, Key, Send, Wifi, WifiOff } from "lucide-react";

interface PerformanceHUDProps {
  handDetected: boolean;
  gesture: string;
  confidence: number | string;
  fps: number;
  latency: number;
  wsStatus: "CONNECTED" | "DISCONNECTED";
  sessionId: string | null;
  dbSessionId: number | null;
}

export function PerformanceHUD({
  handDetected,
  gesture,
  confidence,
  fps,
  latency,
  wsStatus,
  sessionId,
  dbSessionId,
}: PerformanceHUDProps) {
  const isConnected = wsStatus === "CONNECTED";

  // Formats confidence scores as percentages
  const formattedConfidence = 
    typeof confidence === "number" 
      ? `${(confidence * 100).toFixed(0)}%` 
      : confidence;

  return (
    <div className="w-full rounded-xl bg-[#0f172a] border border-gray-800 p-5 shadow-2xl flex flex-col gap-4">
      {/* 1. Card Header */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-500" />
          DIAGNOSTIC HUD
        </h3>
        <div className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1.5 ${
          isConnected 
            ? "bg-green-950/50 text-green-400 border border-green-900/30" 
            : "bg-red-950/50 text-red-400 border border-red-900/30"
        }`}>
          {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {wsStatus}
        </div>
      </div>

      {/* 2. Grid metrics rows */}
      <div className="grid grid-cols-2 gap-4 text-xs font-mono">
        {/* Hand status */}
        <div className="p-3 rounded-lg bg-gray-900/60 border border-gray-800/40">
          <div className="text-gray-500 mb-1">HAND TRACKING</div>
          <div className={`text-sm font-bold ${handDetected ? "text-green-400" : "text-gray-500"}`}>
            {handDetected ? "DETECTED" : "NOT DETECTED"}
          </div>
        </div>

        {/* Gesture state */}
        <div className="p-3 rounded-lg bg-gray-900/60 border border-gray-800/40">
          <div className="text-gray-500 mb-1">ACTIVE GESTURE</div>
          <div className="text-sm font-bold text-blue-400">
            {handDetected && gesture ? gesture : "--"}
          </div>
        </div>

        {/* Processing FPS */}
        <div className="p-3 rounded-lg bg-gray-900/60 border border-gray-800/40">
          <div className="text-gray-500 mb-1">PROCESS SPEED</div>
          <div className="text-sm font-bold text-gray-300">
            {fps > 0 ? `${fps} FPS` : "--"}
          </div>
        </div>

        {/* Processing Latency */}
        <div className="p-3 rounded-lg bg-gray-900/60 border border-gray-800/40">
          <div className="text-gray-500 mb-1">LATENCY</div>
          <div className="text-sm font-bold text-gray-300">
            {latency > 0 ? `${latency} ms` : "--"}
          </div>
        </div>

        {/* Gesture Confidence */}
        <div className="p-3 rounded-lg bg-gray-900/60 border border-gray-800/40">
          <div className="text-gray-500 mb-1">CONFIDENCE</div>
          <div className="text-sm font-bold text-gray-300">
            {handDetected ? formattedConfidence : "--"}
          </div>
        </div>

        {/* DB Session ID */}
        <div className="p-3 rounded-lg bg-gray-900/60 border border-gray-800/40">
          <div className="text-gray-500 mb-1">DATABASE ID</div>
          <div className="text-sm font-bold text-gray-300 flex items-center gap-1">
            <Database className="h-3.5 w-3.5 text-gray-500" />
            {isConnected && dbSessionId !== null ? dbSessionId : "--"}
          </div>
        </div>
      </div>

      {/* 3. Session info footer */}
      {isConnected && sessionId && (
        <div className="mt-1 pt-3 border-t border-gray-800/60 text-[10px] text-gray-500 font-mono flex flex-col gap-1">
          <div className="flex items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap">
            <Key className="h-3 w-3 shrink-0 text-gray-600" />
            <span>UUID: {sessionId}</span>
          </div>
        </div>
      )}
    </div>
  );
}
export type PerformanceHUDPropsType = PerformanceHUDProps;
