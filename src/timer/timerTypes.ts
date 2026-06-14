export type TimerStatus = "idle" | "running" | "paused" | "finished";

export type TimerState = {
  durationMs: number;
  remainingMs: number;
  status: TimerStatus;
  startedAt: number | null;
  pausedRemainingMs: number | null;
};
