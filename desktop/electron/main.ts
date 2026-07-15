import { app } from "electron";
import { DiagnosticsLogger } from "./diagnostics.js";
import { registerIpcHandlers } from "./ipc.js";
import { applyLaunchAtStartup } from "./loginItem.js";
import { SettingsStore } from "./settingsStore.js";
import { ShortcutManager } from "./shortcuts.js";
import { SyncServer } from "./syncServer.js";
import { WindowManager } from "./windowManager.js";

let windowManager: WindowManager | null = null;
let shortcutManager: ShortcutManager | null = null;
let settingsStore: SettingsStore | null = null;
let syncServer: SyncServer | null = null;
let diagnostics: DiagnosticsLogger | null = null;

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    windowManager?.showExistingWindow();
  });
}

app.setName("Focus Timer");
app.setAppUserModelId(
  app.isPackaged ? "com.max.focustimer" : "com.max.focustimer.dev",
);
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
if (process.platform === "linux") {
  app.commandLine.appendSwitch("disable-dev-shm-usage");
}

if (hasSingleInstanceLock) {
  app.whenReady().then(async () => {
    diagnostics = new DiagnosticsLogger(app.getPath("userData"));
    diagnostics.info("app.starting", {
      version: app.getVersion(),
      packaged: app.isPackaged,
      platform: process.platform,
      arch: process.arch,
    });

    settingsStore = new SettingsStore(diagnostics);
    await settingsStore.load();
    applyLaunchAtStartup(settingsStore.get().launchAtStartup);

    windowManager = new WindowManager(settingsStore);
    shortcutManager = new ShortcutManager(windowManager);
    syncServer = new SyncServer(settingsStore, (settings) => {
      windowManager?.getWindow()?.webContents.send("sync:settings-applied", settings);
    }, diagnostics);
    try {
      await syncServer.start();
    } catch (error) {
      console.warn("Could not start Focus Timer sync server:", error);
      diagnostics.warn("sync.server_start_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    registerIpcHandlers(
      windowManager,
      settingsStore,
      shortcutManager,
      syncServer,
      diagnostics,
    );
    windowManager.createWindow();
    shortcutManager.register(settingsStore.get().shortcutLabels);
    diagnostics.info("app.ready");

    app.on("activate", () => {
      if (!windowManager?.getWindow()) {
        windowManager?.createWindow();
      }
    });
  });
}

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  windowManager?.prepareToQuit();
});

app.on("will-quit", () => {
  diagnostics?.info("app.will_quit");
  settingsStore?.flushSync();
  settingsStore?.close();
  syncServer?.stop();
  shortcutManager?.unregisterAll();
});
