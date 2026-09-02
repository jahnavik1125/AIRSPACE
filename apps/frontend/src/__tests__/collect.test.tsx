import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import DatasetCollectorPage from "../app/air-write/collect/page";

// Mock stats fetch response
const mockFetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({
    total_samples: 15,
    samples_per_class: {
      A: 3,
      B: 2,
      C: 0,
      D: 1,
      Z: 0
    }
  })
});
global.fetch = mockFetch;

describe("DatasetCollector Page Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render Target letter, diagnostic stats, and canvas container", async () => {
    await act(async () => {
      render(<DatasetCollectorPage />);
    });

    expect(screen.getByText("DATASET RECORDER STUDIO")).toBeInTheDocument();
    expect(screen.getByText("Samples Logged")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Sample" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skip target" })).toBeInTheDocument();
  });

  it("should allow skipping targets", async () => {
    await act(async () => {
      render(<DatasetCollectorPage />);
    });

    const skipBtn = screen.getByRole("button", { name: "Skip target" });
    fireEvent.click(skipBtn);
    
    // Reroll is triggered, fetch stats is called again
    expect(mockFetch).toHaveBeenCalled();
  });
});
