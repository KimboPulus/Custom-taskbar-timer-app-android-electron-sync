import { describe, expect, it } from "vitest";
import type { DailyPlanSettings } from "../desktop/desktopTypes";
import {
  applyDateRecordsToDailyPlan,
  mergeDailyPlanDateRecords,
  type SyncDailyPlanDateStatus,
} from "./dailyPlanSync";

const record = (
  date: string,
  status: SyncDailyPlanDateStatus["status"],
  modifiedAt: string,
  modifiedBy: string,
): SyncDailyPlanDateStatus => ({ date, status, modifiedAt, modifiedBy });

const emptyPlan: DailyPlanSettings = {
  title: "Reading",
  targetMinutes: 270,
  startDate: "2026-06-01",
  completedDates: [],
  failedDates: [],
  neutralDates: [],
};

describe("daily plan per-date sync", () => {
  it("preserves desktop history when a stale phone adds a new day", () => {
    const desktop = Array.from({ length: 10 }, (_, index) =>
      record(
        `2026-06-${String(index + 1).padStart(2, "0")}`,
        "Completed",
        "2026-06-10T10:00:00.000Z",
        "desktop",
      ),
    );
    const phone = [
      record(
        "2026-06-11",
        "Completed",
        "2026-06-11T10:00:00.000Z",
        "android",
      ),
    ];

    const merged = mergeDailyPlanDateRecords(desktop, phone);
    const plan = applyDateRecordsToDailyPlan(emptyPlan, merged.records);

    expect(plan.completedDates).toHaveLength(11);
    expect(plan.completedDates[0]).toBe("2026-06-01");
    expect(plan.completedDates[10]).toBe("2026-06-11");
  });

  it("uses the newer status only for the conflicting date", () => {
    const merged = mergeDailyPlanDateRecords(
      [
        record("2026-06-01", "Completed", "2026-06-03T10:00:00.000Z", "desktop"),
        record("2026-06-02", "Completed", "2026-06-03T10:00:00.000Z", "desktop"),
      ],
      [record("2026-06-02", "Failed", "2026-06-04T10:00:00.000Z", "android")],
    );
    const plan = applyDateRecordsToDailyPlan(emptyPlan, merged.records);

    expect(plan.completedDates).toEqual(["2026-06-01"]);
    expect(plan.failedDates).toEqual(["2026-06-02"]);
  });

  it("keeps a newer local edit and applies an Unset tombstone independently", () => {
    const merged = mergeDailyPlanDateRecords(
      [
        record("2026-06-01", "Completed", "2026-06-05T10:00:00.000Z", "desktop"),
        record("2026-06-02", "Completed", "2026-06-03T10:00:00.000Z", "desktop"),
      ],
      [
        record("2026-06-01", "Failed", "2026-06-04T10:00:00.000Z", "android"),
        record("2026-06-02", "Unset", "2026-06-04T10:00:00.000Z", "android"),
      ],
    );
    const plan = applyDateRecordsToDailyPlan(emptyPlan, merged.records);

    expect(plan.completedDates).toEqual(["2026-06-01"]);
    expect(plan.failedDates).toEqual([]);
    expect(plan.neutralDates).toEqual([]);
  });
});
