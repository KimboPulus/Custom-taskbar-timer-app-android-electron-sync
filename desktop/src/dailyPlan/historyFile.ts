import type { DailyPlanSettings } from "../desktop/desktopTypes.js";
import { normalizeDailyPlanSettings } from "../domain/dailyPlanModel.js";

const historyFileKind = "focus-timer-daily-plan-history";
const historyFileVersion = 1;
const defaultTitle = "Imported plan";
const defaultTargetMinutes = 270;

export type DailyPlanHistoryFile = {
  kind: typeof historyFileKind;
  version: typeof historyFileVersion;
  exportedAt: string;
  plan: DailyPlanSettings;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function normalizeDailyPlanHistory(value: unknown): DailyPlanSettings {
  if (!isRecord(value)) {
    throw new Error("Daily plan history file has no plan data.");
  }

  return normalizeDailyPlanSettings(
    value,
    {
      title: defaultTitle,
      targetMinutes: defaultTargetMinutes,
      startDate: null,
      completedDates: [],
      failedDates: [],
      neutralDates: [],
      remainingTimes: [],
    },
    { inferStartDateFromRecords: true },
  );
}

export function createDailyPlanHistoryFile(
  plan: DailyPlanSettings,
  exportedAt = new Date().toISOString(),
): DailyPlanHistoryFile {
  return {
    kind: historyFileKind,
    version: historyFileVersion,
    exportedAt,
    plan: normalizeDailyPlanHistory(plan),
  };
}

export function parseDailyPlanHistoryFile(raw: string): DailyPlanSettings {
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("Daily plan history file is not valid JSON data.");
  }

  if (parsed.kind === historyFileKind && parsed.version === historyFileVersion) {
    return normalizeDailyPlanHistory(parsed.plan);
  }

  if ("completedDates" in parsed || "failedDates" in parsed) {
    return normalizeDailyPlanHistory(parsed);
  }

  throw new Error("This file is not a Focus Timer daily plan history file.");
}
