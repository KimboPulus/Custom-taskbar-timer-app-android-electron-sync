import { app } from "electron";
import { mkdirSync, promises as fs } from "node:fs";
import path from "node:path";
import type { AppSettings } from "../src/desktop/desktopTypes.js";
import { summarizeDailyPlan } from "../src/domain/dailyPlanModel.js";

type DiagnosticsLevel = "info" | "warn" | "error";

export type DiagnosticsBundleExtra = {
  settingsStore?: unknown;
  syncServer?: unknown;
  shortcuts?: string[];
};

export type DiagnosticsBundle = {
  exportedAt: string;
  app: {
    name: string;
    version: string;
    packaged: boolean;
    platform: NodeJS.Platform;
    arch: string;
    versions: NodeJS.ProcessVersions;
  };
  paths: {
    userData: string;
    logFile: string;
  };
  settings: {
    windowMode: AppSettings["windowMode"];
    taskbarModeEnabled: boolean;
    launchAtStartup: boolean;
    proModeEnabled: boolean;
    timerStatus: AppSettings["timerState"]["status"];
    focusPresetCount: number;
    alarmKind: AppSettings["alarmSound"]["kind"];
    dailyPlan: ReturnType<typeof summarizeDailyPlan>;
  };
  extra: DiagnosticsBundleExtra;
  logs: unknown[];
};

export class DiagnosticsLogger {
  private writing = Promise.resolve();

  constructor(
    private readonly userDataPath: string,
    private readonly logFileName = "focus-timer-diagnostics.jsonl",
  ) {
    mkdirSync(this.logsDir, { recursive: true });
  }

  get logPath(): string {
    return path.join(this.logsDir, this.logFileName);
  }

  info(event: string, data: Record<string, unknown> = {}): void {
    this.log("info", event, data);
  }

  warn(event: string, data: Record<string, unknown> = {}): void {
    this.log("warn", event, data);
  }

  error(event: string, data: Record<string, unknown> = {}): void {
    this.log("error", event, data);
  }

  async exportBundle(
    filePath: string,
    settings: AppSettings,
    extra: DiagnosticsBundleExtra,
  ): Promise<void> {
    const bundle: DiagnosticsBundle = {
      exportedAt: new Date().toISOString(),
      app: {
        name: app.getName(),
        version: app.getVersion(),
        packaged: app.isPackaged,
        platform: process.platform,
        arch: process.arch,
        versions: process.versions,
      },
      paths: {
        userData: this.userDataPath,
        logFile: this.logPath,
      },
      settings: {
        windowMode: settings.windowMode,
        taskbarModeEnabled: settings.taskbarModeEnabled,
        launchAtStartup: settings.launchAtStartup,
        proModeEnabled: settings.proModeEnabled,
        timerStatus: settings.timerState.status,
        focusPresetCount: settings.focusPresets.length,
        alarmKind: settings.alarmSound.kind,
        dailyPlan: summarizeDailyPlan(settings.dailyPlan),
      },
      extra,
      logs: await this.readRecentLogs(),
    };

    await fs.writeFile(filePath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
    this.info("diagnostics.exported", { filePath });
  }

  private get logsDir(): string {
    return path.join(this.userDataPath, "logs");
  }

  private log(
    level: DiagnosticsLevel,
    event: string,
    data: Record<string, unknown>,
  ): void {
    const entry = {
      at: new Date().toISOString(),
      level,
      event,
      data,
    };

    this.writing = this.writing
      .then(() =>
        fs.appendFile(this.logPath, `${JSON.stringify(entry)}\n`, "utf8"),
      )
      .catch(() => undefined);
  }

  private async readRecentLogs(limit = 500): Promise<unknown[]> {
    try {
      const raw = await fs.readFile(this.logPath, "utf8");
      return raw
        .trim()
        .split(/\r?\n/)
        .filter(Boolean)
        .slice(-limit)
        .map((line) => {
          try {
            return JSON.parse(line) as unknown;
          } catch {
            return { raw: line };
          }
        });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        return [
          {
            at: new Date().toISOString(),
            level: "warn",
            event: "diagnostics.logs_unreadable",
            data: {
              error: error instanceof Error ? error.message : String(error),
            },
          },
        ];
      }
      return [];
    }
  }
}
