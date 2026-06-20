import { app } from "electron";
import {
  mkdirSync,
  promises as fs,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import type {
  AlarmSound,
  AppSettings,
  DailyPlanSettings,
  PersistedTimerState,
  WindowMode,
} from "../src/desktop/desktopTypes.js";

export const defaultSettings: AppSettings = {
  selectedDurationMs: 25 * 60 * 1000,
  timerState: {
    durationMs: 25 * 60 * 1000,
    remainingMs: 25 * 60 * 1000,
    status: "idle",
    startedAt: null,
    pausedRemainingMs: null,
  },
  focusPresets: [
    5 * 60 * 1000,
    25 * 60 * 1000,
    50 * 60 * 1000,
    2 * 60 * 60 * 1000,
  ],
  windowMode: "full",
  taskbarModeEnabled: true,
  compactPosition: null,
  soundEnabled: true,
  pauseSoundEnabled: true,
  resumeSoundEnabled: true,
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
  },
};

type LegacySettings = Partial<AppSettings> & {
  customPresets?: number[];
  compactMode?: boolean;
};

function normalizePresets(values: unknown): number[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(
    new Set(
      values
        .filter((value): value is number => Number.isFinite(value) && value > 0)
        .map((value) => Math.round(value)),
    ),
  ).slice(0, 12);
}

function isAlarmSound(value: unknown): value is AlarmSound {
  if (!value || typeof value !== "object") {
    return false;
  }

  const sound = value as Partial<AlarmSound>;
  return (
    (sound.kind === "built-in" &&
      sound.id === "gentle-chime" &&
      typeof sound.label === "string") ||
    (sound.kind === "system" &&
      typeof sound.id === "string" &&
      typeof sound.label === "string") ||
    (sound.kind === "custom" &&
      typeof sound.source === "string" &&
      typeof sound.label === "string")
  );
}

function normalizeWindowMode(
  value: unknown,
  legacyCompactMode: unknown,
  taskbarModeEnabled: boolean,
): WindowMode {
  if (value === "taskbar") {
    return taskbarModeEnabled ? "taskbar" : "full";
  }
  if (value === "compact" || value === "full") {
    return value;
  }
  return legacyCompactMode === true ? "compact" : "full";
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function normalizeDailyPlan(value: unknown): DailyPlanSettings {
  if (!value || typeof value !== "object") {
    return structuredClone(defaultSettings.dailyPlan);
  }

  const plan = value as Partial<DailyPlanSettings>;
  const startDate = isDateKey(plan.startDate) ? plan.startDate : null;
  const completedDates = Array.isArray(plan.completedDates)
    ? Array.from(
        new Set(
          plan.completedDates.filter(
            (date): date is string => isDateKey(date),
          ),
        ),
      ).sort()
    : [];
  const completedDateSet = new Set(completedDates);
  const failedDates = Array.isArray(plan.failedDates)
    ? Array.from(
        new Set(
          plan.failedDates.filter(
            (date): date is string =>
              isDateKey(date) && !completedDateSet.has(date),
          ),
        ),
      ).sort()
    : [];
  const failedDateSet = new Set(failedDates);
  const neutralDates = Array.isArray(plan.neutralDates)
    ? Array.from(
        new Set(
          plan.neutralDates.filter(
            (date): date is string =>
              isDateKey(date) &&
              !completedDateSet.has(date) &&
              !failedDateSet.has(date),
          ),
        ),
      ).sort()
    : [];

  return {
    title:
      typeof plan.title === "string" && plan.title.trim()
        ? plan.title.trim().slice(0, 80)
        : defaultSettings.dailyPlan.title,
    targetMinutes:
      Number.isFinite(plan.targetMinutes) &&
      (plan.targetMinutes as number) > 0
        ? Math.min(24 * 60, Math.round(plan.targetMinutes as number))
        : defaultSettings.dailyPlan.targetMinutes,
    startDate,
    completedDates,
    failedDates,
    neutralDates,
  };
}

function normalizeTimerState(
  value: unknown,
  fallbackDurationMs: number,
): PersistedTimerState {
  if (!value || typeof value !== "object") {
    return {
      durationMs: fallbackDurationMs,
      remainingMs: fallbackDurationMs,
      status: "idle",
      startedAt: null,
      pausedRemainingMs: null,
    };
  }

  const state = value as Partial<PersistedTimerState>;
  const durationMs =
    Number.isFinite(state.durationMs) && (state.durationMs as number) > 0
      ? Math.round(state.durationMs as number)
      : fallbackDurationMs;
  const remainingMs =
    Number.isFinite(state.remainingMs) && (state.remainingMs as number) >= 0
      ? Math.min(durationMs, Math.round(state.remainingMs as number))
      : durationMs;
  const validStatus = ["idle", "running", "paused", "finished"].includes(
    state.status ?? "",
  );
  let status = validStatus ? state.status! : "idle";
  const startedAt =
    Number.isFinite(state.startedAt) && (state.startedAt as number) > 0
      ? Math.round(state.startedAt as number)
      : null;

  if (status === "running" && startedAt === null) {
    status = "paused";
  }
  if (remainingMs === 0) {
    status = "finished";
  }

  return {
    durationMs,
    remainingMs,
    status,
    startedAt: status === "running" ? startedAt : null,
    pausedRemainingMs: status === "paused" ? remainingMs : null,
  };
}

export class SettingsStore {
  private settings: AppSettings = structuredClone(defaultSettings);
  private pendingSave: NodeJS.Timeout | null = null;

  private get filePath(): string {
    return path.join(app.getPath("userData"), "settings.json");
  }

  async load(): Promise<AppSettings> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const stored = JSON.parse(raw) as LegacySettings;
      const { compactMode, customPresets, ...storedSettings } = stored;
      const migratedPresets =
        stored.focusPresets === undefined
          ? normalizePresets([
              ...defaultSettings.focusPresets,
              ...(customPresets ?? []),
            ])
          : normalizePresets(stored.focusPresets);
      const selectedDurationMs =
        Number.isFinite(stored.selectedDurationMs) &&
        (stored.selectedDurationMs as number) > 0
          ? Math.round(stored.selectedDurationMs as number)
          : defaultSettings.selectedDurationMs;
      const taskbarModeEnabled =
        typeof stored.taskbarModeEnabled === "boolean"
          ? stored.taskbarModeEnabled
          : defaultSettings.taskbarModeEnabled;
      this.settings = {
        ...defaultSettings,
        ...storedSettings,
        selectedDurationMs,
        windowMode: normalizeWindowMode(
          stored.windowMode,
          compactMode,
          taskbarModeEnabled,
        ),
        taskbarModeEnabled,
        timerState: normalizeTimerState(
          stored.timerState,
          selectedDurationMs,
        ),
        focusPresets: migratedPresets,
        alarmSound: isAlarmSound(stored.alarmSound)
          ? stored.alarmSound
          : defaultSettings.alarmSound,
        alarmVolume: Number.isFinite(stored.alarmVolume)
          ? Math.min(1, Math.max(0, stored.alarmVolume as number))
          : defaultSettings.alarmVolume,
        pauseSoundEnabled:
          typeof stored.pauseSoundEnabled === "boolean"
            ? stored.pauseSoundEnabled
            : defaultSettings.pauseSoundEnabled,
        resumeSoundEnabled:
          typeof stored.resumeSoundEnabled === "boolean"
            ? stored.resumeSoundEnabled
            : typeof stored.pauseSoundEnabled === "boolean"
              ? stored.pauseSoundEnabled
              : defaultSettings.resumeSoundEnabled,
        shortcutLabels: {
          ...defaultSettings.shortcutLabels,
          ...stored.shortcutLabels,
        },
        dailyPlan: normalizeDailyPlan(stored.dailyPlan),
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        console.warn("Could not load settings:", error);
      }
    }

    return this.get();
  }

  get(): AppSettings {
    return structuredClone(this.settings);
  }

  async update(patch: Partial<AppSettings>): Promise<AppSettings> {
    const taskbarModeEnabled =
      patch.taskbarModeEnabled ?? this.settings.taskbarModeEnabled;
    const windowMode = normalizeWindowMode(
      patch.windowMode ?? this.settings.windowMode,
      false,
      taskbarModeEnabled,
    );

    this.settings = {
      ...this.settings,
      ...patch,
      focusPresets: patch.focusPresets !== undefined
        ? normalizePresets(patch.focusPresets)
        : this.settings.focusPresets,
      alarmVolume:
        patch.alarmVolume === undefined
          ? this.settings.alarmVolume
          : Math.min(1, Math.max(0, patch.alarmVolume)),
      shortcutLabels: patch.shortcutLabels
        ? { ...this.settings.shortcutLabels, ...patch.shortcutLabels }
        : this.settings.shortcutLabels,
      timerState: patch.timerState
        ? normalizeTimerState(patch.timerState, this.settings.selectedDurationMs)
        : this.settings.timerState,
      dailyPlan:
        patch.dailyPlan === undefined
          ? this.settings.dailyPlan
          : normalizeDailyPlan(patch.dailyPlan),
      windowMode,
      taskbarModeEnabled,
    };

    await this.persist();
    return this.get();
  }

  setTimerState(state: PersistedTimerState): void {
    this.settings.timerState = normalizeTimerState(
      state,
      this.settings.selectedDurationMs,
    );
    this.schedulePersist();
  }

  flushSync(): void {
    if (this.pendingSave) {
      clearTimeout(this.pendingSave);
      this.pendingSave = null;
    }

    mkdirSync(path.dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2), "utf8");
  }

  private schedulePersist(): void {
    if (this.pendingSave) {
      clearTimeout(this.pendingSave);
    }

    this.pendingSave = setTimeout(() => {
      this.pendingSave = null;
      void this.persist();
    }, 500);
  }

  private async persist(): Promise<void> {
    if (this.pendingSave) {
      clearTimeout(this.pendingSave);
      this.pendingSave = null;
    }

    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(
      this.filePath,
      JSON.stringify(this.settings, null, 2),
      "utf8",
    );
  }
}
