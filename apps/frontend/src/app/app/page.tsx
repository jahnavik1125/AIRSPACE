"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSystemStatus } from "../../context/SystemStatusContext";
import {
  PenTool,
  Palette,
  Calculator,
  BrainCircuit,
  BarChart3,
  CheckCircle,
  AlertTriangle,
  Play,
  Zap,
  Activity,
  UserCheck,
  Sparkles,
  MoveRight
} from "lucide-react";

interface OverviewStats {
  total_sessions: number;
  total_events: number;
  avg_duration: number;
  avg_confidence: number;
  avg_fps: number;
  avg_latency: number;
  most_used_gesture: string;
  module_usage: {
    canvas_saves: number;
    math_solves: number;
  };
}

export default function AppDashboardPage() {
  const { status } = useSystemStatus();
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const resp = await fetch(`${apiUrl}/api/analytics/overview?days=30`);
        if (resp.ok) {
          const data = await resp.json();
          setStats(data.overview);
        }
      } catch (e) {
        console.error("Dashboard stats load failure:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="flex-1 bg-[#05070c] text-white min-h-screen p-6 md:p-8 space-y-8 font-sans">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800/60 pb-6">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs text-blue-400 font-bold uppercase tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            AIRSPACE Console
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white uppercase font-mono">
            WORKSPACE OVERVIEW
          </h1>
          <p className="text-xs text-gray-400 mt-1">Spatial Human-Computer Interaction Hub</p>
        </div>

        <Link
          href="/"
          className="px-6 py-3 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-[0_0_20px_rgba(59,130,246,0.5)] transition"
        >
          <Sparkles className="h-4 w-4" />
          <span>Launch Spatial Whiteboard</span>
          <MoveRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Featured Whiteboard Card */}
      <div className="rounded-3xl border border-blue-500/30 bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-purple-950/20 p-6 md:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <span className="px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-300 font-mono text-[10px] uppercase font-bold tracking-wider">
              Primary Product
            </span>
            <h2 className="text-xl md:text-2xl font-black tracking-tight text-white uppercase font-mono">
              Spatial Whiteboard
            </h2>
            <p className="text-xs text-gray-300 leading-relaxed">
              Write, erase, and draw in the air with your hands. Point index finger to draw smoothly with landmark #8. Open full palm to erase strokes. Auto-snaps geometric circles, rectangles, triangles, lines, and arrows.
            </p>
          </div>

          <Link
            href="/"
            className="px-6 py-3.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-[0_0_25px_rgba(59,130,246,0.6)] w-fit"
          >
            <Play className="h-4 w-4 fill-white" />
            <span>Open Spatial Whiteboard</span>
          </Link>
        </div>
      </div>

      {/* Launch Workspaces Grid */}
      <div className="space-y-4">
        <h3 className="text-xs font-mono uppercase tracking-wider text-gray-400 font-bold">
          Launch Workspaces
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            href="/"
            className="p-5 rounded-2xl border border-gray-800 bg-[#0f172a]/60 hover:border-blue-500/40 transition flex flex-col gap-2 group"
          >
            <div className="flex items-center justify-between">
              <span className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 group-hover:scale-110 transition">
                <PenTool className="h-5 w-5" />
              </span>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">Recommended</span>
            </div>
            <h4 className="font-bold text-sm text-white mt-2">Spatial Whiteboard</h4>
            <p className="text-xs text-gray-400">Pure camera-driven air writing, drawing, and open-palm erasing.</p>
          </Link>

          <Link
            href="/air-write"
            className="p-5 rounded-2xl border border-gray-800 bg-[#0f172a]/60 hover:border-blue-500/40 transition flex flex-col gap-2 group"
          >
            <span className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 group-hover:scale-110 transition w-fit">
              <PenTool className="h-5 w-5" />
            </span>
            <h4 className="font-bold text-sm text-white mt-2">Air Write</h4>
            <p className="text-xs text-gray-400">Continuous spatial character trajectory tracking & DTW recognition.</p>
          </Link>

          <Link
            href="/canvas"
            className="p-5 rounded-2xl border border-gray-800 bg-[#0f172a]/60 hover:border-blue-500/40 transition flex flex-col gap-2 group"
          >
            <span className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition w-fit">
              <Palette className="h-5 w-5" />
            </span>
            <h4 className="font-bold text-sm text-white mt-2">Air Canvas</h4>
            <p className="text-xs text-gray-400">Freeform diagramming with shapes and vector layers.</p>
          </Link>
        </div>
      </div>

    </div>
  );
}
