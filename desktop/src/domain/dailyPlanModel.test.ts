import { describe, expect, it } from "vitest";
import type { DailyPlanSettings } from "../desktop/desktopTypes";
import {
  createDailyPlanFromDayRecords,
  getExplicitDailyPlanDayRecords,
  normalizeDailyPlanSettings,
  summarizeDailyPlan,
} from "./dailyPlanModel";

const fallbackPlan: DailyPlanSettings = {
  title: "Reading",
  targetMinutes: 270,
  startDate: null,
  completedDates: [],
  failedDates: [],
  neutralDates: [],
  remainingTimes: [],
};

describe("daily plan domain model", () => {
  it("normalizes overlapping date lists and time-left records", () => {
    const normalized = normalizeDailyPlanSettings(
      {
        title: "  Deep work  ",
        targetMinutes: 99999,
        completedDates: ["2026-06-20", "2026-06-20"],
        failedDates: ["2026-06-20", "2026-06-21"],
        neutralDates: ["2026-06-21", "2026-06-22"],
        remainingTimes: [
          { date: "2026-06-23", remainingMs: 9000000 },
          { date: "bad", remainingMs: 1 },
        ],
      },
      fallbackPlan,
    );

    expect(normalized).toEqual({
      title: "Deep work",
      targetMinutes: 1440,
      startDate: null,
      completedDates: ["2026-06-20"],
      failedDates: ["2026-06-21"],
      neutralDates: ["2026-06-22"],
      remainingTimes: [{ date: "2026-06-23", remainingMs: 9000000 }],
    });
  });

  it("infers start date from explicit records when requested", () => {
    const normalized = normalizeDailyPlanSettings(
      {
        title: "Reading",
        targetMinutes: 60,
        remainingTimes: [{ date: "2026-06-19", remainingMs: 1000 }],
        completedDates: ["2026-06-20"],
      },
      fallbackPlan,
      { inferStartDateFromRecords: true },
    );

    expect(normalized.startDate).toBe("2026-06-19");
  });

  it("round trips explicit day records", () => {
    const plan: DailyPlanSettings = {
      ...fallbackPlan,
      completedDates: ["2026-06-20"],
      remainingTimes: [{ date: "2026-06-21", remainingMs: 9000000 }],
    };

    expect(
      createDailyPlanFromDayRecords(plan, getExplicitDailyPlanDayRecords(plan)),
    ).toEqual(plan);
  });

  it("summarizes history without exposing raw settings", () => {
    const summary = summarizeDailyPlan({
      ...fallbackPlan,
      completedDates: ["2026-06-20"],
      failedDates: ["2026-06-21"],
      remainingTimes: [{ date: "2026-06-21", remainingMs: 9000000 }],
    });

    expect(summary).toMatchObject({
      completedCount: 1,
      failedCount: 1,
      remainingTimeCount: 1,
      remainingTimeTotalMs: 9000000,
    });
  });
});
