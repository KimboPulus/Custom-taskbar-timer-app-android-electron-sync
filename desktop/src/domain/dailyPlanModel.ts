import type { DailyPlanSettings } from "../desktop/desktopTypes.js";
import { isDateKey, uniqueSortedDateKeys } from "./dateKey.js";

export type ExplicitDailyPlanDayStatus =
  | "completed"
  | "failed"
  | "neutral"
  | "unset";

export type ExplicitDailyPlanDayRecord = {
  date: string;
  status: ExplicitDailyPlanDayStatus;
  remainingMs: number | null;
};

export type DailyPlanSummary = {
  title: string;
  targetMinutes: number;
  startDate: string | null;
  completedCount: number;
  failedCount: number;
  neutralCount: number;
  remainingTimeCount: number;
  remainingTimeTotalMs: number;
};

type NormalizeDailyPlanOptions = {
  inferStartDateFromRecords?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function normalizeRemainingTimes(
  values: unknown,
): DailyPlanSettings["remainingTimes"] {
  if (!Array.isArray(values)) {
    return [];
  }

  const byDate = new Map<string, number>();
  for (const item of values) {
    if (!isRecord(item) || !isDateKey(item.date)) {
      continue;
    }

    const remainingMs = Number(item.remainingMs);
    if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
      continue;
    }

    byDate.set(item.date, Math.round(remainingMs));
  }

  return [...byDate.entries()]
    .map(([date, remainingMs]) => ({ date, remainingMs }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

function getEarliestExplicitDate(plan: Pick<
  DailyPlanSettings,
  "completedDates" | "failedDates" | "neutralDates" | "remainingTimes"
>): string | null {
  return [
    ...plan.completedDates,
    ...plan.failedDates,
    ...plan.neutralDates,
    ...plan.remainingTimes.map((item) => item.date),
  ].sort()[0] ?? null;
}

export function normalizeDailyPlanSettings(
  value: unknown,
  fallback: DailyPlanSettings,
  options: NormalizeDailyPlanOptions = {},
): DailyPlanSettings {
  if (!isRecord(value)) {
    return structuredClone(fallback);
  }

  const completedDates = uniqueSortedDateKeys(value.completedDates);
  const completedDateSet = new Set(completedDates);
  const failedDates = uniqueSortedDateKeys(value.failedDates, completedDateSet);
  const usedDateSet = new Set([...completedDates, ...failedDates]);
  const neutralDates = uniqueSortedDateKeys(value.neutralDates, usedDateSet);
  const remainingTimes = normalizeRemainingTimes(value.remainingTimes);
  const planDates = {
    completedDates,
    failedDates,
    neutralDates,
    remainingTimes,
  };
  const startDate = isDateKey(value.startDate)
    ? value.startDate
    : options.inferStartDateFromRecords
      ? getEarliestExplicitDate(planDates)
      : fallback.startDate;

  return {
    title:
      typeof value.title === "string" && value.title.trim()
        ? value.title.trim().slice(0, 80)
        : fallback.title,
    targetMinutes:
      Number.isFinite(value.targetMinutes) && Number(value.targetMinutes) > 0
        ? Math.min(24 * 60, Math.round(Number(value.targetMinutes)))
        : fallback.targetMinutes,
    startDate,
    completedDates,
    failedDates,
    neutralDates,
    remainingTimes,
  };
}

export function getExplicitDailyPlanDayRecords(
  plan: DailyPlanSettings,
): ExplicitDailyPlanDayRecord[] {
  const remainingByDate = new Map(
    plan.remainingTimes.map((item) => [item.date, item.remainingMs]),
  );
  const dates = new Set([
    ...plan.completedDates,
    ...plan.failedDates,
    ...plan.neutralDates,
    ...remainingByDate.keys(),
  ]);

  return [...dates]
    .sort()
    .map((date) => ({
      date,
      status: plan.completedDates.includes(date)
        ? "completed"
        : plan.failedDates.includes(date)
          ? "failed"
          : plan.neutralDates.includes(date)
            ? "neutral"
            : "unset",
      remainingMs: remainingByDate.get(date) ?? null,
    }));
}

export function createDailyPlanFromDayRecords(
  basePlan: DailyPlanSettings,
  records: ExplicitDailyPlanDayRecord[],
): DailyPlanSettings {
  const completedDates: string[] = [];
  const failedDates: string[] = [];
  const neutralDates: string[] = [];
  const remainingTimes: DailyPlanSettings["remainingTimes"] = [];

  for (const record of records) {
    if (!isDateKey(record.date)) {
      continue;
    }

    if (record.status === "completed") {
      completedDates.push(record.date);
    } else if (record.status === "failed") {
      failedDates.push(record.date);
    } else if (record.status === "neutral") {
      neutralDates.push(record.date);
    }

    if (
      typeof record.remainingMs === "number" &&
      Number.isFinite(record.remainingMs) &&
      record.remainingMs > 0
    ) {
      remainingTimes.push({
        date: record.date,
        remainingMs: Math.round(record.remainingMs),
      });
    }
  }

  return {
    ...basePlan,
    completedDates: [...new Set(completedDates)].sort(),
    failedDates: [...new Set(failedDates)].sort(),
    neutralDates: [...new Set(neutralDates)].sort(),
    remainingTimes: remainingTimes.sort((left, right) =>
      left.date.localeCompare(right.date),
    ),
  };
}

export function summarizeDailyPlan(plan: DailyPlanSettings): DailyPlanSummary {
  return {
    title: plan.title,
    targetMinutes: plan.targetMinutes,
    startDate: plan.startDate,
    completedCount: plan.completedDates.length,
    failedCount: plan.failedDates.length,
    neutralCount: plan.neutralDates.length,
    remainingTimeCount: plan.remainingTimes.length,
    remainingTimeTotalMs: plan.remainingTimes.reduce(
      (total, item) => total + item.remainingMs,
      0,
    ),
  };
}
