import {
  dialog,
  ipcMain,
  Notification,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from "electron";
import { promises as fs } from "node:fs";
import type {
  AppSettings,
  DailyPlanSettings,
  PersistedTimerState,
  WindowMode,
} from "../src/desktop/desktopTypes.js";
import {
  createDailyPlanHistoryFile,
  parseDailyPlanHistoryFile,
} from "../src/dailyPlan/historyFile.js";
import {
  chooseCustomMedia,
  listSystemSounds,
  resolveAlarmUrl,
} from "./media.js";
import { applyLaunchAtStartup } from "./loginItem.js";
import type { DiagnosticsLogger } from "./diagnostics.js";
import type { SettingsStore } from "./settingsStore.js";
import type { ShortcutManager } from "./shortcuts.js";
import type { SyncServer } from "./syncServer.js";
import type { WindowManager } from "./windowManager.js";

export function registerIpcHandlers(
  windowManager: WindowManager,
  settingsStore: SettingsStore,
  shortcutManager: ShortcutManager,
  syncServer: SyncServer,
  diagnostics: DiagnosticsLogger,
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
  ipcMain.handle("diagnostics:export", async () => {
    try {
      const owner = windowManager.getWindow();
      const options: SaveDialogOptions = {
        title: "Export diagnostics",
        defaultPath: "focus-timer-diagnostics.json",
        filters: [
          { name: "Focus Timer diagnostics", extensions: ["json"] },
          { name: "All files", extensions: ["*"] },
        ],
      };
      const result = owner
        ? await dialog.showSaveDialog(owner, options)
        : await dialog.showSaveDialog(options);

      if (result.canceled || !result.filePath) {
        return { canceled: true };
      }

      await diagnostics.exportBundle(result.filePath, settingsStore.get(), {
        settingsStore: settingsStore.getDiagnostics(),
        syncServer: syncServer.getDiagnostics(),
        shortcuts: shortcutManager.getWarnings(),
      });
      return { canceled: false, filePath: result.filePath };
    } catch (error) {
      return {
        canceled: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not export diagnostics.",
      };
    }
  });
  ipcMain.handle("media:list-system-sounds", () => listSystemSounds());
  ipcMain.handle("media:choose-custom", () =>
    chooseCustomMedia(windowManager.getWindow()),
  );
  ipcMain.handle("media:resolve-url", (_event, sound) =>
    resolveAlarmUrl(sound),
  );
  ipcMain.handle(
    "daily-plan:export-history",
    async (_event, plan: DailyPlanSettings) => {
      try {
        const owner = windowManager.getWindow();
        const options: SaveDialogOptions = {
          title: "Export daily plan history",
          defaultPath: "focus-timer-daily-plan-history.json",
          filters: [
            { name: "Focus Timer history", extensions: ["json"] },
            { name: "All files", extensions: ["*"] },
          ],
        };
        const result = owner
          ? await dialog.showSaveDialog(owner, options)
          : await dialog.showSaveDialog(options);

        if (result.canceled || !result.filePath) {
          return { canceled: true };
        }

        const history = createDailyPlanHistoryFile(plan);
        await fs.writeFile(
          result.filePath,
          `${JSON.stringify(history, null, 2)}\n`,
          "utf8",
        );
        return { canceled: false, filePath: result.filePath };
      } catch (error) {
        return {
          canceled: false,
          error:
            error instanceof Error
              ? error.message
              : "Could not export daily plan history.",
        };
      }
    },
  );
  ipcMain.handle("daily-plan:import-history", async () => {
    try {
      const owner = windowManager.getWindow();
      const options: OpenDialogOptions = {
        title: "Import daily plan history",
        properties: ["openFile"],
        filters: [
          { name: "Focus Timer history", extensions: ["json"] },
          { name: "All files", extensions: ["*"] },
        ],
      };
      const result = owner
        ? await dialog.showOpenDialog(owner, options)
        : await dialog.showOpenDialog(options);

      if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true };
      }

      const raw = await fs.readFile(result.filePaths[0], "utf8");
      const plan = parseDailyPlanHistoryFile(raw);
      return { canceled: false, plan };
    } catch (error) {
      return {
        canceled: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not import daily plan history.",
      };
    }
  });

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
