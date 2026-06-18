import type { TimerState } from "./timerTypes";

const clampDuration = (durationMs: number): number =>
  Math.max(0, Math.round(durationMs));

export function createInitialTimerState(durationMs: number): TimerState {
  const duration = clampDuration(durationMs);
  return {
    durationMs: duration,
    remainingMs: duration,
    status: "idle",
    startedAt: null,
    pausedRemainingMs: null,
  };
}

export function getCurrentRemainingMs(state: TimerState, now: number): number {
  if (state.status !== "running" || state.startedAt === null) {
    return Math.max(0, state.remainingMs);
  }

  // The interval only requests a repaint. Real elapsed wall time drives the timer.
  return Math.max(0, state.remainingMs - (now - state.startedAt));
}

export function startTimer(state: TimerState, now: number): TimerState {
  if (state.status === "running" || state.remainingMs <= 0) {
    return state;
  }

  return {
    ...state,
    status: "running",
    startedAt: now,
    pausedRemainingMs: null,
  };
}

export function pauseTimer(state: TimerState, now: number): TimerState {
  if (state.status !== "running") {
    return state;
  }

  const remainingMs = getCurrentRemainingMs(state, now);
  return {
    ...state,
    remainingMs,
    status: remainingMs === 0 ? "finished" : "paused",
    startedAt: null,
    pausedRemainingMs: remainingMs,
  };
}

export function resumeTimer(state: TimerState, now: number): TimerState {
  if (state.status !== "paused" || state.remainingMs <= 0) {
    return state;
  }

  return {
    ...state,
    status: "running",
    startedAt: now,
    pausedRemainingMs: null,
  };
}

export function resetTimer(state: TimerState): TimerState {
  return createInitialTimerState(state.durationMs);
}

export function setDuration(state: TimerState, durationMs: number): TimerState {
  return createInitialTimerState(durationMs);
}

export function addTime(
  state: TimerState,
  deltaMs: number,
  now: number,
): TimerState {
  const currentRemaining = getCurrentRemainingMs(state, now);
  const remainingMs = Math.max(0, currentRemaining + deltaMs);
  const durationMs = Math.max(remainingMs, state.durationMs + deltaMs, 0);

  if (remainingMs === 0) {
    return {
      durationMs,
      remainingMs: 0,
      status: "finished",
      startedAt: null,
      pausedRemainingMs: null,
    };
  }

  if (state.status === "running") {
    return {
      ...state,
      durationMs,
      remainingMs,
      startedAt: now,
      pausedRemainingMs: null,
    };
  }

  return {
    ...state,
    durationMs,
    remainingMs,
    status: state.status === "finished" ? "paused" : state.status,
    pausedRemainingMs: state.status === "paused" ? remainingMs : null,
  };
}

export function updateTimerState(state: TimerState, now: number): TimerState {
  if (state.status !== "running") {
    return state;
  }

  const remainingMs = getCurrentRemainingMs(state, now);
  if (remainingMs === 0) {
    return {
      ...state,
      remainingMs: 0,
      status: "finished",
      startedAt: null,
      pausedRemainingMs: null,
    };
  }

  return {
    ...state,
    remainingMs,
    startedAt: now,
  };
}

export function restoreTimerState(state: TimerState, now: number): TimerState {
  if (state.status !== "running") {
    return state;
  }

  return updateTimerState(state, now);
}
