import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Sidebar } from "../components/navigation/Sidebar";
import AppDashboardPage from "../app/app/page";
import SettingsPage from "../app/settings/page";

// Mock router pathnames
const mockUsePathname = jest.fn().mockReturnValue("/app");
jest.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ push: jest.fn() })
}));

// Mock SystemStatus Context
const mockShowToast = jest.fn();
const mockContextValue = {
  status: {
    camera: "active",
    handTracking: "active",
    websocket: "connected",
    backend: "online",
    database: "connected"
  },
  setCameraStatus: jest.fn(),
  setHandTrackingStatus: jest.fn(),
  setWebsocketStatus: jest.fn(),
  setBackendStatus: jest.fn(),
  setDatabaseStatus: jest.fn(),
  toast: null,
  showToast: mockShowToast
};

jest.mock("../context/SystemStatusContext", () => ({
  useSystemStatus: () => mockContextValue
}));

jest.mock("../hooks/useSpatialWebSocket", () => ({
  useSpatialWebSocket: () => ({
    dbSessionId: 1,
    connected: true,
    sendMessage: jest.fn()
  })
}));

describe("Product Integration Navigation & Dashboard tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "success",
        overview: {
          total_sessions: 5,
          total_events: 100,
          avg_duration: 300,
          avg_confidence: 0.94,
          avg_fps: 29.5,
          avg_latency: 18,
          most_used_gesture: "PINCH",
          module_usage: {
            canvas_saves: 4,
            math_solves: 6
          }
        }
      })
    });
  });

  it("should render Sidebar with all workspace navigation items", () => {
    render(<Sidebar />);
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Air Write")).toBeInTheDocument();
    expect(screen.getByText("Air Canvas")).toBeInTheDocument();
    expect(screen.getByText("Math Mode")).toBeInTheDocument();
    expect(screen.getByText("AI Lab")).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("should render AppDashboard launch cards and system badges", async () => {
    render(<AppDashboardPage />);
    const heading = await screen.findByText("WORKSPACE OVERVIEW");
    expect(heading).toBeInTheDocument();
    expect(screen.getByText("Launch Workspaces")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Air Write" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Air Canvas" })).toBeInTheDocument();
  });

  it("should render Settings options and wipe confirmation prompts", () => {
    window.confirm = jest.fn().mockReturnValue(true);
    // uses global.fetch mock from beforeEach

    render(<SettingsPage />);
    expect(screen.getByText("SYSTEM SETTINGS")).toBeInTheDocument();
    expect(screen.getByText("Delete Session & Analytics History")).toBeInTheDocument();

    const purgeButton = screen.getByRole("button", { name: "Purge History" });
    fireEvent.click(purgeButton);
    expect(window.confirm).toHaveBeenCalled();
  });
});
