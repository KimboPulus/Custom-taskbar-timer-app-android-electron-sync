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
  PersistedTimerState,
  WindowMode,
} from "../src/desktop/desktopTypes.js";
import { normalizeDailyPlanSettings } from "../src/domain/dailyPlanModel.js";
import { DailyPlanDatabase } from "./dailyPlanDatabase.js";
import type { DiagnosticsLogger } from "./diagnostics.js";

const supportsWindowsTaskbarMode = process.platform === "win32";
const supportsLaunchAtStartup = process.platform === "win32";
const startsFullWhenRestoring = process.platform === "linux";

export const defaultSettings: AppSettings = {
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
  taskbarModeEnabled: supportsWindowsTaskbarMode,
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
  if (!supportsWindowsTaskbarMode && value === "taskbar") {
    return "full";
  }
  if (value === "taskbar") {
    return taskbarModeEnabled ? "taskbar" : "full";
  }
  if (value === "compact" || value === "full") {
    return value;
  }
  return legacyCompactMode === true ? "compact" : "full";
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
  private dailyPlanDatabase: DailyPlanDatabase | null = null;

  constructor(private readonly diagnostics?: DiagnosticsLogger) {}

  private get filePath(): string {
    return path.join(app.getPath("userData"), "settings.json");
  }

  private get dailyPlanDatabasePath(): string {
    return path.join(app.getPath("userData"), "daily-plan.sqlite3");
  }

  async load(): Promise<AppSettings> {
    this.dailyPlanDatabase = await DailyPlanDatabase.open(
      this.dailyPlanDatabasePath,
      this.diagnostics,
    );
    let loadedSettingsFile = false;

    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const stored = JSON.parse(raw) as LegacySettings;
      const { compactMode, customPresets, ...storedSettings } = stored;
      const migratedPresets =
        stored.focusPresets === undefined
          ? normalizePresets(customPresets ?? [])
          : normalizePresets(stored.focusPresets);
      const selectedDurationMs =
        Number.isFinite(stored.selectedDurationMs) &&
        (stored.selectedDurationMs as number) > 0
          ? Math.round(stored.selectedDurationMs as number)
          : defaultSettings.selectedDurationMs;
      const taskbarModeEnabled =
        supportsWindowsTaskbarMode &&
        (typeof stored.taskbarModeEnabled === "boolean"
          ? stored.taskbarModeEnabled
          : defaultSettings.taskbarModeEnabled);
      const restoredWindowMode = normalizeWindowMode(
        stored.windowMode,
        compactMode,
        taskbarModeEnabled,
      );
      this.settings = {
        ...defaultSettings,
        ...storedSettings,
        selectedDurationMs,
        windowMode:
          startsFullWhenRestoring && restoredWindowMode === "compact"
            ? "full"
            : restoredWindowMode,
        taskbarModeEnabled,
        launchAtStartup:
          supportsLaunchAtStartup && stored.launchAtStartup === true,
        proModeEnabled:
          typeof stored.proModeEnabled === "boolean"
            ? stored.proModeEnabled
            : defaultSettings.proModeEnabled,
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
        clickSoundVolume: Number.isFinite(stored.clickSoundVolume)
          ? Math.min(1, Math.max(0, stored.clickSoundVolume as number))
          : defaultSettings.clickSoundVolume,
        shortcutLabels: {
          ...defaultSettings.shortcutLabels,
          ...stored.shortcutLabels,
        },
        dailyPlan: normalizeDailyPlanSettings(
          stored.dailyPlan,
          defaultSettings.dailyPlan,
        ),
      };
      loadedSettingsFile = true;
      this.diagnostics?.info("settings.loaded", { source: "json" });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        console.warn("Could not load settings:", error);
        this.diagnostics?.warn("settings.load_failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (!loadedSettingsFile) {
      const databasePlan = this.dailyPlanDatabase?.readSnapshot(
        defaultSettings.dailyPlan,
      );
      if (databasePlan) {
        this.settings.dailyPlan = databasePlan;
        this.diagnostics?.info("settings.daily_plan_restored_from_sqlite");
      }
    }
    this.mirrorDailyPlanToDatabase();

    return this.get();
  }

  get(): AppSettings {
    return structuredClone(this.settings);
  }

  async update(patch: Partial<AppSettings>): Promise<AppSettings> {
    const taskbarModeEnabled =
      supportsWindowsTaskbarMode &&
      (patch.taskbarModeEnabled ?? this.settings.taskbarModeEnabled);
    const windowMode = normalizeWindowMode(
      patch.windowMode ?? this.settings.windowMode,
      false,
      taskbarModeEnabled,
    );
    const launchAtStartup =
      supportsLaunchAtStartup &&
      (patch.launchAtStartup ?? this.settings.launchAtStartup);

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
      clickSoundVolume:
        patch.clickSoundVolume === undefined
          ? this.settings.clickSoundVolume
          : Math.min(1, Math.max(0, patch.clickSoundVolume)),
      shortcutLabels: patch.shortcutLabels
        ? { ...this.settings.shortcutLabels, ...patch.shortcutLabels }
        : this.settings.shortcutLabels,
      timerState: patch.timerState
        ? normalizeTimerState(patch.timerState, this.settings.selectedDurationMs)
        : this.settings.timerState,
      dailyPlan:
        patch.dailyPlan === undefined
          ? this.settings.dailyPlan
          : normalizeDailyPlanSettings(
              patch.dailyPlan,
              defaultSettings.dailyPlan,
            ),
      windowMode,
      taskbarModeEnabled,
      launchAtStartup,
    };

    await this.persist();
    if (patch.dailyPlan !== undefined) {
      this.mirrorDailyPlanToDatabase();
    }
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
    this.mirrorDailyPlanToDatabase();
  }

  getDiagnostics(): Record<string, unknown> {
    return {
      settingsPath: this.filePath,
      dailyPlanDatabase:
        this.dailyPlanDatabase?.getDiagnostics() ?? {
          available: false,
          filePath: this.dailyPlanDatabasePath,
          dayRows: 0,
          migrations: [],
        },
    };
  }

  close(): void {
    this.dailyPlanDatabase?.close();
    this.dailyPlanDatabase = null;
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

  private mirrorDailyPlanToDatabase(): void {
    this.dailyPlanDatabase?.writeSnapshot(this.settings.dailyPlan);
  }
}
