"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type AirspaceRecordStatus = "IDLE" | "RECORDING" | "PAUSED";

export interface UseAirspaceRecorderReturn {
  status: AirspaceRecordStatus;
  durationSeconds: number;
  formattedTime: string;
  hasAudio: boolean;
  startRecording: (sourceCanvas: HTMLCanvasElement) => Promise<boolean>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => Promise<string | null>;
  takeSnapshot: (sourceCanvas: HTMLCanvasElement, filenamePrefix?: string) => string | null;
}

export function useAirspaceRecorder(): UseAirspaceRecorderReturn {
  const [status, setStatus] = useState<AirspaceRecordStatus>("IDLE");
  const [durationSeconds, setDurationSeconds] = useState<number>(0);
  const [hasAudio, setHasAudio] = useState<boolean>(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  // Format to HH:MM:SS matching reference image: "00:00:00"
  const formatTime = (totalSecs: number) => {
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const startTimer = useCallback(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setDurationSeconds((prev) => prev + 1);
    }, 1000);
  }, []);

  const pauseTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setDurationSeconds(0);
  }, []);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // 1. Start composited recording
  const startRecording = useCallback(
    async (sourceCanvas: HTMLCanvasElement): Promise<boolean> => {
      try {
        if (!sourceCanvas) return false;
        recordedChunksRef.current = [];

        let canvasStream: MediaStream;
        if (typeof sourceCanvas.captureStream === "function") {
          canvasStream = sourceCanvas.captureStream(30);
        } else {
          return false;
        }

        const combinedStream = new MediaStream();
        canvasStream.getVideoTracks().forEach((track) => combinedStream.addTrack(track));

        try {
          if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function") {
            const audio = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioStreamRef.current = audio;
            audio.getAudioTracks().forEach((t) => combinedStream.addTrack(t));
            setHasAudio(true);
          }
        } catch {
          setHasAudio(false);
        }

        const mimeTypes = [
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
          "video/webm",
          "video/mp4"
        ];
        let selectedMime = "";
        for (const m of mimeTypes) {
          if (typeof MediaRecorder !== "undefined" && typeof MediaRecorder.isTypeSupported === "function") {
            if (MediaRecorder.isTypeSupported(m)) {
              selectedMime = m;
              break;
            }
          }
        }

        const options: MediaRecorderOptions = selectedMime ? { mimeType: selectedMime } : {};
        const recorder = new MediaRecorder(combinedStream, options);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            recordedChunksRef.current.push(e.data);
          }
        };

        recorder.start(250);
        setStatus("RECORDING");
        setDurationSeconds(0);
        startTimer();
        return true;
      } catch (err) {
        console.error("Failed to start recording:", err);
        setStatus("IDLE");
        return false;
      }
    },
    [startTimer]
  );

  // 2. Pause
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
      pauseTimer();
      setStatus("PAUSED");
    }
  }, [pauseTimer]);

  // 3. Resume
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
      startTimer();
      setStatus("RECORDING");
    }
  }, [startTimer]);

  // 4. Stop and save
  const stopRecording = useCallback(async (): Promise<string | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        setStatus("IDLE");
        stopTimer();
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "video/webm";
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const videoUrl = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.style.display = "none";
        a.href = videoUrl;
        const ext = mimeType.includes("mp4") ? "mp4" : "webm";
        a.download = `airspace-capture-${Date.now()}.${ext}`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
        }, 100);

        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((t) => t.stop());
          audioStreamRef.current = null;
        }

        setStatus("IDLE");
        stopTimer();
        resolve(videoUrl);
      };

      recorder.stop();
    });
  }, [stopTimer]);

  // 5. Snapshot
  const takeSnapshot = useCallback(
    (sourceCanvas: HTMLCanvasElement, filenamePrefix: string = "airspace-snapshot"): string | null => {
      try {
        if (!sourceCanvas) return null;
        const imageUrl = sourceCanvas.toDataURL("image/png");

        const a = document.createElement("a");
        a.style.display = "none";
        a.href = imageUrl;
        a.download = `${filenamePrefix}-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
        }, 100);

        return imageUrl;
      } catch (err) {
        console.error("Snapshot failed:", err);
        return null;
      }
    },
    []
  );

  return {
    status,
    durationSeconds,
    formattedTime: formatTime(durationSeconds),
    hasAudio,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    takeSnapshot
  };
}
