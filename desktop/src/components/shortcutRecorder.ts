type ShortcutKeyEvent = Pick<
  KeyboardEvent,
  "altKey" | "code" | "ctrlKey" | "key" | "metaKey" | "shiftKey"
>;

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

export function shortcutFromKeyboardEvent(
  event: ShortcutKeyEvent,
): string | null {
  const key = acceleratorKey(event);
  if (!key) {
    return null;
  }

  const modifiers = [
    event.ctrlKey ? "Control" : null,
    event.altKey ? "Alt" : null,
    event.shiftKey ? "Shift" : null,
    event.metaKey ? "Super" : null,
  ].filter((value): value is string => value !== null);

  if (modifiers.length === 0 && !/^F\d+$/.test(key)) {
    return null;
  }
  return [...modifiers, key].join("+");
}
