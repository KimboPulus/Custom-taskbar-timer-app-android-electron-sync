import { describe, expect, it } from "vitest";
import { getNextWindowMode } from "./windowMode";

describe("window mode cycling", () => {
  it("toggles between full and taskbar when taskbar mode is enabled", () => {
    expect(getNextWindowMode("full", true)).toBe("taskbar");
    expect(getNextWindowMode("compact", true)).toBe("taskbar");
    expect(getNextWindowMode("taskbar", true)).toBe("full");
  });

  it("toggles between full and compact when taskbar mode is disabled", () => {
    expect(getNextWindowMode("full", false)).toBe("compact");
    expect(getNextWindowMode("compact", false)).toBe("full");
    expect(getNextWindowMode("taskbar", false)).toBe("compact");
  });
});
