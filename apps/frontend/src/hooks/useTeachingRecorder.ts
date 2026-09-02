"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type RecordingStatus = "IDLE" | "RECORDING" | "PAUSED";

export interface UseTeachingRecorderReturn {
  status: RecordingStatus;
  durationSeconds: number;
  formattedTime: string;
  hasAudio: boolean;
  startRecording: (sourceCanvas: HTMLCanvasElement) => Promise<boolean>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => Promise<string | null>;
  takeSnapshot: (sourceCanvas: HTMLCanvasElement, filenamePrefix?: string) => string | null;
}

export function useTeachingRecorder(): UseTeachingRecorderReturn {
  const [status, setStatus] = useState<RecordingStatus>("IDLE");
  const [durationSeconds, setDurationSeconds] = useState<number>(0);
  const [hasAudio, setHasAudio] = useState<boolean>(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  // Format seconds to MM:SS
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Timer helpers
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

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // 1. Start Recording (Canvas stream + optional microphone audio)
  const startRecording = useCallback(
    async (sourceCanvas: HTMLCanvasElement): Promise<boolean> => {
      try {
        if (!sourceCanvas) return false;

        // Reset chunks
        recordedChunksRef.current = [];

        // 1. Capture 30 FPS video stream from the composited teaching canvas
        let canvasStream: MediaStream;
        if (typeof sourceCanvas.captureStream === "function") {
          canvasStream = sourceCanvas.captureStream(30);
        } else {
          console.warn("captureStream not supported in this environment");
          return false;
        }

        // 2. Request microphone audio for verbal explanation
        let combinedStream = new MediaStream();
        canvasStream.getVideoTracks().forEach((track) => combinedStream.addTrack(track));

        try {
          if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function") {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioStreamRef.current = audioStream;
            audioStream.getAudioTracks().forEach((track) => combinedStream.addTrack(track));
            setHasAudio(true);
          }
        } catch (audioErr) {
          console.warn("Microphone not available, recording video only:", audioErr);
          setHasAudio(false);
        }

        // 3. Choose supported container format
        const mimeTypes = [
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
          "video/webm",
          "video/mp4"
        ];
        let selectedMimeType = "";
        for (const mime of mimeTypes) {
          if (typeof MediaRecorder !== "undefined" && typeof MediaRecorder.isTypeSupported === "function") {
            if (MediaRecorder.isTypeSupported(mime)) {
              selectedMimeType = mime;
              break;
            }
          }
        }

        const options: MediaRecorderOptions = selectedMimeType ? { mimeType: selectedMimeType } : {};
        const mediaRecorder = new MediaRecorder(combinedStream, options);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.start(250); // Collect data every 250ms
        setStatus("RECORDING");
        setDurationSeconds(0);
        startTimer();

        return true;
      } catch (err) {
        console.error("Failed to start teaching recording:", err);
        setStatus("IDLE");
        return false;
      }
    },
    [startTimer]
  );

  // 2. Pause Recording
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
      pauseTimer();
      setStatus("PAUSED");
    }
  }, [pauseTimer]);

  // 3. Resume Recording
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
      startTimer();
      setStatus("RECORDING");
    }
  }, [startTimer]);

  // 4. Stop Recording and Trigger Video Download
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

        // Auto download teaching video
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = videoUrl;
        const ext = mimeType.includes("mp4") ? "mp4" : "webm";
        a.download = `airspace-teaching-lesson-${Date.now()}.${ext}`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
        }, 100);

        // Clean up audio tracks
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((track) => track.stop());
          audioStreamRef.current = null;
        }

        setStatus("IDLE");
        stopTimer();
        resolve(videoUrl);
      };

      recorder.stop();
    });
  }, [stopTimer]);

  // 5. Snapshot Capture (Camera frame + all writing + all shapes composited)
  const takeSnapshot = useCallback(
    (sourceCanvas: HTMLCanvasElement, filenamePrefix: string = "airspace-teaching-snapshot"): string | null => {
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
        console.error("Snapshot capture failed:", err);
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
