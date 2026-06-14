import { contextBridge, ipcRenderer } from "electron";
import type {
  AlarmSound,
  AppSettings,
  ElectronAPI,
  PersistedTimerState,
  ShortcutAction,
} from "../src/desktop/desktopTypes.js";

const electronAPI: ElectronAPI = {
  enterCompactMode: () => ipcRenderer.invoke("window:enter-compact"),
  exitCompactMode: () => ipcRenderer.invoke("window:exit-compact"),
  toggleCompactMode: () => ipcRenderer.invoke("window:toggle-compact"),
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
