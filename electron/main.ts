import { app } from "electron";
import { registerIpcHandlers } from "./ipc.js";
import { SettingsStore } from "./settingsStore.js";
import { ShortcutManager } from "./shortcuts.js";
import { SyncServer } from "./syncServer.js";
import { WindowManager } from "./windowManager.js";

let windowManager: WindowManager | null = null;
let shortcutManager: ShortcutManager | null = null;
let settingsStore: SettingsStore | null = null;
let syncServer: SyncServer | null = null;

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

if (hasSingleInstanceLock) {
  app.whenReady().then(async () => {
    settingsStore = new SettingsStore();
    await settingsStore.load();

    windowManager = new WindowManager(settingsStore);
    shortcutManager = new ShortcutManager(windowManager);
    syncServer = new SyncServer(settingsStore, (settings) => {
      windowManager?.getWindow()?.webContents.send("sync:settings-applied", settings);
    });
    try {
      await syncServer.start();
    } catch (error) {
      console.warn("Could not start Focus Timer sync server:", error);
    }

    registerIpcHandlers(windowManager, settingsStore, shortcutManager, syncServer);
    windowManager.createWindow();
    shortcutManager.register(settingsStore.get().shortcutLabels);

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
  settingsStore?.flushSync();
  syncServer?.stop();
  shortcutManager?.unregisterAll();
});
