import { globalShortcut } from "electron";
import type {
  ShortcutAction,
  ShortcutLabels,
} from "../src/desktop/desktopTypes.js";
import { requiresAltGrGuard } from "../src/desktop/shortcutPolicy.js";
import { ModifierMonitor } from "./modifierMonitor.js";
import { ShortcutRepeatGuard } from "./shortcutRepeatGuard.js";
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

const altGrDecisionDelayMs = 30;

export class ShortcutManager {
  private warnings: string[] = [];
  private readonly modifierMonitor = new ModifierMonitor();
  private readonly repeatGuard = new ShortcutRepeatGuard();

  constructor(private readonly windowManager: WindowManager) {}

  register(labels: ShortcutLabels): string[] {
    globalShortcut.unregisterAll();
    this.repeatGuard.clear();
    this.modifierMonitor.start();
    this.warnings = [];

    for (const { key, action } of shortcutActions) {
      const accelerator = labels[key];
      if (!accelerator) {
        continue;
      }
      let registered = false;

      try {
        registered = globalShortcut.register(accelerator, () => {
          if (!this.repeatGuard.claimPress(accelerator)) {
            return;
          }

          const sendAction = () => {
            this.windowManager.getWindow()?.webContents.send("timer:shortcut-action", action);
          };

          if (requiresAltGrGuard(accelerator)) {
            setTimeout(() => {
              if (this.modifierMonitor.allowsExplicitShortcut()) {
                sendAction();
              }
            }, altGrDecisionDelayMs);
            return;
          }

          sendAction();
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
    this.repeatGuard.clear();
    this.modifierMonitor.stop();
  }
}
