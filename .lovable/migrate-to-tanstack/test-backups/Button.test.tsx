import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("Button Component", () => {
  it("renders button with text", () => {
    const { container } = render(<Button>Click me</Button>);
    const button = container.querySelector("button");
    expect(button).toBeTruthy();
    expect(button?.textContent).toBe("Click me");
  });

  it("applies custom className", () => {
    const { container } = render(<Button className="custom-class">Test Button</Button>);
    const button = container.querySelector("button");
    expect(button?.classList.contains("custom-class")).toBe(true);
  });

  it("is disabled when disabled prop is true", () => {
    const { container } = render(<Button disabled>Disabled Button</Button>);
    const button = container.querySelector("button");
    expect(button?.disabled).toBe(true);
  });
});
