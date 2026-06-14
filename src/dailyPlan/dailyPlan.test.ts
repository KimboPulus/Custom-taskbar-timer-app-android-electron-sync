import { describe, expect, it } from "vitest";
import type { DailyPlanSettings } from "../desktop/desktopTypes";
import {
  formatDailyTarget,
  getCurrentDailyPlanStreak,
  getDailyPlanDayStatus,
  getDailyPlanYearStats,
  getLocalDateKey,
} from "./dailyPlan";

const plan: DailyPlanSettings = {
  title: "Reading",
  targetMinutes: 270,
  startDate: "2026-06-10",
  completedDates: ["2026-06-10", "2026-06-12", "2026-06-14"],
};

describe("daily plan", () => {
  it("uses stable local date keys", () => {
    expect(getLocalDateKey(new Date(2026, 5, 4))).toBe("2026-06-04");
  });

  it("distinguishes completed, failed, pending, and untracked days", () => {
    expect(getDailyPlanDayStatus("2026-06-09", plan, "2026-06-14")).toBe(
      "inactive",
    );
    expect(getDailyPlanDayStatus("2026-06-10", plan, "2026-06-14")).toBe(
      "completed",
    );
    expect(getDailyPlanDayStatus("2026-06-11", plan, "2026-06-14")).toBe(
      "failed",
    );
    expect(getDailyPlanDayStatus("2026-06-14", plan, "2026-06-14")).toBe(
      "completed",
    );
    expect(getDailyPlanDayStatus("2026-06-15", plan, "2026-06-14")).toBe(
      "upcoming",
    );
  });

  it("counts yearly success and failure history", () => {
    expect(getDailyPlanYearStats(2026, plan, "2026-06-14")).toEqual({
      completed: 3,
      failed: 2,
    });
  });

  it("counts a streak through today when today is complete", () => {
    const streakPlan: DailyPlanSettings = {
      ...plan,
      startDate: "2026-06-10",
      completedDates: [
        "2026-06-10",
        "2026-06-11",
        "2026-06-12",
        "2026-06-13",
        "2026-06-14",
      ],
    };

    expect(getCurrentDailyPlanStreak(streakPlan, "2026-06-14")).toBe(5);
  });

  it("keeps yesterday's streak active until today is completed", () => {
    const streakPlan: DailyPlanSettings = {
      ...plan,
      completedDates: ["2026-06-11", "2026-06-12", "2026-06-13"],
    };

    expect(getCurrentDailyPlanStreak(streakPlan, "2026-06-14")).toBe(3);
  });

  it("resets the streak after a missed past day", () => {
    const streakPlan: DailyPlanSettings = {
      ...plan,
      completedDates: ["2026-06-10", "2026-06-11"],
    };

    expect(getCurrentDailyPlanStreak(streakPlan, "2026-06-14")).toBe(0);
  });

  it("formats decimal-hour targets in plain language", () => {
    expect(formatDailyTarget(270)).toBe("4h 30m");
    expect(formatDailyTarget(60)).toBe("1 hour");
    expect(formatDailyTarget(45)).toBe("45 min");
  });
});
