export const timerClickIdleWarmupMs = 20_000;
export const timerClickWakeDelaySeconds = 0.055;

export function needsTimerClickWakeup(
  lastClickStartedAt: number | null,
  now: number,
  contextWasRunning: boolean,
): boolean {
  return (
    !contextWasRunning ||
    lastClickStartedAt === null ||
    now - lastClickStartedAt >= timerClickIdleWarmupMs
  );
}

export function getTimerClickStartDelaySeconds(
  lastClickStartedAt: number | null,
  now: number,
  contextWasRunning: boolean,
): number {
  return needsTimerClickWakeup(lastClickStartedAt, now, contextWasRunning)
    ? timerClickWakeDelaySeconds
    : 0;
}
