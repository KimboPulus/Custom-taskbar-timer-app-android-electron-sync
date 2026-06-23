import { formatTime } from "../timer/formatTime";
import type { TimerState } from "../timer/timerTypes";

type CompactTimerProps = {
  timer: TimerState;
};

export function CompactTimer({ timer }: CompactTimerProps) {
  return (
    <main className="compact-layout">
      <strong className="compact-time">{formatTime(timer.remainingMs)}</strong>
    </main>
  );
}
