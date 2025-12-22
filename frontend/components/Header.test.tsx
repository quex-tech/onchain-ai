import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Header } from "./Header";

describe("Header", () => {
  it("renders title", () => {
    render(
      <Header
        hasSubscription={false}
        onDebugToggle={() => {}}
        showDebug={false}
      />
    );

    expect(screen.getByRole("heading")).toBeInTheDocument();
    expect(screen.getByText("On-Chain")).toBeInTheDocument();
    expect(screen.getByText("AI")).toBeInTheDocument();
  });

  it("shows subscription balance when has subscription", () => {
    render(
      <Header
        hasSubscription={true}
        subscriptionBalance="0.005000"
        currencySymbol="ETH"
        onDebugToggle={() => {}}
        showDebug={false}
      />
    );

    expect(screen.getByText(/balance: 0.005000 eth/i)).toBeInTheDocument();
  });

  it("shows no subscription message when no subscription", () => {
    render(
      <Header
        hasSubscription={false}
        onDebugToggle={() => {}}
        showDebug={false}
      />
    );

    expect(screen.getByText(/no subscription/i)).toBeInTheDocument();
  });

  it("calls onDebugToggle when clicking debug button", () => {
    const onDebugToggle = vi.fn();
    render(
      <Header
        hasSubscription={false}
        onDebugToggle={onDebugToggle}
        showDebug={false}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /debug/i }));

    expect(onDebugToggle).toHaveBeenCalled();
  });

  it("shows Hide Debug when showDebug is true", () => {
    render(
      <Header
        hasSubscription={false}
        onDebugToggle={() => {}}
        showDebug={true}
      />
    );

    expect(
      screen.getByRole("button", { name: /hide debug/i })
    ).toBeInTheDocument();
  });
});
