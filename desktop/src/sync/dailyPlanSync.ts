import type { DailyPlanSettings } from "../desktop/desktopTypes.js";

export type SyncDailyPlanStatus =
  | "Completed"
  | "Failed"
  | "Neutral"
  | "Unset";

export type SyncDailyPlanDateStatus = {
  date: string;
  status: SyncDailyPlanStatus;
  remainingMs?: number | null;
  modifiedAt: string;
  modifiedBy: string;
};

function revisionValue(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isSyncRevisionNewer(
  candidate: Pick<SyncDailyPlanDateStatus, "modifiedAt" | "modifiedBy" | "status">,
  current: Pick<SyncDailyPlanDateStatus, "modifiedAt" | "modifiedBy" | "status">,
): boolean {
  const timeDifference =
    revisionValue(candidate.modifiedAt) - revisionValue(current.modifiedAt);
  if (timeDifference !== 0) {
    return timeDifference > 0;
  }

  const deviceDifference = candidate.modifiedBy.localeCompare(current.modifiedBy);
  if (deviceDifference !== 0) {
    return deviceDifference > 0;
  }

  return candidate.status.localeCompare(current.status) > 0;
}

export function mergeDailyPlanDateRecords(
  local: SyncDailyPlanDateStatus[],
  remote: SyncDailyPlanDateStatus[],
): { records: SyncDailyPlanDateStatus[]; changed: boolean } {
  const records = new Map(local.map((record) => [record.date, record]));
  let changed = false;

  for (const candidate of remote) {
    const current = records.get(candidate.date);
    if (!current || isSyncRevisionNewer(candidate, current)) {
      records.set(candidate.date, {
        ...candidate,
        remainingMs:
          Object.prototype.hasOwnProperty.call(candidate, "remainingMs") ||
          !current
            ? candidate.remainingMs
            : current.remainingMs,
      });
      changed = true;
    }
  }

  return {
    records: [...records.values()].sort((left, right) =>
      left.date.localeCompare(right.date),
    ),
    changed,
  };
}

export function applyDateRecordsToDailyPlan(
  plan: DailyPlanSettings,
  records: SyncDailyPlanDateStatus[],
): DailyPlanSettings {
  const completedDates: string[] = [];
  const failedDates: string[] = [];
  const neutralDates: string[] = [];
  const remainingTimes: DailyPlanSettings["remainingTimes"] = [];

  for (const record of records) {
    if (record.status === "Completed") {
      completedDates.push(record.date);
    } else if (record.status === "Failed") {
      failedDates.push(record.date);
    } else if (record.status === "Neutral") {
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
    ...plan,
    completedDates: completedDates.sort(),
    failedDates: failedDates.sort(),
    neutralDates: neutralDates.sort(),
    remainingTimes: remainingTimes.sort((left, right) =>
      left.date.localeCompare(right.date),
    ),
  };
}

export function getExplicitDailyPlanStatus(
  plan: DailyPlanSettings,
  date: string,
): SyncDailyPlanStatus {
  if (plan.completedDates.includes(date)) {
    return "Completed";
  }
  if (plan.failedDates.includes(date)) {
    return "Failed";
  }
  if (plan.neutralDates.includes(date)) {
    return "Neutral";
  }
  return "Unset";
}

export function getExplicitDailyPlanDates(plan: DailyPlanSettings): string[] {
  return Array.from(
    new Set([
      ...plan.completedDates,
      ...plan.failedDates,
      ...plan.neutralDates,
      ...plan.remainingTimes.map((item) => item.date),
    ]),
  ).sort();
}

export function getExplicitDailyPlanRemainingMs(
  plan: DailyPlanSettings,
  date: string,
): number | null {
  return plan.remainingTimes.find((item) => item.date === date)?.remainingMs ?? null;
}
