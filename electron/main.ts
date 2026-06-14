import { app } from "electron";
import { registerIpcHandlers } from "./ipc.js";
import { SettingsStore } from "./settingsStore.js";
import { ShortcutManager } from "./shortcuts.js";
import { WindowManager } from "./windowManager.js";

let windowManager: WindowManager | null = null;
let shortcutManager: ShortcutManager | null = null;
let settingsStore: SettingsStore | null = null;

app.setName("Focus Timer");
app.setAppUserModelId("com.max.focustimer");
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

app.whenReady().then(async () => {
  settingsStore = new SettingsStore();
  await settingsStore.load();

  windowManager = new WindowManager(settingsStore);
  shortcutManager = new ShortcutManager(windowManager);

  registerIpcHandlers(windowManager, settingsStore, shortcutManager);
  windowManager.createWindow();
  shortcutManager.register(settingsStore.get().shortcutLabels);

  app.on("activate", () => {
    if (!windowManager?.getWindow()) {
      windowManager?.createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("will-quit", () => {
  settingsStore?.flushSync();
  shortcutManager?.unregisterAll();
});
