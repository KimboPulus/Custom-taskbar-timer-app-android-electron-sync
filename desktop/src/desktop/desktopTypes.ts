export type ThemePreference = "light" | "dark" | "system";
export type WindowMode = "full" | "compact" | "taskbar";

export type ShortcutAction =
  | "toggle-play-pause"
  | "toggle-compact"
  | "reset"
  | "add-minute"
  | "subtract-minute";

export type ShortcutLabels = {
  togglePlayPause: string;
  toggleCompact: string;
  reset: string;
  addMinute: string;
  subtractMinute: string;
};

export type CompactPosition = {
  x: number;
  y: number;
};

export type AlarmSound =
  | {
      kind: "built-in";
      id: "gentle-chime";
      label: string;
    }
  | {
      kind: "system";
      id: string;
      label: string;
    }
  | {
      kind: "custom";
      source: string;
      label: string;
    };

export type SystemSoundOption = {
  id: string;
  label: string;
};

export type PersistedTimerState = {
  durationMs: number;
  remainingMs: number;
  status: "idle" | "running" | "paused" | "finished";
  startedAt: number | null;
  pausedRemainingMs: number | null;
};

export type DailyPlanRemainingTime = {
  date: string;
  remainingMs: number;
};

export type DailyPlanSettings = {
  title: string;
  targetMinutes: number;
  startDate: string | null;
  completedDates: string[];
  failedDates: string[];
  neutralDates: string[];
  remainingTimes: DailyPlanRemainingTime[];
};

export type DailyPlanHistoryExportResult = {
  canceled: boolean;
  filePath?: string;
  error?: string;
};

export type DailyPlanHistoryImportResult = {
  canceled: boolean;
  plan?: DailyPlanSettings;
  error?: string;
};

export type AppSettings = {
  selectedDurationMs: number;
  timerState: PersistedTimerState;
  focusPresets: number[];
  windowMode: WindowMode;
  taskbarModeEnabled: boolean;
  launchAtStartup: boolean;
  proModeEnabled: boolean;
  compactPosition: CompactPosition | null;
  soundEnabled: boolean;
  pauseSoundEnabled: boolean;
  resumeSoundEnabled: boolean;
  clickSoundVolume: number;
  alarmSound: AlarmSound;
  alarmVolume: number;
  theme: ThemePreference;
  shortcutLabels: ShortcutLabels;
  dailyPlan: DailyPlanSettings;
};

export type ElectronAPI = {
  setWindowMode: (mode: WindowMode) => Promise<WindowMode>;
  cycleWindowMode: () => Promise<WindowMode>;
  onWindowModeChanged: (
    callback: (mode: WindowMode, transitionId: number) => void,
  ) => () => void;
  notifyWindowModeRendered: (
    mode: WindowMode,
    transitionId?: number,
  ) => void;
  moveCompactWindowBy: (deltaX: number, deltaY: number) => void;
  minimizeWindow: () => void;
  toggleMaximizeWindow: () => Promise<boolean>;
  closeWindow: () => void;
  onShortcutAction: (callback: (action: ShortcutAction) => void) => () => void;
  loadSettings: () => Promise<AppSettings>;
  saveSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
  saveTimerState: (state: PersistedTimerState) => void;
  getShortcutWarnings: () => Promise<string[]>;
  listSystemSounds: () => Promise<SystemSoundOption[]>;
  chooseCustomMedia: () => Promise<AlarmSound | null>;
  resolveAlarmUrl: (sound: AlarmSound) => Promise<string | null>;
  exportDailyPlanHistory: (
    plan: DailyPlanSettings,
  ) => Promise<DailyPlanHistoryExportResult>;
  importDailyPlanHistory: () => Promise<DailyPlanHistoryImportResult>;
  notifyTimerFinished: () => void;
  onRemoteSettingsApplied: (callback: (settings: AppSettings) => void) => () => void;
};

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
