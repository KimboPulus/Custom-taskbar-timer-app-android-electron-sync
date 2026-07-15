import { describe, expect, it } from "vitest";
import {
  getTimerClickStartDelaySeconds,
  needsTimerClickWakeup,
  timerClickIdleWarmupMs,
  timerClickWakeDelaySeconds,
} from "./timerClickAudioPolicy";

describe("timer click audio policy", () => {
  it("delays the first click so the audio output can wake up", () => {
    expect(getTimerClickStartDelaySeconds(null, 1_000, true)).toBe(
      timerClickWakeDelaySeconds,
    );
  });

  it("does not delay clicks while audio is warm", () => {
    expect(
      getTimerClickStartDelaySeconds(1_000, 1_000 + timerClickIdleWarmupMs - 1, true),
    ).toBe(0);
  });

  it("delays the first click after idle", () => {
    expect(
      needsTimerClickWakeup(1_000, 1_000 + timerClickIdleWarmupMs, true),
    ).toBe(true);
  });

  it("delays when the audio context had to resume", () => {
    expect(getTimerClickStartDelaySeconds(1_000, 1_500, false)).toBe(
      timerClickWakeDelaySeconds,
    );
  });
});
