"use client";

import React, { useState, useEffect } from "react";
import { AirspaceWorkspace } from "../components/camera/AirspaceWorkspace";
import { InteractiveAirspaceDemo } from "../components/demo/InteractiveAirspaceDemo";
import {
  Sparkles,
  MoveRight,
  PenTool,
  Eraser,
  Shapes,
  Video,
  Camera,
  Layers,
  Sliders,
  Sun,
  Moon,
  Star,
  Github,
  Twitter,
  Globe,
  Play
} from "lucide-react";

export default function HomePage() {
  const [view, setView] = useState<"landing" | "workspace">("landing");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [demoTime, setDemoTime] = useState<number>(0);

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

  // Hero animation timer
  useEffect(() => {
    let animId: number;
    const loop = () => {
      setDemoTime((t) => t + 0.035);
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Direct URL check
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("start") === "true" || window.location.hash === "#workspace") {
        setView("workspace");
      }
    }
  }, []);

  if (view === "workspace") {
    return <AirspaceWorkspace onExit={() => setView("landing")} />;
  }

  const isLight = theme === "light";

  // Dynamic coordinates for glowing cursive "hello" hero trail
  const heroT = (demoTime * 0.7) % (Math.PI * 2);
  const heroX = 360 + Math.sin(heroT) * 110 + Math.cos(2 * heroT) * 40;
  const heroY = 220 + Math.sin(2 * heroT) * 50;

  return (
    <div className={`min-h-screen flex flex-col font-sans relative overflow-x-hidden selection:bg-purple-500/30 transition-colors duration-500 ${
      isLight ? "bg-[#f8fafc] text-slate-900" : "bg-[#030509] text-white"
    }`}>
      
      {/* Background ambient lighting */}
      <div className="absolute top-[-10%] left-[20%] w-[650px] h-[550px] bg-purple-600/15 rounded-full blur-[150px] pointer-events-none z-0" />
      <div className="absolute top-[35%] right-[-10%] w-[600px] h-[500px] bg-cyan-600/10 rounded-full blur-[160px] pointer-events-none z-0" />

      {/* Top Navbar */}
      <header className="relative z-10 max-w-7xl w-full mx-auto px-6 py-6 flex justify-between items-center border-b border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.6)]">
            <Star className="h-4 w-4 text-white fill-white" />
          </div>
          <span className="font-mono font-black text-lg tracking-widest uppercase">AIRSPACE</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-xl border transition ${
              isLight ? "bg-white border-slate-300 text-slate-700" : "bg-slate-900 border-white/[0.1] text-slate-300"
            }`}
            title="Toggle Light/Dark Theme"
          >
            {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4 text-amber-400" />}
          </button>

          <button
            onClick={() => setView("workspace")}
            className="px-6 py-2.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-mono text-xs font-bold transition flex items-center gap-2 shadow-[0_0_25px_rgba(168,85,247,0.5)]"
          >
            <span>Launch App</span>
            <MoveRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* HERO SECTION (Matching Reference Image) */}
      <section className="relative z-10 max-w-7xl w-full mx-auto px-6 pt-10 pb-16 flex flex-col lg:flex-row items-center gap-12 flex-1 justify-center">
        
        {/* Left Hero Column */}
        <div className="flex-1 space-y-7 max-w-xl">
          
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-950/40 border border-purple-500/30 text-purple-300 text-xs font-mono font-medium backdrop-blur-md shadow-inner">
            <Sparkles className="h-3.5 w-3.5 text-purple-400 animate-pulse" />
            <span>Futuristic Spatial Drawing & Camera Interface</span>
          </div>

          <div className="space-y-1">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05]">
              Write.<br />
              Draw.<br />
              Create in<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400">
                the Air.
              </span>
            </h1>
          </div>

          <p className="text-base sm:text-lg text-slate-400 font-medium leading-relaxed">
            Turn your hands into a digital creative interface.
          </p>

          <div className="pt-2">
            <button
              onClick={() => setView("workspace")}
              className="px-8 py-4 rounded-full bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-mono font-bold text-sm transition-all duration-300 flex items-center gap-3 shadow-[0_0_35px_rgba(168,85,247,0.6)] hover:shadow-[0_0_50px_rgba(168,85,247,0.9)] hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>ENTER AIRSPACE</span>
              <MoveRight className="h-4 w-4" />
            </button>
          </div>

          {/* Core Feature Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-white/[0.08]">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0 shadow-[0_0_12px_rgba(168,85,247,0.3)]">
                <PenTool className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold">AIR WRITING</h4>
                <p className="text-[11px] text-slate-400">Smooth continuous writing with your index finger.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-pink-600/20 border border-pink-500/30 flex items-center justify-center text-pink-400 shrink-0 shadow-[0_0_12px_rgba(236,72,153,0.3)]">
                <Eraser className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold">PALM ERASER</h4>
                <p className="text-[11px] text-slate-400">Erase naturally with your hand.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-[0_0_12px_rgba(6,182,212,0.3)]">
                <Shapes className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold">SPATIAL SHAPES</h4>
                <p className="text-[11px] text-slate-400">Create geometry using fingertip vertices.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                <Video className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold">RECORD & CAPTURE</h4>
                <p className="text-[11px] text-slate-400">Save camera interactions as images or video.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Hero Preview Window (Animated Cursive "hello" - No equations) */}
        <div className="flex-1 w-full max-w-2xl">
          <div
            onClick={() => setView("workspace")}
            className={`group relative rounded-3xl border p-3 backdrop-blur-2xl shadow-[0_30px_90px_rgba(0,0,0,0.95)] overflow-hidden cursor-pointer hover:border-purple-500/50 transition-all duration-500 ${
              isLight ? "bg-white/90 border-slate-300" : "bg-slate-950/80 border-white/[0.12]"
            }`}
          >
            <div className="relative w-full h-[420px] sm:h-[480px] rounded-2xl bg-[#080d1a] overflow-hidden flex items-center justify-center">
              
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#1e1b4b_0%,#030509_100%)] opacity-85" />

              {/* Header inside preview */}
              <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/80 border border-white/[0.1] text-[10px] font-mono text-white">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Camera On</span>
                </div>

                <div className="flex items-center bg-slate-950/80 rounded-full p-0.5 border border-white/[0.1]">
                  <span className="px-3 py-0.5 rounded-full bg-purple-600 text-[10px] font-bold text-white">Write</span>
                  <span className="px-3 py-0.5 text-[10px] text-slate-400 font-bold">Shapes</span>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/80 border border-white/[0.1] text-[10px] font-mono text-white">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span>00:00:32</span>
                </div>
              </div>

              {/* Animated Cursive "hello" Glowing Path (Matching Reference Image) */}
              <svg className="w-full h-full absolute inset-0 pointer-events-none">
                <defs>
                  <filter id="heroHelloGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="8" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Flowing cursive "hello" text */}
                <text
                  x="48%"
                  y="52%"
                  fill="#c084fc"
                  fontSize="72"
                  fontFamily="'Caveat', cursive, sans-serif"
                  fontWeight="bold"
                  textAnchor="middle"
                  filter="url(#heroHelloGlow)"
                  className="tracking-wider"
                >
                  hello
                </text>

                {/* Streaming glowing beam from fingertip */}
                <line
                  x1="62%"
                  y1="49%"
                  x2={heroX}
                  y2={heroY}
                  stroke="#c084fc"
                  strokeWidth="4"
                  strokeLinecap="round"
                  filter="url(#heroHelloGlow)"
                />

                {/* Glowing fingertip node */}
                <circle cx={heroX} cy={heroY} r="20" fill="rgba(192, 132, 252, 0.35)" filter="url(#heroHelloGlow)" />
                <circle cx={heroX} cy={heroY} r="7" fill="#ffffff" filter="url(#heroHelloGlow)" />
              </svg>

              {/* Click to Launch Banner */}
              <div className="absolute inset-0 bg-slate-950/25 group-hover:bg-transparent transition flex items-center justify-center">
                <div className="px-6 py-2.5 rounded-full bg-slate-950/90 border border-purple-500/40 text-purple-300 text-xs font-mono font-bold shadow-2xl opacity-0 group-hover:opacity-100 transition duration-300 flex items-center gap-2">
                  <Play className="h-3.5 w-3.5 fill-purple-300" />
                  <span>Enter Live Camera Workspace</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3D HOW IT WORKS & SHAPES INTERACTIVE DEMO SECTION */}
      <section className="relative z-10 max-w-7xl w-full mx-auto px-6 py-12 border-t border-white/[0.08]">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-2xl font-black tracking-tight">Interactive 3D Walkthrough</h2>
              <p className="text-xs text-slate-400 font-mono">Real-time breakdown of hand tracking, writing, and fingertip vertices</p>
            </div>
          </div>

          <InteractiveAirspaceDemo inline={true} />
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.08] py-8 text-center text-xs text-slate-500 font-mono">
        <p>AIRSPACE — Write. Draw. Create in the Air. &copy; {new Date().getFullYear()}. All processing is local and private.</p>
      </footer>
    </div>
  );
}
