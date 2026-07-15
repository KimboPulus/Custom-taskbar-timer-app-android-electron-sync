import { describe, expect, it } from "vitest";
import type { DailyPlanSettings } from "../desktop/desktopTypes";
import {
  createDailyPlanFromSqliteRows,
  dailyPlanSqliteMigrations,
  getDailyPlanSqliteRows,
} from "./dailyPlanSqlite";

const plan: DailyPlanSettings = {
  title: "Reading",
  targetMinutes: 270,
  startDate: "2026-06-20",
  completedDates: ["2026-06-20"],
  failedDates: [],
  neutralDates: [],
  remainingTimes: [{ date: "2026-06-21", remainingMs: 9000000 }],
};

describe("daily plan sqlite mapping", () => {
  it("declares versioned schema migrations", () => {
    expect(dailyPlanSqliteMigrations[0].id).toBe("001_daily_plan_history");
    expect(dailyPlanSqliteMigrations[0].sql).toContain("daily_plan_days");
    expect(dailyPlanSqliteMigrations[0].sql).toContain("remaining_ms");
  });

  it("maps a daily plan to sqlite rows and back", () => {
    const rows = getDailyPlanSqliteRows(plan);
    const restored = createDailyPlanFromSqliteRows(
      { ...plan, completedDates: [], remainingTimes: [] },
      rows.info,
      rows.days,
    );

    expect(rows.days).toEqual([
      { date: "2026-06-20", status: "completed", remaining_ms: null },
      { date: "2026-06-21", status: "unset", remaining_ms: 9000000 },
    ]);
    expect(restored).toEqual(plan);
  });
});
