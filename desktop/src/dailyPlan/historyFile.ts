import type { DailyPlanSettings } from "../desktop/desktopTypes.js";

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

function uniqueSortedDates(values: unknown, blocked = new Set<string>()): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(
    new Set(
      values.filter(
        (value): value is string => isDateKey(value) && !blocked.has(value),
      ),
    ),
  ).sort();
}

function getEarliestDate(plan: Pick<
  DailyPlanSettings,
  "completedDates" | "failedDates" | "neutralDates"
>): string | null {
  return [
    ...plan.completedDates,
    ...plan.failedDates,
    ...plan.neutralDates,
  ].sort()[0] ?? null;
}

export function normalizeDailyPlanHistory(value: unknown): DailyPlanSettings {
  if (!isRecord(value)) {
    throw new Error("Daily plan history file has no plan data.");
  }

  const completedDates = uniqueSortedDates(value.completedDates);
  const completedSet = new Set(completedDates);
  const failedDates = uniqueSortedDates(value.failedDates, completedSet);
  const usedSet = new Set([...completedDates, ...failedDates]);
  const neutralDates = uniqueSortedDates(value.neutralDates, usedSet);
  const startDate = isDateKey(value.startDate)
    ? value.startDate
    : getEarliestDate({ completedDates, failedDates, neutralDates });

  return {
    title:
      typeof value.title === "string" && value.title.trim()
        ? value.title.trim().slice(0, 80)
        : defaultTitle,
    targetMinutes:
      Number.isFinite(value.targetMinutes) && Number(value.targetMinutes) > 0
        ? Math.min(24 * 60, Math.round(Number(value.targetMinutes)))
        : defaultTargetMinutes,
    startDate,
    completedDates,
    failedDates,
    neutralDates,
  };
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
