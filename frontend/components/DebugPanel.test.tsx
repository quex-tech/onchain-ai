import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DebugPanel } from "./DebugPanel";

describe("DebugPanel", () => {
  it("renders logs", () => {
    const logs = ["[ChatOracle] Log 1", "[ChatOracle] Log 2"];
    render(<DebugPanel logs={logs} onCopy={() => {}} />);

    expect(screen.getByText("[ChatOracle] Log 1")).toBeInTheDocument();
    expect(screen.getByText("[ChatOracle] Log 2")).toBeInTheDocument();
  });

  it("shows empty state when no logs", () => {
    render(<DebugPanel logs={[]} onCopy={() => {}} />);

    expect(screen.getByText(/no logs yet/i)).toBeInTheDocument();
  });

  it("calls onCopy when clicking copy button", () => {
    const onCopy = vi.fn();
    const logs = ["Log 1"];
    render(<DebugPanel logs={logs} onCopy={onCopy} />);

    fireEvent.click(screen.getByRole("button", { name: /copy all/i }));

    expect(onCopy).toHaveBeenCalled();
  });

  it("shows debug header", () => {
    render(<DebugPanel logs={[]} onCopy={() => {}} />);

    expect(screen.getByText(/debug logs/i)).toBeInTheDocument();
  });
});
