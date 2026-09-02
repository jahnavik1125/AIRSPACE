import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SpatialWhiteboard } from "../components/whiteboard/SpatialWhiteboard";
import { recognizeShape, Point } from "../utils/shapeRecognizer";

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
    setLineDash: jest.fn()
  }) as any;
});

describe("AIRSPACE Spatial Whiteboard Component", () => {
  it("should render top header bar with branding and camera indicators", () => {
    render(<SpatialWhiteboard />);
    expect(screen.getByText("AIRSPACE")).toBeInTheDocument();
    expect(screen.getByText("Whiteboard")).toBeInTheDocument();
    expect(screen.getByText("Write, erase and draw in the air")).toBeInTheDocument();
  });

  it("should render floating glass toolbar with Pen, Eraser, Shapes, Undo, Redo, Clear, Save", () => {
    render(<SpatialWhiteboard />);
    expect(screen.getByTitle(/Pen Tool/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Eraser/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Snap hand-drawn/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Undo/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Redo/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Clear Whiteboard/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Download Whiteboard as PNG/i)).toBeInTheDocument();
  });

  it("should toggle tools and shape snapping", () => {
    render(<SpatialWhiteboard />);
    const penBtn = screen.getByTitle(/Pen Tool/i);
    const eraserBtn = screen.getByTitle(/Eraser/i);
    const shapesBtn = screen.getByTitle(/Snap hand-drawn/i);

    // Initial state: Pen active, Shapes ON
    expect(penBtn).toHaveClass("bg-blue-600");
    expect(screen.getByText("ON")).toBeInTheDocument();

    // Select Eraser
    fireEvent.click(eraserBtn);
    expect(eraserBtn).toHaveClass("bg-red-600");

    // Toggle Shapes OFF
    fireEvent.click(shapesBtn);
    expect(screen.getByText("OFF")).toBeInTheDocument();
  });

  it("should render Hand Tracking HUD with Active indicator and detected count", () => {
    render(<SpatialWhiteboard />);
    expect(screen.getByText("Hand Tracking")).toBeInTheDocument();
    expect(screen.getByText("0 detected")).toBeInTheDocument();
    expect(screen.getByText("Mode")).toBeInTheDocument();
  });
});

describe("Geometric Shape Recognizer Engine", () => {
  it("should recognize straight line", () => {
    const linePoints: Point[] = [
      { x: 10, y: 10 },
      { x: 50, y: 10 },
      { x: 100, y: 10 },
      { x: 150, y: 10 },
      { x: 200, y: 10 }
    ];
    const res = recognizeShape(linePoints);
    expect(res.type).toBe("LINE");
    expect(res.confidence).toBeGreaterThan(0.7);
  });

  it("should recognize rough circle", () => {
    const circlePoints: Point[] = [];
    const radius = 50;
    const cx = 100;
    const cy = 100;
    for (let i = 0; i <= 36; i++) {
      const angle = (i / 36) * Math.PI * 2;
      circlePoints.push({
        x: cx + radius * Math.cos(angle) + (Math.random() - 0.5) * 2,
        y: cy + radius * Math.sin(angle) + (Math.random() - 0.5) * 2
      });
    }
    const res = recognizeShape(circlePoints);
    expect(res.type).toBe("CIRCLE");
    expect(res.confidence).toBeGreaterThan(0.7);
  });

  it("should recognize rectangle", () => {
    const rectPoints: Point[] = [
      { x: 50, y: 50 },
      { x: 150, y: 50 },
      { x: 150, y: 120 },
      { x: 50, y: 120 },
      { x: 50, y: 50 }
    ];
    const res = recognizeShape(rectPoints);
    expect(res.type).toBe("RECTANGLE");
    expect(res.confidence).toBeGreaterThan(0.7);
  });
});
