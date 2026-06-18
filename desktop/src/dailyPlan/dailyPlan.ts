import type { DailyPlanSettings } from "../desktop/desktopTypes";

export type DailyPlanDayStatus =
  | "inactive"
  | "completed"
  | "failed"
  | "pending"
  | "upcoming";

export type DailyPlanYearStats = {
  completed: number;
  failed: number;
};

export function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDailyPlanDayStatus(
  dateKey: string,
  plan: DailyPlanSettings,
  todayKey = getLocalDateKey(),
): DailyPlanDayStatus {
  if (plan.completedDates.includes(dateKey)) {
    return "completed";
  }

  if (plan.failedDates.includes(dateKey)) {
    return "failed";
  }

  if (!plan.startDate || dateKey < plan.startDate) {
    return "inactive";
  }

  if (dateKey < todayKey) {
    return "failed";
  }

  return dateKey === todayKey ? "pending" : "upcoming";
}

export function getDailyPlanYearStats(
  year: number,
  plan: DailyPlanSettings,
  todayKey = getLocalDateKey(),
): DailyPlanYearStats {
  const stats: DailyPlanYearStats = { completed: 0, failed: 0 };

  for (let month = 0; month < 12; month += 1) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
      const status = getDailyPlanDayStatus(
        getLocalDateKey(new Date(year, month, day)),
        plan,
        todayKey,
      );
      if (status === "completed") {
        stats.completed += 1;
      } else if (status === "failed") {
        stats.failed += 1;
      }
    }
  }

  return stats;
}

function getPreviousDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return getLocalDateKey(new Date(year, month - 1, day - 1));
}

export function getCurrentDailyPlanStreak(
  plan: DailyPlanSettings,
  todayKey = getLocalDateKey(),
): number {
  if (!plan.startDate) {
    return 0;
  }

  const completedDates = new Set(plan.completedDates);
  let cursor = completedDates.has(todayKey)
    ? todayKey
    : getPreviousDateKey(todayKey);
  let streak = 0;

  while (completedDates.has(cursor)) {
    streak += 1;
    cursor = getPreviousDateKey(cursor);
  }

  return streak;
}

export function togglePastDailyPlanDate(
  plan: DailyPlanSettings,
  dateKey: string,
): DailyPlanSettings {
  const completedDates = new Set(plan.completedDates);
  const failedDates = new Set(plan.failedDates);

  if (completedDates.has(dateKey)) {
    completedDates.delete(dateKey);
    failedDates.add(dateKey);
  } else {
    failedDates.delete(dateKey);
    completedDates.add(dateKey);
  }

  return {
    ...plan,
    completedDates: [...completedDates].sort(),
    failedDates: [...failedDates].sort(),
  };
}

export function formatDailyTarget(targetMinutes: number): string {
  const hours = Math.floor(targetMinutes / 60);
  const minutes = targetMinutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }
  if (minutes === 0) {
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  return `${hours}h ${minutes}m`;
}
