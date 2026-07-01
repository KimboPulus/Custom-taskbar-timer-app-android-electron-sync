import { describe, expect, it } from "vitest";
import { requiresAltGrGuard } from "./shortcutPolicy";

describe("requiresAltGrGuard", () => {
  it.each([
    "Control+Alt+T",
    "Ctrl+Alt+T",
    "CommandOrControl+Alt+Space",
    "CmdOrCtrl+Alt+R",
  ])("guards Ctrl+Alt accelerator %s", (accelerator) => {
    expect(requiresAltGrGuard(accelerator)).toBe(true);
  });

  it.each(["Alt+T", "Control+T", "Shift+Alt+T", "F8", ""])(
    "does not guard accelerator %s",
    (accelerator) => {
      expect(requiresAltGrGuard(accelerator)).toBe(false);
    },
  );
});
