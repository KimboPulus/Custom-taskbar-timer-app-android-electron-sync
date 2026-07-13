import type { AppSettings, ElectronAPI } from "./desktopTypes";
import { getNextWindowMode } from "./windowMode";

const browserSettings: AppSettings = {
  selectedDurationMs: 25 * 60 * 1000,
  timerState: {
    durationMs: 25 * 60 * 1000,
    remainingMs: 25 * 60 * 1000,
    status: "idle",
    startedAt: null,
    pausedRemainingMs: null,
  },
  focusPresets: [],
  windowMode: "full",
  taskbarModeEnabled: true,
  launchAtStartup: false,
  proModeEnabled: false,
  compactPosition: null,
  soundEnabled: true,
  pauseSoundEnabled: true,
  resumeSoundEnabled: true,
  clickSoundVolume: 0.18,
  alarmSound: {
    kind: "built-in",
    id: "gentle-chime",
    label: "Gentle chime",
  },
  alarmVolume: 0.7,
  theme: "system",
  shortcutLabels: {
    togglePlayPause: "Control+Alt+Space",
    toggleCompact: "Control+Alt+T",
    reset: "Control+Alt+R",
    addMinute: "Control+Alt+Up",
    subtractMinute: "Control+Alt+Down",
  },
  dailyPlan: {
    title: "Reading",
    targetMinutes: 270,
    startDate: null,
    completedDates: [],
    failedDates: [],
    neutralDates: [],
    remainingTimes: [],
  },
};

const browserFallback: ElectronAPI = {
  setWindowMode: async (mode) => {
    browserSettings.windowMode = mode;
    return mode;
  },
  cycleWindowMode: async () => {
    browserSettings.windowMode = getNextWindowMode(
      browserSettings.windowMode,
      browserSettings.taskbarModeEnabled,
    );
    return browserSettings.windowMode;
  },
  onWindowModeChanged: () => () => undefined,
  notifyWindowModeRendered: () => undefined,
  moveCompactWindowBy: () => undefined,
  minimizeWindow: () => undefined,
  toggleMaximizeWindow: async () => false,
  closeWindow: () => undefined,
  onShortcutAction: () => () => undefined,
  loadSettings: async () => structuredClone(browserSettings),
  saveSettings: async (patch) => {
    Object.assign(browserSettings, patch);
    if (
      !browserSettings.taskbarModeEnabled &&
      browserSettings.windowMode === "taskbar"
    ) {
      browserSettings.windowMode = "full";
    }
    return structuredClone(browserSettings);
  },
  saveTimerState: (state) => {
    browserSettings.timerState = structuredClone(state);
  },
  getShortcutWarnings: async () => [],
  listSystemSounds: async () => [
    { id: "Windows Notify.wav", label: "Windows Notify" },
    { id: "Alarm01.wav", label: "Alarm01" },
    { id: "chimes.wav", label: "chimes" },
  ],
  chooseCustomMedia: async () => null,
  resolveAlarmUrl: async () => null,
  exportDailyPlanHistory: async () => ({ canceled: true }),
  importDailyPlanHistory: async () => ({ canceled: true }),
  notifyTimerFinished: () => undefined,
  onRemoteSettingsApplied: () => () => undefined,
};

export const electronApi: ElectronAPI =
  window.electronAPI ?? browserFallback;
