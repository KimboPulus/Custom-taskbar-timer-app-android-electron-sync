import { formatTime } from "../timer/formatTime";
import type { TimerState } from "../timer/timerTypes";

type TaskbarTimerProps = {
  timer: TimerState;
};

export function TaskbarTimer({ timer }: TaskbarTimerProps) {
  const isRunning = timer.status === "running";

  return (
    <main className="taskbar-layout">
      <div className="taskbar-content">
        <span
          className={`taskbar-status-dot taskbar-status-dot--${
            isRunning ? "running" : "paused"
          }`}
          aria-label={isRunning ? "Running" : "Paused"}
          title={isRunning ? "Timer is running" : "Timer is paused"}
        />
        <strong className="taskbar-time">{formatTime(timer.remainingMs)}</strong>
      </div>
    </main>
  );
}
