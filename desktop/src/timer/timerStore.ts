import { useCallback, useEffect, useReducer } from "react";
import {
  addTime,
  createInitialTimerState,
  pauseTimer,
  resetTimer,
  restoreTimerState,
  resumeTimer,
  setDuration,
  startTimer,
  updateTimerState,
} from "./timerEngine";
import type { TimerState } from "./timerTypes";

type TimerAction =
  | { type: "tick"; now: number }
  | { type: "toggle"; now: number }
  | { type: "reset" }
  | { type: "restore"; state: TimerState; now: number }
  | { type: "set-duration"; durationMs: number }
  | { type: "add-time"; deltaMs: number; now: number };

function reducer(state: TimerState, action: TimerAction): TimerState {
  switch (action.type) {
    case "tick":
      return updateTimerState(state, action.now);
    case "toggle":
      if (state.status === "running") {
        return pauseTimer(state, action.now);
      }
      if (state.status === "paused") {
        return resumeTimer(state, action.now);
      }
      if (state.status === "finished") {
        return startTimer(resetTimer(state), action.now);
      }
      return startTimer(state, action.now);
    case "reset":
      return resetTimer(state);
    case "restore":
      return restoreTimerState(action.state, action.now);
    case "set-duration":
      return setDuration(state, action.durationMs);
    case "add-time":
      return addTime(state, action.deltaMs, action.now);
  }
}

export function useTimerStore(initialDurationMs: number) {
  const [state, dispatch] = useReducer(
    reducer,
    initialDurationMs,
    createInitialTimerState,
  );

  useEffect(() => {
    if (state.status !== "running") {
      return;
    }

    const interval = window.setInterval(() => {
      dispatch({ type: "tick", now: Date.now() });
    }, 200);
    return () => window.clearInterval(interval);
  }, [state.status]);

  const toggle = useCallback(
    () => dispatch({ type: "toggle", now: Date.now() }),
    [],
  );
  const reset = useCallback(() => dispatch({ type: "reset" }), []);
  const restore = useCallback(
    (state: TimerState) =>
      dispatch({ type: "restore", state, now: Date.now() }),
    [],
  );
  const changeDuration = useCallback(
    (durationMs: number) => dispatch({ type: "set-duration", durationMs }),
    [],
  );
  const changeTime = useCallback(
    (deltaMs: number) =>
      dispatch({ type: "add-time", deltaMs, now: Date.now() }),
    [],
  );

  return { state, toggle, reset, restore, changeDuration, changeTime };
}
