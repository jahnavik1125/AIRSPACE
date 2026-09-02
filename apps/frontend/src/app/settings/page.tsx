"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, Trash2, Camera, Brain, User, Fingerprint } from "lucide-react";
import { useSystemStatus } from "../../context/SystemStatusContext";
import { useSpatialWebSocket } from "../../hooks/useSpatialWebSocket";

export default function SettingsPage() {
  const { showToast } = useSystemStatus();
  const { dbSessionId } = useSpatialWebSocket();
  const [aiProviderStatus, setAiProviderStatus] = useState("Checking status...");

  useEffect(() => {
    const fetchAIStatus = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const resp = await fetch(`${apiUrl}/api/ai-lab/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: "status", context: {} })
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.llm_status === "not_configured" || (data.response && data.response.includes("configuration required"))) {
            setAiProviderStatus("AI Provider API key configuration required");
          } else {
            setAiProviderStatus("Active (API Key Configured)");
          }
        } else {
          setAiProviderStatus("Unavailable");
        }
      } catch {
        setAiProviderStatus("Unavailable (Backend Offline)");
      }
    };
    fetchAIStatus();
  }, []);

  const handlePurgeHistory = async () => {
    const proceed = confirm("Privacy check: This will permanently delete all interaction events, drawings, math solves, and session logs. Continue?");
    if (!proceed) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/analytics/purge`, {
        method: "DELETE"
      });
      if (response.ok) {
        showToast("All interaction logs successfully deleted.", "success");
      } else {
        showToast("History purge failed.", "error");
      }
    } catch {
      showToast("Backend connection error during purge.", "error");
    }
  };

  const handleResetCalibration = async () => {
    const proceed = confirm("Are you sure you want to reset your personalized gesture profile? All thresholds will fall back to defaults.");
    if (!proceed) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const url = dbSessionId 
        ? `${apiUrl}/api/gestures/calibration?db_session_id=${dbSessionId}`
        : `${apiUrl}/api/gestures/calibration`;
      const response = await fetch(url, {
        method: "DELETE"
      });
      if (response.ok) {
        showToast("Gesture profile successfully reset to defaults.", "success");
      } else {
        showToast("Calibration reset failed.", "error");
      }
    } catch {
      showToast("Backend connection error during profile reset.", "error");
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0b0f19] text-[#f3f4f6] min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#0f172a] px-6 py-4 flex justify-between items-center z-30">
        <div className="flex items-center gap-3">
          <Link href="/app" className="p-2 rounded-lg bg-gray-900 hover:bg-gray-850 border border-gray-800 text-gray-400 hover:text-white transition">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-md font-bold tracking-wider text-white">SYSTEM SETTINGS</h1>
            <p className="text-[10px] text-gray-400 font-mono">Calibrate gestures, review provider configurations, and wipe interaction logs</p>
          </div>
        </div>
      </header>

      {/* Settings Sections List */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 space-y-6">
        
        {/* Profile calibration section */}
        <section className="rounded-xl border border-gray-800 bg-[#0f172a] p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <Fingerprint className="h-4 w-4 text-blue-500" />
            Gesture calibration
          </h2>
          <p className="text-xs text-gray-400 leading-relaxed">
            Personalize trigger thresholds by training a statistical distance model on your hand gesture shapes. Fits adaptive boundaries to your natural finger extensions.
          </p>
          <div className="pt-2">
            <Link href="/settings/gesture-calibration" className="inline-block px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition shadow-md">
              Start Guided Calibration
            </Link>
          </div>
        </section>

        {/* AI Provider configuration status */}
        <section className="rounded-xl border border-gray-800 bg-[#0f172a] p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <Brain className="h-4 w-4 text-violet-500" />
            AI Provider Status
          </h2>
          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between border-b border-gray-850 pb-2">
              <span className="text-gray-400">Current AI Model Core:</span>
              <span className="text-white font-bold">{aiProviderStatus}</span>
            </div>
            <p className="text-[10px] text-gray-500 leading-relaxed pt-1">
              To configure a live LLM endpoint, set the environment variable <code className="text-gray-400">AIRSPACE_AI_API_KEY</code> on your FastAPI backend server environment. If absent, the server initializes in mock reasoning mode automatically.
            </p>
          </div>
        </section>

        {/* Privacy panel */}
        <section className="rounded-xl border border-gray-800 bg-[#0f172a] p-6 space-y-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <User className="h-4 w-4 text-emerald-500" />
            Privacy controls & Wipes
          </h2>
          
          <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-900/30 flex gap-3 text-xs leading-relaxed text-blue-300">
            <ShieldAlert className="h-5 w-5 flex-shrink-0 text-blue-400" />
            <div>
              <span className="font-bold block pb-0.5">Privacy Statement</span>
              AIRSPACE runs computer vision processes locally. Only derived coordinates, counts, solved results strings, and session duration tallies are saved. Webcam video feeds are never recorded.
            </div>
          </div>

          <div className="border-t border-gray-800/80 pt-4 space-y-4">
            <div className="flex justify-between items-center gap-4">
              <div>
                <span className="text-xs font-bold text-white block">Delete Session & Analytics History</span>
                <span className="text-[10px] text-gray-500 block mt-0.5">Permanently erase all session entries, coordinates tracking, and analytics count graphs.</span>
              </div>
              <button
                onClick={handlePurgeHistory}
                className="px-3.5 py-2 rounded-lg bg-red-950/40 hover:bg-red-900/40 border border-red-900/30 text-red-400 hover:text-red-300 text-xs font-bold transition flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Purge History
              </button>
            </div>

            <div className="flex justify-between items-center gap-4 border-t border-gray-850 pt-4">
              <div>
                <span className="text-xs font-bold text-white block">Delete Calibration Data</span>
                <span className="text-[10px] text-gray-500 block mt-0.5">Wipe all calibration samples, resetting gesture trigger limits to global system defaults.</span>
              </div>
              <button
                onClick={handleResetCalibration}
                className="px-3.5 py-2 rounded-lg bg-red-950/40 hover:bg-red-900/40 border border-red-900/30 text-red-400 hover:text-red-300 text-xs font-bold transition flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Reset Profile
              </button>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
export type SettingsPageType = typeof SettingsPage;
