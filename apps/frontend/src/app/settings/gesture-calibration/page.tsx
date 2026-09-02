"use client";

import React, { useEffect, useState, useRef } from "react";
import { Camera, Check, RefreshCw, X, ArrowLeft, ShieldAlert, Trash2 } from "lucide-react";
import Link from "next/link";

import { useCamera } from "../../../hooks/useCamera";
import { useHandTracking } from "../../../hooks/useHandTracking";
import { useSpatialWebSocket } from "../../../hooks/useSpatialWebSocket";
import { CameraFeed } from "../../../components/camera/CameraFeed";
import { CameraOverlay } from "../../../components/camera/CameraOverlay";

interface GestureCalibrationStep {
  key: string;
  label: string;
  description: string;
}

const GESTURE_STEPS: GestureCalibrationStep[] = [
  { key: "INDEX_POINT", label: "Index Point", description: "Extend only your index finger. Keep all other fingers curled into your palm." },
  { key: "PINCH", label: "Pinch", description: "Pinch the tips of your index finger and thumb tightly together." },
  { key: "FIST", label: "Fist", description: "Curl all fingers and thumb tightly into a closed fist gesture." },
  { key: "OPEN_PALM", label: "Open Palm", description: "Extend all fingers and thumb straight out, flat and spread apart." },
  { key: "TWO_FINGER", label: "Two Finger Point", description: "Extend both your index and middle fingers together, curling the rest." }
];

export default function GestureCalibrationPage() {
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

  const { hands } = useHandTracking(videoRef, cameraStatus === "ACTIVE");
  const { dbSessionId } = useSpatialWebSocket();

  // Calibration flow states
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [sampleCount, setSampleCount] = useState(0);
  const [consistency, setConsistency] = useState(0.0);
  const [threshold, setThreshold] = useState<number | null>(null);
  
  const [saving, setSaving] = useState(false);
  const [profileSummaries, setProfileSummaries] = useState<any[]>([]);

  const fetchProfiles = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/gestures/calibration?db_session_id=${dbSessionId || 0}`);
      if (response.ok) {
        const result = await response.json();
        setProfileSummaries(result.profiles);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, [dbSessionId, activeStepIdx]);

  const activeStep = GESTURE_STEPS[activeStepIdx];

  const handleCaptureSample = async () => {
    if (!hands || hands.length === 0) {
      alert("No hand joints detected. Align your hand within the camera frame before capturing.");
      return;
    }

    setSaving(true);
    const primaryHand = hands[0];

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/gestures/calibration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          db_session_id: dbSessionId || 0,
          gesture_name: activeStep.key,
          raw_landmarks: primaryHand.landmarks.map((l) => ({
            x: l.x,
            y: l.y,
            z: l.z
          }))
        })
      });

      if (response.ok) {
        const result = await response.json();
        setSampleCount(result.sample_count);
        setConsistency(result.consistency);
        setThreshold(result.personalized_threshold);
      } else {
        alert("Failed to save calibration sample.");
      }
    } catch (e) {
      console.error(e);
      alert("Error sending calibration coordinates.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetProfile = async () => {
    if (!dbSessionId) return;
    const proceed = confirm("Are you sure you want to reset your personalized gesture profiles? Thresholds will revert to global defaults.");
    if (!proceed) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/gestures/calibration?db_session_id=${dbSessionId}`, {
        method: "DELETE"
      });
      if (response.ok) {
        alert("Profile reset complete. Restored defaults.");
        setSampleCount(0);
        setConsistency(0);
        setThreshold(null);
        fetchProfiles();
      }
    } catch (e) {
      console.error(e);
      alert("Error resetting gesture calibrations.");
    }
  };

  const currentProfile = profileSummaries.find((p) => p.gesture_name === activeStep.key);

  return (
    <div className="flex-1 flex flex-col bg-[#0b0f19] text-[#f3f4f6] min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#0f172a] px-6 py-4 flex justify-between items-center z-30">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-white transition">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-md font-bold tracking-wider text-white">GESTURE CALIBRATION</h1>
            <p className="text-[10px] text-gray-400 font-mono">Personalize spatial controls and adapt trigger thresholds</p>
          </div>
        </div>

        <button
          onClick={handleResetProfile}
          className="px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/40 border border-red-900/30 text-red-400 hover:text-red-300 text-xs font-bold transition flex items-center gap-1.5"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Reset Profile
        </button>
      </header>

      {/* Main Grid Studio */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Live camera feed (ColSpan: 5) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">Calibration Camera</h2>
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

          {/* Privacy statement */}
          <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-900/30 flex gap-3 text-xs leading-relaxed text-blue-300">
            <ShieldAlert className="h-5 w-5 flex-shrink-0 text-blue-400" />
            <div>
              <span className="font-bold block pb-0.5">Privacy Commitment</span>
              AIRSPACE processes hand coordinate joints locally and stores derived mathematical metrics features. Raw webcam feeds are never saved or sent to external servers.
            </div>
          </div>
        </div>

        {/* Right Column: Steps Guide & Profile status (ColSpan: 7) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Steps indicators row */}
          <div className="flex gap-2 border-b border-gray-800 pb-3 overflow-x-auto">
            {GESTURE_STEPS.map((step, idx) => (
              <button
                key={step.key}
                onClick={() => {
                  setActiveStepIdx(idx);
                  setSampleCount(0);
                  setConsistency(0);
                  setThreshold(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  activeStepIdx === idx
                    ? "bg-blue-600 text-white font-bold"
                    : "bg-gray-900 hover:bg-gray-850 text-gray-400 border border-gray-850"
                }`}
              >
                {step.label}
              </button>
            ))}
          </div>

          {/* Guided Action Card */}
          <div className="rounded-xl border border-gray-800 bg-[#0f172a] p-6 shadow-xl flex flex-col gap-5">
            <div>
              <span className="text-[10px] font-mono text-blue-500 uppercase tracking-widest block pb-1">
                STEP {activeStepIdx + 1} OF 5
              </span>
              <h3 className="text-md font-bold text-white uppercase">{activeStep.label}</h3>
              <p className="text-gray-400 mt-2 text-xs leading-relaxed">{activeStep.description}</p>
            </div>

            {/* Calibration Stats Indicators */}
            <div className="grid grid-cols-3 gap-4 border-t border-b border-gray-800/80 py-4 font-mono text-[10px] text-gray-400">
              <div>
                <span className="text-gray-500 block uppercase">Samples:</span>
                <span className="text-white text-sm font-bold block mt-1">
                  {currentProfile ? currentProfile.sample_count : sampleCount} / 5
                </span>
              </div>
              <div>
                <span className="text-gray-500 block uppercase">Consistency:</span>
                <span className="text-white text-sm font-bold block mt-1">
                  {currentProfile 
                    ? `${(currentProfile.consistency * 100).toFixed(0)}%` 
                    : `${(consistency * 100).toFixed(0)}%`}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block uppercase">Threshold limit:</span>
                <span className="text-white text-sm font-bold block mt-1">
                  {currentProfile?.personalized_threshold 
                    ? currentProfile.personalized_threshold.toFixed(3) 
                    : threshold 
                      ? threshold.toFixed(3) 
                      : "Default"}
                </span>
              </div>
            </div>

            {/* Trigger Calibration capture buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleCaptureSample}
                disabled={hands.length === 0 || saving}
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 border border-blue-500 text-xs font-bold text-white flex items-center justify-center gap-2 transition shadow-lg disabled:opacity-50"
              >
                {saving ? "Processing..." : "Capture Landmark Sample"}
              </button>
              <button
                onClick={() => {
                  setSampleCount(0);
                  setConsistency(0);
                  setThreshold(null);
                }}
                className="p-3 rounded-xl bg-gray-900 hover:bg-gray-850 border border-gray-800 text-gray-400 hover:text-white transition"
                title="Retry current step"
                aria-label="Retry calibration step"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Profile overview progress */}
          <div className="rounded-xl border border-gray-800 bg-[#0f172a] p-5 shadow-xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 pb-3 border-b border-gray-800/80 mb-4">
              Gesture Profile status
            </h3>
            <div className="space-y-3 text-xs">
              {GESTURE_STEPS.map((step) => {
                const prof = profileSummaries.find((p) => p.gesture_name === step.key);
                return (
                  <div key={step.key} className="flex justify-between items-center py-1">
                    <span className="text-gray-300 font-semibold">{step.label}</span>
                    <div className="flex items-center gap-3">
                      {prof && prof.sample_count >= 5 ? (
                        <div className="flex items-center gap-1.5 text-green-400 font-bold font-mono text-[10px]">
                          <Check className="h-3.5 w-3.5" />
                          Calibrated ({(prof.consistency * 100).toFixed(0)}%)
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-gray-500 font-mono text-[10px]">
                          <X className="h-3.5 w-3.5" />
                          {prof ? `${prof.sample_count} / 5 samples` : "Pending"}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}
export type GestureCalibrationPageType = typeof GestureCalibrationPage;
