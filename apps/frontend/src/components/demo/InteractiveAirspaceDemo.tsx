"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, X, PenTool, Shapes } from "lucide-react";

interface InteractiveAirspaceDemoProps {
  onClose?: () => void;
  inline?: boolean;
}

export function InteractiveAirspaceDemo({ onClose, inline = false }: InteractiveAirspaceDemoProps) {
  const [activeTab, setActiveTab] = useState<"write" | "shapes">("write");
  const [shapesMode, setShapesMode] = useState<"two" | "three" | "four" | "free">("three");
  const [animTime, setAnimTime] = useState<number>(0);

  useEffect(() => {
    let animId: number;
    const update = () => {
      setAnimTime((t) => t + 0.035);
      animId = requestAnimationFrame(update);
    };
    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Write demo: Two-finger midpoint traces smooth cursive "HELLO"
  const t = (animTime * 0.6) % (Math.PI * 2);
  const cx = 220;
  const cy = 130;
  const midX = cx + Math.sin(t) * 95 + Math.cos(2 * t) * 35;
  const midY = cy + Math.sin(2 * t) * 45;

  // Index and middle fingertips offset on either side of midpoint
  const tip1 = { x: midX - 7, y: midY - 14 }; // Index tip #8
  const tip2 = { x: midX + 7, y: midY - 14 }; // Middle tip #12

  const content = (
    <div className={`flex flex-col gap-6 text-white ${inline ? "" : "p-6 max-w-4xl w-full rounded-3xl bg-slate-950/95 border border-white/[0.12] backdrop-blur-2xl shadow-2xl"}`}>
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-cyan-500 flex items-center justify-center font-bold text-white font-mono shadow-[0_0_15px_rgba(168,85,247,0.5)]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-bold text-base text-white">Interactive 3D Walkthrough</h3>
            <p className="text-xs text-slate-400 font-mono">Two-finger (✌️) air-writing & fingertip spatial vertices</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-900 rounded-full p-1 border border-white/[0.08]">
            <button
              onClick={() => setActiveTab("write")}
              className={`flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold transition ${
                activeTab === "write" ? "bg-purple-600 text-white shadow-[0_0_12px_rgba(168,85,247,0.5)]" : "text-slate-400 hover:text-white"
              }`}
            >
              <PenTool className="h-3 w-3" />
              <span>Two-Finger Write</span>
            </button>
            <button
              onClick={() => setActiveTab("shapes")}
              className={`flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold transition ${
                activeTab === "shapes" ? "bg-cyan-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.5)]" : "text-slate-400 hover:text-white"
              }`}
            >
              <Shapes className="h-3 w-3" />
              <span>Shapes Demo</span>
            </button>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/[0.1] text-slate-400 hover:text-white transition ml-2"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: 3D TWO-FINGER WRITING DEMO (✌️) */}
      {activeTab === "write" && (
        <div className="flex flex-col gap-5">
          <div className="relative w-full h-[270px] rounded-2xl bg-[#04060d] border border-white/[0.08] overflow-hidden flex items-center justify-center">
            
            {/* 3D Coordinate Grid */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30">
              <line x1="220" y1="20" x2="220" y2="250" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="4 4" />
              <line x1="40" y1="130" x2="400" y2="130" stroke="#a855f7" strokeWidth="1.5" strokeDasharray="4 4" />
              <line x1="120" y1="230" x2="320" y2="30" stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="4 4" />
            </svg>

            {/* Render Trajectory & Hand Representation */}
            <svg className="w-full h-full absolute inset-0 pointer-events-none">
              <defs>
                <filter id="twoFingerGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Streaming continuous marker ink trail */}
              <path
                d={`M 130 130 Q 170 70, 220 130 T ${midX} ${midY}`}
                fill="none"
                stroke="#c084fc"
                strokeWidth="7"
                strokeLinecap="round"
                filter="url(#twoFingerGlow)"
              />

              {/* Index Fingertip #8 */}
              <circle cx={tip1.x} cy={tip1.y} r="5" fill="#06b6d4" filter="url(#twoFingerGlow)" />
              <circle cx={tip1.x} cy={tip1.y} r="2" fill="#ffffff" />

              {/* Middle Fingertip #12 */}
              <circle cx={tip2.x} cy={tip2.y} r="5" fill="#22c55e" filter="url(#twoFingerGlow)" />
              <circle cx={tip2.x} cy={tip2.y} r="2" fill="#ffffff" />

              {/* Glowing Midpoint Pen Cursor */}
              <line x1={tip1.x} y1={tip1.y} x2={tip2.x} y2={tip2.y} stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
              <circle cx={midX} cy={midY} r="15" fill="rgba(192, 132, 252, 0.4)" filter="url(#twoFingerGlow)" />
              <circle cx={midX} cy={midY} r="5" fill="#ffffff" filter="url(#twoFingerGlow)" />

              {/* Flowing Word HELLO */}
              <text
                x="220"
                y="195"
                fill="rgba(192, 132, 252, 0.25)"
                fontSize="38"
                fontFamily="'Caveat', cursive, sans-serif"
                fontWeight="bold"
                textAnchor="middle"
              >
                HELLO
              </text>
            </svg>

            {/* Gesture Badge */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2 font-mono text-xs text-purple-300 bg-purple-950/70 px-3.5 py-1.5 rounded-full border border-purple-500/40 backdrop-blur-md">
              <span className="text-base leading-none">✌️</span>
              <span className="font-bold">Two Fingers Extended (Index + Middle) &rarr; Midpoint Writes</span>
            </div>

            <div className="absolute bottom-4 right-4 z-10 font-mono text-[11px] text-slate-400 bg-slate-950/70 px-3 py-1 rounded-full border border-white/[0.08]">
              Ring & Pinky Folded &bull; Zero Pinch &bull; No single-finger writing
            </div>
          </div>

          {/* 5-Step Process Breakdown Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {[
              { step: 1, title: "Raise ✌️", desc: "Index & middle extended" },
              { step: 2, title: "Midpoint Cursor", desc: "Digital pen activates" },
              { step: 3, title: "Continuous Ink", desc: "No breaks or interruptions" },
              { step: 4, title: "Fold Fingers", desc: "Stroke safely concludes" },
              { step: 5, title: "Raise ✌️ Again", desc: "New stroke begins" }
            ].map((s) => (
              <div
                key={s.step}
                className="p-3 rounded-xl bg-slate-900/60 border border-white/[0.06] flex flex-col gap-1 hover:border-purple-500/40 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-purple-400">Step {s.step}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500/60" />
                </div>
                <h4 className="text-xs font-bold text-white">{s.title}</h4>
                <p className="text-[10px] text-slate-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: SHAPES DEMO (Fingertip Vertices & Exact Edges) */}
      {activeTab === "shapes" && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-2">
            {[
              { id: "two", label: "Two Points (Line)" },
              { id: "three", label: "Three Points (Triangle)" },
              { id: "four", label: "Four Points (Quad)" },
              { id: "free", label: "Spatial Network" }
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setShapesMode(m.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition ${
                  shapesMode === m.id
                    ? "bg-cyan-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.5)]"
                    : "bg-slate-900 text-slate-400 hover:text-white"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="relative w-full h-[270px] rounded-2xl bg-[#04060d] border border-white/[0.08] overflow-hidden flex items-center justify-center">
            <svg className="w-full h-full absolute inset-0">
              <defs>
                <filter id="shapeGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {shapesMode === "two" && (
                <g>
                  <line x1="160" y1="130" x2="320" y2="130" stroke="#06b6d4" strokeWidth="3" filter="url(#shapeGlow)" />
                  <circle cx="160" cy="130" r="7" fill="#06b6d4" filter="url(#shapeGlow)" />
                  <circle cx="160" cy="130" r="2.5" fill="#ffffff" />
                  <circle cx="320" cy="130" r="7" fill="#ec4899" filter="url(#shapeGlow)" />
                  <circle cx="320" cy="130" r="2.5" fill="#ffffff" />
                </g>
              )}

              {shapesMode === "three" && (
                <g>
                  <polygon points="240,60 140,190 340,190" fill="rgba(6, 182, 212, 0.12)" stroke="#06b6d4" strokeWidth="3" filter="url(#shapeGlow)" />
                  <circle cx="240" cy="60" r="7" fill="#06b6d4" filter="url(#shapeGlow)" />
                  <circle cx="140" cy="190" r="7" fill="#ec4899" filter="url(#shapeGlow)" />
                  <circle cx="340" cy="190" r="7" fill="#22c55e" filter="url(#shapeGlow)" />
                </g>
              )}

              {shapesMode === "four" && (
                <g>
                  <polygon points="140,80 340,80 320,190 160,190" fill="rgba(168, 85, 247, 0.12)" stroke="#a855f7" strokeWidth="3" filter="url(#shapeGlow)" />
                  <circle cx="140" cy="80" r="7" fill="#06b6d4" filter="url(#shapeGlow)" />
                  <circle cx="340" cy="80" r="7" fill="#ec4899" filter="url(#shapeGlow)" />
                  <circle cx="320" cy="190" r="7" fill="#f59e0b" filter="url(#shapeGlow)" />
                  <circle cx="160" cy="190" r="7" fill="#22c55e" filter="url(#shapeGlow)" />
                </g>
              )}

              {shapesMode === "free" && (
                <g>
                  <polygon points="120,120 240,60 360,110 320,200 160,190" fill="rgba(59, 130, 246, 0.10)" stroke="#3b82f6" strokeWidth="2.5" filter="url(#shapeGlow)" />
                  <line x1="120" y1="120" x2="320" y2="200" stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4" />
                  <line x1="240" y1="60" x2="160" y2="190" stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4" />
                  <circle cx="120" cy="120" r="7" fill="#ec4899" filter="url(#shapeGlow)" />
                  <circle cx="240" cy="60" r="7" fill="#06b6d4" filter="url(#shapeGlow)" />
                  <circle cx="360" cy="110" r="7" fill="#22c55e" filter="url(#shapeGlow)" />
                  <circle cx="320" cy="200" r="7" fill="#f59e0b" filter="url(#shapeGlow)" />
                  <circle cx="160" cy="190" r="7" fill="#a855f7" filter="url(#shapeGlow)" />
                </g>
              )}
            </svg>

            <div className="absolute bottom-4 left-4 z-10 font-mono text-xs text-cyan-300 bg-cyan-950/70 px-3 py-1 rounded-full border border-cyan-500/30 backdrop-blur-md">
              Fingertip = Vertex &bull; Edge connects fingertip to fingertip &bull; Follows hands live
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (inline) return content;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      {content}
    </div>
  );
}
export default InteractiveAirspaceDemo;
