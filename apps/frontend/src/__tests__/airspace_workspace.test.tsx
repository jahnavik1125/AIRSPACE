import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { AirspaceWorkspace } from "../components/camera/AirspaceWorkspace";

// Mock MediaStream and MediaRecorder
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

describe("AIRSPACE Definitive Workspace Component", () => {
  it("should render top bar with Camera On, Mode Switcher, Theme Toggle, and Timer", () => {
    render(<AirspaceWorkspace />);
    expect(screen.getAllByText(/Camera On|Offline/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Write" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Shapes" })).toBeInTheDocument();
    expect(screen.getByTitle(/Switch to Light Mode/i)).toBeInTheDocument();
    expect(screen.getByText("00:00:00")).toBeInTheDocument();
  });

  it("should render compact vertical tool dock with Pen, Eraser, Style, Color, Size, Effects, Undo, Redo, and Clear", () => {
    render(<AirspaceWorkspace />);
    expect(screen.getByTitle(/Pen Tool/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Eraser/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Pen Style/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Color Palette & Picker/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Stroke Size & Width/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Visual Ink Effects/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Undo/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Redo/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Clear Board/i)).toBeInTheDocument();
  });

  it("should open style popover when Pen Style button is clicked", () => {
    render(<AirspaceWorkspace />);
    const styleBtn = screen.getByTitle(/Pen Style/i);

    fireEvent.click(styleBtn);
    expect(screen.getByText("Marker")).toBeInTheDocument();
    expect(screen.getByText("Brush")).toBeInTheDocument();
    expect(screen.getByText("Neon Ink")).toBeInTheDocument();
    expect(screen.getByText("Glow Pen")).toBeInTheDocument();
  });

  it("should open size popover with continuous slider when Size button is clicked", () => {
    render(<AirspaceWorkspace />);
    const sizeBtn = screen.getByTitle(/Stroke Size & Width/i);

    fireEvent.click(sizeBtn);
    expect(screen.getAllByText("Stroke Size").length).toBeGreaterThan(0);
    expect(screen.getByText("12px")).toBeInTheDocument();
    expect(screen.getByText("Opacity")).toBeInTheDocument();
  });

  it("should toggle between Write and Shapes mode without lock-shapes button", () => {
    render(<AirspaceWorkspace />);
    const shapesBtn = screen.getByRole("button", { name: "Shapes" });
    const writeBtn = screen.getByRole("button", { name: "Write" });

    fireEvent.click(shapesBtn);
    expect(screen.getByText("Confirm Shape")).toBeInTheDocument();
    expect(screen.queryByText(/Lock Shapes/i)).not.toBeInTheDocument();

    fireEvent.click(writeBtn);
    expect(screen.queryByText("Confirm Shape")).not.toBeInTheDocument();
  });

  it("should open 3D Interactive Demo modal showing two-finger write", () => {
    render(<AirspaceWorkspace />);
    const demoBtn = screen.getByTitle(/How It Works/i);

    fireEvent.click(demoBtn);
    expect(screen.getByText("Interactive 3D Walkthrough")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Two-Finger Write/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Shapes Demo/i })).toBeInTheDocument();
  });

  it("should render minimal bottom action bar with Snapshot, Record, and Pause buttons", () => {
    render(<AirspaceWorkspace />);
    expect(screen.getByTitle(/Take Snapshot/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Start Recording/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Pause Recording/i)).toBeInTheDocument();
  });
});
