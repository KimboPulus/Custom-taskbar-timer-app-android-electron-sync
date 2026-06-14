import type { TimerStatus } from "../timer/timerTypes";
import { PauseIcon, PlayIcon, ResetIcon } from "./icons";

type TimerControlsProps = {
  status: TimerStatus;
  onToggle: () => void;
  onReset: () => void;
  compact?: boolean;
};

export function TimerControls({
  status,
  onToggle,
  onReset,
  compact = false,
}: TimerControlsProps) {
  const running = status === "running";
  return (
    <div className={`timer-controls ${compact ? "timer-controls--compact" : ""}`}>
      <button
        className="control-button control-button--secondary"
        type="button"
        onClick={onReset}
        aria-label="Reset timer"
        title="Reset (Ctrl+Alt+R)"
      >
        <ResetIcon size={compact ? 17 : 20} />
      </button>
      <button
        className="control-button control-button--primary"
        type="button"
        onClick={onToggle}
        aria-label={running ? "Pause timer" : "Start timer"}
        title="Play or pause (Ctrl+Alt+Space)"
      >
        {running ? (
          <PauseIcon size={compact ? 19 : 24} />
        ) : (
          <PlayIcon size={compact ? 19 : 24} />
        )}
      </button>
    </div>
  );
}
