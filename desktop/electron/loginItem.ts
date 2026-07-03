import { app } from "electron";

export function applyLaunchAtStartup(enabled: boolean): void {
  if (process.platform !== "win32" || !app.isPackaged) {
    return;
  }

  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
  });
}
