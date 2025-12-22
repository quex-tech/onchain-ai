import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatMessage } from "./ChatMessage";

describe("ChatMessage", () => {
  it("renders user message content", () => {
    render(<ChatMessage id="1" role="user" content="Hello AI" />);

    expect(screen.getByText("Hello AI")).toBeInTheDocument();
  });

  it("renders assistant message content", () => {
    render(<ChatMessage id="2" role="assistant" content="Hello human" />);

    expect(screen.getByText("Hello human")).toBeInTheDocument();
  });

  it("shows pending status", () => {
    render(
      <ChatMessage id="3" role="user" content="Sending..." status="pending" />
    );

    expect(screen.getByText("Waiting for wallet...")).toBeInTheDocument();
  });

  it("shows confirming status", () => {
    render(
      <ChatMessage
        id="4"
        role="user"
        content="Confirming..."
        status="confirming"
      />
    );

    expect(screen.getByText("Confirming on chain...")).toBeInTheDocument();
  });

  it("shows failed status", () => {
    render(
      <ChatMessage id="5" role="user" content="My message" status="failed" />
    );

    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("renders transaction link when txHash provided", () => {
    render(
      <ChatMessage
        id="6"
        role="user"
        content="With tx"
        txHash="0x1234567890abcdef"
        explorerUrl="https://sepolia.arbiscan.io/tx/0x1234567890abcdef"
      />
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute(
      "href",
      "https://sepolia.arbiscan.io/tx/0x1234567890abcdef"
    );
    expect(link).toHaveTextContent("tx:123456");
  });

  it("applies opacity when pending", () => {
    render(
      <ChatMessage id="7" role="user" content="Pending msg" status="pending" />
    );

    const bubble = screen.getByText("Pending msg").closest("div");
    expect(bubble).toHaveClass("opacity-70");
  });
});
