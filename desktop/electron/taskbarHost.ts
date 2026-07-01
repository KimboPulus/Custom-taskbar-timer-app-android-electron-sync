import { app, type BrowserWindow } from "electron";
import { execFile } from "node:child_process";
import path from "node:path";

function getWindowHandle(window: BrowserWindow): string {
  const handle = window.getNativeWindowHandle();
  return handle.length >= 8
    ? handle.readBigUInt64LE(0).toString()
    : handle.readUInt32LE(0).toString();
}

export function getTaskbarHelperPath(): string {
  return app.isPackaged
    ? path.join(
        process.resourcesPath,
        "taskbar-host",
        "FocusTimerTaskbarHost.exe",
      )
    : path.join(
        app.getAppPath(),
        "native",
        "bin",
        "FocusTimerTaskbarHost.exe",
      );
}

function runHelper(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      getTaskbarHelperPath(),
      args,
      { windowsHide: true },
      (error, _stdout, stderr) => {
        if (error) {
          reject(new Error(stderr.trim() || error.message));
          return;
        }
        resolve();
      },
    );
  });
}

export async function embedInWindowsTaskbar(
  window: BrowserWindow,
  x: number,
  width: number,
  height: number,
): Promise<boolean> {
  if (process.platform !== "win32") {
    return false;
  }

  try {
    await runHelper([
      "attach",
      getWindowHandle(window),
      String(Math.round(x)),
      String(Math.round(width)),
      String(Math.round(height)),
    ]);
    return true;
  } catch (error) {
    console.warn("Could not enter taskbar timer mode:", error);
    return false;
  }
}

export async function detachFromWindowsTaskbar(
  window: BrowserWindow,
): Promise<void> {
  if (process.platform !== "win32") {
    return;
  }

  try {
    await runHelper(["detach", getWindowHandle(window)]);
  } catch (error) {
    console.warn("Could not detach timer from the Windows taskbar:", error);
  }
}
