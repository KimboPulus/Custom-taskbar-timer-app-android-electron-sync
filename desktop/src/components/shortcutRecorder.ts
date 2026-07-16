type ShortcutKeyEvent = Pick<
  KeyboardEvent,
  "altKey" | "code" | "ctrlKey" | "key" | "metaKey" | "shiftKey"
>;

export type ShortcutModifierState = Pick<
  ShortcutKeyEvent,
  "altKey" | "ctrlKey" | "metaKey" | "shiftKey"
>;

export const emptyShortcutModifierState: ShortcutModifierState = {
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
};

const modifierKeys = new Set(["Alt", "Control", "Meta", "Shift"]);
const namedKeys: Record<string, string> = {
  " ": "Space",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  ArrowUp: "Up",
  Enter: "Enter",
  Escape: "Escape",
  Tab: "Tab",
};

function acceleratorKey(event: ShortcutKeyEvent): string | null {
  if (modifierKeys.has(event.key)) {
    return null;
  }
  if (/^Key[A-Z]$/.test(event.code)) {
    return event.code.slice(3);
  }
  if (/^Digit[0-9]$/.test(event.code)) {
    return event.code.slice(5);
  }
  if (/^F(?:[1-9]|1[0-9]|2[0-4])$/.test(event.key)) {
    return event.key;
  }
  return namedKeys[event.key] ?? null;
}

function modifierFlag(event: ShortcutKeyEvent): keyof ShortcutModifierState | null {
  if (event.key === "Alt" || event.code.startsWith("Alt")) {
    return "altKey";
  }
  if (event.key === "Control" || event.code.startsWith("Control")) {
    return "ctrlKey";
  }
  if (event.key === "Meta" || event.code.startsWith("Meta")) {
    return "metaKey";
  }
  if (event.key === "Shift" || event.code.startsWith("Shift")) {
    return "shiftKey";
  }
  return null;
}

export function shortcutModifierStateFromKeyboardEvent(
  current: ShortcutModifierState,
  event: ShortcutKeyEvent,
  pressed: boolean,
): ShortcutModifierState {
  const flag = modifierFlag(event);
  if (!flag) {
    return current;
  }

  return {
    ...current,
    [flag]: pressed,
  };
}

export function shortcutFromKeyboardEvent(
  event: ShortcutKeyEvent,
  heldModifiers: ShortcutModifierState = emptyShortcutModifierState,
): string | null {
  const key = acceleratorKey(event);
  if (!key) {
    return null;
  }

  const modifiers = [
    event.ctrlKey || heldModifiers.ctrlKey ? "Control" : null,
    event.altKey || heldModifiers.altKey ? "Alt" : null,
    event.shiftKey || heldModifiers.shiftKey ? "Shift" : null,
    event.metaKey || heldModifiers.metaKey ? "Super" : null,
  ].filter((value): value is string => value !== null);

  if (modifiers.length === 0 && !/^F\d+$/.test(key)) {
    return null;
  }
  return [...modifiers, key].join("+");
}
