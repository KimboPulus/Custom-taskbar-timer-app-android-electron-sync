import { describe, expect, it } from "vitest";
import { getNextWindowMode } from "./windowMode";

describe("window mode cycling", () => {
  it("cycles through full, compact, and taskbar when enabled", () => {
    expect(getNextWindowMode("full", true)).toBe("compact");
    expect(getNextWindowMode("compact", true)).toBe("taskbar");
    expect(getNextWindowMode("taskbar", true)).toBe("full");
  });

  it("skips taskbar mode when it is disabled", () => {
    expect(getNextWindowMode("full", false)).toBe("compact");
    expect(getNextWindowMode("compact", false)).toBe("full");
    expect(getNextWindowMode("taskbar", false)).toBe("full");
  });
});
