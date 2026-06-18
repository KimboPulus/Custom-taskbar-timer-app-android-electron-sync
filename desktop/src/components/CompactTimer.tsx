import type { TimerState } from "../timer/timerTypes";
import { ExpandIcon } from "./icons";
import { TimerControls } from "./TimerControls";
import { TimerDisplay } from "./TimerDisplay";

type CompactTimerProps = {
  timer: TimerState;
  onToggle: () => void;
  onReset: () => void;
  onSetDuration: (durationMs: number) => void;
  onExitCompact: () => void;
};

export function CompactTimer({
  timer,
  onToggle,
  onReset,
  onSetDuration,
  onExitCompact,
}: CompactTimerProps) {
  const progress =
    timer.durationMs > 0
      ? Math.min(100, Math.max(0, (timer.remainingMs / timer.durationMs) * 100))
      : 0;

  return (
    <main className="compact-layout">
      <div className="compact-timer-row">
        <TimerDisplay
          remainingMs={timer.remainingMs}
          compact
          onSetDuration={onSetDuration}
        />
        <button
          className="compact-expand"
          type="button"
          onClick={onExitCompact}
          aria-label="Return to full mode"
          title="Full mode (Ctrl+Alt+T)"
        >
          <ExpandIcon />
        </button>
      </div>
      <div className="compact-progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="compact-footer">
        <span className="compact-status">{timer.status}</span>
        <TimerControls
          status={timer.status}
          onToggle={onToggle}
          onReset={onReset}
          compact
        />
      </div>
    </main>
  );
}
