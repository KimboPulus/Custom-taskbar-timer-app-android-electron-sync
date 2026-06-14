import type { WindowMode } from "./desktopTypes.js";

export function getNextWindowMode(
  currentMode: WindowMode,
  taskbarModeEnabled: boolean,
): WindowMode {
  if (taskbarModeEnabled) {
    return currentMode === "taskbar" ? "full" : "taskbar";
  }

  return currentMode === "compact" ? "full" : "compact";
}

export function shouldCloseToTaskbar(taskbarModeEnabled: boolean): boolean {
  return taskbarModeEnabled;
}
