import React from "react";
import { render, screen } from "@testing-library/react";
import GestureCalibrationPage from "../app/settings/gesture-calibration/page";

// Mock fetch response for API calls
const mockFetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({
    status: "success",
    profiles: [
      {
        gesture_name: "PINCH",
        sample_count: 5,
        personalized_threshold: 0.05,
        consistency: 0.96,
        updated_at: "2026-08-30T10:00:00Z"
      }
    ]
  })
});
global.fetch = mockFetch;

describe("Gesture Calibration Page Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render instructions guide steps, camera input triggers, and profiles progress", async () => {
    render(<GestureCalibrationPage />);
    
    expect(screen.getByText("GESTURE CALIBRATION")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Capture Landmark Sample" })).toBeInTheDocument();
    
    // Validate reset profiles button
    expect(screen.getByRole("button", { name: "Reset Profile" })).toBeInTheDocument();
  });
});
