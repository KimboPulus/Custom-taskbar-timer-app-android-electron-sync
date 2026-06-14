import { formatTime } from "../timer/formatTime";
import type { TimerState } from "../timer/timerTypes";
import { ExpandIcon, PauseIcon, PlayIcon } from "./icons";

type TaskbarTimerProps = {
  timer: TimerState;
  onToggle: () => void;
  onExitToFull: () => void;
};

export function TaskbarTimer({
  timer,
  onToggle,
  onExitToFull,
}: TaskbarTimerProps) {
  const running = timer.status === "running";
  const progress =
    timer.durationMs > 0
      ? Math.min(100, Math.max(0, (timer.remainingMs / timer.durationMs) * 100))
      : 0;

  return (
    <main className="taskbar-layout">
      <span
        className={`taskbar-status taskbar-status--${timer.status}`}
        title={timer.status}
        aria-label={`Timer is ${timer.status}`}
      />
      <strong className="taskbar-time">{formatTime(timer.remainingMs)}</strong>
      <button
        className="taskbar-button taskbar-button--toggle"
        type="button"
        onClick={onToggle}
        aria-label={running ? "Pause timer" : "Start timer"}
        title="Play or pause (Ctrl+Alt+Space)"
      >
        {running ? <PauseIcon size={15} /> : <PlayIcon size={15} />}
      </button>
      <button
        className="taskbar-button"
        type="button"
        onClick={onExitToFull}
        aria-label="Return to full mode"
        title="Return to full mode"
      >
        <ExpandIcon size={14} />
      </button>
      <span className="taskbar-progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </span>
    </main>
  );
}
