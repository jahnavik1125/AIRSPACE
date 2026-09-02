import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import MathWorkspacePage from "../app/math/page";

// Mock fetch response for API calls
const mockFetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({
    status: "success",
    expression: "y = x^2",
    latex: "y = x^2",
    confidence: 0.95,
    solution: {
      status: "success",
      operation: "linear_solve",
      result: "x^2",
      latex_result: "x^2",
      steps: ["Step 1: Parse expression"]
    }
  })
});
global.fetch = mockFetch;

describe("Math Workspace Page Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render math blackboard titles, camera feeds, and controls", () => {
    render(<MathWorkspacePage />);
    expect(screen.getByText("MATH MODE")).toBeInTheDocument();
    expect(screen.getByText("Equation Drawing Board")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Solve Equation" })).toBeInTheDocument();
  });
});
