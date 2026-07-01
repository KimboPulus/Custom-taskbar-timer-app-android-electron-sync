import { describe, expect, it } from "vitest";
import { AltGrGuard } from "./altGrGuard";

describe("AltGrGuard", () => {
  it("blocks while right Alt is held", () => {
    const guard = new AltGrGuard();
    guard.update(true, 1000);
    expect(guard.allowsShortcut(1001)).toBe(false);
  });

  it("keeps a short guard after right Alt is released", () => {
    const guard = new AltGrGuard();
    guard.update(true, 1000);
    guard.update(false, 1100);
    expect(guard.allowsShortcut(1200)).toBe(false);
    expect(guard.allowsShortcut(1350)).toBe(true);
  });

  it("does not block when right Alt was never pressed", () => {
    const guard = new AltGrGuard();
    guard.update(false, 1000);
    expect(guard.allowsShortcut(1000)).toBe(true);
  });
});
