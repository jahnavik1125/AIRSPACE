"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { useSystemStatus } from "../../context/SystemStatusContext";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

export function AppLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { toast } = useSystemStatus();
  const isLanding = pathname === "/";

  const getToastIcon = (type: string) => {
    switch (type) {
      case "success": return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case "warning": return <AlertCircle className="h-4 w-4 text-amber-400" />;
      case "error": return <AlertCircle className="h-4 w-4 text-red-400" />;
      case "info":
      default: return <Info className="h-4 w-4 text-blue-400" />;
    }
  };

  const getToastBg = (type: string) => {
    switch (type) {
      case "success": return "bg-emerald-950/80 border-emerald-900/50 text-emerald-300";
      case "warning": return "bg-amber-950/80 border-amber-900/50 text-amber-300";
      case "error": return "bg-red-950/80 border-red-900/50 text-red-300";
      case "info":
      default: return "bg-blue-950/80 border-blue-900/50 text-blue-300";
    }
  };

  return (
    <div className="min-h-screen bg-[#05070c] text-white flex flex-col selection:bg-blue-500/30">
      {children}

      {/* Global Toast Feedbacks */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border backdrop-blur-md shadow-lg font-mono text-[10px] uppercase font-bold tracking-wider ${getToastBg(toast.type)}`}>
          {getToastIcon(toast.type)}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
