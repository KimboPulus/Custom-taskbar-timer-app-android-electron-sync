import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const componentSource = readFileSync(
  new URL("./DailyPlanPanel.tsx", import.meta.url),
  "utf8",
).replaceAll("\r\n", "\n");
const cssSource = readFileSync(
  new URL("../styles/dailyPlan.css", import.meta.url),
  "utf8",
);

describe("DailyPlanPanel visual save state", () => {
  it("does not disable visible daily-plan controls during saves", () => {
    expect(componentSource).not.toContain("disabled={saving}");
    expect(componentSource).toContain("if (saving) {\n      return;\n    }");
  });

  it("does not dim calendar days through disabled-state opacity", () => {
    expect(cssSource).not.toMatch(
      /\.calendar-day--editable:disabled\s*{[^}]*opacity/s,
    );
  });
});
