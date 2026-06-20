import { app } from "electron";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  AppSettings,
  DailyPlanSettings,
  PersistedTimerState,
} from "../src/desktop/desktopTypes.js";
import type { SettingsStore } from "./settingsStore.js";

type SyncTimerStatus = "Idle" | "Running" | "Paused" | "Finished";
type SyncDailyPlanStatus = "Completed" | "Failed" | "Neutral";

type SyncTimerState = {
  durationMs: number;
  remainingMs: number;
  status: SyncTimerStatus;
  startedAt: string | null;
  pausedRemainingMs: number | null;
  modifiedAt: string;
  modifiedBy: string;
};

type SyncDailyPlanDateStatus = {
  date: string;
  status: SyncDailyPlanStatus;
  modifiedAt: string;
  modifiedBy: string;
};

type SyncDailyPlanState = {
  title: string;
  targetMinutes: number;
  startDate: string | null;
  dates: SyncDailyPlanDateStatus[];
  modifiedAt: string;
  modifiedBy: string;
};

type SyncFocusPresetItem = {
  durationMs: number;
  modifiedAt: string;
  modifiedBy: string;
};

type SyncAppSettings = {
  soundEnabled: boolean;
  pauseSoundEnabled?: boolean;
  resumeSoundEnabled?: boolean;
  alarmVolume: number;
  modifiedAt: string;
  modifiedBy: string;
};

type SyncSnapshot = {
  version: number;
  timer: SyncTimerState;
  dailyPlan: SyncDailyPlanState;
  focusPresets: SyncFocusPresetItem[];
  settings: SyncAppSettings;
};

type SyncPushRequest = {
  deviceId: string;
  knownVersion: number;
  timer?: SyncTimerState | null;
  dailyPlan?: SyncDailyPlanState | null;
  focusPresets?: SyncFocusPresetItem[] | null;
  settings?: SyncAppSettings | null;
};

type SyncPushResponse = {
  version: number;
  serverHadNewerChanges: boolean;
  snapshot: SyncSnapshot;
};

type SyncMeta = {
  version: number;
  timerModifiedAt: string;
  dailyPlanModifiedAt: string;
  focusPresetsModifiedAt: string;
  appSettingsModifiedAt: string;
};

const syncDeviceId = "desktop";
const defaultPort = 5278;

function nowIso(): string {
  return new Date().toISOString();
}

function isRemoteNewer(remote: string, local: string): boolean {
  return Date.parse(remote) >= Date.parse(local);
}

function toSyncTimerStatus(status: PersistedTimerState["status"]): SyncTimerStatus {
  switch (status) {
    case "running":
      return "Running";
    case "paused":
      return "Paused";
    case "finished":
      return "Finished";
    case "idle":
    default:
      return "Idle";
  }
}

function fromSyncTimerStatus(status: SyncTimerStatus): PersistedTimerState["status"] {
  switch (status) {
    case "Running":
      return "running";
    case "Paused":
      return "paused";
    case "Finished":
      return "finished";
    case "Idle":
    default:
      return "idle";
  }
}

function getCurrentRemainingMs(timer: PersistedTimerState): number {
  if (timer.status !== "running" || timer.startedAt === null) {
    return Math.max(0, timer.remainingMs);
  }

  return Math.max(0, timer.remainingMs - (Date.now() - timer.startedAt));
}

function createEmptyMeta(): SyncMeta {
  const createdAt = nowIso();
  return {
    version: 0,
    timerModifiedAt: createdAt,
    dailyPlanModifiedAt: createdAt,
    focusPresetsModifiedAt: createdAt,
    appSettingsModifiedAt: createdAt,
  };
}

function writeJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = "";

    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}") as T);
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

export class SyncServer {
  private server: Server | null = null;
  private meta: SyncMeta = createEmptyMeta();
  private pendingMetaSave: NodeJS.Timeout | null = null;

  constructor(
    private readonly settingsStore: SettingsStore,
    private readonly onRemoteSettingsApplied: (settings: AppSettings) => void,
  ) {}

  private get metaPath(): string {
    return path.join(app.getPath("userData"), "sync-meta.json");
  }

  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.metaPath, "utf8");
      this.meta = { ...createEmptyMeta(), ...(JSON.parse(raw) as Partial<SyncMeta>) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.warn("Could not load sync metadata:", error);
      }
    }
  }

  async start(port = defaultPort): Promise<void> {
    if (this.server) {
      return;
    }

    await this.load();
    this.server = createServer((request, response) => {
      void this.handleRequest(request, response);
    });

    await new Promise<void>((resolve, reject) => {
      this.server?.once("error", reject);
      this.server?.listen(port, "0.0.0.0", () => {
        this.server?.off("error", reject);
        console.info(`Focus Timer sync server listening on port ${port}.`);
        resolve();
      });
    });
  }

  stop(): void {
    if (this.pendingMetaSave) {
      clearTimeout(this.pendingMetaSave);
      this.pendingMetaSave = null;
    }
    void this.persistMeta();
    this.server?.close();
    this.server = null;
  }

  markLocalSettingsPatch(patch: Partial<AppSettings>): void {
    let changed = false;
    const modifiedAt = nowIso();

    if (patch.timerState) {
      this.meta.timerModifiedAt = modifiedAt;
      changed = true;
    }
    if (patch.dailyPlan) {
      this.meta.dailyPlanModifiedAt = modifiedAt;
      changed = true;
    }
    if (patch.focusPresets) {
      this.meta.focusPresetsModifiedAt = modifiedAt;
      changed = true;
    }
    if (
      patch.soundEnabled !== undefined ||
      patch.pauseSoundEnabled !== undefined ||
      patch.resumeSoundEnabled !== undefined ||
      patch.alarmVolume !== undefined
    ) {
      this.meta.appSettingsModifiedAt = modifiedAt;
      changed = true;
    }

    if (changed) {
      this.meta.version += 1;
      this.scheduleMetaSave();
    }
  }

  markTimerChanged(): void {
    this.meta.timerModifiedAt = nowIso();
    this.meta.version += 1;
    this.scheduleMetaSave();
  }

  private async handleRequest(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    try {
      if (request.method === "OPTIONS") {
        writeJson(response, 204, {});
        return;
      }

      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
      if (request.method === "GET" && url.pathname === "/health") {
        writeJson(response, 200, {
          status: "ok",
          service: "focus-timer-electron-sync",
          time: nowIso(),
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/sync/snapshot") {
        writeJson(response, 200, this.createSnapshot());
        return;
      }

      if (request.method === "POST" && url.pathname === "/sync/push") {
        const pushRequest = await readJsonBody<SyncPushRequest>(request);
        if (!pushRequest.deviceId) {
          writeJson(response, 400, { error: "DeviceId is required." });
          return;
        }

        const responseBody = await this.applyPush(pushRequest);
        writeJson(response, 200, responseBody);
        return;
      }

      writeJson(response, 404, { error: "Not found." });
    } catch (error) {
      writeJson(response, 500, {
        error: error instanceof Error ? error.message : "Unknown sync error.",
      });
    }
  }

  private createSnapshot(): SyncSnapshot {
    const settings = this.settingsStore.get();
    const timer = settings.timerState;
    const remainingMs = getCurrentRemainingMs(timer);
    const startedAt = timer.status === "running" ? Date.now() : null;

    return {
      version: this.meta.version,
      timer: {
        durationMs: timer.durationMs,
        remainingMs,
        status: remainingMs === 0 ? "Finished" : toSyncTimerStatus(timer.status),
        startedAt: startedAt === null ? null : new Date(startedAt).toISOString(),
        pausedRemainingMs: timer.status === "paused" ? remainingMs : null,
        modifiedAt: this.meta.timerModifiedAt,
        modifiedBy: syncDeviceId,
      },
      dailyPlan: {
        title: settings.dailyPlan.title,
        targetMinutes: settings.dailyPlan.targetMinutes,
        startDate: settings.dailyPlan.startDate,
        dates: this.createDailyPlanDates(settings.dailyPlan),
        modifiedAt: this.meta.dailyPlanModifiedAt,
        modifiedBy: syncDeviceId,
      },
      focusPresets: settings.focusPresets.map((durationMs) => ({
        durationMs,
        modifiedAt: this.meta.focusPresetsModifiedAt,
        modifiedBy: syncDeviceId,
      })),
      settings: {
        soundEnabled: settings.soundEnabled,
        pauseSoundEnabled: settings.pauseSoundEnabled,
        resumeSoundEnabled: settings.resumeSoundEnabled,
        alarmVolume: settings.alarmVolume,
        modifiedAt: this.meta.appSettingsModifiedAt,
        modifiedBy: syncDeviceId,
      },
    };
  }

  private createDailyPlanDates(plan: DailyPlanSettings): SyncDailyPlanDateStatus[] {
    return [
      ...plan.completedDates.map((date) => ({
        date,
        status: "Completed" as const,
        modifiedAt: this.meta.dailyPlanModifiedAt,
        modifiedBy: syncDeviceId,
      })),
      ...plan.failedDates.map((date) => ({
        date,
        status: "Failed" as const,
        modifiedAt: this.meta.dailyPlanModifiedAt,
        modifiedBy: syncDeviceId,
      })),
      ...plan.neutralDates.map((date) => ({
        date,
        status: "Neutral" as const,
        modifiedAt: this.meta.dailyPlanModifiedAt,
        modifiedBy: syncDeviceId,
      })),
    ].sort((left, right) => left.date.localeCompare(right.date));
  }

  private async applyPush(request: SyncPushRequest): Promise<SyncPushResponse> {
    const versionBefore = this.meta.version;
    const patch: Partial<AppSettings> = {};
    let changed = false;

    if (
      request.timer &&
      isRemoteNewer(request.timer.modifiedAt, this.meta.timerModifiedAt)
    ) {
      patch.timerState = this.fromSyncTimer(request.timer);
      this.meta.timerModifiedAt = request.timer.modifiedAt;
      changed = true;
    }

    if (
      request.dailyPlan &&
      isRemoteNewer(request.dailyPlan.modifiedAt, this.meta.dailyPlanModifiedAt)
    ) {
      patch.dailyPlan = this.fromSyncDailyPlan(request.dailyPlan);
      this.meta.dailyPlanModifiedAt = request.dailyPlan.modifiedAt;
      changed = true;
    }

    if (
      request.focusPresets &&
      request.focusPresets.length > 0 &&
      isRemoteNewer(
        request.focusPresets.reduce((latest, preset) =>
          Date.parse(preset.modifiedAt) > Date.parse(latest) ? preset.modifiedAt : latest,
        request.focusPresets[0].modifiedAt),
        this.meta.focusPresetsModifiedAt,
      )
    ) {
      patch.focusPresets = request.focusPresets
        .map((preset) => preset.durationMs)
        .filter((durationMs) => Number.isFinite(durationMs) && durationMs > 0);
      this.meta.focusPresetsModifiedAt = request.focusPresets.reduce((latest, preset) =>
        Date.parse(preset.modifiedAt) > Date.parse(latest) ? preset.modifiedAt : latest,
      request.focusPresets[0].modifiedAt);
      changed = true;
    }

    if (
      request.settings &&
      isRemoteNewer(request.settings.modifiedAt, this.meta.appSettingsModifiedAt)
    ) {
      patch.soundEnabled = request.settings.soundEnabled;
      if (typeof request.settings.pauseSoundEnabled === "boolean") {
        patch.pauseSoundEnabled = request.settings.pauseSoundEnabled;
      }
      if (typeof request.settings.resumeSoundEnabled === "boolean") {
        patch.resumeSoundEnabled = request.settings.resumeSoundEnabled;
      }
      patch.alarmVolume = request.settings.alarmVolume;
      this.meta.appSettingsModifiedAt = request.settings.modifiedAt;
      changed = true;
    }

    if (changed) {
      this.meta.version += 1;
      const settings = await this.settingsStore.update(patch);
      this.onRemoteSettingsApplied(settings);
      this.scheduleMetaSave();
    }

    const snapshot = this.createSnapshot();
    return {
      version: snapshot.version,
      serverHadNewerChanges: request.knownVersion < versionBefore,
      snapshot,
    };
  }

  private fromSyncTimer(timer: SyncTimerState): PersistedTimerState {
    const status = fromSyncTimerStatus(timer.status);
    const startedAt =
      status === "running" && timer.startedAt ? Date.parse(timer.startedAt) : null;

    return {
      durationMs: timer.durationMs,
      remainingMs: timer.remainingMs,
      status,
      startedAt,
      pausedRemainingMs: status === "paused" ? timer.remainingMs : null,
    };
  }

  private fromSyncDailyPlan(plan: SyncDailyPlanState): DailyPlanSettings {
    const completedDates = new Set<string>();
    const failedDates = new Set<string>();
    const neutralDates = new Set<string>();

    for (const day of plan.dates) {
      if (day.status === "Completed") {
        completedDates.add(day.date);
        failedDates.delete(day.date);
        neutralDates.delete(day.date);
      } else if (day.status === "Failed") {
        failedDates.add(day.date);
        completedDates.delete(day.date);
        neutralDates.delete(day.date);
      } else {
        completedDates.delete(day.date);
        failedDates.delete(day.date);
        neutralDates.add(day.date);
      }
    }

    return {
      title: plan.title,
      targetMinutes: plan.targetMinutes,
      startDate: plan.startDate,
      completedDates: [...completedDates].sort(),
      failedDates: [...failedDates].sort(),
      neutralDates: [...neutralDates].sort(),
    };
  }

  private scheduleMetaSave(): void {
    if (this.pendingMetaSave) {
      clearTimeout(this.pendingMetaSave);
    }

    this.pendingMetaSave = setTimeout(() => {
      this.pendingMetaSave = null;
      void this.persistMeta();
    }, 500);
  }

  private async persistMeta(): Promise<void> {
    await fs.mkdir(path.dirname(this.metaPath), { recursive: true });
    await fs.writeFile(this.metaPath, JSON.stringify(this.meta, null, 2), "utf8");
  }
}
