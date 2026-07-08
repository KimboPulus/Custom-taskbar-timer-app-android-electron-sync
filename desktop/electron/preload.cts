import { contextBridge, ipcRenderer } from "electron";
import type {
  AlarmSound,
  AppSettings,
  DailyPlanSettings,
  ElectronAPI,
  PersistedTimerState,
  ShortcutAction,
  WindowMode,
} from "../src/desktop/desktopTypes.js";

const electronAPI: ElectronAPI = {
  setWindowMode: (mode: WindowMode) =>
    ipcRenderer.invoke("window:set-mode", mode),
  cycleWindowMode: () => ipcRenderer.invoke("window:cycle-mode"),
  onWindowModeChanged: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      mode: WindowMode,
      transitionId: number,
    ) => callback(mode, transitionId);
    ipcRenderer.on("window:mode-changed", listener);
    return () => ipcRenderer.removeListener("window:mode-changed", listener);
  },
  notifyWindowModeRendered: (mode, transitionId) =>
    ipcRenderer.send("window:mode-rendered", mode, transitionId),
  moveCompactWindowBy: (deltaX, deltaY) =>
    ipcRenderer.send("window:move-compact-by", deltaX, deltaY),
  minimizeWindow: () => ipcRenderer.send("window:minimize"),
  toggleMaximizeWindow: () => ipcRenderer.invoke("window:toggle-maximize"),
  closeWindow: () => ipcRenderer.send("window:close"),
  onShortcutAction: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, action: ShortcutAction) => {
      callback(action);
    };
    ipcRenderer.on("timer:shortcut-action", listener);
    return () => ipcRenderer.removeListener("timer:shortcut-action", listener);
  },
  loadSettings: () => ipcRenderer.invoke("settings:load"),
  saveSettings: (settings: Partial<AppSettings>) =>
    ipcRenderer.invoke("settings:save", settings),
  saveTimerState: (state: PersistedTimerState) =>
    ipcRenderer.send("timer:state-save", state),
  getShortcutWarnings: () => ipcRenderer.invoke("shortcuts:get-warnings"),
  listSystemSounds: () => ipcRenderer.invoke("media:list-system-sounds"),
  chooseCustomMedia: () => ipcRenderer.invoke("media:choose-custom"),
  resolveAlarmUrl: (sound: AlarmSound) =>
    ipcRenderer.invoke("media:resolve-url", sound),
  exportDailyPlanHistory: (plan: DailyPlanSettings) =>
    ipcRenderer.invoke("daily-plan:export-history", plan),
  importDailyPlanHistory: () =>
    ipcRenderer.invoke("daily-plan:import-history"),
  notifyTimerFinished: () => ipcRenderer.send("timer:finished"),
  onRemoteSettingsApplied: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      settings: AppSettings,
    ) => callback(settings);
    ipcRenderer.on("sync:settings-applied", listener);
    return () => ipcRenderer.removeListener("sync:settings-applied", listener);
  },
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
