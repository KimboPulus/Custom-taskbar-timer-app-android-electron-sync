import type { WindowMode } from "./desktopTypes.js";

export function getNextWindowMode(
  currentMode: WindowMode,
  taskbarModeEnabled: boolean,
): WindowMode {
  if (currentMode === "full") {
    return "compact";
  }

  if (currentMode === "compact") {
    return taskbarModeEnabled ? "taskbar" : "full";
  }

  return "full";
}
