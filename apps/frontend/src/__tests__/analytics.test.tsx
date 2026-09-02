import React from "react";
import { render, screen } from "@testing-library/react";
import AnalyticsDashboardPage from "../app/analytics/page";

// Mock fetch response for API calls
const mockFetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({
    status: "success",
    overview: {
      total_sessions: 1,
      total_events: 10,
      avg_duration: 120,
      avg_confidence: 0.95,
      avg_fps: 30,
      avg_latency: 15,
      most_used_gesture: "PINCH",
      gesture_distribution: { "PINCH": 10 },
      correction_rate: 0.1,
      accuracy: 0.9,
      module_usage: {
        canvas_saves: 2,
        math_solves: 3
      }
    },
    sessions: [
      {
        id: 1,
        session_uuid: "test-uuid-000",
        created_at: "2026-08-30T10:00:00Z",
        duration: 120,
        gesture_count: 10,
        writing_count: 2,
        canvas_count: 1,
        math_count: 1
      }
    ],
    timeline: [
      {
        type: "gesture",
        title: "Gesture Detected: PINCH",
        description: "Confidence: 0.95",
        timestamp: "2026-08-30T10:05:00Z"
      }
    ]
  })
});
global.fetch = mockFetch;

describe("Analytics Dashboard Page Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render metrics overview grid cards and history tables", async () => {
    render(<AnalyticsDashboardPage />);
    
    // Test initial loader state or final state depending on resolves
    expect(screen.getByText("Loading system metrics dashboard...")).toBeInTheDocument();
    
    // Resolve promise and verify UI elements render
    const heading = await screen.findByText("SYSTEM ANALYTICS");
    expect(heading).toBeInTheDocument();
    expect(screen.getByText("Total Sessions:")).toBeInTheDocument();
    expect(screen.getByText("Session History details")).toBeInTheDocument();
  });
});
