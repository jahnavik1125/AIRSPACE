import React from "react";
import { Camera, CameraOff, AlertTriangle, RefreshCw } from "lucide-react";
import { CameraStatus } from "../../types/spatial";

interface CameraFeedProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: CameraStatus;
  devices: MediaDeviceInfo[];
  activeDeviceId: string | null;
  error: string | null;
  startCamera: () => void;
  stopCamera: () => void;
  switchCamera: (deviceId: string) => void;
}

export function CameraFeed({
  videoRef,
  status,
  devices,
  activeDeviceId,
  error,
  startCamera,
  stopCamera,
  switchCamera,
}: CameraFeedProps) {
  return (
    <div className="relative w-full aspect-video rounded-xl bg-[#0f172a] border border-gray-800 overflow-hidden shadow-2xl flex flex-col items-center justify-center">
      {/* 1. Camera Video Element */}
      <video
        ref={videoRef as any}
        className={`w-full h-full object-cover transform -scale-x-100 ${
          status === "ACTIVE" ? "block" : "hidden"
        }`}
        playsInline
        muted
      />

      {/* 2. State-Based Placeholders */}
      {status === "OFF" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10">
          <div className="h-16 w-16 rounded-full bg-gray-900 border border-gray-700 flex items-center justify-center mb-4">
            <CameraOff className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-200 mb-2">Camera is Offline</h3>
          <p className="text-sm text-gray-400 max-w-xs mb-4">
            Allow camera access to enable real-time spatial interaction.
          </p>
          <button
            onClick={startCamera}
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 font-medium text-sm text-white flex items-center gap-2 transition focus:ring-2 focus:ring-blue-400 focus:outline-none"
            aria-label="Start Camera Feed"
          >
            <Camera className="h-4 w-4" />
            Enable Camera
          </button>
        </div>
      )}

      {status === "REQUESTING" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#0b0f19]/80 z-10">
          <RefreshCw className="h-8 w-8 text-blue-500 animate-spin mb-4" />
          <h3 className="text-lg font-semibold text-gray-200 mb-1">Requesting Access</h3>
          <p className="text-sm text-gray-400">Please accept the browser camera prompt.</p>
        </div>
      )}

      {status === "ERROR" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#1e1b1b] border-2 border-red-900/50 z-10">
          <div className="h-12 w-12 rounded-full bg-red-950 border border-red-800 flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-red-400 mb-2">Camera Error</h3>
          <p className="text-sm text-gray-400 max-w-sm mb-4">
            {error || "An unknown hardware or permission error occurred."}
          </p>
          <button
            onClick={startCamera}
            className="px-4 py-2 rounded-lg bg-red-900 hover:bg-red-800 border border-red-700 font-medium text-sm text-white transition focus:ring-2 focus:ring-red-400 focus:outline-none"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* 3. Bottom controls overlay (Only visible when active) */}
      {status === "ACTIVE" && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between gap-4 z-20">
          {/* Select dropdown for video devices */}
          {devices.length > 1 ? (
            <select
              value={activeDeviceId || ""}
              onChange={(e) => switchCamera(e.target.value)}
              className="px-3 py-1.5 rounded bg-gray-900/90 border border-gray-700 text-xs text-gray-300 font-medium max-w-[200px] cursor-pointer focus:ring-2 focus:ring-blue-400 focus:outline-none"
              aria-label="Select Video Source Device"
            >
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${devices.indexOf(device) + 1}`}
                </option>
              ))}
            </select>
          ) : (
            <div className="text-xs text-gray-400 font-medium flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Live Feed
            </div>
          )}

          <button
            onClick={stopCamera}
            className="px-3 py-1.5 rounded bg-gray-900 hover:bg-red-950 border border-gray-700 hover:border-red-900 font-medium text-xs text-red-400 hover:text-red-300 transition focus:ring-2 focus:ring-red-400 focus:outline-none"
            aria-label="Disable Camera Feed"
          >
            Turn Off
          </button>
        </div>
      )}
    </div>
  );
}
