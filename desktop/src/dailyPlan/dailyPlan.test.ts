import { describe, expect, it } from "vitest";
import type { DailyPlanSettings } from "../desktop/desktopTypes";
import {
  formatDailyTarget,
  getCurrentDailyPlanStreak,
  getDailyPlanCatchUpDays,
  getDailyPlanDayStatus,
  getDailyPlanYearStats,
  getLocalDateKey,
  togglePastDailyPlanDate,
} from "./dailyPlan";

const plan: DailyPlanSettings = {
  title: "Reading",
  targetMinutes: 270,
  startDate: "2026-06-10",
  completedDates: ["2026-06-10", "2026-06-12", "2026-06-14"],
  failedDates: [],
  neutralDates: [],
};

describe("daily plan", () => {
  it("uses stable local date keys", () => {
    expect(getLocalDateKey(new Date(2026, 5, 4))).toBe("2026-06-04");
  });

  it("distinguishes completed, failed, pending, and untracked days", () => {
    const neutralPlan: DailyPlanSettings = {
      ...plan,
      neutralDates: ["2026-06-11"],
    };

    expect(getDailyPlanDayStatus("2026-06-09", plan, "2026-06-14")).toBe(
      "inactive",
    );
    expect(getDailyPlanDayStatus("2026-06-10", plan, "2026-06-14")).toBe(
      "completed",
    );
    expect(
      getDailyPlanDayStatus("2026-06-11", neutralPlan, "2026-06-14"),
    ).toBe(
      "neutral",
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

  it("counts failed days that need to be caught up", () => {
    expect(getDailyPlanCatchUpDays(plan, "2026-06-14")).toBe(2);
  });

  it("updates catch-up days when failures are changed to neutral or completed", () => {
    const manualFailedDate: DailyPlanSettings = {
      ...plan,
      failedDates: ["2026-06-11"],
    };
    expect(getDailyPlanCatchUpDays(manualFailedDate, "2026-06-14")).toBe(2);

    const neutralDate = togglePastDailyPlanDate(manualFailedDate, "2026-06-11");
    expect(getDailyPlanCatchUpDays(neutralDate, "2026-06-14")).toBe(1);

    const completedDate = togglePastDailyPlanDate(neutralDate, "2026-06-13");
    expect(getDailyPlanCatchUpDays(completedDate, "2026-06-14")).toBe(0);
  });

  it("includes manually failed days from before tracking started", () => {
    const recentPlan: DailyPlanSettings = {
      ...plan,
      startDate: "2026-06-14",
      completedDates: [],
      failedDates: ["2026-06-10"],
      neutralDates: [],
    };

    expect(getDailyPlanCatchUpDays(recentPlan, "2026-06-14")).toBe(1);
  });

  it("edits dates from before the plan started without changing nearby days", () => {
    const recentPlan: DailyPlanSettings = {
      ...plan,
      startDate: "2026-06-14",
      completedDates: [],
      failedDates: [],
      neutralDates: [],
    };

    const completedOldDate = togglePastDailyPlanDate(
      recentPlan,
      "2026-06-10",
    );
    expect(
      getDailyPlanDayStatus(
        "2026-06-10",
        completedOldDate,
        "2026-06-15",
      ),
    ).toBe("completed");
    expect(
      getDailyPlanDayStatus(
        "2026-06-11",
        completedOldDate,
        "2026-06-15",
      ),
    ).toBe("inactive");

    const failedOldDate = togglePastDailyPlanDate(
      completedOldDate,
      "2026-06-10",
    );
    expect(
      getDailyPlanDayStatus("2026-06-10", failedOldDate, "2026-06-15"),
    ).toBe("failed");
    expect(failedOldDate.startDate).toBe("2026-06-14");
  });

  it("cycles manually edited past dates through success, failure, and neutral", () => {
    const completedDate = togglePastDailyPlanDate(plan, "2026-06-11");
    expect(
      getDailyPlanDayStatus("2026-06-11", completedDate, "2026-06-14"),
    ).toBe("completed");

    const failedDate = togglePastDailyPlanDate(completedDate, "2026-06-11");
    expect(
      getDailyPlanDayStatus("2026-06-11", failedDate, "2026-06-14"),
    ).toBe("failed");

    const neutralDate = togglePastDailyPlanDate(failedDate, "2026-06-11");
    expect(
      getDailyPlanDayStatus("2026-06-11", neutralDate, "2026-06-14"),
    ).toBe("neutral");

    const completedAgain = togglePastDailyPlanDate(neutralDate, "2026-06-11");
    expect(
      getDailyPlanDayStatus("2026-06-11", completedAgain, "2026-06-14"),
    ).toBe("completed");
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
