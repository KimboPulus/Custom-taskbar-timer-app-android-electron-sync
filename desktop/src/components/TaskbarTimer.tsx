import { formatTime } from "../timer/formatTime";
import type { TimerState } from "../timer/timerTypes";

type TaskbarTimerProps = {
  timer: TimerState;
};

export function TaskbarTimer({ timer }: TaskbarTimerProps) {
  return (
    <main className="taskbar-layout">
      <strong className="taskbar-time">{formatTime(timer.remainingMs)}</strong>
    </main>
  );
}
