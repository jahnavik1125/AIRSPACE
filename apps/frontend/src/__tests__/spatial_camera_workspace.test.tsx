import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SpatialCameraWorkspace } from "../components/camera/SpatialCameraWorkspace";

// Mock canvas getContext
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
    clearRect: jest.fn(),
    fillRect: jest.fn(),
    beginPath: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    stroke: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    quadraticCurveTo: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    scale: jest.fn(),
    fillText: jest.fn(),
    createRadialGradient: jest.fn().mockReturnValue({
      addColorStop: jest.fn()
    }),
    createLinearGradient: jest.fn().mockReturnValue({
      addColorStop: jest.fn()
    }),
    setLineDash: jest.fn(),
    closePath: jest.fn()
  }) as any;
});

describe("AIRSPACE Spatial Camera Workspace Component", () => {
  it("should render top bar with AIRSPACE branding and Camera status indicator", () => {
    render(<SpatialCameraWorkspace />);
    expect(screen.getByText("AIRSPACE")).toBeInTheDocument();
    expect(screen.getAllByText(/Camera/i).length).toBeGreaterThan(0);
  });

  it("should render floating toolbar with Write and Shapes mode switcher", () => {
    render(<SpatialCameraWorkspace />);
    expect(screen.getByRole("button", { name: /Write/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Shapes/i })).toBeInTheDocument();
  });

  it("should render floating writing recognition panel in Write mode", () => {
    render(<SpatialCameraWorkspace />);
    expect(screen.getByText("Writing Recognition")).toBeInTheDocument();
    expect(screen.getByText("Point index in air to write...")).toBeInTheDocument();
  });

  it("should switch to Shapes mode and disable writing panel and ink tools", () => {
    render(<SpatialCameraWorkspace />);
    const shapesBtn = screen.getByRole("button", { name: /Shapes/i });

    fireEvent.click(shapesBtn);

    // Shapes HUD is visible
    expect(screen.getByText("Spatial Hand Geometry")).toBeInTheDocument();
    expect(screen.getByText("Multi-Fingertip Laser Web")).toBeInTheDocument();

    // Writing recognition panel is disabled and removed from screen
    expect(screen.queryByText("Writing Recognition")).not.toBeInTheDocument();
    expect(screen.queryByText("Point index in air to write...")).not.toBeInTheDocument();
  });

  it("should switch back to Write mode and re-enable writing panel and ink tools", () => {
    render(<SpatialCameraWorkspace />);
    const shapesBtn = screen.getByRole("button", { name: /Shapes/i });
    const writeBtn = screen.getByRole("button", { name: /Write/i });

    fireEvent.click(shapesBtn);
    expect(screen.queryByText("Writing Recognition")).not.toBeInTheDocument();

    fireEvent.click(writeBtn);
    expect(screen.getByText("Writing Recognition")).toBeInTheDocument();
    expect(screen.getByTitle(/Clear Writing/i)).toBeInTheDocument();
  });

  it("should render Snapshot button in both modes", () => {
    render(<SpatialCameraWorkspace />);
    expect(screen.getByTitle(/Save Snapshot PNG/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Shapes/i }));
    expect(screen.getByTitle(/Save Snapshot PNG/i)).toBeInTheDocument();
  });
});
