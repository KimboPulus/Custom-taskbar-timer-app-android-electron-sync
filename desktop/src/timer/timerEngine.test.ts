import { describe, expect, it } from "vitest";
import {
  addTime,
  createInitialTimerState,
  getCurrentRemainingMs,
  pauseTimer,
  resetTimer,
  restoreTimerState,
  resumeTimer,
  startTimer,
  updateTimerState,
} from "./timerEngine";
import { formatTime } from "./formatTime";
import { parseTime } from "./parseTime";

describe("timer engine", () => {
  it("calculates remaining time from elapsed wall time", () => {
    const running = startTimer(createInitialTimerState(60_000), 1_000);
    expect(getCurrentRemainingMs(running, 11_000)).toBe(50_000);
  });

  it("pauses and resumes without losing elapsed time", () => {
    const running = startTimer(createInitialTimerState(60_000), 0);
    const paused = pauseTimer(running, 12_345);
    const resumed = resumeTimer(paused, 50_000);
    expect(paused.remainingMs).toBe(47_655);
    expect(getCurrentRemainingMs(resumed, 52_000)).toBe(45_655);
  });

  it("finishes at zero and never becomes negative", () => {
    const running = startTimer(createInitialTimerState(1_000), 0);
    const finished = updateTimerState(running, 5_000);
    expect(finished.status).toBe("finished");
    expect(finished.remainingMs).toBe(0);
  });

  it("commits intermediate ticks without introducing interval drift", () => {
    const running = startTimer(createInitialTimerState(60_000), 1_000);
    const firstTick = updateTimerState(running, 11_000);
    const delayedTick = updateTimerState(firstTick, 26_000);
    expect(firstTick.remainingMs).toBe(50_000);
    expect(delayedTick.remainingMs).toBe(35_000);
  });

  it("adds and subtracts time while running", () => {
    const running = startTimer(createInitialTimerState(60_000), 0);
    const changed = addTime(running, -30_000, 10_000);
    expect(changed.remainingMs).toBe(20_000);
    expect(getCurrentRemainingMs(changed, 15_000)).toBe(15_000);
  });

  it("resets to the selected duration", () => {
    const running = startTimer(createInitialTimerState(60_000), 0);
    expect(resetTimer(running)).toEqual(createInitialTimerState(60_000));
  });

  it("restores a running timer using elapsed closed time", () => {
    const running = startTimer(createInitialTimerState(60_000), 1_000);
    const restored = restoreTimerState(running, 16_000);
    expect(restored.status).toBe("running");
    expect(restored.remainingMs).toBe(45_000);
    expect(restored.startedAt).toBe(16_000);
  });

  it("restores an expired running timer as finished", () => {
    const running = startTimer(createInitialTimerState(5_000), 1_000);
    const restored = restoreTimerState(running, 20_000);
    expect(restored.status).toBe("finished");
    expect(restored.remainingMs).toBe(0);
  });
});

describe("formatTime", () => {
  it("formats milliseconds as HH:MM:SS", () => {
    expect(formatTime(7_062_000)).toBe("01:57:42");
    expect(formatTime(0)).toBe("00:00:00");
  });
});

describe("parseTime", () => {
  it("parses exact hours, minutes, and seconds", () => {
    expect(parseTime("01:02:03")).toBe(3_723_000);
    expect(parseTime("00:00:45")).toBe(45_000);
  });

  it("rejects invalid or zero durations", () => {
    expect(parseTime("0:00:45")).toBeNull();
    expect(parseTime("00:00:4")).toBeNull();
    expect(parseTime("00:60:00")).toBeNull();
    expect(parseTime("00:00:00")).toBeNull();
    expect(parseTime("25 minutes")).toBeNull();
  });
});
