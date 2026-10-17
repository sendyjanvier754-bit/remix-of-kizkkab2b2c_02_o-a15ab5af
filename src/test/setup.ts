import "@testing-library/jest-dom";
import { expect, afterEach, vi, beforeAll, afterAll } from "vitest";
import { cleanup } from "@testing-library/react";

// Cleanup después de cada test
afterEach(() => {
  cleanup();
});

// Mock de ventana global
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Suppress console errors en tests (opcional)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (typeof args[0] === "string" && args[0].includes("Warning: ReactDOM.render")) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
