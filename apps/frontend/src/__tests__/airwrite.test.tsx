import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import AirWritePage from "../app/air-write/page";

// Mock useHandTracking hook to prevent async MediaPipe load errors in Jest/JSDOM
jest.mock("../hooks/useHandTracking", () => ({
  useHandTracking: jest.fn().mockReturnValue({
    hands: [],
    fps: 30,
    latency: 5,
    error: null
  })
}));

// Mock fetch response for API calls
const mockFetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({
    db_writing_session_id: 201,
    predicted_character: "M",
    confidence: 0.92,
    top_predictions: [["M", 0.92], ["N", 0.05], ["W", 0.02]]
  })
});
global.fetch = mockFetch;

describe("AirWrite Page Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render locking overlays and lock canvas when writing is disabled", () => {
    render(<AirWritePage />);
    expect(screen.getByText("Canvas Locked")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Writing" })).toBeInTheDocument();
  });

  it("should render drawing components and unlock canvas when writing is toggled", () => {
    render(<AirWritePage />);
    
    const toggleBtn = screen.getByRole("button", { name: "Start Writing" });
    fireEvent.click(toggleBtn);

    expect(screen.queryByText("Canvas Locked")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Writing Active" })).toBeInTheDocument();
  });

  it("should handle notepad actions (space, delete, clear)", () => {
    render(<AirWritePage />);
    
    // Check initial notepad placeholder text
    expect(screen.getByText("Notepad empty...")).toBeInTheDocument();

    const spaceBtn = screen.getByRole("button", { name: "Insert Space" });
    const deleteBtn = screen.getByRole("button", { name: "Delete Last Character" });
    const clearBtn = screen.getByRole("button", { name: "Clear Notepad Content" });

    // Insert Space
    fireEvent.click(spaceBtn);
    expect(screen.queryByText("Notepad empty...")).not.toBeInTheDocument();

    // Delete
    fireEvent.click(deleteBtn);
    expect(screen.getByText("Notepad empty...")).toBeInTheDocument();
  });

  it("should render two-hand workspace options, left/right tabs, and custom recognize buttons", () => {
    render(<AirWritePage />);
    
    // Check for Both Hands, Left Hand, and Right Hand text indicators
    expect(screen.getByText("Both Hands")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Left Hand" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Right Hand" })).toBeInTheDocument();
    
    // Check for auto-recognize label
    expect(screen.getByLabelText(/Auto Recognize/i)).toBeInTheDocument();
    
    // Tabs select check
    const leftTab = screen.getByRole("button", { name: "Left Hand" });
    const rightTab = screen.getByRole("button", { name: "Right Hand" });
    
    // Click Left Tab
    fireEvent.click(leftTab);
    expect(screen.getByRole("button", { name: "Recognize Left Hand" })).toBeInTheDocument();
    expect(screen.getByText("LEFT HAND BUFFER")).toBeInTheDocument();

    // Click Right Tab
    fireEvent.click(rightTab);
    expect(screen.getByRole("button", { name: "Recognize Right Hand" })).toBeInTheDocument();
    expect(screen.getByText("RIGHT HAND BUFFER")).toBeInTheDocument();
  });
});
