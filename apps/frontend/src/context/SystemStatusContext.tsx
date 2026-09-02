"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface SystemStatus {
  camera: "off" | "active" | "error";
  handTracking: "inactive" | "active" | "loading";
  websocket: "disconnected" | "connected" | "connecting";
  backend: "offline" | "online" | "connecting";
  database: "disconnected" | "connected";
}

interface ToastMessage {
  message: string;
  type: "success" | "warning" | "error" | "info";
}

interface SystemStatusContextType {
  status: SystemStatus;
  setCameraStatus: (s: SystemStatus["camera"]) => void;
  setHandTrackingStatus: (s: SystemStatus["handTracking"]) => void;
  setWebsocketStatus: (s: SystemStatus["websocket"]) => void;
  setBackendStatus: (s: SystemStatus["backend"]) => void;
  setDatabaseStatus: (s: SystemStatus["database"]) => void;
  toast: ToastMessage | null;
  showToast: (msg: string, type?: ToastMessage["type"]) => void;
}

const SystemStatusContext = createContext<SystemStatusContextType | undefined>(undefined);

export function SystemStatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SystemStatus>({
    camera: "off",
    handTracking: "inactive",
    websocket: "disconnected",
    backend: "offline",
    database: "disconnected",
  });

  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Monitor backend and database health check status
  const checkHealth = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const resp = await fetch(`${apiUrl}/api/health`);
      if (resp.ok) {
        const data = await resp.json();
        setStatus((prev) => ({
          ...prev,
          backend: "online",
          database: data.database === "connected" ? "connected" : "disconnected",
        }));
      } else {
        setStatus((prev) => ({ ...prev, backend: "offline", database: "disconnected" }));
      }
    } catch {
      setStatus((prev) => ({ ...prev, backend: "offline", database: "disconnected" }));
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 8000);
    return () => clearInterval(interval);
  }, []);

  const setCameraStatus = (s: SystemStatus["camera"]) => {
    setStatus((prev) => ({ ...prev, camera: s }));
  };

  const setHandTrackingStatus = (s: SystemStatus["handTracking"]) => {
    setStatus((prev) => ({ ...prev, handTracking: s }));
  };

  const setWebsocketStatus = (s: SystemStatus["websocket"]) => {
    setStatus((prev) => ({ ...prev, websocket: s }));
  };

  const setBackendStatus = (s: SystemStatus["backend"]) => {
    setStatus((prev) => ({ ...prev, backend: s }));
  };

  const setDatabaseStatus = (s: SystemStatus["database"]) => {
    setStatus((prev) => ({ ...prev, database: s }));
  };

  const showToast = (message: string, type: ToastMessage["type"] = "info") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  return (
    <SystemStatusContext.Provider
      value={{
        status,
        setCameraStatus,
        setHandTrackingStatus,
        setWebsocketStatus,
        setBackendStatus,
        setDatabaseStatus,
        toast,
        showToast,
      }}
    >
      {children}
    </SystemStatusContext.Provider>
  );
}

export function useSystemStatus() {
  const context = useContext(SystemStatusContext);
  if (!context) {
    throw new Error("useSystemStatus must be used within SystemStatusProvider");
  }
  return context;
}
