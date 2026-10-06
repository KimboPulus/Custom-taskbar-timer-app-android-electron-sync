import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const componentSource = readFileSync(
  new URL("./TaskbarTimer.tsx", import.meta.url),
  "utf8",
).replaceAll("\r\n", "\n");

const cssSource = readFileSync(
  new URL("../styles/taskbar.css", import.meta.url),
  "utf8",
).replaceAll("\r\n", "\n");

describe("TaskbarTimer status indicator", () => {
  it("renders a status dot based on running vs paused timer state", () => {
    expect(componentSource).toContain('timer.status === "running"');
    expect(componentSource).toContain("taskbar-status-dot");
    expect(componentSource).toContain("taskbar-status-dot--${");
  });

  it("defines green styles for running state and red styles for paused state", () => {
    expect(cssSource).toContain(".taskbar-status-dot--running");
    expect(cssSource).toContain(".taskbar-status-dot--paused");
    expect(cssSource).toMatch(/\.taskbar-status-dot--running\s*{[^}]*background-color:\s*#16a34a/);
    expect(cssSource).toMatch(/\.taskbar-status-dot--paused\s*{[^}]*background-color:\s*#dc2626/);
  });
});
