import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import AILabWorkspacePage from "../app/ai-lab/page";

describe("AI Lab Workspace Page Component", () => {
  it("should render chat screens, context aggregator parameters, and mic triggers", () => {
    render(<AILabWorkspacePage />);
    expect(screen.getByText("AI LAB")).toBeInTheDocument();
    expect(screen.getByText("Interaction Context")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Speech command button" })).toBeInTheDocument();
  });
});
