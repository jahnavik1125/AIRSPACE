import { useState, useEffect, useRef, useCallback } from "react";
import { CameraStatus } from "../types/spatial";

export function useCamera() {
  const [status, setStatus] = useState<CameraStatus>("OFF");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      if (typeof streamRef.current.getTracks === "function") {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStatus("OFF");
    setError(null);
  }, []);

  const startCamera = useCallback(async (deviceId?: string) => {
    stopCamera();
    setStatus("REQUESTING");
    setError(null);

    const constraints: MediaStreamConstraints = {
      video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "user" }
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for metadata to load and trigger play
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((err) => {
            console.warn("Video auto-play was blocked or interrupted:", err);
          });
        };
      }
      
      setStatus("ACTIVE");
      
      // Select the active device ID
      const videoTrack = typeof stream.getVideoTracks === "function" ? stream.getVideoTracks()[0] : null;
      if (videoTrack && typeof videoTrack.getSettings === "function") {
        const settings = videoTrack.getSettings();
        if (settings.deviceId) {
          setActiveDeviceId(settings.deviceId);
        }
      }

      // Enumerate other inputs
      if (navigator.mediaDevices && typeof navigator.mediaDevices.enumerateDevices === "function") {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices.filter((d) => d.kind === "videoinput");
        setDevices(videoDevices);
      }
      
    } catch (err: any) {
      console.error("Camera access failed:", err);
      setStatus("ERROR");
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setError("Camera permission denied. Please allow camera access in browser settings.");
      } else {
        setError(err.message || "Failed to access webcam hardware.");
      }
    }
  }, [stopCamera]);

  const switchCamera = useCallback(async (deviceId: string) => {
    setActiveDeviceId(deviceId);
    await startCamera(deviceId);
  }, [startCamera]);

  // Handle cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return {
    status,
    devices,
    activeDeviceId,
    error,
    videoRef,
    startCamera,
    stopCamera,
    switchCamera
  };
}
export type UseCameraReturn = ReturnType<typeof useCamera>;
