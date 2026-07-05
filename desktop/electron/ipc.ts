import { ipcMain, Notification } from "electron";
import type {
  AppSettings,
  PersistedTimerState,
  WindowMode,
} from "../src/desktop/desktopTypes.js";
import {
  chooseCustomMedia,
  listSystemSounds,
  resolveAlarmUrl,
} from "./media.js";
import { applyLaunchAtStartup } from "./loginItem.js";
import type { SettingsStore } from "./settingsStore.js";
import type { ShortcutManager } from "./shortcuts.js";
import type { SyncServer } from "./syncServer.js";
import type { WindowManager } from "./windowManager.js";

export function registerIpcHandlers(
  windowManager: WindowManager,
  settingsStore: SettingsStore,
  shortcutManager: ShortcutManager,
  syncServer: SyncServer,
): void {
  ipcMain.handle("window:set-mode", (_event, mode: WindowMode) =>
    windowManager.setMode(mode),
  );
  ipcMain.handle("window:cycle-mode", () => windowManager.cycleMode());
  ipcMain.on(
    "window:mode-rendered",
    (_event, mode: WindowMode, transitionId?: number) =>
      windowManager.rendererModeRendered(mode, transitionId),
  );
  ipcMain.on("window:move-compact-by", (_event, deltaX, deltaY) => {
    if (Number.isFinite(deltaX) && Number.isFinite(deltaY)) {
      windowManager.moveCompactBy(Math.round(deltaX), Math.round(deltaY));
    }
  });
  ipcMain.on("window:minimize", () => windowManager.minimize());
  ipcMain.handle("window:toggle-maximize", () =>
    windowManager.toggleMaximize(),
  );
  ipcMain.on("window:close", () => windowManager.close());

  ipcMain.handle("settings:load", () => settingsStore.get());
  ipcMain.handle("settings:save", async (_event, patch: Partial<AppSettings>) => {
    const previous = settingsStore.get();
    const next = await settingsStore.update(patch);
    syncServer.markLocalSettingsPatch(patch, previous);

    if (patch.launchAtStartup !== undefined) {
      applyLaunchAtStartup(next.launchAtStartup);
    }

    if (
      patch.shortcutLabels &&
      JSON.stringify(previous.shortcutLabels) !== JSON.stringify(next.shortcutLabels)
    ) {
      shortcutManager.register(next.shortcutLabels);
    }

    return next;
  });
  ipcMain.on("timer:state-save", (_event, state: PersistedTimerState) => {
    settingsStore.setTimerState(state);
    syncServer.markTimerChanged();
  });
  ipcMain.handle("shortcuts:get-warnings", () => shortcutManager.getWarnings());
  ipcMain.handle("media:list-system-sounds", () => listSystemSounds());
  ipcMain.handle("media:choose-custom", () =>
    chooseCustomMedia(windowManager.getWindow()),
  );
  ipcMain.handle("media:resolve-url", (_event, sound) =>
    resolveAlarmUrl(sound),
  );

  ipcMain.on("timer:finished", () => {
    if (Notification.isSupported()) {
      new Notification({
        title: "Focus Timer",
        body: "Time is up.",
        silent: true,
      }).show();
    }
  });
}
