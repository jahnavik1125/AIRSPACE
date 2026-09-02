import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SpatialTeachingWorkspace } from "../components/camera/SpatialTeachingWorkspace";

// Mock MediaStream and MediaRecorder in Jest environment
class MockMediaStream {
  tracks: any[] = [];
  getTracks() { return this.tracks; }
  getVideoTracks() { return []; }
  getAudioTracks() { return []; }
  addTrack(t: any) { this.tracks.push(t); }
}
(global as any).MediaStream = MockMediaStream;

class MockMediaRecorder {
  state = "inactive";
  start = jest.fn();
  stop = jest.fn();
  pause = jest.fn();
  resume = jest.fn();
  ondataavailable = null;
  onstop = null;
  static isTypeSupported = jest.fn().mockReturnValue(true);
}
(global as any).MediaRecorder = MockMediaRecorder;

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
    translate: jest.fn(),
    drawImage: jest.fn(),
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

  HTMLCanvasElement.prototype.toDataURL = jest.fn().mockReturnValue("data:image/png;base64,mockImageData");
  HTMLCanvasElement.prototype.captureStream = jest.fn().mockReturnValue(new MockMediaStream());
});

describe("AIRSPACE Spatial Teaching Workspace Component", () => {
  it("should render top bar with branding and Camera status indicator", () => {
    render(<SpatialTeachingWorkspace />);
    expect(screen.getByText("AIRSPACE")).toBeInTheDocument();
    expect(screen.getAllByText(/CAMERA/i).length).toBeGreaterThan(0);
  });

  it("should render floating toolbar with Write / Shapes switcher, Snapshot, and Record buttons", () => {
    render(<SpatialTeachingWorkspace />);
    expect(screen.getByRole("button", { name: /Write/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Shapes/i })).toBeInTheDocument();
    expect(screen.getByTitle(/Take Snapshot/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Start Recording/i)).toBeInTheDocument();
  });

  it("should render small floating Live Transcription display in Write mode", () => {
    render(<SpatialTeachingWorkspace />);
    expect(screen.getByText("LIVE TRANSCRIPTION")).toBeInTheDocument();
    expect(screen.getByText("a² + b² = c²")).toBeInTheDocument();
  });

  it("should switch to Shapes mode and disable writing transcription", () => {
    render(<SpatialTeachingWorkspace />);
    const shapesBtn = screen.getByRole("button", { name: /Shapes/i });

    fireEvent.click(shapesBtn);

    // Shapes HUD is visible
    expect(screen.getByText("SPATIAL SHAPES")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Triangle/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Quad/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Circle/i })).toBeInTheDocument();

    // Writing transcription panel is removed
    expect(screen.queryByText("LIVE TRANSCRIPTION")).not.toBeInTheDocument();
  });

  it("should trigger snapshot without error", () => {
    render(<SpatialTeachingWorkspace />);
    const snapBtn = screen.getByTitle(/Take Snapshot/i);
    expect(() => fireEvent.click(snapBtn)).not.toThrow();
  });

  it("should render Undo, Redo, and Clear controls in Write mode", () => {
    render(<SpatialTeachingWorkspace />);
    expect(screen.getByTitle(/Undo/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Redo/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Clear Writing/i)).toBeInTheDocument();
  });
});
