import { describe, expect, it } from "vitest";
import {
  emptyShortcutModifierState,
  shortcutFromKeyboardEvent,
  shortcutModifierStateFromKeyboardEvent,
} from "./shortcutRecorder";

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

  it("keeps held modifiers when the final key event drops altKey", () => {
    let modifiers = emptyShortcutModifierState;
    modifiers = shortcutModifierStateFromKeyboardEvent(
      modifiers,
      event({ code: "ControlLeft", ctrlKey: true, key: "Control" }),
      true,
    );
    modifiers = shortcutModifierStateFromKeyboardEvent(
      modifiers,
      event({ altKey: true, code: "AltLeft", ctrlKey: true, key: "Alt" }),
      true,
    );

    expect(
      shortcutFromKeyboardEvent(
        event({ code: "KeyN", ctrlKey: true, key: "n" }),
        modifiers,
      ),
    ).toBe("Control+Alt+N");
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
