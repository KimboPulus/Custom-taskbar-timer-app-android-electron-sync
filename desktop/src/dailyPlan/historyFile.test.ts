import { describe, expect, it } from "vitest";
import type { DailyPlanSettings } from "../desktop/desktopTypes";
import {
  createDailyPlanHistoryFile,
  parseDailyPlanHistoryFile,
} from "./historyFile";

const plan: DailyPlanSettings = {
  title: "Reading",
  targetMinutes: 270,
  startDate: "2026-06-10",
  completedDates: ["2026-06-10"],
  failedDates: ["2026-06-11"],
  neutralDates: ["2026-06-12"],
};

describe("daily plan history file", () => {
  it("round trips complete daily plan history", () => {
    const file = createDailyPlanHistoryFile(plan, "2026-06-14T12:00:00.000Z");
    const imported = parseDailyPlanHistoryFile(JSON.stringify(file));

    expect(imported).toEqual(plan);
  });

  it("infers start date from imported history when missing", () => {
    const imported = parseDailyPlanHistoryFile(
      JSON.stringify({
        title: "Imported",
        targetMinutes: 60,
        completedDates: ["2026-06-12"],
        failedDates: ["2026-06-10"],
        neutralDates: ["2026-06-11"],
      }),
    );

    expect(imported.startDate).toBe("2026-06-10");
  });

  it("deduplicates overlapping day status lists", () => {
    const imported = parseDailyPlanHistoryFile(
      JSON.stringify({
        title: "Imported",
        targetMinutes: 60,
        startDate: "2026-06-10",
        completedDates: ["2026-06-10", "2026-06-10"],
        failedDates: ["2026-06-10", "2026-06-11"],
        neutralDates: ["2026-06-11", "2026-06-12"],
      }),
    );

    expect(imported.completedDates).toEqual(["2026-06-10"]);
    expect(imported.failedDates).toEqual(["2026-06-11"]);
    expect(imported.neutralDates).toEqual(["2026-06-12"]);
  });
});
