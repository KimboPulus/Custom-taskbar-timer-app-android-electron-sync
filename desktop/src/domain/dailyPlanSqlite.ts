import type { DailyPlanSettings } from "../desktop/desktopTypes.js";
import {
  createDailyPlanFromDayRecords,
  getExplicitDailyPlanDayRecords,
  type ExplicitDailyPlanDayRecord,
  type ExplicitDailyPlanDayStatus,
} from "./dailyPlanModel.js";

export const dailyPlanSqliteMigrations = [
  {
    id: "001_daily_plan_history",
    sql: `
      CREATE TABLE IF NOT EXISTS daily_plan (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        title TEXT NOT NULL,
        target_minutes INTEGER NOT NULL,
        start_date TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS daily_plan_days (
        date TEXT PRIMARY KEY,
        status TEXT NOT NULL CHECK (status IN ('completed', 'failed', 'neutral', 'unset')),
        remaining_ms INTEGER,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_daily_plan_days_status
        ON daily_plan_days(status);
    `,
  },
] as const;

export type DailyPlanInfoSqliteRow = {
  title: string;
  target_minutes: number;
  start_date: string | null;
};

export type DailyPlanDaySqliteRow = {
  date: string;
  status: ExplicitDailyPlanDayStatus;
  remaining_ms: number | null;
};

export function getDailyPlanSqliteRows(
  plan: DailyPlanSettings,
): {
  info: DailyPlanInfoSqliteRow;
  days: DailyPlanDaySqliteRow[];
} {
  return {
    info: {
      title: plan.title,
      target_minutes: plan.targetMinutes,
      start_date: plan.startDate,
    },
    days: getExplicitDailyPlanDayRecords(plan).map((record) => ({
      date: record.date,
      status: record.status,
      remaining_ms: record.remainingMs,
    })),
  };
}

export function createDailyPlanFromSqliteRows(
  fallback: DailyPlanSettings,
  info: DailyPlanInfoSqliteRow | null | undefined,
  days: DailyPlanDaySqliteRow[],
): DailyPlanSettings | null {
  if (!info) {
    return null;
  }

  const records: ExplicitDailyPlanDayRecord[] = days.map((day) => ({
    date: day.date,
    status: day.status,
    remainingMs: day.remaining_ms,
  }));

  return createDailyPlanFromDayRecords(
    {
      ...fallback,
      title: info.title,
      targetMinutes: info.target_minutes,
      startDate: info.start_date,
    },
    records,
  );
}
