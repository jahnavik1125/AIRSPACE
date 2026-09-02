import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { CameraFeed } from "../components/camera/CameraFeed";
import { useCamera } from "../hooks/useCamera";
import { renderHook } from "@testing-library/react";

// Mock video element play method
const mockPlay = jest.fn().mockResolvedValue(undefined);
Object.defineProperty(HTMLVideoElement.prototype, 'play', {
  value: mockPlay,
  writable: true
});

describe("CameraFeed Component & useCamera Hook", () => {
  const mockStart = jest.fn();
  const mockStop = jest.fn();
  const mockSwitch = jest.fn();
  const videoRef = React.createRef<HTMLVideoElement>();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render Offline placeholder when status is OFF", () => {
    render(
      <CameraFeed
        videoRef={videoRef}
        status="OFF"
        devices={[]}
        activeDeviceId={null}
        error={null}
        startCamera={mockStart}
        stopCamera={mockStop}
        switchCamera={mockSwitch}
      />
    );

    expect(screen.getByText("Camera is Offline")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Camera Feed" })).toBeInTheDocument();

    // Clicking enable trigger startCamera
    fireEvent.click(screen.getByRole("button", { name: "Start Camera Feed" }));
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it("should render Loading screen when status is REQUESTING", () => {
    render(
      <CameraFeed
        videoRef={videoRef}
        status="REQUESTING"
        devices={[]}
        activeDeviceId={null}
        error={null}
        startCamera={mockStart}
        stopCamera={mockStop}
        switchCamera={mockSwitch}
      />
    );

    expect(screen.getByText("Requesting Access")).toBeInTheDocument();
  });

  it("should render Error screen with retry button when status is ERROR", () => {
    render(
      <CameraFeed
        videoRef={videoRef}
        status="ERROR"
        devices={[]}
        activeDeviceId={null}
        error="Permission denied by user"
        startCamera={mockStart}
        stopCamera={mockStop}
        switchCamera={mockSwitch}
      />
    );

    expect(screen.getByText("Camera Error")).toBeInTheDocument();
    expect(screen.getByText("Permission denied by user")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry Connection" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry Connection" }));
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it("should render Video player and turn-off button when status is ACTIVE", () => {
    const mockDevices = [
      { deviceId: "cam-1", label: "Front Camera", kind: "videoinput" } as MediaDeviceInfo
    ];

    render(
      <CameraFeed
        videoRef={videoRef}
        status="ACTIVE"
        devices={mockDevices}
        activeDeviceId="cam-1"
        error={null}
        startCamera={mockStart}
        stopCamera={mockStop}
        switchCamera={mockSwitch}
      />
    );

    expect(screen.getByRole("button", { name: "Disable Camera Feed" })).toBeInTheDocument();
    
    fireEvent.click(screen.getByRole("button", { name: "Disable Camera Feed" }));
    expect(mockStop).toHaveBeenCalledTimes(1);
  });

  it("should check camera switch select options", () => {
    const mockDevices = [
      { deviceId: "cam-1", label: "Webcam 1", kind: "videoinput" } as MediaDeviceInfo,
      { deviceId: "cam-2", label: "Webcam 2", kind: "videoinput" } as MediaDeviceInfo
    ];

    render(
      <CameraFeed
        videoRef={videoRef}
        status="ACTIVE"
        devices={mockDevices}
        activeDeviceId="cam-1"
        error={null}
        startCamera={mockStart}
        stopCamera={mockStop}
        switchCamera={mockSwitch}
      />
    );

    const select = screen.getByRole("combobox", { name: "Select Video Source Device" });
    expect(select).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Webcam 1" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Webcam 2" })).toBeInTheDocument();

    fireEvent.change(select, { target: { value: "cam-2" } });
    expect(mockSwitch).toHaveBeenCalledWith("cam-2");
  });

  it("should assert useCamera initial hook states", () => {
    const { result } = renderHook(() => useCamera());
    expect(result.current.status).toBe("OFF");
    expect(result.current.activeDeviceId).toBeNull();
    expect(result.current.devices).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
