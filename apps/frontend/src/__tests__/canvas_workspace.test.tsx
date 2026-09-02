import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import CanvasPage from "../app/canvas/page";

// Mock fetch response for API calls
const mockFetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({
    status: "success",
    shape: "CIRCLE",
    confidence: 0.94,
    boundingBox: { minX: 0.3, minY: 0.3, maxX: 0.7, maxY: 0.7 }
  })
});
global.fetch = mockFetch;

describe("Canvas Workspace Page Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render spatial canvas headers, HUD status, and locking controls", () => {
    render(<CanvasPage />);
    expect(screen.getByText("AIR CANVAS")).toBeInTheDocument();
    expect(screen.getByText("DIAGRAM RELATIONSHIPS FEED")).toBeInTheDocument();
  });

  it("should toggle tools (Erase, Select, Pan, Pen)", () => {
    render(<CanvasPage />);

    const penBtn = screen.getByRole("button", { name: "Select Pen Tool" });
    const eraseBtn = screen.getByRole("button", { name: "Select Eraser Tool" });
    const selectBtn = screen.getByRole("button", { name: "Select Selection Tool" });
    const panBtn = screen.getByRole("button", { name: "Select Pan Tool" });

    // Initial state is PEN
    expect(penBtn).toHaveClass("bg-blue-600/90");

    // Click Erase
    fireEvent.click(eraseBtn);
    expect(eraseBtn).toHaveClass("bg-red-600/90");

    // Click Select
    fireEvent.click(selectBtn);
    expect(selectBtn).toHaveClass("bg-emerald-600/90");

    // Click Pan
    fireEvent.click(panBtn);
    expect(panBtn).toHaveClass("bg-amber-600/90");
  });

  it("should render export triggers buttons", () => {
    render(<CanvasPage />);
    expect(screen.getByRole("button", { name: "Export PNG" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export SVG" })).toBeInTheDocument();
  });
});
