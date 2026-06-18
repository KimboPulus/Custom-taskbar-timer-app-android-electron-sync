import { globalShortcut } from "electron";
import type {
  ShortcutAction,
  ShortcutLabels,
} from "../src/desktop/desktopTypes.js";
import type { WindowManager } from "./windowManager.js";

const shortcutActions: Array<{
  key: keyof ShortcutLabels;
  action: ShortcutAction;
}> = [
  { key: "togglePlayPause", action: "toggle-play-pause" },
  { key: "toggleCompact", action: "toggle-compact" },
  { key: "reset", action: "reset" },
  { key: "addMinute", action: "add-minute" },
  { key: "subtractMinute", action: "subtract-minute" },
];

export class ShortcutManager {
  private warnings: string[] = [];

  constructor(private readonly windowManager: WindowManager) {}

  register(labels: ShortcutLabels): string[] {
    globalShortcut.unregisterAll();
    this.warnings = [];

    for (const { key, action } of shortcutActions) {
      const accelerator = labels[key];
      let registered = false;

      try {
        registered = globalShortcut.register(accelerator, () => {
          this.windowManager.getWindow()?.webContents.send("timer:shortcut-action", action);
        });
      } catch (error) {
        console.warn(`Could not register ${accelerator}:`, error);
      }

      if (!registered) {
        const warning = `${accelerator} is unavailable. Another app may already use it.`;
        this.warnings.push(warning);
        console.warn(warning);
      }
    }

    return this.getWarnings();
  }

  getWarnings(): string[] {
    return [...this.warnings];
  }

  unregisterAll(): void {
    globalShortcut.unregisterAll();
  }
}
