import { describe, expect, it } from "vitest";
import { shortcutFromKeyboardEvent } from "./shortcutRecorder";

const event = (
  overrides: Partial<Parameters<typeof shortcutFromKeyboardEvent>[0]>,
): Parameters<typeof shortcutFromKeyboardEvent>[0] => ({
  altKey: false,
  code: "",
  ctrlKey: false,
  key: "",
  metaKey: false,
  shiftKey: false,
  ...overrides,
});

describe("shortcutFromKeyboardEvent", () => {
  it("records a modified letter", () => {
    expect(
      shortcutFromKeyboardEvent(
        event({ altKey: true, code: "KeyT", ctrlKey: true, key: "t" }),
      ),
    ).toBe("Control+Alt+T");
  });

  it("records space and arrow keys in Electron format", () => {
    expect(
      shortcutFromKeyboardEvent(
        event({ altKey: true, code: "Space", ctrlKey: true, key: " " }),
      ),
    ).toBe("Control+Alt+Space");
    expect(
      shortcutFromKeyboardEvent(
        event({ code: "ArrowUp", ctrlKey: true, key: "ArrowUp" }),
      ),
    ).toBe("Control+Up");
  });

  it("ignores modifiers and unsafe unmodified keys", () => {
    expect(
      shortcutFromKeyboardEvent(
        event({ code: "ControlLeft", ctrlKey: true, key: "Control" }),
      ),
    ).toBeNull();
    expect(
      shortcutFromKeyboardEvent(event({ code: "KeyA", key: "a" })),
    ).toBeNull();
  });

  it("allows function keys without a modifier", () => {
    expect(shortcutFromKeyboardEvent(event({ code: "F8", key: "F8" }))).toBe(
      "F8",
    );
  });
});
