"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSystemStatus } from "../../context/SystemStatusContext";
import {
  LayoutDashboard,
  PenTool,
  Palette,
  Calculator,
  BrainCircuit,
  BarChart3,
  Settings,
  Menu,
  X,
  Radio,
  Activity,
  Server,
  Database,
  Camera
} from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const { status } = useSystemStatus();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { label: "Overview", href: "/app", icon: LayoutDashboard },
    { label: "Air Write", href: "/air-write", icon: PenTool },
    { label: "Air Canvas", href: "/canvas", icon: Palette },
    { label: "Math Mode", href: "/math", icon: Calculator },
    { label: "AI Lab", href: "/ai-lab", icon: BrainCircuit },
    { label: "Analytics", href: "/analytics", icon: BarChart3 },
    { label: "Settings", href: "/settings", icon: Settings }
  ];

  const getStatusColor = (val: string) => {
    switch (val) {
      case "active":
      case "connected":
      case "online":
        return "bg-emerald-500 text-emerald-400";
      case "loading":
      case "connecting":
        return "bg-amber-500 text-amber-400 animate-pulse";
      case "error":
      case "off":
      case "inactive":
      case "offline":
      case "disconnected":
      default:
        return "bg-red-500 text-red-500";
    }
  };

  const getStatusLabel = (val: string) => {
    switch (val) {
      case "active": return "Active";
      case "connected": return "Connected";
      case "online": return "Online";
      case "loading": return "Loading";
      case "connecting": return "Connecting";
      case "off": return "Off";
      case "inactive": return "Inactive";
      case "offline": return "Offline";
      case "disconnected": return "Disconnected";
      default: return val;
    }
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[#0b0f19] border-r border-gray-800 w-64 text-gray-400 p-5 select-none z-40">
      {/* Brand logo */}
      <div className="mb-8 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white font-mono shadow-[0_0_15px_rgba(37,99,235,0.4)]">
          A
        </div>
        <div>
          <span className="text-white font-extrabold text-sm tracking-wider font-mono">AIRSPACE</span>
          <span className="text-[9px] text-gray-500 block uppercase font-bold tracking-widest leading-none mt-0.5">Control Center</span>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 space-y-1.5">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/app" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition ${
                active
                  ? "bg-blue-600 text-white font-bold shadow-[0_4px_12px_rgba(37,99,235,0.2)]"
                  : "hover:bg-gray-900 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Global System status tracker */}
      <div className="border-t border-gray-800/80 pt-5 space-y-3 font-mono text-[9px] uppercase tracking-wider text-gray-500">
        <span className="font-bold text-gray-400 block pb-1">System Health Status</span>

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Camera className="h-3 w-3" />
            <span>Camera</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(status.camera)}`}></span>
            <span className="text-[8px] font-bold text-gray-400">{getStatusLabel(status.camera)}</span>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Activity className="h-3 w-3" />
            <span>Hand Track</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(status.handTracking)}`}></span>
            <span className="text-[8px] font-bold text-gray-400">{getStatusLabel(status.handTracking)}</span>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Radio className="h-3 w-3" />
            <span>Websocket</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(status.websocket)}`}></span>
            <span className="text-[8px] font-bold text-gray-400">{getStatusLabel(status.websocket)}</span>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Server className="h-3 w-3" />
            <span>Backend</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(status.backend)}`}></span>
            <span className="text-[8px] font-bold text-gray-400">{getStatusLabel(status.backend)}</span>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Database className="h-3 w-3" />
            <span>Database</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(status.database)}`}></span>
            <span className="text-[8px] font-bold text-gray-400">{getStatusLabel(status.database)}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:block h-screen sticky top-0 flex-shrink-0">
        <SidebarContent />
      </div>

      {/* Mobile Header Menu Trigger */}
      <div className="lg:hidden bg-[#0f172a] border-b border-gray-800 p-4 flex justify-between items-center z-40 sticky top-0 w-full">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center font-bold text-white text-[10px] font-mono">
            A
          </div>
          <span className="text-white font-extrabold text-xs tracking-wider font-mono">AIRSPACE</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-1.5 rounded bg-gray-900 border border-gray-850 text-gray-400 hover:text-white"
          aria-label="Toggle Mobile Menu"
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)}></div>
          <div className="relative flex flex-col h-full animate-slide-in">
            <SidebarContent />
          </div>
        </div>
      )}
    </>
  );
}
