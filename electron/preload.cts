import { contextBridge, ipcRenderer } from "electron";
import type {
  AlarmSound,
  AppSettings,
  ElectronAPI,
  PersistedTimerState,
  ShortcutAction,
  WindowMode,
} from "../src/desktop/desktopTypes.js";

const electronAPI: ElectronAPI = {
  setWindowMode: (mode: WindowMode) =>
    ipcRenderer.invoke("window:set-mode", mode),
  cycleWindowMode: () => ipcRenderer.invoke("window:cycle-mode"),
  minimizeWindow: () => ipcRenderer.send("window:minimize"),
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
  notifyTimerFinished: () => ipcRenderer.send("timer:finished"),
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
