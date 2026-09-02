import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { SpatialCanvas } from "../components/spatial/SpatialCanvas";

describe("SpatialCanvas Component", () => {
  const lastInstanceMock = {
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render Canvas Offline overlay when disconnected", () => {
    render(<SpatialCanvas lastGesture={null} connected={false} />);
    expect(screen.getByText("Canvas Offline")).toBeInTheDocument();
    expect(screen.getByText("Connect backend WebSockets to enable touchless drawing capabilities.")).toBeInTheDocument();
  });

  it("should render active drawing board when connected", () => {
    render(<SpatialCanvas lastGesture={null} connected={true} />);
    expect(screen.queryByText("Canvas Offline")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Clear Canvas Drawings")).toBeInTheDocument();
  });

  it("should handle drawing state transitions and brush changes", () => {
    // 1. Mount canvas
    const { container, rerender } = render(
      <SpatialCanvas
        lastGesture={{ gesture: "INDEX_POINT", coordinates: { x: 0.5, y: 0.5 }, state: "HOVER" }}
        connected={true}
      />
    );

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();

    // 2. Start Pinch -> PINCH_START
    rerender(
      <SpatialCanvas
        lastGesture={{ gesture: "PINCH", coordinates: { x: 0.5, y: 0.5 }, state: "PINCH_START" }}
        connected={true}
      />
    );

    // 3. Pinch Drag -> PINCH_HOLD
    rerender(
      <SpatialCanvas
        lastGesture={{ gesture: "PINCH", coordinates: { x: 0.6, y: 0.6 }, state: "PINCH_HOLD" }}
        connected={true}
      />
    );

    // 4. Release Pinch -> PINCH_END
    rerender(
      <SpatialCanvas
        lastGesture={{ gesture: "PINCH", coordinates: { x: 0.6, y: 0.6 }, state: "PINCH_END" }}
        connected={true}
      />
    );

    // Clear Canvas should trigger redraw cleanup
    const clearBtn = screen.getByLabelText("Clear Canvas Drawings");
    fireEvent.click(clearBtn);
  });
});
